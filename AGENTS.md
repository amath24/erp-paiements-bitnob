# Regles pour l'IA (a lire AVANT d'ecrire du code)

Projet : backend Python 3 + FastAPI (async, httpx) qui utilise l'API Bitnob v2 (paiements Bitcoin Lightning, sandbox).
Environnement de l'utilisateur : Windows + PowerShell. Reponds en francais.

1. Lis CONTRACT.md, config.py et constants.py avant toute modification.
2. N'utilise QUE les noms (variables d'environnement, routes, champs JSON, statuts, evenements) qui y figurent.
   N'en invente jamais : s'il en manque un, dis-le dans ta reponse et demande de l'ajouter au contrat.
3. N'ecris jamais os.environ ni os.getenv hors de config.py : importe `config`.
4. Ne modifie pas un fichier dont tu n'es pas le proprietaire (tableau dans CONTRACT.md) sans l'accord de l'utilisateur.
5. Modifications petites et ciblees. Ne reecris JAMAIS un fichier entier.
6. Aucun secret dans le code ni dans les logs. Ne renvoie et ne logge jamais `preimage`.
7. Apres chaque modification : `python -m py_compile <fichier>` (puis supprime le dossier __pycache__ s'il apparait).
8. Avant de toucher a Bitnob, aux factures, aux webhooks ou aux payouts : lis LECONS.md.
   Si une information n'y est pas, ne la devine pas : logge la reponse brute et demande.
9. Au debut de chaque session : lance `python handoff.py`, puis lis la derniere entree de PROGRESS.md et LECONS.md.
   Ne fais confiance qu'aux FAITS (git, py_compile, tests), jamais au resume d'une autre IA.
10. PROGRESS.md est un fichier LOCAL (ignore par git) : ne le commite jamais. Au debut de ta session, ajoute une
    entree EN HAUT (statut EN COURS) ; a la fin, mets-la a jour (TERMINE ou CASSE) avec les fichiers touches
    et la commande de verification.
11. Commits : message normal et clair, SANS nom d'outil. Ne commite que si ca marche, ou si l'utilisateur le demande.
12. Une seule IA a la fois sur les memes fichiers. Si tu vois des modifications non commitees que tu n'as pas
    faites, lis-les (git diff) avant de continuer ; ne les ecrase pas.
13. Avant de dire que c'est termine : py_compile et le test concerne.
14. Quand tu donnes des commandes a l'utilisateur : PowerShell Windows, completes, a copier-coller, avec
    `cd "C:\chemin\du\projet"` en premiere ligne ; utilise `.venv\Scripts\python.exe` (pas d'activation du venv).
15. FastAPI : pour le webhook Bitnob, lis TOUJOURS `await request.body()` (corps brut). Ne mets jamais de modele
    Pydantic sur cette route (le content-type de Bitnob est parfois double). Les routes API repondent { "error": ... }.
