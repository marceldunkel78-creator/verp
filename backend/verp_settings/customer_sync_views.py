"""
API Views für die Kundendaten-Synchronisation mit externer SQL Server Datenbank.
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework import status

from .customer_sync import (
    test_connection, preview_sync, sync_customers, get_sync_status
)

logger = logging.getLogger(__name__)

# Standard-Verbindungsparameter
DEFAULT_SERVER = r'localhost\SQLEXPRESS,1433'
DEFAULT_DATABASE = 'VSDB'
DEFAULT_DSN = 'VSDB'


class CustomerSyncStatusView(APIView):
    """
    GET: Gibt den aktuellen Sync-Status zurück (wie viele Kunden verknüpft sind).
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            sync_status = get_sync_status()
            return Response(sync_status)
        except Exception as e:
            logger.error(f"Fehler beim Abrufen des Sync-Status: {e}")
            return Response(
                {'error': f'Fehler: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CustomerSyncTestConnectionView(APIView):
    """
    POST: Testet die Verbindung zur SQL Server Datenbank.
    Body (optional): { "server": "...", "database": "...", "use_dsn": true, "dsn_name": "..." }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        server = request.data.get('server', DEFAULT_SERVER)
        database = request.data.get('database', DEFAULT_DATABASE)
        use_dsn = request.data.get('use_dsn', False)
        dsn_name = request.data.get('dsn_name', DEFAULT_DSN)
        
        try:
            result = test_connection(
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


class CustomerSyncPreviewView(APIView):
    """
    POST: Erstellt eine Vorschau der Synchronisation (Dry-Run).
    Body (optional): { "server": "...", "database": "...", "limit": 50 }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        server = request.data.get('server', DEFAULT_SERVER)
        database = request.data.get('database', DEFAULT_DATABASE)
        use_dsn = request.data.get('use_dsn', False)
        dsn_name = request.data.get('dsn_name', DEFAULT_DSN)
        limit = request.data.get('limit', 100)
        
        try:
            result = preview_sync(
                server=server,
                database=database,
                use_dsn=use_dsn,
                dsn_name=dsn_name,
                limit=limit,
            )
            return Response(result)
        except Exception as e:
            logger.error(f"Sync-Vorschau fehlgeschlagen: {e}")
            return Response(
                {'error': f'Fehler bei der Vorschau: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CustomerSyncExecuteView(APIView):
    """
    POST: Führt die tatsächliche Synchronisation durch.
    Nur für Staff/Admin-User.
    Body (optional): { "server": "...", "database": "...", "dry_run": false }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request):
        server = request.data.get('server', DEFAULT_SERVER)
        database = request.data.get('database', DEFAULT_DATABASE)
        use_dsn = request.data.get('use_dsn', False)
        dsn_name = request.data.get('dsn_name', DEFAULT_DSN)
        dry_run = request.data.get('dry_run', False)
        
        try:
            result = sync_customers(
                server=server,
                database=database,
                use_dsn=use_dsn,
                dsn_name=dsn_name,
                created_by_user=request.user,
                dry_run=dry_run,
            )
            return Response(result)
        except Exception as e:
            logger.error(f"Sync fehlgeschlagen: {e}")
            return Response(
                {'error': f'Synchronisation fehlgeschlagen: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
