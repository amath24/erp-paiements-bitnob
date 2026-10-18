-- =====================================================================
-- Rôle 3 — Indicateurs, rapprochement et tests de cohérence
--
-- RÈGLE D'OR : chaque indicateur est défini UNE SEULE FOIS, ici.
-- Le dashboard, l'API et le pitch lisent ces vues. Personne ne recalcule
-- un KPI ailleurs.
--
-- Définitions :
--   * statut terminal   = completed, failed ou expired
--   * en cours          = quoted, initialized ou pending
--   * taux de succès    = completed / terminaux  (les "en cours" n'entrent pas au dénominateur)
--   * volume            = somme des montants des payouts COMPLETED uniquement
--   * délai             = completed_at - initialized_at, payouts completed uniquement
--   * jour              = date UTC (UTC = heure de Dakar)
--   * on n'additionne JAMAIS deux devises différentes
-- =====================================================================

-- ---------------------------------------------------------------------
-- Base enrichie : une ligne par payout, montants lisibles et délais
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_payouts_enriched AS
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
    -- colonnes ajoutées en v2 (toujours EN FIN de vue, pour pouvoir mettre à jour une base existante)
    COALESCE(b.region, 'Non renseignée')         AS region,
    COALESCE(b.bank_code, 'Non renseigné')       AS operator,
    b.phone_e164                                 AS phone_e164,
    p.provider_settlement_id,
    p.bitnob_payout_id,
    bt.name                                      AS batch_name
FROM payouts p
JOIN beneficiaries b ON b.id = p.beneficiary_id
LEFT JOIN batches bt ON bt.id = p.batch_id;

-- ---------------------------------------------------------------------
-- KPIs globaux, une ligne par actif source (USDT, BTC...)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kpis AS
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
    COUNT(DISTINCT beneficiary_name) FILTER (WHERE status = 'completed')   AS beneficiaries_paid,
    COUNT(DISTINCT country)                                     AS countries,
    BOOL_OR(is_simulated)                                       AS contains_simulated_data
FROM v_payouts_enriched
GROUP BY source_asset;

-- ---------------------------------------------------------------------
-- Résumé par lot (page de suivi BulkPay)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_batch_summary AS
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
    bt.is_simulated
FROM batches bt
LEFT JOIN payouts p ON p.batch_id = bt.id
GROUP BY bt.id;

-- ---------------------------------------------------------------------
-- Volume quotidien (graphique d'évolution), par actif source
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_daily_volume AS
SELECT
    day_utc,
    source_asset,
    COUNT(*)                                               AS payouts_created,
    COUNT(*) FILTER (WHERE status = 'completed')           AS payouts_completed,
    COALESCE(SUM(source_minor) FILTER (WHERE status = 'completed'), 0) AS volume_source_minor
FROM v_payouts_enriched
GROUP BY day_utc, source_asset;

-- ---------------------------------------------------------------------
-- Corridors (répartition par pays / devise reçue)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_corridors AS
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
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delay_minutes)::NUMERIC, 1) AS median_delay_minutes
FROM v_payouts_enriched
GROUP BY country, settlement_currency;

-- ---------------------------------------------------------------------
-- Par opérateur mobile money (Wave, Orange Money...)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_operators AS
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

-- ---------------------------------------------------------------------
-- Par région (rapport bailleur : où va l'argent)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_regions AS
SELECT
    country,
    region,
    settlement_currency,
    COUNT(*)                                               AS n_total,
    COUNT(*) FILTER (WHERE status = 'completed')           AS n_completed,
    COUNT(DISTINCT beneficiary_name) FILTER (WHERE status = 'completed') AS beneficiaries_paid,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE is_terminal), 0), 4) AS success_rate,
    COALESCE(SUM(settlement_minor) FILTER (WHERE status = 'completed'), 0) AS settled_minor
FROM v_payouts_enriched
GROUP BY country, region, settlement_currency;

-- ---------------------------------------------------------------------
-- Rapport bailleur : une ligne par paiement, en clair, prête à exporter
-- (numéro masqué : seuls les 4 derniers chiffres apparaissent)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_donor_report AS
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
    is_simulated
FROM v_payouts_enriched;

-- ---------------------------------------------------------------------
-- Raisons d'échec (ce que le jury demandera : "pourquoi ça échoue ?")
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_failure_reasons AS
SELECT
    country,
    COALESCE(failure_reason, '(expirée)') AS reason,
    COUNT(*)                              AS n
FROM v_payouts_enriched
WHERE status IN ('failed', 'expired')
GROUP BY country, COALESCE(failure_reason, '(expirée)');

-- ---------------------------------------------------------------------
-- RAPPROCHEMENT : ce que nous croyons vs ce que Bitnob a confirmé
-- Chaque ligne = un problème à traiter
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_reconciliation_issues AS
-- 1. Bloqué : initialisé ou en cours depuis plus de 15 minutes
SELECT 'STUCK'::TEXT AS issue_type, p.id AS payout_id, p.reference,
       format('Statut %s depuis %s min', p.status,
              ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(p.initialized_at, p.created_at))) / 60)) AS detail
FROM payouts p
WHERE p.status IN ('initialized', 'pending')
  AND COALESCE(p.initialized_at, p.created_at) < now() - INTERVAL '15 minutes'

