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
        query = "SELECT * FROM [Aufträge] ORDER BY [AuftragsID]"
        if limit:
            # SQL Server OFFSET/FETCH
            query = (
                "SELECT * FROM [Aufträge] "
                "ORDER BY [AuftragsID] "
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

    Reproduziert die Access-Formel:
        ="O-" & Format([AngebotNummer];"000") & Format([Datum];"-mm/jj")

    - XXX: AngebotNummer aus der SQL-Auftraege-Tabelle (kein eigener Zaehler)
    - MM/YY: Monat/Jahr aus der Datum-Spalte (Bestaetigungsdatum)
    """
    order_numbers = {}

    for row in auftraege:
        auftrags_id = row.get('AuftragsID')
        if not auftrags_id:
            continue

        angebot_nr = _safe_int(row.get('AngebotNummer'))
        if not angebot_nr:
            continue

        # Datum-Spalte fuer MM/YY-Teil
        confirmation_date = _parse_date(row.get('Datum'))
        if not confirmation_date:
            confirmation_date = _parse_date(row.get('Auftragsdatum'))
        if not confirmation_date:
            jahr = _safe_int(row.get('Jahr'))
            if jahr:
                confirmation_date = datetime(jahr, 1, 1).date()
        if not confirmation_date:
            confirmation_date = datetime(1990, 1, 1).date()

        yy = str(confirmation_date.year)[-2:]
        mm = f'{confirmation_date.month:02d}'

        order_number = f'O-{angebot_nr:03d}-{mm}/{yy}'

        order_numbers[auftrags_id] = {
            'order_number': order_number,
            'order_date': confirmation_date,
            'sequence': angebot_nr,
        }

    return order_numbers


def _generate_legacy_order_numbers_old_logic(auftraege):
    """
    Generiert Auftragsnummern nach der ALTEN Import-Logik:
    AngebotNummer (direkt) + Auftragsdatum fuer MM/YY.

    Wird nur fuer den Backfill benoetigt, um Auftraege zuzuordnen die
    mit der alten (Auftragsdatum-basierten) Logik importiert wurden.
    """
    order_numbers = {}

    for row in auftraege:
        auftrags_id = row.get('AuftragsID')
        if not auftrags_id:
            continue

        angebot_nr = _safe_int(row.get('AngebotNummer'))
        if not angebot_nr:
            continue

        # Alte Logik: Auftragsdatum statt Datum fuer MM/YY
        order_date = _parse_date(row.get('Auftragsdatum'))
        if not order_date:
            order_date = _parse_date(row.get('Datum'))
        if not order_date:
            jahr = _safe_int(row.get('Jahr'))
            if jahr:
                order_date = datetime(jahr, 1, 1).date()
        if not order_date:
            order_date = datetime(1990, 1, 1).date()

        yy = str(order_date.year)[-2:]
        mm = f'{order_date.month:02d}'

        order_number = f'O-{angebot_nr:03d}-{mm}/{yy}'

        order_numbers[auftrags_id] = {
            'order_number': order_number,
            'order_date': order_date,
            'sequence': angebot_nr,
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

    Laedt ALLE Auftraege aus SQL, generiert Nummern, und zeigt dann die
    letzten `limit` Auftraege (neueste zuerst) in der Vorschau an.
    So sind Duplikate und Nummernluecken sofort sichtbar.
    """
    conn = get_mssql_connection(server, database, use_dsn, dsn_name)

    try:
        # ALLE Auftraege laden (fuer korrekte Nummernberechnung)
        auftraege = fetch_auftraege(conn, limit=None)
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
            'would_skip_duplicate': 0,
            'would_skip_no_items': 0,
            'total_items': 0,
        }

        for row in auftraege:
            auftrags_id = row.get('AuftragsID')
            nr_info = order_numbers.get(auftrags_id, {})
            order_number = nr_info.get('order_number', '?')
            order_date = nr_info.get('order_date')
            confirmation_date = _parse_date(row.get('Datum'))

            # Bereits importiert?
            already_exists = order_number in existing_orders

            # Duplikat-Erkennung (inhaltlich)
            is_duplicate = False
            if not already_exists:
                adressen_id_check = _safe_int(row.get('AdressenID'))
                customer_check = find_customer_for_address(adressen_id_check) if adressen_id_check else None
                item_count_check = len(positions_by_auftrags_id.get(auftrags_id, []))
                if customer_check and order_date:
                    dup_qs = CustomerOrder.objects.filter(
                        customer=customer_check,
                        order_date=order_date,
                        order_number__startswith='O-',
                    )
                    if confirmation_date:
                        dup_qs = dup_qs.filter(confirmation_date=confirmation_date)
                    existing_dup = dup_qs.first()
                    if existing_dup and existing_dup.items.count() == item_count_check:
                        is_duplicate = True

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
            elif is_duplicate:
                action = 'duplicate'
                stats['would_skip_duplicate'] += 1
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
                'confirmation_date': str(_parse_date(row.get('Datum')) or ''),
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

        # Sortiere Preview-Items chronologisch (nach Datum, dann Auftragsnummer)
        # So werden die neuesten Auftraege am Ende angezeigt
        preview_items.sort(key=lambda x: (x['order_date'] or '', x['order_number']))

        # Nur die letzten N Auftraege in der Vorschau anzeigen (neueste zuletzt)
        # Die Statistiken beziehen sich auf ALLE Auftraege
        if limit and len(preview_items) > limit:
            preview_items = preview_items[-limit:]

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
            'skipped_duplicate': 0,
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

            # Bereits importiert (exakte Nummer)?
            if order_number in existing_orders:
                stats['skipped_exists'] += 1
                continue

            # Duplikat-Erkennung: Pruefen ob ein Auftrag mit gleichem Kunden,
            # gleichem Datum und gleicher Positionsanzahl bereits existiert.
            # Verhindert doppelten Import wenn sich Nummern verschieben.
            adressen_id = _safe_int(row.get('AdressenID'))
            customer = find_customer_for_address(adressen_id) if adressen_id else None
            order_positions = positions_by_auftrags_id.get(auftrags_id, [])

            order_date = _parse_date(row.get('Auftragsdatum'))
            confirmation_date = _parse_date(row.get('Datum'))

            if customer and order_date:
                # Pruefe ob ein Auftrag mit gleichem Kunden und Auftragsdatum existiert
                duplicate_qs = CustomerOrder.objects.filter(
                    customer=customer,
                    order_date=order_date,
                    order_number__startswith='O-',
                )
                if confirmation_date:
                    duplicate_qs = duplicate_qs.filter(confirmation_date=confirmation_date)
                if duplicate_qs.exists():
                    existing_dup = duplicate_qs.first()
                    # Zusaetzlich Positionsanzahl pruefen
                    if existing_dup.items.count() == len(order_positions):
                        stats['skipped_duplicate'] += 1
                        logger.info(
                            f"Duplikat erkannt: {order_number} entspricht bestehendem "
                            f"{existing_dup.order_number} (Kunde: {customer}, Datum: {order_date})"
                        )
                        continue

            if not order_positions:
                stats['skipped_no_items'] += 1
                continue

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
                            legacy_adressen_id=adressen_id,
                            legacy_auftrags_id=auftrags_id,
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


