<#
.SYNOPSIS
    Installiert SQL Server Express 2022 und stellt das VSDB-Backup wieder her.
.DESCRIPTION
    1. Laedt SQL Server Express 2022 herunter (falls nicht vorhanden)
    2. Installiert SQL Server Express als SQLEXPRESS-Instanz
    3. Stellt die VSDB-Datenbank aus dem Backup wieder her
    4. Erstellt den VisitronDB-Login mit den Standard-Credentials
.NOTES
    Muss als Administrator ausgefuehrt werden!
#>

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$BackupFile = "Datenvorlagen\VSDB_FULL_04172026_000002.BAK"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupPath = Join-Path $ProjectRoot $BackupFile
$InstanceName = "SQLEXPRESS"
$DB_Name = "VSDB"
$DB_User = "VisitronDB"
$DB_Password = "visitron"
$SA_Password = "Visitron#2026!"

# SQL Server Express 2022 Download-URL
$SqlExpressInstallerUrl = "https://go.microsoft.com/fwlink/p/?linkid=2216019&clcid=0x407&culture=de-de&country=de"
$InstallerPath = Join-Path $env:TEMP "SQL2022-SSEI-Expr.exe"
$MediaPath = Join-Path $env:TEMP "SQL2022Express"

Write-Host "=== VERP Lokale SQL Server Express Setup ===" -ForegroundColor Cyan
Write-Host "  Projekt: $ProjectRoot"
Write-Host "  Backup:  $BackupPath"
Write-Host ""

# Pruefen ob Backup existiert
if (-not (Test-Path $BackupPath)) {
    Write-Error "Backup-Datei nicht gefunden: $BackupPath"
    exit 1
}

# ============================================================
# 1. SQL Server Express installieren (falls nicht vorhanden)
# ============================================================
$sqlInstance = Get-Service -Name "MSSQL`$$InstanceName" -ErrorAction SilentlyContinue

if (-not $sqlInstance) {
    Write-Host "[1/5] SQL Server Express 2022 wird heruntergeladen..." -ForegroundColor Yellow

    if (-not (Test-Path $InstallerPath)) {
        Write-Host "  Download von $SqlExpressInstallerUrl"
        Invoke-WebRequest -Uri $SqlExpressInstallerUrl -OutFile $InstallerPath -UseBasicParsing
    }
    Write-Host "  Installer heruntergeladen: $InstallerPath" -ForegroundColor Green

    Write-Host "[2/5] SQL Server Express wird installiert..." -ForegroundColor Yellow
    Write-Host "  Dies kann einige Minuten dauern..."

    # Media herunterladen
    if (-not (Test-Path $MediaPath)) {
        New-Item -ItemType Directory -Path $MediaPath -Force | Out-Null
    }
    
    Write-Host "  Lade Installationsmedien herunter..."
    $mediaProcess = Start-Process -FilePath $InstallerPath `
        -ArgumentList "/Action=Download", "/MediaPath=$MediaPath", "/MediaType=Core", "/Quiet" `
        -Wait -PassThru -NoNewWindow
    
    if ($mediaProcess.ExitCode -ne 0) {
        Write-Error "Media-Download fehlgeschlagen (Exit Code: $($mediaProcess.ExitCode))"
        exit 1
    }

    # Setup-Datei finden
    $setupExe = Get-ChildItem -Path $MediaPath -Filter "setup.exe" -Recurse | Select-Object -First 1
    if (-not $setupExe) {
        $setupExe = Get-ChildItem -Path $MediaPath -Filter "SQLEXPR*.exe" -Recurse | Select-Object -First 1
    }
    
    if (-not $setupExe) {
        Write-Error "Setup-Datei nicht in $MediaPath gefunden. Bitte manuell installieren."
        exit 1
    }

    Write-Host "  Starte Installation von: $($setupExe.FullName)"
    
    # Wenn es ein selbstextrahierendes Archiv ist
    if ($setupExe.Name -like "SQLEXPR*.exe") {
        $extractPath = Join-Path $MediaPath "extracted"
        $extractProcess = Start-Process -FilePath $setupExe.FullName `
            -ArgumentList "/qs", "/x:$extractPath" `
            -Wait -PassThru -NoNewWindow
        $setupExe = Get-ChildItem -Path $extractPath -Filter "setup.exe" -Recurse | Select-Object -First 1
    }

    # SQL Server installieren
    $installArgs = @(
        "/Q"
        "/ACTION=Install"
        "/FEATURES=SQLEngine"
        "/INSTANCENAME=$InstanceName"
        "/SQLSVCACCOUNT=`"NT AUTHORITY\NETWORK SERVICE`""
        "/SQLSYSADMINACCOUNTS=`"BUILTIN\Administrators`""
        "/SECURITYMODE=SQL"
        "/SAPWD=$SA_Password"
        "/TCPENABLED=1"
        "/NPENABLED=0"
        "/IACCEPTSQLSERVERLICENSETERMS"
        "/UpdateEnabled=0"
    )

    $installProcess = Start-Process -FilePath $setupExe.FullName `
        -ArgumentList $installArgs `
        -Wait -PassThru -NoNewWindow

    if ($installProcess.ExitCode -ne 0 -and $installProcess.ExitCode -ne 3010) {
        Write-Error "SQL Server Installation fehlgeschlagen (Exit Code: $($installProcess.ExitCode)). Siehe Setup-Log unter C:\Program Files\Microsoft SQL Server\*\Setup Bootstrap\Log\"
        exit 1
    }

    Write-Host "  SQL Server Express installiert." -ForegroundColor Green
} else {
    Write-Host "[1/5] SQL Server Express bereits installiert." -ForegroundColor Green
    Write-Host "[2/5] Installation uebersprungen." -ForegroundColor Green
}

