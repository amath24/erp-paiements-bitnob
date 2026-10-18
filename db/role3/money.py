"""Montants : conversion entre l'affichage (décimal) et le stockage (entier en unités minimales).

Bitnob renvoie ses montants en chaînes décimales ("25.50", "0.003412").
On les convertit IMMÉDIATEMENT en entiers, et on ne fait plus aucun calcul
en float. Exemple : 25,50 GHS -> 2550 (pesewas) ; 15 000 XOF -> 15000.
"""
from __future__ import annotations

import json
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal, InvalidOperation
from functools import lru_cache
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "corridors.json"


class MoneyError(ValueError):
    """Montant illisible, devise inconnue ou précision impossible."""


@lru_cache(maxsize=1)
def load_config(path: str | None = None) -> dict:
    with open(path or CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def exponent(currency: str) -> int:
    try:
        return load_config()["currencies"][currency.upper()]
    except KeyError as exc:
        raise MoneyError(f"Devise inconnue : {currency}") from exc


def parse_decimal(value) -> Decimal:
    """Lit un montant tel qu'un humain l'écrit : '25 000', '25000', '25,50', '1.234,5' non accepté."""
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        raise MoneyError("Montant reçu en float : passez une chaîne ou un Decimal")
    if isinstance(value, int):
        return Decimal(value)
    text = str(value).strip().replace(" ", "").replace(" ", "").replace(" ", "")
    if not text:
        raise MoneyError("Montant vide")
    if text.count(",") == 1 and "." not in text:
        text = text.replace(",", ".")  # virgule décimale française
    try:
        amount = Decimal(text)
    except InvalidOperation as exc:
        raise MoneyError(f"Montant illisible : {value!r}") from exc
    if not amount.is_finite():
        raise MoneyError(f"Montant illisible : {value!r}")
    return amount


def to_minor(value, currency: str, rounding: str | None = None) -> int:
    """Décimal -> entier en unités minimales.

    Par défaut, refuse toute perte de précision (ex. 100,5 XOF).
    rounding='down' ou 'half_up' l'autorise explicitement (cas des réponses Bitnob).
    """
    amount = parse_decimal(value)
    exp = exponent(currency)
    scaled = amount * (Decimal(10) ** exp)
    if scaled != scaled.to_integral_value():
        if rounding is None:
            shown = str(amount).replace(".", ",")
            if exp == 0:
                raise MoneyError(f"{shown} {currency.upper()} : cette devise n'a pas de décimales")
            raise MoneyError(f"{shown} {currency.upper()} : {exp} décimales maximum")
        mode = {"down": ROUND_DOWN, "half_up": ROUND_HALF_UP}[rounding]
        scaled = scaled.quantize(Decimal(1), rounding=mode)
    return int(scaled)


def to_major(minor: int, currency: str) -> Decimal:
    """Entier en unités minimales -> Decimal lisible."""
    return Decimal(minor) / (Decimal(10) ** exponent(currency))


def fmt(minor: int, currency: str) -> str:
    """Affichage à la française : 1 234 567,89 NGN ; 15 000 XOF."""
    exp = exponent(currency)
    major = to_major(minor, currency)
    shown_exp = min(exp, 2) if currency.upper() not in {"BTC"} else exp
    text = f"{major:,.{shown_exp}f}".replace(",", " ").replace(".", ",")
    return f"{text} {currency.upper()}"
