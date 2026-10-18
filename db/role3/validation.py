"""Validation d'un fichier de bénéficiaires (CSV BulkPay).

Chaque ligne reçoit un statut :
  * ok        : prête à être payée
  * warning   : payable, mais un humain doit regarder (doublon, montant inhabituel...)
  * error     : bloquée, ne sera PAS envoyée à Bitnob

Usage :
    from role3.validation import validate_csv
    report = validate_csv("data/livreurs_demo_50.csv")
    print(report.summary())
"""
from __future__ import annotations

import csv
import io
import statistics
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

import phonenumbers

from .money import MoneyError, fmt, load_config, parse_decimal, to_minor

REQUIRED = ["nom", "telephone", "montant", "devise", "pays"]
OPTIONAL = ["operateur", "region", "reference"]

# Noms de colonnes acceptés -> nom canonique
ALIASES = {
    "nom": "nom", "name": "nom", "beneficiaire": "nom", "full_name": "nom", "nom_complet": "nom",
    "telephone": "telephone", "tel": "telephone", "phone": "telephone", "numero": "telephone",
    "montant": "montant", "amount": "montant",
    "devise": "devise", "currency": "devise", "monnaie": "devise",
    "pays": "pays", "country": "pays",
    "operateur": "operateur", "bank_code": "operateur", "reseau": "operateur",
    "reference": "reference", "ref": "reference",
    "region": "region", "localite": "region", "zone": "region",
}


def _plain(text: str) -> str:
    """Minuscules sans accents ni espaces superflus : 'Thiès ' -> 'thies'."""
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return " ".join(t.lower().replace("_", " ").replace("-", " ").split())


def normalize_operator(value: str, corridor: dict) -> str | None:
    """'Orange Money', 'OM', 'orange' -> 'ORANGE_MONEY'. None si inconnu."""
    ops = corridor.get("operators") or {}
    key = _plain(value)
    for code, op in ops.items():
        names = {_plain(code), _plain(op["name"])} | {_plain(a) for a in op.get("aliases", [])}
        if key in names:
            return code
    return None


def normalize_region(value: str, corridor: dict) -> str | None:
    """'thies', 'THIES', 'Thiès' -> 'Thiès'. None si inconnue."""
    for reg in corridor.get("regions") or []:
        if _plain(reg) == _plain(value):
            return reg
    return None


def _canon(header: str) -> str:
    text = unicodedata.normalize("NFKD", header).encode("ascii", "ignore").decode()
    text = text.strip().lower().replace(" ", "_").replace("-", "_")
    return ALIASES.get(text, text)


@dataclass
class Issue:
    code: str
    severity: str          # 'warning' ou 'error'
    message: str


@dataclass
class RowResult:
    line: int                              # numéro de ligne dans le fichier (en-tête = 1)
    raw: dict
    name: str = ""
    phone_e164: str | None = None
    country: str | None = None
    currency: str | None = None
    amount_minor: int | None = None
    bank_code: str | None = None          # code opérateur normalisé (WAVE, ORANGE_MONEY...)
    region: str | None = None
    issues: list[Issue] = field(default_factory=list)

    @property
    def status(self) -> str:
        if any(i.severity == "error" for i in self.issues):
            return "error"
        if self.issues:
            return "warning"
        return "ok"

    def add(self, code: str, severity: str, message: str) -> None:
        self.issues.append(Issue(code, severity, message))


@dataclass
class ValidationReport:
    rows: list[RowResult]
    file_errors: list[str] = field(default_factory=list)
    notices: list[str] = field(default_factory=list)   # remarques sur le lot entier

    @property
    def payable(self) -> list[RowResult]:
        return [r for r in self.rows if r.status != "error"]

    @property
    def blocked(self) -> list[RowResult]:
        return [r for r in self.rows if r.status == "error"]

    def totals_by_currency(self, only_payable: bool = True) -> dict[str, int]:
        totals: dict[str, int] = defaultdict(int)
        for r in (self.payable if only_payable else self.rows):
            if r.currency and r.amount_minor is not None:
                totals[r.currency] += r.amount_minor
        return dict(totals)

    def counts(self) -> dict[str, int]:
        c = {"ok": 0, "warning": 0, "error": 0}
        for r in self.rows:
            c[r.status] += 1
        return c

    def summary(self) -> str:
        if self.file_errors:
            return "Fichier refusé :\n- " + "\n- ".join(self.file_errors)
        c = self.counts()
        lines = [
            f"{len(self.rows)} lignes : {c['ok']} prêtes, {c['warning']} à vérifier, {c['error']} bloquées",
            "Total payable : " + (", ".join(fmt(v, k) for k, v in sorted(self.totals_by_currency().items())) or "0"),
            "Pays : " + ", ".join(sorted({r.country for r in self.payable if r.country})),
        ]
        lines += [f"  Remarque : {n}" for n in self.notices]
        for r in self.rows:
            for i in r.issues:
                tag = "BLOQUANT" if i.severity == "error" else "à vérifier"
                lines.append(f"  ligne {r.line} [{tag}] {r.name or '?'} : {i.message}")
        return "\n".join(lines)

    def to_records(self) -> list[dict]:
        """Format tabulaire pour le dashboard ou l'API."""
        return [{
            "ligne": r.line,
            "statut": r.status,
            "nom": r.name,
            "telephone": r.phone_e164 or r.raw.get("telephone", ""),
            "pays": r.country,
            "operateur": r.bank_code or r.raw.get("operateur", ""),
            "region": r.region or r.raw.get("region", ""),
            "devise": r.currency,
            "montant": fmt(r.amount_minor, r.currency) if r.amount_minor is not None and r.currency else r.raw.get("montant", ""),
            "montant_minor": r.amount_minor,
            "problemes": " ; ".join(i.message for i in r.issues),
            "codes": ",".join(i.code for i in r.issues),
        } for r in self.rows]


