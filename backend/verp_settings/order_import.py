"""
Legacy-Auftragsimport aus externer SQL Server Datenbank (VSDB).

Liest Auftraege, Angebote, AuftragsPositionen, Adressen und Mitarbeiter
aus der SQL-Datenbank und importiert sie als CustomerOrder / CustomerOrderItem
in VERP. Nutzt die gleiche Verbindungslogik wie die Kundendaten-Synchronisation.

Auftragsnummer-Format:
  O-XXX-MM/YY  (Legacy, Schraegstrich)
  Erste Auftragsnummer eines Jahres: O-101-MM/YY
  Fortlaufend pro Kalenderjahr in der Reihenfolge des Auftragsdatums.

Datenquellen in SQL (bzw. Access-Export):
  - Auftraege:           Auftragskopfdaten (AuftragsID, AngebotNummer, Jahr, etc.)
  - Angebote:            Angebotsdaten mit Versionen (AngebotID, AngebotNummer, VersionsNummer)
  - AuftragsPositionen:  Positionen (verknuepft ueber AngebotID = AuftragsID)
  - Adressen:            Kundenzuordnung (AdressenID)
  - Mitarbeiter:         Verkaeufer/Verwaltung-Mapping

WICHTIG bei Angeboten:
  - Ein Angebot kann mehrere Versionen haben (gleiche AngebotNummer, verschiedene VersionsNummer)
  - Nur eine Version wird zum Auftrag -> Die Version mit dem passenden AngebotID == AuftragsID.ReferenzID
  - Oder: Der Auftrag verweist direkt ueber AuftragsID auf die Positionen (AuftragsPositionen.AngebotID)
"""
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from collections import defaultdict

from django.db import transaction
from django.contrib.auth import get_user_model

from customers.models import Customer, CustomerLegacyMapping
from customer_orders.models import CustomerOrder, CustomerOrderItem, CustomerOrderCommissionRecipient
from verp_settings.models import PaymentTerm, DeliveryTerm, WarrantyTerm
from .customer_sync import get_mssql_connection, LAND_MAP

logger = logging.getLogger(__name__)
User = get_user_model()


# ============================================================================
# Konstanten
# ============================================================================

# Mitarbeiter-Mapping: Legacy MitarbeiterID -> Username
MITARBEITER_MAPPING = {
    0: None,
    1: 'wurm',
    2: 'kuehn',
    3: 'waltinger',
    4: 'busch',
    5: 'gulde',
    6: 'willberg',
    7: 'draude',
    8: 'guckler',
}

# Status fuer importierte Legacy-Auftraege
IMPORT_STATUS = 'abgeschlossen'


# ============================================================================
# SQL-Abfragen
# ============================================================================

def _get_table_columns(connection, table_name):
    """Liest alle Spaltennamen einer Tabelle."""
    cursor = connection.cursor()
    try:
        cursor.execute("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = ?
        """, (table_name,))
        return [row[0] for row in cursor.fetchall()]
    finally:
        cursor.close()


def _table_exists(connection, table_name):
    """Prueft ob eine Tabelle in der Datenbank existiert."""
    cursor = connection.cursor()
    try:
        cursor.execute("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = ?
        """, (table_name,))
        return cursor.fetchone()[0] > 0
    finally:
        cursor.close()


def _safe_col(col_map, name):
    """Case-insensitives Spalten-Lookup."""
    lower_map = {k.lower(): k for k in col_map}
    return lower_map.get(name.lower())


def _build_select(columns, alias='a'):
    """Baut SELECT-Ausdruck aus Spaltenliste."""
    return ', '.join([f'{alias}.[{c}]' for c in columns])


def fetch_auftraege(connection, limit=None):
    """Liest alle Auftraege aus der SQL-Datenbank."""
    cursor = connection.cursor()
    try:
        query = "SELECT * FROM [Aufträge] ORDER BY [Auftragsdatum]"
        if limit:
            # SQL Server OFFSET/FETCH
            query = (
                "SELECT * FROM [Aufträge] "
                "ORDER BY [Auftragsdatum] "
                f"OFFSET 0 ROWS FETCH NEXT {int(limit)} ROWS ONLY"
            )
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        rows = []
        for row in cursor.fetchall():
            rows.append(dict(zip(columns, row)))
        logger.info(f"Auftraege gelesen: {len(rows)}")
        return rows
    finally:
        cursor.close()


