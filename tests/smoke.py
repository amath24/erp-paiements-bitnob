import sys
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

# Smoke tests automatises sans appel reseau (in-memory SQLite + fake Bitnob).
# Lancer : .venv\Scripts\python.exe tests\smoke.py

import hashlib
import hmac
import json
import os
import sqlalchemy
from sqlalchemy import text as sa_text
from sqlalchemy.orm import sessionmaker

# 0. Variables d'env AVANT tout import du projet
# SQLite file memoire partage entre connexions (uri=True requis)
os.environ["BITNOB_CLIENT_ID"]      = "test_client"
os.environ["BITNOB_CLIENT_SECRET"]  = "test_secret"
os.environ["DATABASE_URL"]          = "sqlite+pysqlite:///file:smoketest?mode=memory&cache=shared&uri=true"
os.environ["DEMO_MODE"]             = "true"   # active pour les tests (defaut prod = false)
os.environ["BITNOB_WEBHOOK_SECRET"] = ""

# 1. Monkey-patch bitnob() AVANT tout import FastAPI/services
FAKE_INVOICE = {
    "success": True,
    "data": {
        "id": "fake_bitnob_id_001",
        "request": "lntb1000u1pfakexxxx",
        "expires_at": "2026-10-17T23:59:59Z",
        "status": "pending",
    }
}

async def _fake_bitnob(method, path, body=None):
    return FAKE_INVOICE

import backend.app.bitnob.client as _client_mod
_client_mod.bitnob = _fake_bitnob

# 2. Patcher db.database AVANT l'import de main
import db.database as db_mod
from db.models import Base

_SHARED_DB = "sqlite+pysqlite:///file:smoketest?mode=memory&cache=shared&uri=true"
_mem_engine = sqlalchemy.create_engine(
    _SHARED_DB, connect_args={"check_same_thread": False}
)
_MemSession = sessionmaker(autocommit=False, autoflush=False, bind=_mem_engine)
db_mod.engine = _mem_engine
db_mod.SessionLocal = _MemSession
Base.metadata.create_all(bind=_mem_engine)

# 3. Patch invoice_service APRES db.database
import backend.app.services.invoice_service as _svc_mod
_svc_mod.bitnob = _fake_bitnob

# 4. Import de l'app
from backend.app.main import app

# 5. Override get_db
from fastapi.testclient import TestClient
from db.database import get_db

def _override_get_db():
    db = _MemSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = _override_get_db

client = TestClient(app, raise_server_exceptions=False)

PASS = "OK  "
FAIL = "ECHEC"

def result(label, ok, detail=""):
    tag = PASS if ok else FAIL
    print(f"  [{tag}]  {label}" + (f"  ({detail})" if detail else ""))
    return ok

# --- Tests ---

def test1_create_invoice():
    """T1 : creation facture -> 201 + champs + sandbox=False (Bitnob simule avec succes)"""
    r = client.post("/api/pay/create-invoice",
                    json={"satoshis": 1000, "description": "Test smoke"})
    ok = r.status_code == 201
    body = r.json() if ok else {}
    has_fields = ok and all(k in body for k in ("id", "paymentRequest", "qrCodeUrl"))
    # sandbox doit etre False : le faux bitnob renvoie une reponse success
    sandbox_ok = ok and body.get("sandbox") == False
    # Le montant XOF doit etre 1000 * 0.4 = 400 (pas 5000)
    xof_ok = ok and body.get("amountXof") == 400
    overall = has_fields and sandbox_ok and xof_ok
    return result("T1: POST /api/pay/create-invoice -> 201 + sandbox=False + amountXof=400",
                  overall, f"status={r.status_code} sandbox={body.get('sandbox')} amountXof={body.get('amountXof')}")

def test2_webhook_double_content_type():
    payload = json.dumps({"event": "test.event", "event_id": "evt_ct_001", "data": {}}).encode()
    r = client.post("/webhooks/bitnob", content=payload,
                    headers={"content-type": "application/json, application/json"})
    return result("T2: webhook content-type double -> 200",
                  r.status_code == 200, f"status={r.status_code}")

def test3_webhook_bad_signature():
    from backend.app import config as cfg_mod
    object.__setattr__(cfg_mod.config, "bitnob_webhook_secret", "my_real_secret")
    payload = json.dumps({"event": "test.sig", "event_id": "evt_sig_bad", "data": {}}).encode()
    r = client.post("/webhooks/bitnob", content=payload,
                    headers={"content-type": "application/json",
                             "x-bitnob-signature": "sha256=aaabbbccc000",
                             "x-bitnob-event-id": "evt_sig_bad"})
    ok = r.status_code == 401
    object.__setattr__(cfg_mod.config, "bitnob_webhook_secret", "")
    return result("T3: webhook signature fausse + secret defini -> 401",
                  ok, f"status={r.status_code}")

