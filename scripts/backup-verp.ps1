# VERP Backup Script für Windows Server
# Tägliches Backup von Datenbank und Media-Ordner
# Als geplante Aufgabe einrichten für automatische Ausführung

param(
    [string]$VerpRoot = "C:\VERP",
    [string]$BackupDir = "C:\VERP-Backups",
    [string]$MediaDir = "C:\VERP-Media",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyy-MM-dd"
$LogFile = "$BackupDir\backup_$Timestamp.log"

function Write-Log {
    param([string]$Message)
    $logEntry = "$(Get-Date -Format 'HH:mm:ss') - $Message"
    Write-Host $logEntry
    Add-Content -Path $LogFile -Value $logEntry
}

# Backup-Verzeichnis erstellen
$DayBackupDir = "$BackupDir\$Timestamp"
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}
if (-not (Test-Path $DayBackupDir)) {
    New-Item -ItemType Directory -Path $DayBackupDir -Force | Out-Null
}

Write-Log "========================================="
Write-Log "VERP Backup gestartet"
Write-Log "========================================="

try {
    # ============================================================
    # DATENBANK-BACKUP
    # ============================================================
    Write-Log "Starte Datenbank-Backup..."
    
    $EnvFile = "$VerpRoot\backend\.env"
    if (Test-Path $EnvFile) {
        $envContent = Get-Content $EnvFile
        $dbPassword = ($envContent | Where-Object { $_ -match "^DB_PASSWORD=" }) -replace "DB_PASSWORD=", ""
        $dbUser = ($envContent | Where-Object { $_ -match "^DB_USER=" }) -replace "DB_USER=", ""
        $dbName = ($envContent | Where-Object { $_ -match "^DB_NAME=" }) -replace "DB_NAME=", ""
        $dbHost = ($envContent | Where-Object { $_ -match "^DB_HOST=" }) -replace "DB_HOST=", ""
        if (-not $dbHost) { $dbHost = "localhost" }
        
        $env:PGPASSWORD = $dbPassword
        
        # pg_dump Pfad finden
        $pgDumpPaths = @(
            "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
        )
        $pgDump = $pgDumpPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
        
        if ($pgDump) {
            $dbBackupFile = "$DayBackupDir\verp_db.dump"
            & $pgDump -U $dbUser -h $dbHost -Fc $dbName > $dbBackupFile
            
            $dbSize = (Get-Item $dbBackupFile).Length / 1MB
            Write-Log "Datenbank gesichert: $dbBackupFile ($([math]::Round($dbSize, 2)) MB)"
        } else {
            Write-Log "WARNUNG: pg_dump nicht gefunden!"
        }
    } else {
        Write-Log "WARNUNG: .env Datei nicht gefunden!"
    }

    # ============================================================
    # MEDIA-ORDNER BACKUP
    # ============================================================
    Write-Log "Starte Media-Backup..."
    
    if (Test-Path $MediaDir) {
        $mediaBackupDir = "$DayBackupDir\Media"
        
        # robocopy mit Spiegelung (inkrementell)
        $robocopyResult = robocopy $MediaDir $mediaBackupDir /MIR /NFL /NDL /NJH /NJS /R:3 /W:5
        
        # Größe berechnen
        $mediaSize = (Get-ChildItem $mediaBackupDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Log "Media-Ordner gesichert: $mediaBackupDir ($([math]::Round($mediaSize, 2)) MB)"
    } else {
        Write-Log "WARNUNG: Media-Ordner nicht gefunden: $MediaDir"
    }

    # ============================================================
    # KONFIGURATION SICHERN
    # ============================================================
    Write-Log "Sichere Konfigurationsdateien..."
    
    $configBackupDir = "$DayBackupDir\Config"
    New-Item -ItemType Directory -Path $configBackupDir -Force | Out-Null
    
    # .env Datei (ohne Passwörter im Klartext loggen)
    if (Test-Path "$VerpRoot\backend\.env") {
        Copy-Item "$VerpRoot\backend\.env" "$configBackupDir\.env.backend"
    }
    
    # web.config falls vorhanden
    if (Test-Path "$VerpRoot\frontend\build\web.config") {
        Copy-Item "$VerpRoot\frontend\build\web.config" "$configBackupDir\web.config"
    }
    
    Write-Log "Konfiguration gesichert"

    # ============================================================
    # ALTE BACKUPS AUFRÄUMEN
    # ============================================================
    Write-Log "Räume alte Backups auf (älter als $RetentionDays Tage)..."
    
    $oldBackups = Get-ChildItem $BackupDir -Directory | Where-Object {
        $_.Name -match '^\d{4}-\d{2}-\d{2}$' -and
        $_.CreationTime -lt (Get-Date).AddDays(-$RetentionDays)
    }
    
    if ($oldBackups) {
        foreach ($old in $oldBackups) {
            Remove-Item $old.FullName -Recurse -Force
            Write-Log "Entfernt: $($old.Name)"
        }
    } else {
        Write-Log "Keine alten Backups zu entfernen"
    }

    # ============================================================
    # ZUSAMMENFASSUNG
    # ============================================================
    Write-Log "========================================="
    Write-Log "BACKUP ERFOLGREICH ABGESCHLOSSEN"
    
    # Gesamtgröße des heutigen Backups
    $totalSize = (Get-ChildItem $DayBackupDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Log "Backup-Größe: $([math]::Round($totalSize, 2)) MB"
    Write-Log "Speicherort: $DayBackupDir"
    Write-Log "========================================="

} catch {
    Write-Log "FEHLER: $($_.Exception.Message)"
    exit 1
}
