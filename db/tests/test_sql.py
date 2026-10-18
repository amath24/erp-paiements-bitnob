"""Tests d'intégration PostgreSQL : migrations, règles de la base, données de démo, droits des comptes.

Lancés seulement si TEST_DATABASE_URL pointe vers un serveur où l'on peut créer des bases jetables
(compte administrateur) :
    $env:TEST_DATABASE_URL = "postgresql://postgres@localhost:5432/postgres"   # PowerShell
    pytest -q tests/test_sql.py
Ne JAMAIS pointer vers la base Supabase de l'équipe.
"""
import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest

psycopg = pytest.importorskip("psycopg")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import migrate  # noqa: E402

ADMIN_DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not ADMIN_DSN, reason="TEST_DATABASE_URL non défini")
CheckViolation = psycopg.errors.CheckViolation


def _dsn_for(db: str) -> str:
    info = psycopg.conninfo.conninfo_to_dict(ADMIN_DSN)
    info["dbname"] = db
    return psycopg.conninfo.make_conninfo(**info)


def _new_db() -> tuple[str, str]:
    name = f"bulkpay_{uuid.uuid4().hex[:8]}"
    with psycopg.connect(ADMIN_DSN, autocommit=True) as c:
        c.execute(f"CREATE DATABASE {name}")
    return name, _dsn_for(name)


def _drop_db(name: str) -> None:
    with psycopg.connect(ADMIN_DSN, autocommit=True) as c:
        c.execute(f"DROP DATABASE {name} WITH (FORCE)")


def _seed(dsn: str, *args: str) -> None:
    subprocess.run([sys.executable, str(ROOT / "scripts" / "seed.py"), "--dsn", dsn, "--seed", "1", *args], check=True)


@pytest.fixture(scope="module")
def db():
    name, dsn = _new_db()
    assert migrate.run(dsn, quiet=True) == 0
    _seed(dsn)
    yield dsn
    _drop_db(name)


@pytest.fixture(scope="module")
def db_ong():
    name, dsn = _new_db()
    assert migrate.run(dsn, quiet=True) == 0
    _seed(dsn, "--scenario", "ong")
    yield dsn
    _drop_db(name)


@pytest.fixture()
def empty_db():
    """Base migrée, sans données, pour tester les règles une à une."""
    name, dsn = _new_db()
    assert migrate.run(dsn, quiet=True) == 0
    with psycopg.connect(dsn) as c:
        c.execute("""
            INSERT INTO users (id, email, full_name) VALUES ('10000000-0000-0000-0000-000000000001', 'a@test.sn', 'Admin');
            INSERT INTO beneficiaries (id, owner_id, full_name, country, currency, phone_e164, bank_code)
            VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Kofi', 'GH', 'GHS',
                    '+233241234567', 'MTN');
            INSERT INTO batches (id, owner_id, name, source_asset)
            VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Lot', 'USDT');
            INSERT INTO payouts (id, batch_id, beneficiary_id, reference, settlement_minor, settlement_currency, source_asset)
            VALUES ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
                    '20000000-0000-0000-0000-000000000001', 'BP-T-1', 50000, 'GHS', 'USDT');
            INSERT INTO envelopes (id, owner_id, name, monthly_budget_minor, low_balance_threshold_minor, status,
                                   kyc_status, bitnob_card_id, card_last4)
            VALUES ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Meta Ads',
                    10000, 1000, 'active', 'verified', 'card_1', '4242');
        """)
    yield dsn
    _drop_db(name)


def rows(dsn, sql, params=None):
    with psycopg.connect(dsn) as c:
        return c.execute(sql, params).fetchall()


def one(dsn, sql, params=None):
    return rows(dsn, sql, params)[0][0]


PAYOUT = "40000000-0000-0000-0000-000000000001"


# --- données de démo ------------------------------------------------------------
def test_all_consistency_checks_pass(db):
    assert rows(db, "SELECT check_name, violations FROM v_consistency_checks WHERE violations <> 0") == []
    assert one(db, "SELECT COUNT(*) FROM v_consistency_checks") >= 17


