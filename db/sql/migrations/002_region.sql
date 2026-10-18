-- =====================================================================
-- Migration v2 (scénario ONG Sénégal) pour une base DÉJÀ créée avec la v1.
-- Sans danger : n'efface rien, peut être relancée plusieurs fois.
-- Lancer avec : python scripts\migrate.py
-- =====================================================================
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS region TEXT;
