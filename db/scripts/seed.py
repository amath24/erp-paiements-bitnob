r"""Remplit la base avec des données de DÉMONSTRATION réalistes (toutes marquées is_simulated = TRUE).

    python scripts\seed.py --reset                    # scénario BulkPay ERP (par défaut)
    python scripts\seed.py --reset --scenario ong     # ancien scénario : ONG au Sénégal

Scénario BulkPay ERP (celui du document de projet) :
  * une marketplace de livraison paie chaque semaine ses 50 livreurs au Nigeria, au Ghana et au Sénégal,
    sur 90 jours ; deux lots sont réglés en Bitcoin, les autres en USDT ;
  * quelques paiements échouent puis réussissent à la relance (2e essai) ;
  * un lot est en cours aujourd'hui, avec un échec prêt à être relancé pendant la démo ;
  * trois enveloppes budgétaires avec carte virtuelle : Meta Ads (100 USD/mois), Outils (50), Formation (30) ;
    l'enveloppe Meta Ads finit le mois juste au-dessus de son seuil d'alerte (10 USD) ;
  * des factures Bitcoin Lightning payées, expirées et en attente ;
  * journal d'audit et quelques questions posées à l'assistant IA.

Problèmes plantés exprès (pour montrer le rapprochement) :
  2 paiements bloqués depuis 40 min, 1 écart de montant, 1 webhook à référence inconnue,
  1 webhook à signature invalide.

Tous les taux, frais et montants sont ILLUSTRATIFS (ce ne sont pas des taux Bitnob).
L'écriture passe par payout_attempts, exactement comme le fera le backend : les déclencheurs de la base
recopient les statuts et remplissent l'historique.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import string
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from role3.fakes import (RANGES, SN_OPERATOR_WEIGHTS, SN_REGIONS, livreurs,  # noqa: E402
                         sn_names, sn_phone_for, weighted)
from role3.money import to_major, to_minor  # noqa: E402

# --- valeurs ILLUSTRATIVES -----------------------------------------------------
USDT_RATES = {"NGN": (Decimal("1530"), Decimal("0.004")), "GHS": (Decimal("15.2"), Decimal("0.004")),
              "XOF": (Decimal("565"), Decimal("0.002"))}
BTC_USD = Decimal("100000")            # 1 BTC = 100 000 USD (illustratif)
FEE_RATE = Decimal("0.010")            # 1 %
FEE_FIXED = {"USDT": Decimal("0.30"), "BTC": Decimal("0.000003")}   # par paiement
FAIL = {  # probabilité d'échec par opérateur / banque, raisons possibles
    "WAVE": (0.02, ["Aucun compte Wave pour ce numéro", "Plafond du compte atteint"]),
    "ORANGE_MONEY": (0.04, ["Compte Orange Money suspendu", "Plafond du wallet atteint", "Opérateur indisponible"]),
    "FREE_MONEY": (0.06, ["Aucun compte Free Money pour ce numéro", "Opérateur indisponible"]),
    "EXPRESSO": (0.08, ["Opérateur indisponible", "Aucun compte pour ce numéro"]),
    "MTN": (0.04, ["Nom du titulaire différent", "Opérateur indisponible"]),
    "ACCESS_BANK": (0.03, ["Numéro de compte introuvable", "Banque indisponible"]),
    "GTBANK": (0.03, ["Numéro de compte introuvable", "Banque indisponible"]),
    "OPAY": (0.03, ["Numéro de compte introuvable", "Opérateur indisponible"]),
}
DELAY_MIN = {"WAVE": 1.5, "ORANGE_MONEY": 3.0, "FREE_MONEY": 4.0, "EXPRESSO": 5.0, "MTN": 3.0,
             "ACCESS_BANK": 2.5, "GTBANK": 2.5, "OPAY": 2.0}

ONG_NAME = "Santé Communautaire Sénégal (ONG de démo)"
ONG_PROGRAMS = [("Primes relais communautaires", 25_000, 60_000, 2_500), ("Indemnités enquêteurs", 15_000, 35_000, 2_500),
                ("Transferts monétaires aux ménages", 35_000, 50_000, 5_000), ("Per diem formation", 10_000, 20_000, 2_500)]
ONG_REGION_WEIGHTS = {"Kaolack": 10, "Kolda": 9, "Tambacounda": 9, "Matam": 8, "Ziguinchor": 8, "Sédhiou": 7,
                      "Kaffrine": 7, "Kédougou": 6, "Louga": 6, "Fatick": 6, "Saint-Louis": 6, "Diourbel": 5,
                      "Thiès": 4, "Dakar": 3}

# Enveloppes : (nom, catégorie, budget USD, seuil USD, dépenses mensuelles typiques (marchand, min, max, nombre))
ENVELOPES = [
    ("Meta Ads", "ads", 100, 10, [("META ADS", 8, 25, 6)]),
    ("Outils (Notion, Figma, Canva)", "software", 50, 5, [("NOTION", 10, 10, 1), ("FIGMA", 15, 15, 1), ("CANVA", 13, 13, 1)]),
    ("Formation et livres", "training", 30, 5, [("UDEMY", 12, 15, 1), ("AMAZON KINDLE", 6, 9, 1)]),
]
MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
             "octobre", "novembre", "décembre"]
CUSTOMERS = ["Restaurant Le Baobab", "Boutique Kente Accra", "Studio Graphique Lagos", "Pharmacie du Plateau",
             "Agence Sahel Voyages", "Café Touba Express", "Atelier Wax & Co", "Librairie Clairafrique"]


# --- outils ---------------------------------------------------------------------
def reset(cur) -> None:
    """Efface toutes les données simulées, dans l'ordre imposé par les clés étrangères."""
    for stmt in [
        "DELETE FROM ai_query_log WHERE is_simulated",
        "DELETE FROM audit_log WHERE is_simulated",
        "DELETE FROM data_alerts WHERE is_simulated",
        "DELETE FROM envelope_reloads WHERE is_simulated",
        "DELETE FROM envelope_movements WHERE is_simulated",
        "DELETE FROM card_transactions WHERE is_simulated",
        "DELETE FROM card_balance_snapshots WHERE is_simulated",
        "DELETE FROM envelopes WHERE is_simulated",
        "DELETE FROM company_balance_snapshots WHERE is_simulated",
        "DELETE FROM invoices WHERE is_simulated",
        "DELETE FROM payout_status_history WHERE payout_id IN (SELECT id FROM payouts WHERE is_simulated)",
        "DELETE FROM payout_attempts WHERE is_simulated",
        "DELETE FROM payouts WHERE is_simulated",
        "DELETE FROM webhook_events WHERE is_simulated",
        "DELETE FROM batches WHERE is_simulated",
        "DELETE FROM beneficiaries WHERE is_simulated",
        "DELETE FROM users WHERE is_simulated",
    ]:
        cur.execute(stmt)


