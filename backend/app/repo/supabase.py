"""À IMPLÉMENTER par la personne en charge de la base (Supabase).

Mapper chaque méthode de `BatchRepository` (voir base.py) sur les tables
batches / payouts. Les champs sont ceux de `app/domain.py` (voir aussi
docs/storage-contract.md). Activer avec STORAGE_BACKEND=supabase.
"""
from app.domain import Batch, Payout


class SupabaseRepo:
    async def create_batch(self, batch: Batch, payouts: list[Payout]) -> None:
        raise NotImplementedError

    async def get_batch(self, batch_id: str) -> Batch | None:
        raise NotImplementedError

    async def list_batches(self) -> list[Batch]:
        raise NotImplementedError

    async def save_batch(self, batch: Batch) -> None:
        raise NotImplementedError

    async def get_payout(self, payout_id: str) -> Payout | None:
        raise NotImplementedError

    async def list_payouts(self, batch_id: str | None = None) -> list[Payout]:
        raise NotImplementedError

    async def save_payout(self, payout: Payout) -> None:
        raise NotImplementedError

    async def find_payout(self, *, reference: str | None = None,
                          bitnob_payout_id: str | None = None) -> Payout | None:
        raise NotImplementedError
