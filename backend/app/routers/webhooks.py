import base64
import datetime
import hashlib
import hmac
import json
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from backend.app.config import config
from backend.app.constants import InvoiceStatus, PAID_EVENTS
from db.database import get_db
from db.models import Invoice, WebhookEvent

router = APIRouter(tags=["Webhooks Bitnob"])


def check_signature(request: Request, raw: bytes) -> bool:
    """Verifie la signature HMAC-SHA256 entrante du webhook Bitnob."""
    signature = request.headers.get("x-bitnob-signature")
    if not signature:
        print("[webhook] Signature absente")
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
                    print(f"[webhook] Signature OK (cle {kn} / {mn} / {en})")
                    return True
    print(f"[webhook] Signature invalide (longueur {len(provided)})")
    return False


@router.post("/webhooks/bitnob")
async def bitnob_webhook_endpoint(request: Request, db: Session = Depends(get_db)):
    """
    Reception du webhook Bitnob en corps brut (await request.body()).
    Ne jamais mettre de modele Pydantic sur cette route pour supporter
    les Content-Types specifiques de Bitnob.
    """
    raw = await request.body()
    if config.bitnob_webhook_secret and not check_signature(request, raw):
        return Response("invalid signature", status_code=401)

    try:
        evt = json.loads(raw)
    except ValueError:
        return Response("invalid json", status_code=400)

    event_id = evt.get("event_id") or request.headers.get("x-bitnob-event-id")
    event_name = evt.get("event", "unknown")

    # Dedoublonnage anti-replay via la table webhook_events
    if event_id:
        existing = db.query(WebhookEvent).filter(WebhookEvent.event_id == event_id).first()
        if existing:
            return Response(status_code=200)  # Doublon deja traite
        db_evt = WebhookEvent(
            event_id=event_id,
            event_type=event_name,
            raw_payload=raw.decode("utf-8", errors="ignore"),
            created_at=datetime.datetime.utcnow(),
        )
        db.add(db_evt)
        db.commit()

    data = evt.get("data") or {}
    print(f"[webhook recu] {event_name} :", json.dumps(data)[:300])

    # Si paiement confirme
    if event_name in PAID_EVENTS:
        ref = data.get("reference")
        inv_id = data.get("invoice_id") or data.get("id")
        inv = None
        if ref:
            inv = db.query(Invoice).filter(Invoice.reference == ref).first()
        if not inv and inv_id:
            inv = db.query(Invoice).filter(Invoice.id == inv_id).first()

        if inv:
            inv.status = InvoiceStatus.PAID
            inv.paid = True
            inv.paid_at = datetime.datetime.utcnow()
            db.commit()
            print(f"[webhook] Facture {inv.reference} validee en base comme PAID.")

    return Response(status_code=200)
