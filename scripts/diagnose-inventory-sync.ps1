# Diagnose fuer den Excel-Lagerabgleich (sync-inventory.ps1)
#
# Prueft die beiden offenen Symptome in einem Durchgang:
#   A) Der geplante Task bleibt im Status "Running", obwohl das
#      PowerShell-Fenster schon geschlossen ist.
#   B) Die Report-Datei (.csv) wird nicht gefunden.
#
# AUF DEM PRODUKTIONSSERVER ausfuehren (Administratorrechte noetig):
#   cd C:\VERP\scripts
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
#   .\diagnose-inventory-sync.ps1
#
# Es aendert NICHTS. Es liest nur und gibt einen Befund aus.

param(
    [string]$VerpRoot = "C:\VERP",
    [string]$TaskName = "VERP-Inventory-Sync"
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Section { param([string]$T) Write-Host ""; Write-Host "=== $T ===" -ForegroundColor Cyan }
function Write-Ok      { param($T) Write-Host "  OK   $T" -ForegroundColor Green }
function Write-Bad     { param($T) Write-Host "  FEHL $T" -ForegroundColor Red }
function Write-Info    { param($T) Write-Host "  --   $T" -ForegroundColor Gray }

Write-Section "A) Geplante Aufgabe"
$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $Task) {
    Write-Bad "Task '$TaskName' existiert nicht."
} else {
    Write-Info "State              : $($Task.State)"
    Write-Info "Author              : $($Task.Author)"

    $Info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($Info) {
        Write-Info "LastRunTime         : $($Info.LastRunTime)"
        Write-Info "LastTaskResult      : $($Info.LastTaskResult)"
        Write-Info "NextRunTime         : $($Info.NextRunTime)"
        Write-Info "NumberOfMissedRuns  : $($Info.NumberOfMissedRuns)"
        if ($Info.LastRunTime -gt (Get-Date).AddMinutes(-5)) {
            Write-Info "-> der letzte Lauf ist juenger als 5 Minuten"
        }
    }

    # DER ENTSCHEIDENDE PUNKT: laeuft gerade ueberhaupt noch ein Kindprozess?
    $Running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and (
                $_.CommandLine -like "*sync-inventory*" -or
                $_.CommandLine -like "*sync_inventory_from_excel*"
            )
        }
    if ($Running) {
        Write-Bad "$($Running.Count) Prozess(e) passen zu sync-inventory und laufen NOCH:"
        foreach ($p in $Running) {
            Write-Host ("       PID {0,-7} {1}" -f $p.ProcessId, $p.Name)
            Write-Host ("             Kommando: {0}" -f $p.CommandLine)
        }
    } else {
        Write-Ok "Kein sync-inventory-Prozess laeuft (der Task haengt ohne Kindprozess)."
    }
}

Write-Section "B) Python-Interpreter"
$Candidates = @(
    (Join-Path $VerpRoot "backend\venv\Scripts\python.exe"),
    (Join-Path $VerpRoot "backend\.venv\Scripts\python.exe"),
    (Join-Path $VerpRoot "venv\Scripts\python.exe"),
    (Join-Path $VerpRoot ".venv\Scripts\python.exe")
)
$Found = $Candidates | Where-Object { Test-Path $_ }
if ($Found) {
    foreach ($f in $Found) { Write-Ok $f }
} else {
    Write-Bad "Kein venv gefunden. Gesucht:"
    foreach ($c in $Candidates) { Write-Host "         $c" }
}

Write-Section "C) Verzeichnisse und Schreibrecht"
foreach ($d in @("$VerpRoot\logs", "$VerpRoot\backend\logs")) {
    if (Test-Path $d) {
        Write-Ok "existiert: $d"
    } else {
        Write-Bad "FEHLT: $d"
        continue
    }
    # Kann der Task-Account ueberhaupt schreiben?
    $probe = Join-Path $d "_diag_write_test.tmp"
    try {
        Set-Content -Path $probe -Value "test" -Encoding UTF8 -ErrorAction Stop
        Remove-Item $probe -Force -ErrorAction SilentlyContinue
        Write-Ok "schreibbar: $d"
    } catch {
        Write-Bad "NICHT SCHREIBBAR: $d -> $($_.Exception.Message)"
    }
}