def test_planted_reconciliation_issues_found(db):
    found = dict(rows(db, "SELECT issue_type, COUNT(*) FROM v_reconciliation_issues GROUP BY 1"))
    assert found == {"STUCK": 2, "AMOUNT_MISMATCH": 1, "UNKNOWN_REFERENCE": 1, "INVALID_SIGNATURE": 1}


def test_bulkpay_demo_matches_project_scenario(db):
    assert dict(rows(db, "SELECT country, COUNT(*) FROM beneficiaries GROUP BY 1")) == {"NG": 17, "GH": 16, "SN": 17}
    assert set(r[0] for r in rows(db, "SELECT source_asset FROM v_kpis")) == {"USDT", "BTC"}
    assert one(db, "SELECT SUM(payouts_retried) FROM v_kpis") > 0
    live = rows(db, "SELECT n_failed, n_in_progress FROM v_batch_summary WHERE batch_status = 'running'")
    assert live == [(1, 8)]
    envs = dict(rows(db, "SELECT name, balance_usd FROM v_envelope_balances"))
    assert envs["Meta Ads"] == 14                                    # juste au-dessus du seuil de 10 USD
    statuses = dict(rows(db, "SELECT effective_status, n_invoices FROM v_invoice_summary"))
    assert statuses == {"paid": 8, "expired": 2, "pending": 2}


def test_success_rate_is_plausible(db):
    rate = one(db, "SELECT success_rate FROM v_kpis WHERE source_asset = 'USDT'")
    assert 0.9 <= float(rate) <= 1


def test_ngo_views(db_ong):
    ops = dict(rows(db_ong, "SELECT operator, n_total FROM v_operators"))
    assert set(ops) == {"WAVE", "ORANGE_MONEY", "FREE_MONEY", "EXPRESSO"}
    assert one(db_ong, "SELECT COUNT(*) FROM v_regions") >= 10
    masked = rows(db_ong, "SELECT telephone_masque FROM v_donor_report LIMIT 20")
    assert all(m.startswith("••••") and len(m) == 8 for (m,) in masked)
    a = one(db_ong, "SELECT SUM(montant_recu) FROM v_donor_report WHERE statut = 'Payé'")
    b = one(db_ong, "SELECT to_major(SUM(settled_minor), 'XOF') FROM v_operators")
    assert a == b
    assert rows(db_ong, "SELECT check_name FROM v_consistency_checks WHERE violations <> 0") == []


# --- migrations -------------------------------------------------------------------
def test_migrate_twice_changes_nothing(db):
    before = rows(db, "SELECT version, checksum FROM schema_migrations ORDER BY 1")
    assert migrate.run(db, quiet=True) == 0
    assert rows(db, "SELECT version, checksum FROM schema_migrations ORDER BY 1") == before
    assert rows(db, "SELECT check_name FROM v_consistency_checks WHERE violations <> 0") == []


def test_modified_migration_is_refused(db):
    with psycopg.connect(db, autocommit=True) as c:
        c.execute("UPDATE schema_migrations SET checksum = 'x' WHERE version = '003'")
    try:
        assert migrate.run(db, quiet=True) == 1
    finally:
        with psycopg.connect(db, autocommit=True) as c:
            c.execute("UPDATE schema_migrations SET checksum = %s WHERE version = '003'",
                      (migrate.checksum(next((ROOT / "sql" / "migrations").glob("003_*.sql"))),))