def test4_webhook_dedup():
    """T4 : meme event_id x2 -> 200+200 ET 1 seul enregistrement en base (commit atomique)"""
    payload = json.dumps({"event": "transfer.success", "event_id": "evt_dedup_007", "data": {}}).encode()
    r1 = client.post("/webhooks/bitnob", content=payload,
                     headers={"content-type": "application/json"})
    r2 = client.post("/webhooks/bitnob", content=payload,
                     headers={"content-type": "application/json"})
    ok_status = r1.status_code == 200 and r2.status_code == 200
    # Verifier qu'un seul enregistrement existe en base (commit atomique)
    from db.models import WebhookEvent
    sess = _MemSession()
    count = sess.query(WebhookEvent).filter(WebhookEvent.event_id == "evt_dedup_007").count()
    sess.close()
    ok_count = count == 1
    return result("T4: meme event_id x2 -> 200+200 ET 1 seul WebhookEvent en base",
                  ok_status and ok_count,
                  f"r1={r1.status_code} r2={r2.status_code} count_in_db={count}")

def test5_demo_pay_disabled():
    from backend.app import config as cfg_mod
    object.__setattr__(cfg_mod.config, "demo_mode", False)
    r = client.post("/api/pay/demo-pay/inv_inexistant")
    ok = r.status_code == 403
    object.__setattr__(cfg_mod.config, "demo_mode", True)
    return result("T5: demo-pay DEMO_MODE=false -> 403", ok, f"status={r.status_code}")

def test6_sql_guard_accept():
    from ai.sql_guard import validate_sql_query
    q = "SELECT SUM(amount_sat) FROM invoices WHERE created_at >= '2026-10-01'"
    ok, err = validate_sql_query(q)
    return result("T6: sql_guard accepte SELECT...WHERE created_at >= '2026-10-01'",
                  ok, f"err={err}")

def test7_sql_guard_refuse():
    from ai.sql_guard import validate_sql_query
    cases = [
        ("DROP TABLE invoices",                                              False, "DDL DROP"),
        ("SELECT 1",                                                         False, "FROM manquant"),
        ("DELETE FROM invoices",                                             False, "DELETE"),
        ("/* x */ SELECT * FROM invoices",                                   False, "ne commence pas par SELECT"),
        ("SELECT * FROM sqlite_master",                                      False, "table non autorisee"),
        ("SELECT * FROM unknown_table",                                      False, "table non autorisee"),
        ("SELECT * FROM invoices; SELECT 1",                                 False, "multi-requete ;"),
        # Bypass v1 : nom autorise dans WHERE mais table non autorisee dans FROM
        ("SELECT * FROM sqlite_master WHERE name = 'invoices'",              False, "bypass WHERE sqlite_master"),
        ("SELECT login FROM users WHERE 'invoices' = 'invoices'",            False, "bypass WHERE users"),
        # JOIN non autorise
        ("SELECT * FROM invoices JOIN sqlite_master ON 1=1",                 False, "JOIN non autorise"),
    ]
    all_ok = True
    print("  T7 details:")
    for sql, expected, label in cases:
        valid, _ = validate_sql_query(sql)
        ok = (valid == expected)
        all_ok = all_ok and ok
        tag = "OK  " if ok else "ECHEC"
        print(f"     [{tag}]  [{label}]  sql=[{sql[:55]}]  attendu={expected} obtenu={valid}")
    result("T7: sql_guard refuse toutes les requetes dangereuses + bypass", all_ok)
    return all_ok

if __name__ == "__main__":
    print()
    print("=" * 60)
    print(" SMOKE TESTS -- ERP de Paiements Bitnob & IA")
    print("=" * 60)
    print()
    results = [
        test1_create_invoice(),
        test2_webhook_double_content_type(),
        test3_webhook_bad_signature(),
        test4_webhook_dedup(),
        test5_demo_pay_disabled(),
        test6_sql_guard_accept(),
        test7_sql_guard_refuse(),
    ]
    passed = sum(results)
    total = len(results)
    print()
    print("-" * 60)
    print(f" Resultat : {passed}/{total} passe(s)")
    print("=" * 60)
    print()
    sys.exit(0 if passed == total else 1)
