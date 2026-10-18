r"""Met la base à jour, qu'elle soit vide ou déjà créée (v1, v2).

    python scripts\migrate.py            # applique ce qui manque
    python scripts\migrate.py --status   # affiche ce qui est appliqué, sans rien changer

Fonctionnement :
  1. sql/migrations/NNN_*.sql : appliqués UNE fois, dans l'ordre, chacun dans une transaction.
     Ils sont notés dans la table schema_migrations avec une empreinte du fichier.
     Un fichier déjà appliqué puis modifié est refusé : on crée un nouveau fichier à la place.
  2. sql/views.sql, sql/security.sql, sql/comments.sql : rejoués à chaque fois
     (vues, droits et descriptions se reconstruisent sans toucher aux données).

Si une étape échoue, sa transaction est annulée : la base reste dans l'état précédent.
Faites quand même une sauvegarde avant une migration sur une base qui contient des données réelles.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "sql" / "migrations"
REPEATABLE = ["views.sql", "security.sql", "comments.sql"]
LOCK_ID = 7_250_003  # verrou : deux personnes ne peuvent pas migrer en même temps


def read_sql(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


def checksum(path: Path) -> str:
    # fins de ligne normalisées : le même fichier sous Windows et Linux a la même empreinte
    return hashlib.sha256(read_sql(path).encode("utf-8")).hexdigest()


def migration_files() -> list[Path]:
    files = sorted(MIGRATIONS.glob("[0-9][0-9][0-9]_*.sql"))
    versions = [f.name[:3] for f in files]
    if len(versions) != len(set(versions)):
        sys.exit("ERREUR : deux fichiers de migration ont le même numéro")
    return files


def ensure_table(conn: psycopg.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            checksum    TEXT NOT NULL,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )""")


def applied(conn: psycopg.Connection) -> dict[str, tuple[str, str]]:
    return {v: (n, c) for v, n, c in conn.execute("SELECT version, name, checksum FROM schema_migrations")}


def table_exists(conn: psycopg.Connection, name: str) -> bool:
    return conn.execute("SELECT to_regclass(%s) IS NOT NULL", (f"public.{name}",)).fetchone()[0]


def run(dsn: str, status_only: bool = False, quiet: bool = False) -> int:
    say = (lambda *a: None) if quiet else print
    files = migration_files()
    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            conn.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_ID,))
            ensure_table(conn)
            done = applied(conn)
            # Base créée avant la v3 (sans schema_migrations) : le schéma v1 est déjà là
            if not done and table_exists(conn, "payouts"):
                first = files[0]
                conn.execute("INSERT INTO schema_migrations (version, name, checksum) VALUES (%s, %s, %s)",
                             (first.name[:3], first.name, checksum(first)))
                say(f"Base existante détectée : {first.name} noté comme déjà appliqué")
                done = applied(conn)

        if status_only:
            for f in files:
                v = f.name[:3]
                if v not in done:
                    state = "à appliquer"
                elif done[v][1] != checksum(f):
                    state = "MODIFIÉ APRÈS APPLICATION"
                else:
                    state = "appliqué"
                say(f"  {f.name:<32} {state}")
            return 0

        for f in files:
            v = f.name[:3]
            if v in done:
                if done[v][1] != checksum(f):
                    say(f"ERREUR : {f.name} a été modifié après avoir été appliqué.\n"
                        f"  Remettez le fichier d'origine et écrivez vos changements dans un nouveau fichier "
                        f"({int(v) + 1:03d}_...).")
                    return 1
                continue
            with conn.transaction():
                conn.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_ID,))
                conn.execute(read_sql(f))
                conn.execute("INSERT INTO schema_migrations (version, name, checksum) VALUES (%s, %s, %s)",
                             (v, f.name, checksum(f)))
            say(f"OK  migration {f.name}")

        for name in REPEATABLE:
            with conn.transaction():
                conn.execute(read_sql(ROOT / "sql" / name))
            say(f"OK  {name}")
    say("Base à jour.")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL"))
    ap.add_argument("--status", action="store_true", help="afficher l'état sans rien modifier")
    args = ap.parse_args()
    if not args.dsn:
        sys.exit("DATABASE_URL non défini (voir README)")
    try:
        sys.exit(run(args.dsn, status_only=args.status))
    except psycopg.Error as e:
        print(f"ÉCHEC : {e}\nRien n'a été modifié par l'étape en cours.")
        sys.exit(1)


if __name__ == "__main__":
    main()
