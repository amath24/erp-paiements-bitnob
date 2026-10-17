from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Invoice, Settlement

router = APIRouter(prefix="/api/erp", tags=["ERP Donnees & Analytics"])


@router.get("/kpis")
async def get_erp_kpis(db: Session = Depends(get_db)):
    """Renvoie les indicateurs financiers agreges calcules par la vue SQL v_kpis."""
    res = db.execute(text("SELECT * FROM v_kpis LIMIT 1;")).fetchone()
    if res:
        # Transformation en dict
        cols = ["todayRevenueXof", "totalSatsCollected", "todayInvoicesCount", "paidInvoicesCount", "pendingInvoicesCount", "settledXofTotal"]
        return dict(zip(cols, res))
    return {
        "todayRevenueXof": 0,
        "totalSatsCollected": 0,
        "todayInvoicesCount": 0,
        "paidInvoicesCount": 0,
        "pendingInvoicesCount": 0,
        "settledXofTotal": 0,
    }


@router.get("/invoices")
async def get_erp_invoices(status: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    """Liste des factures enregistrees dans l'ERP."""
    query = db.query(Invoice).order_by(Invoice.created_at.desc())
    if status:
        query = query.filter(Invoice.status == status)
    invoices = query.limit(limit).all()

    return [
        {
            "id": inv.id,
            "reference": inv.reference,
            "customerName": inv.customer_name,
            "amountSat": inv.amount_sat,
            "amountXof": inv.amount_xof,
            "description": inv.description,
            "status": inv.status,
            "paid": inv.paid,
            "demo": inv.demo,
            "paymentRequest": inv.payment_request,
            "qrCodeUrl": inv.qr_code_url,
            "createdAt": inv.created_at.isoformat() if inv.created_at else None,
            "paidAt": inv.paid_at.isoformat() if inv.paid_at else None,
        }
        for inv in invoices
    ]


@router.get("/settlements")
async def get_erp_settlements(limit: int = 20, db: Session = Depends(get_db)):
    """Liste des reglements et payouts effectues."""
    settlements = db.query(Settlement).order_by(Settlement.created_at.desc()).limit(limit).all()
    return [
        {
            "id": s.id,
            "invoiceId": s.invoice_id,
            "reference": s.reference,
            "amountSats": s.amount_sats,
            "amountUsdt": s.amount_usdt,
            "amountXof": s.amount_xof,
            "beneficiary": s.beneficiary,
            "status": s.status,
            "createdAt": s.created_at.isoformat() if s.created_at else None,
        }
        for s in settlements
    ]
