"""Accès brut aux cartes Bitnob (KYC, liste, détail, simulation sandbox)."""
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.bitnob import cards as svc
from app.bitnob.client import BitnobClient
from app.deps import get_client, require_api_key
from app.schemas import CardKycIn
from app.services import envelopes as env_svc

router = APIRouter(prefix="/cards", tags=["cards"], dependencies=[Depends(require_api_key)])


@router.post("/kyc")
async def card_kyc(body: CardKycIn, c: BitnobClient = Depends(get_client)):
    """Étape 0 : vérifier le titulaire. Le KYC est asynchrone : attends le webhook
    `virtualcard.user.kyc.complete` (ou regarde GET /cards/kyc/customers)."""
    payload = body.model_dump(exclude_none=True)
    # Bitnob valide id_number (et id_type) dans l'objet customer
    payload["customer"].setdefault("id_type", body.id_type)
    payload["customer"].setdefault("id_number", body.id_number)
    # Par défaut, notifier notre webhook du résultat du KYC (évite de poller)
    from app.config import get_settings
    payload.setdefault("webhook_url", get_settings().webhook_url)
    if payload["webhook_url"] is None:
        payload.pop("webhook_url")
    resp = await svc.card_kyc(c, payload)
    data = resp.get("data", {})
    if data.get("customer_id"):
        env_svc.KYC_CUSTOMERS[data["customer_id"]] = {
            "status": data.get("status"), "email": data.get("email")}
    return resp


@router.get("/kyc/customers")
async def kyc_customers():
    """Clients vus (réponse KYC ou webhook) avec leur statut."""
    return env_svc.KYC_CUSTOMERS


@router.get("")
async def list_cards(status: str | None = None, search: str | None = None,
                     cursor: str | None = None, limit: int = 20,
                     c: BitnobClient = Depends(get_client)):
    return await svc.list_cards(c, card_type="virtual", status=status,
                                search=search, cursor=cursor, limit=limit)


@router.get("/{card_id}")
async def get_card(card_id: str, c: BitnobClient = Depends(get_client)):
    return await svc.get_card(c, card_id)


@router.post("/{card_id}/simulate/{event_type}")
async def simulate(card_id: str, event_type: Literal["authorization", "settlement", "reversal", "decline"],
                   amount_usd: float | None = Query(None, description="MODE SIMULÉ uniquement"),
                   c: BitnobClient = Depends(get_client)):
    """SANDBOX : déclenche un faux webhook sur la carte (nécessite un webhook_url
    posé à la création, donc PUBLIC_BASE_URL renseigné)."""
    return await svc.simulate_webhook(c, card_id, event_type, amount_usd)
