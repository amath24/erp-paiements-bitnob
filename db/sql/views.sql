-- =====================================================================
-- BulkPay ERP — Indicateurs, rapprochement et contrôles de cohérence
-- Fichier REJOUÉ à chaque migration : les vues sont recréées, les données ne bougent pas.
--
-- RÈGLE D'OR : chaque indicateur est défini UNE SEULE FOIS, ici.
-- Le tableau de bord, Power BI, l'API et l'assistant IA lisent ces vues.
--
-- Définitions :
--   * statut final      = completed, failed ou expired
--   * en cours          = quoted, initialized ou pending
--   * taux de succès    = completed / finals (les « en cours » n'entrent pas au dénominateur)
--   * volume            = somme des montants des paiements COMPLETED uniquement
--   * délai             = completed_at - initialized_at, paiements completed uniquement
--   * jour / mois       = en UTC (= heure de Dakar)
--   * on n'additionne JAMAIS deux devises différentes
-- =====================================================================

DROP VIEW IF EXISTS
    v_consistency_checks, v_reconciliation_issues, v_ai_payouts, v_ai_invoices,
    v_invoice_summary, v_invoices, v_envelope_spending, v_envelope_monthly, v_envelope_balances,
    v_attempts, v_asset_share, v_failure_reasons, v_donor_report, v_regions, v_operators,
    v_corridors, v_by_currency, v_monthly, v_daily_volume, v_batch_summary, v_kpis_all, v_kpis, v_payouts_enriched
CASCADE;

-- ---------------------------------------------------------------------
-- Base enrichie : une ligne par paiement (ligne de lot), montants lisibles et délais
-- ---------------------------------------------------------------------
CREATE VIEW v_payouts_enriched AS
SELECT
    p.id,
    p.reference,
    p.batch_id,
    b.full_name                                  AS beneficiary_name,
    b.country,
    p.status,
    p.status IN ('completed', 'failed', 'expired') AS is_terminal,
    p.settlement_minor,
    p.settlement_currency,
    to_major(p.settlement_minor, p.settlement_currency) AS settlement_major,
    p.source_minor,
    p.fee_source_minor,
    p.source_asset,
    to_major(p.source_minor, p.source_asset)       AS source_major,
    to_major(p.fee_source_minor, p.source_asset)   AS fee_source_major,
    p.exchange_rate,
    p.failure_reason,
    p.created_at,
    p.initialized_at,
    p.completed_at,
    CASE WHEN p.status = 'completed' AND p.initialized_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (p.completed_at - p.initialized_at)) / 60.0
    END                                          AS delay_minutes,
    (p.created_at AT TIME ZONE 'UTC')::date      AS day_utc,
    p.is_simulated,
    COALESCE(b.region, 'Non renseignée')         AS region,
    COALESCE(b.bank_code, 'Non renseigné')       AS operator,
    b.phone_e164                                 AS phone_e164,
    p.provider_settlement_id,
    p.bitnob_payout_id,
    bt.name                                      AS batch_name,
    p.beneficiary_id,
    date_trunc('month', p.created_at AT TIME ZONE 'UTC')::date AS month_utc,
    COALESCE(att.n_attempts, 0)                  AS attempts_count
FROM payouts p
JOIN beneficiaries b ON b.id = p.beneficiary_id
LEFT JOIN batches bt ON bt.id = p.batch_id
LEFT JOIN LATERAL (SELECT COUNT(*) AS n_attempts FROM payout_attempts a WHERE a.payout_id = p.id) att ON TRUE;

-- ---------------------------------------------------------------------
-- KPIs globaux, une ligne par actif débité (USDT, BTC...)
-- ---------------------------------------------------------------------
CREATE VIEW v_kpis AS
SELECT
    source_asset,
    COUNT(*)                                                    AS payouts_total,
    COUNT(*) FILTER (WHERE status = 'completed')                AS payouts_completed,
    COUNT(*) FILTER (WHERE status = 'failed')                   AS payouts_failed,
    COUNT(*) FILTER (WHERE status = 'expired')                  AS payouts_expired,
    COUNT(*) FILTER (WHERE NOT is_terminal)                     AS payouts_in_progress,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE is_terminal), 0), 4)    AS success_rate,
    COALESCE(SUM(source_minor) FILTER (WHERE status = 'completed'), 0)     AS volume_source_minor,
    COALESCE(SUM(fee_source_minor) FILTER (WHERE status = 'completed'), 0) AS fees_source_minor,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delay_minutes)::NUMERIC, 1) AS median_delay_minutes,
    COUNT(DISTINCT beneficiary_id) FILTER (WHERE status = 'completed')     AS beneficiaries_paid,
    COUNT(DISTINCT country)                                     AS countries,
    BOOL_OR(is_simulated)                                       AS contains_simulated_data,
    to_major(COALESCE(SUM(source_minor) FILTER (WHERE status = 'completed'), 0), source_asset)     AS volume_source_major,
    to_major(COALESCE(SUM(fee_source_minor) FILTER (WHERE status = 'completed'), 0), source_asset) AS fees_source_major,
    COUNT(DISTINCT beneficiary_id)                              AS beneficiaries_total,
    COUNT(*) FILTER (WHERE attempts_count > 1)                  AS payouts_retried
