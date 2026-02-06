# VERP Update Script für Windows Server
# Ausführen als Administrator: .\update-verp.ps1
# Mit -SkipBackup Parameter um Backup zu überspringen

param(
    [switch]$SkipBackup = $false,
    [string]$VerpRoot = "C:\VERP",
    [string]$BackupDir = "\\server\VSDB_Backups\VERP-Backup"
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

function Write-Failure {
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
    Write-Failure "Dieses Script muss als Administrator ausgeführt werden!"
    exit 1
}

# Prüfe ob VERP-Verzeichnis existiert
if (-not (Test-Path $VerpRoot)) {
    Write-Failure "VERP-Verzeichnis nicht gefunden: $VerpRoot"
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
                $pgDumpPaths = @(
                    "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
                    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
                    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
                    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
                    "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
                )
                $pgDump = $pgDumpPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
                if (-not $pgDump) {
                    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
                    if ($cmd) { $pgDump = $cmd.Source }
                }
                if ($pgDump) {
                    $dbHostValue = if ($dbHost) { $dbHost } else { "localhost" }
                    & $pgDump -U $dbUser -h $dbHostValue -Fc $dbName > "$BackupPath\verp_db.dump"
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
    
    # Git-Befehle brauchen ErrorActionPreference=Continue,
    # da Git Fortschrittsmeldungen auf stderr schreibt und
    # PowerShell 5.1 diese bei "Stop" als Exception wirft.
    $savedEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    
    # Lokale Änderungen sichern
    $hasChanges = (git status --porcelain) | Where-Object { $_.Trim() -ne '' }
    if ($hasChanges) {
        Write-Host "  ! Lokale Änderungen gefunden, erstelle Stash..." -ForegroundColor Yellow
        git stash push -m "Auto-stash vor Update $Timestamp" 2>&1 | Out-Null
    }
    
    git fetch --all 2>&1 | Out-Null
    $pullOut = git pull origin main 2>&1
    $gitExitCode = $LASTEXITCODE
    
    $ErrorActionPreference = $savedEAP
    
    if ($gitExitCode -eq 0) {
        Write-Success "Git Pull erfolgreich"
        $pullOut | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    } else {
        throw "Git Pull fehlgeschlagen: $pullOut"
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
    
    # Dependencies installieren (Continue nötig wegen pip stderr-Warnungen)
    $savedEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $pipOut = pip install -r requirements.txt --quiet --disable-pip-version-check 2>&1
    $pipExit = $LASTEXITCODE
    $ErrorActionPreference = $savedEAP
    if ($pipExit -ne 0) { throw "pip install fehlgeschlagen: $pipOut" }
    Write-Success "Python-Abhängigkeiten aktualisiert"
    
    # Migrationen ausführen
    $savedEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $migrateOut = python manage.py migrate --noinput 2>&1
    $migrateExit = $LASTEXITCODE
    $ErrorActionPreference = $savedEAP
    if ($migrateExit -ne 0) { throw "Migrationen fehlgeschlagen: $migrateOut" }
    Write-Success "Datenbank-Migrationen ausgeführt"
    
    # Static Files sammeln
    $savedEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    python manage.py collectstatic --noinput 2>&1 | Out-Null
    $ErrorActionPreference = $savedEAP
    Write-Success "Static Files gesammelt"

    # ============================================================
    # 5. FRONTEND AKTUALISIEREN
    # ============================================================
    Write-Step "5/7" "Aktualisiere Frontend..."
    
    Set-Location "$VerpRoot\frontend"
    
    # npm install
    $savedEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    npm install --silent 2>&1 | Out-Null
    $npmInstallExit = $LASTEXITCODE
    $ErrorActionPreference = $savedEAP
    if ($npmInstallExit -ne 0) { throw "npm install fehlgeschlagen" }
    Write-Success "NPM-Abhängigkeiten aktualisiert"
    
    # Build erstellen
    $savedEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    npm run build 2>&1 | Out-Null
    $npmBuildExit = $LASTEXITCODE
    $ErrorActionPreference = $savedEAP
    if ($npmBuildExit -ne 0) { throw "npm build fehlgeschlagen" }
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
            Write-Failure "Backend-Dienst konnte nicht gestartet werden!"
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
    Write-Failure $_.Exception.Message
    Write-Host ""
    Write-Host "Bitte prüfen Sie die Fehlermeldung und versuchen Sie es erneut." -ForegroundColor Yellow
    
    # Versuche Dienste wiederherzustellen
    if ($backendService -and $backendService.Status -eq "Stopped") {
        Write-Host "Versuche Backend-Dienst zu starten..." -ForegroundColor Yellow
        Start-Service VERP-Backend -ErrorAction SilentlyContinue
    }
    
    exit 1
}