# ---------------------------------------------------------------------------
# Règles ligne par ligne
# ---------------------------------------------------------------------------

def _validate_row(line: int, raw: dict, cfg: dict) -> RowResult:
    r = RowResult(line=line, raw=raw)
    corridors = cfg["corridors"]
    rules = cfg["rules"]

    # Nom
    r.name = (raw.get("nom") or "").strip()
    if not r.name:
        r.add("NAME_MISSING", "error", "Nom du bénéficiaire manquant")

    # Pays
    country = (raw.get("pays") or "").strip().upper()
    corridor = corridors.get(country)
    if not country:
        r.add("COUNTRY_MISSING", "error", "Pays manquant")
    elif corridor is None:
        r.add("COUNTRY_UNSUPPORTED", "error", f"Pays {country} non couvert par nos corridors")
    else:
        r.country = country
        if not corridor.get("verified") and rules.get("unverified_corridor_is_error"):
            r.add("CORRIDOR_UNVERIFIED", "error",
                  f"Corridor {country} pas encore confirmé en sandbox Bitnob")

    # Devise
    currency = (raw.get("devise") or "").strip().upper()
    if not currency:
        r.add("CURRENCY_MISSING", "error", "Devise manquante")
    elif corridor and currency != corridor["currency"]:
        r.add("CURRENCY_MISMATCH", "error",
              f"Devise {currency} incohérente avec le pays {country} (attendu {corridor['currency']})")
    elif currency not in cfg["currencies"]:
        r.add("CURRENCY_UNKNOWN", "error", f"Devise {currency} inconnue")
    else:
        r.currency = currency

    # Montant
    raw_amount = raw.get("montant")
    try:
        amount = parse_decimal(raw_amount)
        if amount <= 0:
            r.add("AMOUNT_NOT_POSITIVE", "error", f"Montant {raw_amount} doit être positif")
        elif r.currency:
            try:
                r.amount_minor = to_minor(amount, r.currency)
            except MoneyError as exc:
                r.add("AMOUNT_PRECISION", "error", str(exc))
            if r.amount_minor is not None and corridor:
                lo = to_minor(corridor["min_major"], r.currency)
                hi = to_minor(corridor["max_major"], r.currency)
                if r.amount_minor < lo:
                    r.add("AMOUNT_BELOW_MIN", "error", f"Montant sous le minimum du corridor ({fmt(lo, r.currency)})")
                elif r.amount_minor > hi:
                    r.add("AMOUNT_ABOVE_MAX", "error", f"Montant au-dessus du maximum du corridor ({fmt(hi, r.currency)})")
    except MoneyError as exc:
        r.add("AMOUNT_INVALID", "error", str(exc))

    # Téléphone (format E.164, cohérent avec le pays)
    raw_phone = (raw.get("telephone") or "").strip()
    if not raw_phone:
        r.add("PHONE_MISSING", "error", "Numéro de téléphone manquant")
    elif r.country:
        try:
            num = phonenumbers.parse(raw_phone, r.country)
            if not phonenumbers.is_valid_number(num):
                r.add("PHONE_INVALID", "error", f"Numéro {raw_phone} invalide pour {r.country}")
            else:
                region = phonenumbers.region_code_for_number(num)
                if region != r.country:
                    r.add("PHONE_COUNTRY_MISMATCH", "error",
                          f"Numéro {raw_phone} appartient à {region}, pas à {r.country}")
                else:
                    r.phone_e164 = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
        except phonenumbers.NumberParseException:
            r.add("PHONE_INVALID", "error", f"Numéro {raw_phone} illisible")

    # Opérateur (obligatoire pour le mobile money)
    raw_op = (raw.get("operateur") or "").strip()
    ops = (corridor or {}).get("operators")
    if r.country and ops:
        if not raw_op:
            r.add("OPERATOR_MISSING", "error",
                  "Opérateur manquant (" + ", ".join(o["name"] for o in ops.values()) + ")")
        else:
            code = normalize_operator(raw_op, corridor)
            if code is None:
                r.add("OPERATOR_UNSUPPORTED", "error",
                      f"Opérateur « {raw_op} » non pris en charge en {corridor['name']} "
                      "(" + ", ".join(o["name"] for o in ops.values()) + ")")
            else:
                r.bank_code = code
    elif r.country:
        r.bank_code = raw_op or None
        if not raw_op:
            r.add("OPERATOR_MISSING", "warning",
                  "Banque non renseignée : à compléter via GET /api/payouts/banks/{pays}")

    # Région (si le pays a une liste de régions)
    raw_reg = (raw.get("region") or "").strip()
    if raw_reg and corridor and corridor.get("regions"):
        reg = normalize_region(raw_reg, corridor)
        if reg is None:
            r.add("REGION_UNKNOWN", "warning", f"Région « {raw_reg} » inconnue : vérifier l'orthographe")
        else:
            r.region = reg
    elif raw_reg:
        r.region = raw_reg
    return r