FROM v_payouts_enriched
GROUP BY source_asset;

-- Les mêmes compteurs, tous actifs confondus (une seule ligne). Pas de montant : USDT et BTC ne s'additionnent pas.
CREATE VIEW v_kpis_all AS
SELECT
    COUNT(*)                                                    AS payouts_total,
    COUNT(*) FILTER (WHERE status = 'completed')                AS payouts_completed,
    COUNT(*) FILTER (WHERE status = 'failed')                   AS payouts_failed,
    COUNT(*) FILTER (WHERE status = 'expired')                  AS payouts_expired,
    COUNT(*) FILTER (WHERE NOT is_terminal)                     AS payouts_in_progress,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE is_terminal), 0), 4)    AS success_rate,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delay_minutes)::NUMERIC, 1) AS median_delay_minutes,
    COUNT(DISTINCT beneficiary_id) FILTER (WHERE status = 'completed') AS beneficiaries_paid,
    COUNT(DISTINCT country)                                     AS countries,
    COUNT(DISTINCT source_asset)                                AS n_assets,
    COUNT(*) FILTER (WHERE attempts_count > 1)                  AS payouts_retried,
    MIN(day_utc)                                                AS first_day,
    MAX(day_utc)                                                AS last_day,
    COALESCE(BOOL_OR(is_simulated), FALSE)                      AS contains_simulated_data
FROM v_payouts_enriched;

-- ---------------------------------------------------------------------
-- Résumé par lot (page de suivi)
-- ---------------------------------------------------------------------
CREATE VIEW v_batch_summary AS
SELECT
    bt.id                                                     AS batch_id,
    bt.name,
    bt.status                                                 AS batch_status,
    bt.source_asset,
    bt.created_at,
    bt.launched_at,
    bt.finished_at,
    COUNT(p.id)                                               AS n_total,
    COUNT(p.id) FILTER (WHERE p.status = 'completed')         AS n_completed,
    COUNT(p.id) FILTER (WHERE p.status = 'failed')            AS n_failed,
    COUNT(p.id) FILTER (WHERE p.status = 'expired')           AS n_expired,
    COUNT(p.id) FILTER (WHERE p.status IN ('quoted', 'initialized', 'pending')) AS n_in_progress,
    ROUND(
        COUNT(p.id) FILTER (WHERE p.status = 'completed')::NUMERIC
        / NULLIF(COUNT(p.id) FILTER (WHERE p.status IN ('completed', 'failed', 'expired')), 0), 4) AS success_rate,
    COALESCE(SUM(p.source_minor) FILTER (WHERE p.status = 'completed'), 0)     AS volume_source_minor,
    COALESCE(SUM(p.fee_source_minor) FILTER (WHERE p.status = 'completed'), 0) AS fees_source_minor,
    COUNT(DISTINCT p.settlement_currency)                     AS n_currencies,
    bt.rows_rejected,
    bt.is_simulated,
    COUNT(p.id) FILTER (WHERE p.attempts_count > 1)           AS n_retried,
    COUNT(DISTINCT p.country)                                 AS n_countries,
    bt.launched_by
FROM batches bt
LEFT JOIN v_payouts_enriched p ON p.batch_id = bt.id
GROUP BY bt.id;

-- ---------------------------------------------------------------------
-- Évolution dans le temps
-- ---------------------------------------------------------------------
CREATE VIEW v_daily_volume AS
SELECT
    day_utc,
    source_asset,
    COUNT(*)                                               AS payouts_created,
    COUNT(*) FILTER (WHERE status = 'completed')           AS payouts_completed,
    COALESCE(SUM(source_minor) FILTER (WHERE status = 'completed'), 0) AS volume_source_minor
FROM v_payouts_enriched
GROUP BY day_utc, source_asset;