# ============================================================
# 2. SQL Server Dienst starten und TCP/IP aktivieren
# ============================================================
Write-Host "[3/5] SQL Server Dienst starten und TCP/IP konfigurieren..." -ForegroundColor Yellow

# Dienst starten
$svc = Get-Service -Name "MSSQL`$$InstanceName" -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Error "SQL Server Dienst 'MSSQL`$$InstanceName' nicht gefunden nach Installation."
    exit 1
}

if ($svc.Status -ne 'Running') {
    Start-Service -Name "MSSQL`$$InstanceName"
    Write-Host "  SQL Server gestartet." -ForegroundColor Green
} else {
    Write-Host "  SQL Server laeuft bereits." -ForegroundColor Green
}

# SQL Server Browser starten (fuer Named Instance)
$browser = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
if ($browser) {
    Set-Service -Name "SQLBrowser" -StartupType Automatic
    if ($browser.Status -ne 'Running') {
        Start-Service -Name "SQLBrowser"
        Write-Host "  SQL Server Browser gestartet." -ForegroundColor Green
    }
}

# TCP/IP aktivieren via Registry (verschiedene Versionen unterstuetzen)
$regBase = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server"
$instanceKey = Get-ChildItem "$regBase" -ErrorAction SilentlyContinue | 
    Where-Object { $_.Name -match "MSSQL\d+\.SQLEXPRESS" } | 
    Select-Object -Last 1

if ($instanceKey) {
    $tcpKey = "$($instanceKey.PSPath)\MSSQLServer\SuperSocketNetLib\Tcp"
    if (Test-Path $tcpKey) {
        Set-ItemProperty -Path $tcpKey -Name "Enabled" -Value 1
        $ipAllKey = "$tcpKey\IPAll"
        if (Test-Path $ipAllKey) {
            Set-ItemProperty -Path $ipAllKey -Name "TcpPort" -Value "1433"
            Set-ItemProperty -Path $ipAllKey -Name "TcpDynamicPorts" -Value ""
        }
        Restart-Service -Name "MSSQL`$$InstanceName" -Force
        Write-Host "  TCP/IP auf Port 1433 aktiviert." -ForegroundColor Green
    }
}

# ============================================================
# 3. sqlcmd finden
# ============================================================
$sqlcmd = $null
$sqlcmdPaths = @(
    "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\*\Tools\Binn\SQLCMD.EXE"
    "${env:ProgramFiles}\Microsoft SQL Server\*\Tools\Binn\SQLCMD.EXE"
    "${env:ProgramFiles(x86)}\Microsoft SQL Server\*\Tools\Binn\SQLCMD.EXE"
)
foreach ($pattern in $sqlcmdPaths) {
    $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -Last 1
    if ($found) {
        $sqlcmd = $found.FullName
        break
    }
}

