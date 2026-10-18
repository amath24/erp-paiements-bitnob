# Dictionnaire de données et contrat avec le backend — BulkPay ERP (v3)

Ce document dit, pour chaque action de l'application, **quoi écrire dans la base et quelle fonction appeler**.
Il s'adresse surtout à la Personne 1 (backend) et à la Personne 3 (assistant IA).
Sources Bitnob : [bitnob.dev](https://bitnob.dev/), pages Payouts, Webhooks et Supported countries, lues le 10/10/2026.

Règle générale : **le backend n'écrit jamais un statut à la main**. Il appelle les fonctions SQL ci-dessous,
qui appliquent les règles (pas de double paiement, pas de retour en arrière, succès confirmé par webhook).
La base refuse d'elle-même ce qui est interdit, même si le code se trompe.

## 1. Les tables en un coup d'œil

| Table | Contient | Qui écrit |
| --- | --- | --- |
| `users` | profils (lien vers Supabase Auth, rôle `admin` ou `viewer`) | backend |
| `beneficiaries` | livreurs, freelances... (nom, pays, téléphone, opérateur) | backend (import CSV) |
| `batches` | un fichier importé = un lot | backend |
| `payouts` | une **ligne** de lot : qui doit recevoir combien. Statut recopié automatiquement | backend (création seulement) |
| `payout_attempts` | chaque **essai** envoyé à Bitnob ; relancer = nouvel essai | fonctions SQL |
| `payout_status_history` | chaque changement de statut | automatique (déclencheur) |
| `webhook_events` | tous les webhooks reçus, même invalides | backend |
| `envelopes` | enveloppes budgétaires et leur carte virtuelle (identifiant + 4 derniers chiffres) | backend |
| `card_transactions` | transactions de carte reçues de Bitnob | fonction `record_card_transaction()` |
| `envelope_movements` | journal des mouvements ; **solde = somme** | fonctions SQL |
| `envelope_reloads` | un rechargement par enveloppe et par mois | fonction `reload_envelope()` |
| `card_balance_snapshots`, `company_balance_snapshots` | relevés du solde réel chez Bitnob | backend (tâche quotidienne) |
| `invoices` | factures Bitcoin Lightning | backend + `mark_invoice_paid()` |
| `audit_log` | qui a fait quoi, quand (jamais modifié) | backend |
| `ai_query_log` | questions posées à l'assistant IA | backend |
| `data_alerts` | alertes (solde bas, contrôles du fichier...) | backend |
| `schema_migrations` | mises à jour de la base appliquées | `scripts/migrate.py` |

Montants : **entiers en plus petite unité** (colonnes `*_minor`). XOF 0 décimale, NGN/GHS/USD 2, USDT 6, BTC 8
(1 BTC = 100 000 000 satoshis). Conversion : `role3.money.to_minor()` et `to_major()`. Jamais de `float`.

## 2. Paiements de masse : ce que fait le backend, étape par étape

### Import du CSV
1. `role3.validation.validate_csv()` : les lignes `error` ne sont jamais enregistrées ; les `warning` attendent une confirmation.
2. `INSERT INTO beneficiaries ... ON CONFLICT (owner_id, country, phone_e164) DO UPDATE SET full_name = EXCLUDED.full_name`.
3. `INSERT INTO batches (owner_id, name, source_asset, status, file_name, rows_in_file, rows_rejected) ... status = 'validated'`.
4. Une ligne par personne : `INSERT INTO payouts (batch_id, beneficiary_id, reference, settlement_minor, settlement_currency, source_asset)`.
   La référence est créée par nous (ex. `BP-20261017-00042`). Une personne ne peut figurer qu'une fois par lot.

### Lancement du lot (dans une seule transaction)
```sql
UPDATE batches SET status = 'running', launched_at = now(), launched_by = :user_id WHERE id = :batch_id;
INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (:user_id, 'batch_launched', 'batches', :batch_id, '{"paiements": 50}');
```

### Pour chaque ligne
| Étape | Appel Bitnob | Écriture en base |
| --- | --- | --- |
| 1. Ouvrir un essai | — | `SELECT start_payout_attempt(:payout_id, :user_id)` → renvoie la **référence à envoyer à Bitnob** |
| 2. Cotation | `POST /api/payouts/quotes` (avec cette référence) | `UPDATE payout_attempts SET source_minor, fee_source_minor, exchange_rate, bitnob_quote_id, quote_expires_at, raw_last_response WHERE reference = :ref` |
| 3. Initialisation | `POST /api/payouts/:quoteId/initialize` | `UPDATE payout_attempts SET bitnob_payout_id = :id WHERE reference = :ref` puis `SELECT apply_payout_event(:ref, 'initialized', now(), 'api')` |
| 4. Finalisation | `POST /api/payouts/:quoteId/finalize` | `SELECT apply_payout_event(:ref, 'pending', now(), 'api')` |
| 5. Résultat | webhook (voir plus bas) | `apply_payout_event(...)` avec l'origine `'webhook'` |

Avant l'étape 4, vérifier que la cotation n'a pas expiré (`role3.pricing.Quote.is_usable()`). Expirée :
`SELECT apply_payout_event(:ref, 'expired', now(), 'api')`, puis relancer (nouvel essai, nouvelle cotation).

**Délai dépassé** (Bitnob ne répond pas) : ne jamais relancer à l'aveugle. Interroger `GET /api/payouts/:id` d'abord.

### Relancer un échec
`SELECT start_payout_attempt(:payout_id, :user_id)` → nouvelle référence `...-R2`, puis le même parcours.
La fonction **refuse** si un essai est encore en cours ou si la ligne est déjà payée.
Écrire `payout_retried` dans `audit_log`.

### Fin du lot
Quand `v_batch_summary.n_in_progress = 0` : `UPDATE batches SET status = 'completed' | 'partial' | 'failed', finished_at = now()`.

### Ce que renvoie `apply_payout_event()`
| Valeur | Signification | Que faire |
| --- | --- | --- |
| `applied` | statut mis à jour | rien |
| `ignored_same` | même statut déjà en place (renvoi) | rien |
| `ignored_late` | événement plus ancien que le statut actuel (webhooks dans le désordre) | rien |
| `refused_needs_webhook` | tentative de marquer « payé » sans webhook | attendre le webhook de succès |
| `refused_conflict` | deux statuts finaux différents (ex. payé puis expiré) | créer une alerte, examiner à la main |
| `unknown_reference` | référence inconnue | créer une alerte (apparaît aussi dans `v_reconciliation_issues`) |

Interdits par la base (erreur immédiate) : modifier `payouts.status` directement, faire reculer un statut,
modifier un essai terminé, ouvrir deux essais vivants pour une même ligne, mettre deux fois la même personne dans un lot.

## 3. Webhooks Bitnob (paiements)

| Événement | Statut appliqué |
| --- | --- |
| `payouts.initialized` | `initialized` |
| `payouts.processing` | `pending` |
| `payouts.withdrawal.success` | `completed` (**seule** façon de marquer un paiement réussi) |
| `payouts.withdrawal.expired` | `expired` |

1. Lire le **corps brut**, vérifier `x-bitnob-signature` (HMAC SHA512) avec `role3.webhooks.verify_signature()`.
2. Toujours enregistrer : `INSERT INTO webhook_events (event_id, event_type, reference, payload, signature_valid) ... ON CONFLICT (event_id) DO NOTHING`.
   Rien d'inséré = renvoi déjà traité : répondre 200 et s'arrêter.
3. Signature invalide : répondre 200, ne rien appliquer (visible dans `v_reconciliation_issues`).
4. Sinon : `SELECT apply_payout_event(data.reference, :statut, :date, 'webhook', :event_id, NULL, data.provider_settlement_id, :payload)`,
   puis `UPDATE webhook_events SET processed_at = now()` (ou `processing_error`).
5. Répondre 200 vite ; se fier à `event`, pas à `data.status`.

Aucun webhook d'échec n'est documenté : un essai `pending` depuis plus de 15 minutes apparaît en `STUCK` ;
le backend interroge alors `GET /api/payouts/:id` et, si Bitnob répond `FAILED` :
`SELECT apply_payout_event(:ref, 'failed', now(), 'api', NULL, :raison)`.

## 4. Enveloppes budgétaires et cartes virtuelles

**Jamais stocké** : numéro complet de carte, CVV, date d'expiration, pièces d'identité (la base refuse toute suite de 12 à 19 chiffres
dans les champs texte des enveloppes et des transactions). **Stocké** : `bitnob_card_id`, `card_last4`, `bitnob_customer_id`, `kyc_status`.

| Action | Écriture en base |
| --- | --- |
| Créer l'enveloppe | `INSERT INTO envelopes (owner_id, name, category, monthly_budget_minor, low_balance_threshold_minor, created_by)` (statut `pending_kyc`) + audit `envelope_created` |
| Carte créée (KYC validé) | `UPDATE envelopes SET bitnob_customer_id, kyc_status = 'verified', bitnob_card_id, card_last4, status = 'active'` + audit `card_created` |
| Financement / rechargement du mois | 1) si `envelope_reloads` a déjà une ligne pour ce mois : rien ; 2) montant = `monthly_budget_minor - envelope_balance(id)` ; 3) financer la carte chez Bitnob ; 4) `SELECT reload_envelope(:id, :mois, :ref_bitnob)` + audit `envelope_reloaded` |
| Transaction de carte reçue | `SELECT record_card_transaction(:card_id, :tx_id, 'debit' / 'credit', 'success' / 'declined' / 'reversed', :montant_cents, :date, :marchand, :raison_refus, :payload)` → `recorded`, `duplicate` ou `unknown_card` |
| Après chaque transaction | lire `v_envelope_balances` : `alert_level = 'low'` → alerte « Il te reste X USD » (une fois) ; `should_be_frozen` → geler la carte chez Bitnob puis `UPDATE envelopes SET status = 'frozen', frozen_at = now(), frozen_reason = 'budget épuisé'` + audit `card_frozen` |
| Chaque jour | `INSERT INTO card_balance_snapshots (envelope_id, balance_minor)` avec le solde lu chez Bitnob |