CREATE VIEW v_monthly AS
SELECT
    month_utc,
    source_asset,
    COUNT(*)                                               AS payouts_total,
    COUNT(*) FILTER (WHERE status = 'completed')           AS payouts_completed,
    COUNT(*) FILTER (WHERE status = 'failed')              AS payouts_failed,
    COALESCE(SUM(source_minor) FILTER (WHERE status = 'completed'), 0)     AS volume_source_minor,
    to_major(COALESCE(SUM(source_minor) FILTER (WHERE status = 'completed'), 0), source_asset) AS volume_source_major,
    COALESCE(SUM(fee_source_minor) FILTER (WHERE status = 'completed'), 0) AS fees_source_minor,
    to_major(COALESCE(SUM(fee_source_minor) FILTER (WHERE status = 'completed'), 0), source_asset) AS fees_source_major,
    COUNT(DISTINCT beneficiary_id) FILTER (WHERE status = 'completed')     AS beneficiaries_paid
FROM v_payouts_enriched
GROUP BY month_utc, source_asset;

-- ---------------------------------------------------------------------
-- Répartition par devise reçue, par pays, par opérateur, par région
-- ---------------------------------------------------------------------
CREATE VIEW v_by_currency AS
SELECT
    settlement_currency,
    COUNT(*)                                               AS n_total,
    COUNT(*) FILTER (WHERE status = 'completed')           AS n_completed,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE is_terminal), 0), 4) AS success_rate,
    COALESCE(SUM(settlement_minor) FILTER (WHERE status = 'completed'), 0) AS settled_minor,
    to_major(COALESCE(SUM(settlement_minor) FILTER (WHERE status = 'completed'), 0), settlement_currency) AS settled_major,
    COUNT(DISTINCT beneficiary_id) FILTER (WHERE status = 'completed') AS beneficiaries_paid
FROM v_payouts_enriched
GROUP BY settlement_currency;

CREATE VIEW v_corridors AS
SELECT
    country,
    settlement_currency,
    COUNT(*)                                               AS n_total,
    COUNT(*) FILTER (WHERE status = 'completed')           AS n_completed,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE is_terminal), 0), 4) AS success_rate,
    COALESCE(SUM(settlement_minor) FILTER (WHERE status = 'completed'), 0) AS settled_minor,
    ROUND(AVG(delay_minutes)::NUMERIC, 1)                  AS avg_delay_minutes,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delay_minutes)::NUMERIC, 1) AS median_delay_minutes,
    to_major(COALESCE(SUM(settlement_minor) FILTER (WHERE status = 'completed'), 0), settlement_currency) AS settled_major,
    COUNT(DISTINCT beneficiary_id) FILTER (WHERE status = 'completed') AS beneficiaries_paid
FROM v_payouts_enriched
GROUP BY country, settlement_currency;

CREATE VIEW v_operators AS
SELECT
    country,
    operator,
    settlement_currency,
    COUNT(*)                                               AS n_total,
    COUNT(*) FILTER (WHERE status = 'completed')           AS n_completed,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE is_terminal), 0), 4) AS success_rate,
    COALESCE(SUM(settlement_minor) FILTER (WHERE status = 'completed'), 0) AS settled_minor,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delay_minutes)::NUMERIC, 1) AS median_delay_minutes
FROM v_payouts_enriched
GROUP BY country, operator, settlement_currency;

CREATE VIEW v_regions AS
SELECT
    country,
    region,
    settlement_currency,
    COUNT(*)                                               AS n_total,
    COUNT(*) FILTER (WHERE status = 'completed')           AS n_completed,
    COUNT(DISTINCT beneficiary_id) FILTER (WHERE status = 'completed') AS beneficiaries_paid,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE is_terminal), 0), 4) AS success_rate,
    COALESCE(SUM(settlement_minor) FILTER (WHERE status = 'completed'), 0) AS settled_minor
FROM v_payouts_enriched
GROUP BY country, region, settlement_currency;

-- ---------------------------------------------------------------------
-- Rapport exportable : une ligne par paiement, numéro masqué (4 derniers chiffres)
-- ---------------------------------------------------------------------
CREATE VIEW v_donor_report AS
SELECT
    created_at                                  AS date_paiement,
    batch_name                                  AS lot,
    reference,
    beneficiary_name                            AS beneficiaire,
    '••••' || RIGHT(COALESCE(phone_e164, ''), 4) AS telephone_masque,
    country                                     AS pays,
    region,
    operator                                    AS operateur,
    CASE status WHEN 'completed' THEN 'Payé' WHEN 'failed' THEN 'Échoué' WHEN 'expired' THEN 'Expiré'
                ELSE 'En cours' END             AS statut,
    settlement_major                            AS montant_recu,
    settlement_currency                         AS devise,
    source_major                                AS montant_debite,
    fee_source_major                            AS frais,
    source_asset                                AS actif_debite,
    exchange_rate                               AS taux,
    failure_reason                              AS raison_echec,
    completed_at                                AS date_confirmation,
    bitnob_payout_id                            AS id_bitnob,
    provider_settlement_id                      AS id_operateur,
    batch_id,
    is_simulated,
    attempts_count                              AS nombre_essais
