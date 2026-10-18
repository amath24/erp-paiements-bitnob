from functools import lru_cache

from app.config import get_settings
from app.repo.base import BatchRepository


@lru_cache
def get_repo() -> BatchRepository:
    if get_settings().storage_backend == "supabase":
        from app.repo.supabase import SupabaseRepo
        return SupabaseRepo()
    from app.repo.memory import MemoryRepo
    return MemoryRepo()
