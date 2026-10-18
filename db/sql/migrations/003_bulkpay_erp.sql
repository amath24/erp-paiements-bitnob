-- =====================================================================
-- Migration 003 — BulkPay ERP (v3)
--
-- Ajoute ce que demande le document de projet BulkPay ERP :
--   1. utilisateurs = profils reliés à Supabase Auth, rôles admin / viewer
--   2. journal d'audit (jamais modifié)
--   3. essais de paiement (payout_attempts) : relance sans double paiement
--   4. enveloppes budgétaires + cartes virtuelles + journal de mouvements
--   5. factures Bitcoin Lightning
--   6. journal de l'assistant IA, relevés de solde Bitnob
--
-- Appliquée UNE SEULE FOIS par scripts/migrate.py (table schema_migrations).
-- Ne jamais modifier ce fichier une fois appliqué : créer un 004.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Fonctions utilitaires
-- ---------------------------------------------------------------------

-- Interdit UPDATE et DELETE (tables « journal »). Seules les données
-- simulées peuvent être supprimées, pour réinitialiser la démo.
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.is_simulated THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'La table % est un journal : on ne modifie ni ne supprime une ligne (corriger par une nouvelle ligne)', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

-- Ordre des statuts d'un paiement (sert à refuser un retour en arrière)
CREATE OR REPLACE FUNCTION payout_status_rank(s TEXT) RETURNS INT AS $$
    SELECT CASE s WHEN 'quoted' THEN 1 WHEN 'initialized' THEN 2 WHEN 'pending' THEN 3
                  WHEN 'completed' THEN 9 WHEN 'failed' THEN 9 WHEN 'expired' THEN 9 END;
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------
-- 0 bis. Les données de DÉMO v1/v2 sont effacées (relancer scripts/seed.py --reset).
--        Les données réelles (is_simulated = FALSE) sont conservées et reprises.
-- ---------------------------------------------------------------------
DELETE FROM data_alerts WHERE batch_id IN (SELECT id FROM batches WHERE is_simulated)
                           OR payout_id IN (SELECT id FROM payouts WHERE is_simulated);
DELETE FROM payout_status_history WHERE payout_id IN (SELECT id FROM payouts WHERE is_simulated);
DELETE FROM invoices WHERE is_simulated;
DELETE FROM payouts WHERE is_simulated;
DELETE FROM webhook_events WHERE is_simulated;
DELETE FROM batches WHERE is_simulated;
DELETE FROM beneficiaries WHERE is_simulated;
DELETE FROM users WHERE is_simulated;

-- ---------------------------------------------------------------------
-- 1. Utilisateurs : profil relié au compte Supabase Auth
--    La connexion (mot de passe, jetons) est gérée par Supabase Auth.
--    Ici : qui est la personne et ce qu'elle a le droit de faire.
-- ---------------------------------------------------------------------
ALTER TABLE users ADD COLUMN auth_user_id  UUID UNIQUE;     -- = auth.users.id (Supabase)
ALTER TABLE users ADD COLUMN is_active     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;

UPDATE users SET role = 'admin' WHERE role = 'merchant';
UPDATE users SET email = lower(email) WHERE email <> lower(email);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'admin';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'viewer'));
ALTER TABLE users ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email));

