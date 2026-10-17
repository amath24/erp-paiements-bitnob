from typing import Any, Optional
from pydantic import BaseModel, Field


class SettleRequest(BaseModel):
    xofAmount: int = Field(..., ge=1, description="Montant a transferer en Franc CFA")
    beneficiary: Any = Field(..., description="Details du beneficiaire Mobile Money (+221...)")


class SettleTimelineStep(BaseModel):
    name: str
    ok: bool
    at: str
    error: Optional[str] = None


class SettleResponse(BaseModel):
    ok: bool
    already: Optional[bool] = False
    timeline: list[dict]
