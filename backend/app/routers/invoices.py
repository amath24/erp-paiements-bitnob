from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.config import config
from backend.app.schemas.invoice import CreateInvoiceRequest, InvoiceResponse, InvoiceStatusResponse
from backend.app.services.invoice_service import (
    create_lightning_invoice,
    get_invoice_status,
    mark_demo_paid,
)
from db.database import get_db

router = APIRouter(prefix="/api/pay", tags=["Factures Lightning"])


@router.post("/create-invoice", response_model=InvoiceResponse, status_code=201)
async def create_invoice_endpoint(body: CreateInvoiceRequest, db: Session = Depends(get_db)):
    """Cree une facture Lightning, genere le QR code et enregistre en base."""
    description = body.description.strip()
    if not description:
        raise HTTPException(status_code=400, detail="description invalide")

    customer_name = body.customerName.strip() if body.customerName else "Client Comptoir"
    try:
        inv = await create_lightning_invoice(
            satoshis=body.satoshis,
            description=description,
            customer_name=customer_name,
            db=db,
        )
        return inv
    except Exception as e:
        print("[create-invoice error]", e)
        raise HTTPException(status_code=502, detail=str(e) or e.__class__.__name__)


@router.get("/status/{invoice_id}", response_model=InvoiceStatusResponse)
async def pay_status_endpoint(invoice_id: str, db: Session = Depends(get_db)):
    """Interroge le statut d'une facture (polling frontend)."""
    res = await get_invoice_status(invoice_id, db)
    return res


@router.post("/demo-pay/{invoice_id}", response_model=InvoiceStatusResponse)
async def demo_pay_endpoint(invoice_id: str, db: Session = Depends(get_db)):
    """Simule le paiement immediat pour la demonstration."""
    if not config.demo_mode:
        raise HTTPException(status_code=403, detail="mode demo desactive")

    res = mark_demo_paid(invoice_id, db)
    if not res:
        raise HTTPException(status_code=404, detail="facture inconnue")
    return res
