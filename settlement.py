"""settlement.py : BTC recu -> USDT -> payout mobile money (Senegal).
SQUELETTE : les reponses reelles sont loggees, adaptez les noms de champs en direct."""
import json

from bitnob import bitnob
from config import config


def log(step: str, data) -> None:
    print("[settlement] " + step, json.dumps(data)[:600])


async def convert_sats_to_usdt(sats: int, ref: str) -> dict:
    """BTC -> USDT (Trading). On VEND du BTC contre de l'USDT ; quantity en BTC (chaine decimale)."""
    quantity = f"{sats / 1e8:.8f}"
    q = await bitnob("POST", "/api/trading/quotes", {
        "base_currency": "BTC", "quote_currency": "USDT", "side": "SELL", "quantity": quantity,
    })
    log("devis trading", q)
    data = q.get("data") or {}
    quote_id = data.get("quote_id") or data.get("id")
    o = await bitnob("POST", "/api/trading/orders", {
        "base_currency": "BTC", "quote_currency": "USDT", "side": "SELL", "quantity": quantity,
        "quote_id": quote_id, "reference": "conv_" + ref,
    })
    log("ordre trading", o)
    return o.get("data")


async def payout_to_mobile_money(xof_amount, beneficiary: dict, reason: str, ref: str) -> dict:
    """USDT -> FCFA sur mobile money (Payouts). Le devis expire vite : tout enchainer."""
    q = await bitnob("POST", "/api/payouts/quotes", {
        "from_asset": "USDT", "to_currency": "XOF", "source": "offchain", "country": "SN",
        "settlement_amount": str(xof_amount), "payment_reason": reason, "reference": "q_" + ref,
    })
    log("devis payout", q)
    quote_id = ((q.get("data") or {}).get("payout") or {}).get("quote_id")
    i = await bitnob("POST", f"/api/payouts/{quote_id}/initialize", {
        "quote_id": quote_id, "reference": "i_" + ref, "payment_reason": reason, "beneficiary": beneficiary,
    })
    log("initialisation", i)
    # La finalisation engage le debit, de facon irreversible : seulement si on l'a demande.
    if not config.confirm_payout:
        return {"stopped": "initialise, finalisation non lancee", "payout": (i.get("data") or {}).get("payout")}
    f = await bitnob("POST", f"/api/payouts/{quote_id}/finalize")
    log("finalisation", f)
    return (f.get("data") or {}).get("payout")