-- ---------------------------------------------------------------------
-- 2. Journal d'audit : qui a fait quoi, quand
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID REFERENCES users(id),        -- NULL = action du système (tâche planifiée, webhook)
    action        TEXT NOT NULL,                    -- voir docs/dictionnaire_donnees.md
    entity        TEXT,                             -- batches, envelopes, invoices...
    entity_id     TEXT,
    details       JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address    INET,
    is_simulated  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT audit_action_format CHECK (action ~ '^[a-z]+(_[a-z]+)*$')
);
CREATE INDEX audit_log_user_idx    ON audit_log (user_id, created_at);
CREATE INDEX audit_log_entity_idx  ON audit_log (entity, entity_id);
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- ---------------------------------------------------------------------
-- 3. Essais de paiement
--
-- payouts          = la LIGNE du lot (qui doit recevoir combien). Une seule par personne et par lot.
-- payout_attempts  = chaque tentative envoyée à Bitnob (cotation -> initialisation -> finalisation).
--                    Relancer un échec = nouvel essai, jamais une nouvelle ligne.
--
-- Garanties données PAR LA BASE (même si le code se trompe) :
--   * au plus UN essai vivant ou réussi par ligne -> impossible de payer deux fois
--   * un statut ne recule jamais, un statut final ne change plus
--   * payouts.status est recopié automatiquement depuis le dernier essai
--   * chaque changement de statut est inscrit dans payout_status_history
-- ---------------------------------------------------------------------
CREATE TABLE payout_attempts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id               UUID NOT NULL REFERENCES payouts(id),
    attempt_no              SMALLINT NOT NULL CHECK (attempt_no BETWEEN 1 AND 20),
    reference               TEXT NOT NULL UNIQUE,   -- envoyée à Bitnob ; essai 1 = référence de la ligne, puis -R2, -R3...
    status                  TEXT NOT NULL DEFAULT 'quoted'
                            CHECK (status IN ('quoted', 'initialized', 'pending', 'completed', 'failed', 'expired')),
    source_minor            BIGINT CHECK (source_minor IS NULL OR source_minor > 0),
    fee_source_minor        BIGINT CHECK (fee_source_minor IS NULL OR fee_source_minor >= 0),
    exchange_rate           NUMERIC(20, 8) CHECK (exchange_rate IS NULL OR exchange_rate > 0),
    failure_reason          TEXT,
    bitnob_quote_id         TEXT UNIQUE,
    bitnob_payout_id        TEXT UNIQUE,
    provider_settlement_id  TEXT,
    quote_expires_at        TIMESTAMPTZ,
    quoted_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    initialized_at          TIMESTAMPTZ,
    pending_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,            -- état final (completed, failed ou expired)
    last_origin             TEXT NOT NULL DEFAULT 'api'
                            CHECK (last_origin IN ('api', 'webhook', 'manual', 'system')),
    last_event_id           TEXT,                   -- event_id du webhook qui a donné le statut actuel
    raw_last_response       JSONB,
    created_by              UUID REFERENCES users(id),
    is_simulated            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT attempt_number_unique UNIQUE (payout_id, attempt_no),
    CONSTRAINT attempt_failed_has_reason CHECK (status <> 'failed' OR failure_reason IS NOT NULL),
    CONSTRAINT attempt_terminal_has_end  CHECK (status NOT IN ('completed', 'failed', 'expired') OR completed_at IS NOT NULL),
    CONSTRAINT attempt_chronology CHECK (
        (initialized_at IS NULL OR initialized_at >= quoted_at)
        AND (pending_at IS NULL OR initialized_at IS NULL OR pending_at >= initialized_at)
        AND (completed_at IS NULL OR completed_at >= quoted_at))
);
-- LA règle anti double paiement : un seul essai « vivant ou réussi » par ligne
CREATE UNIQUE INDEX payout_attempts_one_alive
    ON payout_attempts (payout_id)
    WHERE status IN ('quoted', 'initialized', 'pending', 'completed');
CREATE INDEX payout_attempts_status_idx ON payout_attempts (status);

ALTER TABLE payout_status_history ADD COLUMN attempt_id UUID REFERENCES payout_attempts(id);

-- Garde-fou : refuse un retour en arrière et toute modification d'un essai terminé
CREATE OR REPLACE FUNCTION attempt_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'quoted' THEN
            RAISE EXCEPTION 'Un essai commence toujours au statut quoted (reçu : %)', NEW.status
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;
    IF payout_status_rank(OLD.status) = 9 THEN
        IF ROW(NEW.status, NEW.source_minor, NEW.fee_source_minor, NEW.exchange_rate, NEW.failure_reason,
               NEW.bitnob_quote_id, NEW.bitnob_payout_id, NEW.completed_at, NEW.payout_id, NEW.reference)
           IS DISTINCT FROM
           ROW(OLD.status, OLD.source_minor, OLD.fee_source_minor, OLD.exchange_rate, OLD.failure_reason,
               OLD.bitnob_quote_id, OLD.bitnob_payout_id, OLD.completed_at, OLD.payout_id, OLD.reference) THEN
            RAISE EXCEPTION 'Essai % déjà terminé (%) : il ne change plus. Pour relancer, créer un nouvel essai.',
                OLD.reference, OLD.status USING ERRCODE = 'check_violation';
        END IF;
    ELSIF payout_status_rank(NEW.status) < payout_status_rank(OLD.status) THEN
        RAISE EXCEPTION 'Retour en arrière refusé pour % : % -> %', OLD.reference, OLD.status, NEW.status
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.payout_id <> OLD.payout_id OR NEW.reference <> OLD.reference OR NEW.attempt_no <> OLD.attempt_no THEN
        RAISE EXCEPTION 'La ligne, la référence et le numéro d''un essai ne changent jamais'
            USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payout_attempts_guard BEFORE INSERT OR UPDATE ON payout_attempts
    FOR EACH ROW EXECUTE FUNCTION attempt_guard();