def test_upgrade_from_v2_keeps_real_data():
    name, dsn = _new_db()
    try:
        with psycopg.connect(dsn, autocommit=True) as c:
            for f in ("migrations/001_schema.sql", "migrations/002_region.sql"):
                c.execute((ROOT / "sql" / f).read_text(encoding="utf-8"))
            c.execute((ROOT / "tests" / "fixtures" / "v2_views.sql").read_text(encoding="utf-8"))
            c.execute("""
                INSERT INTO users (id, email, role) VALUES ('00000000-0000-0000-0000-000000000001', 'Vrai@Ex.com', 'merchant');
                INSERT INTO users (id, email, is_simulated) VALUES ('00000000-0000-0000-0000-000000000009', 'demo@x.test', TRUE);
                INSERT INTO beneficiaries (id, owner_id, full_name, country, currency, phone_e164)
                VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'R', 'SN', 'XOF', '+221771112233');
                INSERT INTO payouts (beneficiary_id, reference, settlement_minor, settlement_currency, source_asset, status,
                                     quoted_at, initialized_at, completed_at)
                VALUES ('00000000-0000-0000-0000-000000000002', 'REAL-1', 10000, 'XOF', 'USDT', 'completed',
                        now() - interval '2 h', now() - interval '2 h', now() - interval '1 h');
                INSERT INTO invoices (owner_id, number, client_name, target_minor, target_currency, pay_asset, is_simulated)
                VALUES ('00000000-0000-0000-0000-000000000009', 'SP-1', 'X', 1000, 'XOF', 'USDT', TRUE);
            """)
        assert migrate.run(dsn, quiet=True) == 0
        assert rows(dsn, "SELECT reference, attempt_no, status FROM payout_attempts") == [("REAL-1", 1, "completed")]
        assert rows(dsn, "SELECT email, role FROM users") == [("vrai@ex.com", "admin")]
        assert one(dsn, "SELECT COUNT(*) FROM invoices") == 0
        assert rows(dsn, "SELECT check_name FROM v_consistency_checks WHERE violations <> 0") == []
    finally:
        _drop_db(name)


# --- paiements : jamais deux fois -------------------------------------------------
def test_attempt_rules(empty_db):
    with psycopg.connect(empty_db, autocommit=True) as c:
        f = lambda *a: c.execute("SELECT apply_payout_event(%s, %s, now(), %s)", a).fetchone()[0]  # noqa: E731
        assert c.execute("SELECT start_payout_attempt(%s)", (PAYOUT,)).fetchone()[0] == "BP-T-1"
        with pytest.raises(psycopg.errors.UniqueViolation):
            c.execute("SELECT start_payout_attempt(%s)", (PAYOUT,))          # essai déjà en cours
        assert f("BP-T-1", "initialized", "api") == "applied"
        assert f("BP-T-1", "completed", "api") == "refused_needs_webhook"     # succès = webhook seulement
        assert c.execute("SELECT apply_payout_event('BP-T-1', 'failed', now(), 'api', NULL, 'Nom différent')").fetchone()[0] == "applied"
        assert f("BP-T-1", "pending", "webhook") == "ignored_late"           # webhook en retard
        assert f("BP-T-1", "completed", "webhook") == "refused_conflict"     # deux états finaux différents
        assert c.execute("SELECT status FROM payouts WHERE id = %s", (PAYOUT,)).fetchone()[0] == "failed"
        assert c.execute("SELECT start_payout_attempt(%s)", (PAYOUT,)).fetchone()[0] == "BP-T-1-R2"
        assert f("BP-T-1-R2", "pending", "webhook") == "applied"
        assert f("BP-T-1-R2", "completed", "webhook") == "applied"
        with pytest.raises(psycopg.errors.UniqueViolation):
            c.execute("SELECT start_payout_attempt(%s)", (PAYOUT,))          # déjà payé
        assert f("INCONNUE", "completed", "webhook") == "unknown_reference"
        assert c.execute("SELECT status FROM payouts WHERE id = %s", (PAYOUT,)).fetchone()[0] == "completed"
        hist = [r[0] for r in c.execute("SELECT to_status FROM payout_status_history ORDER BY id")]
        assert hist == ["quoted", "initialized", "failed", "quoted", "pending", "completed"]


