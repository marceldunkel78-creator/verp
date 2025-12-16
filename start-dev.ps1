# VERP - Lokale Entwicklungsumgebung starten (Windows PowerShell)

Write-Host "🚀 VERP - Lokale Entwicklungsumgebung starten" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green

# Backend starten
Write-Host ""
Write-Host "📦 Backend wird gestartet..." -ForegroundColor Cyan
Set-Location backend

if (!(Test-Path "venv")) {
    Write-Host "Virtuelle Umgebung wird erstellt..." -ForegroundColor Yellow
    python -m venv venv
}

.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

Write-Host "Migrationen werden ausgeführt..." -ForegroundColor Yellow
python manage.py migrate

Write-Host "Backend-Server startet auf Port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; .\venv\Scripts\Activate.ps1; python manage.py runserver"

# Frontend starten
Set-Location ..\frontend
Write-Host ""
Write-Host "🎨 Frontend wird gestartet..." -ForegroundColor Cyan

if (!(Test-Path "node_modules")) {
    Write-Host "Node-Module werden installiert..." -ForegroundColor Yellow
    npm install
}

Write-Host "Frontend-Server startet auf Port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm start"

Write-Host ""
Write-Host "✅ VERP läuft jetzt!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "Admin:    http://localhost:8000/admin" -ForegroundColor White
Write-Host ""
Write-Host "Die Server laufen in separaten Fenstern." -ForegroundColor Yellow
Write-Host "Schließen Sie die Fenster zum Beenden." -ForegroundColor Yellow

Set-Location ..
