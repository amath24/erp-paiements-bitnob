"""backend/app/constants.py : Noms et statuts partages."""

PAID_EVENTS = ["transfer.success", "deposit.success"]  # evenements webhook = paiement recu
PAID_STATUSES = ["paid", "completed", "settled", "success"]  # statut "paye" reel de Bitnob


class InvoiceStatus:
    PENDING = "pending"
    PAID = "paid"
    EXPIRED = "expired"