def rate_walk(rng: random.Random, days: int) -> dict:
    """Taux USDT -> devise locale, jour par jour (marche aléatoire bornée)."""
    rates = {}
    for ccy, (base, vol) in USDT_RATES.items():
        level = base
        for d in range(days + 1):
            level = level * (Decimal(1) + Decimal(str(rng.uniform(-float(vol), float(vol)))))
            rates[(ccy, d)] = level.quantize(Decimal("0.0001"))
    return rates


def quote(settle_minor: int, ccy: str, asset: str, usdt_rate: Decimal) -> tuple[int, int, Decimal]:
    """Montant débité, frais et taux (devise locale par unité d'actif) pour un paiement."""
    rate = usdt_rate if asset == "USDT" else (usdt_rate * BTC_USD).quantize(Decimal("0.0001"))
    places = Decimal("0.000001") if asset == "USDT" else Decimal("0.00000001")
    source = to_minor((to_major(settle_minor, ccy) / rate).quantize(places), asset)
    fee = to_minor((to_major(source, asset) * FEE_RATE + FEE_FIXED[asset]).quantize(places), asset)
    return source, fee, rate


def make_attempt(rng, *, ref, no, t0, outcome, op, reason=None, delay=None, pending_at=None):
    """Un essai et sa chronologie. outcome : completed | failed | expired | pending | stuck."""
    a = {"ref": ref, "no": no, "quoted_at": t0, "initialized_at": t0 + timedelta(seconds=4),
         "quote_expires_at": t0 + timedelta(minutes=10), "pending_at": None, "completed_at": None,
         "status": outcome if outcome != "stuck" else "pending", "failure_reason": None,
         "quote_id": f"QT2_SIM{uuid.uuid4().hex[:10]}", "bitnob_id": str(uuid.uuid4())}
    if outcome in ("pending", "stuck", "completed", "failed"):
        a["pending_at"] = pending_at or a["initialized_at"] + timedelta(seconds=rng.randint(5, 30))
    if outcome == "completed":
        minutes = delay if delay is not None else max(rng.lognormvariate(0, 0.5) * DELAY_MIN[op], 0.6)
        a["completed_at"] = max(a["initialized_at"] + timedelta(minutes=minutes), a["pending_at"] + timedelta(seconds=5))
    elif outcome == "failed":
        a["completed_at"] = a["pending_at"] + timedelta(minutes=rng.uniform(1, 6))
        a["failure_reason"] = reason or rng.choice(FAIL[op][1])
    elif outcome == "expired":
        a["completed_at"] = a["quote_expires_at"]
    return a


