"""Faux Bitnob (BITNOB_MOCK=true) : mêmes méthodes que BitnobClient, aucun appel réseau.

Répond avec les mêmes formes que l'API réelle pour : compte, payouts, cartes, factures
Lightning, et envoie lui-même les webhooks (payouts, cartes) au backend.

Comptes de démonstration (derniers chiffres du account_number) :
  ...0000 -> finalize refusé (FAILED)        ...9999 -> paiement expiré (EXPIRED)
  ...5000 -> finalize 500 + webhook perdu (UNCERTAIN, se résout avec /batches/{id}/refresh)
  tout autre numéro -> succès
"""
import asyncio
import logging
import random
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from app.bitnob.client import BitnobError
from app.bitnob.units import micro_to_usd
from app.config import Settings

log = logging.getLogger("mock")

RATES = {"GHS": "15.5", "NGN": "1550", "KES": "129", "XOF": "610", "XAF": "610", "UGX": "3700",
         "TZS": "2600", "ZAR": "18", "RWF": "1400", "USD": "1", "EUR": "0.92"}
PRICE = {"USDT": Decimal(1), "USDC": Decimal(1), "BTC": Decimal(100000)}
COUNTRIES = {"GH": "Ghana", "NG": "Nigeria", "KE": "Kenya", "SN": "Sénégal", "CI": "Côte d'Ivoire",
             "UG": "Uganda", "TZ": "Tanzania", "ZA": "South Africa", "RW": "Rwanda", "CM": "Cameroun"}
OPERATORS = [("MTN", "MTN Mobile Money"), ("VOD", "Vodafone Cash"), ("AIRTEL", "Airtel Money"),
             ("ORANGE", "Orange Money"), ("WAVE", "Wave")]
MERCHANTS = ["facebook_ads", "figma", "canva", "notion", "google_ads"]
CARD_CREATION_FEE = Decimal("2")
BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
Q = Decimal("0.01")


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _dec(v) -> Decimal:
    return Decimal(str(v))


def _plain_error(status: int, code: str, message: str) -> BitnobError:
    return BitnobError(status, {"success": False, "error": {"code": code, "message": message}})