# ============================================================================
# Auftrags-Neuzuordnung (Reassignment)
# ============================================================================

def backfill_legacy_adressen_ids(server, database='VSDB', use_dsn=False, dsn_name=None, dry_run=True):
    """
    Traegt die legacy_adressen_id fuer alle bestehenden Legacy-Auftraege nach,
    bei denen sie fehlt. Liest dazu die Auftraege aus der SQL-Datenbank und
    ordnet sie ueber die generierte Auftragsnummer zu.

    Returns:
        dict mit Statistiken
    """
    conn = get_mssql_connection(server, database, use_dsn, dsn_name)
    try:
        auftraege = fetch_auftraege(conn, limit=None)
    finally:
        conn.close()

    order_numbers = generate_legacy_order_numbers(auftraege)

    # Mapping: order_number -> adressen_id
    number_to_adressen_id = {}
    for auftrags_id, nr_info in order_numbers.items():
        order_number = nr_info.get('order_number')
        if not order_number:
            continue
        # Original-Row finden
        row = next((r for r in auftraege if r.get('AuftragsID') == auftrags_id), None)
        if row:
            aid = _safe_int(row.get('AdressenID'))
            if aid:
                number_to_adressen_id[order_number] = aid

    # Alle Legacy-Auftraege ohne legacy_adressen_id
    orders_missing = CustomerOrder.objects.filter(
        order_number__startswith='O-',
        order_number__contains='/',
        legacy_adressen_id__isnull=True,
    )

    stats = {
        'total_missing': orders_missing.count(),
        'filled': 0,
        'not_in_sql': 0,
    }

    for order in orders_missing:
        aid = number_to_adressen_id.get(order.order_number)
        if aid:
            if not dry_run:
                order.legacy_adressen_id = aid
                order.save(update_fields=['legacy_adressen_id'])
            stats['filled'] += 1
        else:
            stats['not_in_sql'] += 1

    return stats


