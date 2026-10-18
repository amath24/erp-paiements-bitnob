"""Réception des webhooks Bitnob (payouts, cartes, KYC carte).

- Signature : header x-bitnob-signature = HMAC-SHA512(corps brut, secret)
- Déduplication par eventId / event_id (Bitnob renvoie jusqu'à 3 fois)
- On répond vite (200) ; le travail lourd part en tâche de fond
- Les webhooks ne suffisent pas : prévoir aussi un polling de secours
"""
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.bitnob.client import BitnobClient, BitnobError
from app.config import get_settings
from app.repo import get_repo
from app.services import bulk
from app.services import envelopes as env_svc

log = logging.getLogger("webhooks")
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _valid_signature(raw: bytes, header: str) -> bool:
    secret = get_settings().bitnob_client_secret.encode()
    expected = hmac.new(secret, raw, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, header.strip().lower())


async def _safe(coro, label: str) -> None:
    try:
        await coro
    except BitnobError as e:
        log.error("%s a échoué : %s", label, e.payload)
    except Exception:  # ne jamais faire planter la tâche de fond
        log.exception("%s a échoué", label)


def register_event(payload: dict) -> str:
    """Déduplication : 'duplicate' si l'événement a déjà été traité."""
    event_id = payload.get("eventId") or payload.get("event_id")
    if event_id:
        if event_id in env_svc.SEEN_EVENTS:
            return "duplicate"
        env_svc.SEEN_EVENTS.add(event_id)
    return "new"


async def dispatch(client: BitnobClient, payload: dict) -> None:
    """Traite un événement Bitnob (réel ou simulé)."""
    event = payload.get("event", "")
    data = payload.get("data", payload)

    # ---------------- Payouts ----------------
    if event.startswith("payouts."):
        # Se baser sur `event`, pas sur data.status
        log.info("%s %s", event, data.get("reference"))
        await _safe(bulk.apply_webhook(get_repo(), event, data), "payout webhook")

    # ---------------- KYC carte ----------------
    elif event.startswith("virtualcard.user.kyc."):
        cid = data.get("customerId") or data.get("id")
        status = {"complete": "approved", "failed": "rejected", "pending": "pending"}.get(
            event.rsplit(".", 1)[-1], "unknown")
        if cid:
            env_svc.KYC_CUSTOMERS[cid] = {"status": status, "email": data.get("customerEmail"),
                                          "retry_link": data.get("verificationLink")}
        log.info("KYC %s -> %s", cid, status)

    # ---------------- Cartes ----------------
    elif event.startswith("virtualcard."):
        card_id = data.get("cardId") or data.get("id")
        if event == "virtualcard.topup.completed":
            await _safe(env_svc.on_topup_completed(client, card_id), "topup")
        elif event == "virtualcard.topup.failed":
            env_svc.add_alert(card_id, "warning", "Recharge de la carte échouée.")
        elif event.startswith("virtualcard.transaction.declined"):
            env_svc.add_alert(card_id, "info", f"Paiement refusé ({data.get('reason')}) "
                                               f"chez {data.get('merchantName')}.")
        elif event.startswith("virtualcard.transaction."):
            # debit / authorization / settlement / contactless / crossborder / refund...
            log.info("%s %s %s", event, data.get("merchantName"), data.get("displayAmount"))
            await _safe(env_svc.check_card_balance(client, card_id), "check_balance")
        else:
            log.info("événement carte: %s", event)
    else:
        log.info("événement non géré: %s", event)


@router.post("/bitnob")
async def bitnob_webhook(request: Request, background: BackgroundTasks):
    raw = await request.body()
    sig = request.headers.get("x-bitnob-signature", "")
    if not sig or not _valid_signature(raw, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")
    payload = json.loads(raw)
    if register_event(payload) == "duplicate":
        return {"status": "duplicate"}
    background.add_task(dispatch, request.app.state.bitnob, payload)  # on répond vite
    return {"status": "ok"}