FROM v_payouts_enriched;

CREATE VIEW v_failure_reasons AS
SELECT
    country,
    COALESCE(failure_reason, '(expirée)') AS reason,
    COUNT(*)                              AS n
FROM v_payouts_enriched
WHERE status IN ('failed', 'expired')
GROUP BY country, COALESCE(failure_reason, '(expirée)');

-- Part de chaque actif débité (USDT, BTC...) dans les paiements réussis.
-- En nombre de paiements : deux actifs différents ne s'additionnent pas en montant.
CREATE VIEW v_asset_share AS
SELECT
    source_asset,
    payouts_completed,
    ROUND(payouts_completed::NUMERIC / NULLIF(SUM(payouts_completed) OVER (), 0), 4) AS share_of_completed,
    volume_source_minor,
    volume_source_major
FROM v_kpis;

-- Tous les essais (suivi des relances)
CREATE VIEW v_attempts AS
SELECT
    a.id                AS attempt_id,
    a.reference         AS attempt_reference,
    p.reference         AS payout_reference,
    p.batch_id,
    a.attempt_no,
    a.status,
    a.failure_reason,
    a.quoted_at,
    a.initialized_at,
    a.pending_at,
    a.completed_at,
    a.last_origin,
    a.is_simulated
FROM payout_attempts a
JOIN payouts p ON p.id = a.payout_id;

-- ---------------------------------------------------------------------
-- Enveloppes budgétaires (montants en USD ; les colonnes *_minor sont en cents)
-- ---------------------------------------------------------------------
CREATE VIEW v_envelope_balances AS
SELECT
    e.id                                          AS envelope_id,
    e.name,
    e.category,
    e.status,
    e.card_last4,
    e.monthly_budget_minor,
    to_major(e.monthly_budget_minor, 'USD')       AS monthly_budget_usd,
    bal.balance_minor,
    to_major(bal.balance_minor, 'USD')            AS balance_usd,
    COALESCE(mon.spent_minor, 0)                  AS spent_this_month_minor,
    to_major(COALESCE(mon.spent_minor, 0), 'USD') AS spent_this_month_usd,
    ROUND(COALESCE(mon.spent_minor, 0)::NUMERIC / e.monthly_budget_minor, 4) AS budget_used_ratio,
    e.low_balance_threshold_minor,
    CASE WHEN bal.balance_minor <= 0 THEN 'exhausted'
         WHEN bal.balance_minor <= e.low_balance_threshold_minor THEN 'low'
         ELSE 'ok' END                            AS alert_level,
    CASE WHEN bal.balance_minor <= 0 THEN 'Budget épuisé'
         WHEN bal.balance_minor <= e.low_balance_threshold_minor THEN 'Solde bas'
         ELSE 'OK' END                            AS alert_label,
    (e.status = 'active' AND bal.balance_minor <= 0) AS should_be_frozen,
    snap.balance_minor                            AS last_bitnob_balance_minor,
    snap.taken_at                                 AS last_bitnob_balance_at,
    e.frozen_at,
    e.is_simulated
FROM envelopes e
CROSS JOIN LATERAL (SELECT COALESCE(SUM(m.amount_minor), 0)::BIGINT AS balance_minor
                    FROM envelope_movements m WHERE m.envelope_id = e.id) bal
LEFT JOIN LATERAL (
    SELECT -SUM(m.amount_minor) AS spent_minor
    FROM envelope_movements m
    WHERE m.envelope_id = e.id AND m.kind IN ('spend', 'refund')
      AND m.occurred_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
) mon ON TRUE
LEFT JOIN LATERAL (
    SELECT s.balance_minor, s.taken_at FROM card_balance_snapshots s
    WHERE s.envelope_id = e.id ORDER BY s.taken_at DESC, s.id DESC LIMIT 1
) snap ON TRUE;

