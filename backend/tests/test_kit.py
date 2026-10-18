"""Tests hors-ligne : l'API Bitnob est simulée (httpx.MockTransport).
Vérifie aussi que la signature HMAC envoyée à Bitnob est bien celle attendue."""
import hashlib
import hmac
import json
import os

import httpx
import pytest

CID, SECRET = "client_123", "secret_456"
os.environ.update(BITNOB_CLIENT_ID=CID, BITNOB_CLIENT_SECRET=SECRET, APP_API_KEY="k",
                  DEFAULT_CARD_CUSTOMER_ID="cust-1", ALERT_THRESHOLD_USD="10",
                  PUBLIC_BASE_URL="https://example.ngrok.app")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import envelopes as env_svc  # noqa: E402

AUTH = {"X-API-Key": "k"}


class FakeBitnob:
    def __init__(self):
        self.calls = []
        self.balance_usd = 30.0
        self.status = "active"

    def card(self):
        return {"id": "card-1", "status": self.status, "created_status": "completed",
                "masked_pan": "**** **** **** 4532", "display_amount": self.balance_usd,
                "balance_amount": str(int(self.balance_usd * 1_000_000))}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        body = request.content.decode()
        h = request.headers
        expected = hmac.new(SECRET.encode(),
                            f"{CID}:{h['x-auth-timestamp']}:{h['x-auth-nonce']}:{body}".encode(),
                            hashlib.sha256).hexdigest()
        assert h["x-auth-signature"] == expected, "signature HMAC invalide"
        assert h["x-auth-client"] == CID
        parsed = json.loads(body) if body else None
        path, method = request.url.path, request.method
        self.calls.append((method, path, parsed))

        if (method, path) == ("POST", "/api/cards"):
            return httpx.Response(201, json={"success": True, "data": {"card": {
                **self.card(), "status": "pending", "created_status": "processing", "masked_pan": ""}}})
        if (method, path) == ("POST", "/api/cards/kyc"):
            return httpx.Response(200, json={"success": True, "data": {
                "customer_id": "cust-7", "status": "pending", "email": parsed["customer"]["email"]}})
        if (method, path) == ("GET", "/api/cards/card-1"):
            return httpx.Response(200, json={"success": True, "data": {"card": self.card()}})
        if (method, path) == ("POST", "/api/cards/card-1/status"):
            self.status = parsed["status"]
            return httpx.Response(200, json={"success": True, "data": {"card": {"status": self.status}}})
        if (method, path) == ("POST", "/api/lightning/invoices"):
            return httpx.Response(201, json={"id": "inv-1", "request": "lnbc100n1pexample",
                                             "status": "pending", "amount_sat": str(parsed["amount"])})
        return httpx.Response(404, json={"success": False, "message": f"no mock for {method} {path}"})


@pytest.fixture
def ctx():
    env_svc.ENVELOPES.clear(); env_svc.ALERTS.clear(); env_svc.SEEN_EVENTS.clear()
    fake = FakeBitnob()
    with TestClient(app) as tc:
        app.state.bitnob._http = httpx.AsyncClient(
            base_url="https://api.bitnob.com", transport=httpx.MockTransport(fake))
        yield tc, fake


def webhook(tc, payload, sig=None):
    raw = json.dumps(payload).encode()
    sig = sig or hmac.new(SECRET.encode(), raw, hashlib.sha512).hexdigest()
    return tc.post("/webhooks/bitnob", content=raw, headers={"x-bitnob-signature": sig})


def make_envelope(tc):
    return tc.post("/envelopes", json={"name": "Meta Ads", "monthly_budget_usd": "30"}, headers=AUTH)


def test_create_envelope_uses_micro_units_and_hides_pan(ctx):
    tc, fake = ctx
    r = make_envelope(tc)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "Meta Ads" and body["card_id"] == "card-1"
    assert "masked_pan" not in body and "pan" not in json.dumps(body).lower()
    _, _, sent = fake.calls[0]
    assert sent["amount"] == 30_000_000 and sent["currency"] == "USD" and sent["card_type"] == "virtual"
    assert sent["card_limits"] == {"monthly_limit": 30_000_000}
    assert sent["webhook_url"] == "https://example.ngrok.app/webhooks/bitnob"