def backfill_legacy_auftrags_ids(server, database='VSDB', use_dsn=False, dsn_name=None, dry_run=True):
    """
    Traegt die legacy_auftrags_id fuer alle bestehenden Legacy-Auftraege nach.

    Matching-Strategie (mehrstufig):
    1a. Exakter Treffer ueber korrekte order_number (Datum-basiert)
    1b. Exakter Treffer ueber alte order_number (Auftragsdatum-basiert, fuer
        Auftraege die vor der Korrektur importiert wurden)
    2.  Feld-basiertes Matching ueber legacy_adressen_id + Daten
    3.  Customer + system_reference + confirmation_date Matching

    Nur eindeutige Zuordnungen (genau 1 Match) werden uebernommen.

    Returns:
        dict mit Statistiken
    """
    conn = get_mssql_connection(server, database, use_dsn, dsn_name)
    try:
        auftraege = fetch_auftraege(conn, limit=None)
    finally:
        conn.close()

    order_numbers = generate_legacy_order_numbers(auftraege)
    old_order_numbers = _generate_legacy_order_numbers_old_logic(auftraege)

    # SQL-Daten als dict: AuftragsID -> row
    sql_by_id = {r.get('AuftragsID'): r for r in auftraege}

    # Mapping: order_number -> AuftragsID (korrekte Logik)
    number_to_auftrags_id = {}
    for auftrags_id, nr_info in order_numbers.items():
        order_number = nr_info.get('order_number')
        if order_number:
            number_to_auftrags_id[order_number] = auftrags_id

    # Mapping: order_number -> AuftragsID (alte Logik, Auftragsdatum-basiert)
    old_number_to_auftrags_id = {}
    for auftrags_id, nr_info in old_order_numbers.items():
        order_number = nr_info.get('order_number')
        if order_number:
            old_number_to_auftrags_id[order_number] = auftrags_id

    # Alle Legacy-Auftraege
    legacy_orders = list(CustomerOrder.objects.filter(
        order_number__startswith='O-',
        order_number__contains='/',
    ))

    stats = {
        'total_legacy': len(legacy_orders),
        'auftrags_id_filled': 0,
        'adressen_id_filled': 0,
        'already_has_auftrags_id': 0,
        'matched_by_number': 0,
        'matched_by_old_number': 0,
        'matched_by_fields': 0,
        'not_matched': 0,
        'not_matched_numbers': [],
    }

    # Bereits vergebene AuftragsIDs sammeln
    assigned_ids = set()
    for o in legacy_orders:
        if o.legacy_auftrags_id:
            assigned_ids.add(o.legacy_auftrags_id)

    def _assign_id(order, sql_id, stat_key):
        """Hilfsfunktion: Weist einem Auftrag die legacy_auftrags_id zu."""
        order.legacy_auftrags_id = sql_id
        assigned_ids.add(sql_id)
        stats['auftrags_id_filled'] += 1
        stats[stat_key] += 1

        update_fields = ['legacy_auftrags_id']
        if not order.legacy_adressen_id:
            row = sql_by_id.get(sql_id)
            if row:
                aid = _safe_int(row.get('AdressenID'))
                if aid:
                    order.legacy_adressen_id = aid
                    update_fields.append('legacy_adressen_id')
                    stats['adressen_id_filled'] += 1

        if not dry_run:
            order.save(update_fields=update_fields)

    # --- Phase 1a: Korrekte Nummern ---
    unmatched_orders = []
    for order in legacy_orders:
        if order.legacy_auftrags_id:
            stats['already_has_auftrags_id'] += 1
            continue

        sql_id = number_to_auftrags_id.get(order.order_number)
        if sql_id and sql_id not in assigned_ids:
            _assign_id(order, sql_id, 'matched_by_number')
            continue

        unmatched_orders.append(order)

    # --- Phase 1b: Alte Nummern (Auftragsdatum-basiert) ---
    still_unmatched = []
    for order in unmatched_orders:
        sql_id = old_number_to_auftrags_id.get(order.order_number)
        if sql_id and sql_id not in assigned_ids:
            _assign_id(order, sql_id, 'matched_by_old_number')
            continue

        still_unmatched.append(order)

    # --- Phase 2: Feld-basiertes Matching ---
    unassigned_sql = {
        aid: row for aid, row in sql_by_id.items()
        if aid not in assigned_ids
    }

    final_unmatched = []
    for order in still_unmatched:
        best_match = None

        # 2a: legacy_adressen_id + confirmation_date + order_date
        if order.legacy_adressen_id and order.confirmation_date:
            candidates = [
                (aid, row) for aid, row in unassigned_sql.items()
                if _safe_int(row.get('AdressenID')) == order.legacy_adressen_id
                and _parse_date(row.get('Datum')) == order.confirmation_date
                and _parse_date(row.get('Auftragsdatum')) == order.order_date
            ]
            if len(candidates) == 1:
                best_match = candidates[0][0]
            elif len(candidates) > 1:
                kurz_candidates = [
                    (aid, row) for aid, row in candidates
                    if str(row.get('Kurzbeschreibung', '') or '').strip() == (order.system_reference or '').strip()
                ]
                if len(kurz_candidates) == 1:
                    best_match = kurz_candidates[0][0]

            # 2b: nur legacy_adressen_id + confirmation_date
            if not best_match:
                candidates = [
                    (aid, row) for aid, row in unassigned_sql.items()
                    if _safe_int(row.get('AdressenID')) == order.legacy_adressen_id
                    and _parse_date(row.get('Datum')) == order.confirmation_date
                ]
                if len(candidates) == 1:
                    best_match = candidates[0][0]

        # 2c: customer + system_reference + confirmation_date (fuer Auftraege ohne adressen_id)
        if not best_match and order.customer and order.system_reference and order.confirmation_date:
            # Finde AdressenIDs des Kunden
            from customers.models import CustomerLegacyMapping
            mappings = CustomerLegacyMapping.objects.filter(customer=order.customer)
            customer_adr_ids = set(mappings.values_list('sql_id', flat=True))
            if order.customer.legacy_sql_id:
                customer_adr_ids.add(order.customer.legacy_sql_id)

            if customer_adr_ids:
                candidates = [
                    (aid, row) for aid, row in unassigned_sql.items()
                    if _safe_int(row.get('AdressenID')) in customer_adr_ids
                    and _parse_date(row.get('Datum')) == order.confirmation_date
                    and str(row.get('Kurzbeschreibung', '') or '').strip() == (order.system_reference or '').strip()
                ]
                if len(candidates) == 1:
                    best_match = candidates[0][0]

        if best_match:
            _assign_id(order, best_match, 'matched_by_fields')
            if best_match in unassigned_sql:
                del unassigned_sql[best_match]
        else:
            final_unmatched.append(order)

    for order in final_unmatched:
        stats['not_matched'] += 1
        stats['not_matched_numbers'].append(order.order_number)

    stats['not_matched_numbers'] = stats['not_matched_numbers'][:50]
    return stats


