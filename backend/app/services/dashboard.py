"""Indicateurs du tableau de bord, calculés à partir du repository.
(La personne DB peut les remplacer par des vues SQL : même format de réponse.)"""
from decimal import Decimal

from app.domain import IN_FLIGHT
from app.repo.base import BatchRepository
from app.services import envelopes as env_svc


async def summary(repo: BatchRepository) -> dict:
    batches = await repo.list_batches()
    payouts = await repo.list_payouts()

    success = [p for p in payouts if p.status == "SUCCESS"]
    failed = [p for p in payouts if p.status in {"FAILED", "EXPIRED"}]
    in_flight = [p for p in payouts if p.status in IN_FLIGHT]
    finished = len(success) + len(failed)

    by_currency: dict[str, dict[str, Decimal]] = {}
    by_country: dict[str, dict] = {}
    by_day: dict[str, dict] = {}
    for p in payouts:
        cur = by_currency.setdefault(p.currency, {"total": Decimal(0), "sent": Decimal(0)})
        cur["total"] += p.amount
        c = by_country.setdefault(p.country, {"country": p.country, "payouts": 0, "success": 0,
                                              "amount_sent": {}})
        c["payouts"] += 1
        d = by_day.setdefault(p.created_at.date().isoformat(),
                              {"date": p.created_at.date().isoformat(), "payouts": 0, "success": 0})
        d["payouts"] += 1
        if p.status == "SUCCESS":
            cur["sent"] += p.amount
            c["success"] += 1
            c["amount_sent"][p.currency] = str(Decimal(c["amount_sent"].get(p.currency, "0")) + p.amount)
            d["success"] += 1

    envs = list(env_svc.ENVELOPES.values())
    return {
        "totals": {
            "batches": len(batches),
            "payouts": len(payouts),
            "unique_beneficiaries": len({(p.account_number, p.country) for p in payouts}),
            "success": len(success), "failed": len(failed), "in_progress": len(in_flight),
            "success_rate": round(len(success) / finished, 4) if finished else None,
        },
        "volume_by_currency": {k: {"total": str(v["total"]), "sent": str(v["sent"])}
                               for k, v in by_currency.items()},
        "by_country": sorted(by_country.values(), key=lambda x: -x["payouts"]),
        "by_day": sorted(by_day.values(), key=lambda x: x["date"]),
        "recent_batches": [b.model_dump(mode="json") for b in batches[:5]],
        "envelopes": {
            "count": len(envs),
            "total_monthly_budget_usd": round(sum(e.monthly_budget_usd for e in envs), 2),
            "alerts": len(env_svc.ALERTS),
        },
    }
