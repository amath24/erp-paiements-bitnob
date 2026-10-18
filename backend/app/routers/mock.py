"""Outils du MODE SIMULÉ (BITNOB_MOCK=true) : créditer un wallet, remettre à zéro."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.bitnob.mock import MockBitnobClient
from app.deps import get_client, require_api_key
from app.repo import get_repo
from app.services import bulk
from app.services import envelopes as env_svc

router = APIRouter(prefix="/mock", tags=["mock"], dependencies=[Depends(require_api_key)])


def mock_client(c=Depends(get_client)) -> MockBitnobClient:
    if not isinstance(c, MockBitnobClient):
        raise HTTPException(404, "Disponible uniquement avec BITNOB_MOCK=true.")
    return c


class Credit(BaseModel):
    currency: str = Field(default="USDC", examples=["USDC"])
    amount: float = Field(gt=0, examples=[500])


@router.get("/state")
async def state(c: MockBitnobClient = Depends(mock_client)):
    return {
        "balances": {k: str(v) for k, v in c.balances.items()},
        "counts": {"quotes": len(c.quotes), "payouts": len(c.payouts), "cards": len(c.cards),
                   "invoices": len(c.invoices)},
        "demo_accounts": {"...0000": "finalize refusé (FAILED)", "...9999": "paiement expiré (EXPIRED)",
                          "...5000": "erreur 500 + webhook perdu (UNCERTAIN -> POST /batches/{id}/refresh)",
                          "autres": "succès"},
    }


@router.post("/credit")
async def credit(body: Credit, c: MockBitnobClient = Depends(mock_client)):
    """Crédite un wallet simulé (le « faucet » qui manque au vrai sandbox)."""
    try:
        c.credit(body.currency, body.amount)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"balances": {k: str(v) for k, v in c.balances.items()}}


@router.post("/reset")
async def reset(c: MockBitnobClient = Depends(mock_client)):
    """Remet tout à zéro avant une démo : wallets, cartes, factures, batchs, alertes."""
    c.reset()
    repo = get_repo()
    if hasattr(repo, "clear"):
        repo.clear()
    env_svc.ENVELOPES.clear(); env_svc.ALERTS.clear(); env_svc.KYC_CUSTOMERS.clear(); env_svc.SEEN_EVENTS.clear()
    bulk._RUNNING.clear(); bulk._COUNTRY_CACHE.update(ts=0.0, codes=None)
    return {"status": "reset"}
