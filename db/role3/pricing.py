"""Moteur de calcul : cotations Bitnob, frais, montant net, risques d'expiration.

Principe : SEUL ce module produit des montants. L'assistant IA, le frontend et
le dashboard affichent ce qu'il calcule, ils ne recalculent rien.

Point NON confirmé par la doc Bitnob (à tester en sandbox, jour 1) :
  les `fees` sont-ils inclus dans `amount` ou ajoutés en plus ?
  -> FEES_INCLUDED_IN_AMOUNT = False par défaut : c'est l'hypothèse prudente
     (on bloque un lot si le solde ne couvre pas montant + frais).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import ROUND_UP, Decimal

from .money import exponent, fmt, parse_decimal, to_major, to_minor

FEES_INCLUDED_IN_AMOUNT = False
DEFAULT_SAFETY_MARGIN = timedelta(seconds=30)


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@dataclass(frozen=True)
class Quote:
    """Cotation Bitnob convertie en entiers. Créée depuis la réponse de POST /api/payouts/quotes."""
    bitnob_id: str
    quote_id: str
    reference: str
    from_asset: str
    to_currency: str
    source_minor: int          # `amount`, en unités minimales de from_asset
    fee_minor: int             # `fees`, en unités minimales de from_asset
    settlement_minor: int      # `settlement_amount`, ce que reçoit le bénéficiaire
    rate: Decimal | None       # `exchange_rate.rate`
    expires_at: datetime | None
    country: str | None = None

    @classmethod
    def from_bitnob(cls, resp: dict) -> "Quote":
        data = resp.get("data", resp)
        data = data.get("payout", data)
        from_asset = data["from_asset"].upper()
        to_ccy = data["to_currency"].upper()
        rate = (data.get("exchange_rate") or {}).get("rate")
        return cls(
            bitnob_id=data.get("id", ""),
            quote_id=data["quote_id"],
            reference=data.get("reference", ""),
            from_asset=from_asset,
            to_currency=to_ccy,
            source_minor=to_minor(data["amount"], from_asset, rounding="half_up"),
            fee_minor=to_minor(data.get("fees") or "0", from_asset, rounding="half_up"),
            # on arrondit vers le bas : on ne promet jamais plus que ce qui sera reçu
            settlement_minor=to_minor(data["settlement_amount"], to_ccy, rounding="down"),
            rate=parse_decimal(rate) if rate not in (None, "") else None,
            expires_at=_parse_ts(data.get("expires_at")),
            country=data.get("country"),
        )

    # -- coût ----------------------------------------------------------------
    @property
    def total_debit_minor(self) -> int:
        """Ce qui sort réellement de notre solde."""
        return self.source_minor if FEES_INCLUDED_IN_AMOUNT else self.source_minor + self.fee_minor

    @property
    def effective_rate(self) -> Decimal:
        """Unités de devise reçues par unité d'actif débitée (frais compris)."""
        return (to_major(self.settlement_minor, self.to_currency)
                / to_major(self.total_debit_minor, self.from_asset)).quantize(Decimal("0.0001"))

    @property
    def fee_share(self) -> Decimal:
        """Part des frais dans le total débité (0,012 = 1,2 %)."""
        return (Decimal(self.fee_minor) / Decimal(self.total_debit_minor)).quantize(Decimal("0.0001"))

    # -- expiration ----------------------------------------------------------
    def seconds_left(self, now: datetime | None = None) -> float | None:
        if self.expires_at is None:
            return None
        now = now or datetime.now(timezone.utc)
        return (self.expires_at - now).total_seconds()

    def is_usable(self, now: datetime | None = None, margin: timedelta = DEFAULT_SAFETY_MARGIN) -> bool:
        """False si la cotation expire dans moins de `margin` : il faut en redemander une."""
        left = self.seconds_left(now)
        return left is None or left > margin.total_seconds()

    # -- affichage (frontend, assistant IA) ----------------------------------
    def breakdown(self) -> dict:
        """Détail prêt à afficher. L'assistant IA reformule ces chiffres, il ne les change pas."""
        return {
            "beneficiaire_recoit": fmt(self.settlement_minor, self.to_currency),
            "montant_debite": fmt(self.source_minor, self.from_asset),
            "frais": fmt(self.fee_minor, self.from_asset),
            "total_debite": fmt(self.total_debit_minor, self.from_asset),
            "taux_annonce": str(self.rate) if self.rate is not None else None,
            "taux_effectif_frais_compris": str(self.effective_rate),
            "part_des_frais": f"{(self.fee_share * 100):.2f} %".replace(".", ","),
            "expire_le": self.expires_at.isoformat() if self.expires_at else None,
            "hypothese_frais": "frais inclus" if FEES_INCLUDED_IN_AMOUNT else "frais ajoutés au montant (à confirmer en sandbox)",
        }


