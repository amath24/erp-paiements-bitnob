"""Les montants des cartes sont en micro-unités : 1 USD = 1 000 000."""
from decimal import ROUND_HALF_UP, Decimal

MICRO = Decimal(1_000_000)


def usd_to_micro(value) -> int:
    return int((Decimal(str(value)) * MICRO).to_integral_value(ROUND_HALF_UP))


def micro_to_usd(value) -> float:
    return float(Decimal(str(value)) / MICRO)
