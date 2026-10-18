r"""Contrôle avant démo : à lancer 6 heures avant la fin du hackathon, puis juste avant de présenter.

    python scripts\check.py          # code de sortie 1 si un contrôle échoue

Vérifie : la base est à jour (migrations), tous les contrôles de cohérence sont à 0,
et liste les problèmes de rapprochement (normaux s'ils ont été plantés par seed.py).
"""
import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
PLANTED = {"STUCK": 2, "AMOUNT_MISMATCH": 1, "UNKNOWN_REFERENCE": 1, "INVALID_SIGNATURE": 1}

dsn = os.environ.get("DATABASE_URL") or sys.exit("Définissez DATABASE_URL")
with psycopg.connect(dsn) as c:
    if c.execute("SELECT to_regclass('public.schema_migrations') IS NULL").fetchone()[0]:
        sys.exit("La base n'est pas à jour : lancez python scripts\\migrate.py")
    applied = {v for (v,) in c.execute("SELECT version FROM schema_migrations")}
    expected = {f.name[:3] for f in (ROOT / "sql" / "migrations").glob("[0-9][0-9][0-9]_*.sql")}
    if expected - applied:
        sys.exit(f"Migrations manquantes : {', '.join(sorted(expected - applied))}. Lancez python scripts\\migrate.py")
    checks = c.execute("SELECT check_name, description, violations FROM v_consistency_checks").fetchall()
    issues = c.execute("SELECT issue_type, COUNT(*) FROM v_reconciliation_issues GROUP BY 1 ORDER BY 1").fetchall()
    simulated = c.execute("SELECT EXISTS (SELECT 1 FROM payouts WHERE is_simulated)").fetchone()[0]

failed = [ch for ch in checks if ch[2]]
print(f"BASE : migrations {', '.join(sorted(applied))} appliquées\n")
print(f"CONTRÔLES DE COHÉRENCE ({len(checks) - len(failed)}/{len(checks)} OK)")
for name, desc, n in checks:
    print(f"  {'OK ' if n == 0 else 'KO '} {desc}" + (f"  ({n} violation(s))" if n else ""))
print("\nRAPPROCHEMENT")
if not issues:
    print("  rien à signaler")
for t, n in issues:
    note = "  (planté exprès par seed.py)" if simulated and PLANTED.get(t) == n else ""
    print(f"  {t} : {n}{note}")
if simulated:
    print("\nATTENTION : la base contient des données SIMULÉES. Dites-le au jury.")
print("\nRÉSULTAT : " + ("tout est cohérent" if not failed else f"{len(failed)} contrôle(s) en échec, ne pas présenter ces chiffres"))
sys.exit(1 if failed else 0)
