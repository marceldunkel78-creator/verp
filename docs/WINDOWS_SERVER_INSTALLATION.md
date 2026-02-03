# VERP System - Windows Server Installation & Update Guide

Diese Anleitung beschreibt die Installation des VERP-Systems auf einem Windows Server sowie den Update-Prozess.

---

## Inhaltsverzeichnis

1. [Systemvoraussetzungen](#1-systemvoraussetzungen)
2. [Software-Installation](#2-software-installation)
3. [PostgreSQL Datenbank einrichten](#3-postgresql-datenbank-einrichten)
4. [VERP Backend Installation](#4-verp-backend-installation)
5. [VERP Frontend Installation](#5-verp-frontend-installation)
6. [Produktionsumgebung konfigurieren](#6-produktionsumgebung-konfigurieren)
7. [Windows-Dienste einrichten](#7-windows-dienste-einrichten)
8. [Reverse Proxy mit IIS](#8-reverse-proxy-mit-iis)
9. [SSL/HTTPS Konfiguration](#9-sslhttps-konfiguration)
10. [Updates einspielen](#10-updates-einspielen)
11. [Backup-Strategie](#11-backup-strategie)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Systemvoraussetzungen

### Hardware (Minimum)
- **CPU:** 2 Kerne
- **RAM:** 4 GB (empfohlen: 8 GB)
- **Speicher:** 50 GB SSD (+ Platz für Medien/Dokumente)

### Software
- **Betriebssystem:** Windows Server 2019/2022
- **Python:** 3.11 oder höher
- **Node.js:** 18 LTS oder höher
- **PostgreSQL:** 15 oder höher
- **Git:** Aktuellste Version

---

## 2. Software-Installation

### 2.1 Python installieren

1. Download von https://www.python.org/downloads/
2. Bei Installation **"Add Python to PATH"** aktivieren
3. Installation prüfen:
   ```powershell
   python --version
   pip --version
   ```

### 2.2 Node.js installieren

1. Download von https://nodejs.org/ (LTS Version)
2. Standard-Installation durchführen
3. Installation prüfen:
   ```powershell
   node --version
   npm --version
   ```

### 2.3 Git installieren

1. Download von https://git-scm.com/download/win
2. Standard-Installation (empfohlene Optionen beibehalten)
3. Installation prüfen:
   ```powershell
   git --version
   ```

### 2.4 PostgreSQL installieren

1. Download von https://www.postgresql.org/download/windows/
2. Installation mit folgenden Optionen:
   - PostgreSQL Server
   - pgAdmin 4 (für Verwaltung)
   - Command Line Tools
3. **Passwort für postgres-Benutzer merken!**

---

## 3. PostgreSQL Datenbank einrichten

### 3.1 Datenbank und Benutzer erstellen

PowerShell als Administrator öffnen:

```powershell
# PostgreSQL-Pfad zur PATH-Variable hinzufügen (falls nötig)
$env:PATH += ";C:\Program Files\PostgreSQL\15\bin"

# Mit PostgreSQL verbinden
psql -U postgres
```

In der PostgreSQL-Konsole:

```sql
-- Benutzer erstellen
CREATE USER verp_user WITH PASSWORD 'IhrSicheresPasswort123!';

-- Datenbank erstellen
CREATE DATABASE verp_db OWNER verp_user;

-- Rechte vergeben
GRANT ALL PRIVILEGES ON DATABASE verp_db TO verp_user;

-- Verbindung beenden
\q
```

### 3.2 PostgreSQL für Netzwerkzugriff konfigurieren (optional)

Falls der Datenbankserver separat läuft, editieren Sie:
- `C:\Program Files\PostgreSQL\15\data\postgresql.conf`
  ```
  listen_addresses = '*'
  ```
- `C:\Program Files\PostgreSQL\15\data\pg_hba.conf`
  ```
  host    verp_db    verp_user    192.168.1.0/24    scram-sha-256
  ```

PostgreSQL-Dienst neu starten:
```powershell
Restart-Service postgresql-x64-15
```

---

## 4. VERP Backend Installation

### 4.1 Repository klonen

```powershell
# Installationsverzeichnis erstellen
mkdir C:\VERP
cd C:\VERP

# Repository klonen
git clone https://github.com/marceldunkel78-creator/verp.git .
```

### 4.2 Python Virtual Environment erstellen

```powershell
cd C:\VERP\backend

# Virtual Environment erstellen
python -m venv venv

# Aktivieren
.\venv\Scripts\Activate.ps1

# Abhängigkeiten installieren
pip install -r requirements.txt

# Zusätzlich für Produktion
pip install gunicorn waitress
```

### 4.3 Umgebungsvariablen konfigurieren

Datei `C:\VERP\backend\.env` erstellen:

```ini
# Django Settings
SECRET_KEY=ihr-sehr-sicherer-zufälliger-key-hier-mindestens-50-zeichen
DJANGO_DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,ihr-server-name.domain.local

# Database
DB_NAME=verp_db
DB_USER=verp_user
DB_PASSWORD=IhrSicheresPasswort123!
DB_HOST=localhost
DB_PORT=5432

# Media Storage - Absoluter Pfad zum Medienordner
MEDIA_ROOT=C:/VERP-Media

# CSRF Settings für Produktion
CSRF_TRUSTED_ORIGINS=https://ihr-server-name.domain.local
```

**Secret Key generieren:**
```powershell
cd C:\VERP\backend
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 4.4 Medienordner erstellen

```powershell
mkdir C:\VERP-Media
```

### 4.5 Datenbank migrieren

```powershell
cd C:\VERP\backend
.\venv\Scripts\Activate.ps1

python manage.py migrate
python manage.py collectstatic --noinput
```

### 4.6 Superuser erstellen

```powershell
python manage.py createsuperuser
```

---

## 5. VERP Frontend Installation

### 5.1 Abhängigkeiten installieren

```powershell
cd C:\VERP\frontend
npm install
```

### 5.2 Produktion Build erstellen

```powershell
npm run build
```

Das erzeugt den Ordner `C:\VERP\frontend\build` mit den statischen Dateien.

### 5.3 API-URL konfigurieren (falls nötig)

Für Produktion: Erstellen Sie `C:\VERP\frontend\.env.production`:

```ini
REACT_APP_API_URL=https://ihr-server-name.domain.local/api
```

Dann erneut builden:
```powershell
npm run build
```

---

## 6. Produktionsumgebung konfigurieren

### 6.1 Django Settings für Produktion

Die wichtigsten Einstellungen in `.env`:

```ini
DJANGO_DEBUG=False
ALLOWED_HOSTS=ihr-server-name.domain.local,192.168.1.100
CSRF_TRUSTED_ORIGINS=https://ihr-server-name.domain.local
```

### 6.2 Static Files sammeln

```powershell
cd C:\VERP\backend
.\venv\Scripts\Activate.ps1
python manage.py collectstatic --noinput
```

---

## 7. Windows-Dienste einrichten

### 7.1 NSSM installieren (Non-Sucking Service Manager)

1. Download von https://nssm.cc/download
2. Entpacken nach `C:\Tools\nssm`
3. Zum PATH hinzufügen oder direkt verwenden

### 7.2 Backend-Dienst erstellen

PowerShell als Administrator:

```powershell
# NSSM verwenden um Dienst zu erstellen
C:\Tools\nssm\win64\nssm.exe install VERP-Backend

# Im GUI folgende Einstellungen vornehmen:
# Path: C:\VERP\backend\venv\Scripts\python.exe
# Startup directory: C:\VERP\backend
# Arguments: -m waitress --host=127.0.0.1 --port=8000 core.wsgi:application

# Oder per Kommandozeile:
C:\Tools\nssm\win64\nssm.exe set VERP-Backend Application "C:\VERP\backend\venv\Scripts\python.exe"
C:\Tools\nssm\win64\nssm.exe set VERP-Backend AppDirectory "C:\VERP\backend"
C:\Tools\nssm\win64\nssm.exe set VERP-Backend AppParameters "-m waitress --host=127.0.0.1 --port=8000 core.wsgi:application"
C:\Tools\nssm\win64\nssm.exe set VERP-Backend DisplayName "VERP Backend Service"
C:\Tools\nssm\win64\nssm.exe set VERP-Backend Description "VERP ERP System - Django Backend"
C:\Tools\nssm\win64\nssm.exe set VERP-Backend Start SERVICE_AUTO_START

# Dienst starten
C:\Tools\nssm\win64\nssm.exe start VERP-Backend
```

### 7.3 Dienst-Status prüfen

```powershell
Get-Service VERP-Backend
```

---

## 8. Reverse Proxy mit IIS

### 8.1 IIS Features installieren

PowerShell als Administrator:

```powershell
# IIS installieren
Install-WindowsFeature -Name Web-Server -IncludeManagementTools

# URL Rewrite Module herunterladen und installieren
# https://www.iis.net/downloads/microsoft/url-rewrite

# Application Request Routing (ARR) installieren
# https://www.iis.net/downloads/microsoft/application-request-routing
```

### 8.2 IIS Site konfigurieren

1. **IIS Manager** öffnen
2. **Sites** → **Add Website**:
   - Site name: `VERP`
   - Physical path: `C:\VERP\frontend\build`
   - Binding: Port 80 (oder 443 für HTTPS)

3. **URL Rewrite Rules** für API-Proxy:

Erstellen Sie `C:\VERP\frontend\build\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <!-- API Requests an Backend weiterleiten -->
                <rule name="API Proxy" stopProcessing="true">
                    <match url="^api/(.*)" />
                    <action type="Rewrite" url="http://127.0.0.1:8000/api/{R:1}" />
                </rule>
                
                <!-- Media Files an Backend weiterleiten -->
                <rule name="Media Proxy" stopProcessing="true">
                    <match url="^media/(.*)" />
                    <action type="Rewrite" url="http://127.0.0.1:8000/media/{R:1}" />
                </rule>
                
                <!-- Admin Interface an Backend weiterleiten -->
                <rule name="Admin Proxy" stopProcessing="true">
                    <match url="^admin/(.*)" />
                    <action type="Rewrite" url="http://127.0.0.1:8000/admin/{R:1}" />
                </rule>
                
                <!-- React Router - alle anderen Anfragen an index.html -->
                <rule name="React Routes" stopProcessing="true">
                    <match url=".*" />
                    <conditions logicalGrouping="MatchAll">
                        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                        <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                    </conditions>
                    <action type="Rewrite" url="/" />
                </rule>
            </rules>
        </rewrite>
        
        <!-- Statische Dateien Caching -->
        <staticContent>
            <mimeMap fileExtension=".json" mimeType="application/json" />
        </staticContent>
    </system.webServer>
</configuration>
```

### 8.3 ARR Proxy aktivieren

1. IIS Manager → Server-Ebene → **Application Request Routing Cache**
2. **Server Proxy Settings** → **Enable proxy** aktivieren

---

## 9. SSL/HTTPS Konfiguration

### 9.1 Selbstsigniertes Zertifikat (Intranet)

PowerShell als Administrator:

```powershell
# Zertifikat erstellen
$cert = New-SelfSignedCertificate -DnsName "ihr-server-name.domain.local" `
    -CertStoreLocation "cert:\LocalMachine\My" `
    -NotAfter (Get-Date).AddYears(5)

# Zertifikat in IIS binden
# IIS Manager → Sites → VERP → Bindings → Add → https → Zertifikat auswählen
```

### 9.2 Let's Encrypt Zertifikat (öffentlich erreichbar)

Mit win-acme (https://www.win-acme.com/):

```powershell
# win-acme herunterladen und entpacken
# Ausführen:
.\wacs.exe
```

---

## 10. Updates einspielen

### 10.1 Automatisches Update-Script

Erstellen Sie `C:\VERP\scripts\update-verp.ps1`:

```powershell
# VERP Update Script
# Ausführen als Administrator

param(
    [switch]$SkipBackup = $false
)

$ErrorActionPreference = "Stop"
$VerpRoot = "C:\VERP"
$BackupDir = "C:\VERP-Backups"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERP Update Script" -ForegroundColor Cyan
Write-Host "  $(Get-Date)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Backup erstellen (optional)
if (-not $SkipBackup) {
    Write-Host "`n[1/7] Erstelle Backup..." -ForegroundColor Yellow
    
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir | Out-Null
    }
    
    # Datenbank-Backup
    $DbBackup = "$BackupDir\verp_db_$Timestamp.sql"
    $env:PGPASSWORD = "IhrDatenbankPasswort"
    & "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" -U verp_user -h localhost verp_db > $DbBackup
    Write-Host "  Datenbank gesichert: $DbBackup" -ForegroundColor Green
    
    # Media-Backup (nur wenn geändert)
    # robocopy C:\VERP-Media "$BackupDir\Media_$Timestamp" /MIR /NFL /NDL
}

# 2. Dienste stoppen
Write-Host "`n[2/7] Stoppe VERP-Dienste..." -ForegroundColor Yellow
Stop-Service VERP-Backend -ErrorAction SilentlyContinue
Write-Host "  Backend gestoppt" -ForegroundColor Green

# 3. Git Pull
Write-Host "`n[3/7] Hole neueste Version von Git..." -ForegroundColor Yellow
Set-Location $VerpRoot
git fetch --all
git reset --hard origin/main
Write-Host "  Git Pull erfolgreich" -ForegroundColor Green

# 4. Backend aktualisieren
Write-Host "`n[4/7] Aktualisiere Backend..." -ForegroundColor Yellow
Set-Location "$VerpRoot\backend"
& ".\venv\Scripts\Activate.ps1"
pip install -r requirements.txt --quiet
python manage.py migrate --noinput
python manage.py collectstatic --noinput
Write-Host "  Backend aktualisiert" -ForegroundColor Green

# 5. Frontend aktualisieren
Write-Host "`n[5/7] Aktualisiere Frontend..." -ForegroundColor Yellow
Set-Location "$VerpRoot\frontend"
npm install --silent
npm run build
Write-Host "  Frontend aktualisiert" -ForegroundColor Green

# 6. web.config wiederherstellen (wird durch Build überschrieben)
Write-Host "`n[6/7] Stelle IIS-Konfiguration wieder her..." -ForegroundColor Yellow
$WebConfigSource = "$VerpRoot\scripts\web.config.template"
$WebConfigDest = "$VerpRoot\frontend\build\web.config"
if (Test-Path $WebConfigSource) {
    Copy-Item $WebConfigSource $WebConfigDest -Force
    Write-Host "  web.config wiederhergestellt" -ForegroundColor Green
}

# 7. Dienste starten
Write-Host "`n[7/7] Starte VERP-Dienste..." -ForegroundColor Yellow
Start-Service VERP-Backend
Start-Sleep -Seconds 3

# Status prüfen
$service = Get-Service VERP-Backend
if ($service.Status -eq "Running") {
    Write-Host "  Backend läuft" -ForegroundColor Green
} else {
    Write-Host "  WARNUNG: Backend nicht gestartet!" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Update abgeschlossen!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

# Alte Backups aufräumen (älter als 30 Tage)
Get-ChildItem $BackupDir -Recurse | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-30)
} | Remove-Item -Force -Recurse
```

### 10.2 Update durchführen

```powershell
# Als Administrator ausführen
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
C:\VERP\scripts\update-verp.ps1
```

### 10.3 Manuelles Update (Schritt für Schritt)

Falls das Script nicht verwendet werden soll:

```powershell
# 1. Dienst stoppen
Stop-Service VERP-Backend

# 2. Git Pull
cd C:\VERP
git pull origin main

# 3. Backend aktualisieren
cd C:\VERP\backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# 4. Frontend aktualisieren
cd C:\VERP\frontend
npm install
npm run build

# 5. Dienst starten
Start-Service VERP-Backend
```

---

## 11. Backup-Strategie

### 11.1 Tägliches Backup-Script

Erstellen Sie `C:\VERP\scripts\backup-verp.ps1`:

```powershell
# VERP Backup Script
$BackupDir = "C:\VERP-Backups"
$Timestamp = Get-Date -Format "yyyy-MM-dd"
$RetentionDays = 30

# Verzeichnis erstellen
New-Item -ItemType Directory -Path "$BackupDir\$Timestamp" -Force | Out-Null

# Datenbank-Backup
$env:PGPASSWORD = "IhrDatenbankPasswort"
& "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" `
    -U verp_user -h localhost -Fc verp_db `
    > "$BackupDir\$Timestamp\verp_db.dump"

# Media-Ordner sichern (inkrementell)
robocopy C:\VERP-Media "$BackupDir\$Timestamp\Media" /MIR /NFL /NDL /NJH /NJS

# Alte Backups löschen
Get-ChildItem $BackupDir -Directory | Where-Object {
    $_.CreationTime -lt (Get-Date).AddDays(-$RetentionDays)
} | Remove-Item -Recurse -Force

Write-Host "Backup abgeschlossen: $BackupDir\$Timestamp"
```

### 11.2 Backup als geplante Aufgabe

```powershell
# Task Scheduler Eintrag erstellen
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\VERP\scripts\backup-verp.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount

Register-ScheduledTask -TaskName "VERP-Backup" `
    -Action $Action -Trigger $Trigger -Principal $Principal
```

### 11.3 Backup wiederherstellen

```powershell
# Datenbank wiederherstellen
$env:PGPASSWORD = "IhrDatenbankPasswort"
& "C:\Program Files\PostgreSQL\15\bin\pg_restore.exe" `
    -U verp_user -h localhost -d verp_db -c `
    "C:\VERP-Backups\2026-02-01\verp_db.dump"

# Media-Ordner wiederherstellen
robocopy "C:\VERP-Backups\2026-02-01\Media" C:\VERP-Media /MIR
```

---

## 12. Troubleshooting

### 12.1 Backend startet nicht

```powershell
# Logs prüfen
C:\Tools\nssm\win64\nssm.exe status VERP-Backend

# Manuell testen
cd C:\VERP\backend
.\venv\Scripts\Activate.ps1
python -m waitress --host=127.0.0.1 --port=8000 core.wsgi:application
```

### 12.2 Datenbankverbindung fehlgeschlagen

```powershell
# PostgreSQL-Dienst prüfen
Get-Service postgresql*

# Verbindung testen
psql -U verp_user -h localhost -d verp_db
```

### 12.3 Frontend zeigt leere Seite

1. Browser-Konsole auf Fehler prüfen (F12)
2. Prüfen ob API erreichbar: `http://localhost:8000/api/`
3. IIS URL Rewrite Regeln prüfen

### 12.4 Berechtigungsprobleme

```powershell
# IIS-Benutzer Rechte auf Media-Ordner geben
icacls "C:\VERP-Media" /grant "IIS_IUSRS:(OI)(CI)M"
icacls "C:\VERP\frontend\build" /grant "IIS_IUSRS:(OI)(CI)R"
```

### 12.5 Port bereits belegt

```powershell
# Prozess finden der Port 8000 nutzt
netstat -ano | findstr :8000
# PID notieren und Prozess beenden
taskkill /PID <PID> /F
```

---

## Schnellreferenz

| Aktion | Befehl |
|--------|--------|
| Backend starten | `Start-Service VERP-Backend` |
| Backend stoppen | `Stop-Service VERP-Backend` |
| Backend Status | `Get-Service VERP-Backend` |
| Backend Logs | `nssm.exe status VERP-Backend` |
| Update ausführen | `C:\VERP\scripts\update-verp.ps1` |
| Backup ausführen | `C:\VERP\scripts\backup-verp.ps1` |
| Migrationen | `python manage.py migrate` |
| Superuser erstellen | `python manage.py createsuperuser` |

---

## Support & Kontakt

Bei Problemen:
1. Logs unter `C:\VERP\backend\logs\` prüfen
2. Windows Event Viewer für Dienst-Fehler
3. IIS Logs unter `C:\inetpub\logs\LogFiles\`

---

*Letzte Aktualisierung: Februar 2026*
