"""Tableau de bord des paiements — lit UNIQUEMENT les vues SQL (sql/views.sql).

Lancer depuis la racine du projet (pour que .streamlit/config.toml soit pris en compte) :
    streamlit run dashboard/app.py
"""
from __future__ import annotations

import html
import os
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import psycopg
import streamlit as st

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from role3.money import fmt, to_major  # noqa: E402
from role3.validation import validate_text  # noqa: E402

st.set_page_config(page_title="Tableau de bord des paiements", page_icon="💸", layout="wide")

# ---------------------------------------------------------------------------
# Libellés en français simple
# ---------------------------------------------------------------------------
COUNTRY = {"NG": "Nigeria", "GH": "Ghana", "SN": "Sénégal", "KE": "Kenya", "CI": "Côte d'Ivoire"}
MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
BAR = "#2a78d6"   # palette de référence, slot 1

ISSUES = {
    "STUCK": ("Paiements bloqués", "En attente depuis plus de 15 minutes.",
              "Interroger Bitnob sur leur statut. Le succès ne compte qu'à la réception du webhook."),
    "QUOTE_EXPIRED_OPEN": ("Cotations expirées", "Le taux proposé a expiré avant l'envoi.",
                           "Demander une nouvelle cotation puis relancer."),
    "COMPLETED_WITHOUT_WEBHOOK": ("Réussis sans confirmation", "Marqués réussis chez nous, sans confirmation de Bitnob.",
                                  "Vérifier le paiement chez Bitnob avant de le compter."),
    "WEBHOOK_NOT_APPLIED": ("Confirmations non prises en compte", "Bitnob a confirmé, notre statut n'a pas suivi.",
                            "Mettre à jour le statut du paiement."),
    "AMOUNT_MISMATCH": ("Écart de montant", "Le bénéficiaire n'a pas reçu le montant prévu.",
                        "Comparer la cotation et la confirmation, contacter Bitnob."),
    "UNKNOWN_REFERENCE": ("Confirmation inconnue", "Bitnob confirme un paiement que nous ne connaissons pas.",
                          "Rechercher l'origine de ce paiement."),
    "INVALID_SIGNATURE": ("Message suspect rejeté", "Un message prétendant venir de Bitnob avait une signature invalide.",
                          "Rien à faire : il a été bloqué. Surveiller s'il se répète."),
    "ENVELOPE_BALANCE_MISMATCH": ("Écart sur une carte", "Le solde calculé d'une enveloppe diffère du solde réel de sa carte.",
                                  "Relire les transactions de la carte chez Bitnob : une transaction a peut-être été manquée."),
    "CARD_NOT_FROZEN": ("Carte à geler", "Le budget de l'enveloppe est épuisé mais la carte est encore active.",
                        "Geler la carte (le backend doit le faire automatiquement)."),
    "RELOAD_MISSING": ("Rechargement oublié", "Le rechargement mensuel de l'enveloppe n'a pas eu lieu.",
                       "Vérifier la tâche planifiée de rechargement."),
    "INVOICE_NOT_EXPIRED": ("Facture à clôturer", "Une facture en attente a dépassé sa date d'expiration.",
                            "Lancer expire_invoices() (tâche planifiée du backend)."),
}
REASON = {"(expirée)": "Cotation expirée avant l'envoi"}
OPERATOR = {"WAVE": "Wave", "ORANGE_MONEY": "Orange Money", "FREE_MONEY": "Free Money", "EXPRESSO": "Expresso",
            "MTN": "MTN MoMo", "MPESA": "M-Pesa", "MOOV": "Moov Money", "AIRTEL": "Airtel Money",
            "ACCESS_BANK": "Access Bank", "GTBANK": "GTBank", "OPAY": "OPay"}
CHECKS = {
    "batch_counts_add_up": "Dans chaque lot, réussis + échoués + en cours = nombre total de paiements",
    "rates_between_0_and_1": "Aucun taux de réussite n'est inférieur à 0 % ou supérieur à 100 %",
    "kpi_volume_equals_daily_sum": "Le montant total est bien égal à la somme des montants de chaque jour",
    "kpi_count_equals_corridor_sum": "Le nombre total de paiements est bien égal à la somme des pays",
    "history_matches_status": "L'historique de chaque paiement correspond à son état actuel",
    "currency_matches_beneficiary": "Chaque paiement est fait dans la devise du pays du bénéficiaire",
    "simulated_flag_consistent": "Les données de démonstration ne sont jamais mélangées aux vraies",
    "kpi_volume_equals_monthly_sum": "Le montant total est bien égal à la somme des montants de chaque mois",
    "kpi_all_equals_sum_by_asset": "Les totaux tous actifs (USDT + BTC) correspondent aux totaux par actif",
    "kpi_count_equals_currency_sum": "Le nombre total de paiements est bien égal à la somme des devises",
    "region_sum_equals_total": "Le nombre total de paiements est bien égal à la somme des régions",
    "one_success_per_payout": "Personne n'a été payé deux fois pour la même ligne, même après une relance",
    "payout_matches_last_attempt": "L'état de chaque paiement est celui de son dernier essai",
    "every_payout_has_attempt": "Chaque paiement d'un lot lancé a bien été envoyé à Bitnob",
    "envelope_balance_not_negative": "Aucune enveloppe budgétaire n'a un solde négatif",
    "card_spend_matches_ledger": "Chaque dépense de carte est comptée une fois, et une seule, dans son enveloppe",
    "reload_matches_movement": "Chaque rechargement mensuel correspond bien à l'argent ajouté",
    "launched_batch_is_audited": "Chaque lot lancé est inscrit dans le journal d'audit (qui, quand)",
}

