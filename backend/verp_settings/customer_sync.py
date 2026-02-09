"""
Kundendaten-Synchronisation mit externer SQL Server Datenbank (VSDB).

Verbindet sich mit der SQL Server Instanz, liest Adressen aus der Tabelle 'Adressen'
und gleicht diese mit den vorhandenen VERP-Kundendaten ab.

Tatsaechliche Spalten der SQL-Tabelle 'Adressen':
  AdressenID, Vorname, Name, Firma/Uni, Institut, Lehrstuhl, Strasse, PLZ, Ort,
  Anfahrt, Ortsnetz, Anschluss1, Anschluss2, Anschluss3, Fax, Email,
  Kunde, Interessent, Lieferant, OEM, Geschaeftsjahresende, Institution,
  AnredeID, LandID, TitelID, MasterID, MasterRef, LastModified,
  Marker, InternMarker, UICKunde, UICUpdateKostenlos, UICAuftrag,
  UICAktuellesUpdate, UICUser, Englischsprachig, veraltet, Newsletter,
  Serie, VisiView

Lookup-Tabellen: Anrede, Titel, Land werden ueber IDs aufgeloest.
Boolean-Werte in SQL Server: BIT (0/1), in Access-Export: WAHR/FALSCH.
"""
import logging
import re
import pyodbc
from django.db import connection, transaction
from customers.models import Customer, CustomerAddress, CustomerPhone, CustomerEmail, CustomerLegacyMapping

logger = logging.getLogger(__name__)


# --- Anrede-Mapping: SQL-DB AnredeID -> (VERP Salutation, Titel-Prefix) ---
# SQL-DB hat kombinierte Anreden wie 'Herr Professor' -> VERP trennt in Anrede + Titel
ANREDE_MAP = {
    1: ('', ''),                     # leer
    2: ('Frau', ''),                 # Frau
    3: ('Herr', ''),                 # Herr
    4: ('Frau', 'Prof.'),            # Frau Professor -> Frau + Prof.
    5: ('Herr', 'Prof.'),            # Herr Professor -> Herr + Prof.
    6: ('Frau', ''),                 # Frau Direktor -> Frau
    7: ('Herr', ''),                 # Herr Direktor -> Herr
    8: ('Frau', ''),                 # Frau Reg. Amtsrat -> Frau
    9: ('Herr', ''),                 # Herr Reg. Amtsrat -> Herr
    10: ('Herr', ''),                # Herr und Frau -> Herr (Naeherung)
}

# Titel-Mapping: SQL-DB TitelID -> VERP Titel-String
TITEL_MAP = {
    1: '',              # leer
    2: 'Ass.-Prof.',
    3: 'Dipl.-Ing.',
    4: 'Dipl.-Phys.',
    5: 'Dipl.-Chem.',
    6: 'Dipl.-Inform.',
    7: 'Dipl.-Kfm.',
    8: 'Dr.',
    9: 'Ing.',
    10: 'Mag.',
    11: 'Priv.-Doz.',
}

# Land-Mapping: SQL-DB LandID -> ISO 3166-1 Alpha-2 Code
LAND_MAP = {
    1: '',      # leer
    2: 'EG',    # Aegypten
    3: 'DZ',    # Algerien
    4: 'BE',    # Belgien
    5: 'BR',    # Brasilien
    6: 'BG',    # Bulgarien
    7: 'DK',    # Daenemark
    8: 'DE',    # Deutschland
    9: 'FI',    # Finnland
    10: 'FR',   # Frankreich
    11: 'GR',   # Griechenland
    12: 'GB',   # Grossbritannien
    13: 'HK',   # Hongkong
    14: 'IN',   # Indien
    15: 'IS',   # Island
    16: 'IL',   # Israel
    17: 'IT',   # Italien
    18: 'RS',   # Jugoslawien -> Serbien
    19: 'LI',   # Liechtenstein
    20: 'LT',   # Litauen
    21: 'LU',   # Luxemburg
    22: 'MK',   # Makedonien
    23: 'MA',   # Marokko
    24: 'NL',   # Niederlande
    25: 'NO',   # Norwegen
    26: 'AT',   # Oesterreich
    27: 'PK',   # Pakistan
    28: 'PL',   # Polen
    29: 'PT',   # Portugal
    30: 'IE',   # Republik Irland
    31: 'ZA',   # Republik Suedafrika
    32: 'TW',   # Republik Taiwan
    33: 'RO',   # Rumaenien
    34: 'RU',   # Russische Republik
    35: 'SE',   # Schweden
    36: 'CH',   # Schweiz
    37: 'SK',   # Slovakische Republik
    38: 'SI',   # Slovenien
    39: 'ES',   # Spanien
    40: 'BN',   # Sultanat Brunei
    41: 'CZ',   # Tschecheslowakei -> Tschechien
    42: 'CZ',   # Tschechische Republik
    43: 'TR',   # Tuerkei
    44: 'RU',   # UdSSR -> Russland
    45: 'UA',   # Ukraine
    46: 'HU',   # Ungarn
    47: 'US',   # USA
    48: 'CN',   # Volksrepublik China
    49: 'AZ',   # Aserbaidschan
    50: 'HR',   # Kroatien
    51: 'UZ',   # Usbekistan
    52: 'LV',   # Lettland
    53: 'BY',   # Weissrussland
    54: 'IE',   # Irland
    55: 'AU',   # Australien
    56: 'TW',   # Taiwan, R.O.C.
    57: 'CN',   # China
    58: 'JP',   # Japan
    59: 'KR',   # Suedkorea
    60: 'NZ',   # Neuseeland
}

