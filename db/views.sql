-- db/views.sql : Vues SQL Analytiques pour l'ERP et l'Assistant IA (P2/P3)

-- 1. Vue de synthese financiere et KPIs globaux
CREATE VIEW IF NOT EXISTS v_kpis AS
SELECT
    COALESCE(SUM(CASE WHEN paid = 1 THEN amount_xof ELSE 0 END), 0) AS today_revenue_xof,
    COALESCE(SUM(CASE WHEN paid = 1 THEN amount_sat ELSE 0 END), 0) AS total_sats_collected,
    COUNT(id) AS today_invoices_count,
    COALESCE(SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END), 0) AS paid_invoices_count,
    COALESCE(SUM(CASE WHEN paid = 0 THEN 1 ELSE 0 END), 0) AS pending_invoices_count,
    (SELECT COALESCE(SUM(amount_xof), 0) FROM settlements WHERE status = 'COMPLETED') AS settled_xof_total
FROM invoices;

-- 2. Vue unifiee detaillee pour requetes de l'agent IA (Text-to-SQL)
CREATE VIEW IF NOT EXISTS v_transactions_summary AS
SELECT 
    i.id AS invoice_id,
    i.reference,
    i.customer_name,
    i.amount_sat,
    i.amount_xof,
    i.description,
    i.status AS invoice_status,
    i.paid,
    i.demo,
    i.created_at,
    i.paid_at,
    s.id AS settlement_id,
    s.amount_usdt AS settled_usdt,
    s.beneficiary AS payout_beneficiary,
    s.status AS settlement_status
FROM invoices i
LEFT JOIN settlements s ON s.invoice_id = i.id;

-- 3. Vue des reglements mensuels
CREATE VIEW IF NOT EXISTS v_payouts_by_month AS
SELECT 
    SUBSTR(created_at, 1, 7) AS month,
    COUNT(id) AS payouts_count,
    COALESCE(SUM(amount_xof), 0) AS total_xof,
    COALESCE(SUM(amount_usdt), 0.0) AS total_usdt
FROM settlements
WHERE status = 'COMPLETED'
GROUP BY SUBSTR(created_at, 1, 7);
