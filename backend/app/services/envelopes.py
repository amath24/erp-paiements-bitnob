"""Logique métier des enveloppes budgétaires (1 enveloppe = 1 carte virtuelle).

Stockage EN MÉMOIRE pour l'instant (perdu au redémarrage) : sera remplacé par
les tables budgets / card_transactions / alerts de la personne en charge de la DB.
"""
import logging
import time
from dataclasses import dataclass

from app.bitnob import cards as cards_api
from app.bitnob.client import BitnobClient
from app.bitnob.units import micro_to_usd
from app.config import get_settings

log = logging.getLogger("envelopes")


@dataclass
class Envelope:
    card_id: str
    name: str
    monthly_budget_usd: float
    customer_id: str
    low_alerted: bool = False
    frozen_by_app: bool = False


ENVELOPES: dict[str, Envelope] = {}
ALERTS: list[dict] = []
KYC_CUSTOMERS: dict[str, dict] = {}
SEEN_EVENTS: set[str] = set()


def add_alert(card_id: str, level: str, message: str) -> dict:
    alert = {"ts": int(time.time()), "card_id": card_id, "level": level, "message": message}
    ALERTS.append(alert)
    log.warning("ALERT[%s] %s", level, message)
    return alert


def balance_usd(card: dict) -> float:
    if card.get("display_amount") is not None:
        return float(card["display_amount"])
    return micro_to_usd(card.get("balance_amount") or 0)


def public_view(card: dict, env: Envelope | None) -> dict:
    """Ce que l'utilisateur voit : jamais le numéro de carte, seulement 4 chiffres."""
    bal = balance_usd(card)
    budget = env.monthly_budget_usd if env else None
    return {
        "card_id": card.get("id") or (env.card_id if env else None),
        "name": env.name if env else card.get("name"),
        "status": card.get("status"),
        "provisioning": card.get("created_status"),
        "last4": card.get("last_four_digit") or (card.get("masked_pan") or "")[-4:] or None,
        "balance_usd": bal,
        "monthly_budget_usd": budget,
        "spent_usd": round(max(budget - bal, 0), 2) if budget is not None else None,
    }


async def check_card_balance(client: BitnobClient, card_id: str) -> None:
    """Appelé après chaque transaction : alerte solde bas, gel à l'épuisement."""
    env = ENVELOPES.get(card_id)
    if env is None:
        return
    card = await cards_api.get_card(client, card_id)
    bal = balance_usd(card)
    threshold = get_settings().alert_threshold_usd

    if bal <= 0:
        if card.get("status") != "frozen" and not env.frozen_by_app:
            await cards_api.set_status(client, card_id, "frozen")
            env.frozen_by_app = True
            add_alert(card_id, "critical", f"Budget « {env.name} » épuisé : carte gelée.")
    elif bal <= threshold:
        if not env.low_alerted:
            env.low_alerted = True
            add_alert(card_id, "warning", f"Il te reste {bal:.2f} USD sur ton budget {env.name}.")
    else:
        env.low_alerted = False


async def on_topup_completed(client: BitnobClient, card_id: str) -> None:
    """Recharge confirmée : on dégèle la carte si c'est nous qui l'avions gelée."""
    env = ENVELOPES.get(card_id)
    if env is None:
        return
    env.low_alerted = False
    if env.frozen_by_app:
        await cards_api.set_status(client, card_id, "active")
        env.frozen_by_app = False
        add_alert(card_id, "info", f"Budget « {env.name} » rechargé : carte réactivée.")