Write-Section "D) Report-Dateien (wo landen die CSV wirklich?)"
foreach ($d in @("$VerpRoot\logs", "$VerpRoot\backend\logs")) {
    if (-not (Test-Path $d)) { continue }
    $Csv = @(Get-ChildItem $d -Filter "inventory_sync_*.csv" -File -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending)
    if ($Csv.Count -gt 0) {
        Write-Ok "$($Csv.Count) Report(s) in $d"
        foreach ($c in ($Csv | Select-Object -First 3)) {
            Write-Host ("       {0}  {1,8} Bytes  {2}" -f $c.Name, $c.Length, $c.LastWriteTime)
        }
    } else {
        Write-Info "keine Report-CSV in $d"
    }
}

Write-Section "E) Letzte Laeufe im sync-Log"
$Log = Join-Path $VerpRoot "logs\sync-inventory_$(Get-Date -Format 'yyyy-MM-dd').log"
if (Test-Path $Log) {
    Write-Info "Log: $Log"
    Get-Content $Log -Tail 20 | ForEach-Object { Write-Host "       $_" }
} else {
    Write-Bad "Kein Log fuer heute: $Log"
}

Write-Section "F) Ausgabe des heutigen Laufs (stdout/stderr)"
$Out = @(Get-ChildItem "$VerpRoot\logs" -Filter "sync-inventory_out_*.log" -File -ErrorAction SilentlyContinue |
         Sort-Object LastWriteTime -Descending | Select-Object -First 1)
if ($Out.Count -gt 0) {
    Write-Info "--- $($Out[0].Name) ---"
    Get-Content $Out[0].FullName -Tail 20 | ForEach-Object { Write-Host "       $_" }
    $ErrFile = "$($Out[0].FullName).err"
    if (Test-Path $ErrFile) {
        Write-Info "--- $(Split-Path $ErrFile -Leaf) ---"
        Get-Content $ErrFile -Tail 20 | ForEach-Object { Write-Host "       $_" }
    }
} else {
    Write-Info "keine stdout-Datei gefunden"
}

Write-Section "G) Konfiguration aus der .env (ueber Django, nicht os.environ)"
$BackendDir = Join-Path $VerpRoot "backend"
$Py = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($Py -and (Test-Path (Join-Path $BackendDir "manage.py"))) {
    $Cmd = "import os;from inventory.management.commands.sync_inventory_from_excel import get_setting;" +
           "p=get_setting('INVENTORY_EXCEL_DIR');print('DIR   :',repr(p));" +
           "print('OK    :','JA' if p and os.path.isdir(p) else 'NEIN');" +
           "print('MUSTER:',repr(get_setting('INVENTORY_EXCEL_PATTERN','')))"
    Push-Location $BackendDir
    try {
        & $Py manage.py shell -c $Cmd 2>&1 | ForEach-Object { Write-Host "       $_" }
    } finally {
        Pop-Location
    }
} else {
    Write-Bad "Python oder manage.py nicht gefunden, Konfiguration nicht pruefbar."
}

Write-Section "H) Netzwerkpfad (als dieser Benutzer)"
Write-Info "Pfad aus Abschnitt 13 der Doku: \\server\Text\Company\Lager"
Write-Info "Mit dem Task-Konto pruefen, nicht mit diesem Fenster."

Write-Host ""
Write-Host "Befund erstellt. Bitte die komplette Ausgabe zurueckschicken." -ForegroundColor Yellow

# Bewusst Exit 0: dieses Skript ist eine Diagnose und darf selbst nie als
# fehlgeschlagen gemeldet werden, sonst sieht der Task-Status (den wir
# gerade untersuchen) dadurch zusaetzlich unplausibel aus.
exit 0