# ---------------------------------------------------------------------------
# Règles sur le lot entier
# ---------------------------------------------------------------------------

def _batch_rules(rows: list[RowResult], cfg: dict) -> None:
    rules = cfg["rules"]

    # Doublons de téléphone
    by_phone: dict[str, list[RowResult]] = defaultdict(list)
    for r in rows:
        if r.phone_e164:
            by_phone[r.phone_e164].append(r)
    for phone, group in by_phone.items():
        if len(group) < 2:
            continue
        lines = ", ".join(str(g.line) for g in group)
        same_amount = len({g.amount_minor for g in group}) == 1
        for g in group:
            if same_amount:
                g.add("DUPLICATE_PAYMENT", "warning",
                      f"Doublon probable : même numéro et même montant (lignes {lines})")
            else:
                g.add("DUPLICATE_PHONE", "warning", f"Même numéro sur plusieurs lignes ({lines})")

    # Montants aberrants, par devise (on ne compare jamais deux devises)
    by_ccy: dict[str, list[RowResult]] = defaultdict(list)
    for r in rows:
        if r.currency and r.amount_minor is not None:
            by_ccy[r.currency].append(r)
    factor = Decimal(str(rules["outlier_factor"]))
    for ccy, group in by_ccy.items():
        if len(group) < rules["outlier_min_group_size"]:
            continue
        median = Decimal(statistics.median(g.amount_minor for g in group))
        for g in group:
            if median > 0 and Decimal(g.amount_minor) > factor * median:
                g.add("AMOUNT_OUTLIER", "warning",
                      f"Montant {fmt(g.amount_minor, ccy)} > {rules['outlier_factor']} × la médiane du lot "
                      f"({fmt(int(median), ccy)})")


# ---------------------------------------------------------------------------
# Points d'entrée
# ---------------------------------------------------------------------------

def validate_records(records: list[dict], cfg: dict | None = None) -> ValidationReport:
    cfg = cfg or load_config()
    rows = [_validate_row(i + 2, rec, cfg) for i, rec in enumerate(records)]
    _batch_rules(rows, cfg)
    unverified = sorted({r.country for r in rows
                         if r.country and not cfg["corridors"][r.country].get("verified")})
    notices = []
    if unverified and not cfg["rules"].get("unverified_corridor_is_error"):
        notices.append("Pays documentés par Bitnob mais pas encore testés dans notre sandbox : "
                       + ", ".join(unverified) + " (à vérifier avec GET /api/payouts/supported-countries)")
    return ValidationReport(rows=rows, notices=notices)


def validate_text(text: str, cfg: dict | None = None) -> ValidationReport:
    text = text.lstrip("﻿")
    sample = text[:2048]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        return ValidationReport(rows=[], file_errors=["Fichier vide ou sans en-tête"])
    mapping = {h: _canon(h) for h in reader.fieldnames}
    missing = [c for c in REQUIRED if c not in mapping.values()]
    if missing:
        return ValidationReport(rows=[], file_errors=[f"Colonnes manquantes : {', '.join(missing)}"])
    records = []
    for row in reader:
        rec = {mapping[k]: (v or "") for k, v in row.items() if k in mapping}
        if not any(str(v).strip() for v in rec.values()):
            continue  # ligne vide
        records.append(rec)
    if not records:
        return ValidationReport(rows=[], file_errors=["Aucune ligne de données"])
    return validate_records(records, cfg)


def validate_csv(path: str | Path, cfg: dict | None = None) -> ValidationReport:
    return validate_text(Path(path).read_text(encoding="utf-8-sig"), cfg)


def check_funding(total_debit_minor: int, available_minor: int) -> Issue | None:
    """Règle sur le lot entier : le solde doit couvrir le total (montants + frais) AVANT le lancement."""
    if total_debit_minor > available_minor:
        return Issue("INSUFFICIENT_BALANCE", "error",
                     "Solde insuffisant pour couvrir le lot : lancement bloqué")
    return None


if __name__ == "__main__":
    import sys
    print(validate_csv(sys.argv[1]).summary())
