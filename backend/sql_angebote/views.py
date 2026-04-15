"""
Read-only API Views fuer SQL-Angebote aus externer SQL Server Datenbank (VSDB).

Stellt Angebote und deren Positionen aus der Legacy-Datenbank dar.
Nutzt die gleiche Verbindungslogik wie der Legacy-Auftragsimport.
"""
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from verp_settings.customer_sync import get_mssql_connection
from customers.models import CustomerLegacyMapping
from customer_orders.models import CustomerOrder

logger = logging.getLogger(__name__)

DEFAULT_SERVER = r'localhost\SQLEXPRESS,1433'
DEFAULT_DATABASE = 'VSDB'

# Cache fuer Mitarbeiter-Daten aus SQL Server
_mitarbeiter_cache = None


def _get_mitarbeiter_map(conn=None):
    """Liest Mitarbeiter aus der SQL Server Tabelle und cached das Ergebnis."""
    global _mitarbeiter_cache
    if _mitarbeiter_cache is not None:
        return _mitarbeiter_cache

    close_conn = False
    try:
        if conn is None:
            conn = _get_connection()
            close_conn = True
        cursor = conn.cursor()
        cursor.execute("SELECT [MitarbeiterID], [Name] FROM [Mitarbeiter] ORDER BY [MitarbeiterID]")
        result = {}
        for row in cursor.fetchall():
            mid = _parse_int(row[0])
            name = (row[1] or '').strip()
            if mid > 0 and name:
                result[mid] = name
        _mitarbeiter_cache = result
        return result
    except Exception as e:
        logger.warning(f"Mitarbeiter-Tabelle konnte nicht gelesen werden: {e}")
        # Fallback
        return {
            1: 'Wurm', 2: 'Köhn', 3: 'Waltinger', 4: 'Busch',
            5: 'Gulde', 6: 'Willberg', 7: 'Draude', 8: 'Guckler',
        }
    finally:
        if close_conn and conn:
            try:
                conn.close()
            except Exception:
                pass


def _parse_decimal(val):
    """Parst einen Dezimalwert aus SQL Server (kann str, float, Decimal, None sein)."""
    if val is None:
        return Decimal('0')
    try:
        if isinstance(val, Decimal):
            return val
        s = str(val).replace(',', '.')
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return Decimal('0')


