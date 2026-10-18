"""Tests unitaires : montants, validation, calcul, webhooks. Lancer : pytest -q"""
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from role3.money import MoneyError, fmt, parse_decimal, to_major, to_minor
from role3.pricing import Quote, batch_cost, classify_invoice_payment, estimate_source_for_target, quotes_at_risk
from role3.validation import validate_csv, validate_records, validate_text
from role3.webhooks import decide, next_status, verify_signature

DATA = Path(__file__).resolve().parent.parent / "data"


# --- montants ---------------------------------------------------------------
@pytest.mark.parametrize("raw,ccy,minor", [
    ("25 000", "XOF", 25000), ("25000", "XOF", 25000), ("25,50", "GHS", 2550),
    ("0.003412", "USDT", 3412), ("1", "BTC", 100_000_000), ("18 000", "NGN", 1_800_000),
])
def test_to_minor(raw, ccy, minor):
    assert to_minor(raw, ccy) == minor


def test_xof_has_no_decimals():
    with pytest.raises(MoneyError):
        to_minor("100,5", "XOF")
    assert to_minor("100.5", "XOF", rounding="down") == 100


def test_float_refused():
    with pytest.raises(MoneyError):
        parse_decimal(0.1)


def test_round_trip_and_format():
    assert to_major(2550, "GHS") == Decimal("25.50")
    assert fmt(1_500_000, "XOF") == "1 500 000 XOF"
    assert fmt(250, "GHS") == "2,50 GHS"


# --- validation -------------------------------------------------------------
def test_clean_file_all_ok():
    r = validate_csv(DATA / "beneficiaires_propre.csv")
    assert r.counts() == {"ok": 12, "warning": 0, "error": 0}


def test_demo_file_matches_project_scenario():
    """Document de projet : 50 livreurs (NG, GH, SN), l'application signale deux numéros invalides."""
    r = validate_csv(DATA / "livreurs_demo_50.csv")
    assert len(r.rows) == 50
    assert r.counts() == {"ok": 48, "warning": 0, "error": 2}
    assert [i.code for row in r.rows for i in row.issues] == ["PHONE_INVALID", "PHONE_INVALID"]
    assert {row.country for row in r.rows} == {"NG", "GH", "SN"}


def test_demo_file_is_the_seeded_riders():
    from role3.fakes import livreurs
    r = validate_csv(DATA / "livreurs_demo_50.csv")
    names = {p["name"] for p in livreurs()}
    assert {row.name for row in r.rows} == names


def test_blocked_rows_excluded_from_totals():
    recs = [
        {"nom": "A", "telephone": "+221771234567", "montant": "10000", "devise": "XOF", "pays": "SN", "operateur": "Wave"},
        {"nom": "B", "telephone": "+221771234568", "montant": "-5", "devise": "XOF", "pays": "SN", "operateur": "Wave"},
    ]
    r = validate_records(recs)
    assert r.totals_by_currency() == {"XOF": 10000}


def test_phone_from_wrong_country():
    recs = [{"nom": "A", "telephone": "+2348031234567", "montant": "10000", "devise": "XOF", "pays": "SN", "operateur": "Wave"}]
    r = validate_records(recs)
    assert r.rows[0].issues[0].code == "PHONE_COUNTRY_MISMATCH"


def test_missing_columns_and_aliases():
    assert validate_text("nom;montant\nA;10\n").file_errors
    r = validate_text("Name;Phone;Amount;Currency;Country;Bank_code\nA;771234567;10000;XOF;SN;Wave\n")
    assert r.counts()["ok"] == 1
    assert r.rows[0].phone_e164 == "+221771234567"


def test_unknown_country_blocked():
    r = validate_records([{"nom": "A", "telephone": "+33612345678", "montant": "10", "devise": "EUR", "pays": "FR"}])
    assert r.rows[0].status == "error"


# --- calcul -----------------------------------------------------------------
QUOTE = {
    "id": "c1", "quote_id": "QT2_1", "reference": "BP-1", "status": "QUOTE",
    "from_asset": "USDT", "to_currency": "GHS", "amount": "50.00", "settlement_amount": "761.237",
    "fees": "0.80", "exchange_rate": {"rate": "15.2247"}, "country": "GH",
    "expires_at": "2026-10-10T12:10:00Z",
}


def test_quote_parsing_and_cost():
    q = Quote.from_bitnob(QUOTE)
    assert q.source_minor == 50_000_000
    assert q.fee_minor == 800_000
    assert q.settlement_minor == 76123          # arrondi vers le bas : jamais plus que reçu
    assert q.total_debit_minor == 50_800_000    # hypothèse prudente : frais en plus
    assert q.breakdown()["beneficiaire_recoit"] == "761,23 GHS"


def test_quote_expiry_and_risk():
    q = Quote.from_bitnob(QUOTE)
    t = datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)
    assert q.is_usable(t)
    assert not q.is_usable(t + timedelta(minutes=9, seconds=45))
    many = [q] * 100
    assert len(quotes_at_risk(many, t, seconds_per_payout=10)) > 0


