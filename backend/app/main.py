import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.bitnob.client import BitnobClient, BitnobError
from app.config import get_settings
from app.routers import batches, bitnob_proxy, cards, dashboard, envelopes, invoices, mock, webhooks

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if s.bitnob_mock:
        from app.bitnob.mock import MockBitnobClient
        app.state.bitnob = MockBitnobClient(s)
        logging.getLogger("main").warning("MODE SIMULÉ : aucun appel à Bitnob.")
    else:
        if not s.bitnob_client_id or not s.bitnob_client_secret:
            raise RuntimeError("BITNOB_CLIENT_ID / BITNOB_CLIENT_SECRET manquants "
                               "(ou mettre BITNOB_MOCK=true pour le mode simulé).")
        app.state.bitnob = BitnobClient(s)
    yield
    await app.state.bitnob.aclose()


app = FastAPI(title="Bitnob Backend Kit", version="0.3.0", lifespan=lifespan)


@app.exception_handler(BitnobError)
async def bitnob_error_handler(_: Request, exc: BitnobError):
    status = 502 if exc.status_code >= 500 else exc.status_code
    return JSONResponse(status_code=status, content={"error": "bitnob_error", "details": exc.payload})


@app.get("/health", tags=["system"])
async def health(request: Request):
    """`mode` = "mock" : les réponses sont simulées (afficher un bandeau dans le frontend)."""
    return {"status": "ok", "mode": "mock" if getattr(request.app.state.bitnob, "mock", False) else "live"}


app.include_router(bitnob_proxy.router)   # whoami, balances, payouts
app.include_router(cards.router)          # KYC, cartes brutes, simulation sandbox
app.include_router(envelopes.router)      # enveloppes budgétaires
app.include_router(envelopes.alerts_router)
app.include_router(invoices.router)       # factures Bitcoin + QR
app.include_router(batches.router)        # paiements de masse
app.include_router(dashboard.router)      # KPIs
app.include_router(webhooks.router)
app.include_router(mock.router)           # /mock/* : 404 hors mode simulé
