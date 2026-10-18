# BulkPay ERP — Base de données et tableau de bord (Personne 2, dossier `db`)

Tout ce qui touche aux données : la structure de la base PostgreSQL (Supabase), les règles qui empêchent
de payer deux fois ou de perdre un franc, les indicateurs, les données de démo et le tableau de bord.

> **Règlement du hackathon.** Si le code écrit avant l'événement est interdit ou doit être déclaré,
> publiez ce dépôt en open source **avant** le hackathon et déclarez-le aux organisateurs.

## Ce que garantit la base (même si le code se trompe)

| Règle | Comment |
| --- | --- |
| Personne n'est payé deux fois | un seul essai « vivant ou réussi » par ligne (index unique) ; une personne une seule fois par lot |
| Un paiement n'est « réussi » qu'avec le webhook de Bitnob | fonction `apply_payout_event()` |
| Un statut ne recule jamais, un statut final ne change plus | déclencheurs sur `payout_attempts` et `invoices` |
| Relancer un échec ne crée pas de doublon | `start_payout_attempt()` : nouvel essai `-R2`, refusé si un essai est en cours ou réussi |
| Solde d'une enveloppe toujours juste | solde = somme d'un journal de mouvements jamais modifié ; transaction de carte comptée une fois |
| Un rechargement par mois et par enveloppe | clé primaire (enveloppe, mois) |
| Aucun numéro de carte complet, aucun mot de passe | seulement l'identifiant de carte et les 4 derniers chiffres ; connexion gérée par Supabase Auth |
| Qui a fait quoi | `audit_log`, en ajout seulement |
| Chacun n'a que ses droits | comptes `app_backend`, `ai_reader` (lecture des vues sans donnée personnelle), `powerbi_reader` ; RLS partout ; API publique Supabase fermée |
| Chiffres cohérents | 18 contrôles dans `v_consistency_checks`, vérifiés par `scripts/check.py` |

Le détail, et ce que le backend doit appeler à chaque étape : **[docs/dictionnaire_donnees.md](docs/dictionnaire_donnees.md)**.

## Mettre à jour votre base Supabase (v2 → v3)

Dans le terminal VS Code (PowerShell), dans le dossier du projet, avec l'environnement Python activé :

```powershell
$env:DATABASE_URL = "postgresql://postgres.VOTRE_PROJET:VOTRE_MOT_DE_PASSE@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

python scripts\migrate.py --status     # ce qui est appliqué / à appliquer
python scripts\migrate.py              # applique la v3 (efface seulement les données de DÉMO v2)
python scripts\seed.py --reset         # données de démo du scénario BulkPay ERP
python scripts\check.py                # 18 contrôles OK attendus
streamlit run dashboard\app.py
```

Puis, une seule fois, créez les comptes de l'équipe et donnez chaque adresse **en privé** :

```powershell
python scripts\create_db_users.py
```

La migration est faite dans une transaction : si elle échoue, rien n'est modifié. Les données **réelles**
(`is_simulated = FALSE`) sont conservées et reprises.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `sql/migrations/001_schema.sql` | Schéma de départ (v1) |
| `sql/migrations/002_region.sql` | Colonne région (v2) |
| `sql/migrations/003_bulkpay_erp.sql` | v3 : essais de paiement, enveloppes et cartes, factures Lightning, audit, IA, fonctions pour le backend |
| `sql/views.sql` | Indicateurs (définis une seule fois), rapprochement, contrôles de cohérence — rejoué à chaque migration |
| `sql/security.sql` | Comptes, droits, RLS — rejoué à chaque migration |
| `sql/comments.sql` | Descriptions en français des tables et vues (lues par l'assistant IA) |
| `scripts/migrate.py` | Met la base à jour (vide ou existante) ; refuse un fichier déjà appliqué puis modifié |
| `scripts/seed.py` | Données de démo : 50 livreurs NG/GH/SN sur 90 jours, relances, 3 enveloppes, 12 factures, problèmes plantés |
| `scripts/check.py` | Contrôle avant démo (code de sortie 1 si un chiffre est incohérent) |
| `scripts/create_db_users.py` | Active les comptes de l'équipe avec des mots de passe neufs |
| `scripts/make_test_csvs.py` | CSV de test, dont `data/livreurs_demo_50.csv` (scénario : 2 numéros invalides) |
| `config/corridors.json` | Pays, devises, opérateurs, limites ; `verified` passe à `true` après test en sandbox |
| `role3/` | Montants exacts, validation de CSV, calcul des cotations, webhooks (module Python réutilisable par le backend) |
| `dashboard/app.py` | Tableau de bord Streamlit : paiements, à surveiller, lots, budgets et factures, rapport Excel, vérification de fichier |
| `docs/dictionnaire_donnees.md` | Contrat avec le backend et l'IA |
| `tests/` | 50 tests (unitaires + intégration PostgreSQL) |

## Tests

```powershell
pytest -q                                   # tests sans base
$env:TEST_DATABASE_URL = "postgresql://postgres@localhost:5432/postgres"
pytest -q                                   # + tests PostgreSQL (crée et supprime des bases jetables)
```

`TEST_DATABASE_URL` doit pointer vers un PostgreSQL **local** (jamais la base Supabase de l'équipe).

## Ajouter une colonne ou une table

1. Ouvrir une issue ou une pull request sur le dossier `db` et prévenir l'équipe.
2. Créer `sql/migrations/004_quelque_chose.sql` (ne jamais modifier 001 à 003).
3. `python scripts\migrate.py`, puis `pytest -q` et `python scripts\check.py`.

## Jour 1 en sandbox : à faire dans cet ordre

1. Carte virtuelle : KYC du titulaire, création, financement, gel (tout le module d'enveloppes en dépend).
2. `GET /api/payouts/supported-countries` → `config/corridors.json` (`verified: true`).
3. `GET /api/payouts/banks/{pays}` → vrais codes banque et opérateur.
4. `GET /api/payouts/limits` → vraies limites min/max.
5. Une vraie cotation → régler `FEES_INCLUDED_IN_AMOUNT` et noter la durée de `expires_at`.
6. Un vrai webhook → confirmer l'encodage de la signature.
7. Une facture Lightning → endpoint et événement de paiement.

## Pendant le hackathon

| Moment | Action |
| --- | --- |
| Kickoff | Valider le schéma et le contrat (`docs/dictionnaire_donnees.md`) avec la Personne 1 |
| Travail parallèle | Le frontend et l'IA travaillent sur les données de démo (`seed.py`) |
| Intégration | Le backend écrit via les fonctions SQL ; `check.py` après chaque test de bout en bout |
| Fin − 6 h | Gel du code de la base, `seed.py --reset`, `check.py`, vérifier chaque chiffre du pitch |
| Fin − 1 h | Donner les 3 chiffres forts du pitch (en précisant s'ils sont simulés) |