-- Par enveloppe et par mois : crédité, dépensé, remboursé
CREATE VIEW v_envelope_monthly AS
SELECT
    e.id                                                  AS envelope_id,
    e.name,
    date_trunc('month', m.occurred_at AT TIME ZONE 'UTC')::date AS month_utc,
    COALESCE(SUM(m.amount_minor) FILTER (WHERE m.kind IN ('funding', 'reload')), 0) AS credited_minor,
    COALESCE(-SUM(m.amount_minor) FILTER (WHERE m.kind = 'spend'), 0)              AS spent_minor,
    COALESCE(SUM(m.amount_minor) FILTER (WHERE m.kind = 'refund'), 0)              AS refunded_minor,
    to_major(COALESCE(-SUM(m.amount_minor) FILTER (WHERE m.kind = 'spend'), 0)
             - COALESCE(SUM(m.amount_minor) FILTER (WHERE m.kind = 'refund'), 0), 'USD') AS net_spent_usd,
    COUNT(*) FILTER (WHERE m.kind = 'spend')              AS n_spends,
    BOOL_OR(m.is_simulated)                               AS is_simulated
FROM envelopes e
JOIN envelope_movements m ON m.envelope_id = e.id
GROUP BY e.id, e.name, date_trunc('month', m.occurred_at AT TIME ZONE 'UTC')::date;

-- Dépenses par marchand (Meta Ads, Notion...), transactions réussies uniquement
CREATE VIEW v_envelope_spending AS
SELECT
    e.name                                                AS envelope,
    COALESCE(t.merchant_name, 'Inconnu')                  AS merchant,
    date_trunc('month', t.occurred_at AT TIME ZONE 'UTC')::date AS month_utc,
    COUNT(*) FILTER (WHERE t.status = 'success' AND t.direction = 'debit') AS n_spends,
    COUNT(*) FILTER (WHERE t.status = 'declined')          AS n_declined,
    to_major(COALESCE(SUM(t.amount_minor) FILTER (WHERE t.status = 'success' AND t.direction = 'debit'), 0), 'USD') AS spent_usd
FROM card_transactions t
JOIN envelopes e ON e.id = t.envelope_id
GROUP BY e.name, COALESCE(t.merchant_name, 'Inconnu'), date_trunc('month', t.occurred_at AT TIME ZONE 'UTC')::date;

-- ---------------------------------------------------------------------
-- Factures Bitcoin (Lightning)
-- effective_status : une facture « pending » dont la date est passée s'affiche « expired »
-- même si la tâche expire_invoices() n'a pas encore tourné.
-- ---------------------------------------------------------------------
CREATE VIEW v_invoices AS
SELECT
    i.id,
    i.number,
    i.customer_name,
    i.description,
    i.amount_sats,
    to_major(i.amount_sats, 'BTC')                AS amount_btc,
    i.reference_minor,
    i.reference_currency,
    to_major(i.reference_minor, i.reference_currency) AS reference_major,
    i.btc_usd_rate_at_creation,
    i.btc_usd_rate_at_payment,
    i.status,
    CASE WHEN i.status = 'pending' AND i.expires_at < now() THEN 'expired' ELSE i.status END AS effective_status,
    CASE WHEN i.status = 'paid' THEN 'Payée'
         WHEN i.status = 'expired' OR i.expires_at < now() THEN 'Expirée'
         ELSE 'En attente' END                    AS status_label,
    i.payment_request,
    i.created_at,
    i.expires_at,
    i.paid_at,
    ROUND(EXTRACT(EPOCH FROM (i.paid_at - i.created_at)) / 60.0, 1) AS minutes_to_pay,
    date_trunc('month', i.created_at AT TIME ZONE 'UTC')::date AS month_utc,
    i.is_simulated
FROM invoices i;

CREATE VIEW v_invoice_summary AS
SELECT
    effective_status,
    COUNT(*)                                       AS n_invoices,
    COALESCE(SUM(amount_sats), 0)                  AS total_sats,
    to_major(COALESCE(SUM(amount_sats), 0), 'BTC') AS total_btc,
    ROUND(AVG(minutes_to_pay), 1)                  AS avg_minutes_to_pay
FROM v_invoices
GROUP BY effective_status;

-- ---------------------------------------------------------------------
-- Vues pour l'assistant IA : AUCUNE donnée personnelle (ni nom, ni téléphone, ni facture Lightning)
-- ---------------------------------------------------------------------
CREATE VIEW v_ai_payouts AS
SELECT
    reference                                   AS payment_reference,
    batch_name,
    created_at,
    day_utc,
    month_utc,
    country,
    region,
    operator,
    CASE status WHEN 'completed' THEN 'payé' WHEN 'failed' THEN 'échoué' WHEN 'expired' THEN 'expiré'
                ELSE 'en cours' END             AS status_fr,
    status,
    settlement_major                            AS amount_received,
    settlement_currency                         AS received_currency,
    source_major                                AS amount_debited,
    fee_source_major                            AS fees,
    source_asset                                AS debited_asset,
    failure_reason,
    attempts_count,
    delay_minutes,
    is_simulated
FROM v_payouts_enriched;

