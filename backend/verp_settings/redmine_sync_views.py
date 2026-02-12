"""
API Views für Redmine → VERP Ticket-Synchronisation
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from .redmine_sync import (
    test_redmine_connection,
    get_sync_status,
    preview_sync,
    execute_sync,
    REDMINE_URL,
    REDMINE_API_KEY,
)


class RedmineSyncStatusView(APIView):
    """GET: Aktueller Synchronisationsstatus"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            result = get_sync_status()
            return Response(result)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RedmineSyncTestConnectionView(APIView):
    """POST: Redmine-Verbindung testen"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        url = request.data.get('url', REDMINE_URL)
        api_key = request.data.get('api_key', REDMINE_API_KEY)

        try:
            result = test_redmine_connection(url, api_key)
            return Response(result)
        except Exception as e:
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RedmineSyncPreviewView(APIView):
    """POST: Vorschau der Synchronisation (Dry Run)"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        url = request.data.get('url', REDMINE_URL)
        api_key = request.data.get('api_key', REDMINE_API_KEY)
        modules = request.data.get('modules', None)
        limit = request.data.get('limit', 100)

        try:
            result = preview_sync(
                modules=modules,
                url=url,
                api_key=api_key,
                limit=limit,
            )
            return Response(result)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RedmineSyncExecuteView(APIView):
    """POST: Synchronisation ausführen"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        url = request.data.get('url', REDMINE_URL)
        api_key = request.data.get('api_key', REDMINE_API_KEY)
        modules = request.data.get('modules', None)
        limit = request.data.get('limit', 500)
        full_sync = request.data.get('full_sync', False)

        try:
            result = execute_sync(
                modules=modules,
                url=url,
                api_key=api_key,
                limit=limit,
                full_sync=full_sync,
            )
            return Response(result)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
