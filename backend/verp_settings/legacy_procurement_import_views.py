from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .legacy_procurement_import import (
    import_legacy_procurement_orders,
    preview_legacy_procurement_import,
)


class LegacyProcurementImportPreviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            return Response(preview_legacy_procurement_import())
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LegacyProcurementImportExecuteView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        try:
            dry_run = request.data.get('dry_run', True)
            result = import_legacy_procurement_orders(request.user, dry_run=dry_run)
            return Response(result)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
