from typing import Literal
from pydantic import BaseModel, Field


class Beneficiary(BaseModel):
    destination_type: Literal["bank", "mobile_money", "swift"]
    country: str = Field(min_length=2, max_length=2)
    account_name: str
    account_number: str
    bank_code: str | None = None  # requis pour bank / mobile_money


class QuoteIn(BaseModel):
    # Fournir amount (crypto) OU settlement_amount (fiat), pas les deux
    amount: str | None = None
    settlement_amount: str | None = None
    country: str = Field(min_length=2, max_length=2)
    from_asset: Literal["BTC", "USDT", "USDC"] = "USDT"
    to_currency: str
    source: Literal["offchain", "onchain"] = "offchain"
    chain: str | None = None  # requis si onchain
    reference: str | None = None


class PayoutIn(BaseModel):
    """Payout complet en un appel : quote + initialize + finalize."""
    quote: QuoteIn
    beneficiary: Beneficiary
    payment_reason: str = "vendor_payment"
    reference: str | None = None


# ---------------- Cartes / enveloppes ----------------
from decimal import Decimal  # noqa: E402
from typing import Any  # noqa: E402

from pydantic import ConfigDict, field_validator  # noqa: E402

ALPHA2_TO_ALPHA3 = {
    "SN": "SEN", "NG": "NGA", "GH": "GHA", "KE": "KEN", "CI": "CIV", "CM": "CMR",
    "ZA": "ZAF", "UG": "UGA", "TZ": "TZA", "RW": "RWA", "ML": "MLI", "BF": "BFA",
    "BJ": "BEN", "TG": "TGO", "GN": "GIN", "NE": "NER", "GA": "GAB", "CD": "COD",
    "EG": "EGY", "MA": "MAR", "TN": "TUN", "ET": "ETH", "FR": "FRA", "US": "USA", "GB": "GBR",
}


class KycCustomer(BaseModel):
    """Identité du titulaire (champs exigés par Bitnob, relevés via ses erreurs de validation)."""
    model_config = ConfigDict(extra="allow")

    customer_type: Literal["individual", "business", "team_member"] = "individual"
    first_name: str            # exactement comme sur la pièce d'identité
    last_name: str
    email: str
    date_of_birth: str = Field(examples=["1995-04-23"])  # AAAA-MM-JJ
    phone_number: str | None = None
    dial_code: str | None = Field(default=None, examples=["+221"])
    line1: str                 # adresse
    line2: str | None = None
    city: str
    state: str
    postal_code: str
    country: str = Field(examples=["SEN"])  # ISO alpha-3 exigé par le KYC (SN est converti en SEN)

    @field_validator("country")
    @classmethod
    def _country_alpha3(cls, v: str) -> str:
        v = v.strip().upper()
        v = ALPHA2_TO_ALPHA3.get(v, v)
        if len(v) != 3:
            raise ValueError("country doit être un code ISO à 3 lettres (ex. SEN)")
        return v


class CardKycIn(BaseModel):
    """Corps du Card KYC. id_type / id_number peuvent être donnés ici : le router
    les recopie aussi dans `customer`, où Bitnob les valide."""
    model_config = ConfigDict(extra="allow")

    customer: KycCustomer
    id_type: Literal["bvn", "nin", "passport", "drivers_license", "national_id",
                     "vnin", "voters_card", "ghana_card"]
    id_number: str
    occupation: str = "business_consultant"
    employment_status: str = "employed"
    account_purpose: str = "business expenses"
    annual_salary: str = "12000"
    expected_monthly_volume: str = "500"
    place_of_birth: str | None = None
    terms_of_service_accepted: bool = True
    webhook_url: str | None = None
    id_front_image: str | None = None  # base64 (<= 1 Mo), OBLIGATOIRE sauf pour bvn / nin


class EnvelopeIn(BaseModel):
    name: str = Field(examples=["Meta Ads"])
    monthly_budget_usd: Decimal = Field(gt=0, examples=["100"])
    customer_id: str | None = None          # sinon DEFAULT_CARD_CUSTOMER_ID
    cardholder_name: str | None = None      # nom imprimé sur la carte (optionnel)
    card_brand: Literal["visa", "mastercard"] | None = None
    enforce_monthly_limit: bool = True      # plafond mensuel posé sur la carte elle-même


# ---------------- Factures Bitcoin (Lightning) ----------------
class InvoiceIn(BaseModel):
    amount_sat: int = Field(ge=1, le=20_000_000, examples=[10000])
    description: str = Field(examples=["Facture #123"])
    expiry_seconds: int | None = Field(default=None, ge=60)
    customer_id: str | None = None
    reference: str | None = None
