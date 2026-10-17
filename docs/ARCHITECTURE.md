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

## 2. Role de chaque fichier

| Fichier / Dossier | Role et Responsabilites |
|---|---|
| `main.py` | Point d'entree FastAPI, definition des routes de l'API REST, gestion des webhooks, stockage en memoire de l'etat des factures et montage des fichiers statiques. |
| `config.py` | Chargement securise des variables d'environnement (`.env`) avec valeurs de repli pour le developpement sandbox. |
| `constants.py` | Constantes applicatives centralisees (statuts `pending`/`paid`, codes d'evenements webhook, parametres d'expiration). |
| `bitnob.py` | Client HTTP asynchrone (`httpx`) implementant le protocole de signature cryptographique HMAC-SHA256 exige par l'API Bitnob v2. |
| `settlement.py` | Squelette metier pour la conversion automatique BTC -> USDT et l'initiation de payouts vers des beneficiaires Mobile Money (Wave, Orange Money SN). |
| `static/` | Application front-end simple et legere (HTML5 / Vanilla JS) pour la demonstration. |
| `CONTRACT.md` | Contrat d'interface formel entre developpeurs (routes, formats JSON, variables d'environnement). |
| `LECONS.md` | Base de connaissances des pieges, comportements specifiques et reponses de la sandbox Bitnob. |
| `handoff.py` | Outil de diagnostic rapide pour verifier l'etat git, la syntaxe Python et la disponibilite du serveur local. |

---

## 3. Limites connues de la sandbox et du kit

1. **Etat en memoire non persistant :** Les factures creees et les identifiants d'evenements sont stockes dans des dictionnaires en memoire (`invoices`, `seen_events`). Tout redemarrage du serveur ou de rechargement Uvicorn efface les factures en cours.
2. **Statut "paye" reel non confirme sur testnet :** La fonctionnalite de retrait Lightning etant desactivee sur les comptes sandbox de base ("Lightning withdrawals feature is currently not available"), un paiement reel emis vers un nœud externe n'a pas pu etre observe. La demonstration s'appuie donc sur la simulation webhook ou l'endpoint demo.
3. **Format exact de signature du webhook :** La documentation officielle de Bitnob etant ambigue sur la formule exacte de signature entrante des webhooks, `main.py` teste plusieurs combinaisons plausibles de hachage et trace les resultats pour identification.

---

## 4. Decisions architecturales

- **FastAPI Asynchrone :** Utilisation de routes `async` et du client `httpx.AsyncClient` pour assurer des operations non-bloquantes lors des appels reseau vers l'API Bitnob.
- **Corps brut pour les webhooks :** Lecture obligatoire de `await request.body()` sans validation Pydantic prealable, car Bitnob envoie parfois un en-tete `Content-Type` duplique (`application/json, application/json`) rejetant les parseurs stricts.
- **Zero secrets dans le code :** Toutes les cles privees, identifiants de webhook et customer IDs sont strictement lus depuis les variables d'environnement chargees par `config.py`.
- **Preimage protegee :** La `preimage` (preuve cryptographique de paiement Lightning retournee par Bitnob) ne doit jamais etre retournee aux clients web ni exposee dans les logs.
