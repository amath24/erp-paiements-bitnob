"""handoff.py : etat REEL du projet (git + syntaxe + serveur). A lancer par toute IA avant de continuer."""
import datetime
import os
import subprocess
import urllib.request
from pathlib import Path


def run(args):
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=20)
    except Exception as e:  # git absent, etc.
        return "(erreur : " + str(e) + ")"
    if r.returncode != 0:
        lines = (r.stderr or "").strip().splitlines()
        return "(erreur : " + (lines[0] if lines else "inconnue") + ")"
    return (r.stdout or "").strip()


print("=== ETAT DU PROJET " + datetime.datetime.now().isoformat(timespec="seconds") + " ===")

print("\n--- Branche et 10 derniers commits")
print("branche : " + run(["git", "branch", "--show-current"]))
print(run(["git", "log", "-10", "--pretty=format:%h  %ad  %s", "--date=format:%d/%m %H:%M"]) or "(aucun commit)")

print("\n--- Modifications NON commitees (travail en cours, ou abandonne par une IA a court de tokens)")
print(run(["git", "status", "--short"]) or "(aucune)")
stat = run(["git", "diff", "--stat"])
if stat:
    print(stat)

print("\n--- Syntaxe Python")
skip = {".venv", "venv", ".git", "__pycache__", "node_modules"}
files = [p for p in Path(".").rglob("*.py") if not (set(p.parts) & skip)]
bad = 0
for f in files:
    try:
        compile(f.read_text(encoding="utf-8"), str(f), "exec")
    except SyntaxError as e:
        bad += 1
        print(f"ERREUR  {f} ligne {e.lineno} : {e.msg}")
print(f"{bad} fichier(s) en erreur sur {len(files)}" if bad else f"OK : {len(files)} fichier(s) valides")

print("\n--- Serveur local")
try:
    port = os.environ.get("PORT", "3000")
    with urllib.request.urlopen(f"http://localhost:{port}/health", timeout=1.5) as r:
        print(f"un serveur repond sur le port (HTTP {r.status}) : inutile d'en relancer un autre")
except Exception:
    print("aucun serveur ne repond sur le port")

print("\n--- Derniere entree de PROGRESS.md")
pf = Path("PROGRESS.md")
if pf.exists():
    lines = pf.read_text(encoding="utf-8").splitlines()
    starts = [i for i, l in enumerate(lines) if l.startswith("## ")]
    if not starts:
        print("(aucune entree pour le moment)")
    else:
        end = starts[1] if len(starts) > 1 else len(lines)
        print("\n".join(lines[starts[0]:end]).strip())
else:
    print("(PROGRESS.md absent)")
