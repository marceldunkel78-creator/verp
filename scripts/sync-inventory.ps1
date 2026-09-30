# VERP Excel-Lagerabgleich (Warenlager-Sync)
#
# Liest die Excel-/CSV-Lagerlisten aus einem Verzeichnis (Standard: Netzwerkpfad
# aus INVENTORY_EXCEL_DIR in backend/.env) und legt NEUE Lagerartikel im VERP an.
# Bestehende Artikel werden nie veraendert.
#
# Manuell aufrufen:
#   cd C:\VERP\scripts
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
#   .\sync-inventory.ps1
#   .\sync-inventory.ps1 -DryRun
#   .\sync-inventory.ps1 -ExcelPath "\\fileserver\Lager\Warenlager"
#
# Als geplante Aufgabe (siehe register-inventory-sync-task.ps1):
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\VERP\scripts\sync-inventory.ps1

param(
    [string]$VerpRoot = "C:\VERP",
    [string]$ExcelPath = "",
    [string]$Pattern = "",
    [switch]$DryRun,
    [switch]$Quiet,
    [int]$LogRetentionDays = 30,
    [int]$ReportRetentionDays = 180,
    [switch]$KeepLogs
)

$ErrorActionPreference = "Stop"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$LogDir = Join-Path $VerpRoot "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
$LogFile = Join-Path $LogDir "sync-inventory_$(Get-Date -Format 'yyyy-MM-dd').log"

# ---------------------------------------------------------------------------
# Log-Aufraeumen
#
# Es entstehen drei Dateiarten, die alle unbegrenzt wuerden:
#   sync-inventory_JJJJ-MM-TT.log(.old)  eine Datei pro Tag
#   inventory_sync_JJJJMMTT_HHMMSS.csv    eine Datei pro Lauf (Report)
#   sync-inventory_out_JJJJMMTT_HHMMSS.log(.err)  stdout/stderr-Zwischenkopien
#
# Aufraeumen passiert bewusst VOR dem Anlegen der heutigen Logdatei und
# benutzt ausschliesslich den Dateisystem-Zeitstempel, nicht das Datum im
# Dateinamen. Sonst wuerde ein nachtraeglich umbenanntes oder kopiertes
# Log (mtime = heute) ewig aufbewahrt.
# ---------------------------------------------------------------------------
if (-not $KeepLogs -and -not $DryRun) {
    $Cleanup = @(
        @{ Pattern = "sync-inventory_*.log*";     Days = $LogRetentionDays;     ExcludeOut = $true }
        @{ Pattern = "inventory_sync_*.csv";      Days = $ReportRetentionDays;  ExcludeOut = $false }
        @{ Pattern = "sync-inventory_out_*.log*"; Days = $LogRetentionDays;     ExcludeOut = $false }
    )
    $Removed = 0
    foreach ($Rule in $Cleanup) {
        Get-ChildItem -Path $LogDir -Filter $Rule.Pattern -File -ErrorAction SilentlyContinue |
            Where-Object {
                # "sync-inventory_*.log*" trifft auch die "_out_"-Dateien.
                # Ohne diesen Ausschluss wuerde jede davon zweimal angefasst.
                # Der Ausschluss gilt nur fuer diese Regel - fuer die
                # "_out_"-Regel muss er ausdruecklich abgeschaltet sein,
                # sonst wuerden die Zwischenkopien NIE geloescht.
                (-not $Rule.ExcludeOut -or $_.Name -notlike "*_out_*") -and
                ($_.LastWriteTime -lt (Get-Date).AddDays(-1 * $Rule.Days))
            } |
            ForEach-Object {
                try {
                    Remove-Item $_.FullName -Force -ErrorAction Stop
                    $Removed++
                }
                catch {
                    # Kein Abbruch: eine gesperrte Logdatei darf den Import
                    # niemals verhindern. Wird beim naechsten Lauf versucht.
                    if (-not $Quiet) {
                        Write-Host "Hinweis: Logdatei nicht loeschbar ($($_.Exception.Message))"
                    }
                }
            }
    }
    if ($Removed -gt 0 -and -not $Quiet) {
        Write-Host "Log-Aufraeumen: $Removed Datei(en) entfernt."
    }
}

function Write-Log {
    param([string]$Message)
    $entry = "$(Get-Date -Format 'HH:mm:ss') - $Message"
    Add-Content -Path $LogFile -Value $entry -Encoding UTF8
    if (-not $Quiet) { Write-Host $entry }
}

# Log auf 5 MB begrenzen. Der alte Dateiname wird NICHT einfach ueberschrieben,
# sonst geht bei mehreren Rotationen am selben Tag der vorherige Stand verloren.
if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 5MB)) {
    $Stamp = Get-Date -Format 'HHmmss'
    Move-Item -Path $LogFile -Destination "$LogFile.$Stamp.old" -Force
}

Write-Log "========================================="
Write-Log "Excel-Lagerabgleich gestartet ($(if ($DryRun) { 'DRY-RUN' } else { 'LIVE' }))"
Write-Log "========================================="

$BackendDir = Join-Path $VerpRoot "backend"
$PythonExe  = Join-Path $VerpRoot "venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = Join-Path $VerpRoot ".venv\Scripts\python.exe"
}
if (-not (Test-Path $PythonExe)) {
    Write-Log "FEHLER: Python-Interpreter nicht gefunden ($PythonExe)"
    exit 1
}

# Parameterliste fuer den Management-Command zusammenbauen.
$ReportFile = Join-Path $LogDir "inventory_sync_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv"
$StdOutFile = Join-Path $LogDir "sync-inventory_out_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
$StdErrFile = "$StdOutFile.err"
$SyncParams = @('manage.py', 'sync_inventory_from_excel', '--report', $ReportFile)
if ($ExcelPath) { $SyncParams += @('--path', $ExcelPath) }
if ($Pattern)   { $SyncParams += @('--pattern', $Pattern) }
if ($DryRun)    { $SyncParams += '--dry-run' }

Push-Location $BackendDir
try {
    # Start-Process statt Splatting: liefert einen sauberen Exit-Code und
    # funktioniert zuverlaessig, wenn die Aufgabe ueber den Task-Planer laeuft.
    $Process = Start-Process -FilePath $PythonExe `
        -ArgumentList $SyncParams `
        -WorkingDirectory $BackendDir `
        -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $StdOutFile `
        -RedirectStandardError $StdErrFile
    $ExitCode = $Process.ExitCode

    if (Test-Path $StdOutFile) {
        Get-Content $StdOutFile | ForEach-Object { Write-Log "$_" }
    }
    if ((Test-Path $StdErrFile) -and (Get-Item $StdErrFile).Length -gt 0) {
        # Der console-Handler aus backend/verp/settings.py schreibt Log-Zeilen (INFO/WARNING)
        # nach stderr. Diese sind keine Fehler und duerfen nicht als "FEHLER:" markiert werden,
        # sonst sieht jeder erfolgreiche Lauf im Log wie ein Fehlschlag aus.
        Get-Content $StdErrFile | ForEach-Object {
            $line = $_
            if ($line -match ' ERROR | CRITICAL |Traceback \(most recent call last\)|^\s*\w+Error:|CommandError') {
                Write-Log "FEHLER: $line"
            } else {
                Write-Log $line
            }
        }
    }
}
finally {
    Pop-Location
}

if ($ExitCode -ne 0) {
    Write-Log "FEHLER: Abgleich fehlgeschlagen (Exit-Code $ExitCode)"
    exit $ExitCode
}

Write-Log "Abgleich erfolgreich abgeschlossen. Details siehe Log und Report in $LogDir"
exit 0