def cleanup_duplicate_legacy_orders(dry_run=True):
    """
    Loescht alle Legacy-Auftraege ohne legacy_auftrags_id.

    Nach dem Backfill haben alle echten Auftraege eine legacy_auftrags_id.
    Auftraege OHNE ID sind fehlerhafte Import-Artefakte (falsche Kunden-Zuordnung,
    doppelte Imports, etc.) und haben kein SQL-Pendant.

    Es gibt 7823 Auftraege in der SQL-Datenbank, aber mehr Legacy-Auftraege in VERP.
    Die Differenz sind die fehlerhaften Imports.

    Returns:
        dict mit Cleanup-Statistiken
    """
    # Alle Legacy-Auftraege ohne legacy_auftrags_id = Import-Artefakte
    orphans = list(CustomerOrder.objects.filter(
        order_number__startswith='O-',
        order_number__contains='/',
        legacy_auftrags_id__isnull=True,
    ).select_related('customer').order_by('order_number'))

    # Auftraege MIT legacy_auftrags_id = echte Auftraege
    matched_count = CustomerOrder.objects.filter(
        order_number__startswith='O-',
        order_number__contains='/',
        legacy_auftrags_id__isnull=False,
    ).count()

    stats = {
        'total_orphans': len(orphans),
        'matched_orders': matched_count,
        'to_delete': len(orphans),
        'deleted': 0,
        'details': [],
    }

    for order in orphans:
        pos_count = order.items.count()
        stats['details'].append({
            'order_number': order.order_number,
            'customer': str(order.customer or order.legacy_customer_name or '?'),
            'date': str(order.confirmation_date or ''),
            'system_reference': (order.system_reference or '')[:40],
            'positions': pos_count,
            'reason': 'Keine SQL-AuftragsID nach Backfill',
        })

    # Loeschen
    if not dry_run and orphans:
        pks = [o.pk for o in orphans]
        deleted_count = CustomerOrder.objects.filter(pk__in=pks).delete()[0]
        stats['deleted'] = deleted_count

    stats['details'] = stats['details'][:500]
    return stats


