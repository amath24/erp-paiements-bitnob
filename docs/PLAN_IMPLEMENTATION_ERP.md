# Plan d'Implementation : ERP de Paiements Bitnob & IA

**Projet :** ERP de Paiements Lightning & IA (Hackathon Code & Chain Dakar)  
**Equipe :** 5 Personnes (P1 Backend, P2 Database, P3 IA, P4 & P5 Frontend)  
**Environnement :** Windows + PowerShell (Sans Docker, 100% natif)

---

## 1. Analyse des concordances et ajustements ("Ce qui ne concorde pas")

### A. Suppression de Docker (`docker-compose.yml`)
- **Constat :** Aucun serveur PostgreSQL local ni Docker n'est installe sur la machine Windows actuelle.
- **Solution retenue :** 
  - Utilisation de **SQLite via SQLAlchemy** (`sqlite:///./erp.db`) par defaut pour un fonctionnement immediat, zero installation et zero conflit de port sur Windows.
  - Le code dans `db/database.py` reste 100% compatible avec PostgreSQL via la variable d'environnement `DATABASE_URL` (ce qui permet d'utiliser une base Postgres Cloud gratuite comme Neon ou Supabase si l'equipe le souhaite).
  - Lancement simplifie avec un script PowerShell `start-dev.ps1` qui demarre le backend FastAPI et le frontend Vite en parallele.

### B. Transition de l'etat en memoire vers la Base de Donnees (P1 & P2)
- **Constat :** Dans le kit initial, les factures (`invoices`) et les evenements webhooks (`seen_events`) etaient stockes dans des dictionnaires Python volatils en memoire.
- **Solution retenue :** P2 cree les modeles `Invoice`, `Settlement`, `Customer`, `WebhookEvent`. P1 remplace les dictionnaires en memoire par des requetes de session SQLAlchemy (`db.add()`, `db.commit()`), garantissant que les donnees restent apres redemarrage.

### C. Architecture unifiee du module IA (P3)
- **Constat :** Avoir un serveur IA completement separe necessiterait de gerer deux ports et du CORS supplementaire.
- **Solution retenue :** Le routeur `ai/router.py` est directement integre comme sous-routeur FastAPI dans l'application principale sous `/api/ai`, partageant le contexte et la base de donnees via `sql_guard.py`.

---

## 2. Arborescence cible complete (Fichiers ajoutes mis en avant)

```text
erp-paiements/
│
├── .env.example                     # Variables d'environnement centralisees
├── .gitignore                       # Exclut .env, .venv/, *.db, node_modules/, PROGRESS.md
├── requirements.txt                 # Dependances Python (FastAPI, SQLAlchemy, Bitnob, AI)
├── start-dev.ps1                    # Script PowerShell de demarrage rapide (Backend + Front)
├── handoff.py                       # Diagnostic de sante reel (git, syntaxe, serveur)
├── AGENTS.md                        # Regles d'equipe IA
├── CONTRACT.md                      # Contrat de repartition des roles P1 a P5
├── LECONS.md                        # Retours d'experience Sandbox Bitnob
├── PROGRESS.md                      # Journal de bord local
│
├── docs/
│   ├── ARCHITECTURE.md              # Vue d'ensemble architecturale globale
│   ├── api-contract.md              # Contrat des routes API REST & IA (Section 4)
│   └── db-schema.md                 # Schema des tables, relations et vues analytiques
│
├── backend/                         # P1 : Backend & API Bitnob
│   └── app/
│       ├── main.py                  # Point d'entree FastAPI, CORS, montage routers
│       ├── config.py                # Lecture .env
│       ├── constants.py             # Constantes statuts et webhooks
│       ├── schemas/                 # Modeles Pydantic d'entree/sortie
│       │   ├── invoice.py
│       │   ├── settlement.py
│       │   └── ai.py
│       ├── bitnob/                  # Client Bitnob signe HMAC-SHA256
│       │   └── client.py
│       ├── routers/                 # Endpoints REST
│       │   ├── invoices.py          # /api/pay/create-invoice, status, demo-pay
│       │   ├── webhooks.py          # /webhooks/bitnob
│       │   └── settlement.py        # /api/settle
│       └── services/                # Logique metier
│           ├── invoice_service.py
│           └── settlement_service.py
│
├── db/                              # P2 : Base de Donnees & Donnees Demo
│   ├── database.py                  # Moteur SQLAlchemy (SQLite / PostgreSQL)
│   ├── models.py                    # Tables (invoices, settlements, customers, events)
│   ├── seed.py                      # Donnees de demonstration realistes pour le jury
│   └── views.sql                    # Vues SQL de KPI (v_kpis, v_payouts_by_month...)
│
├── ai/                              # P3 : Agent IA & Securite SQL
│   ├── agent.py                     # Agent Text-to-SQL (Gemini / LLM) pour requetes en langage naturel
│   ├── sql_guard.py                 # Garde-fou de securite : autorise UNIQUEMENT SELECT sur les vues
│   └── router.py                    # Routeur FastAPI : POST /api/ai/query
│
└── frontend/                        # P4 + P5 : Interface Utilisateur ERP
    ├── package.json                 # Scripts et dependances Vite / Web
    ├── vite.config.js               # Configuration du bundler & proxy API
    ├── index.html                   # Shell HTML de l'ERP
    └── src/
        ├── main.js / App.jsx        # Navigation et mise en page principale
        ├── components/
        │   ├── Navbar.jsx           # En-tete avec solde, statut reseau Lightning
        │   ├── PosCheckout.jsx      # Caisse enregistreuse (creation facture & QR)
        │   ├── InvoiceTable.jsx     # Liste des factures et statuts en temps reel
        │   ├── KpiDashboard.jsx     # Graphiques et indicateurs de performance
        │   ├── SettlementModal.jsx  # Payout Mobile Money (Wave, Orange Money)
        │   └── AiAssistant.jsx      # Panneau de discussion IA "Discutez avec votre ERP"
        └── api.js                   # Client HTTP fetch vers le backend
```