# Land -> Sprache Fallback
LAND_SPRACHE_MAP = {
    'DE': 'DE', 'AT': 'DE', 'CH': 'DE', 'LI': 'DE', 'LU': 'DE',
    'FR': 'FR', 'ES': 'ES', 'IT': 'IT',
}


# Standard-Zugangsdaten fuer SQL Server Authentifizierung
SQL_AUTH_UID = 'VisitronDB'
SQL_AUTH_PWD = 'visitron'


# --- Hilfsfunktionen fuer case-insensitive Spaltenaufloesung ---

def _build_column_map(available_columns):
    """
    Erstellt ein case-insensitives Mapping: lowercase -> tatsaechlicher Spaltenname.
    So findet 'veraltet' auch bei 'Veraltet' oder 'VERALTET'.
    """
    return {col.lower(): col for col in available_columns}


def _resolve_col(col_map, name):
    """Findet den echten Spaltennamen case-insensitiv. Gibt None zurueck wenn nicht vorhanden."""
    return col_map.get(name.lower())


def _parse_bool(value):
    """
    Wandelt verschiedene Boolean-Darstellungen in Python bool um.
    SQL Server BIT: 0/1, True/False
    Access Export: WAHR/FALSCH
    """
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    s = str(value).strip().upper()
    return s in ('1', 'TRUE', 'WAHR', 'YES', 'JA', 'J', 'Y')


# --- Verbindung ---

def get_mssql_connection(server, database='VSDB', use_dsn=False, dsn_name=None,
                         uid=None, pwd=None):
    """
    Erstellt eine ODBC-Verbindung zum SQL Server.
    Nutzt SQL Server-Authentifizierung (nicht Windows Auth).
    """
    uid = uid or SQL_AUTH_UID
    pwd = pwd or SQL_AUTH_PWD

    try:
        if use_dsn and dsn_name:
            conn_str = (
                f'DSN={dsn_name};'
                f'DATABASE={database};'
                f'UID={uid};'
                f'PWD={pwd};'
            )
        else:
            driver = _find_odbc_driver()
            conn_str = (
                f'DRIVER={{{driver}}};'
                f'SERVER={server};'
                f'DATABASE={database};'
                f'UID={uid};'
                f'PWD={pwd};'
                f'TrustServerCertificate=yes;'
                f'Encrypt=no;'
            )

        connection = pyodbc.connect(conn_str, timeout=10)
        return connection
    except pyodbc.Error as e:
        logger.error(f"MSSQL Verbindungsfehler: {e}")
        raise


def _find_odbc_driver():
    """Findet den besten verfuegbaren ODBC-Treiber fuer SQL Server."""
    preferred_drivers = [
        'ODBC Driver 13 for SQL Server',
        'ODBC Driver 17 for SQL Server',
        'ODBC Driver 18 for SQL Server',
        'SQL Server Native Client 11.0',
        'SQL Server',
    ]

    available = pyodbc.drivers()
    for driver in preferred_drivers:
        if driver in available:
            return driver

    for drv in available:
        if 'sql server' in drv.lower():
            return drv

    raise RuntimeError(
        f"Kein SQL Server ODBC-Treiber gefunden. "
        f"Verfuegbare Treiber: {', '.join(available) if available else 'keine'}"
    )


