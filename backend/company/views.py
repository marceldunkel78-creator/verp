from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import CompanySettings
from .serializers import CompanySettingsSerializer


class CompanySettingsViewSet(viewsets.ViewSet):
    """
    ViewSet für Firmeneinstellungen (Singleton)
    """
    
    def list(self, request):
        """Hole Firmeneinstellungen"""
        settings = CompanySettings.get_settings()
        serializer = CompanySettingsSerializer(settings)
        # Gib als Liste zurück für Kompatibilität
        return Response([serializer.data])
    
    def retrieve(self, request, pk=None):
        """Hole Firmeneinstellungen (ID wird ignoriert, da Singleton)"""
        settings = CompanySettings.get_settings()
        serializer = CompanySettingsSerializer(settings)
        return Response(serializer.data)
    
    def create(self, request):
        """Erstelle/Aktualisiere Firmeneinstellungen (behandelt wie Update)"""
        settings = CompanySettings.get_settings()
        serializer = CompanySettingsSerializer(settings, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, pk=None):
        """Aktualisiere Firmeneinstellungen"""
        settings = CompanySettings.get_settings()
        serializer = CompanySettingsSerializer(settings, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def partial_update(self, request, pk=None):
        """Teilweise Aktualisierung"""
        return self.update(request, pk)