def test_base_refuses_direct_or_backward_changes(empty_db):
    with psycopg.connect(empty_db, autocommit=True) as c:
        c.execute("SELECT start_payout_attempt(%s)", (PAYOUT,))
        c.execute("SELECT apply_payout_event('BP-T-1', 'pending', now(), 'webhook')")
        with pytest.raises(CheckViolation):
            c.execute("UPDATE payouts SET status = 'completed' WHERE id = %s", (PAYOUT,))
        with pytest.raises(CheckViolation):
            c.execute("UPDATE payout_attempts SET status = 'initialized' WHERE reference = 'BP-T-1'")
        with pytest.raises(psycopg.errors.UniqueViolation):     # deux essais vivants : impossible
            c.execute("INSERT INTO payout_attempts (payout_id, attempt_no, reference) VALUES (%s, 2, 'X')", (PAYOUT,))
        with pytest.raises(CheckViolation):
            c.execute("INSERT INTO payouts (beneficiary_id, reference, settlement_minor, settlement_currency, source_asset, status) "
                      "VALUES ('20000000-0000-0000-0000-000000000001', 'X1', 100, 'GHS', 'USDT', 'completed')")
        with pytest.raises(CheckViolation):
            c.execute("INSERT INTO payouts (beneficiary_id, reference, settlement_minor, settlement_currency, source_asset) "
                      "VALUES ('20000000-0000-0000-0000-000000000001', 'X2', -5, 'GHS', 'USDT')")
        with pytest.raises(psycopg.errors.UniqueViolation):     # même personne deux fois dans un lot
            c.execute("INSERT INTO payouts (batch_id, beneficiary_id, reference, settlement_minor, settlement_currency, source_asset) "
                      "VALUES ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'X3', 100, 'GHS', 'USDT')")


def test_duplicate_webhook_ignored_by_unique_event_id(db):
    with psycopg.connect(db) as c:
        ev = c.execute("SELECT event_id FROM webhook_events LIMIT 1").fetchone()[0]
        cur = c.execute("INSERT INTO webhook_events (event_id, event_type, payload, signature_valid) "
                        "VALUES (%s, 'payouts.processing', '{}', TRUE) ON CONFLICT (event_id) DO NOTHING", (ev,))
        assert cur.rowcount == 0


# --- enveloppes --------------------------------------------------------------------
def test_envelope_rules(empty_db):
    env = "50000000-0000-0000-0000-000000000001"
    with psycopg.connect(empty_db, autocommit=True) as c:
        rec = lambda tx, d, st, amt, reason=None: c.execute(  # noqa: E731
            "SELECT record_card_transaction('card_1', %s, %s, %s, %s, now(), 'META ADS', %s)", (tx, d, st, amt, reason)).fetchone()[0]
        assert c.execute("SELECT reload_envelope(%s)", (env,)).fetchone()[0] == "reloaded"
        assert c.execute("SELECT reload_envelope(%s)", (env,)).fetchone()[0] == "already_done"   # une fois par mois
        assert rec("t1", "debit", "success", 4500) == "recorded"
        assert rec("t1", "debit", "success", 4500) == "duplicate"                                # comptée une fois
        assert rec("t2", "debit", "declined", 9000, "Solde insuffisant") == "recorded"
        assert rec("t3", "credit", "success", 500) == "recorded"
        bal = c.execute("SELECT balance_minor, alert_level FROM v_envelope_balances").fetchone()
        assert bal == (6000, "ok")
        assert rec("t4", "debit", "success", 6000) == "recorded"
        assert c.execute("SELECT alert_level, should_be_frozen FROM v_envelope_balances").fetchone() == ("exhausted", True)
        assert "CARD_NOT_FROZEN" in [r[0] for r in c.execute("SELECT issue_type FROM v_reconciliation_issues")]
        with pytest.raises(psycopg.errors.RestrictViolation):
            c.execute("UPDATE envelope_movements SET amount_minor = 1")
        with pytest.raises(psycopg.errors.RestrictViolation):
            c.execute("DELETE FROM card_transactions")
        with pytest.raises(CheckViolation):     # jamais un numéro de carte complet
            c.execute("UPDATE envelopes SET frozen_reason = 'carte 4242424242424242' WHERE id = %s", (env,))
        assert c.execute("SELECT check_name FROM v_consistency_checks WHERE violations <> 0 "
                         "AND check_name <> 'launched_batch_is_audited'").fetchall() == []


