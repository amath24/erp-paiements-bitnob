"""Enveloppes budgétaires : 1 enveloppe = 1 carte virtuelle dédiée."""
import asyncio
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from app.bitnob import cards as cards_api
from app.bitnob.client import BitnobClient, BitnobError
from app.bitnob.units import usd_to_micro
from app.config import get_settings
from app.deps import get_client, require_api_key
from app.schemas import EnvelopeIn
from app.services import envelopes as svc

router = APIRouter(prefix="/envelopes", tags=["envelopes"], dependencies=[Depends(require_api_key)])
alerts_router = APIRouter(tags=["envelopes"], dependencies=[Depends(require_api_key)])


def _get_env(card_id: str) -> svc.Envelope:
    env = svc.ENVELOPES.get(card_id)
    if env is None:
        raise HTTPException(404, "Enveloppe inconnue (non créée via /envelopes).")
    return env


@router.post("", status_code=201)
async def create_envelope(body: EnvelopeIn, c: BitnobClient = Depends(get_client)):
    s = get_settings()
    customer_id = body.customer_id or s.default_card_customer_id
    if not customer_id:
        raise HTTPException(400, "customer_id requis (ou DEFAULT_CARD_CUSTOMER_ID dans .env) : "
                                 "obtiens-le via POST /cards/kyc.")
    budget_micro = usd_to_micro(body.monthly_budget_usd)
    resp = await cards_api.create_card(
        c,
        customer_id=customer_id,
        amount_micro=budget_micro,
        name=body.cardholder_name,
        reference=f"ENV-{uuid.uuid4().hex[:16]}",
        webhook_url=s.webhook_url,
        brand=body.card_brand,
        monthly_limit_micro=budget_micro if body.enforce_monthly_limit else None,
    )
    card = cards_api.card_of(resp)
    env = svc.Envelope(card_id=card["id"], name=body.name,
                       monthly_budget_usd=float(body.monthly_budget_usd), customer_id=customer_id)
    svc.ENVELOPES[env.card_id] = env
    return svc.public_view(card, env)


@router.get("")
async def list_envelopes(c: BitnobClient = Depends(get_client)):
    async def one(env: svc.Envelope):
        try:
            return svc.public_view(await cards_api.get_card(c, env.card_id), env)
        except BitnobError as e:
            return {"card_id": env.card_id, "name": env.name, "error": e.payload}

    return await asyncio.gather(*[one(e) for e in svc.ENVELOPES.values()])


@router.post("/recharge-all")
async def recharge_all(c: BitnobClient = Depends(get_client)):
    """À appeler en début de mois (cron / scheduler) : remonte chaque carte à son budget."""
    results = []
    for env in list(svc.ENVELOPES.values()):
        try:
            results.append(await _recharge(c, env))
        except BitnobError as e:
            results.append({"card_id": env.card_id, "error": e.payload})
    return results


@router.get("/{card_id}")
async def get_envelope(card_id: str, c: BitnobClient = Depends(get_client)):
    env = _get_env(card_id)
    return svc.public_view(await cards_api.get_card(c, card_id), env)


@router.get("/{card_id}/transactions")
async def envelope_transactions(card_id: str, c: BitnobClient = Depends(get_client)):
    _get_env(card_id)
    return await cards_api.transactions(c, card_id)


async def _recharge(c: BitnobClient, env: svc.Envelope) -> dict:
    card = await cards_api.get_card(c, env.card_id)
    missing = Decimal(str(env.monthly_budget_usd)) - Decimal(str(svc.balance_usd(card)))
    if missing <= 0:
        return {"card_id": env.card_id, "funded_usd": 0, "detail": "déjà au niveau du budget"}
    await cards_api.fund(c, env.card_id, usd_to_micro(missing))
    # Asynchrone côté Bitnob : confirmation par le webhook virtualcard.topup.completed
    return {"card_id": env.card_id, "funded_usd": float(missing), "detail": "recharge demandée"}


@router.post("/{card_id}/recharge")
async def recharge(card_id: str, c: BitnobClient = Depends(get_client)):
    return await _recharge(c, _get_env(card_id))


@router.post("/{card_id}/freeze")
async def freeze(card_id: str, c: BitnobClient = Depends(get_client)):
    _get_env(card_id)
    return await cards_api.set_status(c, card_id, "frozen")


@router.post("/{card_id}/unfreeze")
async def unfreeze(card_id: str, c: BitnobClient = Depends(get_client)):
    env = _get_env(card_id)
    env.frozen_by_app = False
    return await cards_api.set_status(c, card_id, "active")


@alerts_router.get("/alerts", tags=["envelopes"])
async def alerts():
    return list(reversed(svc.ALERTS))