def webhook(event: str, line: dict, att: dict, status: str, at: datetime, settlement: str | None = None) -> dict:
    asset = line["asset"]
    data = {
        "id": att["bitnob_id"], "quote_id": att["quote_id"], "company_id": "00000000-demo",
        "reference": att["ref"], "status": status, "from_asset": asset.lower(),
        "to_currency": line["currency"].lower(),
        "amount": str(to_major(line["source"], asset)),
        "settlement_amount": settlement or str(to_major(line["settle"], line["currency"])),
        "fees": str(to_major(line["fee"], asset)),
        "beneficiary": {"country": line["country"], "bank_code": line["operator"],
                        "account_number": "****" + line["phone"][-4:]},
        "created_at": att["quoted_at"].isoformat(), "updated_at": at.isoformat(),
    }
    if status in ("success", "expired"):
        data["completed_at"] = at.isoformat()
    return {"event": event, "event_id": str(uuid.uuid4()), "data": data}


# --- écriture : lignes puis essais, étape par étape ----------------------------------
def write_payouts(cur, lines: list[dict]) -> list[tuple]:
    cur.executemany(
        "INSERT INTO payouts (id, batch_id, beneficiary_id, reference, settlement_minor, settlement_currency, "
        "source_asset, payment_reason, is_simulated, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,'salary',TRUE,%s)",
        [(ln["id"], ln["batch_id"], ln["ben_id"], ln["ref"], ln["settle"], ln["currency"], ln["asset"],
          ln["attempts"][0]["quoted_at"]) for ln in lines])
    events = []
    for no in range(1, max(len(ln["attempts"]) for ln in lines) + 1):
        todo = [(ln, ln["attempts"][no - 1]) for ln in lines if len(ln["attempts"]) >= no]
        cur.executemany(
            "INSERT INTO payout_attempts (payout_id, attempt_no, reference, source_minor, fee_source_minor, "
            "exchange_rate, bitnob_quote_id, bitnob_payout_id, quote_expires_at, quoted_at, is_simulated, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE,%s)",
            [(ln["id"], a["no"], a["ref"], ln["source"], ln["fee"], ln["rate"], a["quote_id"], a["bitnob_id"],
              a["quote_expires_at"], a["quoted_at"], a["quoted_at"]) for ln, a in todo])
        cur.executemany(
            "UPDATE payout_attempts SET status = 'initialized', initialized_at = %s, last_origin = 'api' WHERE reference = %s",
            [(a["initialized_at"], a["ref"]) for _, a in todo])
        pend = []
        for ln, a in todo:
            if a["pending_at"]:
                ev = webhook("payouts.processing", ln, a, "processing", a["pending_at"])
                events.append((ev["event_id"], ev["event"], a["ref"], json.dumps(ev), True, a["pending_at"], a["pending_at"]))
                pend.append((a["pending_at"], ev["event_id"], a["ref"]))
        cur.executemany(
            "UPDATE payout_attempts SET status = 'pending', pending_at = %s, last_origin = 'webhook', last_event_id = %s "
            "WHERE reference = %s", pend)
        final = []
        for ln, a in todo:
            if a["status"] == "completed":
                ev = webhook("payouts.withdrawal.success", ln, a, "success", a["completed_at"])
                origin = "webhook"
            elif a["status"] == "expired":
                ev = webhook("payouts.withdrawal.expired", ln, a, "expired", a["completed_at"])
                origin = "webhook"
            elif a["status"] == "failed":
                ev, origin = None, "api"     # Bitnob ne documente pas de webhook d'échec
            else:
                continue
            if ev:
                events.append((ev["event_id"], ev["event"], a["ref"], json.dumps(ev), True, a["completed_at"], a["completed_at"]))
            final.append((a["status"], a["completed_at"], a["failure_reason"],
                          f"OP-{uuid.uuid4().hex[:12].upper()}" if a["status"] == "completed" else None,
                          origin, ev["event_id"] if ev else None, a["ref"]))
        cur.executemany(
            "UPDATE payout_attempts SET status = %s, completed_at = %s, failure_reason = %s, provider_settlement_id = %s, "
            "last_origin = %s, last_event_id = %s WHERE reference = %s", final)
    return events


def plant_problems(lines: list[dict], events: list[tuple], now: datetime) -> list[tuple]:
    """Ajoute les 3 webhooks piégés et l'écart de montant (voir docstring)."""
    xof_done = next(ln for ln in reversed(lines) if ln["currency"] == "XOF" and ln["attempts"][-1]["status"] == "completed")
    ref = xof_done["attempts"][-1]["ref"]
    for i, ev in enumerate(events):
        if ev[2] == ref and ev[1] == "payouts.withdrawal.success":
            payload = json.loads(ev[3])
            payload["data"]["settlement_amount"] = str(to_major(xof_done["settle"] - 500, "XOF"))
            events[i] = (ev[0], ev[1], ev[2], json.dumps(payload), ev[4], ev[5], ev[6])
    ghost = {"event": "payouts.withdrawal.success", "event_id": str(uuid.uuid4()),
             "data": {"reference": "BP-INCONNUE-0001", "status": "success", "settlement_amount": "25000"}}
    events.append((ghost["event_id"], ghost["event"], "BP-INCONNUE-0001", json.dumps(ghost), True,
                   now - timedelta(minutes=20), now - timedelta(minutes=20)))
    live_pending = [ln["attempts"][-1]["ref"] for ln in lines if ln["attempts"][-1]["status"] == "pending"]
    forged = {"event": "payouts.withdrawal.success", "event_id": str(uuid.uuid4()),
              "data": {"reference": live_pending[-1], "status": "success"}}
    events.append((forged["event_id"], forged["event"], live_pending[-1], json.dumps(forged), False,
                   now - timedelta(minutes=10), None))
    return events