if (-not $sqlcmd) {
    $sqlcmd = (Get-Command sqlcmd -ErrorAction SilentlyContinue).Source
}

if (-not $sqlcmd) {
    Write-Error "sqlcmd nicht gefunden. Bitte SQL Server Command Line Utilities installieren."
    exit 1
}

Write-Host "  sqlcmd gefunden: $sqlcmd" -ForegroundColor Green

# ============================================================
# 4. Backup wiederherstellen
# ============================================================
Write-Host "[4/5] Stelle Datenbank '$DB_Name' wieder her..." -ForegroundColor Yellow

# Backup-Info auslesen
Write-Host "  Lese Backup-Struktur..."
& $sqlcmd -S "localhost\$InstanceName" -U sa -P $SA_Password -Q "RESTORE FILELISTONLY FROM DISK = N'$BackupPath'" -W

# SQL Server Datenpfad ermitteln
$dataPathResult = & $sqlcmd -S "localhost\$InstanceName" -U sa -P $SA_Password `
    -Q "SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(260))" -W -h -1
$dataPath = ($dataPathResult | Where-Object { $_.Trim() -ne "" -and $_ -notmatch "rows affected" } | Select-Object -First 1).Trim()

if (-not $dataPath -or -not (Test-Path $dataPath)) {
    # Fallback
    $dataPath = "C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA\"
}

Write-Host "  Daten-Pfad: $dataPath"

$restoreSQL = @"
IF EXISTS (SELECT name FROM sys.databases WHERE name = '$DB_Name')
BEGIN
    ALTER DATABASE [$DB_Name] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$DB_Name];
END

RESTORE DATABASE [$DB_Name]
FROM DISK = N'$BackupPath'
WITH
    MOVE 'VSDB' TO '${dataPath}VSDB.mdf',
    MOVE 'VSDB_log' TO '${dataPath}VSDB_log.ldf',
    REPLACE,
    STATS = 10;
"@

& $sqlcmd -S "localhost\$InstanceName" -U sa -P $SA_Password -Q $restoreSQL
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  HINWEIS: Falls die logischen Dateinamen nicht stimmen," -ForegroundColor Red
    Write-Host "  passe die MOVE-Klauseln anhand der FILELISTONLY-Ausgabe oben an." -ForegroundColor Red
    exit 1
}
Write-Host "  Datenbank '$DB_Name' wiederhergestellt." -ForegroundColor Green

# ============================================================
# 5. Login und User erstellen
# ============================================================
Write-Host "[5/5] Erstelle Login '$DB_User'..." -ForegroundColor Yellow

$userSQL = @"
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = '$DB_User')
    CREATE LOGIN [$DB_User] WITH PASSWORD = '$DB_Password', CHECK_POLICY = OFF;

USE [$DB_Name];
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = '$DB_User')
    CREATE USER [$DB_User] FOR LOGIN [$DB_User];

ALTER ROLE db_datareader ADD MEMBER [$DB_User];
ALTER ROLE db_datawriter ADD MEMBER [$DB_User];
GRANT EXECUTE TO [$DB_User];
"@

& $sqlcmd -S "localhost\$InstanceName" -U sa -P $SA_Password -Q $userSQL
if ($LASTEXITCODE -ne 0) {
    Write-Error "User-Erstellung fehlgeschlagen."
    exit 1
}
Write-Host "  Login '$DB_User' erstellt." -ForegroundColor Green

# ============================================================
# Zusammenfassung
# ============================================================
Write-Host ""
Write-Host "=== Setup abgeschlossen ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Verbindungsparameter:" -ForegroundColor White
Write-Host "  Server:    localhost\$InstanceName,1433" -ForegroundColor White
Write-Host "  Datenbank: $DB_Name" -ForegroundColor White
Write-Host "  User:      $DB_User" -ForegroundColor White
Write-Host "  Passwort:  $DB_Password" -ForegroundColor White
Write-Host ""
Write-Host "  SA-Passwort: $SA_Password" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Diese Parameter entsprechen den DEFAULT_SERVER/DEFAULT_DATABASE Werten" -ForegroundColor Green
Write-Host "in sql_angebote/views.py und verp_settings/customer_sync_views.py." -ForegroundColor Green
Write-Host ""
Write-Host "Zum Testen: /api/sql-angebote/test-connection/" -ForegroundColor DarkGray
