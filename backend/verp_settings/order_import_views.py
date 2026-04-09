"""
API Views fuer den Legacy-Auftragsimport aus externer SQL Server Datenbank.

Analog zu customer_sync_views.py: 4 Endpunkte fuer Status, Verbindungstest,
Vorschau und Import-Ausfuehrung.
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework import status

from .order_import import (
    test_order_import_connection,
    get_order_import_status,
    preview_order_import,
    import_orders_from_sql,
    reassign_legacy_orders,
    backfill_legacy_adressen_ids,
    backfill_legacy_auftrags_ids,
    renumber_legacy_orders,
    cleanup_duplicate_legacy_orders,
)

logger = logging.getLogger(__name__)

# Standard-Verbindungsparameter (gleich wie customer_sync)
DEFAULT_SERVER = r'localhost\SQLEXPRESS,1433'
DEFAULT_DATABASE = 'VSDB'
DEFAULT_DSN = 'VSDB'


class OrderImportStatusView(APIView):
    """
    GET: Gibt den aktuellen Import-Status zurueck.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            result = get_order_import_status()
            return Response(result)
        except Exception as e:
            logger.error(f"Fehler beim Abrufen des Import-Status: {e}")
            return Response(
                {'error': f'Fehler: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrderImportTestConnectionView(APIView):
    """
    POST: Testet die Verbindung und prueft ob die benoetigten Tabellen existieren.
    Body (optional): { "server": "...", "database": "...", "use_dsn": true, "dsn_name": "..." }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        server = request.data.get('server', DEFAULT_SERVER)
        database = request.data.get('database', DEFAULT_DATABASE)
        use_dsn = request.data.get('use_dsn', False)
        dsn_name = request.data.get('dsn_name', DEFAULT_DSN)

        try:
            result = test_order_import_connection(
                server=server,
                database=database,
                use_dsn=use_dsn,
                dsn_name=dsn_name,
            )
            return Response(result)
        except Exception as e:
            logger.error(f"Verbindungstest fehlgeschlagen: {e}")
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrderImportPreviewView(APIView):
    """
    POST: Erstellt eine Vorschau des Imports (Dry-Run).
    Body: { "server": "...", "database": "...", "limit": 50 }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        server = request.data.get('server', DEFAULT_SERVER)
        database = request.data.get('database', DEFAULT_DATABASE)
        use_dsn = request.data.get('use_dsn', False)
        dsn_name = request.data.get('dsn_name', DEFAULT_DSN)
        limit = request.data.get('limit', 50)

        try:
            result = preview_order_import(
                server=server,
                database=database,
                use_dsn=use_dsn,
                dsn_name=dsn_name,
                limit=limit,
            )
            return Response(result)
        except Exception as e:
            logger.error(f"Import-Vorschau fehlgeschlagen: {e}")
            return Response(
                {'error': f'Fehler bei der Vorschau: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrderImportExecuteView(APIView):
    """
    POST: Fuehrt den tatsaechlichen Import durch.
    Nur fuer Staff/Admin-User.
    Body: { "server": "...", "database": "...", "dry_run": false }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        server = request.data.get('server', DEFAULT_SERVER)
        database = request.data.get('database', DEFAULT_DATABASE)
        use_dsn = request.data.get('use_dsn', False)
        dsn_name = request.data.get('dsn_name', DEFAULT_DSN)
        dry_run = request.data.get('dry_run', False)

        try:
            result = import_orders_from_sql(
                server=server,
                database=database,
                use_dsn=use_dsn,
                dsn_name=dsn_name,
                created_by_user=request.user,
                dry_run=dry_run,
            )
            return Response(result)
        except Exception as e:
            logger.error(f"Import fehlgeschlagen: {e}")
            return Response(
                {'error': f'Import fehlgeschlagen: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrderReassignView(APIView):
    """
    POST: Ordnet Legacy-Auftraege anhand des CustomerLegacyMapping neu zu.
    Korrigiert falsche Zuordnungen die durch fehlende veraltete Adressen
    beim initialen Import entstanden sind.
    Body: { "dry_run": true, "server": "...", "database": "..." }
    Optional: "backfill": true fuehrt vorher das Nachfuellen der legacy_adressen_id durch.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        dry_run = request.data.get('dry_run', True)
        do_backfill = request.data.get('backfill', False)

        try:
            backfill_stats = None
            if do_backfill:
                server = request.data.get('server', DEFAULT_SERVER)
                database = request.data.get('database', DEFAULT_DATABASE)
                use_dsn = request.data.get('use_dsn', False)
                dsn_name = request.data.get('dsn_name', DEFAULT_DSN)
                backfill_stats = backfill_legacy_adressen_ids(
                    server=server,
                    database=database,
                    use_dsn=use_dsn,
                    dsn_name=dsn_name,
                    dry_run=dry_run,
                )

            result = reassign_legacy_orders(dry_run=dry_run)
            if backfill_stats:
                result['backfill_stats'] = backfill_stats
            return Response(result)
        except Exception as e:
            logger.error(f"Auftrags-Neuzuordnung fehlgeschlagen: {e}")
            return Response(
                {'error': f'Neuzuordnung fehlgeschlagen: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrderRenumberView(APIView):
    """
    POST: Korrigiert doppelte/falsche Legacy-Auftragsnummern.
    Fuehrt automatisch vorher ein Backfill der legacy_auftrags_id durch.
    Body: { "dry_run": true, "server": "...", "database": "..." }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        dry_run = request.data.get('dry_run', True)
        server = request.data.get('server', DEFAULT_SERVER)
        database = request.data.get('database', DEFAULT_DATABASE)
        use_dsn = request.data.get('use_dsn', False)
        dsn_name = request.data.get('dsn_name', DEFAULT_DSN)

        try:
            # Phase 1: Backfill legacy_auftrags_id (immer ausfuehren, auch bei dry_run,
            # damit Phase 2 die IDs zur Verfuegung hat)
            backfill_stats = backfill_legacy_auftrags_ids(
                server=server,
                database=database,
                use_dsn=use_dsn,
                dsn_name=dsn_name,
                dry_run=False,
            )

            # Phase 2: Renumber (respektiert dry_run)
            result = renumber_legacy_orders(
                server=server,
                database=database,
                use_dsn=use_dsn,
                dsn_name=dsn_name,
                dry_run=dry_run,
            )
            result['backfill_auftrags_id_stats'] = backfill_stats
            return Response(result)
        except Exception as e:
            logger.error(f"Auftragsnummer-Korrektur fehlgeschlagen: {e}")
            return Response(
                {'error': f'Nummernkorrektur fehlgeschlagen: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrderCleanupDuplicatesView(APIView):
    """
    POST: Loescht doppelte Legacy-Auftraege (ohne legacy_auftrags_id nach Backfill).
    Fuehrt automatisch vorher Backfill durch, damit erkannt wird welche echt sind.
    Body: { "dry_run": true, "server": "...", "database": "..." }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        dry_run = request.data.get('dry_run', True)
        server = request.data.get('server', DEFAULT_SERVER)
        database = request.data.get('database', DEFAULT_DATABASE)
        use_dsn = request.data.get('use_dsn', False)
        dsn_name = request.data.get('dsn_name', DEFAULT_DSN)

        try:
            # Phase 1: Backfill damit alle echten Auftraege ihre ID haben
            backfill_stats = backfill_legacy_auftrags_ids(
                server=server,
                database=database,
                use_dsn=use_dsn,
                dsn_name=dsn_name,
                dry_run=False,
            )

            # Phase 2: Duplikate identifizieren/loeschen
            result = cleanup_duplicate_legacy_orders(dry_run=dry_run)
            result['backfill_stats'] = backfill_stats
            return Response(result)
        except Exception as e:
            logger.error(f"Duplikat-Bereinigung fehlgeschlagen: {e}")
            return Response(
                {'error': f'Duplikat-Bereinigung fehlgeschlagen: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