def fetch_angebote(connection):
    """Liest alle Angebote aus der SQL-Datenbank."""
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT * FROM [Angebote] ORDER BY [AngebotID]")
        columns = [desc[0] for desc in cursor.description]
        rows = []
        for row in cursor.fetchall():
            rows.append(dict(zip(columns, row)))
        logger.info(f"Angebote gelesen: {len(rows)}")
        return rows
    finally:
        cursor.close()


def fetch_auftragspositionen(connection):
    """Liest alle AuftragsPositionen aus der SQL-Datenbank."""
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT * FROM [AuftragsPositionen] ORDER BY [AngebotID], [PositionsNr]")
        columns = [desc[0] for desc in cursor.description]
        rows = []
        for row in cursor.fetchall():
            rows.append(dict(zip(columns, row)))
        logger.info(f"AuftragsPositionen gelesen: {len(rows)}")
        return rows
    finally:
        cursor.close()


def fetch_adressen(connection):
    """Liest alle Adressen aus der SQL-Datenbank."""
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT * FROM [Adressen] ORDER BY [AdressenID]")
        columns = [desc[0] for desc in cursor.description]
        rows = []
        for row in cursor.fetchall():
            rows.append(dict(zip(columns, row)))
        logger.info(f"Adressen gelesen: {len(rows)}")
        return rows
    finally:
        cursor.close()


def fetch_mitarbeiter(connection):
    """Liest Mitarbeiter-Tabelle aus der SQL-Datenbank."""
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT * FROM [Mitarbeiter] ORDER BY [MitarbeiterID]")
        columns = [desc[0] for desc in cursor.description]
        rows = []
        for row in cursor.fetchall():
            rows.append(dict(zip(columns, row)))
        logger.info(f"Mitarbeiter gelesen: {len(rows)}")
        return rows
    finally:
        cursor.close()


def fetch_produkte(connection):
    """Liest Produkte aus der SQL-Datenbank (fuer Artikelname/Kennung)."""
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT * FROM [Produkte] ORDER BY [ProduktID]")
        columns = [desc[0] for desc in cursor.description]
        rows = []
        for row in cursor.fetchall():
            rows.append(dict(zip(columns, row)))
        logger.info(f"Produkte gelesen: {len(rows)}")
        return rows
    except Exception:
        logger.warning("Tabelle 'Produkte' nicht gefunden, Produkt-Lookup nicht verfuegbar")
        return []
    finally:
        cursor.close()


# ============================================================================
# Hilfsfunktionen
# ============================================================================

def _parse_decimal(value):
    """Parst Dezimalzahl (deutsche oder englische Schreibweise)."""
    if value is None:
        return Decimal('0')
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    try:
        s = str(value).strip()
        if not s:
            return Decimal('0')
        # Deutsche Notation: 1.234,56 -> 1234.56
        if ',' in s:
            s = s.replace('.', '').replace(',', '.')
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return Decimal('0')


