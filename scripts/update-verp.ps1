# VERP Update Script für Windows Server
# Ausführen als Administrator: .\update-verp.ps1
# Mit -SkipBackup Parameter um Backup zu überspringen

param(
    [switch]$SkipBackup = $false,
    [string]$VerpRoot = "C:\VERP",
    [string]$BackupDir = "C:\VERP-Backups"
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host "`n[$Step] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "  ✗ $Message" -ForegroundColor Red
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         VERP Update Script               ║" -ForegroundColor Cyan
Write-Host "║         $(Get-Date -Format 'yyyy-MM-dd HH:mm')                 ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan

# Prüfe ob als Administrator ausgeführt
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Dieses Script muss als Administrator ausgeführt werden!"
    exit 1
}

# Prüfe ob VERP-Verzeichnis existiert
if (-not (Test-Path $VerpRoot)) {
    Write-Error "VERP-Verzeichnis nicht gefunden: $VerpRoot"
    exit 1
}

try {
    # ============================================================
    # 1. BACKUP (optional)
    # ============================================================
    if (-not $SkipBackup) {
        Write-Step "1/7" "Erstelle Backup..."
        
        if (-not (Test-Path $BackupDir)) {
            New-Item -ItemType Directory -Path $BackupDir | Out-Null
        }
        
        $BackupPath = "$BackupDir\$Timestamp"
        New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
        
        # Datenbank-Backup
        $EnvFile = "$VerpRoot\backend\.env"
        if (Test-Path $EnvFile) {
            $envContent = Get-Content $EnvFile
            $dbPassword = ($envContent | Where-Object { $_ -match "^DB_PASSWORD=" }) -replace "DB_PASSWORD=", ""
            $dbUser = ($envContent | Where-Object { $_ -match "^DB_USER=" }) -replace "DB_USER=", ""
            $dbName = ($envContent | Where-Object { $_ -match "^DB_NAME=" }) -replace "DB_NAME=", ""
            $dbHost = ($envContent | Where-Object { $_ -match "^DB_HOST=" }) -replace "DB_HOST=", ""
            
            if ($dbPassword -and $dbUser -and $dbName) {
                $env:PGPASSWORD = $dbPassword
                $pgDump = "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
                if (Test-Path $pgDump) {
                    & $pgDump -U $dbUser -h ($dbHost ?? "localhost") -Fc $dbName > "$BackupPath\verp_db.dump"
                    Write-Success "Datenbank gesichert"
                } else {
                    Write-Host "  ! pg_dump nicht gefunden, überspringe DB-Backup" -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "`n[1/7] Backup übersprungen (--SkipBackup)" -ForegroundColor Gray
    }

    # ============================================================
    # 2. DIENSTE STOPPEN
    # ============================================================
    Write-Step "2/7" "Stoppe VERP-Dienste..."
    
    $backendService = Get-Service -Name "VERP-Backend" -ErrorAction SilentlyContinue
    if ($backendService) {
        Stop-Service VERP-Backend -Force
        Start-Sleep -Seconds 2
        Write-Success "Backend-Dienst gestoppt"
    } else {
        Write-Host "  ! Backend-Dienst nicht als Windows-Service installiert" -ForegroundColor Yellow
    }

    # ============================================================
    # 3. GIT PULL
    # ============================================================
    Write-Step "3/7" "Hole neueste Version von Git..."
    
    Set-Location $VerpRoot
    
    # Lokale Änderungen sichern
    $hasChanges = git status --porcelain
    if ($hasChanges) {
        Write-Host "  ! Lokale Änderungen gefunden, erstelle Stash..." -ForegroundColor Yellow
        git stash push -m "Auto-stash vor Update $Timestamp"
    }
    
    git fetch --all
    $result = git pull origin main 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Git Pull erfolgreich"
        Write-Host "  $result" -ForegroundColor Gray
    } else {
        throw "Git Pull fehlgeschlagen: $result"
    }

    # ============================================================
    # 4. BACKEND AKTUALISIEREN
    # ============================================================
    Write-Step "4/7" "Aktualisiere Backend..."
    
    Set-Location "$VerpRoot\backend"
    
    # Virtual Environment aktivieren
    $venvActivate = ".\venv\Scripts\Activate.ps1"
    if (Test-Path $venvActivate) {
        & $venvActivate
    } else {
        Write-Host "  ! venv nicht gefunden, erstelle neu..." -ForegroundColor Yellow
        python -m venv venv
        & $venvActivate
    }
    
    # Dependencies installieren
    pip install -r requirements.txt --quiet --disable-pip-version-check
    Write-Success "Python-Abhängigkeiten aktualisiert"
    
    # Migrationen ausführen
    python manage.py migrate --noinput
    Write-Success "Datenbank-Migrationen ausgeführt"
    
    # Static Files sammeln
    python manage.py collectstatic --noinput 2>&1 | Out-Null
    Write-Success "Static Files gesammelt"

    # ============================================================
    # 5. FRONTEND AKTUALISIEREN
    # ============================================================
    Write-Step "5/7" "Aktualisiere Frontend..."
    
    Set-Location "$VerpRoot\frontend"
    
    # npm install
    npm install --silent 2>&1 | Out-Null
    Write-Success "NPM-Abhängigkeiten aktualisiert"
    
    # Build erstellen
    npm run build 2>&1 | Out-Null
    Write-Success "Frontend Build erstellt"

    # ============================================================
    # 6. IIS KONFIGURATION
    # ============================================================
    Write-Step "6/7" "Stelle IIS-Konfiguration wieder her..."
    
    $webConfigTemplate = "$VerpRoot\scripts\web.config.template"
    $webConfigDest = "$VerpRoot\frontend\build\web.config"
    
    if (Test-Path $webConfigTemplate) {
        Copy-Item $webConfigTemplate $webConfigDest -Force
        Write-Success "web.config wiederhergestellt"
    } else {
        Write-Host "  ! web.config.template nicht gefunden" -ForegroundColor Yellow
        Write-Host "    Erstellen Sie $webConfigTemplate basierend auf der Dokumentation" -ForegroundColor Gray
    }

    # ============================================================
    # 7. DIENSTE STARTEN
    # ============================================================
    Write-Step "7/7" "Starte VERP-Dienste..."
    
    if ($backendService) {
        Start-Service VERP-Backend
        Start-Sleep -Seconds 3
        
        $service = Get-Service VERP-Backend
        if ($service.Status -eq "Running") {
            Write-Success "Backend-Dienst läuft"
        } else {
            Write-Error "Backend-Dienst konnte nicht gestartet werden!"
            Write-Host "    Prüfen Sie die Logs mit: nssm status VERP-Backend" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ! Starten Sie das Backend manuell:" -ForegroundColor Yellow
        Write-Host "    cd $VerpRoot\backend" -ForegroundColor Gray
        Write-Host "    .\venv\Scripts\Activate.ps1" -ForegroundColor Gray
        Write-Host "    python manage.py runserver 0.0.0.0:8000" -ForegroundColor Gray
    }

    # ============================================================
    # ABSCHLUSS
    # ============================================================
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║      Update erfolgreich abgeschlossen!   ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    
    # Alte Backups aufräumen (älter als 30 Tage)
    if (Test-Path $BackupDir) {
        $oldBackups = Get-ChildItem $BackupDir -Directory | Where-Object {
            $_.CreationTime -lt (Get-Date).AddDays(-30)
        }
        if ($oldBackups) {
            $oldBackups | Remove-Item -Recurse -Force
            Write-Host "Alte Backups (>30 Tage) wurden entfernt" -ForegroundColor Gray
        }
    }

} catch {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║           UPDATE FEHLGESCHLAGEN          ║" -ForegroundColor Red
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Error $_.Exception.Message
    Write-Host ""
    Write-Host "Bitte prüfen Sie die Fehlermeldung und versuchen Sie es erneut." -ForegroundColor Yellow
    
    # Versuche Dienste wiederherzustellen
    if ($backendService -and $backendService.Status -eq "Stopped") {
        Write-Host "Versuche Backend-Dienst zu starten..." -ForegroundColor Yellow
        Start-Service VERP-Backend -ErrorAction SilentlyContinue
    }
    
    exit 1
}
