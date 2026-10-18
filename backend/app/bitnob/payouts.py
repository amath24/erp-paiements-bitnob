"""Flow payouts Bitnob : quote -> initialize -> finalize."""
import uuid

from app.bitnob.client import BitnobClient
from app.schemas import Beneficiary, QuoteIn


def _payout(resp: dict) -> dict:
    return resp.get("data", {}).get("payout", resp.get("data", resp))


async def supported_countries(c: BitnobClient) -> dict:
    return await c.get("/api/payouts/supported-countries")


async def country_details(c: BitnobClient, country: str) -> dict:
    return await c.get(f"/api/payouts/supported-countries/{country}")


async def banks(c: BitnobClient, country: str) -> dict:
    return await c.get(f"/api/payouts/banks/{country}")


async def create_quote(c: BitnobClient, q: QuoteIn) -> dict:
    body = q.model_dump(exclude_none=True)
    body["reference"] = q.reference or f"QT-{uuid.uuid4().hex[:12]}"
    return _payout(await c.post("/api/payouts/quotes", body))


async def initialize(
    c: BitnobClient,
    quote_id: str,
    beneficiary: Beneficiary,
    payment_reason: str,
    reference: str | None = None,
    callback_url: str | None = None,
) -> dict:
    body = {
        "quote_id": quote_id,
        "reference": reference or f"PO-{uuid.uuid4().hex[:12]}",
        "payment_reason": payment_reason,
        "beneficiary": beneficiary.model_dump(exclude_none=True),
    }
    if callback_url:
        body["callback_url"] = callback_url
    return _payout(await c.post(f"/api/payouts/{quote_id}/initialize", body))


async def finalize(c: BitnobClient, quote_id: str) -> dict:
    return _payout(await c.post(f"/api/payouts/{quote_id}/finalize"))


async def get_payout(c: BitnobClient, payout_id: str) -> dict:
    return _payout(await c.get(f"/api/payouts/{payout_id}"))
