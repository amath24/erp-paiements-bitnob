# Guide de contribution de l'equipe

Pour assurer un travail fluide en equipe et une demonstration reussie au hackathon :

1. **Branche principale `main` toujours demontrable :** Aucun code casse ne doit etre fusionne dans `main`. L'application sur `main` doit pouvoir etre lancee a tout moment pour le jury.
2. **Branches courtes par personne et sujet :** Creez une branche nommee `feat/<prenom>-<sujet>` pour chaque nouvelle fonctionnalite. Supprimez-la apres fusion.
3. **Synchronisation :** Faites systematiquement `git pull --rebase origin main` avant chaque push afin d'eviter les commits de merge inutiles et resoudre les conflits proprement.
4. **Commits petits et cibles :** Chaque commit doit etre atomique, avec un message clair expliquant le "pourquoi", SANS nom d'outil IA.
5. **Secrets et fichiers locaux :** Ne commitez **JAMAIS** `.env` ni `PROGRESS.md`. Verifiez toujours avec `git status` et `git diff` avant de commiter.
6. **Propriete des fichiers :** Consultez [CONTRACT.md](CONTRACT.md) pour connaitre le proprietaire attribue a chaque fichier. Ne modifiez pas le fichier d'un coequipier sans concertation prealable.
