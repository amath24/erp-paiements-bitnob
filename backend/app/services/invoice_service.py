import base64
import datetime
import io
import secrets
import time
from typing import Optional

import httpx
import qrcode
from sqlalchemy.orm import Session

from backend.app.bitnob.client import BitnobError, bitnob
from backend.app.config import config
from backend.app.constants import InvoiceStatus, PAID_STATUSES, SAT_TO_XOF_RATE
from db.models import Customer, Invoice


def generate_qr_data_url(bolt11: str) -> str:
    """Genere une image QR Code au format data URI base64 pour affichage frontend."""
    img = qrcode.make(bolt11, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


async def create_lightning_invoice(
    satoshis: int,
    description: str,
    customer_name: str,
    db: Session,
) -> dict:
    """Cree une facture Lightning, enregistre dans la base de donnees et renvoie le QR code."""
    reference = f"inv_{int(time.time() * 1000)}_{secrets.token_hex(3)}"
    now = datetime.datetime.utcnow()
    # Taux centralise dans constants.SAT_TO_XOF_RATE (1 sat ~ 0.4 FCFA)
    amount_xof = int(satoshis * SAT_TO_XOF_RATE)

    # Recherche ou creation du client
    cust = db.query(Customer).filter(Customer.name == customer_name).first()
    if not cust and customer_name != "Client Comptoir":
        cust = Customer(name=customer_name)
        db.add(cust)
        db.commit()
        db.refresh(cust)

    # Appel Bitnob
    bitnob_id = None
    payment_request = None
    expires_at = None
    status = InvoiceStatus.PENDING

    try:
        r = await bitnob("POST", "/api/lightning/invoices", {
            "customer_id": config.bitnob_customer_id,
            "amount": satoshis,
            "description": description,
            "expiry": 3600,
            "reference": reference,
        })
        d = r.get("data") or {}
        if r.get("success") and d.get("id") and d.get("request"):
            bitnob_id = d["id"]
            payment_request = d["request"]
            expires_at = d.get("expires_at")
            status = d.get("status") or InvoiceStatus.PENDING
    except Exception as e:
        print(f"[Bitnob warning] Appel API externe non abouti ({e}), repli sur mode sandbox local.")

    # Si sandbox sans cles ou testnet indisponible : generation BOLT11 factice
    # IMPORTANT : is_sandbox = True signale explicitement que ce n'est pas une facture reelle
    is_sandbox = False
    if not bitnob_id:
        is_sandbox = True
        bitnob_id = f"inv_ln_{secrets.token_hex(8)}"
        payment_request = f"lntb{satoshis}u1p{secrets.token_hex(20)}"
        expires_at = (now + datetime.timedelta(hours=1)).isoformat() + "Z"
        print("[invoice] ATTENTION : facture sandbox locale (pas de connexion Bitnob reelle).")

    qr_url = generate_qr_data_url(payment_request)

    # Enregistrement dans la base de donnees (P2)
    db_invoice = Invoice(
        id=bitnob_id,
        reference=reference,
        customer_id=cust.id if cust else None,
        customer_name=customer_name,
        amount_sat=satoshis,
        amount_xof=amount_xof,
        description=description,
        status=status,
        paid=False,
        payment_request=payment_request,
        qr_code_url=qr_url,
        demo=is_sandbox,    # True si facture locale sans connexion Bitnob reelle
        created_at=now,
    )
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)

    return {
        "id": db_invoice.id,
        "reference": db_invoice.reference,
        "paymentRequest": db_invoice.payment_request,
        "amountSat": db_invoice.amount_sat,
        "amountXof": db_invoice.amount_xof,
        "status": db_invoice.status,
        "expiresAt": expires_at,
        "qrCodeUrl": qr_url,
        "sandbox": is_sandbox,  # True = pas de connexion Bitnob reelle ; le front doit afficher un avertissement
    }


async def get_invoice_status(invoice_id: str, db: Session) -> dict:
    """Interroge le statut de la facture, synchronise avec Bitnob si besoin et met a jour la BD."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        # Recherche par reference
        inv = db.query(Invoice).filter(Invoice.reference == invoice_id).first()
    if not inv:
        return {"id": invoice_id, "status": "unknown", "paid": False, "amountSat": 0, "demo": False}

    if inv.paid:
        return {
            "id": inv.id,
            "status": InvoiceStatus.PAID,
            "paid": True,
            "amountSat": inv.amount_sat,
            "demo": inv.demo,
        }

    # Interrogation Bitnob si facture reelle
    if not inv.id.startswith("inv_ln_"):
        try:
            r = await bitnob("GET", f"/api/lightning/invoices/{inv.id}")
            d = r.get("data") or {}
            bitnob_status = str(d.get("status") or "").lower()
            if bitnob_status in PAID_STATUSES:
                inv.paid = True
                inv.status = InvoiceStatus.PAID
                inv.paid_at = datetime.datetime.utcnow()
                db.commit()
        except Exception:
            pass

    return {
        "id": inv.id,
        "status": inv.status,
        "paid": inv.paid,
        "amountSat": inv.amount_sat,
        "demo": inv.demo,
    }


def mark_demo_paid(invoice_id: str, db: Session) -> Optional[dict]:
    """Bascule la facture a 'paid' pour le mode demonstration."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        inv = db.query(Invoice).filter(Invoice.reference == invoice_id).first()
    if not inv:
        return None

    inv.status = InvoiceStatus.PAID
    inv.paid = True
    inv.demo = True
    inv.paid_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(inv)

    return {
        "id": inv.id,
        "status": inv.status,
        "paid": inv.paid,
        "demo": True,
        "amountSat": inv.amount_sat,
    }
