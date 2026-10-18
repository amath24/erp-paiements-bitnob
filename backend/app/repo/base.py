"""Contrat de stockage des paiements de masse.

La personne en charge de la base (Supabase) implémente cette interface dans
`app/repo/supabase.py`. Le reste du backend n'appelle QUE ces méthodes.
Toutes les méthodes sont asynchrones. `save_*` = upsert par `id`.
"""
from typing import Protocol

from app.domain import Batch, Payout


class BatchRepository(Protocol):
    async def create_batch(self, batch: Batch, payouts: list[Payout]) -> None: ...
    async def get_batch(self, batch_id: str) -> Batch | None: ...
    async def list_batches(self) -> list[Batch]: ...                      # plus récent d'abord
    async def save_batch(self, batch: Batch) -> None: ...

    async def get_payout(self, payout_id: str) -> Payout | None: ...
    async def list_payouts(self, batch_id: str | None = None) -> list[Payout]: ...  # ordre par `line`
    async def save_payout(self, payout: Payout) -> None: ...
    async def find_payout(self, *, reference: str | None = None,
                          bitnob_payout_id: str | None = None) -> Payout | None: ...