---

## 3. Repartition des roles et livrables de l'equipe

| Membre | Perimetre | Dossier | Responsabilite cle au hackathon |
|---|---|---|---|
| **P1** | Backend & Bitnob | `backend/app/` | Port de l'API Bitnob, generation QR code, webhooks signes, conversion sats->USDT. |
| **P2** | Donnees & Analyse | `db/` | Modele relationnel, persistance des factures, vues SQL analytiques (`v_kpis`), jeu d'essai `seed.py`. |
| **P3** | Agent IA & Securite | `ai/` | Text-to-SQL sur les vues SQL, validation `sql_guard.py` (lecture seule stricte), endpoint `/api/ai/query`. |
| **P4** | Frontend Caisse & Paiements | `frontend/` | Interface Caisse/POS, affichage du QR code Lightning en direct, polling de statut et feedback de reglement. |
| **P5** | Frontend Dashboard & Chat IA | `frontend/` | Tableau de bord des ventes (graphiques KPIs) et composant interactif de chat avec l'agent IA. |

---

## 4. Contrat d'Interface API & Donnees (Section 4)

### Endpoints Paiements & Factures (P1)
- `POST /api/pay/create-invoice` : `{ "satoshis": int, "description": str, "customerName": str? }`
- `GET /api/pay/status/{id}` : `{ "id", "status": "pending"|"paid", "amountSat", "paid": bool }`
- `POST /api/pay/demo-pay/{id}` : Simulation locale de paiement instantane (si `DEMO_MODE=true`).
- `POST /api/settle/{id}` : `{ "xofAmount": int, "beneficiary": str }` -> Declenche payout Mobile Money.
- `POST /webhooks/bitnob` : Reception brute Bitnob avec validation signature HMAC et anti-replay `event_id`.

### Endpoints Base de Donnees & KPIs (P2)
- `GET /api/erp/kpis` : Renvoie les agregats issus de `v_kpis` (Chiffre d'affaires journalier, volume sats encaisse, conversions).
- `GET /api/erp/invoices` : Liste paginee des factures persistees avec filtre par statut.

### Endpoints IA Assistant (P3)
- `POST /api/ai/query` : `{ "question": "Quel est le chiffre d'affaires realise aujourd'hui ?" }`
  - *Flux interne :* `agent.py` convertit la question en requête SQL -> `sql_guard.py` verifie qu'il s'agit d'un `SELECT` sur les vues autorisees -> execution -> synthese en francais fluide.
  - *Reponse :* `{ "answer": "...", "sql": "SELECT ...", "data": [...] }`

---

## 5. Plan d'execution par phases

1. **Phase 1 (Socle Racine & Documentation) :**
   - Mettre a jour `docs/api-contract.md` et `docs/db-schema.md`.
   - Enrichir `requirements.txt` et `start-dev.ps1`.
2. **Phase 2 (P2 - DB & Vues SQL) :**
   - Creer `db/database.py`, `db/models.py`, `db/views.sql` et `db/seed.py`.
   - Initialiser la base SQLite locale avec les donnees de demo.
3. **Phase 3 (P1 - Migration Backend Bitnob) :**
   - Structurer `backend/app/` avec routers, services et client Bitnob sans changer la logique existante.
   - Lier les factures a la base de donnees.
4. **Phase 4 (P3 - Module IA Text-to-SQL) :**
   - Implementer `ai/sql_guard.py`, `ai/agent.py` et `ai/router.py`.
5. **Phase 5 (P4 + P5 - Frontend ERP Moderne) :**
   - Configurer l'application frontend avec ecran de caisse, suivi de paiement et assistant IA.
