"""
API Views fuer SQL-Projekte (Interessen-Tabelle) aus externer SQL Server Datenbank (VSDB).

Stellt Projekte/Interessen aus der Legacy-Datenbank dar und ermoeglicht Bearbeitung.
Nutzt die gleiche Verbindungslogik wie sql_angebote.
"""
import logging
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from verp_settings.customer_sync import get_mssql_connection
from customers.models import CustomerLegacyMapping, SQLProjektExtra, SQLProjektDocument, SQLProjektAngebotLink, ContactHistory

logger = logging.getLogger(__name__)

DEFAULT_SERVER = r'localhost\SQLEXPRESS'
DEFAULT_DATABASE = 'VSDB'

# Caches fuer Lookup-Daten
_lookup_cache = {}


def _parse_decimal(val):
    if val is None:
        return Decimal('0')
    try:
        if isinstance(val, Decimal):
            return val
        return Decimal(str(val).replace(',', '.'))
    except (InvalidOperation, ValueError):
        return Decimal('0')


def _parse_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%dT%H:%M:%S') if val.hour or val.minute else val.strftime('%Y-%m-%d')
    return str(val) if val else None


def _parse_int(val, default=0):
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _parse_bool(val):
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    return str(val).strip().upper() in ('1', 'TRUE', 'WAHR', 'YES')


def _get_connection():
    return get_mssql_connection(DEFAULT_SERVER, DEFAULT_DATABASE)


def _fetch_dict(cursor):
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _get_lookup(conn, table_name, id_col, text_col, extra_cols=None):
    """Liest eine Lookup-Tabelle und cached das Ergebnis."""
    cache_key = table_name
    if cache_key in _lookup_cache:
        return _lookup_cache[cache_key]

    try:
        cursor = conn.cursor()
        cols = f'[{id_col}], [{text_col}]'
        if extra_cols:
            cols += ', ' + ', '.join(f'[{c}]' for c in extra_cols)
        cursor.execute(f'SELECT {cols} FROM [{table_name}] ORDER BY [{id_col}]')
        result = []
        for row in cursor.fetchall():
            entry = {'id': _parse_int(row[0]), 'text': (row[1] or '').strip()}
            if extra_cols:
                for i, col in enumerate(extra_cols):
                    entry[col.lower()] = (row[2 + i] or '').strip() if row[2 + i] else ''
            result.append(entry)
        _lookup_cache[cache_key] = result
        return result
    except Exception as e:
        logger.warning(f"Lookup-Tabelle {table_name} konnte nicht gelesen werden: {e}")
        return []


def _get_mitarbeiter_map(conn):
    """Liest Mitarbeiter (Verkaeufer) als id->name Dict."""
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT [MitarbeiterID], [Name] FROM [Mitarbeiter] ORDER BY [MitarbeiterID]")
        return {_parse_int(r[0]): (r[1] or '').strip() for r in cursor.fetchall() if _parse_int(r[0]) > 0}
    except Exception as e:
        logger.warning(f"Mitarbeiter-Tabelle nicht lesbar: {e}")
        return {}


def _get_verp_customer_map(adressen_ids):
    if not adressen_ids:
        return {}
    mappings = CustomerLegacyMapping.objects.filter(
        sql_id__in=adressen_ids
    ).select_related('customer').values_list('sql_id', 'customer__id', 'customer__customer_number', 'customer__last_name')
    return {
        sql_id: {'customer_id': cid, 'customer_number': cnum, 'customer_name': cname}
        for sql_id, cid, cnum, cname in mappings
    }


def _build_projekt_dict(row, mitarbeiter_map, lookup_maps, verp_customer=None):
    """Baut ein Projekt-Dict aus einer SQL-Zeile."""
    system_gruppe_id = _parse_int(row.get('SystemGruppe'))
    system_gruppe_map = {e['id']: e['text'] for e in lookup_maps.get('system_gruppen', [])}
    lead_source_map = {e['id']: e['text'] for e in lookup_maps.get('lead_source', [])}
    infomaterial_map = {e['id']: e['text'] for e in lookup_maps.get('infomaterial', [])}
    mailing_map = {e['id']: e['text'] for e in lookup_maps.get('mailing', [])}
    prioritaet_map = {e['id']: e['text'] for e in lookup_maps.get('prioritaeten', [])}
    aktions_status_map = {e['id']: e['text'] for e in lookup_maps.get('aktions_status', [])}

    verkaeufer_id = _parse_int(row.get('VerkäuferID'))
    lead_source_id = _parse_int(row.get('LeadSourceID'))
    infomaterial_id = _parse_int(row.get('InfomaterialID'))
    mailing_id = _parse_int(row.get('Mailing'))
    prioritaet_id = _parse_int(row.get('PrioritätID'))
    aktions_status_id = _parse_int(row.get('AktionsStatus'))
    adressen_id = _parse_int(row.get('AdressenID'))

    result = {
        'id': _parse_int(row.get('InteressenID')),
        'datum': _parse_date(row.get('Datum')),
        'adressen_id': adressen_id,
        'system_gruppe_id': system_gruppe_id,
        'system_gruppe': system_gruppe_map.get(system_gruppe_id, ''),
        'produkt_untergruppe': (row.get('ProduktUntergruppe') or '').strip(),
        'mittelzuteilungsdatum': _parse_date(row.get('Mittelzuteilungsdatum')),
        'auftragsdatum': _parse_date(row.get('Auftragsdatum')),
        'auftragswahrscheinlichkeit': _parse_int(row.get('Auftragswahrscheinlichkeit')),
        'auftragssumme': str(_parse_decimal(row.get('Auftragssumme'))),
        'verkaeufer_id': verkaeufer_id,
        'verkaeufer': mitarbeiter_map.get(verkaeufer_id, ''),
        'erstkontakt': _parse_date(row.get('Erstkontakt')),
        'infomaterial_schicken': _parse_bool(row.get('InfomaterialSchicken')),
        'infomaterial_id': infomaterial_id,
        'infomaterial': infomaterial_map.get(infomaterial_id, ''),
        'infomaterial_text': (row.get('Infomaterial-Text') or '').strip(),
        'mailing_id': mailing_id,
        'mailing': mailing_map.get(mailing_id, ''),
        'mailingdatum': _parse_date(row.get('Mailingdatum')),
        'prioritaet_id': prioritaet_id,
        'prioritaet': prioritaet_map.get(prioritaet_id, ''),
        'aktionsdatum': _parse_date(row.get('Aktionsdatum')),
        'aktionsbeschreibung': (row.get('Aktionsbeschreibung') or '').strip(),
        'interessen_beschreibung': (row.get('InteressenBeschreibung') or '').strip(),
        'lost_order_beschreibung': (row.get('LostOrderBeschreibung') or '').strip(),
        'naechste_aktion': _parse_date(row.get('NächsteAktion')),
        'master_ref': _parse_int(row.get('MasterRef')),
        'last_modified': _parse_date(row.get('LastModified')),
        'marker': _parse_bool(row.get('Marker')),
        'angebot': _parse_bool(row.get('Angebot')),
        'demo': _parse_bool(row.get('Demo')),
        'anruf': _parse_bool(row.get('Anruf')),
        'lead_source_id': lead_source_id,
        'lead_source': lead_source_map.get(lead_source_id, ''),
        'lead_source_text': (row.get('LeadSourceText') or '').strip(),
        'aktions_status_id': aktions_status_id,
        'aktions_status': aktions_status_map.get(aktions_status_id, ''),
    }

    if verp_customer:
        result['verp_customer'] = verp_customer
    else:
        result['verp_customer'] = None

    return result


