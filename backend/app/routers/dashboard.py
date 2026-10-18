from fastapi import APIRouter, Depends

from app.deps import require_api_key
from app.repo import get_repo
from app.services import dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(require_api_key)])


@router.get("/summary")
async def summary():
    """KPIs, volumes par devise, par pays, par jour, derniers batchs, enveloppes."""
    return await dashboard.summary(get_repo())
