r"""Active les comptes PostgreSQL de l'équipe et leur donne un mot de passe neuf.

    python scripts\create_db_users.py                  # les trois comptes
    python scripts\create_db_users.py --role ai_reader # un seul (par exemple après une fuite)

À lancer par la Personne 2 (base de données), APRÈS scripts\migrate.py.
Affiche une fois l'adresse de connexion de chaque compte : la donner EN PRIVÉ
à la personne concernée (jamais dans le groupe, jamais sur GitHub).

    app_backend     -> Personne 1 (backend), dans son fichier .env
    ai_reader       -> Personne 3 (assistant IA), dans son fichier .env
    powerbi_reader  -> Power BI / tableau de bord en lecture seule

Relancer le script change le mot de passe : l'ancien ne marche plus.
"""
from __future__ import annotations

import argparse
import os
import secrets
import string
import sys
from urllib.parse import quote

import psycopg
from psycopg import conninfo, sql

ROLES = {"app_backend": "Personne 1 (backend)", "ai_reader": "Personne 3 (assistant IA)",
         "powerbi_reader": "Power BI (lecture seule)"}
ALPHABET = string.ascii_letters + string.digits   # pas de @ : le mot de passe passe tel quel dans l'adresse


def new_password(n: int = 28) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(n))


def login_name(role: str, owner_user: str, host: str) -> str:
    # Pooler Supabase : l'utilisateur s'écrit role.identifiant_du_projet (comme postgres.xxxx)
    if "pooler.supabase.com" in host and "." in owner_user:
        return f"{role}.{owner_user.split('.', 1)[1]}"
    return role


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL"))
    ap.add_argument("--role", choices=sorted(ROLES), action="append", help="compte à (ré)initialiser")
    args = ap.parse_args()
    if not args.dsn:
        sys.exit("DATABASE_URL non défini (voir README)")
    roles = args.role or list(ROLES)
    info = conninfo.conninfo_to_dict(args.dsn)
    host, port, db = info.get("host", "localhost"), info.get("port", "5432"), info.get("dbname", "postgres")

    with psycopg.connect(args.dsn, autocommit=True) as conn:
        existing = {r for (r,) in conn.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", (roles,))}
        missing = [r for r in roles if r not in existing]
        if missing:
            sys.exit(f"Comptes absents : {', '.join(missing)}. Lancez d'abord : python scripts\\migrate.py")
        lines = []
        for role in roles:
            pw = new_password()
            conn.execute(sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD {}").format(sql.Identifier(role), sql.Literal(pw)))
            user = login_name(role, info.get("user", ""), host)
            ssl = "" if host in ("localhost", "127.0.0.1") else "?sslmode=require"   # connexion chiffrée hors poste local
            dsn = f"postgresql://{quote(user)}:{pw}@{host}:{port}/{db}{ssl}"
            lines.append((role, dsn))

    print("Comptes activés. Chaque adresse ne s'affiche qu'ici : copiez-la puis fermez ce terminal.\n")
    for role, dsn in lines:
        print(f"[{role}] pour {ROLES[role]}\n  DATABASE_URL={dsn}\n")
    print("À transmettre EN PRIVÉ. En cas de fuite : relancez ce script avec --role <compte>.")


if __name__ == "__main__":
    main()
