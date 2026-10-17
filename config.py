"""config.py : SEULE source des variables d'environnement. Personne d'autre n'appelle os.environ ni os.getenv."""
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

_required = ["BITNOB_CLIENT_ID", "BITNOB_CLIENT_SECRET"]
_missing = [k for k in _required if not os.getenv(k)]
if _missing:
    raise RuntimeError("Variables manquantes dans .env : " + ", ".join(_missing) + " (voir .env.example)")


@dataclass(frozen=True)
class Config:
    port: int
    demo_mode: bool
    confirm_payout: bool  # finalisation d'un payout = debit irreversible
    bitnob_client_id: str
    bitnob_client_secret: str
    bitnob_base_url: str
    bitnob_customer_id: str
    bitnob_webhook_secret: str


config = Config(
    port=int(os.getenv("PORT", "3000")),
    demo_mode=os.getenv("DEMO_MODE") == "true",
    confirm_payout=os.getenv("CONFIRM_PAYOUT") == "true",
    bitnob_client_id=os.environ["BITNOB_CLIENT_ID"],
    bitnob_client_secret=os.environ["BITNOB_CLIENT_SECRET"],
    bitnob_base_url=os.getenv("BITNOB_BASE_URL", "https://api.bitnob.com"),
    bitnob_customer_id=os.getenv("BITNOB_CUSTOMER_ID", ""),
    bitnob_webhook_secret=os.getenv("BITNOB_WEBHOOK_SECRET", ""),
)
