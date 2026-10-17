"""main.py : API FastAPI (factures Lightning, statut, webhook Bitnob, demo, reglement)."""
import base64
import hashlib
import hmac
import io
import json
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import qrcode
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from bitnob import BitnobError, bitnob
from config import config
from constants import PAID_EVENTS, PAID_STATUSES, InvoiceStatus
from settlement import convert_sats_to_usdt, payout_to_mobile_money

app = FastAPI(title="Hackathon Bitnob")

invoices: dict = {}      # id Bitnob -> { id, reference, amountSat, status, paid, ... }
by_reference: dict = {}  # reference -> id
seen_events: set = set()  # event_id deja traites


# --- Erreurs : toujours { "error": ... } (contrat de l'equipe) ---
@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse({"error": "donnees invalides"}, status_code=400)


def qr_data_url(text: str) -> str:
    img = qrcode.make(text, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# --- Signature du webhook : plusieurs formats testes, le log indique celui qui correspond. Gardez-en un seul ensuite. ---
def check_signature(request: Request, raw: bytes) -> bool:
    signature = request.headers.get("x-bitnob-signature")
    if not signature:
        print("Signature absente")
        return False
    secret = config.bitnob_webhook_secret
    provided = signature.strip()
    if provided.lower().startswith("sha256="):
        provided = provided[7:]
    event_id = request.headers.get("x-bitnob-event-id", "")
    keys = [("texte", secret.encode("utf-8"))]
    try:
        keys.append(("hex", bytes.fromhex(secret)))
    except ValueError:
        pass
    msgs = [("corps", raw), ("eventId.corps", event_id.encode("utf-8") + b"." + raw)]
    for kn, key in keys:
        for mn, msg in msgs:
            mac = hmac.new(key, msg, hashlib.sha256).digest()
            for en, val in (("hex", mac.hex()), ("base64", base64.b64encode(mac).decode())):
                got = provided.lower() if en == "hex" else provided
                if hmac.compare_digest(val.encode(), got.encode()):
                    print(f"Signature OK (cle {kn} / {mn} / {en})")
                    return True
    print("Signature invalide (longueur recue " + str(len(provided)) + ")")
    return False


# --- WEBHOOK : corps brut (request.body()), quel que soit le content-type ---
# Bitnob envoie parfois "application/json, application/json" : on ne laisse JAMAIS FastAPI parser ce corps.
@app.post("/webhooks/bitnob")
async def bitnob_webhook(request: Request):
    raw = await request.body()
    if config.bitnob_webhook_secret and not check_signature(request, raw):
        return Response("invalid signature", status_code=401)
    try:
        evt = json.loads(raw)
    except ValueError:
        return Response("invalid json", status_code=400)

    event_id = evt.get("event_id") or request.headers.get("x-bitnob-event-id")
    if event_id and event_id in seen_events:
        return Response(status_code=200)  # doublon
    if event_id:
        seen_events.add(event_id)

    data = evt.get("data") or {}
    print("Webhook :", evt.get("event"), json.dumps(data)[:500])
    if evt.get("event") in PAID_EVENTS:
        inv_id = by_reference.get(data.get("reference")) or data.get("invoice_id") or data.get("id")
        inv = invoices.get(inv_id)
        if inv:
            inv["status"] = InvoiceStatus.PAID
            inv["paid"] = True
    return Response(status_code=200)  # toujours repondre vite en 2xx


@app.get("/health")
async def health():
    return {"status": "success", "demo": config.demo_mode}


class CreateInvoice(BaseModel):
    satoshis: int = Field(ge=1, le=100_000_000)
    description: str = Field(min_length=1, max_length=500)


@app.post("/api/pay/create-invoice", status_code=201)
async def create_invoice(body: CreateInvoice):
    description = body.description.strip()
    if not description:
        raise HTTPException(status_code=400, detail="description invalide")
    reference = f"inv_{int(time.time() * 1000)}_{secrets.token_hex(3)}"
    try:
        r = await bitnob("POST", "/api/lightning/invoices", {
            "customer_id": config.bitnob_customer_id, "amount": body.satoshis,
            "description": description, "expiry": 3600, "reference": reference,
        })
    except (BitnobError, httpx.HTTPError) as e:
        print("create-invoice :", e)
        raise HTTPException(status_code=502, detail=str(e) or e.__class__.__name__)
    d = r.get("data") or {}
    if not r.get("success") or not d.get("id") or not d.get("request"):
        raise HTTPException(status_code=502, detail="reponse Bitnob invalide")

    amount_sat = int(d.get("amount_sat") or body.satoshis)
    invoices[d["id"]] = {"id": d["id"], "reference": reference, "amountSat": amount_sat,
                         "status": d.get("status"), "paid": False}
    by_reference[reference] = d["id"]
    return {
        "id": d["id"], "reference": reference, "paymentRequest": d["request"], "amountSat": amount_sat,
        "status": d.get("status"), "expiresAt": d.get("expires_at"), "qrCodeUrl": qr_data_url(d["request"]),
    }


@app.get("/api/pay/status/{invoice_id}")
async def pay_status(invoice_id: str):
    inv = invoices.get(invoice_id)
    if inv and inv["paid"]:
        return {"id": inv["id"], "status": InvoiceStatus.PAID, "paid": True,
                "amountSat": inv["amountSat"], "demo": bool(inv.get("demo"))}
    try:
        r = await bitnob("GET", f"/api/lightning/invoices/{invoice_id}")
    except BitnobError as e:
        raise HTTPException(status_code=404 if e.status == 404 else 502, detail=str(e))
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e) or e.__class__.__name__)
    d = r.get("data") or {}
    status = str(d.get("status") or "unknown").lower()
    paid = status in PAID_STATUSES  # valeur reelle a confirmer
    if inv and paid:
        inv["paid"] = True
        inv["status"] = InvoiceStatus.PAID
    amount = d.get("amount_sat")
    return {"id": invoice_id, "status": status, "paid": paid,
            "amountSat": int(amount) if amount is not None else (inv or {}).get("amountSat", 0)}


