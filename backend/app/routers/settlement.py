from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.schemas.settlement import SettleRequest, SettleResponse
from backend.app.services.settlement_service import execute_settlement
from db.database import get_db

router = APIRouter(prefix="/api/settle", tags=["Reglements & Payouts"])


@router.post("/{invoice_id}", response_model=SettleResponse)
async def settle_endpoint(invoice_id: str, body: SettleRequest, db: Session = Depends(get_db)):
    """Declenche la conversion BTC vers USDT et le payout Mobile Money (Wave / Orange SN)."""
    res = await execute_settlement(
        invoice_id=invoice_id,
        xof_amount=body.xofAmount,
        beneficiary=body.beneficiary,
        db=db,
    )
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error", "Echec du reglement"))

    return res
