-- =====================================================================
-- BulkPay ERP — Descriptions en français (lues par l'assistant IA et par les outils SQL)
-- Fichier REJOUÉ à chaque migration.
-- L'IA peut les lire avec :
--   SELECT c.relname, obj_description(c.oid) FROM pg_class c WHERE c.relname LIKE 'v\_%';
-- =====================================================================

-- Tables principales
COMMENT ON TABLE payouts IS 'Ligne de paiement d''un lot : qui doit recevoir combien. Son statut vient de son dernier essai.';
COMMENT ON TABLE payout_attempts IS 'Chaque tentative envoyée à Bitnob pour une ligne. Relancer un échec = nouvel essai. Au plus un essai vivant ou réussi par ligne.';
COMMENT ON TABLE envelopes IS 'Enveloppe budgétaire adossée à une carte virtuelle Bitnob en USD. Aucun numéro complet de carte stocké.';
COMMENT ON TABLE envelope_movements IS 'Journal des mouvements d''une enveloppe (cents de USD, + entrée, - sortie). Le solde = la somme. Jamais modifié.';
COMMENT ON TABLE card_transactions IS 'Transactions de carte reçues de Bitnob, y compris refusées. Une transaction n''est comptée qu''une fois.';
COMMENT ON TABLE envelope_reloads IS 'Rechargements mensuels : au plus un par enveloppe et par mois.';
COMMENT ON TABLE invoices IS 'Factures Bitcoin sur le réseau Lightning (montant en satoshis).';
COMMENT ON TABLE audit_log IS 'Journal d''audit : qui a fait quoi et quand. Jamais modifié.';
COMMENT ON TABLE ai_query_log IS 'Questions posées à l''assistant IA, requête générée et réponse.';
COMMENT ON TABLE webhook_events IS 'Tous les webhooks Bitnob reçus, même invalides. event_id unique : un renvoi est ignoré.';
COMMENT ON TABLE schema_migrations IS 'Migrations appliquées (scripts/migrate.py). Ne pas modifier à la main.';

COMMENT ON COLUMN envelopes.card_last4 IS '4 derniers chiffres de la carte, seule partie du numéro conservée';
COMMENT ON COLUMN payout_attempts.reference IS 'Référence envoyée à Bitnob : essai 1 = référence de la ligne, puis -R2, -R3';
COMMENT ON COLUMN invoices.payment_request IS 'Facture Lightning (lnbc...) affichée en QR code';
COMMENT ON COLUMN users.auth_user_id IS 'Identifiant du compte Supabase Auth (auth.users.id)';

-- Vues lues par l'assistant IA
COMMENT ON VIEW v_ai_payouts IS 'Un paiement par ligne, sans donnée personnelle. Montants en unités normales (pas en centimes). Pour « combien avons-nous payé au Ghana ce mois-ci » : filtrer country = ''GH'', status = ''completed'', month_utc = mois voulu, puis SUM(amount_received). Ne jamais additionner deux devises différentes.';
COMMENT ON COLUMN v_ai_payouts.country IS 'Pays du bénéficiaire, code ISO à 2 lettres : NG Nigeria, GH Ghana, SN Sénégal';
COMMENT ON COLUMN v_ai_payouts.status IS 'completed = payé, failed = échoué, expired = expiré, quoted/initialized/pending = en cours';
COMMENT ON COLUMN v_ai_payouts.amount_received IS 'Montant reçu par le bénéficiaire, dans received_currency';
COMMENT ON COLUMN v_ai_payouts.amount_debited IS 'Montant débité à l''entreprise, dans debited_asset (USDT ou BTC), hors frais';
COMMENT ON COLUMN v_ai_payouts.fees IS 'Frais Bitnob, dans debited_asset';
COMMENT ON COLUMN v_ai_payouts.debited_asset IS 'Actif avec lequel le paiement a été réglé : USDT ou BTC. « Réglé en Bitcoin » = BTC';
COMMENT ON COLUMN v_ai_payouts.month_utc IS 'Premier jour du mois du paiement (ex. 2026-10-01 pour octobre 2026)';
COMMENT ON COLUMN v_ai_payouts.attempts_count IS 'Nombre d''essais : plus de 1 = paiement relancé';
COMMENT ON COLUMN v_ai_payouts.is_simulated IS 'TRUE = donnée de démonstration';

COMMENT ON VIEW v_kpis IS 'Indicateurs globaux, une ligne par actif débité (USDT, BTC) : nombre de paiements, taux de succès, volume, frais, bénéficiaires uniques. Les colonnes *_major sont en unités normales.';
COMMENT ON VIEW v_kpis_all IS 'Les compteurs globaux tous actifs confondus, sur une seule ligne : paiements, taux de succès, bénéficiaires payés, pays, relances. Sans montant (USDT et BTC ne s''additionnent pas).';
COMMENT ON VIEW v_monthly IS 'Paiements par mois et par actif débité : nombre, volume et frais (colonnes *_major en unités normales).';
COMMENT ON VIEW v_daily_volume IS 'Paiements par jour et par actif débité. volume_source_minor est en plus petite unité (micro-USDT, satoshis).';
COMMENT ON VIEW v_by_currency IS 'Paiements par devise reçue (XOF, NGN, GHS) : nombre, montant reçu (settled_major), taux de succès.';
COMMENT ON VIEW v_corridors IS 'Paiements par pays et devise reçue. Pour « quel pays reçoit le plus de paiements » : trier par n_completed.';
COMMENT ON VIEW v_operators IS 'Paiements par opérateur ou banque (Wave, Orange Money, MTN...).';
COMMENT ON VIEW v_regions IS 'Paiements par région administrative.';
COMMENT ON VIEW v_batch_summary IS 'Un lot par ligne : nombre de paiements par statut, taux de succès, nombre de relances.';
COMMENT ON VIEW v_failure_reasons IS 'Raisons d''échec par pays.';
COMMENT ON VIEW v_asset_share IS 'Part de chaque actif débité (USDT, BTC) dans les paiements réussis, en nombre de paiements.';
COMMENT ON VIEW v_envelope_balances IS 'Une enveloppe budgétaire par ligne : budget mensuel, solde, dépensé ce mois (en USD), niveau d''alerte (OK, Solde bas, Budget épuisé).';
COMMENT ON VIEW v_envelope_monthly IS 'Par enveloppe et par mois : crédité, dépensé, remboursé (cents de USD) et dépense nette en USD.';
COMMENT ON VIEW v_envelope_spending IS 'Dépenses par enveloppe, marchand et mois, en USD, et nombre de paiements refusés.';
COMMENT ON VIEW v_ai_invoices IS 'Factures Bitcoin sans donnée du client : montant en satoshis et en BTC, statut (Payée, En attente, Expirée).';
COMMENT ON VIEW v_invoice_summary IS 'Factures Bitcoin regroupées par statut : nombre, total en satoshis et en BTC, délai moyen de paiement.';

-- Vues de contrôle
COMMENT ON VIEW v_reconciliation_issues IS 'Problèmes à traiter : paiement bloqué, webhook non appliqué, écart de montant, enveloppe à geler, rechargement oublié...';
COMMENT ON VIEW v_consistency_checks IS 'Contrôles de cohérence : chaque ligne doit afficher violations = 0 avant une démo.';
COMMENT ON VIEW v_donor_report IS 'Rapport exportable, une ligne par paiement, téléphone masqué (4 derniers chiffres).';