def test_batch_cost_refuses_mixed_assets():
    q1 = Quote.from_bitnob(QUOTE)
    q2 = Quote.from_bitnob({**QUOTE, "from_asset": "USDC"})
    with pytest.raises(ValueError):
        batch_cost([q1, q2])
    c = batch_cost([q1, q1])
    assert c.total_debit_minor == 2 * q1.total_debit_minor
    assert c.settlement_by_currency == {"GHS": 2 * 76123}


def test_estimate_rounds_up():
    est = estimate_source_for_target(100_000, "XOF", "565", "USDT", fee_rate="0.01")
    # plus petit montant (au micro-USDT près) qui couvre la cible après frais
    received = lambda minor: to_major(minor, "USDT") * Decimal("0.99") * Decimal("565")  # noqa: E731
    assert received(est) >= Decimal("100000")
    assert received(est - 1) < Decimal("100000")


def test_invoice_classification():
    assert classify_invoice_payment(1000, 0) == ("open", 1000)
    assert classify_invoice_payment(1000, 1000) == ("paid", 0)
    assert classify_invoice_payment(1000, 900) == ("partially_paid", 100)
    assert classify_invoice_payment(1000, 1100) == ("overpaid", -100)
    assert classify_invoice_payment(1000, 998, tolerance_minor=5)[0] == "paid"


# --- webhooks ---------------------------------------------------------------
def test_signature_hex_and_base64():
    body, secret = b'{"event":"x"}', "sk_test"
    digest = hmac.new(secret.encode(), body, hashlib.sha512).digest()
    import base64
    assert verify_signature(body, digest.hex(), secret)
    assert verify_signature(body, base64.b64encode(digest).decode(), secret)
    assert not verify_signature(body + b" ", digest.hex(), secret)
    assert not verify_signature(body, None, secret)


def test_state_machine():
    assert next_status("initialized", "pending").apply
    assert next_status("pending", "completed").new_status == "completed"
    late = next_status("completed", "pending")          # événement arrivé en retard
    assert not late.apply and not late.alert
    conflict = next_status("completed", "expired")       # deux états terminaux différents
    assert not conflict.apply and conflict.alert


def test_decide():
    ok = {"event": "payouts.withdrawal.success", "event_id": "e1", "data": {"reference": "BP-1"}}
    assert decide(ok, True, False, "pending").new_status == "completed"
    assert not decide(ok, False, False, "pending").apply          # signature invalide
    assert not decide(ok, True, True, "pending").apply            # renvoi déjà traité
    assert decide(ok, True, False, None).alert                    # référence inconnue
    assert decide({"event": "payouts.unknown"}, True, False, "pending").alert


# --- v2 : scénario ONG Sénégal ------------------------------------------------
def test_ngo_file_catches_all_traps():
    r = validate_csv(DATA / "relais_communautaires_50.csv")
    assert len(r.rows) == 50
    assert r.counts() == {"ok": 42, "warning": 4, "error": 4}
    codes = {i.code for row in r.rows for i in row.issues}
    assert {"PHONE_INVALID", "CURRENCY_MISMATCH", "AMOUNT_PRECISION", "OPERATOR_UNSUPPORTED",
            "AMOUNT_OUTLIER", "REGION_UNKNOWN", "DUPLICATE_PAYMENT"} <= codes
    assert r.totals_by_currency() == {"XOF": 2_352_500}


@pytest.mark.parametrize("written,code", [
    ("Wave", "WAVE"), ("wave", "WAVE"), ("Orange Money", "ORANGE_MONEY"), ("OM", "ORANGE_MONEY"),
    ("free", "FREE_MONEY"), ("Expresso", "EXPRESSO"),
])
def test_operator_aliases(written, code):
    rec = {"nom": "A", "telephone": "771234567", "montant": "10000", "devise": "XOF", "pays": "SN",
           "operateur": written}
    row = validate_records([rec]).rows[0]
    assert row.status == "ok" and row.bank_code == code


def test_operator_rules():
    base = {"nom": "A", "telephone": "771234567", "montant": "10000", "devise": "XOF", "pays": "SN"}
    assert validate_records([{**base, "operateur": "MTN"}]).rows[0].issues[0].code == "OPERATOR_UNSUPPORTED"
    assert validate_records([{**base, "operateur": ""}]).rows[0].issues[0].code == "OPERATOR_MISSING"


def test_region_normalized():
    base = {"nom": "A", "telephone": "771234567", "montant": "10000", "devise": "XOF", "pays": "SN",
            "operateur": "Wave"}
    assert validate_records([{**base, "region": "THIES"}]).rows[0].region == "Thiès"
    assert validate_records([{**base, "region": "saint louis"}]).rows[0].region == "Saint-Louis"
    assert validate_records([{**base, "region": "Kaolak"}]).rows[0].status == "warning"
