"""Stockage en mémoire : perdu au redémarrage. Pour dev, tests et démo sans DB."""
from app.domain import Batch, Payout, now


class MemoryRepo:
    def __init__(self) -> None:
        self.clear()

    def clear(self) -> None:
        self._batches: dict[str, Batch] = {}
        self._payouts: dict[str, Payout] = {}

    async def create_batch(self, batch: Batch, payouts: list[Payout]) -> None:
        self._batches[batch.id] = batch
        for p in payouts:
            self._payouts[p.id] = p

    async def get_batch(self, batch_id: str) -> Batch | None:
        return self._batches.get(batch_id)

    async def list_batches(self) -> list[Batch]:
        return sorted(self._batches.values(), key=lambda b: b.created_at, reverse=True)

    async def save_batch(self, batch: Batch) -> None:
        batch.updated_at = now()
        self._batches[batch.id] = batch

    async def get_payout(self, payout_id: str) -> Payout | None:
        return self._payouts.get(payout_id)

    async def list_payouts(self, batch_id: str | None = None) -> list[Payout]:
        items = [p for p in self._payouts.values() if batch_id is None or p.batch_id == batch_id]
        return sorted(items, key=lambda p: (p.batch_id, p.line))

    async def save_payout(self, payout: Payout) -> None:
        payout.updated_at = now()
        self._payouts[payout.id] = payout

    async def find_payout(self, *, reference: str | None = None,
                          bitnob_payout_id: str | None = None) -> Payout | None:
        for p in self._payouts.values():
            if reference and p.reference == reference:
                return p
            if bitnob_payout_id and p.bitnob_payout_id == bitnob_payout_id:
                return p
        return None
