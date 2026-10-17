"""backend/app/main.py : Point d'entree FastAPI de l'ERP de Paiements Bitnob & IA."""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from ai.router import router as ai_router
from backend.app.config import config
from backend.app.routers.erp import router as erp_router
from backend.app.routers.invoices import router as invoices_router
from backend.app.routers.settlement import router as settlement_router
from backend.app.routers.webhooks import router as webhooks_router
from db.database import engine
from db.seed import init_db, seed_demo_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise la base de donnees et les vues SQL au demarrage si necessaire."""
    try:
        init_db()
        seed_demo_data()
    except Exception as e:
        print(f"[Alerte demarrage DB] {e}")
    yield


app = FastAPI(
    title="ERP de Paiements Bitnob & IA",
    description="Backend FastAPI pour factures Lightning, conversion USDT, reglements Mobile Money et Assistant IA",
    version="2.0.0",
    lifespan=lifespan,
)

# --- Middleware CORS pour autoriser l'interface web ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Gestionnaires d'erreurs : format unifie { "error": ... } (CONTRACT.md) ---
@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    msg = exc.detail if isinstance(exc.detail, str) else exc.detail.get("error", str(exc.detail))
    return JSONResponse({"error": msg}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse({"error": "donnees invalides"}, status_code=400)


# --- Endpoint de sante ---
@app.get("/health", tags=["Systeme"])
async def health_check():
    db_ok = True
    try:
        with engine.connect() as conn:
            pass
    except Exception:
        db_ok = False

    return {
        "status": "success",
        "demo": config.demo_mode,
        "db": "connected" if db_ok else "disconnected",
    }


# --- Montage des routeurs d'API ---
app.include_router(invoices_router)
app.include_router(webhooks_router)
app.include_router(settlement_router)
app.include_router(erp_router)
app.include_router(ai_router)

# --- Montage des fichiers statiques frontend EN DERNIER ---
# Verifie d'abord si un build frontend moderne existe dans frontend/dist, sinon utilise static/
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
static_dir = Path(__file__).resolve().parent.parent.parent / "static"

if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend_dist")
elif static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