def batch_status(lines: list[dict]) -> tuple[str, datetime | None]:
    st = {ln["attempts"][-1]["status"] for ln in lines}
    ends = [ln["attempts"][-1]["completed_at"] for ln in lines if ln["attempts"][-1]["completed_at"]]
    if st & {"quoted", "initialized", "pending"}:
        return "running", None
    if st == {"completed"}:
        return "completed", max(ends)
    return ("partial" if "completed" in st else "failed"), max(ends)


# --- scénarios -------------------------------------------------------------------
def scenario_bulkpay(rng, cur, now, days):
    start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0)
    admin, viewer = uuid.uuid4(), uuid.uuid4()
    cur.executemany(
        "INSERT INTO users (id, email, full_name, role, kyc_status, is_simulated, created_at, last_login_at) "
        "VALUES (%s,%s,%s,%s,'verified',TRUE,%s,%s)",
        [(admin, "admin@livraison-express.test", "Admin Livraison Express (démo)", "admin", start, now - timedelta(minutes=55)),
         (viewer, "comptable@livraison-express.test", "Comptable (démo, lecture seule)", "viewer", start, now - timedelta(days=2))])
    audit = [(admin, "user_login", "users", str(admin), {}, now - timedelta(minutes=55))]

    people = livreurs()
    for p in people:
        p["id"] = uuid.uuid4()
    cur.executemany(
        "INSERT INTO beneficiaries (id, owner_id, full_name, country, currency, destination_type, phone_e164, "
        "account_number, bank_code, region, is_simulated, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE,%s)",
        [(p["id"], admin, p["name"], p["country"], p["currency"], "bank" if p["country"] == "NG" else "mobile_money",
          p["phone"], p["phone"], p["operator"], p["region"], start) for p in people])

    rates = rate_walk(rng, days)
    fridays = [start + timedelta(days=d) for d in range(days) if (start + timedelta(days=d)).weekday() == 4]
    btc_batches = {len(fridays) // 3, 2 * len(fridays) // 3}
    batches, lines, seq = [], [], 0
    for k, day in enumerate(fridays + [None]):
        live = day is None
        created = now - timedelta(minutes=50) if live else day + timedelta(hours=rng.randint(9, 16), minutes=rng.randint(0, 59))
        d_index = days if live else (day - start).days
        asset = "BTC" if k in btc_batches else "USDT"
        label = (f"Commissions du mois · {MONTHS_FR[created.month - 1]} {created.year} (en cours)" if live
                 else f"Commissions livreurs · semaine {created.isocalendar()[1]}")
        bt = {"id": uuid.uuid4(), "name": label + (" · réglé en BTC" if asset == "BTC" else ""),
              "created": created, "asset": asset, "rejected": 2 if live else rng.choice([0, 0, 1])}
        picked = people if live else rng.sample(people, rng.randint(40, 50))
        plan = {}
        if live:   # lot du jour : 2 bloqués, 6 en cours, 1 échec à relancer, le reste payé
            order = list(range(len(picked)))
            rng.shuffle(order)
            for i in order[:2]:
                plan[i] = "stuck"
            for i in order[2:8]:
                plan[i] = "pending"
            plan[order[8]] = "failed"
        bt_lines = []
        for i, p in enumerate(picked):
            seq += 1
            lo, hi, step = RANGES[p["country"]]
            settle = to_minor(rng.randrange(lo, hi + 1, step), p["currency"])   # commissions de la semaine
            source, fee, rate = quote(settle, p["currency"], asset, rates[(p["currency"], d_index)])
            t0 = created + timedelta(seconds=2 + 3 * i)
            ref = f"BP-{t0:%Y%m%d}-{seq:05d}"
            if live:
                outcome = plan.get(i, "completed")
            else:
                roll = rng.random()
                fail_p = FAIL[p["operator"]][0]
                outcome = "failed" if roll < fail_p else "expired" if roll < fail_p + 0.012 else "completed"
            if outcome == "stuck":
                att = make_attempt(rng, ref=ref, no=1, t0=t0, outcome="pending", op=p["operator"],
                                   pending_at=now - timedelta(minutes=41))
            elif outcome == "pending":
                att = make_attempt(rng, ref=ref, no=1, t0=t0, outcome="pending", op=p["operator"],
                                   pending_at=now - timedelta(minutes=rng.randint(2, 9)))
            elif live and outcome == "completed":
                att = make_attempt(rng, ref=ref, no=1, t0=t0, outcome="completed", op=p["operator"],
                                   delay=rng.uniform(1, 30))
            elif live and outcome == "failed":
                att = make_attempt(rng, ref=ref, no=1, t0=t0, outcome="failed", op=p["operator"],
                                   reason="Opérateur indisponible")
            else:
                att = make_attempt(rng, ref=ref, no=1, t0=t0, outcome=outcome, op=p["operator"])
            attempts = [att]
            # Historique : la plupart des échecs ont été relancés et ont réussi au 2e essai
            if not live and outcome in ("failed", "expired") and rng.random() < 0.75:
                t1 = att["completed_at"] + timedelta(minutes=rng.randint(20, 120))
                second = "completed" if rng.random() < 0.9 else "failed"
                attempts.append(make_attempt(rng, ref=f"{ref}-R2", no=2, t0=t1, outcome=second, op=p["operator"]))
                audit.append((admin, "payout_retried", "payouts", ref, {"essai": 2}, t1))
            bt_lines.append({"id": uuid.uuid4(), "batch_id": bt["id"], "ben_id": p["id"], "ref": ref, "settle": settle,
                             "currency": p["currency"], "country": p["country"], "operator": p["operator"],
                             "phone": p["phone"], "asset": asset, "source": source, "fee": fee, "rate": rate,
                             "attempts": attempts})
        status, finished = batch_status(bt_lines)
        bt.update(n=len(bt_lines), status=status, finished=finished)
        batches.append(bt)
        lines.extend(bt_lines)
        audit.append((admin, "batch_created", "batches", str(bt["id"]), {"lignes": len(bt_lines) + bt["rejected"]}, created - timedelta(minutes=3)))
        audit.append((admin, "batch_launched", "batches", str(bt["id"]),
                      {"paiements": len(bt_lines), "actif": asset}, created))

    cur.executemany(
        "INSERT INTO batches (id, owner_id, name, source_asset, status, file_name, rows_in_file, rows_rejected, "
        "is_simulated, created_at, launched_at, finished_at, launched_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,TRUE,%s,%s,%s,%s)",
        [(b["id"], admin, b["name"], b["asset"], b["status"], f"commissions_{b['created']:%Y%m%d}.csv",
          b["n"] + b["rejected"], b["rejected"], b["created"] - timedelta(minutes=3), b["created"], b["finished"], admin)
         for b in batches])
    events = plant_problems(lines, write_payouts(cur, lines), now)
    write_events(cur, events)

    n_env = seed_envelopes(rng, cur, admin, start, now, audit)
    n_inv = seed_invoices(rng, cur, admin, start, now, days, audit)
    cur.executemany(
        "INSERT INTO company_balance_snapshots (asset, balance_minor, taken_at, is_simulated) VALUES (%s,%s,%s,TRUE)",
        [("USDT", to_minor("5240.50", "USDT"), now - timedelta(minutes=30)),
         ("BTC", to_minor("0.0475", "BTC"), now - timedelta(minutes=30))])
    seed_ai_log(cur, admin, now)
    write_audit(cur, audit)
    return {"lots": len(batches), "paiements": len(lines), "essais": sum(len(ln["attempts"]) for ln in lines),
            "webhooks": len(events), "bénéficiaires": len(people), "enveloppes": n_env, "factures": n_inv}


def seed_envelopes(rng, cur, admin, start, now, audit) -> int:
    first_month = date(start.year, start.month, 1)
    months, m = [], first_month
    while m <= now.date():
        months.append(m)
        m = date(m.year + (m.month == 12), m.month % 12 + 1, 1)
    alerts = []
    for name, cat, budget, threshold, spends in ENVELOPES:
        env_id, card = uuid.uuid4(), f"card_sim_{uuid.uuid4().hex[:10]}"
        created = start + timedelta(hours=10)
        cur.execute(
            "INSERT INTO envelopes (id, owner_id, name, category, monthly_budget_minor, low_balance_threshold_minor, "
            "status, bitnob_customer_id, kyc_status, bitnob_card_id, card_last4, created_by, is_simulated, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,'active',%s,'verified',%s,%s,%s,TRUE,%s)",
            (env_id, admin, name, cat, to_minor(budget, "USD"), to_minor(threshold, "USD"),
             f"cus_sim_{uuid.uuid4().hex[:8]}", card, f"{rng.randint(0, 9999):04d}", admin, created))
        audit.append((admin, "envelope_created", "envelopes", str(env_id), {"budget_usd": budget}, created))
        audit.append((admin, "card_created", "envelopes", str(env_id), {"carte": "virtuelle USD"}, created + timedelta(minutes=2)))
        frozen = False
        for mi, month in enumerate(months):
            month_start = datetime(month.year, month.month, 1, 1, 0, tzinfo=timezone.utc)
            if mi == 0:
                cur.execute(
                    "INSERT INTO envelope_movements (envelope_id, kind, amount_minor, period_month, bitnob_reference, note, "
                    "created_by, occurred_at, is_simulated) VALUES (%s,'funding',%s,%s,%s,'Financement initial',%s,%s,TRUE)",
                    (env_id, to_minor(budget, "USD"), month, f"FUND-SIM-{uuid.uuid4().hex[:8]}", admin, created + timedelta(minutes=5)))
                cur.execute("INSERT INTO envelope_reloads (envelope_id, period_month, amount_minor, movement_id, is_simulated, done_at) "
                            "SELECT %s, %s, amount_minor, id, TRUE, occurred_at FROM envelope_movements "
                            "WHERE envelope_id = %s AND kind = 'funding'", (env_id, month, env_id))
                t_from = created + timedelta(hours=1)
            else:
                at = min(month_start, now - timedelta(minutes=5))
                cur.execute("SELECT reload_envelope(%s, %s, %s, %s)", (env_id, month, f"RELOAD-SIM-{uuid.uuid4().hex[:8]}", at))
                audit.append((None, "envelope_reloaded", "envelopes", str(env_id), {"mois": f"{month:%m/%Y}"}, at))
                t_from = at + timedelta(hours=2)
            t_to = min(datetime(month.year + (month.month == 12), month.month % 12 + 1, 1, tzinfo=timezone.utc),
                       now - timedelta(hours=2))
            if mi > 0 and frozen:
                audit.append((None, "card_unfrozen", "envelopes", str(env_id), {"raison": "rechargement mensuel"}, at))
                frozen = False
            if t_to <= t_from + timedelta(minutes=30):
                continue     # tout début de mois : pas encore de dépense
            current = month == months[-1]
            balance = cur.execute("SELECT envelope_balance(%s)", (env_id,)).fetchone()[0]
            # Meta Ads ce mois-ci : on s'arrête à 14 USD, juste au-dessus du seuil de 10 USD (alerte pendant la démo)
            demo_floor = to_minor(14, "USD") if (current and cat == "ads") else None
            txs = []
            for merchant, lo, hi, count in spends:
                for _ in range(count):
                    amt = to_minor(rng.randint(lo, hi), "USD")
                    txs.append((t_from + (t_to - t_from) * rng.random(), merchant, amt))
            txs.sort()
            if demo_floor is not None:
                txs.append((t_to - timedelta(minutes=10), "META ADS", None))   # complète jusqu'à 14 USD
            alerted = False
            for at, merchant, amt in txs:
                if demo_floor is not None:
                    amt = balance - demo_floor if amt is None else min(amt, balance - demo_floor)
                    if amt <= 0:
                        continue
                ok = balance - amt >= 0
                cur.execute("SELECT record_card_transaction(%s,%s,'debit',%s,%s,%s,%s,%s)",
                            (card, f"TX-SIM-{uuid.uuid4().hex[:12]}", "success" if ok else "declined", amt, at, merchant,
                             None if ok else "Solde insuffisant"))
                if not ok:
                    continue
                balance -= amt
                if balance <= to_minor(threshold, "USD") and not alerted:
                    alerted = True
                    alerts.append((env_id, "ENVELOPE_LOW_BALANCE", "warning",
                                   f"Il reste {to_major(balance, 'USD')} USD sur le budget {name}", at,
                                   None if current else at + timedelta(hours=6)))
                if balance == 0 and not frozen:
                    frozen = True
                    audit.append((None, "card_frozen", "envelopes", str(env_id), {"raison": "budget épuisé"}, at))
            # un remboursement le premier mois pour l'enveloppe Outils, un refus le 2e mois
            if cat == "software" and mi == 0:
                cur.execute("SELECT record_card_transaction(%s,%s,'credit','success',%s,%s,'CANVA')",
                            (card, f"TX-SIM-{uuid.uuid4().hex[:12]}", to_minor(13, "USD"), t_to - timedelta(hours=20)))
            if cat == "software" and mi == 1 and not current:
                cur.execute("SELECT record_card_transaction(%s,%s,'debit','declined',%s,%s,'CHATGPT PLUS','Solde insuffisant')",
                            (card, f"TX-SIM-{uuid.uuid4().hex[:12]}", to_minor(200, "USD"), t_to - timedelta(days=3)))
        # relevé du solde réel chez Bitnob, identique au solde calculé (aucun écart planté ici)
        cur.execute("INSERT INTO card_balance_snapshots (envelope_id, balance_minor, taken_at, is_simulated) "
                    "VALUES (%s, envelope_balance(%s), %s, TRUE)", (env_id, env_id, now - timedelta(minutes=1)))
    cur.executemany(
        "INSERT INTO data_alerts (envelope_id, rule_code, severity, message, created_at, resolved_at, is_simulated) "
        "VALUES (%s,%s,%s,%s,%s,%s,TRUE)", alerts)
    return len(ENVELOPES)


def seed_invoices(rng, cur, admin, start, now, days, audit) -> int:
    rows = []
    plan = ["paid"] * 8 + ["expired"] * 2
    for i, status in enumerate(plan):
        created = start + timedelta(days=rng.randint(1, days - 2), hours=rng.randint(9, 19), minutes=rng.randint(0, 59))
        rows.append((status, created))
    rows.sort(key=lambda r: r[1])
    rows += [("pending", now - timedelta(minutes=12)), ("pending", now - timedelta(minutes=25))]
    out = []
    for i, (status, created) in enumerate(rows, start=1):
        usd = Decimal(rng.randrange(20, 401, 5))
        sats = to_minor((usd / BTC_USD).quantize(Decimal("0.00000001")), "BTC")
        expires = created + timedelta(minutes=60)
        paid_at = created + timedelta(minutes=rng.uniform(1, 40)) if status == "paid" else None
        pr = "lnbc" + str(sats * 10) + "n1p" + "".join(rng.choice(string.ascii_lowercase + string.digits) for _ in range(60))
        number = f"INV-{created:%Y}-{i:04d}"
        out.append((admin, number, rng.choice(CUSTOMERS), "Livraison et services", sats, to_minor(usd, "USD"), "USD",
                    BTC_USD, BTC_USD if paid_at else None, pr, f"inv_sim_{uuid.uuid4().hex[:10]}", status, expires,
                    paid_at, admin, created))
        audit.append((admin, "invoice_created", "invoices", number, {"sats": sats}, created))
    cur.executemany(
        "INSERT INTO invoices (owner_id, number, customer_name, description, amount_sats, reference_minor, reference_currency, "
        "btc_usd_rate_at_creation, btc_usd_rate_at_payment, payment_request, bitnob_invoice_id, status, expires_at, paid_at, "
        "created_by, is_simulated, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE,%s)", out)
    return len(out)


def seed_ai_log(cur, admin, now) -> None:
    conv = uuid.uuid4()
    qa = [
        ("Combien avons-nous payé au Ghana ce mois-ci ?",
         "SELECT SUM(amount_received) FROM v_ai_payouts WHERE country = 'GH' AND status = 'completed' "
         "AND month_utc = date_trunc('month', now())::date"),
        ("Quelles dépenses ont été réglées en Bitcoin ?",
         "SELECT batch_name, COUNT(*) FROM v_ai_payouts WHERE debited_asset = 'BTC' AND status = 'completed' GROUP BY 1"),
        ("Quel pays reçoit le plus de paiements ?",
         "SELECT country, n_completed FROM v_corridors ORDER BY n_completed DESC LIMIT 1"),
        ("Combien reste-t-il sur le budget Meta Ads ?",
         "SELECT balance_usd FROM v_envelope_balances WHERE name = 'Meta Ads'"),
    ]
    cur.executemany(
        "INSERT INTO ai_query_log (user_id, conversation_id, question, generated_sql, row_count, duration_ms, is_simulated, created_at) "
        "VALUES (%s,%s,%s,%s,1,%s,TRUE,%s)",
        [(admin, conv, q, s, 120 + 40 * i, now - timedelta(minutes=40 - 5 * i)) for i, (q, s) in enumerate(qa)])


def scenario_ong(rng, cur, now, days):
    start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0)
    admin = uuid.uuid4()
    cur.execute("INSERT INTO users (id, email, full_name, role, kyc_status, is_simulated, created_at) "
                "VALUES (%s,'admin@ong-sante.test',%s,'admin','verified',TRUE,%s)", (admin, ONG_NAME, start))
    people = []
    for name in sn_names(rng, 160):
        op = weighted(rng, SN_OPERATOR_WEIGHTS)
        people.append({"id": uuid.uuid4(), "name": name, "country": "SN", "currency": "XOF", "phone": sn_phone_for(rng, op),
                       "operator": op, "region": weighted(rng, ONG_REGION_WEIGHTS)})
    phones = set()
    people = [p for p in people if not (p["phone"] in phones or phones.add(p["phone"]))]
    cur.executemany(
        "INSERT INTO beneficiaries (id, owner_id, full_name, country, currency, destination_type, phone_e164, "
        "account_number, bank_code, region, is_simulated, created_at) VALUES (%s,%s,%s,'SN','XOF','mobile_money',%s,%s,%s,%s,TRUE,%s)",
        [(p["id"], admin, p["name"], p["phone"], p["phone"], p["operator"], p["region"], start) for p in people])
    by_region = {r: [p for p in people if p["region"] == r] for r in SN_REGIONS}
    rates = rate_walk(rng, days)
    batches, lines, audit, seq = [], [], [], 0
    for d in range(days + 1):
        day = start + timedelta(days=d)
        live_day = d == days
        n_batches = 1 if live_day else (rng.choice([1, 1, 2]) if day.weekday() == 4 else rng.choice([0, 1, 1]))
        for k in range(n_batches):
            live = live_day and k == 0
            created = now - timedelta(minutes=50) if live else day + timedelta(hours=rng.randint(8, 17), minutes=rng.randint(0, 59))
            if not live and created > now - timedelta(hours=2):
                continue
            prog, lo, hi, step = rng.choice(ONG_PROGRAMS)
            region = weighted(rng, {r: w for r, w in ONG_REGION_WEIGHTS.items() if len(by_region[r]) >= 3})
            pool = people if (live or rng.random() < 0.3) else by_region[region]
            picked = rng.sample(pool, min(rng.randint(20, 40) if live else rng.randint(8, 40), len(pool)))
            bt = {"id": uuid.uuid4(), "name": f"{prog} · {'plusieurs régions' if pool is people else region} · {created:%d/%m}",
                  "created": created, "asset": "USDT", "rejected": rng.choice([0, 0, 1, 2])}
            order = list(range(len(picked)))
            rng.shuffle(order)
            plan = {i: "stuck" for i in order[:2]} | {i: "pending" for i in order[2:8]} if live else {}
            bt_lines = []
            for i, p in enumerate(picked):
                seq += 1
                settle = to_minor(rng.randrange(lo, hi + 1, step), "XOF")
                source, fee, rate = quote(settle, "XOF", "USDT", rates[("XOF", d)])
                t0 = created + timedelta(seconds=2 + 3 * i)
                ref = f"BP-{t0:%Y%m%d}-{seq:05d}"
                if live:
                    outcome = plan.get(i, "completed")
                else:
                    roll = rng.random()
                    outcome = "failed" if roll < FAIL[p["operator"]][0] else "expired" if roll < FAIL[p["operator"]][0] + 0.012 else "completed"
                pend = {"stuck": now - timedelta(minutes=41), "pending": now - timedelta(minutes=rng.randint(2, 9))}.get(outcome)
                att = make_attempt(rng, ref=ref, no=1, t0=t0, outcome="pending" if pend else outcome, op=p["operator"],
                                   pending_at=pend, delay=rng.uniform(1, 30) if live else None)
                bt_lines.append({"id": uuid.uuid4(), "batch_id": bt["id"], "ben_id": p["id"], "ref": ref, "settle": settle,
                                 "currency": "XOF", "country": "SN", "operator": p["operator"], "phone": p["phone"],
                                 "asset": "USDT", "source": source, "fee": fee, "rate": rate, "attempts": [att]})
            status, finished = batch_status(bt_lines)
            bt.update(n=len(bt_lines), status=status, finished=finished)
            batches.append(bt)
            lines.extend(bt_lines)
            audit.append((admin, "batch_launched", "batches", str(bt["id"]), {"paiements": len(bt_lines)}, created))
    cur.executemany(
        "INSERT INTO batches (id, owner_id, name, source_asset, status, file_name, rows_in_file, rows_rejected, "
        "is_simulated, created_at, launched_at, finished_at, launched_by) VALUES (%s,%s,%s,'USDT',%s,%s,%s,%s,TRUE,%s,%s,%s,%s)",
        [(b["id"], admin, b["name"], b["status"], f"paiements_{b['created']:%Y%m%d}.csv", b["n"] + b["rejected"],
          b["rejected"], b["created"] - timedelta(minutes=3), b["created"], b["finished"], admin) for b in batches])
    events = plant_problems(lines, write_payouts(cur, lines), now)
    write_events(cur, events)
    write_audit(cur, audit)
    return {"lots": len(batches), "paiements": len(lines), "webhooks": len(events), "bénéficiaires": len(people)}


