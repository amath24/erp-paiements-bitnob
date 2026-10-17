# Contrat de l'equipe (toute modification = on previent le groupe)

## Proprietaires des fichiers (Repartition P1 a P5)
| Fichier / Dossier | Role | Proprietaire |
|---|---|---|
| `backend/app/` | API FastAPI, Client Bitnob, Routes paiements, services | **P1** |
| `db/` | Modeles SQLAlchemy, vues SQL (v_kpis), seed.py, database | **P2** |
| `ai/` | Agent Text-to-SQL, securite sql_guard, router IA | **P3** |
| `frontend/src/components/PosCheckout.jsx` | Caisse enregistreuse, QR Lightning, modal paiement | **P4** |
| `frontend/src/components/` (Dashboard, AiAssistant) | Tableaux de bord KPIs, chat assistant IA | **P5** |

## Variables d'environnement (noms exacts, lues UNIQUEMENT dans config.py)
BITNOB_CLIENT_ID, BITNOB_CLIENT_SECRET, BITNOB_BASE_URL, BITNOB_CUSTOMER_ID,
BITNOB_WEBHOOK_SECRET, DEMO_MODE, CONFIRM_PAYOUT, PORT, DATABASE_URL, GEMINI_API_KEY

## Routes
| Route | Corps | Reponse |
|---|---|---|
| POST /api/pay/create-invoice | { satoshis, description, customerName? } | { id, reference, paymentRequest, amountSat, status, expiresAt, qrCodeUrl } |
| GET /api/pay/status/{id} | | { id, status, paid, amountSat, demo? } |
| POST /api/pay/demo-pay/{id} | | { id, status, paid, demo, amountSat } (seulement si DEMO_MODE=true) |
| POST /api/settle/{id} | { xofAmount, beneficiary } | { ok, timeline } ou { already, timeline } |
| POST /webhooks/bitnob | corps brut Bitnob | 200 |
| GET /api/erp/kpis | | { todayRevenueXof, todayInvoicesCount, totalSatsCollected, ... } |
| GET /api/erp/invoices | | [ { id, reference, amountSat, status, description, createdAt } ] |
| POST /api/ai/query | { question } | { answer, sql, data } |
| GET /health | | { status, demo, db } |

Erreurs : toujours { "error": "message" } ; donnees invalides = 400.

## Objet facture (camelCase dans notre API JSON, snake_case dans le code Python)
id, reference, paymentRequest, amountSat (nombre), status ("pending" | "paid"), paid (booleen)

## Conventions de nommage
- JSON de notre API : camelCase (amountSat, paymentRequest).
- Corps envoyes a Bitnob : snake_case comme dans leur documentation (customer_id, amount, payment_reason).
- Python : snake_case pour variables et fonctions. Statuts et evenements : uniquement ceux de constants.py.

## Fonctions partagees
- bitnob(method, path, body) -> dict (async) ; leve BitnobError avec .status et .body
- convert_sats_to_usdt(sats, ref) ; payout_to_mobile_money(xof_amount, beneficiary, reason, ref) (async)