-- Après chaque changement : historique + recopie sur la ligne (payouts)
CREATE OR REPLACE FUNCTION attempt_after_change() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO payout_status_history (payout_id, attempt_id, from_status, to_status, origin, event_id, changed_at)
        VALUES (NEW.payout_id, NEW.id,
                CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
                NEW.status, NEW.last_origin, NEW.last_event_id,
                COALESCE(CASE NEW.status
                             WHEN 'quoted'      THEN NEW.quoted_at
                             WHEN 'initialized' THEN NEW.initialized_at
                             WHEN 'pending'     THEN NEW.pending_at
                             ELSE NEW.completed_at END, now()));
    END IF;

    -- Seul le DERNIER essai décrit la ligne
    IF NEW.attempt_no = (SELECT max(attempt_no) FROM payout_attempts WHERE payout_id = NEW.payout_id) THEN
        PERFORM set_config('bulkpay.sync', 'on', true);
        UPDATE payouts p SET
            status                 = NEW.status,
            failure_reason         = NEW.failure_reason,
            source_minor           = NEW.source_minor,
            fee_source_minor       = NEW.fee_source_minor,
            exchange_rate          = NEW.exchange_rate,
            bitnob_quote_id        = NEW.bitnob_quote_id,
            bitnob_payout_id       = NEW.bitnob_payout_id,
            provider_settlement_id = NEW.provider_settlement_id,
            quote_expires_at       = NEW.quote_expires_at,
            quoted_at              = NEW.quoted_at,
            initialized_at         = NEW.initialized_at,
            completed_at           = NEW.completed_at,
            raw_last_response      = NEW.raw_last_response
        WHERE p.id = NEW.payout_id;
        PERFORM set_config('bulkpay.sync', 'off', true);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payout_attempts_after AFTER INSERT OR UPDATE ON payout_attempts
    FOR EACH ROW EXECUTE FUNCTION attempt_after_change();

-- Une ligne de paiement naît au statut quoted ; ensuite son statut ne vient QUE de ses essais
CREATE OR REPLACE FUNCTION payout_line_guard() RETURNS trigger AS $$
BEGIN
    IF current_setting('bulkpay.sync', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' AND NEW.status <> 'quoted' THEN
        RAISE EXCEPTION 'Une ligne de paiement est créée au statut quoted ; son statut vient ensuite de payout_attempts'
            USING ERRCODE = 'check_violation';
    END IF;
    IF TG_OP = 'UPDATE' AND ROW(NEW.status, NEW.completed_at, NEW.bitnob_payout_id, NEW.source_minor, NEW.failure_reason)
                            IS DISTINCT FROM
                            ROW(OLD.status, OLD.completed_at, OLD.bitnob_payout_id, OLD.source_minor, OLD.failure_reason) THEN
        RAISE EXCEPTION 'Ne modifiez pas payouts directement : mettez à jour l''essai (payout_attempts) ou appelez apply_payout_event()'
            USING ERRCODE = 'check_violation';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.settlement_minor <> OLD.settlement_minor OR NEW.reference <> OLD.reference
                             OR NEW.beneficiary_id <> OLD.beneficiary_id) THEN
        RAISE EXCEPTION 'Le montant, la référence et le bénéficiaire d''une ligne ne changent jamais'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reprise des paiements réels existants (v1/v2) : chacun devient son essai n°1, tel quel.
-- Les déclencheurs sont coupés pendant la reprise : l'historique v1/v2 existe déjà
-- et la ligne ne doit pas être réécrite.
ALTER TABLE payout_attempts DISABLE TRIGGER payout_attempts_guard;
ALTER TABLE payout_attempts DISABLE TRIGGER payout_attempts_after;
INSERT INTO payout_attempts (payout_id, attempt_no, reference, status, source_minor, fee_source_minor,
                             exchange_rate, failure_reason, bitnob_quote_id, bitnob_payout_id,
                             provider_settlement_id, quote_expires_at, quoted_at, initialized_at,
                             completed_at, raw_last_response, is_simulated, created_at)
SELECT id, 1, reference, status, source_minor, fee_source_minor, exchange_rate, failure_reason, bitnob_quote_id,
       bitnob_payout_id, provider_settlement_id, quote_expires_at, COALESCE(quoted_at, created_at),
       initialized_at, completed_at, raw_last_response, is_simulated, created_at
FROM payouts;
UPDATE payout_status_history h SET attempt_id = a.id
FROM payout_attempts a WHERE a.payout_id = h.payout_id;
ALTER TABLE payout_attempts ENABLE TRIGGER payout_attempts_guard;
ALTER TABLE payout_attempts ENABLE TRIGGER payout_attempts_after;