# --- factures Bitcoin -----------------------------------------------------------------
def test_invoice_rules(empty_db):
    with psycopg.connect(empty_db, autocommit=True) as c:
        c.execute("""
            INSERT INTO invoices (owner_id, number, customer_name, amount_sats, payment_request, bitnob_invoice_id, expires_at, created_at)
            VALUES ('10000000-0000-0000-0000-000000000001', 'INV-1', 'C', 50000, 'lnbc500u1pa', 'i1', now() + interval '30 min', now()),
                   ('10000000-0000-0000-0000-000000000001', 'INV-2', 'C', 50000, 'lnbc500u1pb', 'i2', now() - interval '1 min',
                    now() - interval '61 min')""")
        assert c.execute("SELECT mark_invoice_paid('i1')").fetchone()[0] == "paid"
        assert c.execute("SELECT mark_invoice_paid('i1')").fetchone()[0] == "already_paid"
        assert c.execute("SELECT mark_invoice_paid('i2')").fetchone()[0] == "refused_expired"
        assert c.execute("SELECT expire_invoices()").fetchone()[0] == 1
        with pytest.raises(CheckViolation):
            c.execute("UPDATE invoices SET status = 'pending' WHERE number = 'INV-1'")
        with pytest.raises(CheckViolation):
            c.execute("INSERT INTO invoices (owner_id, number, customer_name, amount_sats, payment_request, bitnob_invoice_id, "
                      "expires_at) VALUES ('10000000-0000-0000-0000-000000000001', 'INV-3', 'C', 1, 'pas-une-facture', 'i3', "
                      "now() + interval '1 h')")


# --- droits des comptes ----------------------------------------------------------------
def _as(dsn, role, sql):
    with psycopg.connect(dsn) as c:
        c.execute(f"SET ROLE {role}")
        return c.execute(sql).fetchall()


def test_ai_reader_sees_only_safe_views(db):
    assert _as(db, "ai_reader", "SELECT COUNT(*) FROM v_ai_payouts")[0][0] > 0
    assert _as(db, "ai_reader", "SELECT SUM(balance_usd) FROM v_envelope_balances")[0][0] > 0
    for forbidden in ("payouts", "beneficiaries", "v_payouts_enriched", "v_donor_report", "audit_log"):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            _as(db, "ai_reader", f"SELECT 1 FROM {forbidden} LIMIT 1")
    cols = {r[0] for r in rows(db, "SELECT column_name FROM information_schema.columns WHERE table_name = 'v_ai_payouts'")}
    assert not cols & {"beneficiary_name", "phone_e164", "beneficiary_id"}
    settings = one(db, "SELECT setconfig::text FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole "
                       "WHERE r.rolname = 'ai_reader' AND s.setdatabase = 0")
    assert "default_transaction_read_only=on" in settings and "statement_timeout=5s" in settings


def test_backend_cannot_delete_or_rewrite_journals(db):
    assert _as(db, "app_backend", "SELECT COUNT(*) FROM payouts")[0][0] > 0
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        _as(db, "app_backend", "DELETE FROM batches")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        _as(db, "app_backend", "UPDATE audit_log SET action = 'x'")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        _as(db, "app_backend", "DROP TABLE payouts")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        _as(db, "powerbi_reader", "SELECT 1 FROM v_payouts_enriched")
    assert _as(db, "powerbi_reader", "SELECT COUNT(*) FROM v_donor_report")[0][0] > 0


def test_ai_views_are_described(db):
    missing = rows(db, "SELECT c.relname FROM pg_class c WHERE c.relkind = 'v' AND c.relname IN "
                       "('v_ai_payouts', 'v_kpis', 'v_monthly', 'v_corridors', 'v_envelope_balances', 'v_ai_invoices') "
                       "AND obj_description(c.oid) IS NULL")
    assert missing == []