# Paiement SIMULE (demo uniquement) : a annoncer comme tel au jury
@app.post("/api/pay/demo-pay/{invoice_id}")
async def demo_pay(invoice_id: str):
    if not config.demo_mode:
        raise HTTPException(status_code=403, detail="mode demo desactive")
    inv = invoices.get(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="facture inconnue")
    inv.update({"status": InvoiceStatus.PAID, "paid": True, "demo": True})
    return {"id": inv["id"], "status": InvoiceStatus.PAID, "paid": True, "demo": True, "amountSat": inv["amountSat"]}


class Settle(BaseModel):
    xofAmount: int = Field(ge=1)
    beneficiary: dict


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Reglement : BTC recu -> USDT -> payout mobile money (voir settlement.py, squelette a adapter)
@app.post("/api/settle/{invoice_id}")
async def settle(invoice_id: str, body: Settle):
    inv = invoices.get(invoice_id)
    if not inv or not inv["paid"]:
        raise HTTPException(status_code=409, detail="facture non payee")
    if inv.get("settled") or inv.get("settling"):
        return {"already": True, "timeline": inv.get("timeline", [])}
    inv["settling"] = True
    inv["timeline"] = []

    async def step(name, fn):
        try:
            res = await fn()
            inv["timeline"].append({"name": name, "ok": True, "at": _now()})
            return res
        except Exception as e:
            inv["timeline"].append({"name": name, "ok": False, "error": str(e), "at": _now()})
            raise

    try:
        await step("conversion BTC vers USDT", lambda: convert_sats_to_usdt(inv["amountSat"], inv["reference"]))
        await step("payout mobile money", lambda: payout_to_mobile_money(
            body.xofAmount, body.beneficiary, "vendor_payment", inv["reference"]))
        inv["settled"] = True
        return {"ok": True, "timeline": inv["timeline"]}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e), "timeline": inv["timeline"]}, status_code=502)
    finally:
        inv["settling"] = False


# Interface web : montee EN DERNIER, sinon elle masquerait les routes de l'API
app.mount("/", StaticFiles(directory=str(Path(__file__).parent / "static"), html=True), name="static")
