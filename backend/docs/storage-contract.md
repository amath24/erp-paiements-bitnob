# Contrat de stockage (pour la personne en charge de Supabase)

Le backend ne dépend que de l'interface `BatchRepository` (`app/repo/base.py`).
Il suffit d'implémenter `app/repo/supabase.py` puis de mettre `STORAGE_BACKEND=supabase`.
Aucun autre fichier du backend n'est à modifier. En attendant, `MemoryRepo` fait tourner tout le flux.

## Méthodes à implémenter (toutes `async`, `save_*` = upsert sur `id`)
| Méthode | Comportement |
|---|---|
| `create_batch(batch, payouts)` | Insère le batch et ses payouts (idéalement en une transaction) |
| `get_batch(id)` / `list_batches()` | `list_batches` : plus récent d'abord |
| `save_batch(batch)` | Upsert ; mettre `updated_at` à now |
| `get_payout(id)` / `list_payouts(batch_id=None)` | Triés par `line` ; sans `batch_id` = tous |
| `save_payout(payout)` | Upsert ; mettre `updated_at` à now |
| `find_payout(reference=..., bitnob_payout_id=...)` | Retrouve un payout (webhooks) ; `reference` est unique |

## Entité `Batch`
| Champ | Type | Notes |
|---|---|---|
| id | uuid (texte) | généré par le backend |
| name | texte | |
| status | texte | DRAFT, RUNNING, COMPLETED, PARTIAL, FAILED |
| from_asset | texte | BTC, USDT ou USDC |
| payment_reason | texte | |
| created_at, updated_at | timestamptz | |
| executed_at | timestamptz, nullable | |

## Entité `Payout`
| Champ | Type | Notes |
|---|---|---|
| id | uuid (texte) | |
| batch_id | uuid | référence vers Batch |
| line | entier | ligne du CSV |
| reference | texte, **unique** | envoyée à Bitnob, sert à relier les webhooks |
| attempts | entier | nombre de relances |
| name, account_number | texte | |
| bank_code | texte, nullable | |
| destination_type | texte | bank, mobile_money, swift |
| country | texte (2) | ISO alpha-2 |
| amount | **numeric** | montant reçu (précision : 20,8) |
| currency | texte (3) | |
| status | texte | PENDING, QUOTED, INITIATED, SUBMITTED, PROCESSING, SUCCESS, FAILED, EXPIRED, UNCERTAIN |
| quote_id, bitnob_payout_id | texte, nullable | `bitnob_payout_id` à indexer |
| quote | json, nullable | réponse brute de Bitnob |
| fee | numeric, nullable | |
| error, error_stage | texte, nullable | stage : quote, initialize ou finalize |
| created_at, updated_at | timestamptz | |
| completed_at | timestamptz, nullable | |

Index utiles : `payouts(batch_id)`, `payouts(reference)` unique, `payouts(bitnob_payout_id)`, `payouts(status)`, `payouts(created_at)`.

## Pas encore dans le repository (restent en mémoire)
Enveloppes, alertes et clients KYC (`app/services/envelopes.py`). Si la DB doit les porter,
dire à P1 : on ajoutera une interface `EnvelopeRepository` sur le même modèle.

## Vues pour le tableau de bord et l'assistant IA
`GET /dashboard/summary` est aujourd'hui calculé en Python (`app/services/dashboard.py`).
Les vues SQL peuvent produire exactement le même JSON ; le format de réponse ne change pas.