def test_backend_contract_runs_with_app_backend_rights(empty_db):
    """Le parcours décrit dans docs/dictionnaire_donnees.md fonctionne avec les seuls droits de app_backend."""
    with psycopg.connect(empty_db, autocommit=True) as c:
        c.execute("SET ROLE app_backend")
        user = "10000000-0000-0000-0000-000000000001"
        c.execute("INSERT INTO beneficiaries (owner_id, full_name, country, currency, phone_e164, bank_code) "
                  "VALUES (%s, 'Kofi B.', 'GH', 'GHS', '+233241234567', 'MTN') "
                  "ON CONFLICT (owner_id, country, phone_e164) DO UPDATE SET full_name = EXCLUDED.full_name", (user,))
        c.execute("UPDATE batches SET status = 'running', launched_at = now(), launched_by = %s", (user,))
        c.execute("INSERT INTO audit_log (user_id, action, entity, entity_id) "
                  "VALUES (%s, 'batch_launched', 'batches', '30000000-0000-0000-0000-000000000001')", (user,))
        ref = c.execute("SELECT start_payout_attempt(%s, %s)", (PAYOUT, user)).fetchone()[0]
        c.execute("UPDATE payout_attempts SET source_minor = 3300000, fee_source_minor = 330000, exchange_rate = 15.2, "
                  "bitnob_quote_id = 'q1', quote_expires_at = now() + interval '10 min' WHERE reference = %s", (ref,))
        c.execute("UPDATE payout_attempts SET bitnob_payout_id = 'p1' WHERE reference = %s", (ref,))
        assert c.execute("SELECT apply_payout_event(%s, 'initialized', now(), 'api')", (ref,)).fetchone()[0] == "applied"
        assert c.execute("SELECT apply_payout_event(%s, 'pending', now(), 'api')", (ref,)).fetchone()[0] == "applied"
        c.execute("INSERT INTO webhook_events (event_id, event_type, reference, payload, signature_valid) "
                  "VALUES ('e1', 'payouts.withdrawal.success', %s, '{\"data\": {\"settlement_amount\": \"500\"}}', TRUE) "
                  "ON CONFLICT (event_id) DO NOTHING", (ref,))
        assert c.execute("SELECT apply_payout_event(%s, 'completed', now(), 'webhook', 'e1')", (ref,)).fetchone()[0] == "applied"
        c.execute("UPDATE webhook_events SET processed_at = now() WHERE event_id = 'e1'")
        c.execute("UPDATE batches SET status = 'completed', finished_at = now()")
        env = "50000000-0000-0000-0000-000000000001"
        assert c.execute("SELECT reload_envelope(%s, date_trunc('month', now())::date, 'F1')", (env,)).fetchone()[0] == "reloaded"
        assert c.execute("SELECT record_card_transaction('card_1', 'tx1', 'debit', 'success', 2500, now(), 'META ADS')").fetchone()[0] == "recorded"
        c.execute("INSERT INTO card_balance_snapshots (envelope_id, balance_minor) VALUES (%s, 7500)", (env,))
        c.execute("UPDATE envelopes SET status = 'frozen', frozen_at = now(), frozen_reason = 'test' WHERE id = %s", (env,))
        c.execute("INSERT INTO invoices (owner_id, number, customer_name, amount_sats, payment_request, bitnob_invoice_id, expires_at) "
                  "VALUES (%s, 'INV-1', 'C', 1000, 'lnbc10u1px', 'i1', now() + interval '1 h')", (user,))
        assert c.execute("SELECT mark_invoice_paid('i1')").fetchone()[0] == "paid"
        assert c.execute("SELECT expire_invoices()").fetchone()[0] == 0
        c.execute("INSERT INTO ai_query_log (user_id, conversation_id, question) VALUES (%s, gen_random_uuid(), 'Combien ?')", (user,))
        c.execute("UPDATE users SET last_login_at = now() WHERE id = %s", (user,))
        c.execute("RESET ROLE")
        assert c.execute("SELECT check_name FROM v_consistency_checks WHERE violations <> 0").fetchall() == []
