from typing import Optional
from pydantic import BaseModel, Field


class CreateInvoiceRequest(BaseModel):
    satoshis: int = Field(..., ge=1, le=100_000_000, description="Montant de la facture en satoshis")
    description: str = Field(..., min_length=1, max_length=500, description="Motif du paiement")
    customerName: Optional[str] = Field(default="Client Comptoir", description="Nom du client")


class InvoiceResponse(BaseModel):
    id: str
    reference: str
    paymentRequest: str
    amountSat: int
    amountXof: int
    status: str
    expiresAt: Optional[str] = None
    qrCodeUrl: str
    sandbox: bool = False  # True = pas de connexion Bitnob reelle ; afficher un avertissement


class InvoiceStatusResponse(BaseModel):
    id: str
    status: str
    paid: bool
    amountSat: int
    demo: bool = False
