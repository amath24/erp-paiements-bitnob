# Architecture Technique & Flux de Donnees

Ce document detaille le fonctionnement interne du backend, le flux d'une transaction Lightning, le role des fichiers ainsi que les limites et decisions d'architecture.

---

## 1. Flux complet d'une facture Lightning

```text
[Utilisateur / Navigateur]
         |
         | 1. POST /api/pay/create-invoice { satoshis, description }
         v
  [main.py (FastAPI)]
         |
         | 2. bitnob("POST", "/api/lightning/invoices", ...)
         v
  [bitnob.py (Client signe HMAC-SHA256)]
         |
         | 3. Requete HTTP avec X-Auth-Signature
         v
  [API Bitnob v2 (Sandbox)]
         |
         | 4. Retourne { id, request (BOLT11), amount_sat, ... }
         v
  [main.py]
         |
         | 5. Generation du QR code en base64 (qrcode[pil])
         v
[Utilisateur / Navigateur] <--- Affiche QR Code & initie le polling (GET /api/pay/status/{id})
         |
         | 6. Scan & Paiement (ou simulation POST /api/pay/demo-pay/{id})
         v
  [Bitnob Webhook Engine]
         |
         | 7. POST /webhooks/bitnob (En-tete x-bitnob-signature)
         v
  [main.py (Route webhook)]
         |
         | 8. Lecture corps brut, verification HMAC, dedoublonnage par event_id
         v
  [Etat local (invoices)] <--- Statut mis a jour: "paid"
         ^
         | 9. Polling frontend detecte "paid" -> Succes affiche a l'ecran
```

### Details par etape :
1. **Creation :** Le client web fournit un montant en satoshis et une description. Le backend verifie les parametres, genere une reference unique et sollicite Bitnob.
2. **Generation QR Code :** A partir de la chaine BOLT11 (`paymentRequest`), le backend encode un PNG en base64 sous forme d'URI (`data:image/png;base64,...`) directement exploitable par la balise `<img>` du front.
3. **Paiement :** En production, l'utilisateur regle via un wallet Lightning (ex: Phoenix, Strike, Blink). En sandbox, le paiement externe etant restreint, l'application propose un bouton "Simuler le paiement" (`POST /api/pay/demo-pay/{id}`).
4. **Webhook & Notification :** Bitnob notifie le serveur via `POST /webhooks/bitnob`. Le backend lit le flux brut d'octets (`await request.body()`), valide la signature secrete, verifie qu'il ne s'agit pas d'un rejeu (`seen_events`), puis valide la facture.
5. **Confirmation :** Le frontend effectue un polling regulier (`GET /api/pay/status/{id}`) et informe l'utilisateur des la confirmation.

---

## 2. Structure Modulaire & Repartition de l'Equipe

| Pole | Repertoire | Role et Responsabilites |
|---|---|---|
| **P1** | `backend/app/` | API FastAPI, client Bitnob v2 signe HMAC, routes factures, webhooks bruts et services de conversion USDT/payout. |
| **P2** | `db/` | Modeles relationnels SQLAlchemy (`Customer`, `Invoice`, `Settlement`, `WebhookEvent`), vues analytiques (`v_kpis`, `v_transactions_summary`) et jeu d'essai `seed.py`. |
| **P3** | `ai/` | Assistant IA financier : moteur Text-to-SQL sur les vues ERP, securite stricte en lecture seule via `sql_guard.py` et routeur `/api/ai/query`. |
| **P4** | `frontend/` & `static/` | Caisse enregistreuse (POS), generation instantanee du QR code Lightning, polling du statut en direct et modal de reglement. |
| **P5** | `frontend/` & `static/` | Tableau de bord analytique des KPIs financiers et interface de chat interactif avec l'agent IA. |

---

## 3. Limites connues de la sandbox et solutions apportees

1. **Persistance des donnees :** Le probleme de volatilite en memoire du kit initial est desormais **resolu** par la base de donnees SQLAlchemy (SQLite natif sans Docker ou PostgreSQL cloud). Les factures et webhooks persistent meme apres redemarrage.
2. **Statut "paye" reel non confirme sur testnet :** La fonctionnalite de retrait Lightning etant desactivee sur les comptes sandbox de base ("Lightning withdrawals feature is currently not available"), un paiement reel emis vers un nœud externe n'a pas pu etre observe. La demonstration s'appuie sur la simulation webhook ou l'endpoint demo.
3. **Format exact de signature du webhook :** La documentation officielle de Bitnob etant ambigue sur la formule exacte de signature entrante des webhooks, `backend/app/routers/webhooks.py` teste plusieurs combinaisons de hachage et trace les resultats pour identification.

---

## 4. Decisions architecturales

- **Architecture sans Docker :** Utilisation de SQLite par defaut pour un fonctionnement 100% natif et immediat sur Windows PowerShell, tout en maintenant la compatibilite totale avec PostgreSQL via `DATABASE_URL`.
- **FastAPI Asynchrone :** Utilisation de routes `async` et du client `httpx.AsyncClient` pour assurer des operations non-bloquantes lors des appels reseau vers l'API Bitnob.
- **Corps brut pour les webhooks :** Lecture obligatoire de `await request.body()` sans validation Pydantic prealable, car Bitnob envoie parfois un en-tete `Content-Type` duplique rejetant les parseurs stricts.
- **Securite SQL Guard :** L'agent IA n'a acces a la base qu'a travers des requetes `SELECT` verifiees par `sql_guard.py`. Aucune ecriture ni suppression n'est permise via l'interface IA.
- **Preimage protegee :** La `preimage` (preuve cryptographique de paiement Lightning) ne doit jamais etre retournee aux clients web ni exposee dans les logs.