@dataclass(frozen=True)
class BatchCost:
    n: int
    from_asset: str
    total_source_minor: int
    total_fee_minor: int
    total_debit_minor: int
    settlement_by_currency: dict[str, int]
    first_expiry: datetime | None

    def lines(self) -> list[str]:
        out = [
            f"{self.n} payouts",
            f"Total débité : {fmt(self.total_debit_minor, self.from_asset)} "
            f"(dont frais {fmt(self.total_fee_minor, self.from_asset)})",
        ]
        out += [f"Reçu en {ccy} : {fmt(v, ccy)}" for ccy, v in sorted(self.settlement_by_currency.items())]
        return out


def batch_cost(quotes: list[Quote]) -> BatchCost:
    """Récapitulatif d'un lot avant lancement (page « récap » de BulkPay)."""
    if not quotes:
        raise ValueError("Lot vide")
    assets = {q.from_asset for q in quotes}
    if len(assets) != 1:
        raise ValueError(f"Un lot doit être débité dans un seul actif, reçu : {sorted(assets)}")
    by_ccy: dict[str, int] = {}
    for q in quotes:
        by_ccy[q.to_currency] = by_ccy.get(q.to_currency, 0) + q.settlement_minor
    expiries = [q.expires_at for q in quotes if q.expires_at]
    return BatchCost(
        n=len(quotes),
        from_asset=assets.pop(),
        total_source_minor=sum(q.source_minor for q in quotes),
        total_fee_minor=sum(q.fee_minor for q in quotes),
        total_debit_minor=sum(q.total_debit_minor for q in quotes),
        settlement_by_currency=by_ccy,
        first_expiry=min(expiries) if expiries else None,
    )


def quotes_at_risk(quotes: list[Quote], now: datetime, seconds_per_payout: float,
                   margin: timedelta = DEFAULT_SAFETY_MARGIN) -> list[Quote]:
    """Cotations qui auront expiré avant leur tour si on traite le lot dans l'ordre.

    Si cette liste n'est pas vide, il faut coter juste avant chaque payout
    (quote -> initialize -> finalize à la suite) plutôt que tout coter d'avance.
    """
    at_risk = []
    for i, q in enumerate(quotes):
        moment = now + timedelta(seconds=i * seconds_per_payout)
        if not q.is_usable(moment, margin):
            at_risk.append(q)
    return at_risk


def estimate_source_for_target(target_minor: int, target_ccy: str, rate, source_asset: str,
                               fee_rate=Decimal("0"), fee_fixed_minor: int = 0) -> int:
    """ESTIMATION avant cotation : combien d'actif faut-il pour que le bénéficiaire reçoive `target`.

    À n'utiliser que pour un affichage indicatif. Le chiffre définitif vient de la
    cotation Bitnob demandée avec `settlement_amount` = montant cible.
    """
    rate = parse_decimal(rate)
    if rate <= 0:
        raise ValueError("Taux invalide")
    net_source = to_major(target_minor, target_ccy) / rate
    gross = (net_source + to_major(fee_fixed_minor, source_asset)) / (Decimal(1) - parse_decimal(fee_rate))
    # arrondi vers le HAUT : mieux vaut facturer une fraction de centime de trop que trop peu
    return int((gross * (Decimal(10) ** exponent(source_asset))).to_integral_value(rounding=ROUND_UP))


def classify_invoice_payment(due_minor: int, received_minor: int, tolerance_minor: int = 0) -> tuple[str, int]:
    """Statut d'une facture SunuPay après réception d'un paiement.

    Retourne (statut, écart). écart > 0 : il manque ; écart < 0 : trop-perçu.
    """
    gap = due_minor - received_minor
    if received_minor <= 0:
        return "open", gap
    if abs(gap) <= tolerance_minor:
        return "paid", gap
    if gap > 0:
        return "partially_paid", gap
    return "overpaid", gap
