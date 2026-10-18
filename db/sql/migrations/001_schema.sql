-- =====================================================================
-- Rôle 3 — Schéma de données (PostgreSQL 14+)
-- Couvre : payouts de masse (BulkPay) + factures (SunuPay)
--
-- Règles appliquées partout :
--   * montants en ENTIERS (BIGINT) en unités minimales de la devise
--     (XOF : 1 = 1 franc ; NGN : 1 = 1 kobo ; USDT : 1 = 0,000001 USDT)
--   * chaque montant a sa devise à côté
--   * dates en TIMESTAMPTZ (UTC)
--   * la réponse brute de Bitnob est conservée en JSONB
--   * is_simulated = TRUE sur toute donnée générée pour la démo
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- Devises : nombre de décimales (exposant ISO 4217 / précision crypto)
-- ---------------------------------------------------------------------
CREATE TABLE currencies (
    code      TEXT PRIMARY KEY,                       -- 'XOF', 'NGN', 'USDT'
    exponent  SMALLINT NOT NULL CHECK (exponent BETWEEN 0 AND 8),
    kind      TEXT NOT NULL CHECK (kind IN ('fiat', 'crypto')),
    label     TEXT NOT NULL
);

INSERT INTO currencies (code, exponent, kind, label) VALUES
    ('XOF', 0, 'fiat',   'Franc CFA (UEMOA)'),
    ('NGN', 2, 'fiat',   'Naira'),
    ('GHS', 2, 'fiat',   'Cedi'),
    ('KES', 2, 'fiat',   'Shilling kényan'),
    ('USD', 2, 'fiat',   'Dollar américain'),
    ('USDT', 6, 'crypto', 'Tether USD'),
    ('USDC', 6, 'crypto', 'USD Coin'),
    ('BTC', 8, 'crypto', 'Bitcoin (8 décimales = satoshis)');

-- ---------------------------------------------------------------------
-- Utilisateurs (commerçant, admin d'entreprise...)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    full_name   TEXT,
    role        TEXT NOT NULL DEFAULT 'merchant'
                CHECK (role IN ('merchant', 'admin', 'viewer')),
    kyc_status  TEXT NOT NULL DEFAULT 'pending'
                CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Bénéficiaires (livreurs, freelances, vendeurs...)
-- ---------------------------------------------------------------------
CREATE TABLE beneficiaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id),
    full_name       TEXT NOT NULL,
    country         CHAR(2) NOT NULL,                 -- ISO 3166-1 alpha-2
    currency        TEXT NOT NULL REFERENCES currencies(code),
    destination_type TEXT NOT NULL DEFAULT 'mobile_money'
                    CHECK (destination_type IN ('mobile_money', 'bank', 'swift')),
    phone_e164      TEXT,                             -- +221771234567
    account_number  TEXT,                             -- numéro de compte ou de wallet
    bank_code       TEXT,                             -- code opérateur (WAVE, ORANGE_MONEY... / Get Banks Bitnob)
    region          TEXT,                             -- région administrative (Kaolack, Matam...)
    is_simulated    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT beneficiary_phone_format CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
    CONSTRAINT beneficiary_unique UNIQUE (owner_id, country, phone_e164)
);

-- ---------------------------------------------------------------------
-- Lots de payouts (un CSV importé = un lot)
-- ---------------------------------------------------------------------
CREATE TABLE batches (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID NOT NULL REFERENCES users(id),
    name          TEXT NOT NULL,
    source_asset  TEXT NOT NULL REFERENCES currencies(code),  -- actif débité (USDT...)
    status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'validated', 'running', 'completed', 'partial', 'failed', 'cancelled')),
    file_name     TEXT,
    rows_in_file  INTEGER CHECK (rows_in_file >= 0),
    rows_rejected INTEGER NOT NULL DEFAULT 0 CHECK (rows_rejected >= 0),
    is_simulated  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    launched_at   TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- Payouts : une ligne = un paiement vers un bénéficiaire