CREATE VIEW v_ai_invoices AS
SELECT number, description, amount_sats, amount_btc, reference_major, reference_currency,
       effective_status, status_label, created_at, expires_at, paid_at, minutes_to_pay, month_utc, is_simulated
FROM v_invoices;

-- ---------------------------------------------------------------------
-- RAPPROCHEMENT : ce que nous croyons vs ce que Bitnob a confirmé
-- Chaque ligne = un problème à traiter
-- ---------------------------------------------------------------------
CREATE VIEW v_reconciliation_issues AS
-- 1. Bloqué : initialisé ou en cours depuis plus de 15 minutes
SELECT 'STUCK'::TEXT AS issue_type, a.payout_id, a.reference,
       format('Statut %s depuis %s min', a.status,
              ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(a.pending_at, a.initialized_at, a.quoted_at))) / 60)) AS detail
FROM payout_attempts a
WHERE a.status IN ('initialized', 'pending')
  AND COALESCE(a.pending_at, a.initialized_at, a.quoted_at) < now() - INTERVAL '15 minutes'

UNION ALL
-- 2. Cotation expirée mais essai jamais fermé
SELECT 'QUOTE_EXPIRED_OPEN', a.payout_id, a.reference,
       format('Cotation expirée le %s, statut encore %s', a.quote_expires_at, a.status)
FROM payout_attempts a
WHERE a.status IN ('quoted', 'initialized')
  AND a.quote_expires_at < now()

UNION ALL
-- 3. Marqué « completed » sans webhook de succès signé
SELECT 'COMPLETED_WITHOUT_WEBHOOK', a.payout_id, a.reference,
       'Aucun webhook payouts.withdrawal.success signé pour cette référence'
FROM payout_attempts a
WHERE a.status = 'completed'
  AND NOT EXISTS (
      SELECT 1 FROM webhook_events w
      WHERE w.reference = a.reference
        AND w.event_type = 'payouts.withdrawal.success'
        AND w.signature_valid)

UNION ALL
-- 4. Webhook de succès reçu mais statut pas mis à jour
SELECT 'WEBHOOK_NOT_APPLIED', a.payout_id, a.reference,
       format('Webhook de succès reçu, statut encore %s', a.status)
FROM payout_attempts a
JOIN webhook_events w ON w.reference = a.reference
WHERE w.event_type = 'payouts.withdrawal.success'
  AND w.signature_valid
  AND a.status <> 'completed'

UNION ALL
-- 5. Montant confirmé par Bitnob différent du montant attendu
SELECT 'AMOUNT_MISMATCH', a.payout_id, a.reference,
       format('Attendu %s %s, confirmé %s',
              to_major(p.settlement_minor, p.settlement_currency),
              p.settlement_currency,
              w.payload -> 'data' ->> 'settlement_amount')
FROM payout_attempts a
JOIN payouts p ON p.id = a.payout_id
JOIN webhook_events w ON w.reference = a.reference
JOIN currencies c ON c.code = p.settlement_currency
WHERE w.event_type = 'payouts.withdrawal.success'
  AND w.signature_valid
  AND (w.payload -> 'data' ->> 'settlement_amount') ~ '^[0-9]+(\.[0-9]+)?$'
  AND ROUND((w.payload -> 'data' ->> 'settlement_amount')::NUMERIC * power(10, c.exponent))
      <> p.settlement_minor

UNION ALL
-- 6. Webhook pour une référence que nous ne connaissons pas
SELECT 'UNKNOWN_REFERENCE', NULL, w.reference,
       format('Événement %s (%s) sans essai correspondant', w.event_type, w.event_id)
FROM webhook_events w
WHERE w.event_type LIKE 'payouts.%'
  AND NOT EXISTS (SELECT 1 FROM payout_attempts a WHERE a.reference = w.reference)

UNION ALL
-- 7. Signature invalide : à ne JAMAIS appliquer
SELECT 'INVALID_SIGNATURE', NULL, w.reference,
       format('Événement %s rejeté (signature invalide)', w.event_id)
FROM webhook_events w
WHERE NOT w.signature_valid