def _parse_date(value):
    """Parst ein Datum aus verschiedenen Formaten."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if hasattr(value, 'date'):
        return value.date() if callable(getattr(value, 'date', None)) else value
    try:
        s = str(value).strip()
        if not s:
            return None
        for fmt in ['%d.%m.%Y', '%d.%m.%y', '%Y-%m-%d']:
            try:
                dt = datetime.strptime(s, fmt)
                if dt.year < 100:
                    dt = dt.replace(year=dt.year + 1900 if dt.year >= 90 else dt.year + 2000)
                return dt.date()
            except ValueError:
                continue
        return None
    except Exception:
        return None


def _parse_bool(value):
    """Parst Boolean-Wert aus verschiedenen Darstellungen."""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    s = str(value).strip().upper()
    return s in ('WAHR', 'TRUE', '1', 'JA', 'YES')


def _clean_text(value):
    """Bereinigt mehrzeiligen Text."""
    if value is None:
        return ''
    text = str(value).strip()
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    return '\n'.join(lines)


def _safe_int(value, default=0):
    """Sicheres Parsen einer Ganzzahl."""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


# ============================================================================
# Auftragsnummer-Generierung
# ============================================================================

def generate_legacy_order_numbers(auftraege):
    """
    Generiert die Auftragsnummern fuer Legacy-Auftraege.

    Format: O-XXX-MM/YY
    - XXX: Fortlaufend pro Kalenderjahr, startet bei 101
    - MM: Monat des Auftragsdatums
    - YY: Jahr des Auftragsdatums (2-stellig)

    Die Nummerierung ist sortiert nach Auftragsdatum innerhalb eines Jahres.
    """
    # Sortiere nach Auftragsdatum
    def get_order_date(row):
        d = _parse_date(row.get('Auftragsdatum'))
        if d:
            return d
        # Fallback: Datum-Feld
        d = _parse_date(row.get('Datum'))
        if d:
            return d
        # Fallback aus Jahr-Feld
        jahr = _safe_int(row.get('Jahr'))
        if jahr:
            return datetime(jahr, 1, 1).date()
        return datetime(1990, 1, 1).date()

    sorted_orders = sorted(auftraege, key=get_order_date)

    # Zaehler pro Kalenderjahr
    year_counters = defaultdict(int)
    order_numbers = {}  # AuftragsID -> order_number

    for row in sorted_orders:
        auftrags_id = row.get('AuftragsID')
        order_date = get_order_date(row)
        year = order_date.year
        month = order_date.month

        # Zaehler hochzaehlen
        year_counters[year] += 1
        counter = 100 + year_counters[year]  # Startet bei 101

        # 2-stelliges Jahr
        yy = str(year)[-2:]
        mm = f'{month:02d}'

        # Legacy-Format mit Schraegstrich
        order_number = f'O-{counter:03d}-{mm}/{yy}'

        order_numbers[auftrags_id] = {
            'order_number': order_number,
            'order_date': order_date,
            'sequence': year_counters[year],
        }

    return order_numbers


# ============================================================================
# Kunden-Matching
# ============================================================================

def find_customer_for_address(adressen_id):
    """
    Findet einen VERP-Kunden anhand der Legacy-AdressenID.
    Nutzt das CustomerLegacyMapping aus der Kundensynchronisation.
    """
    # Zuerst: LegacyMapping (praeziseste Methode)
    try:
        mapping = CustomerLegacyMapping.objects.get(sql_id=adressen_id)
        return mapping.customer
    except CustomerLegacyMapping.DoesNotExist:
        pass

    # Fallback: Customer.legacy_sql_id
    try:
        customer = Customer.objects.get(legacy_sql_id=adressen_id)
        return customer
    except Customer.DoesNotExist:
        pass
    except Customer.MultipleObjectsReturned:
        return Customer.objects.filter(legacy_sql_id=adressen_id).first()

    return None


# ============================================================================
# Verbindungstest
# ============================================================================

def test_order_import_connection(server, database='VSDB', use_dsn=False, dsn_name=None):
    """
    Testet die Verbindung und prueft ob die noetige Tabellen existieren.
    Gibt Statistiken zurueck.
    """
    conn = get_mssql_connection(server, database, use_dsn, dsn_name)
    cursor = conn.cursor()

    try:
        result = {
            'success': True,
            'tables': {},
        }

        required_tables = ['Aufträge', 'AuftragsPositionen', 'Angebote', 'Adressen', 'Mitarbeiter']
        optional_tables = ['Produkte', 'Positionen']

        for table in required_tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM [{table}]")
                count = cursor.fetchone()[0]
                result['tables'][table] = {'exists': True, 'count': count}
            except Exception as e:
                result['tables'][table] = {'exists': False, 'error': str(e)}
                result['success'] = False

        for table in optional_tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM [{table}]")
                count = cursor.fetchone()[0]
                result['tables'][table] = {'exists': True, 'count': count, 'optional': True}
            except Exception:
                result['tables'][table] = {'exists': False, 'optional': True}

        # Zusammenfassung
        if result['success']:
            auftraege_count = result['tables'].get('Aufträge', {}).get('count', 0)
            positionen_count = result['tables'].get('AuftragsPositionen', {}).get('count', 0)
            result['summary'] = (
                f"{auftraege_count} Aufträge und {positionen_count} Positionen in der Datenbank"
            )

        return result
    finally:
        cursor.close()
        conn.close()


# ============================================================================
# Auftragsimport-Status
# ============================================================================

def get_order_import_status():
    """Gibt den aktuellen Import-Status zurueck."""
    total_orders = CustomerOrder.objects.count()
    legacy_orders = CustomerOrder.objects.filter(
        order_number__startswith='O-',
        order_number__contains='/'
    ).count()
    non_legacy_orders = total_orders - legacy_orders

    return {
        'total_orders': total_orders,
        'legacy_orders': legacy_orders,
        'non_legacy_orders': non_legacy_orders,
    }


# ============================================================================
# Vorschau (Dry-Run)
# ============================================================================

def preview_order_import(server, database='VSDB', use_dsn=False, dsn_name=None, limit=50):
    """
    Erstellt eine Vorschau des Auftragsimports (Dry-Run).
    """
    conn = get_mssql_connection(server, database, use_dsn, dsn_name)

    try:
        # Daten laden
        auftraege = fetch_auftraege(conn, limit=limit if limit else None)
        positionen = fetch_auftragspositionen(conn)
        adressen = fetch_adressen(conn)

        # Lookups erstellen
        address_lookup = {row.get('AdressenID'): row for row in adressen}
        positions_by_auftrags_id = defaultdict(list)
        for pos in positionen:
            ref = pos.get('AngebotID')
            if ref is not None:
                positions_by_auftrags_id[ref].append(pos)

        # Auftragsnummern generieren
        order_numbers = generate_legacy_order_numbers(auftraege)

        # Bestehende Auftraege pruefen
        existing_orders = set(CustomerOrder.objects.values_list('order_number', flat=True))

        # Vorschau erstellen
        preview_items = []
        stats = {
            'total_in_sql': len(auftraege),
            'would_import': 0,
            'would_import_no_customer': 0,
            'would_skip_exists': 0,
            'would_skip_no_items': 0,
            'total_items': 0,
        }

        for row in auftraege:
            auftrags_id = row.get('AuftragsID')
            nr_info = order_numbers.get(auftrags_id, {})
            order_number = nr_info.get('order_number', '?')
            order_date = nr_info.get('order_date')

            # Bereits importiert?
            already_exists = order_number in existing_orders

            # Kunde finden
            adressen_id = _safe_int(row.get('AdressenID'))
            customer = find_customer_for_address(adressen_id) if adressen_id else None
            addr_data = address_lookup.get(adressen_id, {})

            # Positionen zaehlen
            item_count = len(positions_by_auftrags_id.get(auftrags_id, []))

            # Gesamtpreis
            gesamtpreis = _parse_decimal(row.get('Gesamtpreis', 0))

            if already_exists:
                action = 'exists'
                stats['would_skip_exists'] += 1
            elif item_count == 0:
                action = 'no_items'
                stats['would_skip_no_items'] += 1
            elif not customer:
                action = 'import_no_customer'
                stats['would_import_no_customer'] += 1
                stats['total_items'] += item_count
            else:
                action = 'import'
                stats['would_import'] += 1
                stats['total_items'] += item_count

            firma = addr_data.get('Firma/Uni', '') or ''
            name = addr_data.get('Name', '') or ''

            preview_items.append({
                'auftrags_id': auftrags_id,
                'order_number': order_number,
                'order_date': str(order_date) if order_date else '',
                'angebot_nummer': row.get('AngebotNummer', ''),
                'jahr': row.get('Jahr', ''),
                'customer_name': str(customer) if customer else f'{firma} / {name}'.strip(' /'),
                'customer_number': customer.customer_number if customer else '',
                'customer_matched': customer is not None,
                'adressen_id': adressen_id,
                'gesamtpreis': str(gesamtpreis),
                'item_count': item_count,
                'action': action,
                'kurzbeschreibung': str(row.get('Kurzbeschreibung', '') or ''),
            })

        return {
            'stats': stats,
            'preview_items': preview_items,
        }

    finally:
        conn.close()


# ============================================================================
# Auftragsimport (Live)
# ============================================================================

def import_orders_from_sql(server, database='VSDB', use_dsn=False, dsn_name=None,
                           created_by_user=None, dry_run=False):
    """
    Importiert Legacy-Auftraege aus der SQL-Datenbank.

    Args:
        server: SQL Server Hostname
        database: Datenbankname
        use_dsn: System-DSN verwenden
        dsn_name: DSN-Name
        created_by_user: Django-User fuer created_by
        dry_run: Nur simulieren

    Returns:
        dict mit Import-Statistiken
    """
    from users.models import Employee
    
    conn = get_mssql_connection(server, database, use_dsn, dsn_name)

    try:
        # ================================================================
        # Daten aus SQL laden
        # ================================================================
        logger.info("Lade Daten aus SQL-Datenbank...")
        auftraege = fetch_auftraege(conn)
        positionen = fetch_auftragspositionen(conn)
        adressen = fetch_adressen(conn)
        
        # Mitarbeiter aus SQL laden
        try:
            mitarbeiter_sql = fetch_mitarbeiter(conn)
            logger.info(f"Mitarbeiter aus SQL geladen: {len(mitarbeiter_sql)}")
        except Exception as e:
            logger.warning(f"Konnte Mitarbeiter-Tabelle nicht laden: {e}")
            mitarbeiter_sql = []

        # Optionale Tabellen
        try:
            produkte = fetch_produkte(conn)
        except Exception:
            produkte = []

        # ================================================================
        # Lookups aufbauen
        # ================================================================
        # Mitarbeiter-Lookup: SQL MitarbeiterID -> Employee 
        employee_lookup = {}
        if mitarbeiter_sql:
            # Alle Employees aus VERP laden
            verp_employees = {}
            for emp in Employee.objects.all():
                # Normalisierte Namen als Key (lowercase, keine Leerzeichen)
                key = f"{emp.first_name.lower().strip()} {emp.last_name.lower().strip()}"
                verp_employees[key] = emp
            
            # SQL-Mitarbeiter auf VERP-Employees mappen
            for mit in mitarbeiter_sql:
                mit_id = mit.get('MitarbeiterID')
                vorname = str(mit.get('Vorname', '') or '').strip()
                nachname = str(mit.get('Name', '') or '').strip()
                
                if vorname and nachname:
                    key = f"{vorname.lower()} {nachname.lower()}"
                    verp_emp = verp_employees.get(key)
                    if verp_emp:
                        employee_lookup[mit_id] = verp_emp
                        logger.info(f"Mitarbeiter gemappt: SQL ID {mit_id} ({vorname} {nachname}) -> VERP Employee {verp_emp.employee_id}")
                    else:
                        logger.warning(f"Kein VERP-Employee gefunden für SQL-Mitarbeiter ID {mit_id}: {vorname} {nachname}")
            
            logger.info(f"Employee-Lookup aufgebaut: {len(employee_lookup)} Mitarbeiter gemappt")
        else:
            logger.warning("Keine Mitarbeiter-Daten aus SQL verfügbar - verwende Fallback-Mapping")
            # Fallback: Hartkodiertes Mapping über Username
            users = {u.username.lower(): u for u in User.objects.all()}
            for mit_id, username in MITARBEITER_MAPPING.items():
                if username:
                    user = users.get(username)
                    if user and user.employee:
                        employee_lookup[mit_id] = user.employee
        
        address_lookup = {row.get('AdressenID'): row for row in adressen}

        positions_by_auftrags_id = defaultdict(list)
        for pos in positionen:
            ref = pos.get('AngebotID')
            if ref is not None:
                positions_by_auftrags_id[ref].append(pos)

        produkt_lookup = {}
        for prod in produkte:
            prod_id = prod.get('ProduktID')
            if prod_id is not None:
                produkt_lookup[prod_id] = {
                    'artikel': str(prod.get('Artikel', '') or '').strip(),
                    'kennung': str(prod.get('Kennung', '') or '').strip(),
                    'beschreibung': str(prod.get('ProduktBeschreibung', '') or '').strip(),
                }

        # ================================================================
        # Auftragsnummern generieren
        # ================================================================
        order_numbers = generate_legacy_order_numbers(auftraege)

        # ================================================================
        # VERP-Referenzdaten laden
        # ================================================================
        users = {u.username.lower(): u for u in User.objects.all()}
        existing_orders = set(CustomerOrder.objects.values_list('order_number', flat=True))

        # ================================================================
        # Import durchfuehren
        # ================================================================
        stats = {
            'total': len(auftraege),
            'imported': 0,
            'imported_no_customer': 0,
            'skipped_exists': 0,
            'skipped_no_items': 0,
            'errors': 0,
            'items_created': 0,
        }
        errors = []

        for row in auftraege:
            auftrags_id = row.get('AuftragsID')
            nr_info = order_numbers.get(auftrags_id, {})
            order_number = nr_info.get('order_number')

            if not order_number:
                stats['errors'] += 1
                errors.append(f"Keine Auftragsnummer fuer AuftragsID {auftrags_id}")
                continue

            # Bereits importiert?
            if order_number in existing_orders:
                stats['skipped_exists'] += 1
                continue

            # Kunde finden
            adressen_id = _safe_int(row.get('AdressenID'))
            customer = find_customer_for_address(adressen_id) if adressen_id else None

            # Positionen
            order_positions = positions_by_auftrags_id.get(auftrags_id, [])
            if not order_positions:
                stats['skipped_no_items'] += 1
                continue

            # Auftragsdaten parsen
            order_date = _parse_date(row.get('Auftragsdatum'))
            confirmation_date = _parse_date(row.get('Datum'))

            # Mitarbeiter-Zuordnung
            verkaeufer_id = _safe_int(row.get('VerkäuferID'))
            verwaltung_id = _safe_int(row.get('VerwaltungID'))
            
            # Employee-Lookup (direkt)
            sales_employee = employee_lookup.get(verkaeufer_id)
            creator_employee = employee_lookup.get(verwaltung_id)
            
            # Sales-Person und Creator (User) ermitteln
            sales_person = None
            creator = None
            
            if sales_employee:
                # User des Employees finden (falls vorhanden)
                sales_person = sales_employee.users.first() if sales_employee.users.exists() else None
            
            if creator_employee:
                creator = creator_employee.users.first() if creator_employee.users.exists() else None
            
            # Fallback: created_by_user
            if not creator:
                creator = created_by_user

            # Adressen
            confirmation_addr = _clean_text(row.get('Bestätigungadresse', ''))
            shipping_addr = _clean_text(row.get('Lieferadresse', ''))
            billing_addr = _clean_text(row.get('Rechnungsadresse', ''))

            # MwSt
            tax_enabled = _parse_bool(row.get('MwSt', True))
            tax_rate = _parse_decimal(row.get('MwStProzent', 15))
            if tax_rate == 0 and tax_enabled:
                tax_rate = Decimal('15')

            # Lieferzeit
            delivery_weeks = _safe_int(row.get('Lieferzeitraum', 0))

            # Notizen
            absprachen = _clean_text(row.get('Absprachen', ''))
            kommentar = _clean_text(row.get('Kommentar', ''))
            notes_parts = []
            if kommentar:
                notes_parts.append(f"Kommentar: {kommentar}")

            # Bestellnummer
            customer_order_number = str(row.get('Auftragsbestellnummer', '') or '').strip()
            customer_contact = str(row.get('Auftragsname', '') or '').strip()

            # Kurzbeschreibung als Referenz
            kurzbeschreibung = str(row.get('Kurzbeschreibung', '') or '').strip()

            # Legacy-Kundeninfos aus Adressdaten aufbereiten
            addr_data = address_lookup.get(adressen_id, {})
            legacy_company = str(addr_data.get('Firma/Uni', '') or '').strip()
            legacy_name_parts = []
            vorname = str(addr_data.get('Vorname', '') or '').strip()
            nachname = str(addr_data.get('Name', '') or '').strip()
            if vorname:
                legacy_name_parts.append(vorname)
            if nachname:
                legacy_name_parts.append(nachname)
            legacy_name = ' '.join(legacy_name_parts)

            legacy_addr_parts = []
            strasse = str(addr_data.get('Straße', '') or addr_data.get('Strasse', '') or '').strip()
            plz = str(addr_data.get('PLZ', '') or '').strip()
            ort = str(addr_data.get('Ort', '') or '').strip()
            land_raw = str(addr_data.get('Land', '') or '').strip()
            land = LAND_MAP.get(land_raw, land_raw) if land_raw else ''
            if strasse:
                legacy_addr_parts.append(strasse)
            if plz or ort:
                legacy_addr_parts.append(f"{plz} {ort}".strip())
            if land:
                legacy_addr_parts.append(land)
            legacy_address = '\n'.join(legacy_addr_parts)

            if not customer:
                stats['imported_no_customer'] += 1

            if not dry_run:
                try:
                    with transaction.atomic():
                        order = CustomerOrder.objects.create(
                            order_number=order_number,
                            status=IMPORT_STATUS,
                            customer=customer,
                            legacy_customer_name=legacy_name if not customer else '',
                            legacy_customer_company=legacy_company if not customer else '',
                            legacy_customer_address=legacy_address if not customer else '',
                            legacy_adressen_id=adressen_id if not customer else None,
                            quotation=None,
                            customer_order_number=customer_order_number,
                            customer_contact_name=customer_contact,
                            order_date=order_date,
                            confirmation_date=confirmation_date,
                            confirmation_address=confirmation_addr if confirmation_addr else None,
                            shipping_address=shipping_addr if shipping_addr else None,
                            billing_address=billing_addr if billing_addr else None,
                            delivery_time_weeks=delivery_weeks,
                            tax_enabled=tax_enabled,
                            tax_rate=tax_rate,
                            notes='\n\n'.join(notes_parts) if notes_parts else '',
                            order_notes=absprachen,
                            system_reference=kurzbeschreibung,
                            sales_person=sales_person,
                            created_by=creator or created_by_user,
                        )

                        # Provisionsempfaenger: Verkaeufer mit 100% (falls Employee gefunden)
                        if sales_employee:
                            CustomerOrderCommissionRecipient.objects.create(
                                customer_order=order,
                                employee=sales_employee,
                                commission_percentage=Decimal('100.00')
                            )
                            logger.debug(f"Provisionsempfänger gesetzt: {sales_employee} (100%)")
                        elif verkaeufer_id:
                            logger.warning(
                                f"Auftrag {order_number}: VerkäuferID {verkaeufer_id} konnte keinem Employee zugeordnet werden"
                            )

                        # Positionen anlegen
                        for pos_row in order_positions:
                            pos_nr = _safe_int(pos_row.get('PositionsNr'), 1)
                            quantity = _parse_decimal(pos_row.get('Stückzahl', 1))
                            if quantity == 0:
                                quantity = Decimal('1')

                            list_price = _parse_decimal(pos_row.get('Stückpreis', 0))
                            purchase_price = _parse_decimal(pos_row.get('Einkaufspreis', 0))

                            # Produktinfo
                            produkt_id = pos_row.get('ProduktID')
                            produkt_info = produkt_lookup.get(produkt_id, {})
                            position_name = produkt_info.get('artikel', '')
                            article_number = produkt_info.get('kennung', '')
                            produkt_beschreibung = produkt_info.get('beschreibung', '')

                            # Sondervereinbarungen
                            sondervereinbarungen = str(pos_row.get('Sondervereinbarungen', '') or '').strip()

                            # Beschreibung zusammensetzen
                            desc_parts = []
                            if produkt_beschreibung:
                                desc_parts.append(produkt_beschreibung)
                            if sondervereinbarungen:
                                desc_parts.append(sondervereinbarungen)
                            description = '\n'.join(desc_parts)

                            # Fallback Name
                            if not position_name:
                                position_name = sondervereinbarungen[:100] if sondervereinbarungen else f'Position {pos_nr}'

                            # Seriennummer bereinigen
                            serial = str(pos_row.get('SerienNr', '') or '').strip()
                            if serial and all(c in '.· ' for c in serial):
                                serial = ''

                            # Liefer-/Rechnungsnummer
                            delivery_nr = _safe_int(pos_row.get('LieferNr'), 1)
                            invoice_nr = _safe_int(pos_row.get('RechnungNr'), 1)

                            CustomerOrderItem.objects.create(
                                order=order,
                                position=pos_nr,
                                position_display=str(pos_nr),
                                article_number=article_number,
                                name=position_name,
                                description=description,
                                purchase_price=purchase_price,
                                list_price=list_price,
                                final_price=list_price,
                                quantity=quantity,
                                unit='Stück',
                                currency='DEM',
                                delivery_note_number=delivery_nr,
                                invoice_number=invoice_nr,
                                serial_number=serial,
                                is_delivered=True,
                                is_invoiced=True,
                            )
                            stats['items_created'] += 1

                        existing_orders.add(order_number)
                        stats['imported'] += 1

                except Exception as e:
                    logger.error(f"Fehler bei Auftrag {order_number}: {e}")
                    stats['errors'] += 1
                    errors.append(f"{order_number}: {str(e)}")
            else:
                # Dry-Run
                stats['imported'] += 1
                stats['items_created'] += len(order_positions)

        return {
            'success': True,
            'dry_run': dry_run,
            'stats': stats,
            'errors': errors[:50],  # Max. 50 Fehler
        }

    finally:
        conn.close()