class MockBitnobClient:
    mock = True

    def __init__(self, settings: Settings):
        self.s = settings
        self._tasks: set[asyncio.Task] = set()
        self.reset()

    # ------------------------------------------------------------------ état
    def reset(self) -> None:
        usd = _dec(self.s.mock_balance_usd)
        self.balances = {a: usd / PRICE[a] for a in PRICE}
        self.quotes: dict[str, dict] = {}
        self.payouts: dict[str, dict] = {}
        self.customers: dict[str, dict] = {}
        self.cards: dict[str, dict] = {}
        self.card_tx: dict[str, list] = {}
        self.invoices: dict[str, dict] = {}

    def credit(self, currency: str, amount) -> None:
        cur = currency.upper()
        if cur not in self.balances:
            raise ValueError("devise inconnue (USDT, USDC, BTC)")
        self.balances[cur] += _dec(amount)

    async def aclose(self) -> None:
        for t in list(self._tasks):
            t.cancel()

    def _spawn(self, coro) -> None:
        t = asyncio.create_task(coro)
        self._tasks.add(t)
        t.add_done_callback(self._tasks.discard)

    async def _emit(self, event: str, data: dict, delay: float = 0.0) -> None:
        """Envoie un faux webhook directement au backend (même chemin que le vrai)."""
        from app.routers.webhooks import dispatch, register_event  # import tardif : évite un cycle
        if delay:
            await asyncio.sleep(delay)
        payload = {"event": event, "eventId": str(uuid.uuid4()), "data": data}
        if register_event(payload) == "new":
            try:
                await dispatch(self, payload)
            except Exception:  # noqa: BLE001
                log.exception("webhook simulé %s a échoué", event)

    # ------------------------------------------------------------- routage
    async def get(self, path: str, params: dict | None = None) -> dict:
        return await self.request("GET", path, params=params)

    async def post(self, path: str, json_body: dict | None = None) -> dict:
        return await self.request("POST", path, json_body=json_body)

    async def request(self, method: str, path: str, json_body: dict | None = None,
                      params: dict | None = None) -> dict:
        body, params = json_body or {}, params or {}
        table = [
            ("GET", r"/api/whoami", self._whoami),
            ("GET", r"/api/balances", self._balances),
            ("GET", r"/api/payouts/supported-countries", self._countries),
            ("GET", r"/api/payouts/supported-countries/(\w+)", self._country),
            ("GET", r"/api/payouts/banks/(\w+)", self._banks),
            ("POST", r"/api/payouts/quotes", self._quote),
            ("POST", r"/api/payouts/([\w-]+)/initialize", self._initialize),
            ("POST", r"/api/payouts/([\w-]+)/finalize", self._finalize),
            ("GET", r"/api/payouts/([\w-]+)", self._get_payout),
            ("POST", r"/api/cards/kyc", self._kyc),
            ("POST", r"/api/cards", self._create_card),
            ("GET", r"/api/cards", self._list_cards),
            ("GET", r"/api/cards/([\w-]+)/transactions", self._card_transactions),
            ("GET", r"/api/cards/([\w-]+)", self._get_card),
            ("POST", r"/api/cards/([\w-]+)/balance", self._card_balance),
            ("POST", r"/api/cards/([\w-]+)/status", self._card_status),
            ("POST", r"/api/cards/([\w-]+)/simulate-webhook", self._card_simulate),
            ("DELETE", r"/api/cards/([\w-]+)", self._card_terminate),
            ("POST", r"/api/lightning/invoices", self._create_invoice),
            ("GET", r"/api/lightning/invoices", self._list_invoices),
            ("GET", r"/api/lightning/invoices/([\w-]+)", self._get_invoice),
        ]
        for m, pattern, handler in table:
            hit = re.fullmatch(pattern, path)
            if m == method and hit:
                return await handler(*hit.groups(), body=body, params=params)
        raise _plain_error(404, "NOT_FOUND", f"[mock] route non simulée : {method} {path}")

    # ---------------------------------------------------------------- compte
    async def _whoami(self, *, body, params):
        return {"success": True, "data": {"company_id": "mock-company", "name": "PayBridge (MODE SIMULÉ)",
                                          "environment": "mock"}}

    async def _balances(self, *, body, params):
        return {"success": True, "data": [
            {"currency": a, "available": str(v.quantize(Decimal("0.00000001"))),
             "usd_value": str((v * PRICE[a]).quantize(Q))} for a, v in self.balances.items()]}

    # --------------------------------------------------------------- payouts
    async def _countries(self, *, body, params):
        return {"success": True, "data": [{"country": c, "name": n} for c, n in COUNTRIES.items()]}

    async def _country(self, cc, *, body, params):
        if cc.upper() not in COUNTRIES:
            raise _plain_error(404, "NOT_FOUND", "Country not supported")
        return {"success": True, "data": {"country": cc.upper(), "name": COUNTRIES[cc.upper()],
                                          "rails": ["mobile_money", "bank"],
                                          "payment_reasons": ["vendor_payment", "salary", "commission"]}}

    async def _banks(self, cc, *, body, params):
        return {"success": True, "data": [{"code": c, "name": n, "type": "mobile_money"} for c, n in OPERATORS]}

    async def _quote(self, *, body, params):
        cc, cur = body.get("country", ""), body.get("to_currency", "")
        if cc not in COUNTRIES:
            raise _plain_error(400, "BAD_REQUEST", f"Country {cc} not supported")
        rate = _dec(RATES.get(cur, "1"))
        asset = body.get("from_asset", "USDT")
        try:
            if body.get("settlement_amount") is not None:
                local = _dec(body["settlement_amount"])
                usd = local / rate
            else:
                usd = _dec(body["amount"]) * PRICE[asset]
                local = usd * rate
        except Exception:
            raise _plain_error(400, "BAD_REQUEST", "amount or settlement_amount required")
        fee = max(Decimal("0.5"), (usd * Decimal("0.015")).quantize(Q, ROUND_HALF_UP))
        qid = "mockq_" + uuid.uuid4().hex[:12]
        self.quotes[qid] = {"usd": usd, "fee": fee, "asset": asset, "local": local, "currency": cur,
                            "country": cc, "expires": time.time() + 300, "payout_id": None}
        return {"success": True, "data": {"payout": {
            "quote_id": qid, "reference": body.get("reference"), "from_asset": asset,
            "amount": str((usd / PRICE[asset]).quantize(Decimal("0.00000001"))),
            "settlement_amount": str(local.quantize(Q)), "to_currency": cur, "country": cc,
            "exchange_rate": str(rate), "fee": str(fee), "total_debit_usd": str((usd + fee).quantize(Q)),
            "expires_at": _iso(_now() + timedelta(minutes=5))}}}

    def _quote_or_404(self, qid: str) -> dict:
        q = self.quotes.get(qid)
        if q is None:
            raise _plain_error(404, "NOT_FOUND", "Quote not found")
        return q

    async def _initialize(self, qid, *, body, params):
        q = self._quote_or_404(qid)
        ben = body.get("beneficiary") or {}
        if not ben.get("account_number"):
            raise _plain_error(400, "BAD_REQUEST", "beneficiary.account_number is required")
        pid = "mockpo_" + uuid.uuid4().hex[:12]
        q["payout_id"] = pid
        self.payouts[pid] = {"id": pid, "quote_id": qid, "reference": body.get("reference"),
                             "account": str(ben["account_number"]), "status": "INITIATED"}
        return {"success": True, "data": {"payout": {"id": pid, "status": "INITIATED",
                                                     "reference": body.get("reference")}}}

    async def _finalize(self, qid, *, body, params):
        q = self._quote_or_404(qid)
        po = self.payouts.get(q.get("payout_id") or "")
        if po is None:
            raise _plain_error(400, "BAD_REQUEST", "Payout not initialized")
        if time.time() > q["expires"]:
            raise _plain_error(400, "QUOTE_EXPIRED", "Quote has expired")
        acct = po["account"]
        if acct.endswith("0000"):
            raise _plain_error(400, "BAD_REQUEST", "Beneficiary account rejected")
        total = (q["usd"] + q["fee"]) / PRICE[q["asset"]]
        if self.balances[q["asset"]] < total:
            raise _plain_error(400, "INSUFFICIENT_BALANCE",
                               f"Insufficient {q['asset']} balance: required {total:.2f}")
        self.balances[q["asset"]] -= total
        po["status"], d = "PENDING", self.s.mock_delay_seconds
        self._spawn(self._payout_lifecycle(po, silent=acct.endswith("5000"),
                                           expire=acct.endswith("9999"), delay=d))
        if acct.endswith("5000"):  # le paiement part, mais la réponse se perd
            raise BitnobError(500, {"success": False, "error": {"code": "INTERNAL", "message": "upstream timeout"}})
        return {"success": True, "data": {"payout": {"id": po["id"], "status": "PENDING",
                                                     "reference": po["reference"]}}}

    async def _payout_lifecycle(self, po: dict, *, silent: bool, expire: bool, delay: float) -> None:
        data = {"reference": po["reference"], "id": po["id"]}
        await asyncio.sleep(delay)
        if not silent:
            await self._emit("payouts.processing", data)
        await asyncio.sleep(delay)
        if expire:
            po["status"] = "EXPIRED"
            q = self.quotes[po["quote_id"]]
            self.balances[q["asset"]] += (q["usd"] + q["fee"]) / PRICE[q["asset"]]
            if not silent:
                await self._emit("payouts.withdrawal.expired", data)
        else:
            po["status"] = "COMPLETED"
            if not silent:
                await self._emit("payouts.withdrawal.success", data)

    async def _get_payout(self, pid, *, body, params):
        po = self.payouts.get(pid)
        if po is None:
            raise _plain_error(404, "NOT_FOUND", "Payout not found")
        return {"success": True, "data": {"payout": {"id": pid, "status": po["status"],
                                                     "reference": po["reference"]}}}

    # ----------------------------------------------------------------- cartes
    async def _kyc(self, *, body, params):
        c = body.get("customer") or {}
        missing = [k for k in ("first_name", "last_name", "email") if not c.get(k)]
        if missing:
            raise BitnobError(400, {"success": False, "error": {
                "code": "BAD_REQUEST", "message": "Validation failed",
                "details": {k: f"{k} is required" for k in missing}}})
        cid = str(uuid.uuid4())
        self.customers[cid] = c
        return {"success": True, "message": "Card KYC initiated successfully", "data": {
            "customer_id": cid, "status": "approved", "completion_link": "", "email": c["email"],
            "first_name": c["first_name"], "last_name": c["last_name"], "normalized_status": "approved"}}

    def _card(self, card_id: str) -> dict:
        c = self.cards.get(card_id)
        if c is None:
            raise _plain_error(404, "NOT_FOUND", "Card not found")
        if c["status"] == "pending" and time.time() >= c["ready_at"]:
            c.update(status="active", created_status="completed",
                     masked_pan=f"**** **** **** {c['last4']}")
        return c

    def _card_view(self, c: dict) -> dict:
        bal = c["balance"]
        return {"id": c["id"], "status": c["status"], "created_status": c["created_status"],
                "masked_pan": c["masked_pan"], "last_four_digit": c["last4"] if c["masked_pan"] else "",
                "balance_amount": str(int(bal * 1_000_000)), "display_amount": float(bal),
                "currency": "USD", "card_type": "virtual", "card_brand": c["brand"],
                "name": c["name"], "reference": c["reference"], "customer_id": c["customer_id"]}

    async def _create_card(self, *, body, params):
        budget = _dec(micro_to_usd(body.get("amount", 0)))
        required = budget + CARD_CREATION_FEE
        available = self.balances["USDC"]
        if available < required:
            raise BitnobError(400, {
                "type": "https://api.bitnob.com/errors/VALIDATION_ERROR", "title": "Validation Error",
                "status": 400, "code": "VALIDATION_ERROR",
                "detail": f"Insufficient company balance for card creation: required {required:.2f}, "
                          f"available {available:.2f} USDC",
                "extensions": {"error_code": "COMPANY_INSUFFICIENT_BALANCE", "currency": "USDC",
                               "required": f"{required:.2f}", "available": f"{available:.2f}"}})
        self.balances["USDC"] -= required
        cid = "mockcard_" + uuid.uuid4().hex[:10]
        self.cards[cid] = {
            "id": cid, "status": "pending", "created_status": "processing", "masked_pan": "",
            "last4": f"{random.randint(0, 9999):04d}", "balance": budget, "brand": body.get("card_brand", "visa"),
            "name": body.get("name") or "MOCK CARDHOLDER", "reference": body.get("reference"),
            "customer_id": body.get("customer_id"), "created": time.time(),
            "ready_at": time.time() + self.s.mock_delay_seconds,
            "monthly_limit": _dec(micro_to_usd(body["card_limits"]["monthly_limit"]))
            if body.get("card_limits", {}).get("monthly_limit") else None}
        self.card_tx[cid] = []
        return {"success": True, "data": {"card": self._card_view(self.cards[cid])}}

    async def _list_cards(self, *, body, params):
        cards = [self._card_view(self._card(i)) for i in self.cards]
        return {"success": True, "data": {"cards": cards, "next_cursor": None}}

    async def _get_card(self, card_id, *, body, params):
        return {"success": True, "data": {"card": self._card_view(self._card(card_id))}}

    async def _card_transactions(self, card_id, *, body, params):
        self._card(card_id)
        return {"success": True, "data": {"transactions": list(reversed(self.card_tx[card_id]))}}

    async def _card_balance(self, card_id, *, body, params):
        c = self._card(card_id)
        amount, kind = _dec(micro_to_usd(body.get("amount", 0))), body.get("type")
        if amount <= 0 or kind not in {"fund", "withdraw"}:
            raise _plain_error(400, "BAD_REQUEST", "amount > 0 and type fund|withdraw required")
        if kind == "fund":
            if self.balances["USDC"] < amount:
                raise _plain_error(400, "COMPANY_INSUFFICIENT_BALANCE",
                                   f"Insufficient company balance: required {amount:.2f}")
            self.balances["USDC"] -= amount
            c["balance"] += amount
            self._spawn(self._emit("virtualcard.topup.completed", {"cardId": card_id},
                                   delay=self.s.mock_delay_seconds))
        else:
            if c["balance"] < amount:
                raise _plain_error(400, "BAD_REQUEST", "Insufficient card balance")
            c["balance"] -= amount
            self.balances["USDC"] += amount
        return {"success": True, "data": {"transaction": {"status": "pending", "type": kind,
                                                          "amount": body["amount"]}}}

    async def _card_status(self, card_id, *, body, params):
        c = self._card(card_id)
        if body.get("status") not in {"frozen", "active"}:
            raise _plain_error(400, "BAD_REQUEST", "status must be frozen or active")
        c["status"] = body["status"]
        return {"success": True, "data": {"card": {"id": card_id, "status": c["status"]}}}

    async def _card_terminate(self, card_id, *, body, params):
        self._card(card_id)
        raise _plain_error(400, "BAD_REQUEST", "A card cannot be terminated within 24 hours of creation")

    async def _card_simulate(self, card_id, *, body, params):
        c = self._card(card_id)
        kind = body.get("event_type")
        merchant = random.choice(MERCHANTS)
        data = {"cardId": card_id, "merchantName": merchant}
        if c["status"] != "active" or kind == "decline":
            reason = "card_not_active" if c["status"] != "active" else "declined_by_issuer"
            self._record(card_id, "declined", Decimal(0), merchant)
            await self._emit("virtualcard.transaction.declined", {**data, "reason": reason})
            return {"success": True, "message": f"simulated {kind}: declined ({reason})"}
        if kind == "reversal":
            last = next((t for t in reversed(self.card_tx[card_id]) if t["type"] == "settlement"), None)
            amount = _dec(last["amount"]) if last else Decimal(0)
            c["balance"] += amount
            self._record(card_id, "reversal", amount, last["merchant"] if last else merchant)
            await self._emit("virtualcard.transaction.refund", {**data, "displayAmount": float(amount)})
        else:
            default = max(Decimal(1), (c["balance"] * Decimal("0.4")).quantize(Q))
            amount = min(_dec(body["amount"]), c["balance"]) if body.get("amount") is not None \
                else min(default, c["balance"])
            c["balance"] -= amount
            self._record(card_id, kind, amount, merchant)
            await self._emit(f"virtualcard.transaction.{kind}", {**data, "displayAmount": float(amount)})
        return {"success": True, "message": f"simulated {kind}", "data": {"amount": float(amount)}}

    def _record(self, card_id: str, kind: str, amount: Decimal, merchant: str) -> None:
        self.card_tx[card_id].append({"id": uuid.uuid4().hex[:12], "type": kind, "merchant": merchant,
                                      "amount": str(amount), "currency": "USD", "created_at": _iso(_now())})

    # ---------------------------------------------------------------- Lightning
    def _inv(self, inv_id: str) -> dict:
        inv = self.invoices.get(inv_id)
        if inv is None:
            raise _plain_error(404, "NOT_FOUND", "Invoice not found")
        wait = self.s.mock_invoice_pay_seconds
        if inv["status"] == "pending":
            if time.time() > inv["expires"]:
                inv["status"] = "expired"
            elif wait > 0 and time.time() >= inv["created"] + wait:
                self.mark_invoice_paid(inv_id)
        return inv

    def mark_invoice_paid(self, inv_id: str) -> dict:
        inv = self.invoices.get(inv_id)
        if inv is None:
            raise _plain_error(404, "NOT_FOUND", "Invoice not found")
        if inv["status"] == "pending":
            inv.update(status="paid", preimage=uuid.uuid4().hex + uuid.uuid4().hex[:32], paid_at=_iso(_now()))
            self.balances["BTC"] += _dec(inv["amount"]) / Decimal(100_000_000)
        return inv

    def _inv_view(self, inv: dict) -> dict:
        return {k: v for k, v in inv.items() if k not in {"created", "expires"}}

    async def _create_invoice(self, *, body, params):
        sats = int(body.get("amount", 0))
        if sats < 1:
            raise _plain_error(400, "BAD_REQUEST", "amount (sats) must be >= 1")
        iid = str(uuid.uuid4())
        request = f"lnbc{sats}n1p" + "".join(random.choices(BECH32, k=110))
        self.invoices[iid] = {"id": iid, "request": request, "status": "pending", "amount": str(sats),
                              "description": body.get("description", ""), "reference": body.get("reference"),
                              "payment_hash": uuid.uuid4().hex + uuid.uuid4().hex[:32], "preimage": None,
                              "created": time.time(), "expires": time.time() + int(body.get("expiry", 3600)),
                              "expires_at": _iso(_now() + timedelta(seconds=int(body.get("expiry", 3600))))}
        return self._inv_view(self.invoices[iid])  # l'API réelle renvoie ces champs à la racine

    async def _get_invoice(self, inv_id, *, body, params):
        return {"success": True, "data": self._inv_view(self._inv(inv_id))}

    async def _list_invoices(self, *, body, params):
        status = params.get("status")
        items = [self._inv_view(self._inv(i)) for i in self.invoices]
        return {"success": True, "data": [i for i in items if not status or i["status"] == status]}
