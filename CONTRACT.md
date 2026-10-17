# Contrat de l'equipe (toute modification = on previent le groupe)

## Proprietaires des fichiers (a remplir au debut)
| Fichier | Role | Proprietaire |
|---|---|---|
| config.py, constants.py | variables d'environnement, noms partages | |
| bitnob.py | client Bitnob signe (HMAC) | |
| main.py | routes factures, webhook, demo, reglement | |
| settlement.py | conversion BTC vers USDT, payout mobile money | |
| static/ | interface web | |

## Variables d'environnement (noms exacts, lues UNIQUEMENT dans config.py)
BITNOB_CLIENT_ID, BITNOB_CLIENT_SECRET, BITNOB_BASE_URL, BITNOB_CUSTOMER_ID,
BITNOB_WEBHOOK_SECRET, DEMO_MODE, CONFIRM_PAYOUT, PORT

## Routes
| Route | Corps | Reponse |
|---|---|---|
| POST /api/pay/create-invoice | { satoshis, description } | { id, reference, paymentRequest, amountSat, status, expiresAt, qrCodeUrl } |
| GET /api/pay/status/{id} | | { id, status, paid, amountSat, demo? } |
| POST /api/pay/demo-pay/{id} | | { id, status, paid, demo, amountSat } (seulement si DEMO_MODE=true) |
| POST /api/settle/{id} | { xofAmount, beneficiary } | { ok, timeline } ou { already, timeline } |
| POST /webhooks/bitnob | corps brut Bitnob | 200 |
| GET /health | | { status, demo } |

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