def _get_all_lookups(conn):
    """Laedt alle Lookup-Tabellen auf einmal."""
    return {
        'lead_source': _get_lookup(conn, 'LeadSource', 'ID', 'Text'),
        'system_gruppen': _get_lookup(conn, 'SystemGruppen', 'ID', 'text'),
        'infomaterial': _get_lookup(conn, 'Infomaterial', 'ID', 'Text'),
        'mailing': _get_lookup(conn, 'Mailing', 'ID', 'Text'),
        'prioritaeten': _get_lookup(conn, 'Prioritäten', 'ID', 'text', extra_cols=['englisch']),
        'aktions_status': _get_lookup(conn, 'AktionsStatus', 'ID', 'Text', extra_cols=['englisch']),
    }


class ProjekteListView(APIView):
    """GET /api/sql-projekte/projekte/ - Liste aller Projekte/Interessen"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            conn = _get_connection()
            cursor = conn.cursor()
            mitarbeiter_map = _get_mitarbeiter_map(conn)
            lookup_maps = _get_all_lookups(conn)

            # Filtering
            where_clauses = []
            params = []

            search = request.query_params.get('search', '').strip()
            if search:
                where_clauses.append(
                    "([InteressenBeschreibung] LIKE ? OR [Aktionsbeschreibung] LIKE ? "
                    "OR [ProduktUntergruppe] LIKE ? OR CAST([InteressenID] AS NVARCHAR) = ? "
                    "OR EXISTS (SELECT 1 FROM [Adressen] a WHERE a.[AdressenID] = [Interessen].[AdressenID] "
                    "AND (a.[Firma/Uni] LIKE ? OR a.[Name] LIKE ? OR a.[Vorname] LIKE ? OR a.[Ort] LIKE ?)))"
                )
                like = f'%{search}%'
                params.extend([like, like, like, search, like, like, like, like])

            verkaeufer = request.query_params.get('verkaeufer', '').strip()
            if verkaeufer:
                where_clauses.append("[VerkäuferID] = ?")
                params.append(int(verkaeufer))

            system_gruppe = request.query_params.get('system_gruppe', '').strip()
            if system_gruppe:
                where_clauses.append("[SystemGruppe] = ?")
                params.append(int(system_gruppe))

            prioritaet = request.query_params.get('prioritaet', '').strip()
            if prioritaet:
                prio_ids = [int(x) for x in prioritaet.split(',') if x.strip().isdigit()]
                if prio_ids:
                    placeholders = ','.join('?' * len(prio_ids))
                    where_clauses.append(f"[PrioritätID] IN ({placeholders})")
                    params.extend(prio_ids)

            aktion_von = request.query_params.get('aktion_von', '').strip()
            if aktion_von:
                where_clauses.append("[NächsteAktion] >= ?")
                params.append(aktion_von)

            aktion_bis = request.query_params.get('aktion_bis', '').strip()
            if aktion_bis:
                where_clauses.append("[NächsteAktion] <= ?")
                params.append(aktion_bis)

            auftrag_von = request.query_params.get('auftrag_von', '').strip()
            if auftrag_von:
                where_clauses.append("[Auftragsdatum] >= ?")
                params.append(auftrag_von)

            auftrag_bis = request.query_params.get('auftrag_bis', '').strip()
            if auftrag_bis:
                where_clauses.append("[Auftragsdatum] <= ?")
                params.append(auftrag_bis)

            adressen_id = request.query_params.get('adressen_id', '').strip()
            if adressen_id:
                where_clauses.append("[AdressenID] = ?")
                params.append(int(adressen_id))

            # Filter nach VERP aktiv-Status
            aktiv_filter = request.query_params.get('aktiv', '').strip()
            if aktiv_filter == '1':
                active_ids = set(SQLProjektExtra.objects.filter(is_active=True).values_list('sql_projekt_id', flat=True))
                if active_ids:
                    placeholders = ','.join('?' * len(active_ids))
                    where_clauses.append(f"[InteressenID] IN ({placeholders})")
                    params.extend(list(active_ids))
                else:
                    where_clauses.append('1=0')
            elif aktiv_filter == '0':
                inactive_ids = set(SQLProjektExtra.objects.filter(is_active=False).values_list('sql_projekt_id', flat=True))
                if inactive_ids:
                    placeholders = ','.join('?' * len(inactive_ids))
                    where_clauses.append(f"[InteressenID] IN ({placeholders})")
                    params.extend(list(inactive_ids))
                else:
                    where_clauses.append('1=0')

            where = ' AND '.join(where_clauses) if where_clauses else '1=1'

            # Sorting
            allowed_sorts = {
                'id': '[InteressenID]',
                'datum': '[Datum]',
                'naechste_aktion': '[NächsteAktion]',
                'aktionsdatum': '[Aktionsdatum]',
                'auftragsdatum': '[Auftragsdatum]',
                'verkaeufer': '[VerkäuferID]',
                'prioritaet': '[PrioritätID]',
                'system_gruppe': '[SystemGruppe]',
            }
            ordering = request.query_params.get('ordering', '-aktionsdatum')
            desc = ordering.startswith('-')
            sort_key = ordering.lstrip('-')
            sort_col = allowed_sorts.get(sort_key, '[Aktionsdatum]')
            sort_dir = 'DESC' if desc else 'ASC'

            # Count
            cursor.execute(f"SELECT COUNT(*) FROM [Interessen] WHERE {where}", params)
            total = cursor.fetchone()[0]

            # Pagination
            page = max(1, _parse_int(request.query_params.get('page', '1'), 1))
            page_size = min(100, max(10, _parse_int(request.query_params.get('page_size', '25'), 25)))
            offset = (page - 1) * page_size

            cursor.execute(
                f"SELECT * FROM [Interessen] WHERE {where} "
                f"ORDER BY {sort_col} {sort_dir} "
                f"OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                params + [offset, page_size]
            )
            rows = _fetch_dict(cursor)

            # VERP customer mapping
            adressen_ids = list(set(_parse_int(r.get('AdressenID')) for r in rows if r.get('AdressenID')))
            verp_map = _get_verp_customer_map(adressen_ids)

            # Adress-Info aus SQL holen
            adressen_info = {}
            if adressen_ids:
                placeholders = ','.join('?' * len(adressen_ids))
                cursor.execute(
                    f"SELECT [AdressenID], [Firma/Uni], [Name], [Vorname], [Ort] "
                    f"FROM [Adressen] WHERE [AdressenID] IN ({placeholders})",
                    adressen_ids
                )
                for r in cursor.fetchall():
                    aid = _parse_int(r[0])
                    firma = (r[1] or '').strip()
                    name = ' '.join(filter(None, [(r[3] or '').strip(), (r[2] or '').strip()])).strip()
                    ort = (r[4] or '').strip()
                    adressen_info[aid] = {
                        'firma': firma,
                        'name': name,
                        'ort': ort,
                    }

            # Projekt-Namen aus SQLProjektExtra laden
            interessen_ids = [_parse_int(r.get('InteressenID')) for r in rows if r.get('InteressenID')]
            projekt_name_map = {}
            if interessen_ids:
                from customers.models import SQLProjektExtra
                extras = SQLProjektExtra.objects.filter(sql_projekt_id__in=interessen_ids).values_list('sql_projekt_id', 'projekt_name')
                projekt_name_map = {pid: name for pid, name in extras}

            projekte = []
            for row in rows:
                aid = _parse_int(row.get('AdressenID'))
                p = _build_projekt_dict(row, mitarbeiter_map, lookup_maps, verp_map.get(aid))
                p['adresse'] = adressen_info.get(aid, {})
                iid = _parse_int(row.get('InteressenID'))
                p['projekt_name'] = projekt_name_map.get(iid, '') or ''
                projekte.append(p)

            conn.close()

            return Response({
                'results': projekte,
                'count': total,
                'page': page,
                'page_size': page_size,
                'total_pages': (total + page_size - 1) // page_size,
            })
        except Exception as e:
            logger.error(f"SQL-Projekte Fehler: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProjektDetailView(APIView):
    """GET /api/sql-projekte/projekte/<id>/ - Einzelnes Projekt/Interesse"""
    permission_classes = [IsAuthenticated]

    def get(self, request, projekt_id):
        try:
            conn = _get_connection()
            cursor = conn.cursor()
            mitarbeiter_map = _get_mitarbeiter_map(conn)
            lookup_maps = _get_all_lookups(conn)

            cursor.execute("SELECT * FROM [Interessen] WHERE [InteressenID] = ?", (projekt_id,))
            rows = _fetch_dict(cursor)
            if not rows:
                conn.close()
                return Response({'error': 'Projekt nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)

            row = rows[0]
            aid = _parse_int(row.get('AdressenID'))
            verp_map = _get_verp_customer_map([aid] if aid else [])

            # Adress-Info
            adresse = {}
            if aid:
                cursor.execute(
                    "SELECT [AdressenID], [Firma/Uni], [Name], [Vorname], "
                    "[Straße], [PLZ], [Ort], [LandID], [Anschluß1], [Email] "
                    "FROM [Adressen] WHERE [AdressenID] = ?",
                    (aid,)
                )
                addr_row = cursor.fetchone()
                if addr_row:
                    adresse = {
                        'adressen_id': _parse_int(addr_row[0]),
                        'firma': (addr_row[1] or '').strip(),
                        'name': ' '.join(filter(None, [(addr_row[3] or '').strip(), (addr_row[2] or '').strip()])).strip(),
                        'strasse': (addr_row[4] or '').strip(),
                        'plz': (addr_row[5] or '').strip(),
                        'ort': (addr_row[6] or '').strip(),
                        'land': str(addr_row[7] or '').strip(),
                        'telefon': (addr_row[8] or '').strip(),
                        'email': (addr_row[9] or '').strip(),
                    }

            projekt = _build_projekt_dict(row, mitarbeiter_map, lookup_maps, verp_map.get(aid))
            projekt['adresse'] = adresse

            conn.close()
            return Response(projekt)
        except Exception as e:
            logger.error(f"SQL-Projekt Detail Fehler: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProjektUpdateView(APIView):
    """PUT /api/sql-projekte/projekte/<id>/update/ - Projekt aktualisieren"""
    permission_classes = [IsAuthenticated]

    def put(self, request, projekt_id):
        try:
            data = request.data
            conn = _get_connection()
            cursor = conn.cursor()

            # Pruefen ob Projekt existiert
            cursor.execute("SELECT [InteressenID] FROM [Interessen] WHERE [InteressenID] = ?", (projekt_id,))
            if not cursor.fetchone():
                conn.close()
                return Response({'error': 'Projekt nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)

            # Erlaubte Felder mit SQL-Spaltennamen
            field_map = {
                'system_gruppe_id': '[SystemGruppe]',
                'produkt_untergruppe': '[ProduktUntergruppe]',
                'mittelzuteilungsdatum': '[Mittelzuteilungsdatum]',
                'auftragsdatum': '[Auftragsdatum]',
                'auftragswahrscheinlichkeit': '[Auftragswahrscheinlichkeit]',
                'auftragssumme': '[Auftragssumme]',
                'verkaeufer_id': '[VerkäuferID]',
                'erstkontakt': '[Erstkontakt]',
                'infomaterial_schicken': '[InfomaterialSchicken]',
                'infomaterial_id': '[InfomaterialID]',
                'infomaterial_text': '[Infomaterial-Text]',
                'mailing_id': '[Mailing]',
                'mailingdatum': '[Mailingdatum]',
                'prioritaet_id': '[PrioritätID]',
                'aktionsdatum': '[Aktionsdatum]',
                'aktionsbeschreibung': '[Aktionsbeschreibung]',
                'interessen_beschreibung': '[InteressenBeschreibung]',
                'lost_order_beschreibung': '[LostOrderBeschreibung]',
                'naechste_aktion': '[NächsteAktion]',
                'marker': '[Marker]',
                'angebot': '[Angebot]',
                'demo': '[Demo]',
                'anruf': '[Anruf]',
                'lead_source_id': '[LeadSourceID]',
                'lead_source_text': '[LeadSourceText]',
                'aktions_status_id': '[AktionsStatus]',
            }

            set_clauses = []
            params = []
            for api_field, sql_col in field_map.items():
                if api_field in data:
                    val = data[api_field]
                    # None / leere Strings -> NULL
                    if val == '' or val is None:
                        val = None
                    set_clauses.append(f"{sql_col} = ?")
                    params.append(val)

            if not set_clauses:
                conn.close()
                return Response({'error': 'Keine Felder zum Aktualisieren'}, status=status.HTTP_400_BAD_REQUEST)

            # LastModified setzen
            set_clauses.append("[LastModified] = ?")
            params.append(datetime.now())

            params.append(projekt_id)
            sql = f"UPDATE [Interessen] SET {', '.join(set_clauses)} WHERE [InteressenID] = ?"
            cursor.execute(sql, params)
            conn.commit()

            # Reminder erstellen wenn Verkäufer gesetzt
            self._create_reminder_if_needed(data, projekt_id)

            conn.close()
            return Response({'status': 'success', 'id': projekt_id})
        except Exception as e:
            logger.error(f"SQL-Projekt Update Fehler: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _create_reminder_if_needed(self, data, projekt_id):
        """Erstellt eine MyVERP-Erinnerung fuer den Verkaeufer bei Aktionsdatumaenderung."""
        naechste_aktion = data.get('naechste_aktion')
        verkaeufer_id = data.get('verkaeufer_id')
        if not naechste_aktion or not verkaeufer_id:
            return

        try:
            from users.models import User, Reminder
            # User mit passender sql_verkaeufer_id finden
            user = User.objects.filter(sql_verkaeufer_id=verkaeufer_id).first()
            if not user:
                return

            due_date = naechste_aktion
            if isinstance(due_date, str):
                due_date = datetime.strptime(due_date[:10], '%Y-%m-%d').date()

            # Bestehende Reminder fuer dieses Projekt loeschen/aktualisieren
            existing = Reminder.objects.filter(
                user=user,
                related_object_type='sql_projekt',
                related_object_id=projekt_id,
                is_completed=False,
            ).first()

            if existing:
                existing.due_date = due_date
                existing.title = f'SQL-Projekt #{projekt_id}: Nächste Aktion fällig'
                existing.save()
            else:
                Reminder.objects.create(
                    user=user,
                    title=f'SQL-Projekt #{projekt_id}: Nächste Aktion fällig',
                    description=f'Die nächste Aktion für SQL-Projekt #{projekt_id} ist fällig.',
                    due_date=due_date,
                    related_object_type='sql_projekt',
                    related_object_id=projekt_id,
                    related_url=f'/sales/sql-projekte/{projekt_id}',
                )
        except Exception as e:
            logger.warning(f"Reminder-Erstellung fehlgeschlagen: {e}")


class ProjektActionView(APIView):
    """POST /api/sql-projekte/projekte/<id>/action/ - Neue Aktion hinzufuegen"""
    permission_classes = [IsAuthenticated]

    def post(self, request, projekt_id):
        """
        Fuegt einen neuen Aktionseintrag hinzu:
        - Haengt Datum/Uhrzeit + Kommentar an Aktionsbeschreibung an
        - Setzt Aktionsdatum auf jetzt
        - Setzt NächsteAktion auf +7 Tage
        - Erstellt Reminder fuer den Verkaeufer
        """
        try:
            kommentar = request.data.get('kommentar', '').strip()
            conn = _get_connection()
            cursor = conn.cursor()

            # Aktuelles Projekt laden
            cursor.execute(
                "SELECT [Aktionsbeschreibung], [VerkäuferID] FROM [Interessen] WHERE [InteressenID] = ?",
                (projekt_id,)
            )
            row = cursor.fetchone()
            if not row:
                conn.close()
                return Response({'error': 'Projekt nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)

            bisherige_beschreibung = (row[0] or '').strip()
            verkaeufer_id = _parse_int(row[1])

            now = datetime.now()
            naechste_aktion = now + timedelta(days=7)

            # Verkaeufer-Name ermitteln
            mitarbeiter = _get_mitarbeiter_map(conn)
            # User-Kuerzel aus dem aktuellen User oder Mitarbeiter-Name
            user_name = ''
            if hasattr(request, 'user') and request.user:
                user_name = request.user.get_full_name() or request.user.username
            if not user_name and verkaeufer_id:
                user_name = mitarbeiter.get(verkaeufer_id, '')

            # Neuen Eintrag formatieren (gleiches Format wie Legacy-Daten)
            datum_str = now.strftime('%d.%m.%y/%H:%M')
            neuer_eintrag = f"\n{datum_str}/{user_name}: {kommentar}"

            neue_beschreibung = bisherige_beschreibung + neuer_eintrag

            # Update
            cursor.execute(
                "UPDATE [Interessen] SET "
                "[Aktionsbeschreibung] = ?, [Aktionsdatum] = ?, [NächsteAktion] = ?, [LastModified] = ? "
                "WHERE [InteressenID] = ?",
                (neue_beschreibung, now, naechste_aktion, now, projekt_id)
            )
            conn.commit()
            conn.close()

            # Reminder erstellen
            self._create_action_reminder(verkaeufer_id, projekt_id, naechste_aktion)

            # Kontakthistorie beim VERP-Kunden eintragen
            self._add_contact_history(projekt_id, kommentar, request.user)

            return Response({
                'status': 'success',
                'aktionsbeschreibung': neue_beschreibung,
                'aktionsdatum': now.strftime('%Y-%m-%dT%H:%M:%S'),
                'naechste_aktion': naechste_aktion.strftime('%Y-%m-%d'),
            })
        except Exception as e:
            logger.error(f"SQL-Projekt Action Fehler: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _create_action_reminder(self, verkaeufer_id, projekt_id, due_date):
        if not verkaeufer_id:
            return
        try:
            from users.models import User, Reminder
            user = User.objects.filter(sql_verkaeufer_id=verkaeufer_id).first()
            if not user:
                return

            if isinstance(due_date, datetime):
                due_date = due_date.date()

            # Alten Reminder ersetzen
            Reminder.objects.filter(
                user=user,
                related_object_type='sql_projekt',
                related_object_id=projekt_id,
                is_completed=False,
            ).delete()

            Reminder.objects.create(
                user=user,
                title=f'SQL-Projekt #{projekt_id}: Nächste Aktion fällig',
                description=f'Die nächste Aktion für SQL-Projekt #{projekt_id} ist fällig.',
                due_date=due_date,
                related_object_type='sql_projekt',
                related_object_id=projekt_id,
                related_url=f'/sales/sql-projekte/{projekt_id}',
            )
        except Exception as e:
            logger.warning(f"Action-Reminder fehlgeschlagen: {e}")

    def _add_contact_history(self, projekt_id, kommentar, user):
        """Trägt die Aktion in die VERP Kundenkontakthistorie ein."""
        try:
            extra = SQLProjektExtra.objects.filter(sql_projekt_id=projekt_id).select_related('customer').first()
            if not extra or not extra.customer:
                return

            from datetime import date
            ContactHistory.objects.create(
                customer=extra.customer,
                contact_date=date.today(),
                contact_type='MEETING',
                comment=f'[SQL-Projekt #{projekt_id}] {kommentar}',
                created_by=user,
            )
        except Exception as e:
            logger.warning(f"Kontakthistorie-Eintrag fehlgeschlagen: {e}")


class ProjektCreateView(APIView):
    """POST /api/sql-projekte/projekte/create/ - Neues SQL-Projekt erstellen"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            data = request.data
            customer_id = data.get('customer_id')
            if not customer_id:
                return Response({'error': 'VERP-Kunde ist erforderlich'}, status=status.HTTP_400_BAD_REQUEST)

            from customers.models import Customer
            try:
                customer = Customer.objects.get(id=customer_id)
            except Customer.DoesNotExist:
                return Response({'error': 'Kunde nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)

            # Legacy-Mapping finden (AdressenID für SQL-DB)
            legacy = customer.legacy_mappings.first()
            if not legacy:
                return Response(
                    {'error': 'Kunde hat keine SQL-AdressenID. Bitte zuerst ein Legacy-Mapping anlegen.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            adressen_id = legacy.sql_id

            conn = _get_connection()
            cursor = conn.cursor()

            now = datetime.now()
            user_name = request.user.get_full_name() or request.user.username

            # Verkäufer-ID aus User-Profil
            verkaeufer_id = getattr(request.user, 'sql_verkaeufer_id', None)
            if data.get('verkaeufer_id'):
                verkaeufer_id = int(data['verkaeufer_id'])

            # INSERT in SQL Server
            cursor.execute(
                "INSERT INTO [Interessen] ("
                "[Datum], [AdressenID], [VerkäuferID], [SystemGruppe], [ProduktUntergruppe], "
                "[PrioritätID], [Auftragswahrscheinlichkeit], [Auftragssumme], "
                "[InteressenBeschreibung], [Aktionsbeschreibung], [Aktionsdatum], [NächsteAktion], [LastModified]"
                ") OUTPUT INSERTED.[InteressenID] VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    now,
                    adressen_id,
                    verkaeufer_id,
                    int(data['system_gruppe_id']) if data.get('system_gruppe_id') else None,
                    (data.get('produkt_untergruppe') or '').strip() or None,
                    int(data['prioritaet_id']) if data.get('prioritaet_id') else 4,  # Default: neu/unbekannt
                    int(data.get('auftragswahrscheinlichkeit', 0)) or None,
                    float(data['auftragssumme']) if data.get('auftragssumme') else None,
                    (data.get('interessen_beschreibung') or '').strip() or None,
                    f"{now.strftime('%d.%m.%y/%H:%M')}/{user_name}: Projekt erstellt",
                    now,
                    now + timedelta(days=7),
                    now,
                )
            )
            new_id = cursor.fetchone()[0]
            conn.commit()
            conn.close()

            # SQLProjektExtra in VERP-DB anlegen
            extra = SQLProjektExtra.objects.create(
                sql_projekt_id=new_id,
                customer=customer,
                projekt_name=data.get('projekt_name', ''),
                created_by=request.user,
            )

            # Optional: VERP-Auftrag verlinken
            if data.get('verp_order_id'):
                from orders.models import Order
                try:
                    order = Order.objects.get(id=data['verp_order_id'])
                    extra.verp_order = order
                    extra.save()
                except Order.DoesNotExist:
                    pass

            return Response({
                'status': 'success',
                'id': new_id,
                'message': f'Projekt #{new_id} erstellt'
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"SQL-Projekt Create Fehler: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SQLProjektExtraView(APIView):
    """GET/PUT /api/sql-projekte/projekte/<id>/extra/ - VERP-Zusatzinfos"""
    permission_classes = [IsAuthenticated]

    def get(self, request, projekt_id):
        try:
            extra = SQLProjektExtra.objects.filter(sql_projekt_id=projekt_id).first()
            if not extra:
                return Response({'exists': False})

            documents = [
                {
                    'id': d.id,
                    'name': d.name or d.file.name.split('/')[-1],
                    'url': request.build_absolute_uri(d.file.url) if d.file else None,
                    'uploaded_at': d.uploaded_at.isoformat(),
                    'uploaded_by': d.uploaded_by.get_full_name() if d.uploaded_by else None,
                }
                for d in extra.documents.all()
            ]

            angebot_links = [
                {
                    'id': a.id,
                    'sql_angebot_nummer': a.sql_angebot_nummer,
                }
                for a in extra.angebot_links.all()
            ]

            return Response({
                'exists': True,
                'id': extra.id,
                'sql_projekt_id': extra.sql_projekt_id,
                'customer_id': extra.customer_id,
                'customer_name': str(extra.customer) if extra.customer else None,
                'customer_number': extra.customer.customer_number if extra.customer else None,
                'projekt_name': extra.projekt_name,
                'verp_order_id': extra.verp_order_id,
                'verp_order_number': extra.verp_order.order_number if extra.verp_order else None,
                'notes': extra.notes,
                'is_active': extra.is_active,
                'documents': documents,
                'angebot_links': angebot_links,
                'created_at': extra.created_at.isoformat(),
                'updated_at': extra.updated_at.isoformat(),
            })
        except Exception as e:
            logger.error(f"SQLProjektExtra GET Fehler: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, projekt_id):
        try:
            data = request.data
            extra, created = SQLProjektExtra.objects.get_or_create(
                sql_projekt_id=projekt_id,
                defaults={'created_by': request.user}
            )

            if 'projekt_name' in data:
                extra.projekt_name = data['projekt_name']
            if 'notes' in data:
                extra.notes = data['notes']
            if 'is_active' in data:
                extra.is_active = bool(data['is_active'])
            if 'customer_id' in data:
                from customers.models import Customer
                if data['customer_id']:
                    extra.customer = Customer.objects.get(id=data['customer_id'])
                else:
                    extra.customer = None
            if 'verp_order_id' in data:
                from orders.models import Order
                if data['verp_order_id']:
                    extra.verp_order = Order.objects.get(id=data['verp_order_id'])
                else:
                    extra.verp_order = None

            extra.save()

            # Angebot-Links aktualisieren
            if 'angebot_nummern' in data:
                extra.angebot_links.all().delete()
                for nr in data['angebot_nummern']:
                    SQLProjektAngebotLink.objects.create(
                        sql_projekt_extra=extra,
                        sql_angebot_nummer=int(nr)
                    )

            return Response({'status': 'success', 'id': extra.id})
        except Exception as e:
            logger.error(f"SQLProjektExtra PUT Fehler: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SQLProjektDocumentView(APIView):
    """POST/DELETE /api/sql-projekte/projekte/<id>/documents/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, projekt_id):
        try:
            extra, _ = SQLProjektExtra.objects.get_or_create(
                sql_projekt_id=projekt_id,
                defaults={'created_by': request.user}
            )

            file = request.FILES.get('file')
            if not file:
                return Response({'error': 'Keine Datei hochgeladen'}, status=status.HTTP_400_BAD_REQUEST)

            doc = SQLProjektDocument.objects.create(
                sql_projekt_extra=extra,
                file=file,
                name=request.data.get('name', '') or file.name,
                uploaded_by=request.user,
            )

            return Response({
                'status': 'success',
                'id': doc.id,
                'name': doc.name,
                'url': request.build_absolute_uri(doc.file.url),
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"SQLProjekt Document Upload Fehler: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, projekt_id):
        doc_id = request.query_params.get('doc_id')
        if not doc_id:
            return Response({'error': 'doc_id erforderlich'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            doc = SQLProjektDocument.objects.get(
                id=doc_id,
                sql_projekt_extra__sql_projekt_id=projekt_id
            )
            doc.file.delete(save=False)
            doc.delete()
            return Response({'status': 'deleted'})
        except SQLProjektDocument.DoesNotExist:
            return Response({'error': 'Dokument nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)


class LookupTablesView(APIView):
    """GET /api/sql-projekte/lookups/ - Alle Dropdown-Daten"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        global _lookup_cache
        _lookup_cache = {}  # Cache invalidieren bei explizitem Abruf
        try:
            conn = _get_connection()
            lookups = _get_all_lookups(conn)

            # Mitarbeiter als Verkaeufer-Dropdown
            cursor = conn.cursor()
            cursor.execute(
                "SELECT [MitarbeiterID], [Name], [Kürzel] FROM [Mitarbeiter] "
                "WHERE [MitarbeiterID] > 0 ORDER BY [MitarbeiterID]"
            )
            verkaeufer = []
            for r in cursor.fetchall():
                verkaeufer.append({
                    'id': _parse_int(r[0]),
                    'text': (r[1] or '').strip(),
                    'kuerzel': (r[2] or '').strip(),
                })
            lookups['verkaeufer'] = verkaeufer

            conn.close()
            return Response(lookups)
        except Exception as e:
            logger.error(f"Lookup Fehler: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProjekteTestConnectionView(APIView):
    """GET /api/sql-projekte/test-connection/ - Verbindungstest"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            conn = _get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM [Interessen]")
            count = cursor.fetchone()[0]
            conn.close()
            return Response({
                'status': 'connected',
                'server': DEFAULT_SERVER,
                'database': DEFAULT_DATABASE,
                'interessen_count': count,
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'error': str(e),
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class SQLForecastView(APIView):
    """
    GET /api/sql-projekte/forecast/
    SQL-Projekt-Forecast mit optionalen SQL-Angeboten.

    Query-Parameter:
      - datum_von, datum_bis: Zeitraum (YYYY-MM-DD), Default: 12 Monate
      - min_wahrscheinlichkeit: Min. Auftragswahrscheinlichkeit (0-100)
      - verkaeufer: VerkäuferID (optional)
      - aktions_status: Kommaseparierte AktionsStatus-IDs (Mehrfachauswahl)
      - include_angebote: 1/true um SQL-Angebote einzubeziehen
      - angebote_zustand: Kommaseparierte ZustandIDs für Angebote
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from collections import defaultdict

        # --- Parameter parsen ---
        today = datetime.now()
        default_von = (today - timedelta(days=30)).strftime('%Y-%m-%d')
        default_bis = (today + timedelta(days=365)).strftime('%Y-%m-%d')

        datum_von = request.query_params.get('datum_von', default_von)
        datum_bis = request.query_params.get('datum_bis', default_bis)
        min_wahr = _parse_int(request.query_params.get('min_wahrscheinlichkeit', '0'))
        verkaeufer = request.query_params.get('verkaeufer', '').strip()
        prioritaet_raw = request.query_params.get('prioritaet', '').strip()
        include_angebote = request.query_params.get('include_angebote', '').lower() in ('1', 'true')
        angebote_zustand_raw = request.query_params.get('angebote_zustand', '').strip()

        prioritaet_ids = []
        if prioritaet_raw:
            prioritaet_ids = [int(x) for x in prioritaet_raw.split(',') if x.strip().isdigit()]

        angebote_zustand_ids = []
        if angebote_zustand_raw:
            angebote_zustand_ids = [int(x) for x in angebote_zustand_raw.split(',') if x.strip().isdigit()]

        try:
            conn = _get_connection()
            cursor = conn.cursor()
            mitarbeiter_map = _get_mitarbeiter_map(conn)
            lookup_maps = _get_all_lookups(conn)
            prioritaet_map = {e['id']: e['text'] for e in lookup_maps.get('prioritaeten', [])}

            # --- Projekte laden ---
            where_clauses = ['[Auftragsdatum] IS NOT NULL']
            params = []

            where_clauses.append('[Auftragsdatum] >= ?')
            params.append(datum_von)
            where_clauses.append('[Auftragsdatum] <= ?')
            params.append(datum_bis)

            if min_wahr > 0:
                where_clauses.append('[Auftragswahrscheinlichkeit] >= ?')
                params.append(min_wahr)

            if verkaeufer:
                where_clauses.append('[VerkäuferID] = ?')
                params.append(int(verkaeufer))

            if prioritaet_ids:
                placeholders = ','.join('?' * len(prioritaet_ids))
                where_clauses.append(f'[PrioritätID] IN ({placeholders})')
                params.extend(prioritaet_ids)

            where = ' AND '.join(where_clauses)

            cursor.execute(
                f"SELECT * FROM [Interessen] WHERE {where} ORDER BY [Auftragsdatum]",
                params
            )
            projekt_rows = _fetch_dict(cursor)

            # Adressen-Info sammeln
            adressen_ids = list(set(_parse_int(r.get('AdressenID')) for r in projekt_rows if r.get('AdressenID')))
            verp_map = _get_verp_customer_map(adressen_ids)

            adressen_info = {}
            if adressen_ids:
                ph = ','.join('?' * len(adressen_ids))
                cursor.execute(
                    f"SELECT [AdressenID], [Firma/Uni], [Name], [Vorname], [Ort] "
                    f"FROM [Adressen] WHERE [AdressenID] IN ({ph})",
                    adressen_ids
                )
                for r in cursor.fetchall():
                    aid = _parse_int(r[0])
                    adressen_info[aid] = {
                        'firma': (r[1] or '').strip(),
                        'name': ' '.join(filter(None, [(r[3] or '').strip(), (r[2] or '').strip()])).strip(),
                        'ort': (r[4] or '').strip(),
                    }

            # --- Pro Monat und Status aggregieren ---
            monthly_data = defaultdict(lambda: defaultdict(lambda: {'summe': Decimal('0'), 'gewichtet': Decimal('0'), 'count': 0}))
            all_statuses = set()
            projekte_list = []

            for row in projekt_rows:
                auftragsdatum = row.get('Auftragsdatum')
                if not auftragsdatum:
                    continue

                dt = auftragsdatum if isinstance(auftragsdatum, datetime) else None
                if dt is None:
                    try:
                        dt = datetime.strptime(str(auftragsdatum)[:10], '%Y-%m-%d')
                    except (ValueError, TypeError):
                        continue

                month_key = dt.strftime('%Y-%m')
                prio_id = _parse_int(row.get('PrioritätID'))
                prio_label = prioritaet_map.get(prio_id, '(Keine Einstufung)') if prio_id else '(Keine Einstufung)'
                all_statuses.add(prio_label)

                summe = _parse_decimal(row.get('Auftragssumme'))
                wahr = _parse_int(row.get('Auftragswahrscheinlichkeit'))
                gewichtet = summe * Decimal(str(wahr)) / Decimal('100')

                monthly_data[month_key][prio_label]['summe'] += summe
                monthly_data[month_key][prio_label]['gewichtet'] += gewichtet
                monthly_data[month_key][prio_label]['count'] += 1

                # Projekt-Detail
                aid = _parse_int(row.get('AdressenID'))
                v_id = _parse_int(row.get('VerkäuferID'))
                aktions_status_map = {e['id']: e['text'] for e in lookup_maps.get('aktions_status', [])}
                as_id = _parse_int(row.get('AktionsStatus'))
                projekte_list.append({
                    'id': _parse_int(row.get('InteressenID')),
                    'datum': _parse_date(row.get('Datum')),
                    'auftragsdatum': _parse_date(auftragsdatum),
                    'auftragssumme': str(summe),
                    'auftragswahrscheinlichkeit': wahr,
                    'gewichtete_summe': str(gewichtet),
                    'einstufung': prio_label,
                    'einstufung_id': prio_id,
                    'aktions_status': aktions_status_map.get(as_id, '') if as_id else '',
                    'aktions_status_id': as_id,
                    'verkaeufer_id': v_id,
                    'verkaeufer': mitarbeiter_map.get(v_id, ''),
                    'adressen_id': aid,
                    'kunde': adressen_info.get(aid, {}),
                    'verp_customer': verp_map.get(aid),
                    'system_gruppe': {e['id']: e['text'] for e in lookup_maps.get('system_gruppen', [])}.get(
                        _parse_int(row.get('SystemGruppe')), ''),
                    'produkt_untergruppe': (row.get('ProduktUntergruppe') or '').strip(),
                    'interessen_beschreibung': (row.get('InteressenBeschreibung') or '').strip(),
                })

            # --- Chart-Daten aufbereiten ---
            sorted_statuses = sorted(all_statuses)
            sorted_months = sorted(monthly_data.keys())

            chart_data = []
            for month in sorted_months:
                entry = {'period': month}
                month_total = Decimal('0')
                month_gewichtet = Decimal('0')
                for st in sorted_statuses:
                    d = monthly_data[month].get(st, {'summe': Decimal('0'), 'gewichtet': Decimal('0'), 'count': 0})
                    safe_key = st.replace(' ', '_')
                    entry[f'{safe_key}_summe'] = float(d['summe'])
                    entry[f'{safe_key}_gewichtet'] = float(d['gewichtet'])
                    entry[f'{safe_key}_count'] = d['count']
                    month_total += d['summe']
                    month_gewichtet += d['gewichtet']
                entry['total_summe'] = float(month_total)
                entry['total_gewichtet'] = float(month_gewichtet)
                chart_data.append(entry)

            # --- Summary ---
            total_summe = sum(Decimal(p['auftragssumme']) for p in projekte_list)
            total_gewichtet = sum(Decimal(p['gewichtete_summe']) for p in projekte_list)

            status_summary = {}
            for st in sorted_statuses:
                st_projects = [p for p in projekte_list if p['einstufung'] == st]
                status_summary[st] = {
                    'count': len(st_projects),
                    'summe': float(sum(Decimal(p['auftragssumme']) for p in st_projects)),
                    'gewichtet': float(sum(Decimal(p['gewichtete_summe']) for p in st_projects)),
                }

            result = {
                'chart_data': chart_data,
                'statuses': sorted_statuses,
                'status_keys': [st.replace(' ', '_') for st in sorted_statuses],
                'summary': {
                    'total_projekte': len(projekte_list),
                    'total_summe': float(total_summe),
                    'total_gewichtet': float(total_gewichtet),
                    'avg_wahrscheinlichkeit': (
                        round(sum(p['auftragswahrscheinlichkeit'] for p in projekte_list) / len(projekte_list))
                        if projekte_list else 0
                    ),
                    'by_status': status_summary,
                },
                'projekte': projekte_list,
            }

            # --- Optional: SQL-Angebote ---
            if include_angebote:
                angebote_result = self._load_angebote(
                    conn, cursor, mitarbeiter_map, datum_von, datum_bis,
                    verkaeufer, angebote_zustand_ids, adressen_info
                )
                result['angebote'] = angebote_result

            conn.close()
            return Response(result)
        except Exception as e:
            logger.error(f"SQL-Forecast Fehler: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _load_angebote(self, conn, cursor, mitarbeiter_map, datum_von, datum_bis, verkaeufer, zustand_ids, adressen_info):
        """Lädt SQL-Angebote (nur letzte Version pro AngebotNummer) für den Forecast."""
        from collections import defaultdict

        where_clauses = ['a.[Datum] >= ?', 'a.[Datum] <= ?']
        params = [datum_von, datum_bis]

        if verkaeufer:
            where_clauses.append('a.[VerkäuferID] = ?')
            params.append(int(verkaeufer))

        if zustand_ids:
            ph = ','.join('?' * len(zustand_ids))
            where_clauses.append(f'a.[ZustandID] IN ({ph})')
            params.extend(zustand_ids)

        where = ' AND '.join(where_clauses)

        # Nur die letzte Version pro AngebotNummer (MAX VersionsNummer)
        cursor.execute(f"""
            SELECT a.[AngebotID], a.[AngebotNummer], a.[VersionsNummer], a.[Jahr],
                   a.[AdressenID], a.[VerkäuferID], a.[Datum],
                   a.[Gesamtpreis], a.[ZustandID], a.[Kurzbeschreibung],
                   adr.[Firma/Uni] AS Firma, adr.[Name] AS KundenName, adr.[Vorname], adr.[Ort]
            FROM [Angebote] a
            LEFT JOIN [Adressen] adr ON a.[AdressenID] = adr.[AdressenID]
            INNER JOIN (
                SELECT [AngebotNummer], [Jahr], MAX([VersionsNummer]) AS MaxVersion
                FROM [Angebote] b
                WHERE {where.replace('a.', 'b.')}
                GROUP BY [AngebotNummer], [Jahr]
            ) latest ON a.[AngebotNummer] = latest.[AngebotNummer]
                    AND a.[Jahr] = latest.[Jahr]
                    AND a.[VersionsNummer] = latest.MaxVersion
            WHERE {where}
            ORDER BY a.[Datum]
        """, params + params)
        rows = _fetch_dict(cursor)

        zustand_labels = {
            1: 'Entwurf', 2: 'Erstellt', 3: 'Versendet',
            4: 'Abgelehnt', 5: 'Angenommen', 6: 'Auftrag',
        }

        monthly_data = defaultdict(lambda: {'summe': Decimal('0'), 'count': 0})
        angebote_list = []

        for row in rows:
            datum = row.get('Datum')
            if not datum:
                continue

            dt = datum if isinstance(datum, datetime) else None
            if dt is None:
                try:
                    dt = datetime.strptime(str(datum)[:10], '%Y-%m-%d')
                except (ValueError, TypeError):
                    continue

            month_key = dt.strftime('%Y-%m')
            preis = _parse_decimal(row.get('Gesamtpreis'))
            monthly_data[month_key]['summe'] += preis
            monthly_data[month_key]['count'] += 1

            zid = _parse_int(row.get('ZustandID'))
            v_id = _parse_int(row.get('VerkäuferID'))

            angebote_list.append({
                'angebot_id': row.get('AngebotID'),
                'angebot_nummer': row.get('AngebotNummer'),
                'versions_nummer': row.get('VersionsNummer'),
                'jahr': row.get('Jahr'),
                'datum': _parse_date(datum),
                'gesamtpreis': str(preis),
                'zustand_id': zid,
                'zustand': zustand_labels.get(zid, f'Zustand {zid}'),
                'verkaeufer_id': v_id,
                'verkaeufer': mitarbeiter_map.get(v_id, ''),
                'firma': (row.get('Firma') or '').strip(),
                'kunde_name': ' '.join(filter(None, [
                    (row.get('Vorname') or '').strip(),
                    (row.get('KundenName') or '').strip()
                ])).strip(),
                'ort': (row.get('Ort') or '').strip(),
                'kurzbeschreibung': (row.get('Kurzbeschreibung') or '').strip(),
            })

        chart_data = []
        for month in sorted(monthly_data.keys()):
            d = monthly_data[month]
            chart_data.append({
                'period': month,
                'angebote_summe': float(d['summe']),
                'angebote_count': d['count'],
            })

        total = sum(Decimal(a['gesamtpreis']) for a in angebote_list)

        return {
            'chart_data': chart_data,
            'summary': {
                'total_angebote': len(angebote_list),
                'total_summe': float(total),
            },
            'angebote': angebote_list,
        }