# ---------------------------------------------------------------------------
# Style
# ---------------------------------------------------------------------------
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root{
  --ink:#17201D; --muted:#5B6863; --faint:#8A9590; --line:#E3E8E6; --card:#FFFFFF; --bg:#F5F7F6;
  --brand:#0B5D4B; --brand-soft:#E7F1EE;
  --good:#15803D; --good-soft:#E8F6EC; --warn:#B45309; --warn-soft:#FDF3E2; --bad:#B91C1C; --bad-soft:#FDECEC;
}
html, body, [class*="css"], .stApp, .stMarkdown, button, input { font-family:'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; }
.stApp { background: var(--bg); }
.block-container { max-width: 1240px; padding-top: 1.6rem; padding-bottom: 4rem; }
header[data-testid="stHeader"] { background: transparent; }
[data-testid="stToolbar"] { display:none; }

/* En-tête */
.top { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
.brand { display:flex; align-items:center; gap:14px; }
.logo { width:46px; height:46px; border-radius:12px; background:var(--brand); color:#fff; display:flex; align-items:center;
        justify-content:center; font-weight:800; font-size:18px; letter-spacing:-.02em; }
.brand h1 { font-size:24px; font-weight:800; color:var(--ink); margin:0; padding:0; letter-spacing:-.02em; line-height:1.2; }
.brand p { margin:2px 0 0; color:var(--muted); font-size:14px; }
.pill { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; font-size:13px; font-weight:600; }
.pill.sim { background:var(--warn-soft); color:var(--warn); border:1px solid #F2D49B; }

/* Phrase résumé */
.summary { background:var(--card); border:1px solid var(--line); border-left:5px solid var(--brand); border-radius:14px;
           padding:16px 20px; font-size:16.5px; line-height:1.6; color:var(--ink); margin-bottom:18px; }
.summary b { color:var(--brand); }

/* Cartes KPI */
.kpis { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:14px; margin-bottom:18px; }
@media (max-width: 1000px){ .kpis{ grid-template-columns:repeat(2, minmax(0,1fr)); } }
.kpi { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px 18px; }
.kpi .lbl { font-size:13px; color:var(--muted); font-weight:600; display:flex; align-items:center; gap:7px; }
.kpi .ico { width:26px; height:26px; border-radius:8px; background:var(--brand-soft); display:inline-flex; align-items:center; justify-content:center; font-size:14px; }
.kpi .val { font-size:28px; font-weight:800; color:var(--ink); margin-top:10px; letter-spacing:-.02em; white-space:nowrap; line-height:1.1; }
.kpi .val small { font-size:15px; font-weight:600; color:var(--muted); margin-left:4px; }
.kpi .sub { font-size:13px; color:var(--muted); margin-top:6px; }

/* Cartes génériques */
.card-title { font-size:17px; font-weight:700; color:var(--ink); margin:0 0 2px; }
.card-sub { font-size:13.5px; color:var(--muted); margin:0 0 6px; }
.st-key-chart_card, .st-key-fail_card, .st-key-region_card, .st-key-report_card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px; }

/* Corridors */
.corr { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; }
@media (max-width: 1000px){ .corr{ grid-template-columns:repeat(2, minmax(0,1fr)); } }
.cc { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px 18px; }
.cc .head { display:flex; align-items:center; gap:10px; }
.cc .code { font-size:12px; font-weight:800; color:var(--brand); background:var(--brand-soft); border-radius:6px; padding:3px 7px; letter-spacing:.04em; }
.cc .name { font-size:16px; font-weight:700; color:var(--ink); }
.cc .rate { font-size:26px; font-weight:800; margin-top:12px; color:var(--ink); letter-spacing:-.02em; }
.cc .rate span { font-size:13px; font-weight:600; color:var(--muted); margin-left:6px; letter-spacing:0; }
.track { height:8px; background:#EEF2F0; border-radius:99px; margin:8px 0 12px; overflow:hidden; }
.fill { height:100%; border-radius:99px; background:var(--good); }
.cc .row { display:flex; justify-content:space-between; font-size:13.5px; color:var(--muted); padding:3px 0; }
.cc .row b { color:var(--ink); font-weight:600; }

@media (max-width: 640px){ .corr, .kpis, .vgrid { grid-template-columns:1fr; } .kpi .val{font-size:26px;} }

/* Raisons d'échec */
.rs { display:flex; flex-direction:column; gap:12px; margin-top:6px; }
.r .top2 { display:flex; justify-content:space-between; font-size:14px; color:var(--ink); }
.r .top2 b { font-weight:700; }
.r .bar { height:10px; background:#EEF2F0; border-radius:99px; margin-top:6px; overflow:hidden; }
.r .bar div { height:100%; background:#94A3A0; border-radius:99px; }
.r .where { font-size:12.5px; color:var(--faint); margin-top:4px; }

/* Alertes */
.alerts { display:flex; flex-direction:column; gap:12px; }
.al { background:var(--card); border:1px solid var(--line); border-left:5px solid var(--bad); border-radius:14px; padding:16px 18px; }
.al.warn { border-left-color:var(--warn); }
.al .h { display:flex; align-items:center; gap:10px; font-size:16px; font-weight:700; color:var(--ink); }
.al .n { background:var(--bad-soft); color:var(--bad); border-radius:99px; padding:2px 10px; font-size:13px; font-weight:700; }
.al.warn .n { background:var(--warn-soft); color:var(--warn); }
.al .what { color:var(--muted); font-size:14px; margin-top:6px; }
.al .todo { font-size:14px; margin-top:8px; color:var(--ink); }
.al .refs { font-family:ui-monospace, Consolas, monospace; font-size:12.5px; color:var(--muted); margin-top:8px; line-height:1.7; }

/* Bandeaux d'état */
.state { border-radius:14px; padding:18px 20px; font-size:16px; font-weight:600; display:flex; gap:12px; align-items:center; margin-bottom:14px; }
.state.ok { background:var(--good-soft); color:var(--good); border:1px solid #BFE3CA; }
.state.ko { background:var(--bad-soft); color:var(--bad); border:1px solid #F3C4C4; }
.checks { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:6px 18px; }
.ck { display:flex; gap:12px; align-items:flex-start; padding:12px 0; border-bottom:1px solid var(--line); font-size:15px; color:var(--ink); }
.ck:last-child { border-bottom:none; }
.ck .m { width:24px; height:24px; border-radius:99px; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; flex:none; }
.ck .m.ok { background:var(--good-soft); color:var(--good); }
.ck .m.ko { background:var(--bad-soft); color:var(--bad); }

/* Validation */
.vgrid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:14px; margin:6px 0 14px; }
.vc { border-radius:14px; padding:16px 18px; border:1px solid var(--line); background:var(--card); }
.vc .big { font-size:34px; font-weight:800; letter-spacing:-.02em; }
.vc .t { font-size:14px; font-weight:600; }
.vc.ok .big, .vc.ok .t { color:var(--good); }
.vc.warn .big, .vc.warn .t { color:var(--warn); }
.vc.bad .big, .vc.bad .t { color:var(--bad); }
.note { font-size:14px; color:var(--muted); background:var(--card); border:1px dashed var(--line); border-radius:12px; padding:12px 16px; margin:4px 0 12px; }

/* Onglets */
[role="tablist"] { gap:4px; margin-bottom:6px; }
[data-testid="stTab"] { padding:10px 14px !important; }
[data-testid="stTab"] p { font-size:15.5px !important; font-weight:600 !important; color:var(--muted); }
[data-testid="stTab"][aria-selected="true"] p { color:var(--brand) !important; }
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Données
# ---------------------------------------------------------------------------
@st.cache_resource
def connect():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        st.error("La variable DATABASE_URL n'est pas définie dans ce terminal.")
        st.stop()
    return psycopg.connect(dsn, autocommit=True)


@st.cache_data(ttl=30)
def q(sql: str) -> pd.DataFrame:
    with connect().cursor() as cur:
        cur.execute(sql)
        return pd.DataFrame(cur.fetchall(), columns=[c.name for c in cur.description])


def e(x) -> str:
    return html.escape(str(x))


def num(n, decimals: int = 0) -> str:
    """1 234 567 ou 95,2 — à la française."""
    s = f"{float(n):,.{decimals}f}"
    return s.replace(",", " ").replace(".", ",")


def amount(minor: int, ccy: str, decimals: int | None = None) -> str:
    major = float(to_major(int(minor), ccy))
    d = decimals if decimals is not None else (0 if major >= 1000 else 2)
    return f"{num(major, d)} {ccy}"


def day_fr(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]}"


def plural(n, word: str) -> str:
    n = int(n)
    return f"{num(n)} {word}{'s' if n > 1 else ''}"


def pct(x) -> str:
    return "—" if x is None or pd.isna(x) else f"{num(float(x) * 100, 1)} %"


kpis = q("SELECT * FROM v_kpis ORDER BY payouts_total DESC")
tot = q("SELECT * FROM v_kpis_all").iloc[0]
if kpis.empty:
    st.info("Aucune donnée pour l'instant. Lancez `python scripts/seed.py --reset` pour générer des données de démonstration.")
    st.stop()

k = kpis.iloc[0]
asset = k.source_asset
daily = q(f"SELECT day_utc, volume_source_minor, payouts_completed FROM v_daily_volume "
          f"WHERE source_asset = '{asset}' ORDER BY day_utc")
corr = q("SELECT * FROM v_corridors ORDER BY n_total DESC")
ops = q("SELECT * FROM v_operators ORDER BY n_total DESC")
regs = q("SELECT * FROM v_regions WHERE region <> 'Non renseignée' ORDER BY settled_minor DESC")
org = q("SELECT full_name FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1")
org_name = org.full_name.iloc[0] if not org.empty and org.full_name.iloc[0] else "Paiements"
ccys = list(corr["settlement_currency"].unique())
one_ccy = ccys[0] if len(ccys) == 1 else None
known_ops = ops[ops["operator"] != "Non renseigné"]
issues = q("SELECT issue_type, reference, detail FROM v_reconciliation_issues")
checks = q("SELECT check_name, description, violations FROM v_consistency_checks")

first, last = daily["day_utc"].min(), daily["day_utc"].max()
n_days = (last - first).days + 1
terminal = int(tot.payouts_completed + tot.payouts_failed + tot.payouts_expired)
per100 = round(float(tot.success_rate) * 100) if terminal else 0
others = kpis.iloc[1:]   # autres actifs débités (BTC...) : jamais additionnés à l'actif principal
others_txt = " + ".join(amount(int(o.volume_source_minor), o.source_asset, 4 if o.source_asset == "BTC" else 2)
                        for o in others.itertuples())
assets_txt = " et ".join(kpis.source_asset)
n_issues = len(issues)

# ---------------------------------------------------------------------------
# En-tête
# ---------------------------------------------------------------------------
if len(regs) and len(corr) == 1:
    where_txt = f"dans <b>{len(regs)} régions</b> du {e(COUNTRY.get(corr.country.iloc[0], ''))}"
else:
    where_txt = f"dans <b>{num(tot.countries)} pays</b>"
total_txt = f", pour un total de <b>{amount(int(corr.settled_minor.sum()), one_ccy, 0)}</b>" if one_ccy else ""
sim = ('<span class="pill sim">⚠ Données simulées pour la démonstration</span>'
       if bool(k.contains_simulated_data) else "")
st.markdown(f"""
<div class="top">
  <div class="brand">
    <div class="logo">BP</div>
    <div><h1>Tableau de bord des paiements</h1>
    <p>{e(org_name)} · du {day_fr(first)} au {day_fr(last)} {last.year} · financés en {e(assets_txt)}</p></div>
  </div>
  {sim}
</div>
<div class="summary">
  En {n_days} jours, <b>{num(tot.payouts_completed)} paiements</b> sont arrivés chez
  <b>{num(tot.beneficiaries_paid)} bénéficiaires</b> {where_txt}{total_txt}.
  Sur 100 paiements, <b>{per100} arrivent à destination</b>, en <b>{num(tot.median_delay_minutes, 0)} minutes</b> en général.
  {f"<b>{num(tot.payouts_retried)} paiements</b> ont été relancés après un échec, sans jamais payer deux fois la même personne." if tot.payouts_retried else ""}
  {f"<b>{n_issues} point(s)</b> demandent votre attention (onglet « À surveiller »)." if n_issues else "Rien ne demande votre attention."}
</div>
""", unsafe_allow_html=True)

envs = q("SELECT * FROM v_envelope_balances ORDER BY monthly_budget_minor DESC")
invs = q("SELECT * FROM v_invoices ORDER BY created_at DESC")
tab_names = ["Vue d'ensemble", f"À surveiller ({n_issues})", "Lots de paiements"]
if not envs.empty or not invs.empty:
    tab_names.append("Budgets et factures")
tab_names += ["Rapport à exporter", "Vérifier un fichier", "Fiabilité des chiffres"]
tabs = dict(zip(tab_names, st.tabs(tab_names)))
tab_home, tab_alerts, tab_batches = tabs["Vue d'ensemble"], tabs[tab_names[1]], tabs["Lots de paiements"]
tab_budget = tabs.get("Budgets et factures")
tab_report, tab_file, tab_checks = tabs["Rapport à exporter"], tabs["Vérifier un fichier"], tabs["Fiabilité des chiffres"]

# ---------------------------------------------------------------------------
# Vue d'ensemble
# ---------------------------------------------------------------------------
with tab_home:
    def kpi(icon, label, value, unit, sub):
        u = f"<small>{e(unit)}</small>" if unit else ""
        return (f'<div class="kpi"><div class="lbl"><span class="ico">{icon}</span>{e(label)}</div>'
                f'<div class="val">{value}{u}</div><div class="sub">{sub}</div></div>')

    vol = float(to_major(int(k.volume_source_minor), asset))
    fees = float(to_major(int(k.fees_source_minor), asset))
    st.markdown('<div class="kpis">' + "".join([
        (kpi("💰", "Montant reçu", num(float(to_major(int(corr.settled_minor.sum()), one_ccy))), one_ccy,
             f"par les bénéficiaires · {num(vol)} {asset} envoyés") if one_ccy else
         kpi("💰", "Montant envoyé", num(vol), asset,
             f"+ {others_txt} · réussis uniquement" if others_txt else "paiements réussis uniquement")),
        kpi("✅", "Paiements réussis", num(tot.payouts_completed), "", f"sur {num(tot.payouts_total)} lancés"),
        kpi("🎯", "Taux de réussite", num(float(tot.success_rate) * 100, 1), "%", f"{num(tot.payouts_failed + tot.payouts_expired)} échecs, {num(tot.payouts_in_progress)} en cours"),
        kpi("⏱️", "Délai habituel", num(tot.median_delay_minutes, 1), "min", "entre l'envoi et l'arrivée"),
        kpi("🧾", "Frais payés", num(fees, 2), asset, f"soit {num(fees / vol * 100, 1) if vol else 0} % du montant en {asset}"),
    ]) + "</div>", unsafe_allow_html=True)

    with st.container(key="chart_card"):
        st.markdown(f'<p class="card-title">Montant envoyé chaque jour</p>'
                    f'<p class="card-sub">En {e(asset)}{" (les lots réglés en " + e(", ".join(others.source_asset)) + " sont comptés à part)" if len(others) else ""}. '
                    f'Survolez une barre pour voir le détail.</p>', unsafe_allow_html=True)
        d = daily.copy()
        d["v"] = d["volume_source_minor"].map(lambda m: float(to_major(int(m), asset)))
        d["label"] = d["day_utc"].map(day_fr)
        d["vtxt"] = d["v"].map(lambda v: num(v))
        ticks = d.iloc[::7]
        fig = go.Figure(go.Bar(
            x=d["day_utc"], y=d["v"], marker=dict(color=BAR, cornerradius=4), marker_line_width=0,
            customdata=list(zip(d["label"], d["vtxt"], d["payouts_completed"])),
            hovertemplate="<b>%{customdata[0]}</b><br>%{customdata[1]} " + asset +
                          "<br>%{customdata[2]} paiements réussis<extra></extra>",
        ))
        fig.update_layout(
            height=300, margin=dict(l=4, r=4, t=8, b=4), bargap=0.3, showlegend=False,
            plot_bgcolor="white", paper_bgcolor="white", separators=", ",
            font=dict(family="Inter, Segoe UI, sans-serif", size=13, color="#5B6863"),
            yaxis=dict(gridcolor="#EEF2F0", zeroline=False, tickformat=",.0f", title=None),
            xaxis=dict(showgrid=False, title=None, tickvals=ticks["day_utc"], ticktext=ticks["label"]),
            hoverlabel=dict(bgcolor="white", bordercolor="#E3E8E6", font=dict(color="#17201D", size=13)),
        )
        st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})

    legend = ('<span style="color:var(--good);font-weight:600">● vert</span> : 95 % ou plus · '
              '<span style="color:var(--warn);font-weight:600">● orange</span> : entre 90 et 95 % · '
              '<span style="color:var(--bad);font-weight:600">● rouge</span> : moins de 90 %.')

    def rate_card(code, name, rate_v, n_total, settled, ccy, delay):
        rate = float(rate_v) if rate_v is not None and not pd.isna(rate_v) else 0
        color = "var(--good)" if rate >= 0.95 else "var(--warn)" if rate >= 0.9 else "var(--bad)"
        return f"""
        <div class="cc"><div class="head"><span class="code">{e(code)}</span><span class="name">{e(name)}</span></div>
        <div class="rate">{pct(rate_v)}<span>de réussite</span></div>
        <div class="track"><div class="fill" style="width:{rate*100:.1f}%;background:{color}"></div></div>
        <div class="row"><span>Paiements</span><b>{num(n_total)}</b></div>
        <div class="row"><span>Montant reçu</span><b>{amount(settled, ccy, 0)}</b></div>
        <div class="row"><span>Délai habituel</span><b>{num(delay or 0, 1)} min</b></div></div>"""

    if len(corr) > 1:
        st.markdown('<p class="card-title" style="margin-top:22px">Par pays</p>'
                    f'<p class="card-sub">Taux de réussite, montant reçu et délai habituel. {legend}</p>',
                    unsafe_allow_html=True)
        st.markdown('<div class="corr">' + "".join(
            rate_card(c.country, COUNTRY.get(c.country, c.country), c.success_rate, c.n_total,
                      c.settled_minor, c.settlement_currency, c.median_delay_minutes)
            for c in corr.itertuples()) + "</div>", unsafe_allow_html=True)

    if not known_ops.empty:
        st.markdown('<p class="card-title" style="margin-top:22px">Par opérateur ou banque</p>'
                    f'<p class="card-sub">Quel wallet reçoit le mieux et le plus vite. {legend}</p>',
                    unsafe_allow_html=True)
        st.markdown('<div class="corr">' + "".join(
            rate_card(c.country, OPERATOR.get(c.operator, c.operator), c.success_rate, c.n_total,
                      c.settled_minor, c.settlement_currency, c.median_delay_minutes)
            for c in known_ops.itertuples()) + "</div>", unsafe_allow_html=True)

    if not regs.empty:
        st.markdown('<p class="card-title" style="margin-top:22px">Où va l\'argent : par région</p>'
                    '<p class="card-sub">Montant reçu par les bénéficiaires, de la région qui reçoit le plus '
                    'à celle qui reçoit le moins.</p>', unsafe_allow_html=True)
        top_r = int(regs["settled_minor"].max()) or 1
        rows_r = "".join(
            f'<div class="r"><div class="top2"><span><b>{e(r.region)}</b></span>'
            f'<b>{amount(r.settled_minor, r.settlement_currency, 0)}</b></div>'
            f'<div class="bar"><div style="width:{int(r.settled_minor) / top_r * 100:.0f}%;background:var(--brand)"></div></div>'
            f'<div class="where">{plural(r.beneficiaries_paid, "bénéficiaire")} payé{"s" if r.beneficiaries_paid > 1 else ""} · {plural(r.n_completed, "paiement")} · '
            f'{pct(r.success_rate)} de réussite</div></div>'
            for r in regs.itertuples())
        with st.container(key="region_card"):
            st.markdown(f'<div class="rs">{rows_r}</div>', unsafe_allow_html=True)

    st.markdown('<p class="card-title" style="margin-top:22px">Pourquoi certains paiements échouent</p>'
                '<p class="card-sub">De la cause la plus fréquente à la plus rare.</p>',
                unsafe_allow_html=True)
    fr = q("SELECT reason, country, n FROM v_failure_reasons")
    if fr.empty:
        st.markdown('<div class="note">Aucun échec sur la période.</div>', unsafe_allow_html=True)
    else:
        fr["reason"] = fr["reason"].map(lambda r: REASON.get(r, r))
        agg = fr.groupby("reason").agg(n=("n", "sum"), pays=("country", lambda s: sorted(set(s)))).sort_values("n", ascending=False)
        top = int(agg["n"].max())
        rows = "".join(
            f'<div class="r"><div class="top2"><span>{e(reason)}</span><b>{int(r.n)}</b></div>'
            f'<div class="bar"><div style="width:{int(r.n) / top * 100:.0f}%"></div></div>'
            + (f'<div class="where">{e(", ".join(COUNTRY.get(c, c) for c in r.pays))}</div>' if len(corr) > 1 else "")
            + '</div>'
            for reason, r in agg.iterrows())
        with st.container(key="fail_card"):
            st.markdown(f'<div class="rs">{rows}</div>', unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# À surveiller
# ---------------------------------------------------------------------------
with tab_alerts:
    if issues.empty:
        st.markdown('<div class="state ok">✓ Rien à signaler : chaque paiement envoyé est confirmé par Bitnob.</div>',
                    unsafe_allow_html=True)
    else:
        st.markdown(f'<div class="state ko">❗ {n_issues} point(s) à traiter. Chaque carte explique le problème et quoi faire.</div>',
                    unsafe_allow_html=True)
        blocks = []
        order = ["AMOUNT_MISMATCH", "STUCK", "WEBHOOK_NOT_APPLIED", "COMPLETED_WITHOUT_WEBHOOK", "CARD_NOT_FROZEN",
                 "ENVELOPE_BALANCE_MISMATCH", "QUOTE_EXPIRED_OPEN", "RELOAD_MISSING", "INVOICE_NOT_EXPIRED",
                 "UNKNOWN_REFERENCE", "INVALID_SIGNATURE"]
        for t in order + [x for x in issues.issue_type.unique() if x not in order]:
            g = issues[issues.issue_type == t]
            if g.empty:
                continue
            title, what, todo = ISSUES.get(t, (t, "", ""))
            tone = "warn" if t in ("INVALID_SIGNATURE", "UNKNOWN_REFERENCE", "QUOTE_EXPIRED_OPEN", "RELOAD_MISSING",
                                   "INVOICE_NOT_EXPIRED") else ""
            shown = g.head(6)
            refs = "<br>".join(f"{e(r.reference)} · {e(r.detail)}" for r in shown.itertuples())
            more = f"<br>… et {len(g) - len(shown)} autre(s)" if len(g) > len(shown) else ""
            blocks.append(f'<div class="al {tone}"><div class="h">{e(title)}<span class="n">{len(g)}</span></div>'
                          f'<div class="what">{e(what)}</div><div class="todo"><b>À faire :</b> {e(todo)}</div>'
                          f'<div class="refs">{refs}{more}</div></div>')
        st.markdown('<div class="alerts">' + "".join(blocks) + "</div>", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Lots
# ---------------------------------------------------------------------------
with tab_batches:
    b = q("SELECT * FROM v_batch_summary ORDER BY created_at DESC")
    labels = {"draft": "Brouillon", "validated": "Prêt", "running": "⏳ En cours", "completed": "✅ Terminé",
              "partial": "⚠️ Terminé avec échecs", "failed": "❌ Échoué", "cancelled": "Annulé"}
    st.markdown('<p class="card-title">Tous les lots de paiements</p>'
                '<p class="card-sub">Un lot = un fichier de bénéficiaires envoyé en une fois. Le plus récent en haut.</p>',
                unsafe_allow_html=True)
    table = pd.DataFrame({
        "Lot": b["name"],
        "État": b["batch_status"].map(labels),
        "Date": pd.to_datetime(b["created_at"]).map(lambda t: f"{day_fr(t)} à {t:%H:%M}"),
        "Paiements": b["n_total"],
        "Réussis": b["n_completed"],
        "Échoués": b["n_failed"] + b["n_expired"],
        "En cours": b["n_in_progress"],
        "Relancés": b["n_retried"],
        "Réussite": b["success_rate"].astype(float) * 100,
        "Montant": [amount(v, a, 2) for v, a in zip(b["volume_source_minor"], b["source_asset"])],
    })
    st.dataframe(table, hide_index=True, width="stretch", height=560, column_config={
        "Réussite": st.column_config.ProgressColumn("Réussite", format="%.0f %%", min_value=0, max_value=100),
    })

# ---------------------------------------------------------------------------
# Budgets (enveloppes et cartes virtuelles) et factures Bitcoin
# ---------------------------------------------------------------------------
if tab_budget is not None:
    with tab_budget:
        if not envs.empty:
            st.markdown('<p class="card-title">Enveloppes budgétaires</p>'
                        '<p class="card-sub">Chaque enveloppe a sa carte virtuelle en USD. Le solde est recalculé à partir de '
                        'chaque transaction et comparé au solde réel de la carte chez Bitnob. La barre montre la part du budget du mois '
                        'déjà dépensée.</p>', unsafe_allow_html=True)
            tone = {"ok": "var(--good)", "low": "var(--warn)", "exhausted": "var(--bad)"}
            state = {"active": "Carte active", "frozen": "Carte gelée", "pending_kyc": "Vérification d'identité en cours",
                     "closed": "Carte fermée"}
            cards = []
            for v in envs.itertuples():
                used = min(float(v.budget_used_ratio or 0), 1.0)
                cards.append(f"""
                <div class="cc"><div class="head"><span class="code">••••{e(v.card_last4 or "")}</span><span class="name">{e(v.name)}</span></div>
                <div class="rate">{num(float(v.balance_usd), 2)} $<span>restants sur {num(float(v.monthly_budget_usd))} $</span></div>
                <div class="track"><div class="fill" style="width:{used * 100:.0f}%;background:{tone[v.alert_level]}"></div></div>
                <div class="row"><span>Dépensé ce mois</span><b>{num(float(v.spent_this_month_usd), 2)} $</b></div>
                <div class="row"><span>État</span><b style="color:{tone[v.alert_level]}">{e(v.alert_label)}</b></div>
                <div class="row"><span>Carte</span><b>{e(state.get(v.status, v.status))}</b></div></div>""")
            st.markdown('<div class="corr" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + "".join(cards) + "</div>",
                        unsafe_allow_html=True)
            spend = q("SELECT envelope, merchant, SUM(n_spends) AS n, SUM(spent_usd) AS usd, SUM(n_declined) AS refus "
                      "FROM v_envelope_spending GROUP BY 1, 2 ORDER BY usd DESC")
            if not spend.empty:
                st.markdown('<p class="card-title" style="margin-top:22px">Dépenses par marchand</p>'
                            '<p class="card-sub">Sur toute la période, transactions réussies (et paiements refusés par la carte).</p>',
                            unsafe_allow_html=True)
                st.dataframe(spend.rename(columns={"envelope": "Enveloppe", "merchant": "Marchand", "n": "Paiements",
                                                   "usd": "Montant (USD)", "refus": "Refusés"}),
                             hide_index=True, width="stretch",
                             column_config={"Montant (USD)": st.column_config.NumberColumn(format="localized")})
        if not invs.empty:
            sm = q("SELECT * FROM v_invoice_summary")
            n_by = dict(zip(sm.effective_status, sm.n_invoices))
            sats_paid = int(sm.loc[sm.effective_status == "paid", "total_sats"].sum())
            st.markdown(f"""
            <p class="card-title" style="margin-top:22px">Factures Bitcoin (Lightning)</p>
            <p class="card-sub">Le client scanne le QR code avec son portefeuille ; la facture passe à « Payée » à la réception du paiement.</p>
            <div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
              <div class="kpi"><div class="lbl"><span class="ico">✅</span>Payées</div><div class="val">{num(n_by.get("paid", 0))}</div>
                <div class="sub">{num(sats_paid)} sats reçus</div></div>
              <div class="kpi"><div class="lbl"><span class="ico">⏳</span>En attente</div><div class="val">{num(n_by.get("pending", 0))}</div>
                <div class="sub">QR code encore valable</div></div>
              <div class="kpi"><div class="lbl"><span class="ico">⌛</span>Expirées</div><div class="val">{num(n_by.get("expired", 0))}</div>
                <div class="sub">non payées à temps</div></div>
              <div class="kpi"><div class="lbl"><span class="ico">₿</span>Reçu en BTC</div>
                <div class="val">{num(float(to_major(sats_paid, "BTC")), 4)}<small>BTC</small></div><div class="sub">factures payées</div></div>
            </div>""", unsafe_allow_html=True)
            st.dataframe(pd.DataFrame({
                "Facture": invs["number"],
                "Client": invs["customer_name"],
                "Montant (sats)": invs["amount_sats"],
                "Contre-valeur": [f"{num(float(m), 2)} {c}" if c else "" for m, c in zip(invs["reference_major"], invs["reference_currency"])],
                "Statut": invs["status_label"],
                "Créée le": pd.to_datetime(invs["created_at"]).map(lambda t: f"{day_fr(t)} à {t:%H:%M}"),
                "Payée en": invs["minutes_to_pay"].map(lambda m: "" if pd.isna(m) else f"{num(float(m), 0)} min"),
            }), hide_index=True, width="stretch", column_config={
                "Montant (sats)": st.column_config.NumberColumn(format="localized")})

# ---------------------------------------------------------------------------
# Rapport à exporter
# ---------------------------------------------------------------------------
with tab_report:
    st.markdown('<p class="card-title">Rapport des paiements</p>'
                '<p class="card-sub">Pour la comptabilité ou un bailleur : qui a été payé, combien, où et par quel opérateur. '
                'Choisissez une période ou des lots, puis téléchargez le rapport Excel.</p>', unsafe_allow_html=True)
    rep = q("SELECT * FROM v_donor_report ORDER BY date_paiement DESC")
    if rep.empty:
        st.markdown('<div class="note">Aucun paiement à rapporter.</div>', unsafe_allow_html=True)
    else:
        rep["date_paiement"] = pd.to_datetime(rep["date_paiement"], utc=True)
        dmin, dmax = rep["date_paiement"].min().date(), rep["date_paiement"].max().date()
        f1, f2 = st.columns([1, 2])
        period = f1.date_input("Période", (dmin, dmax), min_value=dmin, max_value=dmax, format="DD/MM/YYYY")
        lots = f2.multiselect("Lots", sorted(rep["lot"].dropna().unique()), placeholder="Tous les lots")
        d0, d1 = (period[0], period[1]) if isinstance(period, (tuple, list)) and len(period) == 2 else (dmin, dmax)
        sel = rep[(rep["date_paiement"].dt.date >= d0) & (rep["date_paiement"].dt.date <= d1)]
        if lots:
            sel = sel[sel["lot"].isin(lots)]

        for col in ("montant_recu", "montant_debite", "frais", "taux"):
            sel = sel.assign(**{col: pd.to_numeric(sel[col], errors="coerce")})
        paid = sel[sel["statut"] == "Payé"]
        ccy_r = paid["devise"].iloc[0] if paid["devise"].nunique() == 1 else None
        total_recu = paid["montant_recu"].sum()

        def by_asset(col: str) -> str:
            """Somme par actif débité : USDT et BTC ne s'additionnent jamais."""
            g = paid.groupby("actif_debite")[col].sum()
            return " · ".join(f"{num(v, 6 if a == 'BTC' else 2)} {a}" for a, v in g.items()) or "—"
        one_asset = paid["actif_debite"].nunique() <= 1
        st.markdown(f"""
        <div class="kpis">
          <div class="kpi"><div class="lbl"><span class="ico">💰</span>Montant reçu</div>
            <div class="val" style="{'' if ccy_r else 'font-size:17px;white-space:normal'}">{f"{num(total_recu)}<small>{e(ccy_r)}</small>" if ccy_r else e(" · ".join(f"{num(v)} {c}" for c, v in paid.groupby("devise")["montant_recu"].sum().items()))}</div>
            <div class="sub">par les bénéficiaires</div></div>
          <div class="kpi"><div class="lbl"><span class="ico">👥</span>Bénéficiaires payés</div>
            <div class="val">{num(paid["beneficiaire"].nunique())}</div>
            <div class="sub">dans {num(paid["region"].nunique())} régions ou villes</div></div>
          <div class="kpi"><div class="lbl"><span class="ico">✅</span>Paiements réussis</div>
            <div class="val">{num(len(paid))}<small>/ {num(len(sel))}</small></div>
            <div class="sub">{num((sel["statut"].isin(["Échoué", "Expiré"])).sum())} échecs, {num((sel["statut"] == "En cours").sum())} en cours</div></div>
          <div class="kpi"><div class="lbl"><span class="ico">🪙</span>Débité</div>
            <div class="val" style="{'' if one_asset else 'font-size:17px;white-space:normal'}">{e(by_asset("montant_debite"))}</div>
            <div class="sub">montants envoyés</div></div>
          <div class="kpi"><div class="lbl"><span class="ico">🧾</span>Frais</div>
            <div class="val" style="{'' if one_asset else 'font-size:17px;white-space:normal'}">{e(by_asset("frais"))}</div>
            <div class="sub">frais Bitnob, par actif</div></div>
        </div>""", unsafe_allow_html=True)

        by_region = (paid.groupby(["region", "devise"])
                     .agg(beneficiaires=("beneficiaire", "nunique"), paiements=("reference", "count"),
                          montant=("montant_recu", "sum"))
                     .reset_index().sort_values("montant", ascending=False))
        by_op = (paid.assign(operateur=paid["operateur"].map(lambda o: OPERATOR.get(o, o)))
                 .groupby(["operateur", "devise"])
                 .agg(paiements=("reference", "count"), montant=("montant_recu", "sum"))
                 .reset_index().sort_values("montant", ascending=False))
        c_a, c_b = st.columns([3, 2])
        c_a.markdown("**Par région**")
        c_a.dataframe(by_region.rename(columns={"region": "Région", "devise": "Devise", "beneficiaires": "Bénéficiaires",
                                                "paiements": "Paiements", "montant": "Montant reçu"}),
                      hide_index=True, width="stretch",
                      column_config={"Montant reçu": st.column_config.NumberColumn(format="localized")})
        c_b.markdown("**Par opérateur**")
        c_b.dataframe(by_op.rename(columns={"operateur": "Opérateur", "devise": "Devise", "paiements": "Paiements",
                                            "montant": "Montant reçu"}),
                      hide_index=True, width="stretch",
                      column_config={"Montant reçu": st.column_config.NumberColumn(format="localized")})

        detail = pd.DataFrame({
            "Date": sel["date_paiement"].dt.strftime("%d/%m/%Y %H:%M"),
            "Lot": sel["lot"],
            "Bénéficiaire": sel["beneficiaire"],
            "Téléphone": sel["telephone_masque"],
            "Région": sel["region"],
            "Opérateur": sel["operateur"].map(lambda o: OPERATOR.get(o, o)),
            "Statut": sel["statut"],
            "Montant reçu": sel["montant_recu"],
            "Devise": sel["devise"],
            "Débité": sel["montant_debite"],
            "Frais": sel["frais"],
            "Actif": sel["actif_debite"],
            "Raison de l'échec": sel["raison_echec"].fillna(""),
            "Référence": sel["reference"],
            "ID Bitnob": sel["id_bitnob"],
        })
        st.markdown("**Détail des paiements**")
        st.dataframe(detail, hide_index=True, width="stretch", height=360, column_config={
            "Montant reçu": st.column_config.NumberColumn(format="localized"),
            "Débité": st.column_config.NumberColumn(format="localized"),
            "Frais": st.column_config.NumberColumn(format="localized")})

        simulated = bool(sel["is_simulated"].any())
        summary = pd.DataFrame({
            "Indicateur": ["Organisation", "Période", "Montant reçu par les bénéficiaires", "Bénéficiaires payés",
                           "Paiements réussis", "Paiements échoués ou expirés", "Paiements en cours",
                           "Montant débité", "Frais", "Données"],
            "Valeur": [org_name, f"du {d0:%d/%m/%Y} au {d1:%d/%m/%Y}",
                       f"{num(total_recu)} {ccy_r}" if ccy_r else "plusieurs devises : voir l'onglet Par région",
                       int(paid["beneficiaire"].nunique()), int(len(paid)),
                       int(sel["statut"].isin(["Échoué", "Expiré"]).sum()), int((sel["statut"] == "En cours").sum()),
                       by_asset("montant_debite"), by_asset("frais"),
                       "SIMULÉES pour la démonstration" if simulated else "Réelles"],
        })
        import io
        try:
            buf = io.BytesIO()
            with pd.ExcelWriter(buf, engine="openpyxl") as xw:
                summary.to_excel(xw, sheet_name="Résumé", index=False)
                by_region.to_excel(xw, sheet_name="Par région", index=False)
                by_op.to_excel(xw, sheet_name="Par opérateur", index=False)
                detail.to_excel(xw, sheet_name="Détail", index=False)
                for ws in xw.book.worksheets:
                    for col in ws.columns:
                        width = max(len(str(c.value or "")) for c in col)
                        ws.column_dimensions[col[0].column_letter].width = min(max(12, width + 2), 48)
            st.download_button("⬇️ Télécharger le rapport Excel", buf.getvalue(),
                               file_name=f"rapport_paiements_{d0:%Y%m%d}_{d1:%Y%m%d}.xlsx",
                               mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                               type="primary")
        except ImportError:
            st.download_button("⬇️ Télécharger le détail (CSV)", detail.to_csv(index=False, sep=";").encode("utf-8-sig"),
                               file_name=f"rapport_paiements_{d0:%Y%m%d}_{d1:%Y%m%d}.csv", mime="text/csv")
            st.caption("Pour l'export Excel : `pip install openpyxl`.")
        if simulated:
            st.caption("Ce rapport contient des données simulées : le fichier l'indique dans l'onglet Résumé.")

# ---------------------------------------------------------------------------
# Vérifier un fichier
# ---------------------------------------------------------------------------
with tab_file:
    st.markdown('<p class="card-title">Vérifier un fichier avant de payer</p>'
                '<p class="card-sub">Déposez le fichier CSV des bénéficiaires. Rien n\'est envoyé : l\'outil vérifie seulement.</p>'
                '<div class="note">Colonnes attendues : <b>nom, telephone, montant, devise, pays, operateur</b> (+ <b>region</b> facultative). '
                'L\'outil repère les numéros invalides, les mauvaises devises, les opérateurs inconnus (Wave, Orange Money, Free Money et Expresso au Sénégal ; MTN au Ghana), les doublons et les montants inhabituels.</div>',
                unsafe_allow_html=True)
    up = st.file_uploader("Fichier CSV", type=["csv"], label_visibility="collapsed")
    if up is not None:
        report = validate_text(up.getvalue().decode("utf-8-sig"))
        if report.file_errors:
            for err in report.file_errors:
                st.markdown(f'<div class="state ko">❌ {e(err)}</div>', unsafe_allow_html=True)
        else:
            c = report.counts()
            totals = " · ".join(fmt(v, ccy) for ccy, v in sorted(report.totals_by_currency().items()))
            st.markdown(f"""
            <div class="vgrid">
              <div class="vc ok"><div class="big">{c['ok']}</div><div class="t">✓ Prêtes à payer</div></div>
              <div class="vc warn"><div class="big">{c['warning']}</div><div class="t">⚠ À vérifier par un humain</div></div>
              <div class="vc bad"><div class="big">{c['error']}</div><div class="t">✕ Bloquées, ne seront pas payées</div></div>
            </div>
            <div class="note"><b>Total qui sera payé :</b> {e(totals)}</div>""", unsafe_allow_html=True)
            for n in report.notices:
                st.markdown(f'<div class="note">ℹ️ {e(n)}</div>', unsafe_allow_html=True)
            df = pd.DataFrame(report.to_records())
            icon = {"ok": "✓ Prête", "warning": "⚠ À vérifier", "error": "✕ Bloquée"}
            df["État"] = df["statut"].map(icon)
            only = st.toggle("Afficher seulement les lignes avec un problème", value=True)
            if only:
                df = df[df["statut"] != "ok"]
            known = ~df["codes"].str.contains("OPERATOR_UNSUPPORTED")
            df.loc[known, "operateur"] = df.loc[known, "operateur"].map(lambda o: OPERATOR.get(o, o))
            st.dataframe(df.rename(columns={"ligne": "Ligne", "nom": "Bénéficiaire", "pays": "Pays",
                                            "operateur": "Opérateur", "region": "Région",
                                            "montant": "Montant", "problemes": "Problème"})
                         [["Ligne", "État", "Bénéficiaire", "Pays", "Opérateur", "Région", "Montant", "Problème"]],
                         hide_index=True, width="stretch")

# ---------------------------------------------------------------------------
# Fiabilité des chiffres
# ---------------------------------------------------------------------------
with tab_checks:
    bad = int(checks["violations"].sum())
    if bad == 0:
        st.markdown(f'<div class="state ok">✓ Les {len(checks)} contrôles sont validés : '
                    'tous les chiffres de ce tableau de bord sont cohérents entre eux.</div>', unsafe_allow_html=True)
    else:
        st.markdown(f'<div class="state ko">✕ {bad} incohérence(s) détectée(s). Ne présentez pas ces chiffres avant correction.</div>',
                    unsafe_allow_html=True)
    rows = "".join(
        f'<div class="ck"><span class="m {"ok" if r.violations == 0 else "ko"}">{"✓" if r.violations == 0 else "✕"}</span>'
        f'<span>{e(CHECKS.get(r.check_name, r.description))}{"" if r.violations == 0 else f" — <b>{int(r.violations)} erreur(s)</b>"}</span></div>'
        for r in checks.itertuples())
    st.markdown(f'<div class="checks">{rows}</div>', unsafe_allow_html=True)
