"""Génère les CSV de test (déterministes : même résultat à chaque exécution).

  data/beneficiaires_propre.csv : 12 lignes, toutes valides
  data/livreurs_demo_50.csv      : scénario BulkPay ERP, 50 livreurs (NG, GH, SN), exactement 2 numéros invalides
  data/relais_communautaires_50.csv : scénario ONG, 50 relais avec 7 pièges

Les codes opérateur sont ILLUSTRATIFS : remplacez-les par les vrais codes
renvoyés par GET /api/payouts/banks/{pays}.
"""
from __future__ import annotations

import csv
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
OUT = ROOT / "data"
FIELDS = ["nom", "telephone", "montant", "devise", "pays", "operateur"]

import phonenumbers  # noqa: E402

from role3.fakes import (CCY, NAMES, OPERATORS, RANGES, SN_OPERATOR_WEIGHTS, SN_REGIONS, amount,  # noqa: E402
                         livreurs, phone, sn_names, sn_phone_for, weighted)


def row(rng: random.Random, country: str, name: str) -> dict:
    return {"nom": name, "telephone": phone(rng, country), "montant": str(amount(rng, country)),
            "devise": CCY[country], "pays": country, "operateur": rng.choice(OPERATORS[country])}


def clean_file(rng: random.Random) -> list[dict]:
    rows = []
    for country, n in [("SN", 4), ("NG", 3), ("GH", 3), ("KE", 2)]:
        for name in rng.sample(NAMES[country], n):
            rows.append(row(rng, country, name))
    return rows


def demo_file(rng: random.Random) -> list[dict]:
    """Le CSV du scénario BulkPay ERP : les 50 livreurs (Nigeria, Ghana, Sénégal) des données de démo.

    Exactement deux problèmes, comme dans le document de projet (« deux numéros invalides ») :
      * un numéro sénégalais auquel il manque un chiffre
      * un numéro ghanéen avec une lettre à la place d'un chiffre
    Les 48 autres lignes sont prêtes à être payées.
    """
    rows = []
    for p in livreurs():
        lo, hi, step = RANGES[p["country"]]
        num = p["phone"]
        if rng.random() < 0.4:   # écritures variées, comme dans un vrai fichier Excel
            num = phonenumbers.format_number(phonenumbers.parse(num), phonenumbers.PhoneNumberFormat.INTERNATIONAL)
        rows.append({"nom": p["name"], "telephone": num, "montant": str(rng.randrange(lo, hi + 1, step)),
                     "devise": p["currency"], "pays": p["country"], "operateur": OP_LABEL.get(p["operator"], p["operator"]),
                     "region": p["region"]})
    sn = [i for i, r in enumerate(rows) if r["pays"] == "SN"]
    gh = [i for i, r in enumerate(rows) if r["pays"] == "GH"]
    rows[sn[3]]["telephone"] = rows[sn[3]]["telephone"].replace(" ", "")[:-1]       # il manque un chiffre
    tel = rows[gh[5]]["telephone"].replace(" ", "")
    rows[gh[5]]["telephone"] = tel[:-3] + "O" + tel[-2:]                            # lettre O au lieu du chiffre 0
    rng.shuffle(rows)
    return rows


OP_LABEL = {"WAVE": "Wave", "ORANGE_MONEY": "Orange Money", "FREE_MONEY": "Free Money", "EXPRESSO": "Expresso"}


def ngo_file(rng: random.Random) -> list[dict]:
    """50 relais communautaires d'une ONG au Sénégal, avec 7 pièges.

    Bloquants (4) : numéro invalide, devise EUR, francs CFA avec centimes, opérateur MTN (inexistant au Sénégal).
    À vérifier (4 lignes) : un doublon (2 lignes), un montant aberrant, une région mal orthographiée.
    """
    rows = []
    for name in sn_names(rng, 49):
        op = weighted(rng, SN_OPERATOR_WEIGHTS)
        num = sn_phone_for(rng, op)
        pretty = rng.choice([num, num[4:6] + " " + num[6:9] + " " + num[9:11] + " " + num[11:], num[4:]])
        rows.append({"nom": name, "telephone": pretty, "montant": str(rng.randrange(25_000, 60_001, 2_500)),
                     "devise": "XOF", "pays": "SN", "operateur": OP_LABEL[op],
                     "region": rng.choice(SN_REGIONS)})
    rows[2]["telephone"] = "77 123 45 6"            # BLOQUANT : il manque un chiffre
    rows[6]["devise"] = "EUR"                        # BLOQUANT : mauvaise devise
    rows[11]["montant"] = "40000,50"                 # BLOQUANT : le franc CFA n'a pas de centimes
    rows[15]["operateur"] = "MTN"                    # BLOQUANT : MTN n'opère pas au Sénégal
    rows[20]["montant"] = "450000"                   # À VÉRIFIER : 10 fois la prime habituelle
    rows[27]["region"] = "Kaolak"                    # À VÉRIFIER : faute de frappe
    rows.append(dict(rows[33]))                      # À VÉRIFIER : même relais payé deux fois
    return rows


def write(path: Path, rows: list[dict], fields: list[str] = FIELDS) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    write(OUT / "beneficiaires_propre.csv", clean_file(random.Random(7)))
    write(OUT / "livreurs_demo_50.csv", demo_file(random.Random(2026)), FIELDS + ["region"])
    write(OUT / "relais_communautaires_50.csv", ngo_file(random.Random(221)), FIELDS + ["region"])
    print("Écrit : beneficiaires_propre.csv, livreurs_demo_50.csv, relais_communautaires_50.csv (dossier data)")


if __name__ == "__main__":
    sys.exit(main())