CREATE TRIGGER payouts_line_guard BEFORE INSERT OR UPDATE ON payouts
    FOR EACH ROW EXECUTE FUNCTION payout_line_guard();

-- Une personne n'apparaît qu'une fois par lot
CREATE UNIQUE INDEX payouts_one_line_per_beneficiary ON payouts (batch_id, beneficiary_id) WHERE batch_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3 bis. Fonctions à appeler par le backend (elles appliquent les règles)
-- ---------------------------------------------------------------------

-- Crée l'essai suivant d'une ligne et renvoie la référence à envoyer à Bitnob.
-- Refuse si un essai est encore en cours ou si la ligne est déjà payée.
CREATE OR REPLACE FUNCTION start_payout_attempt(p_payout_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_line   payouts%ROWTYPE;
    v_next   SMALLINT;
    v_ref    TEXT;
BEGIN
    SELECT * INTO v_line FROM payouts WHERE id = p_payout_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ligne de paiement % introuvable', p_payout_id USING ERRCODE = 'no_data_found';
    END IF;
    IF EXISTS (SELECT 1 FROM payout_attempts WHERE payout_id = p_payout_id
               AND status IN ('quoted', 'initialized', 'pending', 'completed')) THEN
        RAISE EXCEPTION 'Relance refusée pour % : un essai est encore en cours ou la ligne est déjà payée', v_line.reference
            USING ERRCODE = 'unique_violation';
    END IF;
    SELECT COALESCE(max(attempt_no), 0) + 1 INTO v_next FROM payout_attempts WHERE payout_id = p_payout_id;
    v_ref := CASE WHEN v_next = 1 THEN v_line.reference ELSE v_line.reference || '-R' || v_next END;
    INSERT INTO payout_attempts (payout_id, attempt_no, reference, created_by, is_simulated)
    VALUES (p_payout_id, v_next, v_ref, p_user_id, v_line.is_simulated);
    RETURN v_ref;
END;
$$ LANGUAGE plpgsql;

-- Applique un statut reçu de Bitnob (réponse API ou webhook) à l'essai qui porte cette référence.
-- Renvoie : applied | ignored_late | ignored_same | refused_conflict | refused_needs_webhook | unknown_reference
--   * « completed » n'est accepté que d'un webhook (règle : succès confirmé par le webhook de livraison)
--   * un statut plus ancien que le statut actuel est ignoré (webhooks dans le désordre)
--   * deux statuts finaux différents = conflit à examiner (rien n'est modifié)
CREATE OR REPLACE FUNCTION apply_payout_event(
    p_reference      TEXT,
    p_status         TEXT,
    p_at             TIMESTAMPTZ DEFAULT now(),
    p_origin         TEXT DEFAULT 'webhook',
    p_event_id       TEXT DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL,
    p_provider_settlement_id TEXT DEFAULT NULL,
    p_raw            JSONB DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    a payout_attempts%ROWTYPE;
BEGIN
    IF p_status NOT IN ('initialized', 'pending', 'completed', 'failed', 'expired') THEN
        RAISE EXCEPTION 'Statut inconnu : %', p_status USING ERRCODE = 'invalid_parameter_value';
    END IF;
    SELECT * INTO a FROM payout_attempts WHERE reference = p_reference FOR UPDATE;
    IF NOT FOUND THEN
        RETURN 'unknown_reference';
    END IF;
    IF p_status = 'completed' AND p_origin <> 'webhook' THEN
        RETURN 'refused_needs_webhook';
    END IF;
    IF a.status = p_status THEN
        RETURN 'ignored_same';
    END IF;
    IF payout_status_rank(a.status) = 9 THEN
        RETURN CASE WHEN payout_status_rank(p_status) = 9 THEN 'refused_conflict' ELSE 'ignored_late' END;
    END IF;
    IF payout_status_rank(p_status) < payout_status_rank(a.status) THEN
        RETURN 'ignored_late';
    END IF;
    UPDATE payout_attempts SET
        status                 = p_status,
        initialized_at         = CASE WHEN p_status = 'initialized' THEN p_at ELSE COALESCE(initialized_at, CASE WHEN p_status = 'pending' THEN p_at END) END,
        pending_at             = CASE WHEN p_status = 'pending' THEN p_at ELSE pending_at END,
        completed_at           = CASE WHEN payout_status_rank(p_status) = 9 THEN p_at ELSE completed_at END,
        failure_reason         = CASE WHEN p_status = 'failed' THEN COALESCE(p_failure_reason, 'Raison non fournie par Bitnob') ELSE failure_reason END,
        provider_settlement_id = COALESCE(p_provider_settlement_id, provider_settlement_id),
        last_origin            = p_origin,
        last_event_id          = p_event_id,
        raw_last_response      = COALESCE(p_raw, raw_last_response)
    WHERE id = a.id;
    RETURN 'applied';
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 4. Enveloppes budgétaires et cartes virtuelles (USD)
--
-- JAMAIS stocké : numéro complet de carte, CVV, date d'expiration, pièces d'identité.
-- Stocké : identifiant Bitnob de la carte, 4 derniers chiffres, statut KYC.
-- ---------------------------------------------------------------------
CREATE TABLE envelopes (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id                    UUID NOT NULL REFERENCES users(id),
    name                        TEXT NOT NULL,                 -- « Meta Ads »
    category                    TEXT NOT NULL DEFAULT 'other'
                                CHECK (category IN ('ads', 'software', 'training', 'other')),
    currency                    TEXT NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
    monthly_budget_minor        BIGINT NOT NULL CHECK (monthly_budget_minor > 0),   -- cents de USD
    low_balance_threshold_minor BIGINT NOT NULL DEFAULT 0 CHECK (low_balance_threshold_minor >= 0),
    status                      TEXT NOT NULL DEFAULT 'pending_kyc'
                                CHECK (status IN ('pending_kyc', 'active', 'frozen', 'closed')),
    bitnob_customer_id          TEXT,                          -- titulaire chez Bitnob (Card KYC)
    kyc_status                  TEXT NOT NULL DEFAULT 'pending'
                                CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    bitnob_card_id              TEXT UNIQUE,
    card_last4                  CHAR(4) CHECK (card_last4 ~ '^[0-9]{4}$'),
    frozen_at                   TIMESTAMPTZ,
    frozen_reason               TEXT,
    created_by                  UUID REFERENCES users(id),
    is_simulated                BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT envelope_name_unique UNIQUE (owner_id, name),
    CONSTRAINT envelope_usd_only CHECK (currency = 'USD'),          -- cartes Bitnob prépayées en USD
    CONSTRAINT envelope_threshold_below_budget CHECK (low_balance_threshold_minor < monthly_budget_minor),
    CONSTRAINT envelope_card_when_active CHECK (status IN ('pending_kyc', 'closed') OR (bitnob_card_id IS NOT NULL AND kyc_status = 'verified')),
    CONSTRAINT envelope_frozen_has_date CHECK (status <> 'frozen' OR frozen_at IS NOT NULL),
    CONSTRAINT envelope_no_card_number CHECK (name !~ '[0-9]{12,19}' AND COALESCE(frozen_reason, '') !~ '[0-9]{12,19}')
);
CREATE TRIGGER envelopes_touch BEFORE UPDATE ON envelopes
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Transactions de carte telles que Bitnob les envoie (y compris refusées)
CREATE TABLE card_transactions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    envelope_id            UUID NOT NULL REFERENCES envelopes(id),
    bitnob_transaction_id  TEXT NOT NULL UNIQUE,     -- reçue deux fois = comptée une fois
    direction              TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),   -- credit = remboursement
    status                 TEXT NOT NULL CHECK (status IN ('success', 'declined', 'reversed')),
    amount_minor           BIGINT NOT NULL CHECK (amount_minor > 0),
    currency               TEXT NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
    merchant_name          TEXT,                     -- « META ADS », « NOTION »
    decline_reason         TEXT,
    occurred_at            TIMESTAMPTZ NOT NULL,
    raw                    JSONB,
    is_simulated           BOOLEAN NOT NULL DEFAULT FALSE,
    received_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT card_tx_usd CHECK (currency = 'USD'),
    CONSTRAINT card_tx_declined_has_reason CHECK (status <> 'declined' OR decline_reason IS NOT NULL),
    CONSTRAINT card_tx_no_card_number CHECK (COALESCE(merchant_name, '') !~ '[0-9]{12,19}')
);
CREATE INDEX card_tx_envelope_idx ON card_transactions (envelope_id, occurred_at);
CREATE TRIGGER card_transactions_append_only BEFORE UPDATE OR DELETE ON card_transactions
    FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Journal des mouvements : le solde d'une enveloppe = SOMME de ses mouvements
CREATE TABLE envelope_movements (
    id                   BIGSERIAL PRIMARY KEY,
    envelope_id          UUID NOT NULL REFERENCES envelopes(id),
    kind                 TEXT NOT NULL CHECK (kind IN ('funding', 'reload', 'spend', 'refund', 'unload', 'adjustment')),
    amount_minor         BIGINT NOT NULL CHECK (amount_minor <> 0),   -- + entrée, - sortie (cents de USD)
    card_transaction_id  UUID UNIQUE REFERENCES card_transactions(id),
    period_month         DATE,                                       -- mois couvert (financement, rechargement)
    bitnob_reference     TEXT UNIQUE,                                -- opération de financement Bitnob
    reverses_id          BIGINT UNIQUE REFERENCES envelope_movements(id),
    note                 TEXT,
    created_by           UUID REFERENCES users(id),
    is_simulated         BOOLEAN NOT NULL DEFAULT FALSE,
    occurred_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT movement_sign CHECK (
        (kind IN ('funding', 'reload', 'refund') AND amount_minor > 0)
        OR (kind IN ('spend', 'unload') AND amount_minor < 0)
        OR kind = 'adjustment'),
    CONSTRAINT movement_card_tx_kind CHECK (card_transaction_id IS NULL OR kind IN ('spend', 'refund')),
    CONSTRAINT movement_spend_has_card_tx CHECK (kind NOT IN ('spend', 'refund') OR card_transaction_id IS NOT NULL OR reverses_id IS NOT NULL),
    CONSTRAINT movement_month_is_first_day CHECK (period_month IS NULL OR period_month = date_trunc('month', period_month)::date),
    CONSTRAINT movement_reversal_is_adjustment CHECK (reverses_id IS NULL OR kind = 'adjustment')
);
CREATE INDEX envelope_movements_env_idx ON envelope_movements (envelope_id, occurred_at);
CREATE TRIGGER envelope_movements_append_only BEFORE UPDATE OR DELETE ON envelope_movements
    FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Rechargements mensuels : la clé primaire garantit UNE fois par enveloppe et par mois
CREATE TABLE envelope_reloads (
    envelope_id    UUID NOT NULL REFERENCES envelopes(id),
    period_month   DATE NOT NULL CHECK (period_month = date_trunc('month', period_month)::date),
    amount_minor   BIGINT NOT NULL CHECK (amount_minor >= 0),    -- 0 = enveloppe déjà pleine
    movement_id    BIGINT UNIQUE REFERENCES envelope_movements(id),
    is_simulated   BOOLEAN NOT NULL DEFAULT FALSE,
    done_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (envelope_id, period_month),
    CONSTRAINT reload_amount_has_movement CHECK ((amount_minor = 0) = (movement_id IS NULL))
);

-- Relevés du solde réel chez Bitnob (pour comparer avec le solde calculé)
CREATE TABLE card_balance_snapshots (
    id             BIGSERIAL PRIMARY KEY,
    envelope_id    UUID NOT NULL REFERENCES envelopes(id),
    balance_minor  BIGINT NOT NULL CHECK (balance_minor >= 0),
    taken_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_simulated   BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX card_snapshots_env_idx ON card_balance_snapshots (envelope_id, taken_at DESC);

CREATE TABLE company_balance_snapshots (
    id             BIGSERIAL PRIMARY KEY,
    asset          TEXT NOT NULL REFERENCES currencies(code),
    balance_minor  BIGINT NOT NULL CHECK (balance_minor >= 0),
    taken_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_simulated   BOOLEAN NOT NULL DEFAULT FALSE
);

-- Solde calculé d'une enveloppe (cents de USD)
CREATE OR REPLACE FUNCTION envelope_balance(p_envelope_id UUID) RETURNS BIGINT AS $$
    SELECT COALESCE(SUM(amount_minor), 0)::BIGINT FROM envelope_movements WHERE envelope_id = p_envelope_id;
$$ LANGUAGE sql STABLE;

-- Enregistre une transaction de carte reçue de Bitnob.
-- Renvoie : recorded | duplicate | unknown_card
-- Seules les transactions réussies changent le solde (debit = dépense, credit = remboursement).
CREATE OR REPLACE FUNCTION record_card_transaction(
    p_bitnob_card_id        TEXT,
    p_bitnob_transaction_id TEXT,
    p_direction             TEXT,
    p_status                TEXT,
    p_amount_minor          BIGINT,
    p_occurred_at           TIMESTAMPTZ,
    p_merchant_name         TEXT DEFAULT NULL,
    p_decline_reason        TEXT DEFAULT NULL,
    p_raw                   JSONB DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_env  envelopes%ROWTYPE;
    v_tx   UUID;
BEGIN
    SELECT * INTO v_env FROM envelopes WHERE bitnob_card_id = p_bitnob_card_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN 'unknown_card';
    END IF;
    INSERT INTO card_transactions (envelope_id, bitnob_transaction_id, direction, status, amount_minor,
                                   merchant_name, decline_reason, occurred_at, raw, is_simulated)
    VALUES (v_env.id, p_bitnob_transaction_id, p_direction, p_status, p_amount_minor,
            p_merchant_name, p_decline_reason, p_occurred_at, p_raw, v_env.is_simulated)
    ON CONFLICT (bitnob_transaction_id) DO NOTHING
    RETURNING id INTO v_tx;
    IF v_tx IS NULL THEN
        RETURN 'duplicate';
    END IF;
    IF p_status = 'success' THEN
        INSERT INTO envelope_movements (envelope_id, kind, amount_minor, card_transaction_id, note, occurred_at, is_simulated)
        VALUES (v_env.id,
                CASE WHEN p_direction = 'debit' THEN 'spend' ELSE 'refund' END,
                CASE WHEN p_direction = 'debit' THEN -p_amount_minor ELSE p_amount_minor END,
                v_tx, p_merchant_name, p_occurred_at, v_env.is_simulated);
    END IF;
    RETURN 'recorded';
END;
$$ LANGUAGE plpgsql;

-- Rechargement du mois : remet le solde au niveau du budget mensuel (complément).
-- Renvoie : reloaded | already_full | already_done | not_active
-- Une seule exécution par enveloppe et par mois, même si la tâche planifiée tourne deux fois.
CREATE OR REPLACE FUNCTION reload_envelope(
    p_envelope_id      UUID,
    p_month            DATE DEFAULT date_trunc('month', now())::date,
    p_bitnob_reference TEXT DEFAULT NULL,
    p_at               TIMESTAMPTZ DEFAULT now()
) RETURNS TEXT AS $$
DECLARE
    v_env    envelopes%ROWTYPE;
    v_month  DATE := date_trunc('month', p_month)::date;
    v_amount BIGINT;
    v_mov    BIGINT;
BEGIN
    SELECT * INTO v_env FROM envelopes WHERE id = p_envelope_id FOR UPDATE;
    IF NOT FOUND OR v_env.status NOT IN ('active', 'frozen') THEN
        RETURN 'not_active';
    END IF;
    IF EXISTS (SELECT 1 FROM envelope_reloads WHERE envelope_id = p_envelope_id AND period_month = v_month) THEN
        RETURN 'already_done';
    END IF;
    v_amount := GREATEST(v_env.monthly_budget_minor - envelope_balance(p_envelope_id), 0);
    IF v_amount > 0 THEN
        INSERT INTO envelope_movements (envelope_id, kind, amount_minor, period_month, bitnob_reference, note, occurred_at, is_simulated)
        VALUES (p_envelope_id, 'reload', v_amount, v_month, p_bitnob_reference,
                'Rechargement mensuel ' || to_char(v_month, 'MM/YYYY'), p_at, v_env.is_simulated)
        RETURNING id INTO v_mov;
    END IF;
    INSERT INTO envelope_reloads (envelope_id, period_month, amount_minor, movement_id, is_simulated, done_at)
    VALUES (p_envelope_id, v_month, v_amount, v_mov, v_env.is_simulated, p_at);
    RETURN CASE WHEN v_amount > 0 THEN 'reloaded' ELSE 'already_full' END;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 5. Factures Bitcoin (réseau Lightning)
--    Remplace la table invoices de SunuPay (v1), qui ne contenait que des données simulées.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM invoices WHERE NOT is_simulated) THEN
        RAISE EXCEPTION 'La table invoices contient des factures réelles : migration arrêtée, rien n''a été modifié';
    END IF;
END $$;
-- CASCADE retire aussi les anciennes vues qui lisaient cette table ; sql/views.sql les recrée juste après
DROP TABLE invoices CASCADE;

CREATE TABLE invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id                UUID NOT NULL REFERENCES users(id),
    number                  TEXT NOT NULL UNIQUE,              -- INV-2026-0001
    customer_name           TEXT NOT NULL,
    description             TEXT,
    amount_sats             BIGINT NOT NULL CHECK (amount_sats > 0),          -- 1 BTC = 100 000 000 sats
    reference_minor         BIGINT CHECK (reference_minor IS NULL OR reference_minor > 0),  -- contre-valeur affichée
    reference_currency      TEXT REFERENCES currencies(code),
    btc_usd_rate_at_creation NUMERIC(20, 8) CHECK (btc_usd_rate_at_creation IS NULL OR btc_usd_rate_at_creation > 0),
    btc_usd_rate_at_payment  NUMERIC(20, 8) CHECK (btc_usd_rate_at_payment IS NULL OR btc_usd_rate_at_payment > 0),
    payment_request         TEXT NOT NULL UNIQUE,              -- facture Lightning (lnbc...) affichée en QR code
    bitnob_invoice_id       TEXT NOT NULL UNIQUE,
    status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
    expires_at              TIMESTAMPTZ NOT NULL,
    paid_at                 TIMESTAMPTZ,
    paid_event_id           TEXT,
    created_by              UUID REFERENCES users(id),
    is_simulated            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT invoice_lightning_format CHECK (payment_request ~* '^ln(bc|tb|bcrt)[0-9a-z]+$'),
    CONSTRAINT invoice_expiry_after_creation CHECK (expires_at > created_at),
    CONSTRAINT invoice_paid_has_date CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
    CONSTRAINT invoice_paid_before_expiry CHECK (paid_at IS NULL OR (paid_at >= created_at AND paid_at <= expires_at)),
    CONSTRAINT invoice_reference_pair CHECK ((reference_minor IS NULL) = (reference_currency IS NULL))
);
CREATE INDEX invoices_status_idx ON invoices (status, expires_at);

CREATE OR REPLACE FUNCTION invoice_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('paid', 'expired') AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Facture % déjà %, elle ne change plus', OLD.number,
            CASE OLD.status WHEN 'paid' THEN 'payée' ELSE 'expirée' END
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.amount_sats <> OLD.amount_sats OR NEW.payment_request <> OLD.payment_request THEN
        RAISE EXCEPTION 'Le montant et la facture Lightning ne changent jamais : créer une nouvelle facture'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER invoices_guard BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION invoice_guard();

-- Marque une facture payée sur l'événement de paiement Bitnob.
-- Renvoie : paid | already_paid | refused_expired | unknown_invoice
CREATE OR REPLACE FUNCTION mark_invoice_paid(
    p_bitnob_invoice_id TEXT,
    p_paid_at           TIMESTAMPTZ DEFAULT now(),
    p_event_id          TEXT DEFAULT NULL,
    p_btc_usd_rate      NUMERIC DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_inv invoices%ROWTYPE;
BEGIN
    SELECT * INTO v_inv FROM invoices WHERE bitnob_invoice_id = p_bitnob_invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN 'unknown_invoice';
    END IF;
    IF v_inv.status = 'paid' THEN
        RETURN 'already_paid';
    END IF;
    IF v_inv.status = 'expired' OR p_paid_at > v_inv.expires_at THEN
        RETURN 'refused_expired';
    END IF;
    UPDATE invoices SET status = 'paid', paid_at = p_paid_at, paid_event_id = p_event_id,
                        btc_usd_rate_at_payment = p_btc_usd_rate
    WHERE id = v_inv.id;
    RETURN 'paid';
END;
$$ LANGUAGE plpgsql;

-- Passe à « expired » les factures en attente dont la date est dépassée. Renvoie le nombre modifié.
CREATE OR REPLACE FUNCTION expire_invoices(p_now TIMESTAMPTZ DEFAULT now()) RETURNS INT AS $$
DECLARE
    n INT;
BEGIN
    UPDATE invoices SET status = 'expired' WHERE status = 'pending' AND expires_at < p_now;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 6. Assistant IA : journal des questions (écrit par le backend)
-- ---------------------------------------------------------------------
CREATE TABLE ai_query_log (
    id               BIGSERIAL PRIMARY KEY,
    user_id          UUID REFERENCES users(id),
    conversation_id  UUID NOT NULL,
    question         TEXT NOT NULL,
    generated_sql    TEXT,
    row_count        INTEGER CHECK (row_count IS NULL OR row_count >= 0),
    duration_ms      INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
    answer           TEXT,
    error            TEXT,
    is_simulated     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_query_log_conv_idx ON ai_query_log (conversation_id, created_at);
CREATE TRIGGER ai_query_log_append_only BEFORE UPDATE OR DELETE ON ai_query_log
    FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- ---------------------------------------------------------------------
-- 7. Alertes : aussi pour les enveloppes, avec date de résolution
-- ---------------------------------------------------------------------
ALTER TABLE data_alerts ADD COLUMN envelope_id UUID REFERENCES envelopes(id);
ALTER TABLE data_alerts ADD COLUMN resolved_at TIMESTAMPTZ;
ALTER TABLE data_alerts ADD COLUMN is_simulated BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE data_alerts a SET is_simulated = TRUE
FROM batches b WHERE b.id = a.batch_id AND b.is_simulated;

-- Lot : qui l'a lancé
ALTER TABLE batches ADD COLUMN launched_by UUID REFERENCES users(id);