def renumber_legacy_orders(server, database='VSDB', use_dsn=False, dsn_name=None, dry_run=True):
    """
    Korrigiert alle Legacy-Auftragsnummern, -Daten, -AdressenIDs und -Kunden
    basierend auf der SQL-AuftragsID.

    Strategie:
    1. Lade ALLE Auftraege aus SQL
    2. Generiere die korrekten Nummern (deterministisch: Datum + AuftragsID)
    3. Fuer jeden VERP-Auftrag mit legacy_auftrags_id:
       - Korrigiere confirmation_date (aus SQL 'Datum') und order_date (aus SQL 'Auftragsdatum')
       - Korrigiere legacy_adressen_id (aus SQL 'AdressenID')
       - Korrigiere Kunden-Zuordnung (aus CustomerLegacyMapping fuer die korrekte AdressenID)
       - Berechne korrekte Nummer und benenne ggf. um

    Voraussetzung: legacy_auftrags_id muss gesetzt sein (vorher backfill_legacy_auftrags_ids).

    Returns:
        dict mit Renumber-Statistiken
    """
    conn = get_mssql_connection(server, database, use_dsn, dsn_name)
    try:
        auftraege = fetch_auftraege(conn, limit=None)
    finally:
        conn.close()

    order_numbers = generate_legacy_order_numbers(auftraege)

    # AuftragsID -> SQL-Rohdaten
    sql_by_id = {row.get('AuftragsID'): row for row in auftraege}

    # AuftragsID -> korrekte order_number
    correct_numbers = {}
    for auftrags_id, nr_info in order_numbers.items():
        order_number = nr_info.get('order_number')
        if order_number:
            correct_numbers[auftrags_id] = order_number

    # CustomerLegacyMapping: sql_id -> customer_id
    all_mappings = {
        m.sql_id: m.customer_id
        for m in CustomerLegacyMapping.objects.all()
    }
    # Fallback: legacy_sql_id -> customer_id
    legacy_sql_lookup = {}
    for c in Customer.objects.filter(legacy_sql_id__isnull=False).exclude(legacy_sql_id=0):
        if c.legacy_sql_id not in legacy_sql_lookup:
            legacy_sql_lookup[c.legacy_sql_id] = c.pk

    # Alle VERP-Auftraege mit legacy_auftrags_id
    legacy_orders = CustomerOrder.objects.filter(
        legacy_auftrags_id__isnull=False,
    ).select_related('customer').order_by('order_number')

    stats = {
        'total_checked': legacy_orders.count(),
        'already_correct': 0,
        'renamed': 0,
        'dates_corrected': 0,
        'customers_corrected': 0,
        'no_sql_match': 0,
        'errors': [],
        'details': [],
    }

    # Sammle alle noetigen Aenderungen
    renames = []  # [(order_pk, old_number, new_number)]
    date_fixes = []  # [(order_pk, new_confirmation_date, new_order_date)]
    customer_fixes = []  # [(order_pk, new_adressen_id, new_customer_id, old_customer_str, new_customer_str)]

    for order in legacy_orders:
        sql_row = sql_by_id.get(order.legacy_auftrags_id)
        correct_number = correct_numbers.get(order.legacy_auftrags_id)

        if not correct_number or not sql_row:
            stats['no_sql_match'] += 1
            continue

        # Datumskorrektur pruefen
        correct_confirmation_date = _parse_date(sql_row.get('Datum'))
        correct_order_date = _parse_date(sql_row.get('Auftragsdatum'))

        needs_date_fix = False
        if correct_confirmation_date and order.confirmation_date != correct_confirmation_date:
            needs_date_fix = True
        if correct_order_date and order.order_date != correct_order_date:
            needs_date_fix = True

        if needs_date_fix:
            date_fixes.append((order.pk, correct_confirmation_date, correct_order_date))

        # AdressenID und Kunden-Korrektur pruefen
        correct_adressen_id = _safe_int(sql_row.get('AdressenID'))
        if correct_adressen_id and correct_adressen_id != order.legacy_adressen_id:
            correct_customer_id = all_mappings.get(correct_adressen_id) or legacy_sql_lookup.get(correct_adressen_id)
            if correct_customer_id and correct_customer_id != order.customer_id:
                try:
                    new_cust = Customer.objects.get(pk=correct_customer_id)
                    customer_fixes.append((
                        order.pk,
                        correct_adressen_id,
                        correct_customer_id,
                        str(order.customer) if order.customer else '(keiner)',
                        str(new_cust),
                    ))
                except Customer.DoesNotExist:
                    pass
            elif correct_adressen_id != order.legacy_adressen_id:
                # Nur AdressenID korrigieren, Kunde bleibt
                customer_fixes.append((
                    order.pk,
                    correct_adressen_id,
                    None,  # customer_id bleibt
                    str(order.customer) if order.customer else '(keiner)',
                    str(order.customer) if order.customer else '(keiner)',
                ))

        if order.order_number == correct_number:
            stats['already_correct'] += 1
            continue

        renames.append((order.pk, order.order_number, correct_number))

    if not renames and not date_fixes and not customer_fixes:
        stats['renamed'] = 0
        return {
            'success': True,
            'dry_run': dry_run,
            'stats': stats,
            'details': [],
        }

    # Duplikat-Check
    target_numbers = {new for _, _, new in renames}
    source_pks = {pk for pk, _, _ in renames}

    blocked_numbers = set(
        CustomerOrder.objects.filter(
            order_number__in=target_numbers,
        ).exclude(
            pk__in=source_pks,
        ).values_list('order_number', flat=True)
    )

    details = []

    if not dry_run:
        with transaction.atomic():
            # Datumskorrektur
            for pk, conf_date, ord_date in date_fixes:
                update_fields = {}
                if conf_date:
                    update_fields['confirmation_date'] = conf_date
                if ord_date:
                    update_fields['order_date'] = ord_date
                if update_fields:
                    CustomerOrder.objects.filter(pk=pk).update(**update_fields)
                    stats['dates_corrected'] += 1

            # Kunden-/AdressenID-Korrektur
            for pk, new_adr_id, new_cust_id, old_cust, new_cust in customer_fixes:
                update_fields = {'legacy_adressen_id': new_adr_id}
                if new_cust_id:
                    update_fields['customer_id'] = new_cust_id
                    update_fields['legacy_customer_name'] = ''
                    update_fields['legacy_customer_company'] = ''
                    update_fields['legacy_customer_address'] = ''
                CustomerOrder.objects.filter(pk=pk).update(**update_fields)
                stats['customers_corrected'] += 1

            # Phase 1: Temporaere Nummern
            for pk, old_number, new_number in renames:
                if new_number in blocked_numbers:
                    stats['errors'].append(
                        f"{old_number} -> {new_number}: Zielnummer bereits vergeben"
                    )
                    continue

                temp_number = f"_RENAME_{pk}"
                CustomerOrder.objects.filter(pk=pk).update(order_number=temp_number)

            # Phase 2: Korrekte Nummern
            for pk, old_number, new_number in renames:
                if new_number in blocked_numbers:
                    continue

                temp_number = f"_RENAME_{pk}"
                try:
                    CustomerOrder.objects.filter(pk=pk, order_number=temp_number).update(
                        order_number=new_number
                    )
                    stats['renamed'] += 1
                    details.append({
                        'old_number': old_number,
                        'new_number': new_number,
                    })
                except Exception as e:
                    stats['errors'].append(f"{old_number} -> {new_number}: {str(e)}")
                    CustomerOrder.objects.filter(pk=pk, order_number=temp_number).update(
                        order_number=old_number
                    )
    else:
        # Dry-run
        stats['dates_corrected'] = len(date_fixes)
        stats['customers_corrected'] = len(customer_fixes)

        for pk, old_number, new_number in renames:
            if new_number in blocked_numbers:
                stats['errors'].append(
                    f"{old_number} -> {new_number}: Zielnummer bereits vergeben"
                )
                continue

            stats['renamed'] += 1
            details.append({
                'old_number': old_number,
                'new_number': new_number,
            })

    # Kunden-Korrekturen als eigene Detail-Liste
    customer_details = []
    for pk, new_adr_id, new_cust_id, old_cust, new_cust in customer_fixes:
        if new_cust_id:
            customer_details.append({
                'order_pk': pk,
                'old_customer': old_cust,
                'new_customer': new_cust,
                'adressen_id': new_adr_id,
            })

    return {
        'success': True,
        'dry_run': dry_run,
        'stats': stats,
        'details': details[:200],
        'customer_details': customer_details[:100],
        'total_renames': len(renames),
        'total_date_fixes': len(date_fixes),
        'total_customer_fixes': len(customer_fixes),
        'blocked': len(blocked_numbers),
    }