`reload_envelope()` remet le solde **au niveau du budget mensuel** (complément), une seule fois par mois. Si l'équipe
préfère « ajouter le budget en entier chaque mois », c'est une migration 004 à prévoir ensemble.

## 5. Factures Bitcoin (Lightning)

| Action | Écriture en base |
| --- | --- |
| Créer | facture Lightning chez Bitnob, puis `INSERT INTO invoices (owner_id, number, customer_name, description, amount_sats, reference_minor, reference_currency, btc_usd_rate_at_creation, payment_request, bitnob_invoice_id, expires_at, created_by)` + audit `invoice_created` |
| Paiement reçu | `SELECT mark_invoice_paid(:bitnob_invoice_id, :date, :event_id, :taux)` → `paid`, `already_paid`, `refused_expired` ou `unknown_invoice` |
| Toutes les 5 minutes | `SELECT expire_invoices()` |

Une facture payée ou expirée ne change plus ; le montant et la facture Lightning ne changent jamais.

## 6. Utilisateurs et connexion

La connexion (mot de passe, mot de passe oublié, jetons) est gérée par **Supabase Auth**. La table `users` est le profil :

- à la première connexion : `INSERT INTO users (auth_user_id, email, full_name, role)` (e-mail en minuscules) ;
- à chaque connexion : `UPDATE users SET last_login_at = now()` + audit `user_login` ;
- refuser l'accès si `is_active = FALSE` ; seul le rôle `admin` lance un lot, gère une enveloppe ou crée une facture.

