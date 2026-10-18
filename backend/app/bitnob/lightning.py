"""Factures Lightning (réception de Bitcoin). Montants en satoshis."""
import uuid

from app.bitnob.client import BitnobClient


def invoice_of(resp: dict) -> dict:
    data = resp.get("data")
    return data if isinstance(data, dict) else resp


async def create_invoice(
    c: BitnobClient,
    *,
    amount_sat: int,
    description: str,
    reference: str | None = None,
    expiry_seconds: int | None = None,
    customer_id: str | None = None,
) -> dict:
    body: dict = {
        "amount": amount_sat,
        "description": description,
        "reference": reference or f"INV-{uuid.uuid4().hex[:16]}",
    }
    if expiry_seconds:
        body["expiry"] = expiry_seconds
    if customer_id:
        body["customer_id"] = customer_id
    return invoice_of(await c.post("/api/lightning/invoices", body))


async def get_invoice(c: BitnobClient, invoice_id: str) -> dict:
    """status : pending | paid | expired | failed (preimage présent quand paid)."""
    return invoice_of(await c.get(f"/api/lightning/invoices/{invoice_id}"))


async def list_invoices(c: BitnobClient, **params) -> dict:
    return await c.get("/api/lightning/invoices",
                       params={k: v for k, v in params.items() if v is not None})
