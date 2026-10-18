import pytest
from ai.sql_guard import validate_sql_query
from ai.agent import ask_erp_ai


def test_sql_guard_valid_queries():
    valid, err = validate_sql_query("SELECT * FROM batches LIMIT 10")
    assert valid is True
    assert err is None

    valid, err = validate_sql_query("SELECT reference, amount, currency, status FROM payouts WHERE status = 'FAILED' LIMIT 20")
    assert valid is True
    assert err is None

    valid, err = validate_sql_query("SELECT b.name, p.amount FROM batches b JOIN payouts p ON b.id = p.batch_id LIMIT 50")
    assert valid is True
    assert err is None


def test_sql_guard_blocks_destructive_keywords():
    for dangerous in [
        "DROP TABLE batches",
        "DELETE FROM payouts",
        "UPDATE batches SET status = 'FAILED'",
        "INSERT INTO batches (name) VALUES ('hack')",
        "ALTER TABLE payouts ADD COLUMN hacked text",
    ]:
        valid, err = validate_sql_query(dangerous)
        assert valid is False, f"Expected {dangerous} to be rejected"


def test_sql_guard_blocks_unauthorized_tables():
    valid, err = validate_sql_query("SELECT * FROM sqlite_master")
    assert valid is False
    assert "sqlite_master" in err

    valid, err = validate_sql_query("SELECT * FROM users")
    assert valid is False

    # Protection contre le bypass par jointure virgule
    valid, err = validate_sql_query("SELECT * FROM batches, sqlite_master")
    assert valid is False
    assert "sqlite_master" in err


def test_sql_guard_blocks_stacked_queries():
    valid, err = validate_sql_query("SELECT * FROM batches; DROP TABLE payouts;")
    assert valid is False


def test_ask_erp_ai_structure():
    res = ask_erp_ai("Donne-moi les paiements qui ont echoue")
    assert isinstance(res, dict)
    assert "answer" in res
    assert "sql" in res
    assert "data" in res
    assert res.get("error") is None
    assert "payouts" in res["sql"].lower()