## 7. Journal d'audit : actions prévues

`user_login`, `batch_created`, `batch_launched`, `payout_retried`, `envelope_created`, `card_created`, `envelope_reloaded`,
`card_frozen`, `card_unfrozen`, `invoice_created`. Format imposé : minuscules et `_`. `user_id` vide = action du système.

## 8. Comptes PostgreSQL

| Compte | Pour | Peut | Ne peut pas |
| --- | --- | --- | --- |
| propriétaire (`postgres`) | Personne 2, migrations | tout | — |
| `app_backend` | backend | lire, ajouter, modifier ; appeler les fonctions | supprimer, modifier un journal, changer la structure |
| `ai_reader` | assistant IA | lire `v_ai_payouts`, `v_ai_invoices`, `v_kpis`, `v_kpis_all`, `v_monthly`, `v_daily_volume`, `v_by_currency`, `v_corridors`, `v_operators`, `v_regions`, `v_batch_summary`, `v_failure_reasons`, `v_asset_share`, `v_envelope_balances`, `v_envelope_monthly`, `v_envelope_spending`, `v_invoice_summary` | lire une table, écrire ; requête > 5 s |
| `powerbi_reader` | Power BI | lire toutes les vues sauf `v_payouts_enriched` (numéros complets) | écrire ; requête > 60 s |