def test_low_balance_alert_then_freeze_then_unfreeze(ctx):
    tc, fake = ctx
    make_envelope(tc)
    tx = {"event": "virtualcard.transaction.settlement", "eventId": "e1",
          "data": {"cardId": "card-1", "merchantName": "facebook_ads", "displayAmount": 21.5}}

    fake.balance_usd = 8.5
    assert webhook(tc, tx).status_code == 200
    alerts = tc.get("/alerts", headers=AUTH).json()
    assert alerts[0]["level"] == "warning" and "8.50 USD" in alerts[0]["message"]

    fake.balance_usd = 0.0
    webhook(tc, {**tx, "eventId": "e2"})
    assert fake.status == "frozen"
    assert tc.get("/alerts", headers=AUTH).json()[0]["level"] == "critical"

    webhook(tc, {"event": "virtualcard.topup.completed", "eventId": "e3", "data": {"cardId": "card-1"}})
    assert fake.status == "active"


def test_recharge_funds_only_missing_amount(ctx):
    tc, fake = ctx
    make_envelope(tc)
    fake.balance_usd = 12.0
    fake.calls.clear()

    orig = fake.__call__

    def with_fund(request):
        if request.url.path == "/api/cards/card-1/balance":
            fake.calls.append(("POST", request.url.path, json.loads(request.content)))
            return httpx.Response(200, json={"success": True, "data": {"transaction": {"status": "pending"}}})
        return orig(request)
    app.state.bitnob._http = httpx.AsyncClient(base_url="https://api.bitnob.com",
                                               transport=httpx.MockTransport(with_fund))
    r = tc.post("/envelopes/card-1/recharge", headers=AUTH)
    assert r.json()["funded_usd"] == 18.0
    sent = [c for c in fake.calls if c[1].endswith("/balance")][0][2]
    assert sent["amount"] == 18_000_000 and sent["type"] == "fund" and sent["reference"]


def test_invoice_returns_qr(ctx):
    tc, fake = ctx
    r = tc.post("/invoices", json={"amount_sat": 10000, "description": "Facture #1"}, headers=AUTH)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["request"].startswith("lnbc") and body["qr_svg_data_uri"].startswith("data:image/svg+xml")
    assert body["qr_png_data_uri"].startswith("data:image/png;base64,")
    assert fake.calls[0][2]["amount"] == 10000


def test_webhook_signature_and_dedup(ctx):
    tc, _ = ctx
    p = {"event": "payouts.withdrawal.success", "eventId": "dup", "data": {"reference": "R1"}}
    assert webhook(tc, p, sig="bad").status_code == 401
    assert webhook(tc, p).json() == {"status": "ok"}
    assert webhook(tc, p).json() == {"status": "duplicate"}


def test_kyc_webhook_registers_customer(ctx):
    tc, _ = ctx
    webhook(tc, {"event": "virtualcard.user.kyc.complete", "eventId": "k1",
                 "data": {"customerId": "cust-9", "customerEmail": "a@b.co", "kycPassed": True}})
    assert tc.get("/cards/kyc/customers", headers=AUTH).json()["cust-9"]["status"] == "approved"


def test_kyc_nests_id_in_customer_and_registers(ctx):
    tc, fake = ctx
    body = {"customer": {"first_name": "Awa", "last_name": "Diop", "email": "awa@x.sn",
                         "date_of_birth": "1995-04-23", "line1": "Rue 10", "city": "Dakar",
                         "state": "Dakar", "postal_code": "10000", "country": "SN"},
            "id_type": "passport", "id_number": "A1234567", "id_front_image": "BASE64"}
    r = tc.post("/cards/kyc", json=body, headers=AUTH)
    assert r.status_code == 200, r.text
    sent = fake.calls[-1][2]
    assert sent["customer"]["id_number"] == "A1234567" and sent["customer"]["id_type"] == "passport"
    assert sent["customer"]["country"] == "SEN"  # SN converti en alpha-3
    assert sent["customer"]["customer_type"] == "individual" and sent["id_number"] == "A1234567"
    assert sent["webhook_url"] == "https://example.ngrok.app/webhooks/bitnob"
    assert env_svc.KYC_CUSTOMERS["cust-7"]["status"] == "pending"