def write_events(cur, events) -> None:
    cur.executemany(
        "INSERT INTO webhook_events (event_id, event_type, reference, payload, signature_valid, received_at, "
        "processed_at, is_simulated) VALUES (%s,%s,%s,%s,%s,%s,%s,TRUE)", events)


def write_audit(cur, audit) -> None:
    cur.executemany(
        "INSERT INTO audit_log (user_id, action, entity, entity_id, details, is_simulated, created_at) "
        "VALUES (%s,%s,%s,%s,%s,TRUE,%s)",
        [(u, a, e, i, json.dumps(d), t) for u, a, e, i, d, t in sorted(audit, key=lambda x: x[5])])


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scenario", choices=["bulkpay", "ong"], default="bulkpay")
    ap.add_argument("--days", type=int, help="historique en jours (défaut : 90 pour bulkpay, 30 pour ong)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--reset", action="store_true", help="effacer d'abord les données simulées existantes")
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL"))
    args = ap.parse_args()
    if not args.dsn:
        sys.exit("Définissez DATABASE_URL ou passez --dsn")
    days = args.days or (90 if args.scenario == "bulkpay" else 30)
    if days < 14:
        sys.exit("--days doit valoir au moins 14")

    rng = random.Random(args.seed)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    with psycopg.connect(args.dsn) as conn, conn.cursor() as cur:
        if args.reset:
            reset(cur)
        elif cur.execute("SELECT EXISTS (SELECT 1 FROM users WHERE is_simulated)").fetchone()[0]:
            sys.exit("La base contient déjà des données de démo : ajoutez --reset pour les remplacer")
        counts = (scenario_bulkpay if args.scenario == "bulkpay" else scenario_ong)(rng, cur, now, days)
        conn.commit()
    print("Données de démo (simulées) : " + ", ".join(f"{v} {k}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
