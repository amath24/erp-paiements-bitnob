"""constants.py : noms partages. On ne les retape jamais ailleurs."""

PAID_EVENTS = ["transfer.success", "deposit.success"]  # evenements webhook = paiement recu
PAID_STATUSES = ["paid", "completed", "settled", "success"]  # statut "paye" reel de Bitnob : a confirmer


class InvoiceStatus:
    PENDING = "pending"
    PAID = "paid"