def reassign_legacy_orders(dry_run=True):
    """
    Ordnet Legacy-Auftraege, die keinem oder einem falschen Kunden zugeordnet sind,
    anhand des CustomerLegacyMapping neu zu.

    Voraussetzung: legacy_adressen_id muss gesetzt sein (ggf. vorher backfill ausfuehren).

    Returns:
        dict mit Reassignment-Statistiken
    """
    stats = {
        'total_checked': 0,
        'reassigned': 0,
        'newly_assigned': 0,
        'already_correct': 0,
        'no_mapping': 0,
        'no_adressen_id': 0,
        'errors': [],
        'details': [],
    }

    # Alle Legacy-Auftraege
    legacy_orders = CustomerOrder.objects.filter(
        order_number__startswith='O-',
        order_number__contains='/',
    ).select_related('customer')

    # Vorab alle LegacyMappings laden (N+1 vermeiden)
    all_mappings = {
        m.sql_id: m.customer_id
        for m in CustomerLegacyMapping.objects.select_related('customer').all()
    }
    # Vorab fallback: legacy_sql_id -> customer
    legacy_sql_lookup = {}
    for c in Customer.objects.filter(legacy_sql_id__isnull=False).exclude(legacy_sql_id=0):
        if c.legacy_sql_id not in legacy_sql_lookup:
            legacy_sql_lookup[c.legacy_sql_id] = c.pk

    # Customer-Cache
    customer_cache = {}

    def _find_customer_cached(adressen_id):
        if adressen_id in customer_cache:
            return customer_cache[adressen_id]
        # LegacyMapping zuerst
        cust_id = all_mappings.get(adressen_id)
        if not cust_id:
            cust_id = legacy_sql_lookup.get(adressen_id)
        if cust_id:
            try:
                cust = Customer.objects.get(pk=cust_id)
            except Customer.DoesNotExist:
                cust = None
        else:
            cust = None
        customer_cache[adressen_id] = cust
        return cust

    for order in legacy_orders:
        stats['total_checked'] += 1

        adressen_id = order.legacy_adressen_id
        if not adressen_id:
            stats['no_adressen_id'] += 1
            continue

        correct_customer = _find_customer_cached(adressen_id)
        if not correct_customer:
            stats['no_mapping'] += 1
            old_customer = order.customer
            stats['details'].append({
                'order_number': order.order_number,
                'adressen_id': adressen_id,
                'action': 'no_mapping',
                'old_customer': str(old_customer) if old_customer else '(keiner)',
                'old_customer_number': old_customer.customer_number if old_customer else '',
                'new_customer': '',
                'new_customer_number': '',
                'legacy_name': order.legacy_customer_name,
                'legacy_company': order.legacy_customer_company,
            })
            continue

        if order.customer_id == correct_customer.pk:
            stats['already_correct'] += 1
            continue

        old_customer = order.customer
        detail = {
            'order_number': order.order_number,
            'adressen_id': adressen_id,
            'old_customer': str(old_customer) if old_customer else '(keiner)',
            'old_customer_number': old_customer.customer_number if old_customer else '',
            'new_customer': str(correct_customer),
            'new_customer_number': correct_customer.customer_number,
            'legacy_name': order.legacy_customer_name,
            'legacy_company': order.legacy_customer_company,
        }

        if not dry_run:
            try:
                with transaction.atomic():
                    order.customer = correct_customer
                    # Legacy-Felder bereinigen da jetzt korrekt zugeordnet
                    order.legacy_customer_name = ''
                    order.legacy_customer_company = ''
                    order.legacy_customer_address = ''
                    order.save()
            except Exception as e:
                stats['errors'].append(f"{order.order_number}: {str(e)}")
                continue

        if old_customer:
            stats['reassigned'] += 1
            detail['action'] = 'reassigned'
            logger.info(
                f"Auftrag {order.order_number}: "
                f"{old_customer} -> {correct_customer}"
            )
        else:
            stats['newly_assigned'] += 1
            detail['action'] = 'newly_assigned'
            logger.info(
                f"Auftrag {order.order_number}: "
                f"(keiner) -> {correct_customer}"
            )

        stats['details'].append(detail)

    all_details = stats.pop('details')
    return {
        'success': True,
        'dry_run': dry_run,
        'stats': stats,
        'details': [d for d in all_details if d['action'] != 'no_mapping'][:100],
        'no_mapping_details': [d for d in all_details if d['action'] == 'no_mapping'],
    }