# --- Titel/Anrede-Hilfe ---

def build_titel_string(anrede_id, titel_id):
    """
    Baut den VERP-Titel-String aus AnredeID und TitelID zusammen.

    Beispiele:
        AnredeID=5 (Herr Professor), TitelID=8 (Dr.) -> 'Prof. Dr.'
        AnredeID=3 (Herr), TitelID=8 (Dr.) -> 'Dr.'
        AnredeID=5 (Herr Professor), TitelID=1 (leer) -> 'Prof.'
    """
    anrede_info = ANREDE_MAP.get(anrede_id, ('', ''))
    titel_prefix = anrede_info[1]
    titel_value = TITEL_MAP.get(titel_id, '')
    parts = [p for p in [titel_prefix, titel_value] if p]
    return ' '.join(parts)


# --- String-Hilfe ---

def clean_string(value):
    """Bereinigt einen String-Wert aus der SQL-Datenbank."""
    if value is None:
        return ''
    return str(value).strip()


def extract_street_and_number(street_str):
    """
    Versucht Strasse und Hausnummer aus einem kombinierten String zu trennen.
    z.B. 'Nonnendammallee 44-61' -> ('Nonnendammallee', '44-61')
    """
    street_str = clean_string(street_str)
    if not street_str:
        return '', ''
    match = re.match(r'^(.+?)\s+(\d[\d\s\-/a-zA-Z]*)$', street_str)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return street_str, ''


def combine_phone(vorwahl, telefon):
    """Kombiniert Vorwahl und Telefonnummer."""
    v = clean_string(vorwahl)
    t = clean_string(telefon)
    if v and t:
        return f"{v} {t}"
    return t or v


def get_language(english_speaking, land_iso):
    """
    Ermittelt die Sprache basierend auf Englischsprachig-Flag und Land.
    Kein SpracheID in der SQL-Tabelle - stattdessen Englischsprachig (bool).
    """
    if english_speaking:
        return 'EN'
    if land_iso:
        return LAND_SPRACHE_MAP.get(land_iso, 'EN')
    return 'DE'


# --- SQL-Daten lesen ---

