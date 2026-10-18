# SunuPay — Passerelle FinTech Bitcoin, Stablecoins & Mobile Money

SunuPay est une application web FinTech moderne conçue pour les freelances, créateurs, commerçants et PME en Afrique et à l'international. Elle permet d'émettre des factures réglables en crypto-actifs (Bitcoin, USDT, USDC) et de transférer instantanément les fonds vers les opérateurs locaux de Mobile Money (Wave, Orange Money, Free, MTN) et comptes bancaires.

---

## 🎨 Identité Visuelle & Design System

L'interface est strictement alignée sur la maquette officielle :
- **Noir profond (`#0D0D11`)** pour la sidebar persistante, les cartes de solde principal et les éléments structurants.
- **Jaune vif or (`#F5C200`)** pour l'accentuation principale, les boutons d'action clés, les indicateurs d'état actif et les cartes Gold.
- **Surfaces claires (`#F8F9FB`)** et cartes blanches aux coins arrondis (`rounded-2xl`) avec ombres discrètes.
- **Typographie moderne** avec hiérarchie soignée et contrastes certifiés.

---

## 🚀 Fonctionnalités Implémentées

### 1. Dashboard
- **Soldes multi-devises** : Solde total avec masque de confidentialité, soldes Bitcoin (BTC), USDT et USDC avec cours en temps réel.
- **Évolution des paiements** : Graphique Recharts dynamique des flux entrants et sortants.
- **Statistiques clés** : Factures créées, paiements reçus avec pourcentages de croissance.
- **Transactions récentes** : Tableau avec badges de statut colorés (*Confirmé*, *En attente*).
- **Raccourci vers la création de facture et l'Assistant IA**.

### 2. Gestion des Factures (`/factures`)
- Formulaire interactif de création avec devises personnalisées (USD, EUR, USDT, USDC).
- Sélection des crypto-actifs acceptés (Bitcoin, USDT TRC20/ERC20, USDC).
- **Aperçu temps réel (Live Preview)** avec carte certifiée, QR Code dynamique intégrant le badge SunuPay et lien de paiement partageable avec copie instantanée.
- Liste complète des factures avec recherche textuelle et filtres par statut (*Brouillon*, *En attente*, *Payée*, *Expirée*).

### 3. Transferts & Décaissements (`/transferts`)
- Envoi vers les opérateurs majeurs d'Afrique de l'Ouest et de l'Est (Sénégal, Côte d'Ivoire, Mali, Bénin, Nigéria, Kenya).
- Prise en charge de **Mobile Money** (Orange Money, Wave, MTN MoMo, Free), **Comptes bancaires** et **Cash pickup**.
- **Calculateur de frais & conversion transparente** : estimation du net reçu garanti sans frais cachés.
- Fenêtre modale de confirmation avant validation finale.

### 4. Cartes Virtuelles (`/cartes`)
- Cartes virtuelles physiques et virtuelles (thèmes Gold, Obsidian, Silver).
- Interrupteur interactif pour **geler / dégeler instantanément** une carte.
- Graphique donut Recharts des **dépenses par catégorie** (Services en ligne, Logiciels, Publicité, Voyage, Autres).
- Historique détaillé des dépenses par marchand.
- Émission de nouvelles cartes virtuelles (Mode Démonstration sécurisé).

### 5. Assistant IA FinTech (`/assistant`)
- Interface conversationnelle avec suggestions rapides.
- **Moteur déterministe certifié** : calculs de montants de facturation pour obtenir un montant net exact en FCFA, diagnostics de transactions et annuaire des moyens de paiement par pays.
- Bouton direct pour générer automatiquement une facture à partir du calcul de l'assistant.

### 6. Checkout Client Public (`/pay/:id`)
- Page publique de règlement accessible par le client avec scan QR Code, sélection crypto (USDT, BTC, USDC) et copie d'adresse de dépôt.

### 7. Socle Technique & Sécurité Backend
- Client **Bitnob** serveur avec validation des signatures de webhooks HMAC SHA512 et clés d'idempotence.
- Connecteur **Supabase** avec bascule automatique en mode Démonstration si les clés ne sont pas renseignées.
- Endpoints API Next.js : `/api/invoices`, `/api/transfers`, `/api/webhooks/bitnob`.

---

## 🛠️ Stack Technique

- **Framework** : [Next.js](https://nextjs.org/) (App Router) & React 19
- **Langage** : TypeScript (mode strict)
- **Styles** : [Tailwind CSS v4](https://tailwindcss.com/)
- **Icônes** : [Lucide React](https://lucide.dev/)
- **Graphiques** : [Recharts](https://recharts.org/)
- **QR Code** : `qrcode`
- **Sécurité** : Validation HMAC côté serveur, aucune exposition de clé secrète

---

## 📦 Installation et Démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement (optionnel)
cp .env.example .env.local

# 3. Lancer le serveur de développement
npm run dev
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).
