"""Lecture et validation du CSV de bénéficiaires (aucun appel réseau ici)."""
import csv
import io
import re
from decimal import Decimal, InvalidOperation

ALIASES = {
    "name": {"name", "nom", "beneficiary", "beneficiaire", "bénéficiaire", "full_name"},
    "account_number": {"account_number", "account", "compte", "telephone", "téléphone",
                       "phone", "numero", "numéro", "msisdn"},
    "bank_code": {"bank_code", "bank", "banque", "operateur", "opérateur", "operator"},
    "amount": {"amount", "montant"},
    "currency": {"currency", "devise"},
    "country": {"country", "pays"},
    "destination_type": {"destination_type", "type", "canal", "channel"},
}
REQUIRED = {"name", "account_number", "amount", "currency", "country"}
DESTINATIONS = {"bank", "mobile_money", "swift"}
ACCOUNT_RE = re.compile(r"^\+?[A-Za-z0-9]{5,34}$")


def _norm(header: str) -> str:
    return re.sub(r"\s+", "_", header.replace("\ufeff", "").strip().lower())


def parse_csv(text: str) -> list[tuple[int, dict]]:
    """Retourne [(numéro_de_ligne, {colonne_canonique: valeur})]. Gère , et ; (Excel FR)."""
    text = text.replace("\ufeff", "")
    sample = text[:2048]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        header = next(reader)
    except StopIteration:
        raise ValueError("Fichier vide.")
    mapping: dict[int, str] = {}
    for i, h in enumerate(header):
        n = _norm(h)
        for canon, names in ALIASES.items():
            if n in names:
                mapping[i] = canon
    missing = REQUIRED - set(mapping.values())
    if missing:
        raise ValueError("Colonnes manquantes : " + ", ".join(sorted(missing)) +
                         ". Attendues : name, account_number, amount, currency, country "
                         "(+ bank_code, destination_type).")
    rows = []
    for line_no, row in enumerate(reader, start=2):
        if not any(c.strip() for c in row):
            continue
        rows.append((line_no, {mapping[i]: row[i].strip() for i in mapping if i < len(row)}))
    return rows


def _parse_amount(raw: str) -> Decimal:
    s = raw.replace(" ", "").replace("\u00a0", "")
    if "," in s and "." not in s:
        s = s.replace(",", ".")
    elif "," in s:
        s = s.replace(",", "")
    d = Decimal(s)
    if not d.is_finite() or d <= 0:
        raise InvalidOperation
    if d.as_tuple().exponent < -8:
        raise InvalidOperation
    return d


def validate_row(raw: dict, default_dest: str, supported: set[str] | None) -> tuple[dict | None, list[str]]:
    errors: list[str] = []
    name = raw.get("name", "").strip()
    if not name:
        errors.append("nom manquant")

    account = re.sub(r"[\s\-().]", "", raw.get("account_number", ""))
    if not ACCOUNT_RE.match(account):
        errors.append("numéro de compte / téléphone invalide")

    amount = None
    try:
        amount = _parse_amount(raw.get("amount", ""))
    except (InvalidOperation, ValueError):
        errors.append("montant invalide (nombre positif attendu)")

    currency = raw.get("currency", "").strip().upper()
    if not re.fullmatch(r"[A-Z]{3}", currency):
        errors.append("devise invalide (3 lettres, ex. GHS)")

    country = raw.get("country", "").strip().upper()
    if not re.fullmatch(r"[A-Z]{2}", country):
        errors.append("pays invalide (code à 2 lettres, ex. GH)")
    elif supported is not None and country not in supported:
        errors.append(f"pays non supporté par Bitnob ({country})")

    dest = (raw.get("destination_type") or default_dest).strip().lower()
    if dest not in DESTINATIONS:
        errors.append("destination_type invalide (bank, mobile_money ou swift)")
    bank_code = raw.get("bank_code", "").strip() or None
    if dest in {"bank", "mobile_money"} and not bank_code:
        errors.append("bank_code manquant (opérateur ou banque requis)")

    if errors:
        return None, errors
    return {"name": name, "account_number": account, "bank_code": bank_code,
            "destination_type": dest, "country": country, "amount": amount,
            "currency": currency}, []


def validate_rows(rows: list[tuple[int, dict]], default_dest: str, supported: set[str] | None,
                  allow_duplicates: bool, max_rows: int) -> tuple[list[dict], list[dict]]:
    """Retourne (lignes valides, lignes rejetées avec leurs erreurs)."""
    if not rows:
        raise ValueError("Aucune ligne de données.")
    if len(rows) > max_rows:
        raise ValueError(f"Trop de lignes ({len(rows)} > {max_rows}).")
    valid, rejected, seen = [], [], {}
    for line, raw in rows:
        clean, errors = validate_row(raw, default_dest, supported)
        if clean:
            key = (clean["account_number"], clean["country"], clean["amount"], clean["currency"])
            if key in seen and not allow_duplicates:
                errors = [f"doublon de la ligne {seen[key]}"]
                clean = None
            else:
                seen.setdefault(key, line)
        if clean:
            valid.append({**clean, "line": line})
        else:
            rejected.append({"line": line, "errors": errors, "data": raw})
    return valid, rejected
