# start-dev.ps1 : Lancement unifie du Backend et de l'Interface ERP
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Demarrage de l'ERP de Paiements Bitnob & IA (Sandbox)"   -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot
Set-Location $root

# Verification de l'environnement virtuel Python
if (-not (Test-Path "$root\.venv\Scripts\python.exe")) {
    Write-Host "[ERREUR] L'environnement .venv n'a pas ete trouve !" -ForegroundColor Red
    Write-Host "Veuillez executer : py -m venv .venv et installer requirements.txt"
    exit 1
}

# Verification du fichier .env
if (-not (Test-Path "$root\.env")) {
    Write-Host "[ATTENTION] Aucun fichier .env trouve. Copie depuis .env.example..." -ForegroundColor Yellow
    Copy-Item "$root\.env.example" "$root\.env"
}

# Initialisation de la base de donnees avec donnees de demo si absente
$dbPath = "$root\erp.db"
if (-not (Test-Path $dbPath)) {
    Write-Host "[DB] Initialisation de la base de donnees et injection des donnees de test..." -ForegroundColor Green
    & "$root\.venv\Scripts\python.exe" -m db.seed
}

Write-Host "`n[OK] Lancement du serveur FastAPI sur http://localhost:3000..." -ForegroundColor Green
Write-Host "Interface Web : http://localhost:3000" -ForegroundColor Yellow
Write-Host "Documentation : http://localhost:3000/docs" -ForegroundColor Yellow
Write-Host "Appuyez sur Ctrl+C pour arreter le serveur.`n" -ForegroundColor Gray

& "$root\.venv\Scripts\python.exe" -m uvicorn backend.app.main:app --reload --port 3000
