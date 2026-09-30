# Registriert den Excel-Lagerabgleich als geplante Windows-Aufgabe (Aufgabenplanung).
#
# Einmalig als Administrator ausfuehren:
#   cd C:\VERP\scripts
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
#   .\register-inventory-sync-task.ps1
#
# Alternativ mit eigenem Zeitplan / Pfad:
#   .\register-inventory-sync-task.ps1 -ExcelPath "\\fileserver\Lager\Warenlager" -DailyAt "02:30"
#
# Entfernen:
#   Unregister-ScheduledTask -TaskName "VERP-Inventory-Sync" -Confirm:$false

param(
    [string]$VerpRoot = "C:\VERP",
    [string]$ExcelPath = "",
    [string]$TaskName = "VERP-Inventory-Sync",
    [string]$DailyAt = "02:00"
)

$ErrorActionPreference = "Stop"

$ScriptPath = Join-Path $VerpRoot "scripts\sync-inventory.ps1"
if (-not (Test-Path $ScriptPath)) {
    Write-Host "FEHLER: Skript nicht gefunden: $ScriptPath" -ForegroundColor Red
    exit 1
}

$psArgs = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$ScriptPath`"",
    "-VerpRoot", "`"$VerpRoot`""
)
if ($ExcelPath) {
    $psArgs += @("-ExcelPath", "`"$ExcelPath`"")
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument ($psArgs -join ' ') `
    -WorkingDirectory (Join-Path $VerpRoot "scripts")

# "-Once" plus Repetition ist robuster als ein daily-Trigger mit Startzeit,
# weil der Startzeitpunkt auch nach einem Neustart des Servers greift.
$start = (Get-Date).Date.AddDays(1).Add([TimeSpan]::Parse($DailyAt))

$trigger = New-ScheduledTaskTrigger -Once -At $start `
    -RepetitionInterval (New-TimeSpan -Hours 24) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 120) `
    -MultipleInstances IgnoreNew

# Laufft als SYSTEM, damit Netzwerkfreigaben erreichbar sind.
# WICHTIG: Fuer \\-Freigaben muss das Konto zwingend unter einem echten
# Benutzerkonto mit Rechten auf den Share laufen (siehe -User/-Password unten).
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "VERP: legt neue Lagerartikel aus den Excel-Lagerlisten im Warenlager an" `
    -Force | Out-Null

Write-Host "Aufgabe '$TaskName' registriert."
Write-Host "Startzeit: taeglich $DailyAt"
Write-Host "Naechster Start: $($start.ToString('yyyy-MM-dd HH:mm'))"
Write-Host ""
Write-Host "Testen:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Get-ScheduledTaskInfo -TaskName '$TaskName' | Select-Object LastRunTime, LastTaskResult"
Write-Host ""
Write-Host "Hinweis fuer Netzlaufwerke (\\\\Server\\Share):"
Write-Host "  SYSTEM erreicht UNC-Pfade nur ueber das Computerkonto. Fuer zuverlaessigen"
Write-Host "  Zugriff entweder ein lokales Laufwerk einbinden (net use) oder die Aufgabe"
Write-Host "  mit -User/-Password auf ein Benutzerkonto registrieren."
