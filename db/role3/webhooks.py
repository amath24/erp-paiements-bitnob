"""Webhooks Bitnob et machine à états des payouts.

C'est le contrat entre le backend (personne 1) et la donnée (personne 3) :
le backend reçoit le webhook, appelle `decide()`, et applique la décision.

Ce que dit la doc Bitnob (bitnob.dev, payouts > webhooks) :
  * en-tête `x-bitnob-signature` = HMAC SHA512 du corps avec la clé secrète
  * `event_id` unique par livraison : sert à ignorer les renvois
  * se fier à `event`, pas à `data.status`
  * événements documentés : payouts.initialized, payouts.processing,
    payouts.withdrawal.success, payouts.withdrawal.expired
  * AUCUN événement d'échec n'est documenté : un payout FAILED se découvre
    via la réponse de finalize ou GET /api/payouts/:id. D'où la vue
    v_reconciliation_issues (STUCK) qui signale les payouts à revérifier.

Non confirmé (à tester en sandbox) : encodage de la signature (hex ou base64).
`verify_signature` accepte les deux.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
from dataclasses import dataclass

# Événement webhook -> statut interne
EVENT_TO_STATUS = {
    "payouts.initialized": "initialized",
    "payouts.processing": "pending",
    "payouts.withdrawal.success": "completed",
    "payouts.withdrawal.expired": "expired",
}

# Statut renvoyé par l'API (quote / initialize / finalize / get) -> statut interne
API_STATUS_TO_STATUS = {
    "QUOTE": "quoted",
    "INITIATED": "initialized",
    "PENDING": "pending",
    "COMPLETED": "completed",
    "FAILED": "failed",
}

TERMINAL = {"completed", "failed", "expired"}
RANK = {"quoted": 0, "initialized": 1, "pending": 2, "completed": 3, "failed": 3, "expired": 3}


def verify_signature(raw_body: bytes, signature: str | None, secret: str) -> bool:
    """Vérifie l'en-tête x-bitnob-signature. Toujours sur le corps BRUT, jamais sur un JSON re-sérialisé."""
    if not signature or not secret:
        return False
    digest = hmac.new(secret.encode(), raw_body, hashlib.sha512).digest()
    candidates = (digest.hex(), base64.b64encode(digest).decode())
    return any(hmac.compare_digest(signature.strip(), c) for c in candidates)


@dataclass(frozen=True)
class Decision:
    apply: bool                 # faut-il mettre à jour le payout ?
    new_status: str | None
    reason: str                 # pour le journal et le débogage
    alert: bool = False         # à faire remonter dans le rapprochement


def next_status(current: str, incoming: str) -> Decision:
    """Règles de transition.

    * un statut terminal ne change plus (sauf conflit, signalé)
    * un événement en retard (rang inférieur) est ignoré : les webhooks peuvent arriver dans le désordre
    """
    if incoming not in RANK:
        return Decision(False, None, f"Statut inconnu : {incoming}", alert=True)
    if current == incoming:
        return Decision(False, None, "Déjà dans ce statut")
    if current in TERMINAL:
        if incoming in TERMINAL:
            return Decision(False, None, f"Conflit : déjà {current}, reçu {incoming}", alert=True)
        return Decision(False, None, f"Événement en retard ({incoming}) ignoré, payout déjà {current}")
    if RANK[incoming] < RANK[current]:
        return Decision(False, None, f"Événement en retard ({incoming}) ignoré, payout déjà {current}")
    return Decision(True, incoming, f"{current} -> {incoming}")


def decide(payload: dict, signature_ok: bool, already_seen: bool, current_status: str | None) -> Decision:
    """Décision complète pour un webhook reçu.

    already_seen   : event_id déjà présent dans webhook_events
    current_status : statut actuel du payout trouvé par data.reference (None si inconnu)
    """
    if not signature_ok:
        return Decision(False, None, "Signature invalide : événement rejeté", alert=True)
    if already_seen:
        return Decision(False, None, "event_id déjà traité (renvoi Bitnob)")
    event = payload.get("event", "")
    if event not in EVENT_TO_STATUS:
        return Decision(False, None, f"Événement non géré : {event}", alert=True)
    if current_status is None:
        return Decision(False, None, "Référence inconnue", alert=True)
    return next_status(current_status, EVENT_TO_STATUS[event])
