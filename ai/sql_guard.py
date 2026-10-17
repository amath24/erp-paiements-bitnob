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


def validate_sql_query(query: str) -> tuple[bool, str | None]:
    """
    Garde-fou de securite SQL (P3).
    Garantit que la requete generee par l'IA est strictement en lecture seule (SELECT)
    et cible uniquement les vues ou tables autorisees de l'ERP.
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

    # Verification qu'au moins une table/vue autorisee est presente
    has_allowed_source = any(re.search(rf"\b{src}\b", clean_query, re.IGNORECASE) for src in ALLOWED_SOURCES)
    if not has_allowed_source:
        return False, "La requete ne cible aucune table ou vue analytique autorisee."

    return True, None
