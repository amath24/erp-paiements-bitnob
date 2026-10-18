-- =====================================================================
-- BulkPay ERP — Comptes PostgreSQL, droits et protection des lignes (RLS)
-- Fichier REJOUÉ à chaque migration : les droits sont remis exactement à l'état voulu.
--
--   compte          utilisé par            droits
--   propriétaire    migrations (Personne 2) tout, uniquement via sql/migrations
--   app_backend     backend FastAPI        lire / ajouter / modifier les données ; aucune suppression ;
--                                          journaux (audit, mouvements, transactions) en ajout seulement
--   ai_reader       assistant IA           lecture seule des vues v_ai_* et des indicateurs, 5 s max
--   powerbi_reader  Power BI               lecture seule des vues (sauf numéros complets), 60 s max
--   anon, authenticated (Supabase)         RIEN : le frontend passe toujours par le backend
--
-- Les mots de passe ne sont JAMAIS dans ce fichier : scripts/create_db_users.py les crée.
-- =====================================================================

DO $$
DECLARE
    r TEXT;
BEGIN
    FOREACH r IN ARRAY ARRAY['app_backend', 'ai_reader', 'powerbi_reader'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
    END LOOP;
END $$;

ALTER ROLE ai_reader      SET default_transaction_read_only = on;
ALTER ROLE ai_reader      SET statement_timeout = '5s';
ALTER ROLE ai_reader      SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE powerbi_reader SET default_transaction_read_only = on;
ALTER ROLE powerbi_reader SET statement_timeout = '60s';
ALTER ROLE app_backend    SET statement_timeout = '30s';

-- 1. On repart de zéro pour nos trois comptes
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM app_backend, ai_reader, powerbi_reader;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_backend, ai_reader, powerbi_reader;
GRANT USAGE ON SCHEMA public TO app_backend, ai_reader, powerbi_reader;

-- 2. Backend
GRANT SELECT, INSERT, UPDATE ON
    users, beneficiaries, batches, payouts, payout_attempts, webhook_events, data_alerts,
    envelopes, envelope_reloads, card_balance_snapshots, company_balance_snapshots, invoices
TO app_backend;
GRANT SELECT, INSERT ON
    payout_status_history, audit_log, ai_query_log, card_transactions, envelope_movements
TO app_backend;
GRANT SELECT ON currencies TO app_backend;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_backend;

-- 3. Fonctions qui modifient des données : backend uniquement
REVOKE EXECUTE ON FUNCTION
    start_payout_attempt(UUID, UUID),
    apply_payout_event(TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB),
    record_card_transaction(TEXT, TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ, TEXT, TEXT, JSONB),
    reload_envelope(UUID, DATE, TEXT, TIMESTAMPTZ),
    mark_invoice_paid(TEXT, TIMESTAMPTZ, TEXT, NUMERIC),
    expire_invoices(TIMESTAMPTZ)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
    start_payout_attempt(UUID, UUID),
    apply_payout_event(TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB),
    record_card_transaction(TEXT, TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ, TEXT, TEXT, JSONB),
    reload_envelope(UUID, DATE, TEXT, TIMESTAMPTZ),
    mark_invoice_paid(TEXT, TIMESTAMPTZ, TEXT, NUMERIC),
    expire_invoices(TIMESTAMPTZ)
TO app_backend;

-- 4. Vues : le backend lit tout
DO $$
DECLARE
    v TEXT;
BEGIN
    FOR v IN SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'v\_%' LOOP
        EXECUTE format('GRANT SELECT ON %I TO app_backend', v);
        -- Power BI : toutes les vues sauf celle qui contient les numéros complets
        IF v <> 'v_payouts_enriched' THEN
            EXECUTE format('GRANT SELECT ON %I TO powerbi_reader', v);
        END IF;
    END LOOP;
END $$;

-- 5. Assistant IA : seulement des vues sans donnée personnelle
GRANT SELECT ON
    v_ai_payouts, v_ai_invoices, v_kpis, v_kpis_all, v_monthly, v_daily_volume, v_by_currency, v_corridors,
    v_operators, v_regions, v_batch_summary, v_failure_reasons, v_asset_share,
    v_envelope_balances, v_envelope_monthly, v_envelope_spending, v_invoice_summary
TO ai_reader;
-- table de référence lue par la fonction to_major() des vues
GRANT SELECT ON currencies TO ai_reader, powerbi_reader;

-- 6. Protection des lignes (RLS) : activée partout.
--    Le propriétaire (migrations, vues) n'est pas concerné ; app_backend a une règle explicite ;
--    tout autre compte qui recevrait un droit par erreur ne verrait aucune ligne.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS app_backend_all ON %I', t);
        IF t <> 'schema_migrations' THEN
            EXECUTE format('CREATE POLICY app_backend_all ON %I FOR ALL TO app_backend USING (true) WITH CHECK (true)', t);
        END IF;
    END LOOP;
END $$;
DROP POLICY IF EXISTS currencies_read ON currencies;
CREATE POLICY currencies_read ON currencies FOR SELECT TO PUBLIC USING (true);

-- 7. Supabase : l'API publique (anon, authenticated) n'a accès à rien
DO $$
DECLARE
    r TEXT;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
            BEGIN
                EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
                EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
                EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
            EXCEPTION WHEN insufficient_privilege THEN
                RAISE NOTICE 'Droits par défaut de % non modifiables ici (sans conséquence : RLS active)', r;
            END;
        END IF;
    END LOOP;
END $$;
