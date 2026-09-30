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
    [string]$DailyAt = "02:00",
    [string]$User = "",
    [string]$Password = ""
)

$ErrorActionPreference = "Stop"

# Administratorrechte pruefen BEVOR irgendetwas registriert wird.
$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "FEHLER: Diese Registrierung benoetigt Administratorrechte." -ForegroundColor Red
    Write-Host "Bitte in einer PowerShell als Administrator oeffnen und erneut ausfuehren." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Aus dieser PowerShell heraus als Administrator starten:" -ForegroundColor Yellow
    Write-Host ('  Start-Process powershell -Verb RunAs -ArgumentList ''-NoExit -ExecutionPolicy Bypass -File "{0}"''' -f $PSCommandPath) -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternativ einmalig manuell in der Task-Planung:" -ForegroundColor Yellow
    Write-Host "  1) Task-Planung oeffnen, 'Aufgabe erstellen', Trigger: 'Taeglich'" -ForegroundColor Yellow
    Write-Host "  2) Aktion: powershell.exe" -ForegroundColor Yellow
    Write-Host ('     Argumente: -NoProfile -ExecutionPolicy Bypass -File "{0}\scripts\sync-inventory.ps1" -ExcelPath "{1}"' -f $VerpRoot, $ExcelPath) -ForegroundColor Yellow
    exit 1
}

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

# Tages-Trigger statt "-Once + Repetition".
# Grund: der "-Once"-Trigger zeigt in der Task-Planung kein taegliches
# Muster an und laeuft nach einer certain Zeit nicht mehr zuverlaessig.
# Mit -Daily bleibt der Zeitplan sichtbar und wird vom Scheduler verwaltet.
# -StartWhenAvailable faengt einen Lauf nach, der wegen ausgeschaltetem
# Server verpasst wurde.
$trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 120) `
    -MultipleInstances IgnoreNew

# Netzlaufwerk / UNC-Pfad vorab unter dem gewaehlten Konto testen.
# Das ist der haeufigste Fehlergrund: SYSTEM sieht eine Freigabe nur ueber
# das Computerkonto, und ohne den Test faellt es erst mitten im Lauf auf.
if ($ExcelPath) {
    if (-not (Test-Path $ExcelPath)) {
        Write-Host "FEHLER: Excel-Pfad nicht erreichbar: $ExcelPath" -ForegroundColor Red
        Write-Host "Bitte mit Test-Path pruefen. UNC-Pfade muessen '\\\\server\freigabe' sein." -ForegroundColor Yellow
        exit 1
    }
    $fileCount = (Get-ChildItem -Path $ExcelPath -Recurse -Filter '*.xls*' -ErrorAction SilentlyContinue |
                  Measure-Object).Count
    Write-Host "Pfad OK: $ExcelPath ($fileCount Excel-Dateien gefunden)" -ForegroundColor Green
}

# Konto waehlen. Mit -User laeuft die Aufgabe unter einem echten Benutzer,
# der auf die Freigabe zugreifen darf - das ist fuer Netzlaufwerke die
# zuverlaessigere Variante. Ohne -User laeuft sie als SYSTEM.
$principal = $null
if ($User) {
    $secure = ConvertTo-SecureString -String $Password -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential($User, $secure)
    $principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Password -RunLevel Highest -Credential $cred
    Write-Host "Konto: $User (mit Netzwerkrechten)" -ForegroundColor Green
    Write-Host "Hinweis: Das Passwort wird im Konto gespeichert. Bei einem" -ForegroundColor Yellow
    Write-Host "Passwortwechsel muss die Aufgabe neu registriert werden." -ForegroundColor Yellow
}
else {
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Write-Host "Konto: SYSTEM" -ForegroundColor Green
    if ($ExcelPath -match '^\\\\') {
        Write-Host ""
        Write-Host "ACHTUNG: SYSTEM erreicht Netzlaufwerke nur ueber das Computerkonto." -ForegroundColor Yellow
        Write-Host "Der Test oben lief als $([Environment]::UserName), nicht als SYSTEM." -ForegroundColor Yellow
        Write-Host "Falls der Lauf spaeter 'Verzeichnis nicht gefunden' meldet:" -ForegroundColor Yellow
        Write-Host "  1) Freigabe-Root mappen:  net use Z: \\server\text /persistent:yes" -ForegroundColor Yellow
        Write-Host "  2) .env setzen:           INVENTORY_EXCEL_DIR=Z:\Company\Lager" -ForegroundColor Yellow
        Write-Host "  3) oder mit -User <Konto> -Password <PW> neu registrieren" -ForegroundColor Yellow
    }
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "VERP: legt neue Lagerartikel aus den Excel-Lagerlisten im Warenlager an" `
    -Force | Out-Null

Write-Host "Aufgabe '$TaskName' registriert."
Write-Host "Startzeit: taeglich $DailyAt (StartWhenAvailable: verpasste Laeufe werden nachgeholt)"
Write-Host ""
Write-Host "SOFORT TESTEN (sehr empfehlenswert):"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Start-Sleep -Seconds 20"
Write-Host "  Get-ScheduledTaskInfo -TaskName '$TaskName' | Select-Object LastRunTime, LastTaskResult"
Write-Host "  Get-Content '$VerpRoot\logs\sync-inventory_*.log' -Tail 20"
Write-Host ""
Write-Host "LastTaskResult 0 = erfolgreich, 1 = Fehler"
Write-Host "Entfernen: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
