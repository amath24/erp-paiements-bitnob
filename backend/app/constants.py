"""backend/app/constants.py : Noms et statuts partages."""

PAID_EVENTS = ["transfer.success", "deposit.success"]  # evenements webhook = paiement recu
PAID_STATUSES = ["paid", "completed", "settled", "success"]  # statut "paye" reel de Bitnob

# Taux approximatif de conversion satoshi -> FCFA.
# Base : BTC ~95 000 USD, 1 USD ~ 600 FCFA => 1 sat = 0,95e-3 * 600 / 1e8 BTC = ~0,57 FCFA
# On prend 0.4 par prudence (fluctuations + frais). A remplacer par un appel API taux en production.
SAT_TO_XOF_RATE: float = 0.4


class InvoiceStatus:
    PENDING = "pending"
    PAID = "paid"
    EXPIRED = "expired"