UNION ALL
-- 8. Solde calculé d'une enveloppe différent du solde réel de sa carte (au moment du relevé)
SELECT 'ENVELOPE_BALANCE_MISMATCH', NULL, e.name,
       format('Solde calculé %s USD, solde Bitnob %s USD (relevé du %s)',
              to_major(calc.balance_minor, 'USD'), to_major(s.balance_minor, 'USD'),
              to_char(s.taken_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI'))
FROM envelopes e
JOIN LATERAL (SELECT * FROM card_balance_snapshots s WHERE s.envelope_id = e.id
              ORDER BY s.taken_at DESC, s.id DESC LIMIT 1) s ON TRUE
CROSS JOIN LATERAL (SELECT COALESCE(SUM(m.amount_minor), 0) AS balance_minor FROM envelope_movements m
                    WHERE m.envelope_id = e.id AND m.occurred_at <= s.taken_at) calc
WHERE calc.balance_minor <> s.balance_minor

UNION ALL
-- 9. Budget épuisé mais carte pas encore gelée
SELECT 'CARD_NOT_FROZEN', NULL, b.name,
       format('Solde %s USD : la carte ••••%s doit être gelée', b.balance_usd, b.card_last4)
FROM v_envelope_balances b
WHERE b.should_be_frozen

UNION ALL
-- 10. Rechargement du mois oublié (tâche planifiée qui n'a pas tourné)
SELECT 'RELOAD_MISSING', NULL, e.name,
       format('Aucun rechargement pour %s', to_char(now() AT TIME ZONE 'UTC', 'MM/YYYY'))
FROM envelopes e
WHERE e.status IN ('active', 'frozen')
  AND e.created_at < date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  AND now() > (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + INTERVAL '6 hours'
  AND NOT EXISTS (SELECT 1 FROM envelope_reloads r
                  WHERE r.envelope_id = e.id
                    AND r.period_month = date_trunc('month', now() AT TIME ZONE 'UTC')::date)

UNION ALL
-- 11. Facture en attente dont la date est dépassée (expire_invoices() n'a pas tourné)
SELECT 'INVOICE_NOT_EXPIRED', NULL, i.number,
       format('Facture en attente, expirée depuis %s min',
              ROUND(EXTRACT(EPOCH FROM (now() - i.expires_at)) / 60))
FROM invoices i
WHERE i.status = 'pending' AND i.expires_at < now() - INTERVAL '5 minutes';

-- ---------------------------------------------------------------------
-- CONTRÔLES DE COHÉRENCE : chaque ligne doit afficher violations = 0
-- ---------------------------------------------------------------------
CREATE VIEW v_consistency_checks AS
SELECT 'batch_counts_add_up' AS check_name,
       'Par lot : completed + failed + expired + en cours = total' AS description,
       COUNT(*) AS violations
FROM v_batch_summary
WHERE n_completed + n_failed + n_expired + n_in_progress <> n_total

UNION ALL
SELECT 'rates_between_0_and_1',
       'Aucun taux de succès hors de [0 ; 1]',
       (SELECT COUNT(*) FROM v_kpis WHERE success_rate NOT BETWEEN 0 AND 1)
     + (SELECT COUNT(*) FROM v_kpis_all WHERE success_rate NOT BETWEEN 0 AND 1)
     + (SELECT COUNT(*) FROM v_batch_summary WHERE success_rate NOT BETWEEN 0 AND 1)
     + (SELECT COUNT(*) FROM v_corridors WHERE success_rate NOT BETWEEN 0 AND 1)

UNION ALL
SELECT 'kpi_volume_equals_daily_sum',
       'Volume global = somme des volumes quotidiens (par actif)',
       COUNT(*)
FROM v_kpis k
WHERE k.volume_source_minor <> (
    SELECT COALESCE(SUM(d.volume_source_minor), 0)
    FROM v_daily_volume d WHERE d.source_asset = k.source_asset)

UNION ALL
SELECT 'kpi_volume_equals_monthly_sum',
       'Volume global = somme des volumes mensuels (par actif)',
       COUNT(*)
FROM v_kpis k
WHERE k.volume_source_minor <> (
    SELECT COALESCE(SUM(m.volume_source_minor), 0)
    FROM v_monthly m WHERE m.source_asset = k.source_asset)

UNION ALL
SELECT 'kpi_all_equals_sum_by_asset',
       'Compteurs tous actifs = somme des compteurs par actif',
       CASE WHEN (SELECT payouts_total FROM v_kpis_all) = (SELECT COALESCE(SUM(payouts_total), 0) FROM v_kpis)
             AND (SELECT payouts_completed FROM v_kpis_all) = (SELECT COALESCE(SUM(payouts_completed), 0) FROM v_kpis)
            THEN 0 ELSE 1 END

UNION ALL
SELECT 'kpi_count_equals_corridor_sum',
       'Nombre total de paiements = somme des pays',
       CASE WHEN (SELECT COALESCE(SUM(payouts_total), 0) FROM v_kpis)
               = (SELECT COALESCE(SUM(n_total), 0) FROM v_corridors) THEN 0 ELSE 1 END

UNION ALL
SELECT 'kpi_count_equals_currency_sum',
       'Nombre total de paiements = somme des devises',
       CASE WHEN (SELECT COALESCE(SUM(payouts_total), 0) FROM v_kpis)
               = (SELECT COALESCE(SUM(n_total), 0) FROM v_by_currency) THEN 0 ELSE 1 END

UNION ALL
SELECT 'region_sum_equals_total',
       'Nombre total de paiements = somme des régions',
       CASE WHEN (SELECT COALESCE(SUM(payouts_total), 0) FROM v_kpis)
               = (SELECT COALESCE(SUM(n_total), 0) FROM v_regions) THEN 0 ELSE 1 END

UNION ALL
SELECT 'one_success_per_payout',
       'Aucune personne payée deux fois pour la même ligne',
       COUNT(*)
FROM (SELECT payout_id FROM payout_attempts WHERE status = 'completed'
      GROUP BY payout_id HAVING COUNT(*) > 1) d

UNION ALL
SELECT 'payout_matches_last_attempt',
       'Statut de chaque ligne = statut de son dernier essai',
       COUNT(*)
FROM payouts p
JOIN LATERAL (SELECT a.status FROM payout_attempts a WHERE a.payout_id = p.id
              ORDER BY a.attempt_no DESC LIMIT 1) last ON TRUE
WHERE last.status <> p.status

UNION ALL
SELECT 'every_payout_has_attempt',
       'Chaque ligne lancée a au moins un essai',
       COUNT(*)
FROM payouts p
JOIN batches b ON b.id = p.batch_id AND b.launched_at IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM payout_attempts a WHERE a.payout_id = p.id)

UNION ALL
SELECT 'history_matches_status',
       'Le dernier statut de l''historique = statut actuel du paiement',
       COUNT(*)
FROM payouts p
JOIN LATERAL (
    SELECT h.to_status FROM payout_status_history h
    WHERE h.payout_id = p.id ORDER BY h.changed_at DESC, h.id DESC LIMIT 1
) last ON TRUE
WHERE last.to_status <> p.status

UNION ALL
SELECT 'currency_matches_beneficiary',
       'Devise du paiement = devise du bénéficiaire',
       COUNT(*)
FROM payouts p JOIN beneficiaries b ON b.id = p.beneficiary_id
WHERE p.settlement_currency <> b.currency

UNION ALL
SELECT 'envelope_balance_not_negative',
       'Aucune enveloppe avec un solde négatif',
       COUNT(*)
FROM v_envelope_balances WHERE balance_minor < 0

UNION ALL
SELECT 'card_spend_matches_ledger',
       'Dépenses des cartes = mouvements des enveloppes (transactions réussies, une fois chacune)',
       (SELECT COUNT(*) FROM card_transactions t
        WHERE t.status = 'success'
          AND NOT EXISTS (SELECT 1 FROM envelope_movements m WHERE m.card_transaction_id = t.id
                          AND m.amount_minor = CASE WHEN t.direction = 'debit' THEN -t.amount_minor ELSE t.amount_minor END))
     + (SELECT COUNT(*) FROM card_transactions t
        WHERE t.status <> 'success'
          AND EXISTS (SELECT 1 FROM envelope_movements m WHERE m.card_transaction_id = t.id))

UNION ALL
SELECT 'reload_matches_movement',
       'Chaque rechargement mensuel correspond à son mouvement',
       COUNT(*)
FROM envelope_reloads r
LEFT JOIN envelope_movements m ON m.id = r.movement_id
WHERE (r.movement_id IS NOT NULL AND (m.amount_minor <> r.amount_minor OR m.kind NOT IN ('funding', 'reload')
                                      OR m.envelope_id <> r.envelope_id OR m.period_month <> r.period_month))

UNION ALL
SELECT 'launched_batch_is_audited',
       'Chaque lot lancé figure dans le journal d''audit',
       COUNT(*)
FROM batches b
WHERE b.launched_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM audit_log l WHERE l.action = 'batch_launched' AND l.entity_id = b.id::text)

UNION ALL
SELECT 'simulated_flag_consistent',
       'Pas de mélange données réelles / simulées',
       (SELECT COUNT(*) FROM payouts p JOIN beneficiaries b ON b.id = p.beneficiary_id
        WHERE p.is_simulated <> b.is_simulated)
     + (SELECT COUNT(*) FROM payout_attempts a JOIN payouts p ON p.id = a.payout_id
        WHERE a.is_simulated <> p.is_simulated)
     + (SELECT COUNT(*) FROM envelope_movements m JOIN envelopes e ON e.id = m.envelope_id
        WHERE m.is_simulated <> e.is_simulated);
