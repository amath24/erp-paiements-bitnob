"""Cartes virtuelles Bitnob (API v2) : KYC, création, recharge, gel, transactions."""
import uuid

from app.bitnob.client import BitnobClient


def card_of(resp: dict) -> dict:
    """Extrait l'objet carte, que la réponse soit data.card ou data."""
    data = resp.get("data", resp)
    if isinstance(data, dict) and isinstance(data.get("card"), dict):
        return data["card"]
    return data if isinstance(data, dict) else {}


async def card_kyc(c: BitnobClient, body: dict) -> dict:
    return await c.post("/api/cards/kyc", body)


async def create_card(
    c: BitnobClient,
    *,
    customer_id: str,
    amount_micro: int,
    name: str | None = None,
    reference: str | None = None,
    webhook_url: str | None = None,
    brand: str | None = None,
    monthly_limit_micro: int | None = None,
) -> dict:
    body: dict = {
        "customer_id": customer_id,
        "amount": amount_micro,
        "card_type": "virtual",
        "currency": "USD",
        "reference": reference or f"CARD-{uuid.uuid4().hex[:16]}",
    }
    if name:
        body["name"] = name
    if webhook_url:
        body["webhook_url"] = webhook_url
    if brand:
        body["card_brand"] = brand
    if monthly_limit_micro:
        body["card_limits"] = {"monthly_limit": monthly_limit_micro}
    return await c.post("/api/cards", body)


async def get_card(c: BitnobClient, card_id: str) -> dict:
    return card_of(await c.get(f"/api/cards/{card_id}"))


async def list_cards(c: BitnobClient, **params) -> dict:
    return await c.get("/api/cards", params={k: v for k, v in params.items() if v is not None})


async def fund(c: BitnobClient, card_id: str, amount_micro: int, reference: str | None = None) -> dict:
    body = {"amount": amount_micro, "type": "fund", "reference": reference or f"FUND-{uuid.uuid4().hex[:16]}"}
    return await c.post(f"/api/cards/{card_id}/balance", body)


async def withdraw(c: BitnobClient, card_id: str, amount_micro: int, reference: str | None = None) -> dict:
    body = {"amount": amount_micro, "type": "withdraw", "reference": reference or f"WDR-{uuid.uuid4().hex[:16]}"}
    return await c.post(f"/api/cards/{card_id}/balance", body)


async def set_status(c: BitnobClient, card_id: str, status: str) -> dict:
    """status : 'frozen' ou 'active'."""
    return await c.post(f"/api/cards/{card_id}/status", {"status": status})


async def terminate(c: BitnobClient, card_id: str, reason: str) -> dict:
    # Impossible dans les 24 h suivant la création (geler à la place).
    return await c.request("DELETE", f"/api/cards/{card_id}", json_body={"reason": reason})


async def transactions(c: BitnobClient, card_id: str, **params) -> dict:
    return await c.get(f"/api/cards/{card_id}/transactions",
                       params={k: v for k, v in params.items() if v is not None})


async def simulate_webhook(c: BitnobClient, card_id: str, event_type: str,
                           amount_usd: float | None = None) -> dict:
    """Sandbox uniquement. event_type : authorization | settlement | reversal | decline.
    `amount_usd` n'existe que dans le mode simulé (BITNOB_MOCK) : le vrai sandbox l'ignorerait ou le refuserait."""
    body = {"card_id": card_id, "event_type": event_type}
    if amount_usd is not None:
        body["amount"] = amount_usd
    return await c.post(f"/api/cards/{card_id}/simulate-webhook", body)
