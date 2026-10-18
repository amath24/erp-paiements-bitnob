# Contrat d'API – BulkPay ERP (backend v0.3)

Base : `http://localhost:8000` · Documentation interactive : `/docs` · Schéma : `/openapi.json`
Tous les endpoints (sauf `/health` et `/webhooks/*`) exigent le header `X-API-Key`.
Montants des payouts : **chaînes décimales** (`"50.5"`). Dates : ISO 8601. Erreurs Bitnob : `{"error":"bitnob_error","details":{...}}`.

## Paiements de masse
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/batches` | multipart : `file` (CSV), `name`, `from_asset` (USDT), `payment_reason`, `default_destination_type`, `strict`, `allow_duplicates` | 201 **récap** |
| POST | `/batches/manual` | JSON : `beneficiaries[]` (name, account_number, bank_code, destination_type, country, amount, currency) + options | 201 **récap** |
| GET | `/batches` | – | liste de récaps |
| GET | `/batches/{id}` | – | récap + `payouts[]` |
| POST | `/batches/{id}/execute` | – | 202 `{batch_id, status:"RUNNING"}` ; 409 si déjà lancé |
| POST | `/batches/{id}/retry` | – | 202 `{retried: n}` (FAILED/EXPIRED seulement) |
| POST | `/batches/{id}/refresh` | – | `{updated, errors[]}` (interroge Bitnob) |
| GET | `/batches/{id}/report.csv` | – | fichier CSV |

**Récap** : `batch{id,name,status,...}`, `beneficiaries_count`, `rejected_count`, `totals_by_currency`, `countries`, `payouts_by_status`, `rejected_rows[{line,errors[],data}]`, `warnings[]`.
**CSV** : colonnes `name, account_number, bank_code, amount, currency, country` (alias FR acceptés : nom, compte, operateur, montant, devise, pays ; séparateur `,` ou `;`). Exemple : `docs/example_beneficiaries.csv`.
**Statuts batch** : DRAFT → RUNNING → COMPLETED / PARTIAL / FAILED.
**Statuts payout** : PENDING, QUOTED, INITIATED, SUBMITTED, PROCESSING, **SUCCESS**, FAILED, EXPIRED, UNCERTAIN (= à vérifier avec `/refresh`, jamais relancé automatiquement).
Le frontend suit un batch en interrogeant `GET /batches/{id}` toutes les 2 à 3 secondes tant que `batch.status = RUNNING`.

## Tableau de bord
`GET /dashboard/summary` → `totals{batches,payouts,unique_beneficiaries,success,failed,in_progress,success_rate}`, `volume_by_currency{GHS:{total,sent}}`, `by_country[]`, `by_day[]`, `recent_batches[]`, `envelopes{count,total_monthly_budget_usd,alerts}`.

## Enveloppes budgétaires (cartes virtuelles)
| Méthode | Route | Rôle |
|---|---|---|
| POST | `/envelopes` | `{name, monthly_budget_usd, customer_id?}` crée la carte financée |
| GET | `/envelopes`, `/envelopes/{card_id}` | `{card_id,name,status,last4,balance_usd,monthly_budget_usd,spent_usd}` |
| GET | `/envelopes/{card_id}/transactions` | dépenses |
| POST | `/envelopes/{card_id}/recharge`, `/envelopes/recharge-all` | remonte au budget |
| POST | `/envelopes/{card_id}/freeze`, `/unfreeze` | gel manuel |
| GET | `/alerts` | solde bas, carte gelée, paiements refusés |
| POST | `/cards/kyc`, GET `/cards/kyc/customers` | vérification du titulaire |
| POST | `/cards/{id}/simulate/{authorization\|settlement\|reversal\|decline}` | sandbox |

## Factures Bitcoin (Lightning)
`POST /invoices {amount_sat, description, expiry_seconds?}` → facture + `qr_svg_data_uri` + `qr_png_data_uri` (à mettre dans un `<img src>`).
`GET /invoices/{id}` : `status` = pending / paid / expired. `GET /invoices/{id}/qr.svg` : image.

## Compte et payouts unitaires
`GET /whoami`, `GET /balances`, `GET /payouts/countries`, `/payouts/countries/{ISO2}`, `/payouts/banks/{ISO2}`,
`POST /payout/quote`, `/payout/{quote_id}/initialize`, `/payout/{quote_id}/finalize`, `GET /payout/{id}`, `POST /payout` (tout-en-un).

## Mode simulé
`GET /health` → `{"status":"ok","mode":"mock"|"live"}` (afficher un bandeau si `mock`).
Hors production seulement : `GET /mock/state`, `POST /mock/credit`, `POST /mock/reset`, `POST /invoices/{id}/simulate-paid`.
Comptes de démo : un `account_number` finissant par `0000` échoue, `9999` expire, `5000` reste UNCERTAIN (résolu par `/refresh`) ; les autres réussissent.

## Assistant IA
Non porté par ce backend. Contrat proposé à l'équipe IA : `POST /ai/chat {message}` → `{answer, sql, data}`.