Mots de passe : `python scripts\create_db_users.py` (jamais dans un fichier du dépôt).
Sur Supabase, l'utilisateur s'écrit `ai_reader.<identifiant-du-projet>` avec le pooler, comme `postgres.<identifiant>`.

L'assistant IA lit les descriptions des vues : `SELECT c.relname, obj_description(c.oid) FROM pg_class c WHERE c.relname LIKE 'v\_%'`.
Il écrit ses questions dans `ai_query_log` **via le backend** (le compte `ai_reader` est en lecture seule).

## 9. Points NON confirmés, à tester en sandbox le jour 1

| Question | Pourquoi c'est important | Où c'est géré |
| --- | --- | --- |
| Carte virtuelle : KYC du titulaire, création, financement, gel, transactions de test | Tout le module d'enveloppes en dépend | table `envelopes`, `record_card_transaction()` |
| Nom des événements de transaction de carte | Pour appeler `record_card_transaction()` | à noter ici après le test |
| Endpoints Lightning et événement de paiement d'une facture | Pour `mark_invoice_paid()` | à noter ici après le test |
| Les `fees` sont-ils inclus dans `amount` ? | Contrôle de solde avant un lot | `FEES_INCLUDED_IN_AMOUNT` dans `role3/pricing.py` (prudent : `False`) |
| Durée de validité d'une cotation | Un lot de 50 paiements peut la dépasser | `quotes_at_risk()` ; coter juste avant chaque paiement |
| Encodage de la signature (hex ou base64) | Sinon tous les webhooks sont rejetés | `verify_signature()` accepte les deux |
| Pays ouverts (Nigeria, Ghana, Sénégal) | Le sandbox n'ouvre qu'une partie des pays | `config/corridors.json`, champ `verified` |
| Codes banques et opérateurs (`bank_code`) | Obligatoires | `GET /api/payouts/banks/{pays}` |
| Limites min / max | Règles de validation | `GET /api/payouts/limits` |

## 10. Définitions des indicateurs (une seule source : `sql/views.sql`)

| Indicateur | Définition |
| --- | --- |
| Taux de succès | `completed / (completed + failed + expired)` ; les paiements en cours n'entrent pas au dénominateur |
| Volume | somme de `source_minor` des paiements `completed`, **par actif débité** (USDT, BTC jamais additionnés) |
| Frais | somme de `fee_source_minor` des paiements `completed`, par actif |
| Délai | `completed_at - initialized_at`, paiements `completed` ; on affiche la médiane |
| Bénéficiaires uniques | personnes distinctes ayant reçu au moins un paiement |
| Relances | lignes ayant plus d'un essai |
| Solde d'une enveloppe | somme de ses mouvements (cents de USD) |
| Dépensé ce mois | dépenses moins remboursements depuis le 1er du mois (UTC) |
| Jour / mois | en UTC (= heure de Dakar) |
