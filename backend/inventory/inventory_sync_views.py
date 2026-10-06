"""
API-Views fuer den manuellen Excel-Lagerabgleich (Settings-Modul).

Analog zum Legacy-Procurement-Import:
    GET  .../inventory-sync/preview/   -> Dry-Run (aendert nichts)
    POST .../inventory-sync/execute/   -> echter Lauf

Beide laufen SYNCHRON und koennen 1-2 Minuten dauern - der Frontend-Aufruf
muss deshalb ohne Timeout laufen (axios hat per Default keinen).
"""
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .inventory_sync_service import run_inventory_sync


class InventorySyncPreviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            return Response(run_inventory_sync(
                request.user,
                dry_run=True,
                max_files=request.query_params.get('max_files'),
                row_limit=request.query_params.get('row_limit'),
            ))
        except Exception as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class InventorySyncExecuteView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        try:
            dry_run = bool(request.data.get('dry_run', False))
            return Response(run_inventory_sync(
                request.user,
                dry_run=dry_run,
                max_files=request.data.get('max_files'),
                row_limit=request.data.get('row_limit'),
            ))
        except Exception as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
