# Architecture Technique & Guide d'Intégration — PayLink Afrique

## 1. Vue d'ensemble du système

**PayLink Afrique** est une plateforme FinTech conçue pour permettre aux indépendants, créateurs, commerçants et PME d'encaisser des paiements internationaux en crypto-actifs (Bitcoin Lightning, USDT, USDC) et de convertir / décaisser instantanément ces fonds vers les réseaux locaux de Mobile Money (Wave, Orange Money, Free, MTN MoMo, M-Pesa) et comptes bancaires.

```
+--------------------------------------------------------------------------+
|                             CLIENT / BROWSER                             |
|  - Dashboard      - Factures & QR Code     - Transferts Mobile Money     |
|  - Cartes         - Assistant IA           - Checkout Public (/pay/:id)  |
+--------------------------------------------------------------------------+
                                     |
                                     | HTTPS / API Routes
                                     v
+--------------------------------------------------------------------------+
|                          NEXT.JS SERVER (BACKEND)                        |
|  - app/api/invoices/route.ts   : Validation & Création liens Bitnob      |
|  - app/api/transfers/route.ts  : Idempotence & Ordres de virement        |
|  - app/api/webhooks/bitnob/    : Validation HMAC SHA512 & Anti-rejeu     |
|  - lib/assistant-engine.ts     : Moteur de calcul financier déterministe |
+--------------------------------------------------------------------------+
                     |                                    |
                     v                                    v
+-----------------------------+          +---------------------------------+
|     SUPABASE (POSTGRES)     |          |       BITNOB FINTECH API        |
|  - Auth & Sessions          |          |  - Bitcoin on-chain & Lightning |
|  - Factures & Transactions  |          |  - USDT (TRC20 / ERC20) & USDC  |
|  - Bénéficiaires & Cartes   |          |  - Payouts Mobile Money (XOF)   |
+-----------------------------+          +---------------------------------+
```

## 2. Flux de fonctionnement clés

### A. Création et Encaissement d'une facture
1. Le freelance saisit les détails de sa facture sur `/factures`.
2. Le backend serveur appelle l'endpoint Bitnob `/checkout` pour provisionner une adresse sécurisée ou génère un QR code instantané.
3. Le client effectue le paiement depuis n'importe quel wallet mondial (Binance, Trust Wallet, Phoenix, Kraken).
4. Le webhook Bitnob notifie PayLink Afrique via `/api/webhooks/bitnob`. La signature HMAC est vérifiée.
5. Le solde du freelance est crédité en temps réel.

### B. Transfert vers Mobile Money
1. L'utilisateur renseigne le montant en USDT/USDC et le numéro du bénéficiaire sur `/transferts`.
2. Les frais et le montant net sont calculés de façon déterministe avec le taux garanti (ex. 1 USDT = 595 XOF).
3. Une boîte de dialogue de confirmation récapitule les montants nets.
4. Le backend initie le payout avec une clé d'idempotence (`Idempotency-Key: TR-...`) pour interdire tout double débit en cas de coupure réseau.

### C. Gestion des Cartes Virtuelles
1. Les cartes affichées sur `/cartes` utilisent un système de tokens virtuels masqués (ex. `•••• 9867`).
2. Les plafonds sont modifiables en direct.
3. Un interrupteur permet de geler instantanément la carte contre les fraudes.

## 3. Sécurité & Bonnes pratiques
- **Zéro fuite de clés** : Aucune clé `BITNOB_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` n'est préfixée par `NEXT_PUBLIC_`.
- **Mode Démo natif** : Si les clés API sont absentes, l'application fonctionne sans planter en mode Sandbox documenté.
- **Idempotence** : Prévention automatique du rejeu des webhooks via mise en cache des identifiants d'événements.