def _parse_date(val):
    """Parst ein Datum aus SQL Server in ISO-Format."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d')
    if isinstance(val, str):
        for fmt in ('%d.%m.%Y', '%Y-%m-%d', '%d/%m/%Y'):
            try:
                return datetime.strptime(val.strip(), fmt).strftime('%Y-%m-%d')
            except ValueError:
                continue
    return str(val) if val else None


def _parse_int(val, default=0):
    """Parst einen Integer-Wert."""
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _parse_bool(val):
    """Parst einen Boolean (SQL Server BIT oder WAHR/FALSCH)."""
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    s = str(val).strip().upper()
    return s in ('1', 'TRUE', 'WAHR', 'YES')


def _get_connection():
    """Erstellt eine Verbindung zum SQL Server."""
    return get_mssql_connection(DEFAULT_SERVER, DEFAULT_DATABASE)


def _fetch_dict(cursor):
    """Wandelt cursor.fetchall() in eine Liste von Dicts um."""
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _get_verp_customer_map(adressen_ids):
    """
    Gibt ein Dict {sql_adressen_id: {'customer_id': ..., 'customer_number': ...}} zurück
    für alle bekannten Legacy-Mappings.
    """
    if not adressen_ids:
        return {}
    mappings = CustomerLegacyMapping.objects.filter(
        sql_id__in=adressen_ids
    ).select_related('customer').values_list('sql_id', 'customer__id', 'customer__customer_number')
    return {
        sql_id: {'customer_id': cid, 'customer_number': cnum}
        for sql_id, cid, cnum in mappings
    }


def _get_verp_order_for_angebot(conn, angebot_id):
    """
    Sucht in der SQL-Aufträge-Tabelle nach einem Auftrag mit ReferenzID = angebot_id.
    Generiert daraus die Legacy-Auftragsnummer und sucht den VERP CustomerOrder.
    Gibt {'order_id': ..., 'order_number': ...} oder None zurück.
    """
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT [AuftragsID], [AngebotNummer], [Jahr], [Datum] "
            "FROM [Aufträge] WHERE [ReferenzID] = ?",
            (int(angebot_id),)
        )
        row = cursor.fetchone()
        if not row:
            return None

        auftrags_id = row[0]
        angebot_nr = _parse_int(row[1])
        jahr = _parse_int(row[2])
        datum = row[3]

        if not angebot_nr:
            return None

        # Erst direkt über legacy_auftrags_id suchen
        co = CustomerOrder.objects.filter(legacy_auftrags_id=auftrags_id).values('id', 'order_number').first()
        if co:
            return {'order_id': co['id'], 'order_number': co['order_number']}

        # Fallback: Auftragsnummer rekonstruieren (O-XXX-MM/YY)
        if datum:
            try:
                from datetime import datetime as dt
                if isinstance(datum, str):
                    for fmt in ('%d.%m.%Y', '%Y-%m-%d'):
                        try:
                            datum = dt.strptime(datum.strip(), fmt)
                            break
                        except ValueError:
                            continue
                if hasattr(datum, 'month'):
                    mm = f'{datum.month:02d}'
                    yy = str(datum.year)[-2:]
                else:
                    mm = '01'
                    yy = str(jahr)[-2:] if jahr else '00'
            except Exception:
                mm = '01'
                yy = str(jahr)[-2:] if jahr else '00'
        elif jahr:
            mm = '01'
            yy = str(jahr)[-2:]
        else:
            return None

        order_number = f'O-{angebot_nr:03d}-{mm}/{yy}'
        co = CustomerOrder.objects.filter(order_number=order_number).values('id', 'order_number').first()
        if co:
            return {'order_id': co['id'], 'order_number': co['order_number']}

        return None
    except Exception as e:
        logger.warning(f"Fehler bei VERP-Auftragssuche für Angebot {angebot_id}: {e}")
        return None


def _get_verp_orders_for_angebote(conn, angebot_ids):
    """
    Batch-Version: Sucht für mehrere Angebot-IDs die zugehörigen VERP-Aufträge.
    Gibt Dict {angebot_id: {'order_id': ..., 'order_number': ...}} zurück.
    """
    if not angebot_ids:
        return {}

    result = {}
    try:
        cursor = conn.cursor()
        # Batch-Query: alle Aufträge deren ReferenzID in angebot_ids liegt
        placeholders = ','.join(['?'] * len(angebot_ids))
        cursor.execute(
            f"SELECT [AuftragsID], [ReferenzID], [AngebotNummer], [Jahr], [Datum] "
            f"FROM [Aufträge] WHERE [ReferenzID] IN ({placeholders})",
            list(angebot_ids)
        )
        rows = cursor.fetchall()

        if not rows:
            return {}

        # Sammle alle AuftragsIDs für Batch-Lookup
        auftrags_id_to_ref = {}
        row_data = {}
        for row in rows:
            auftrags_id = row[0]
            ref_id = row[1]
            auftrags_id_to_ref[auftrags_id] = ref_id
            row_data[ref_id] = {
                'auftrags_id': auftrags_id,
                'angebot_nr': _parse_int(row[2]),
                'jahr': _parse_int(row[3]),
                'datum': row[4],
            }

        # Batch-Lookup über legacy_auftrags_id
        existing = CustomerOrder.objects.filter(
            legacy_auftrags_id__in=list(auftrags_id_to_ref.keys())
        ).values('id', 'order_number', 'legacy_auftrags_id')

        found_auftrags_ids = set()
        for co in existing:
            aid = co['legacy_auftrags_id']
            ref_id = auftrags_id_to_ref.get(aid)
            if ref_id is not None:
                result[ref_id] = {'order_id': co['id'], 'order_number': co['order_number']}
                found_auftrags_ids.add(aid)

        # Fallback für nicht gefundene: Auftragsnummer rekonstruieren
        for ref_id, data in row_data.items():
            if ref_id in result:
                continue
            angebot_nr = data['angebot_nr']
            if not angebot_nr:
                continue
            datum = data['datum']
            jahr = data['jahr']

            mm, yy = '01', '00'
            if datum:
                try:
                    from datetime import datetime as dt
                    if isinstance(datum, str):
                        for fmt in ('%d.%m.%Y', '%Y-%m-%d'):
                            try:
                                datum = dt.strptime(datum.strip(), fmt)
                                break
                            except ValueError:
                                continue
                    if hasattr(datum, 'month'):
                        mm = f'{datum.month:02d}'
                        yy = str(datum.year)[-2:]
                    elif jahr:
                        yy = str(jahr)[-2:]
                except Exception:
                    if jahr:
                        yy = str(jahr)[-2:]
            elif jahr:
                yy = str(jahr)[-2:]

            order_number = f'O-{angebot_nr:03d}-{mm}/{yy}'
            co = CustomerOrder.objects.filter(order_number=order_number).values('id', 'order_number').first()
            if co:
                result[ref_id] = {'order_id': co['id'], 'order_number': co['order_number']}

    except Exception as e:
        logger.warning(f"Fehler bei Batch-VERP-Auftragssuche: {e}")

    return result


class AngeboteListView(APIView):
    """
    GET: Listet Angebote aus der SQL Server Datenbank.
    Query-Parameter:
      - search: Suche nach Kundenname oder Kundennummer (AdressenID)
      - verkaeufer: Filter nach VerkäuferID
      - datum_von: Filter Datum ab (YYYY-MM-DD)
      - datum_bis: Filter Datum bis (YYYY-MM-DD)
      - page: Seitennummer (default 1)
      - page_size: Einträge pro Seite (default 50, max 200)
    """
    permission_classes = [IsAuthenticated]

    # Erlaubte Sortierfelder: API-Name -> SQL-Ausdruck
    SORT_FIELDS = {
        'angebot_nummer': 'a.[AngebotNummer]',
        'versions_nummer': 'a.[VersionsNummer]',
        'datum': 'a.[Datum]',
        'kunde': 'adr.[Firma/Uni]',
        'verkaeufer': 'a.[VerkäuferID]',
        'gesamtpreis': 'a.[Gesamtpreis]',
        'kurzbeschreibung': 'a.[Kurzbeschreibung]',
        'zustand': 'a.[ZustandID]',
    }

    def get(self, request):
        search = request.query_params.get('search', '').strip()
        verkaeufer = request.query_params.get('verkaeufer', '')
        datum_von = request.query_params.get('datum_von', '')
        datum_bis = request.query_params.get('datum_bis', '')
        ordering = request.query_params.get('ordering', '-datum').strip()
        page = max(1, _parse_int(request.query_params.get('page', '1'), 1))
        page_size = min(200, max(1, _parse_int(request.query_params.get('page_size', '50'), 50)))

        try:
            conn = _get_connection()
        except Exception as e:
            logger.error(f"SQL Server Verbindungsfehler: {e}")
            return Response(
                {'error': f'SQL Server Verbindung fehlgeschlagen: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        try:
            cursor = conn.cursor()

            # Build WHERE conditions
            conditions = []
            params = []

            if search:
                # Search by AdressenID (if numeric) or by customer name
                try:
                    adressen_id = int(search)
                    conditions.append("(a.[AdressenID] = ? OR adr.[Name] LIKE ? OR adr.[Firma/Uni] LIKE ?)")
                    params.extend([adressen_id, f'%{search}%', f'%{search}%'])
                except ValueError:
                    conditions.append(
                        "(adr.[Name] LIKE ? OR adr.[Firma/Uni] LIKE ? OR adr.[Institut] LIKE ? "
                        "OR adr.[Vorname] LIKE ?)"
                    )
                    params.extend([f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%'])

            if verkaeufer:
                try:
                    conditions.append("a.[VerkäuferID] = ?")
                    params.append(int(verkaeufer))
                except ValueError:
                    pass

            if datum_von:
                conditions.append("a.[Datum] >= ?")
                params.append(datum_von)

            if datum_bis:
                conditions.append("a.[Datum] <= ?")
                params.append(datum_bis)

            where_clause = ""
            if conditions:
                where_clause = "WHERE " + " AND ".join(conditions)

            # Count total
            count_query = f"""
                SELECT COUNT(*)
                FROM [Angebote] a
                LEFT JOIN [Adressen] adr ON a.[AdressenID] = adr.[AdressenID]
                {where_clause}
            """
            cursor.execute(count_query, params)
            total_count = cursor.fetchone()[0]

            # Build ORDER BY from ordering parameter
            desc = ordering.startswith('-')
            field_name = ordering.lstrip('-')
            sort_expr = self.SORT_FIELDS.get(field_name, 'a.[Datum]')
            direction = 'DESC' if desc else 'ASC'
            order_clause = f"{sort_expr} {direction}, a.[AngebotID] DESC"

            # Fetch page
            offset = (page - 1) * page_size
            data_query = f"""
                SELECT
                    a.[AngebotID],
                    a.[AngebotNummer],
                    a.[VersionsNummer],
                    a.[Jahr],
                    a.[AdressenID],
                    a.[VerkäuferID],
                    a.[Datum],
                    a.[Systempreis],
                    a.[Summe],
                    a.[Gesamtpreis],
                    a.[Gesamteinkaufspreis],
                    a.[Kurzbeschreibung],
                    a.[Systembeschreibung],
                    a.[ZustandID],
                    a.[AngebotArt],
                    a.[Englisch],
                    adr.[Vorname],
                    adr.[Name] AS KundenName,
                    adr.[Firma/Uni] AS Firma,
                    adr.[Institut],
                    adr.[Ort]
                FROM [Angebote] a
                LEFT JOIN [Adressen] adr ON a.[AdressenID] = adr.[AdressenID]
                {where_clause}
                ORDER BY {order_clause}
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            cursor.execute(data_query, params + [offset, page_size])
            rows = _fetch_dict(cursor)

            mitarbeiter_map = _get_mitarbeiter_map(conn)

            # VERP-Kunden-Mapping für alle Adressen-IDs in dieser Seite
            adressen_ids = [_parse_int(row.get('AdressenID')) for row in rows if row.get('AdressenID')]
            verp_customer_map = _get_verp_customer_map(adressen_ids)

            # VERP-Auftrags-Mapping für Angebote mit Status "Angenommen" (5) oder "Auftrag" (6)
            angebot_ids_for_orders = [
                row.get('AngebotID') for row in rows
                if _parse_int(row.get('ZustandID')) in (5, 6) and row.get('AngebotID')
            ]
            verp_order_map = _get_verp_orders_for_angebote(conn, angebot_ids_for_orders)

            results = []
            for row in rows:
                verkaeufer_id = _parse_int(row.get('VerkäuferID'))
                adressen_id = _parse_int(row.get('AdressenID'))
                angebot_id = row.get('AngebotID')
                zustand_id = _parse_int(row.get('ZustandID'))

                # VERP-Kunde
                verp_customer = verp_customer_map.get(adressen_id)
                # VERP-Auftrag (nur bei Angenommen/Auftrag)
                verp_order = verp_order_map.get(angebot_id) if zustand_id in (5, 6) else None

                results.append({
                    'angebot_id': angebot_id,
                    'angebot_nummer': row.get('AngebotNummer'),
                    'versions_nummer': row.get('VersionsNummer'),
                    'jahr': row.get('Jahr'),
                    'adressen_id': row.get('AdressenID'),
                    'verkaeufer_id': verkaeufer_id,
                    'verkaeufer_name': mitarbeiter_map.get(verkaeufer_id, f'ID {verkaeufer_id}'),
                    'datum': _parse_date(row.get('Datum')),
                    'systempreis': str(_parse_decimal(row.get('Systempreis'))),
                    'summe': str(_parse_decimal(row.get('Summe'))),
                    'gesamtpreis': str(_parse_decimal(row.get('Gesamtpreis'))),
                    'gesamteinkaufspreis': str(_parse_decimal(row.get('Gesamteinkaufspreis'))),
                    'kurzbeschreibung': row.get('Kurzbeschreibung') or '',
                    'systembeschreibung': row.get('Systembeschreibung') or '',
                    'zustand_id': row.get('ZustandID'),
                    'angebot_art': row.get('AngebotArt'),
                    'englisch': _parse_bool(row.get('Englisch')),
                    'kunde_vorname': row.get('Vorname') or '',
                    'kunde_name': row.get('KundenName') or '',
                    'firma': row.get('Firma') or '',
                    'institut': row.get('Institut') or '',
                    'ort': row.get('Ort') or '',
                    # VERP-Verknüpfungen
                    'verp_customer_id': verp_customer['customer_id'] if verp_customer else None,
                    'verp_customer_number': verp_customer['customer_number'] if verp_customer else None,
                    'verp_order_id': verp_order['order_id'] if verp_order else None,
                    'verp_order_number': verp_order['order_number'] if verp_order else None,
                })

            return Response({
                'count': total_count,
                'page': page,
                'page_size': page_size,
                'total_pages': (total_count + page_size - 1) // page_size if total_count > 0 else 0,
                'results': results,
            })

        except Exception as e:
            logger.error(f"Fehler beim Laden der Angebote: {e}", exc_info=True)
            return Response(
                {'error': f'Fehler beim Laden der Angebote: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            conn.close()


class AngebotDetailView(APIView):
    """
    GET: Gibt ein einzelnes Angebot mit Positionen zurueck.
    Positionen werden mit Anzeigetyp-Logik aufbereitet.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, angebot_id):
        try:
            conn = _get_connection()
        except Exception as e:
            logger.error(f"SQL Server Verbindungsfehler: {e}")
            return Response(
                {'error': f'SQL Server Verbindung fehlgeschlagen: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        try:
            cursor = conn.cursor()

            # Fetch Angebot header
            cursor.execute("""
                SELECT
                    a.*,
                    adr.[Vorname],
                    adr.[Name] AS KundenName,
                    adr.[Firma/Uni] AS Firma,
                    adr.[Institut],
                    adr.[Lehrstuhl],
                    adr.[Straße] AS Strasse,
                    adr.[PLZ],
                    adr.[Ort],
                    adr.[Email]
                FROM [Angebote] a
                LEFT JOIN [Adressen] adr ON a.[AdressenID] = adr.[AdressenID]
                WHERE a.[AngebotID] = ?
            """, (int(angebot_id),))

            angebot_rows = _fetch_dict(cursor)
            if not angebot_rows:
                return Response(
                    {'error': 'Angebot nicht gefunden'},
                    status=status.HTTP_404_NOT_FOUND
                )

            ang = angebot_rows[0]
            verkaeufer_id = _parse_int(ang.get('VerkäuferID'))
            systempreis = _parse_decimal(ang.get('Systempreis'))
            mitarbeiter_map = _get_mitarbeiter_map(conn)

            # VERP-Verknüpfungen
            adressen_id = _parse_int(ang.get('AdressenID'))
            verp_customer_map = _get_verp_customer_map([adressen_id] if adressen_id else [])
            verp_customer = verp_customer_map.get(adressen_id)

            zustand_id = _parse_int(ang.get('ZustandID'))
            verp_order = None
            if zustand_id in (5, 6):
                verp_order = _get_verp_order_for_angebot(conn, angebot_id)

            angebot_data = {
                'angebot_id': ang.get('AngebotID'),
                'angebot_nummer': ang.get('AngebotNummer'),
                'versions_nummer': ang.get('VersionsNummer'),
                'jahr': ang.get('Jahr'),
                'adressen_id': ang.get('AdressenID'),
                'verkaeufer_id': verkaeufer_id,
                'verkaeufer_name': mitarbeiter_map.get(verkaeufer_id, f'ID {verkaeufer_id}'),
                'datum': _parse_date(ang.get('Datum')),
                'angebotstext': ang.get('Angebotstext') or '',
                'erweiterungen': ang.get('Erweiterungen') or '',
                'optionen': ang.get('Optionen') or '',
                'absprachen': ang.get('Absprachen') or '',
                'systempreis': str(systempreis),
                'summe': str(_parse_decimal(ang.get('Summe'))),
                'listensumme': str(_parse_decimal(ang.get('Listensumme'))),
                'gesamtpreis': str(_parse_decimal(ang.get('Gesamtpreis'))),
                'gesamteinkaufspreis': str(_parse_decimal(ang.get('Gesamteinkaufspreis'))),
                'listenpreise_sichtbar': _parse_bool(ang.get('Listpreisesichtbar')),
                'prozent_sichtbar': _parse_bool(ang.get('Prozentsichtbar')),
                'summe_sichtbar': _parse_bool(ang.get('Summesichtbar')),
                'preisabsprachen': ang.get('Preisabsprachen'),
                'rabatt': str(_parse_decimal(ang.get('Rabatt'))),
                'zollfreiheit': ang.get('Zollfreiheit'),
                'zahlungsziel': ang.get('Zahlungsziel'),
                'lieferzeitraum': ang.get('Lieferzeitraum'),
                'lieferzeittext': ang.get('Lieferzeittext') or '',
                'lieferbedingungen': ang.get('Lieferbedingungen'),
                'lieferbedingungtext': ang.get('Lieferbedingungtext') or '',
                'garantie': ang.get('Garantie'),
                'garantietext': ang.get('Garantietext') or '',
                'angebotsgültigkeit': ang.get('Angebotsgültigkeit'),
                'dollarkurs': str(_parse_decimal(ang.get('Dollarkurs'))),
                'importfaktor': str(_parse_decimal(ang.get('Importfaktor'))),
                'dollarangebot': _parse_bool(ang.get('Dollarangebot')),
                'englisch': _parse_bool(ang.get('Englisch')),
                'angebot_art': ang.get('AngebotArt'),
                'kurzbeschreibung': ang.get('Kurzbeschreibung') or '',
                'systembeschreibung': ang.get('Systembeschreibung') or '',
                'zustand_id': ang.get('ZustandID'),
                # Kundendaten
                'kunde_vorname': ang.get('Vorname') or '',
                'kunde_name': ang.get('KundenName') or '',
                'firma': ang.get('Firma') or '',
                'institut': ang.get('Institut') or '',
                'lehrstuhl': ang.get('Lehrstuhl') or '',
                'strasse': ang.get('Strasse') or '',
                'plz': ang.get('PLZ') or '',
                'ort': ang.get('Ort') or '',
                'email': ang.get('Email') or '',
                # VERP-Verknüpfungen
                'verp_customer_id': verp_customer['customer_id'] if verp_customer else None,
                'verp_customer_number': verp_customer['customer_number'] if verp_customer else None,
                'verp_order_id': verp_order['order_id'] if verp_order else None,
                'verp_order_number': verp_order['order_number'] if verp_order else None,
            }

            # Fetch Positionen
            cursor.execute("""
                SELECT
                    p.[PositionsID],
                    p.[PositionsNr],
                    p.[AngebotID],
                    p.[Stückzahl],
                    p.[ProduktID],
                    p.[Stückpreis],
                    p.[Sondervereinbarungen],
                    p.[Sonderpreis],
                    p.[Einkaufspreis],
                    p.[DollarEK],
                    p.[Listenpreis],
                    p.[Anzeigetyp],
                    p.[AlternativNr],
                    p.[Lieferzeitraum],
                    p.[Bemerkungen],
                    pr.[Artikel],
                    pr.[Kennung],
                    pr.[ProduktBeschreibung]
                FROM [Positionen] p
                LEFT JOIN [Produkte] pr ON p.[ProduktID] = pr.[ProduktID]
                WHERE p.[AngebotID] = ?
                ORDER BY p.[PositionsNr]
            """, (int(angebot_id),))

            raw_positions = _fetch_dict(cursor)

            # Process positions with Anzeigetyp logic
            positions = self._process_positions(raw_positions, systempreis)

            angebot_data['positionen'] = positions

            return Response(angebot_data)

        except Exception as e:
            logger.error(f"Fehler beim Laden des Angebots {angebot_id}: {e}", exc_info=True)
            return Response(
                {'error': f'Fehler beim Laden des Angebots: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            conn.close()

    def _process_positions(self, raw_positions, systempreis):
        """
        Verarbeitet Positionen mit Anzeigetyp-Logik.

        Anzeigetyp-Regeln:
          0 = Systemfix: Wie Typ 1, Preis nicht angezeigt, in Systempreis enthalten
          1 = System: VK aus Systempreis proportional berechnet, Preis nicht angezeigt
          2 = Aufpreis: Zeigt nur Differenz zum VK der AlternativNr-Position
          3 = Vollpreis: Preis wird komplett angezeigt
          4 = Wie Typ 5
          5 = Option: Preis wird angezeigt, nicht im Gesamtpreis
          6 = Systemaufpreis: Alternativ zu anderer Position, zeigt nur Aufpreis
        """
        # Build lookup by PositionsNr for Aufpreis/Alternativ references
        pos_by_nr = {}
        for p in raw_positions:
            nr = _parse_int(p.get('PositionsNr'))
            pos_by_nr[nr] = p

        # Calculate total EK for system positions (Typ 0 and 1) to distribute Systempreis
        system_positions = [
            p for p in raw_positions
            if _parse_int(p.get('Anzeigetyp')) in (0, 1)
        ]
        total_system_ek = sum(
            _parse_decimal(p.get('Einkaufspreis')) * _parse_decimal(p.get('Stückzahl', 1))
            for p in system_positions
        )

        results = []
        for p in raw_positions:
            anzeigetyp = _parse_int(p.get('Anzeigetyp'))
            stueckpreis = _parse_decimal(p.get('Stückpreis'))
            einkaufspreis = _parse_decimal(p.get('Einkaufspreis'))
            listenpreis = _parse_decimal(p.get('Listenpreis'))
            stueckzahl = _parse_decimal(p.get('Stückzahl', 1))
            alternativ_nr = _parse_int(p.get('AlternativNr'))

            # Determine display price and visibility
            display_price = None
            price_visible = True
            is_option = False
            is_system = False
            aufpreis_info = None

            if anzeigetyp in (0, 1):
                # Systemfix / System: Preis nicht angezeigt, in Systempreis enthalten
                is_system = True
                price_visible = False
                # Calculate proportional VK from Systempreis
                if total_system_ek > 0 and systempreis > 0:
                    anteil = (einkaufspreis * stueckzahl) / total_system_ek
                    display_price = (systempreis * anteil) / stueckzahl if stueckzahl else Decimal('0')
                else:
                    display_price = stueckpreis

            elif anzeigetyp == 2:
                # Aufpreis: Differenz zum VK der AlternativNr-Position
                price_visible = True
                alt_pos = pos_by_nr.get(alternativ_nr)
                if alt_pos:
                    alt_preis = _parse_decimal(alt_pos.get('Stückpreis'))
                    display_price = stueckpreis - alt_preis
                    aufpreis_info = f'Aufpreis zu Position {alternativ_nr}'
                else:
                    display_price = stueckpreis
                    aufpreis_info = f'Aufpreis (Referenz Pos. {alternativ_nr} nicht gefunden)'

            elif anzeigetyp == 3:
                # Vollpreis: Preis wird angezeigt
                price_visible = True
                display_price = stueckpreis

            elif anzeigetyp in (4, 5):
                # Option: Preis angezeigt, nicht im Gesamtpreis
                price_visible = True
                display_price = stueckpreis
                is_option = True

            elif anzeigetyp == 6:
                # Systemaufpreis: Alternativ zu anderer Position, zeigt nur Aufpreis
                price_visible = True
                alt_pos = pos_by_nr.get(alternativ_nr)
                if alt_pos:
                    alt_preis = _parse_decimal(alt_pos.get('Stückpreis'))
                    display_price = stueckpreis - alt_preis
                    aufpreis_info = f'Systemaufpreis zu Position {alternativ_nr}'
                else:
                    display_price = stueckpreis
                    aufpreis_info = f'Systemaufpreis (Referenz Pos. {alternativ_nr} nicht gefunden)'

            else:
                # Unbekannter Typ: Preis anzeigen
                price_visible = True
                display_price = stueckpreis

            # Build description
            beschreibung = p.get('Sondervereinbarungen') or ''
            if not beschreibung:
                beschreibung = p.get('ProduktBeschreibung') or ''

            anzeigetyp_labels = {
                0: 'Systemfix',
                1: 'System',
                2: 'Aufpreis',
                3: 'Vollpreis',
                4: 'Option (Typ 4)',
                5: 'Option',
                6: 'Systemaufpreis',
            }

            results.append({
                'positions_id': p.get('PositionsID'),
                'positions_nr': _parse_int(p.get('PositionsNr')),
                'stueckzahl': str(stueckzahl),
                'produkt_id': p.get('ProduktID'),
                'artikel': p.get('Artikel') or '',
                'kennung': p.get('Kennung') or '',
                'beschreibung': beschreibung,
                'bemerkungen': p.get('Bemerkungen') or '',
                'stueckpreis': str(stueckpreis),
                'einkaufspreis': str(einkaufspreis),
                'listenpreis': str(listenpreis),
                'sonderpreis': _parse_bool(p.get('Sonderpreis')),
                'dollar_ek': _parse_bool(p.get('DollarEK')),
                'anzeigetyp': anzeigetyp,
                'anzeigetyp_label': anzeigetyp_labels.get(anzeigetyp, f'Typ {anzeigetyp}'),
                'alternativ_nr': alternativ_nr,
                'lieferzeitraum': _parse_int(p.get('Lieferzeitraum')),
                # Display logic fields
                'display_price': str(display_price) if display_price is not None else None,
                'price_visible': price_visible,
                'is_option': is_option,
                'is_system': is_system,
                'aufpreis_info': aufpreis_info,
                'gesamtpreis_position': str(display_price * stueckzahl) if display_price is not None else None,
            })

        return results


class MitarbeiterListView(APIView):
    """
    GET: Gibt die Liste der Mitarbeiter (Verkäufer) aus SQL Server zurueck.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        mitarbeiter_map = _get_mitarbeiter_map()
        result = [
            {'id': k, 'name': v}
            for k, v in sorted(mitarbeiter_map.items())
        ]
        return Response(result)


class AngeboteTestConnectionView(APIView):
    """
    GET: Testet die Verbindung zum SQL Server.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            conn = _get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM [Angebote]")
            count = cursor.fetchone()[0]
            conn.close()
            return Response({
                'success': True,
                'message': f'Verbindung erfolgreich. {count} Angebote gefunden.',
                'count': count,
            })
        except Exception as e:
            logger.error(f"SQL Server Verbindungstest fehlgeschlagen: {e}")
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