-- Statuts internes (voir docs/dictionnaire_donnees.md pour le mapping Bitnob)
--   quoted -> initialized -> pending -> completed
--                                 \-> failed
--   quoted / initialized / pending -> expired
-- ---------------------------------------------------------------------
CREATE TABLE payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID REFERENCES batches(id),
    beneficiary_id      UUID NOT NULL REFERENCES beneficiaries(id),

    -- Notre référence : clé d'idempotence, envoyée à Bitnob comme `reference`
    reference           TEXT NOT NULL UNIQUE,

    -- Montant reçu par le bénéficiaire (settlement_amount Bitnob)
    settlement_minor    BIGINT NOT NULL CHECK (settlement_minor > 0),
    settlement_currency TEXT NOT NULL REFERENCES currencies(code),

    -- Montant débité côté crypto (amount Bitnob) et frais (fees Bitnob, en from_asset)
    source_minor        BIGINT CHECK (source_minor IS NULL OR source_minor > 0),
    fee_source_minor    BIGINT CHECK (fee_source_minor IS NULL OR fee_source_minor >= 0),
    source_asset        TEXT NOT NULL REFERENCES currencies(code),
    exchange_rate       NUMERIC(20, 8) CHECK (exchange_rate IS NULL OR exchange_rate > 0),

    status              TEXT NOT NULL DEFAULT 'quoted'
                        CHECK (status IN ('quoted', 'initialized', 'pending', 'completed', 'failed', 'expired')),
    failure_reason      TEXT,
    payment_reason      TEXT NOT NULL DEFAULT 'salary',

    -- Identifiants Bitnob
    bitnob_quote_id         TEXT UNIQUE,
    bitnob_payout_id        TEXT UNIQUE,
    provider_settlement_id  TEXT,
    quote_expires_at        TIMESTAMPTZ,

    -- Horodatage de chaque étape (pour les délais)
    quoted_at       TIMESTAMPTZ,
    initialized_at  TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,       -- état terminal (completed, failed ou expired)

    raw_last_response JSONB,
    is_simulated    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT payout_failed_has_reason
        CHECK (status <> 'failed' OR failure_reason IS NOT NULL),
    CONSTRAINT payout_terminal_has_end
        CHECK (status NOT IN ('completed', 'failed', 'expired') OR completed_at IS NOT NULL),
    CONSTRAINT payout_chronology
        CHECK (completed_at IS NULL OR initialized_at IS NULL OR completed_at >= initialized_at),
    CONSTRAINT payout_settlement_is_fiat
        CHECK (settlement_currency NOT IN ('USDT', 'USDC', 'BTC'))
);

CREATE INDEX payouts_batch_idx   ON payouts (batch_id);
CREATE INDEX payouts_status_idx  ON payouts (status);
CREATE INDEX payouts_created_idx ON payouts (created_at);

-- Historique des changements de statut (sert aux délais et à l'audit)
CREATE TABLE payout_status_history (
    id           BIGSERIAL PRIMARY KEY,
    payout_id    UUID NOT NULL REFERENCES payouts(id),
    from_status  TEXT,
    to_status    TEXT NOT NULL,
    origin       TEXT NOT NULL CHECK (origin IN ('api', 'webhook', 'manual', 'system')),
    event_id     TEXT,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payout_history_payout_idx ON payout_status_history (payout_id);

-- ---------------------------------------------------------------------
-- Factures (SunuPay) : le commerçant fixe un montant cible en fiat
-- ---------------------------------------------------------------------
CREATE TABLE invoices (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id             UUID NOT NULL REFERENCES users(id),
    number               TEXT NOT NULL UNIQUE,         -- SP-2026-0001
    client_name          TEXT NOT NULL,
    client_country       CHAR(2),
    target_minor         BIGINT NOT NULL CHECK (target_minor > 0),  -- ce que le commerçant veut recevoir
    target_currency      TEXT NOT NULL REFERENCES currencies(code),
    pay_asset            TEXT NOT NULL REFERENCES currencies(code), -- USDT, BTC...
    chain                TEXT,                                       -- TRON, BITCOIN (lightning)...
    due_source_minor     BIGINT CHECK (due_source_minor IS NULL OR due_source_minor > 0),
    received_source_minor BIGINT NOT NULL DEFAULT 0 CHECK (received_source_minor >= 0),
    rate_locked_until    TIMESTAMPTZ,
    status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'open', 'partially_paid', 'paid', 'overpaid', 'expired', 'cancelled')),
    bitnob_reference     TEXT UNIQUE,
    payout_id            UUID REFERENCES payouts(id),  -- payout local déclenché après paiement
    is_simulated         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at              TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- Journal brut de TOUS les webhooks reçus (indispensable pour déboguer)
-- event_id UNIQUE = Bitnob peut renvoyer le même événement : on l'ignore
-- ---------------------------------------------------------------------
CREATE TABLE webhook_events (
    id               BIGSERIAL PRIMARY KEY,
    event_id         TEXT NOT NULL UNIQUE,
    event_type       TEXT NOT NULL,           -- payouts.withdrawal.success...
    reference        TEXT,                    -- data.reference (notre référence)
    payload          JSONB NOT NULL,
    signature_valid  BOOLEAN NOT NULL,
    received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at     TIMESTAMPTZ,
    processing_error TEXT,
    is_simulated     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX webhook_reference_idx ON webhook_events (reference);

-- ---------------------------------------------------------------------
-- Alertes de qualité / fraude produites par la validation
-- ---------------------------------------------------------------------
CREATE TABLE data_alerts (
    id          BIGSERIAL PRIMARY KEY,
    batch_id    UUID REFERENCES batches(id),
    payout_id   UUID REFERENCES payouts(id),
    rule_code   TEXT NOT NULL,           -- DUPLICATE_PHONE, AMOUNT_OUTLIER...
    severity    TEXT NOT NULL CHECK (severity IN ('warning', 'error')),
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payouts_touch BEFORE UPDATE ON payouts
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Conversion unités minimales -> montant lisible (affichage uniquement)
-- (NUMERIC accepte aussi les BIGINT et les SUM() de BIGINT)
CREATE OR REPLACE FUNCTION to_major(amount_minor NUMERIC, ccy TEXT) RETURNS NUMERIC AS $$
    SELECT trim_scale(amount_minor / power(10::NUMERIC, c.exponent))
    FROM currencies c WHERE c.code = ccy;
$$ LANGUAGE sql STABLE;
