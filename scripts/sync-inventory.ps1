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
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$LogDir = Join-Path $VerpRoot "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
$LogFile = Join-Path $LogDir "sync-inventory_$(Get-Date -Format 'yyyy-MM-dd').log"

function Write-Log {
    param([string]$Message)
    $entry = "$(Get-Date -Format 'HH:mm:ss') - $Message"
    Add-Content -Path $LogFile -Value $entry -Encoding UTF8
    if (-not $Quiet) { Write-Host $entry }
}

# Log auf 5 MB begrenzen
if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 5MB)) {
    Move-Item -Path $LogFile -Destination "$LogFile.old" -Force
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
        Get-Content $StdErrFile | ForEach-Object { Write-Log "FEHLER: $_" }
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