def _get_column_info(connection):
    """
    Liest die Spalten der Adressen-Tabelle und gibt ein case-insensitives
    Mapping zurueck: lowercase_name -> tatsaechlicher_name.
    """
    cursor = connection.cursor()
    try:
        cursor.execute("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Adressen'
        """)
        columns = {row[0] for row in cursor.fetchall()}
        return _build_column_map(columns), columns
    finally:
        cursor.close()


def fetch_addresses_from_sql(connection, limit=None):
    """
    Liest alle relevanten Adressen aus der SQL-Datenbank.
    Filtert: veraltet=1, ohne Nachname, Lieferant=1.

    Echte Spaltennamen (case-insensitiv aufgeloest):
      Name, Firma/Uni, Institut, Lehrstuhl, Strasse, Ortsnetz,
      Anschluss1, Anschluss2, Anschluss3, Anfahrt, veraltet,
      Newsletter, Lieferant, Englischsprachig
    """
    col_map, raw_columns = _get_column_info(connection)

    # Spalten aufloesen (case-insensitiv)
    veraltet_col = _resolve_col(col_map, 'veraltet')
    lieferant_col = _resolve_col(col_map, 'lieferant')

    # Alle Adress-Spalten die wir lesen wollen (mit ihrem gewuenschten Alias)
    # Format: (gewuenschter_name_im_dict, moegliche_sql_spaltennamen)
    wanted_columns = [
        ('AdressenID', ['adressenid']),
        ('Vorname', ['vorname']),
        ('Nachname', ['name', 'nachname']),
        ('FirmaUni', ['firma/uni', 'firma1']),
        ('Institut', ['institut', 'firma2']),
        ('Lehrstuhl', ['lehrstuhl', 'firma3']),
        ('Strasse', ['stra\u00dfe', 'strasse']),
        ('PLZ', ['plz']),
        ('Ort', ['ort']),
        ('Anfahrt', ['anfahrt', 'zusatz']),
        ('Ortsnetz', ['ortsnetz', 'vorwahl']),
        ('Anschluss1', ['anschlu\u00df1', 'anschluss1', 'telefon1']),
        ('Anschluss2', ['anschlu\u00df2', 'anschluss2', 'telefon2']),
        ('Anschluss3', ['anschlu\u00df3', 'anschluss3', 'telefon3']),
        ('Fax', ['fax']),
        ('Email', ['email']),
        ('Kunde', ['kunde']),
        ('Interessent', ['interessent']),
        ('Lieferant', ['lieferant']),
        ('AnredeID', ['anredeid']),
        ('LandID', ['landid']),
        ('TitelID', ['titelid']),
        ('Englischsprachig', ['englischsprachig']),
        ('veraltet', ['veraltet']),
        ('Newsletter', ['newsletter']),
    ]

    # Aufloesen: welche Spalten gibt es wirklich?
    select_parts = []    # (alias, echterSpaltenname)
    for alias, candidates in wanted_columns:
        for cand in candidates:
            real_name = _resolve_col(col_map, cand)
            if real_name:
                select_parts.append((alias, real_name))
                break

    if not select_parts:
        raise RuntimeError("Keine passenden Spalten in der Adressen-Tabelle gefunden")

    # SQL SELECT bauen
    select_sql = ', '.join([f'a.[{real}]' for _, real in select_parts])

    # WHERE: Name nicht leer, nicht veraltet, kein Lieferant
    name_real = None
    for alias, real in select_parts:
        if alias == 'Nachname':
            name_real = real
            break

    if not name_real:
        raise RuntimeError("Spalte 'Name' oder 'Nachname' nicht in der Tabelle gefunden")

    where_parts = [
        f"a.[{name_real}] IS NOT NULL",
        f"a.[{name_real}] <> ''",
    ]

    if veraltet_col:
        where_parts.append(f"(a.[{veraltet_col}] = 0 OR a.[{veraltet_col}] IS NULL)")

    if lieferant_col:
        where_parts.append(f"(a.[{lieferant_col}] = 0 OR a.[{lieferant_col}] IS NULL)")

    query = f"SELECT {select_sql} FROM Adressen a WHERE {' AND '.join(where_parts)}"

    if limit:
        query += f" ORDER BY a.[{select_parts[0][1]}] OFFSET 0 ROWS FETCH NEXT {int(limit)} ROWS ONLY"

    logger.info(f"SQL-Query: {query[:300]}...")

    cursor = connection.cursor()
    try:
        cursor.execute(query)
        result_columns = [desc[0] for desc in cursor.description]

        # Mapping: result_column_index -> alias
        alias_map = {}
        for i, res_col in enumerate(result_columns):
            for alias, real in select_parts:
                if real == res_col:
                    alias_map[i] = alias
                    break
            else:
                alias_map[i] = res_col

        rows = []
        for row in cursor.fetchall():
            row_dict = {}
            for i, val in enumerate(row):
                row_dict[alias_map.get(i, f'col_{i}')] = val
            rows.append(row_dict)

        logger.info(f"SQL-Abfrage: {len(rows)} Adressen gelesen")
        return rows
    except pyodbc.Error as e:
        logger.error(f"SQL Abfrage Fehler: {e}")
        raise
    finally:
        cursor.close()


# --- Verbindungstest ---

def test_connection(server, database='VSDB', use_dsn=False, dsn_name=None):
    """Testet die Verbindung und gibt Statistiken zurueck."""
    try:
        conn = get_mssql_connection(server, database, use_dsn, dsn_name)
        cursor = conn.cursor()

        col_map, raw_columns = _get_column_info(conn)

        # Spaltennamen case-insensitiv aufloesen
        name_col = _resolve_col(col_map, 'name') or _resolve_col(col_map, 'nachname')
        veraltet_col = _resolve_col(col_map, 'veraltet')
        lieferant_col = _resolve_col(col_map, 'lieferant')
        newsletter_col = _resolve_col(col_map, 'newsletter')

        # Gesamtzahl
        cursor.execute("SELECT COUNT(*) FROM Adressen")
        total = cursor.fetchone()[0]

        # Synchronisierbar (nicht veraltet, nicht Lieferant, mit Nachname)
        where_parts = []
        if name_col:
            where_parts.append(f"[{name_col}] IS NOT NULL AND [{name_col}] <> ''")
        if veraltet_col:
            where_parts.append(f"([{veraltet_col}] = 0 OR [{veraltet_col}] IS NULL)")
        if lieferant_col:
            where_parts.append(f"([{lieferant_col}] = 0 OR [{lieferant_col}] IS NULL)")

        if where_parts:
            cursor.execute(f"SELECT COUNT(*) FROM Adressen WHERE {' AND '.join(where_parts)}")
            sync_eligible = cursor.fetchone()[0]
        else:
            sync_eligible = total

        # Veraltete Adressen
        outdated = 0
        if veraltet_col:
            cursor.execute(f"SELECT COUNT(*) FROM Adressen WHERE [{veraltet_col}] = 1")
            outdated = cursor.fetchone()[0]

        # Lieferanten
        suppliers = 0
        if lieferant_col:
            cursor.execute(f"SELECT COUNT(*) FROM Adressen WHERE [{lieferant_col}] = 1")
            suppliers = cursor.fetchone()[0]

        # Newsletter-Abonnenten
        newsletter_count = 0
        if newsletter_col:
            cursor.execute(f"SELECT COUNT(*) FROM Adressen WHERE [{newsletter_col}] = 1")
            newsletter_count = cursor.fetchone()[0]

        # Adressen ohne Nachname
        no_lastname = 0
        if name_col:
            cursor.execute(f"SELECT COUNT(*) FROM Adressen WHERE [{name_col}] IS NULL OR [{name_col}] = ''")
            no_lastname = cursor.fetchone()[0]

        # Tabellen
        cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'")
        tables = [row[0] for row in cursor.fetchall()]

        cursor.close()
        conn.close()

        return {
            'success': True,
            'total_addresses': total,
            'sync_eligible': sync_eligible,
            'outdated': outdated,
            'suppliers': suppliers,
            'newsletter': newsletter_count,
            'no_lastname': no_lastname,
            'tables': tables,
            'columns': sorted(list(raw_columns)),
            'resolved_columns': {
                'name': name_col,
                'veraltet': veraltet_col,
                'lieferant': lieferant_col,
                'newsletter': newsletter_col,
            }
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
        }


# --- Vorschau ---

def preview_sync(server, database='VSDB', use_dsn=False, dsn_name=None, limit=50):
    """Erstellt eine Vorschau der Synchronisation (Dry-Run)."""
    conn = get_mssql_connection(server, database, use_dsn, dsn_name)
    rows = fetch_addresses_from_sql(conn, limit=limit)
    conn.close()

    results = {
        'total_fetched': len(rows),
        'would_create': 0,
        'would_update': 0,
        'would_link': 0,
        'would_skip': 0,
        'preview_items': [],
    }

    for row in rows:
        adressen_id = row.get('AdressenID')
        nachname = clean_string(row.get('Nachname', ''))
        vorname = clean_string(row.get('Vorname', ''))
        email = clean_string(row.get('Email', ''))
        plz = clean_string(row.get('PLZ', ''))
        firma_uni = clean_string(row.get('FirmaUni', ''))

        if not nachname:
            results['would_skip'] += 1
            continue

        anrede_id = _safe_int(row.get('AnredeID'), 1)
        titel_id = _safe_int(row.get('TitelID'), 1)
        land_id = _safe_int(row.get('LandID'), 8)

        anrede_info = ANREDE_MAP.get(anrede_id, ('', ''))
        salutation = anrede_info[0]
        title = build_titel_string(anrede_id, titel_id)
        country_iso = LAND_MAP.get(land_id, 'DE')
        newsletter = _parse_bool(row.get('Newsletter'))

        existing, match_method = _find_existing_customer(
            adressen_id, nachname, vorname, email, plz, firma_uni
        )

        if existing:
            if match_method == 'legacy_id':
                action = 'update'
                results['would_update'] += 1
            else:
                action = 'link'
                results['would_link'] += 1
        else:
            action = 'create'
            results['would_create'] += 1

        results['preview_items'].append({
            'adressen_id': adressen_id,
            'action': action,
            'match_method': match_method or '',
            'verp_customer_number': existing.customer_number if existing else '(neu)',
            'vorname': vorname,
            'nachname': nachname,
            'salutation': salutation,
            'title': title,
            'firma': clean_string(row.get('FirmaUni', '')),
            'ort': clean_string(row.get('Ort', '')),
            'land': country_iso,
            'newsletter': newsletter,
        })

    return results


# --- Synchronisation ---

def sync_customers(server, database='VSDB', use_dsn=False, dsn_name=None,
                   created_by_user=None, dry_run=False):
    """Fuehrt die vollstaendige Synchronisation durch."""
    # PostgreSQL-Sequenzen reparieren bevor wir neue Datensaetze anlegen
    if not dry_run:
        reset_customer_sequences()

    conn = get_mssql_connection(server, database, use_dsn, dsn_name)
    rows = fetch_addresses_from_sql(conn)
    conn.close()

    stats = {
        'total_fetched': len(rows),
        'created': 0,
        'updated': 0,
        'linked': 0,
        'skipped': 0,
        'errors': [],
    }

    for row in rows:
        try:
            result = _sync_single_customer(row, created_by_user, dry_run)
            stats[result] += 1
        except Exception as e:
            adressen_id = row.get('AdressenID', '?')
            nachname = clean_string(row.get('Nachname', ''))
            error_msg = f"AdressenID {adressen_id} ({nachname}): {str(e)}"
            logger.error(error_msg)
            stats['errors'].append(error_msg)

    return stats


def _safe_int(value, default=0):
    """Sicheres Konvertieren zu int."""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _find_existing_customer(adressen_id, nachname, vorname, email, plz, firma_uni=''):
    """
    Versucht einen bestehenden VERP-Kunden zu finden, der zu einem SQL-Datensatz passt.
    
    Matching-Strategie (in Prioritätsreihenfolge):
    1. CustomerLegacyMapping.sql_id (bereits verknüpft)
    2. Customer.legacy_sql_id (Alt-Verknüpfung, Fallback)
    3. E-Mail-Adresse (sehr zuverlässig)
    4. Nachname + Vorname + PLZ (wenn Vorname vorhanden)
    5. Nachname + PLZ + Firma/Uni (wenn Vorname leer)
    6. Nachname + Vorname allein (nur wenn eindeutig)
    7. Nachname + PLZ allein (nur wenn eindeutig, Fallback für leeren Vorname)
    
    Returns: (customer, match_method) oder (None, None)
    """
    # 1. Bereits über Mapping-Tabelle verknüpft
    if adressen_id:
        mapping = CustomerLegacyMapping.objects.filter(
            sql_id=adressen_id
        ).select_related('customer').first()
        if mapping:
            return mapping.customer, 'legacy_id'

    # 2. Alt-Verknüpfung über legacy_sql_id Feld (Fallback)
    if adressen_id:
        customer = Customer.objects.filter(legacy_sql_id=adressen_id).first()
        if customer:
            return customer, 'legacy_id'

    # 3. E-Mail-Abgleich (sehr zuverlässig)
    if email:
        email_match = CustomerEmail.objects.filter(
            email__iexact=email
        ).select_related('customer').first()
        if email_match:
            return email_match.customer, 'email'

    # 4. Nachname + Vorname + PLZ (wenn Vorname vorhanden)
    if nachname and vorname and plz:
        candidates = Customer.objects.filter(
            last_name__iexact=nachname,
            first_name__iexact=vorname,
            addresses__postal_code=plz,
        ).distinct()
        if candidates.count() == 1:
            return candidates.first(), 'name_plz'

    # 5. Nachname + PLZ + Firma/Uni (wenn Vorname leer)
    if nachname and not vorname and plz and firma_uni:
        candidates = Customer.objects.filter(
            last_name__iexact=nachname,
            addresses__postal_code=plz,
            addresses__university__iexact=firma_uni,
        ).distinct()
        if candidates.count() == 1:
            return candidates.first(), 'name_plz_firma'

    # 6. Nachname + Vorname allein (nur wenn eindeutig)
    if nachname and vorname:
        candidates = Customer.objects.filter(
            last_name__iexact=nachname,
            first_name__iexact=vorname,
        )
        if candidates.count() == 1:
            return candidates.first(), 'name_only'

    # 7. Nachname + PLZ allein (Fallback für leeren Vorname, nur wenn eindeutig)
    if nachname and not vorname and plz:
        candidates = Customer.objects.filter(
            last_name__iexact=nachname,
            addresses__postal_code=plz,
        ).distinct()
        if candidates.count() == 1:
            return candidates.first(), 'name_plz'

    return None, None


def _sync_single_customer(row, created_by_user=None, dry_run=False):
    """
    Synchronisiert einen einzelnen Kunden.
    Returns: 'created', 'updated', oder 'skipped'
    """
    adressen_id = row.get('AdressenID')
    nachname = clean_string(row.get('Nachname', ''))
    vorname = clean_string(row.get('Vorname', ''))

    if not nachname:
        return 'skipped'

    # Anrede/Titel umformen
    anrede_id = _safe_int(row.get('AnredeID'), 1)
    titel_id = _safe_int(row.get('TitelID'), 1)
    land_id = _safe_int(row.get('LandID'), 8)
    englisch = _parse_bool(row.get('Englischsprachig'))
    newsletter = _parse_bool(row.get('Newsletter'))

    anrede_info = ANREDE_MAP.get(anrede_id, ('', ''))
    salutation = anrede_info[0]
    title = build_titel_string(anrede_id, titel_id)
    country_iso = LAND_MAP.get(land_id, 'DE') or 'DE'
    language = get_language(englisch, country_iso)

    # Adressfelder (echte Spaltennamen -> normalisierte Aliase)
    firma_uni = clean_string(row.get('FirmaUni', ''))
    institut = clean_string(row.get('Institut', ''))
    lehrstuhl = clean_string(row.get('Lehrstuhl', ''))
    strasse_raw = clean_string(row.get('Strasse', ''))
    plz = clean_string(row.get('PLZ', ''))
    ort = clean_string(row.get('Ort', ''))
    anfahrt = clean_string(row.get('Anfahrt', ''))

    street, house_number = extract_street_and_number(strasse_raw)

    # Telefonnummern (Ortsnetz + Anschluss)
    ortsnetz = clean_string(row.get('Ortsnetz', ''))
    anschluss1 = combine_phone(ortsnetz, clean_string(row.get('Anschluss1', '')))
    anschluss2 = combine_phone(ortsnetz, clean_string(row.get('Anschluss2', '')))
    anschluss3 = combine_phone(ortsnetz, clean_string(row.get('Anschluss3', '')))
    email = clean_string(row.get('Email', ''))

    # PLZ bereinigen (z.B. 'CH-3000' -> '3000')
    plz_clean = plz
    if plz and '-' in plz:
        parts = plz.split('-', 1)
        if len(parts[0]) <= 3:  # Laenderkuerzel wie 'CH', 'A'
            plz_clean = parts[1]

    # Bestehenden Kunden suchen (mehrstufiges Matching)
    existing, match_method = _find_existing_customer(
        adressen_id, nachname, vorname, email, plz_clean, firma_uni
    )

    if dry_run:
        if existing and match_method == 'legacy_id':
            return 'updated'
        elif existing:
            return 'linked'
        return 'created'

    with transaction.atomic():
        if existing:
            # Legacy-Mapping anlegen falls diese SQL-ID noch nicht verknüpft
            _ensure_legacy_mapping(existing, adressen_id, match_method)

            # -- UPDATE (nur wenn Vorname vorhanden, sonst nicht überschreiben) --
            existing.salutation = salutation
            existing.title = title
            if vorname:
                existing.first_name = vorname[:100]
            existing.last_name = nachname[:100]
            existing.language = language
            existing.save()

            _sync_address(existing, firma_uni, institut, lehrstuhl, street,
                         house_number, anfahrt, plz_clean, ort, country_iso)
            _sync_phones(existing, anschluss1, anschluss2, anschluss3)
            _sync_email(existing, email, newsletter)

            return 'updated' if match_method == 'legacy_id' else 'linked'
        else:
            # -- CREATE --
            customer = Customer(
                legacy_sql_id=adressen_id,
                salutation=salutation,
                title=title,
                first_name=vorname[:100],
                last_name=nachname[:100],
                language=language,
                is_active=True,
                created_by=created_by_user,
            )
            customer.save()

            # Legacy-Mapping für neuen Kunden
            _ensure_legacy_mapping(customer, adressen_id, 'new')

            _sync_address(customer, firma_uni, institut, lehrstuhl, street,
                         house_number, anfahrt, plz_clean, ort, country_iso)
            _sync_phones(customer, anschluss1, anschluss2, anschluss3)
            _sync_email(customer, email, newsletter)

            return 'created'


def _ensure_legacy_mapping(customer, adressen_id, match_method):
    """
    Stellt sicher, dass ein CustomerLegacyMapping für diese SQL-ID existiert.
    Erlaubt mehrere Legacy-IDs pro Kunde (z.B. bei gemergten SQL-Adressen).
    """
    if not adressen_id:
        return

    mapping, created = CustomerLegacyMapping.objects.get_or_create(
        sql_id=adressen_id,
        defaults={'customer': customer}
    )

    if created:
        logger.info(
            f"Kunde {customer.customer_number} ({customer.last_name}) "
            f"verknüpft mit AdressenID {adressen_id} (via {match_method})"
        )

    # Primäre legacy_sql_id auf dem Customer setzen (erste ID gewinnt)
    if not customer.legacy_sql_id:
        customer.legacy_sql_id = adressen_id
        customer.save(update_fields=['legacy_sql_id'])


def _sync_address(customer, firma_uni, institut, lehrstuhl, street, house_number,
                  anfahrt, plz, ort, country_iso):
    """Synchronisiert die Hauptadresse eines Kunden."""
    university = firma_uni[:200] if firma_uni else ''
    institute = institut[:200] if institut else ''
    department = lehrstuhl[:200] if lehrstuhl else ''

    address = CustomerAddress.objects.filter(
        customer=customer,
        address_type='Office'
    ).first()

    fields = dict(
        university=university,
        institute=institute,
        department=department,
        street=street[:200] if street else '',
        house_number=house_number[:20] if house_number else '',
        address_supplement='',
        postal_code=plz[:20] if plz else '',
        city=ort[:100] if ort else '',
        country=country_iso or 'DE',
        directions=anfahrt[:500] if anfahrt else '',
    )

    if address:
        for key, val in fields.items():
            setattr(address, key, val)
        address.save()
    else:
        CustomerAddress.objects.create(
            customer=customer,
            address_type='Office',
            is_active=True,
            **fields,
        )


def _sync_phones(customer, anschluss1, anschluss2, anschluss3):
    """Synchronisiert Telefonnummern eines Kunden."""
    phones_to_sync = []
    if anschluss1:
        phones_to_sync.append(('Büro', anschluss1[:50], True))
    if anschluss2:
        phones_to_sync.append(('Büro', anschluss2[:50], False))
    if anschluss3:
        phones_to_sync.append(('Lab', anschluss3[:50], False))

    existing_numbers = set(
        customer.phones.values_list('phone_number', flat=True)
    )

    for phone_type, number, is_primary in phones_to_sync:
        if number and number not in existing_numbers:
            if is_primary and customer.phones.filter(is_primary=True).exists():
                is_primary = False
            try:
                CustomerPhone.objects.create(
                    customer=customer,
                    phone_type=phone_type,
                    phone_number=number,
                    is_primary=is_primary,
                )
            except Exception as e:
                logger.warning(f"Telefon '{number}' fuer {customer}: {e}")


def _sync_email(customer, email, newsletter=False):
    """Synchronisiert die E-Mail-Adresse eines Kunden inkl. Newsletter-Status."""
    if not email:
        return

    email = email[:254]

    # Pruefe ob E-Mail schon vorhanden
    existing_email = customer.emails.filter(email__iexact=email).first()
    if existing_email:
        # Newsletter-Status aktualisieren
        if newsletter and not existing_email.newsletter_consent:
            existing_email.newsletter_consent = newsletter
            existing_email.save()
        return

    has_primary = customer.emails.filter(is_primary=True).exists()

    try:
        CustomerEmail.objects.create(
            customer=customer,
            email=email,
            is_primary=not has_primary,
            newsletter_consent=newsletter,
        )
    except Exception as e:
        logger.warning(f"Email '{email}' fuer {customer}: {e}")


# --- Sequenz-Reparatur ---

def reset_customer_sequences():
    """
    Repariert PostgreSQL Auto-Increment-Sequenzen fuer alle Kunden-Tabellen.
    Noetig nach Bulk-Imports die explizite IDs gesetzt haben.
    """
    tables = [
        'customers_customer',
        'customers_customeraddress',
        'customers_customerphone',
        'customers_customeremail',
        'customers_contacthistory',
        'customers_customerlegacymapping',
    ]
    with connection.cursor() as cursor:
        for table in tables:
            try:
                cursor.execute(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {table}), 1)
                    )
                """)
                logger.info(f"Sequenz fuer {table} zurueckgesetzt")
            except Exception as e:
                logger.warning(f"Sequenz-Reset fuer {table} fehlgeschlagen: {e}")


# --- Status ---

def get_sync_status():
    """Gibt den aktuellen Sync-Status zurueck."""
    total_customers = Customer.objects.count()
    # Kunden die mindestens ein Legacy-Mapping haben
    linked_customers = Customer.objects.filter(
        legacy_mappings__isnull=False
    ).distinct().count()
    unlinked_customers = total_customers - linked_customers
    total_mappings = CustomerLegacyMapping.objects.count()

    return {
        'total_customers': total_customers,
        'linked_to_sql': linked_customers,
        'unlinked': unlinked_customers,
        'total_mappings': total_mappings,
    }
