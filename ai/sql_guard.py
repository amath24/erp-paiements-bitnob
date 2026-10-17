import re

# Tables et vues autorisees en lecture seule
ALLOWED_SOURCES = {
    "invoices",
    "settlements",
    "customers",
    "webhook_events",
    "v_kpis",
    "v_transactions_summary",
    "v_payouts_by_month",
}

FORBIDDEN_KEYWORDS = [
    r"\bDROP\b",
    r"\bDELETE\b",
    r"\bUPDATE\b",
    r"\bINSERT\b",
    r"\bALTER\b",
    r"\bTRUNCATE\b",
    r"\bCREATE\b",
    r"\bREPLACE\b",
    r"\bEXEC\b",
    r"\bEXECUTE\b",
    r"\bPRAGMA\b",
    r"\bATTACH\b",
    r"\bDETACH\b",
    r"--",
]


def _extract_from_tables(query: str) -> set[str]:
    """
    Extrait les identifiants de tables/vues apres les mots-cles FROM et JOIN.
    Retourne un ensemble de noms en minuscules.
    Volontairement strict : tout identifiant apres FROM/JOIN non autorise declenche un refus.
    """
    pattern = r"(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)"
    tokens = re.findall(pattern, query, re.IGNORECASE)
    return {t.lower() for t in tokens}


def validate_sql_query(query: str) -> tuple[bool, str | None]:
    """
    Garde-fou de securite SQL (P3).
    Garantit que la requete est strictement SELECT et ne cible QUE les tables autorisees.

    Correction v2 : verifie que TOUTES les tables referencees (FROM/JOIN) sont autorisees.
    L'ancienne version verifiait seulement la presence d'un nom autorise n'importe ou dans
    la requete, permettant : SELECT * FROM sqlite_master WHERE name='invoices'.
    """
    clean_query = query.strip()

    # Doit commencer par SELECT
    if not clean_query.upper().startswith("SELECT"):
        return False, "Seules les requetes SELECT en lecture seule sont autorisees."

    # Interdiction des points-virgules multiples (prevention requetes empilees)
    if clean_query.count(";") > 1 or (";" in clean_query and not clean_query.endswith(";")):
        return False, "Les requetes SQL multiples sont interdites."

    # Verification des mots-cles destructeurs
    for pattern in FORBIDDEN_KEYWORDS:
        if re.search(pattern, clean_query, re.IGNORECASE):
            return False, f"Mot-cle SQL interdit detecte : {pattern}"

    # Extraction des tables/vues referencees dans FROM et JOIN
    referenced = _extract_from_tables(clean_query)
    if not referenced:
        return False, "Aucune table ou vue identifiable (clause FROM manquante ou non reconnue)."

    # TOUTES les tables referencees doivent etre dans ALLOWED_SOURCES
    forbidden_tables = referenced - {s.lower() for s in ALLOWED_SOURCES}
    if forbidden_tables:
        return (
            False,
            f"Tables non autorisees : {', '.join(sorted(forbidden_tables))}. "
            f"Sources permises : {', '.join(sorted(ALLOWED_SOURCES))}.",
        )

    return True, None