UNION ALL
-- 2. Cotation expirée mais payout jamais fermé
SELECT 'QUOTE_EXPIRED_OPEN', p.id, p.reference,
       format('Cotation expirée le %s, statut encore %s', p.quote_expires_at, p.status)
FROM payouts p
WHERE p.status IN ('quoted', 'initialized')
  AND p.quote_expires_at < now()

UNION ALL
-- 3. Marqué "completed" chez nous sans webhook de succès valide
SELECT 'COMPLETED_WITHOUT_WEBHOOK', p.id, p.reference,
       'Aucun webhook payouts.withdrawal.success signé pour cette référence'
FROM payouts p
WHERE p.status = 'completed'
  AND NOT EXISTS (
      SELECT 1 FROM webhook_events w
      WHERE w.reference = p.reference
        AND w.event_type = 'payouts.withdrawal.success'
        AND w.signature_valid)

UNION ALL
-- 4. Webhook de succès reçu mais statut pas mis à jour
SELECT 'WEBHOOK_NOT_APPLIED', p.id, p.reference,
       format('Webhook de succès reçu, statut encore %s', p.status)
FROM payouts p
JOIN webhook_events w ON w.reference = p.reference
WHERE w.event_type = 'payouts.withdrawal.success'
  AND w.signature_valid
  AND p.status <> 'completed'

UNION ALL
-- 5. Montant confirmé par Bitnob différent du montant attendu
SELECT 'AMOUNT_MISMATCH', p.id, p.reference,
       format('Attendu %s %s, confirmé %s',
              to_major(p.settlement_minor, p.settlement_currency),
              p.settlement_currency,
              w.payload -> 'data' ->> 'settlement_amount')
FROM payouts p
JOIN webhook_events w ON w.reference = p.reference
JOIN currencies c ON c.code = p.settlement_currency
WHERE w.event_type = 'payouts.withdrawal.success'
  AND w.signature_valid
  AND (w.payload -> 'data' ->> 'settlement_amount') ~ '^[0-9]+(\.[0-9]+)?$'
  AND ROUND((w.payload -> 'data' ->> 'settlement_amount')::NUMERIC * power(10, c.exponent))
      <> p.settlement_minor

UNION ALL
-- 6. Webhook pour une référence que nous ne connaissons pas
SELECT 'UNKNOWN_REFERENCE', NULL, w.reference,
       format('Événement %s (%s) sans payout correspondant', w.event_type, w.event_id)
FROM webhook_events w
WHERE w.event_type LIKE 'payouts.%'
  AND NOT EXISTS (SELECT 1 FROM payouts p WHERE p.reference = w.reference)

UNION ALL
-- 7. Signature invalide : à ne JAMAIS appliquer
SELECT 'INVALID_SIGNATURE', NULL, w.reference,
       format('Événement %s rejeté (signature invalide)', w.event_id)
FROM webhook_events w
WHERE NOT w.signature_valid;

-- ---------------------------------------------------------------------
-- TESTS DE COHÉRENCE : chaque ligne doit afficher violations = 0
-- (c'est ce qui attrape un "taux à 259 %" avant le jury)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_consistency_checks AS
SELECT 'batch_counts_add_up' AS check_name,
       'Par lot : completed + failed + expired + en cours = total' AS description,
       COUNT(*) AS violations
FROM v_batch_summary
WHERE n_completed + n_failed + n_expired + n_in_progress <> n_total

UNION ALL
SELECT 'rates_between_0_and_1',
       'Aucun taux de succès hors de [0 ; 1]',
       (SELECT COUNT(*) FROM v_kpis WHERE success_rate NOT BETWEEN 0 AND 1)
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
SELECT 'kpi_count_equals_corridor_sum',
       'Nombre total de payouts = somme des corridors',
       CASE WHEN (SELECT COALESCE(SUM(payouts_total), 0) FROM v_kpis)
               = (SELECT COALESCE(SUM(n_total), 0) FROM v_corridors) THEN 0 ELSE 1 END

UNION ALL
SELECT 'history_matches_status',
       'Le dernier statut de l''historique = statut actuel du payout',
       COUNT(*)
FROM payouts p
JOIN LATERAL (
    SELECT h.to_status FROM payout_status_history h
    WHERE h.payout_id = p.id ORDER BY h.changed_at DESC, h.id DESC LIMIT 1
) last ON TRUE
WHERE last.to_status <> p.status

UNION ALL
SELECT 'currency_matches_beneficiary',
       'Devise du payout = devise du bénéficiaire',
       COUNT(*)
FROM payouts p JOIN beneficiaries b ON b.id = p.beneficiary_id
WHERE p.settlement_currency <> b.currency

UNION ALL
SELECT 'invoice_paid_is_covered',
       'Facture "paid" : montant reçu >= montant dû',
       COUNT(*)
FROM invoices
WHERE status = 'paid' AND received_source_minor < due_source_minor

UNION ALL
SELECT 'region_sum_equals_total',
       'Nombre total de payouts = somme des régions',
       CASE WHEN (SELECT COALESCE(SUM(payouts_total), 0) FROM v_kpis)
               = (SELECT COALESCE(SUM(n_total), 0) FROM v_regions) THEN 0 ELSE 1 END

UNION ALL
SELECT 'simulated_flag_consistent',
       'Pas de mélange données réelles / simulées dans un même payout',
       COUNT(*)
FROM payouts p JOIN beneficiaries b ON b.id = p.beneficiary_id
WHERE p.is_simulated <> b.is_simulated;
