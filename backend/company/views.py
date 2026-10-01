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

    @action(detail=False, methods=['post'], url_path='clear-logo')
    def clear_logo(self, request):
        """
        Firmenlogo entfernen: Datenbankfeld leeren UND Datei loeschen.

        Warum ein eigener Endpunkt statt PATCH mit document_header='':
        Ein leerer String leert nur das Feld. Die Datei bleibt dann unter
        MEDIA_ROOT/company/ liegen - genau die Datei, die weg soll.
        FieldFile.delete(save=True) macht beides in einem Schritt.

        Danach greift wieder das mitgelieferte Standard-Logo aus der
        Vorlage Q-373Du-0826.pdf (siehe core.pdf_base.company_logo_path).
        """
        settings = CompanySettings.get_settings()
        datei = settings.document_header.name if settings.document_header else None

        if settings.document_header:
            settings.document_header.delete(save=True)
        settings.refresh_from_db()

        if datei:
            return Response({
                'detail': 'Logo entfernt. Die Bestelldokumente verwenden '
                          'jetzt wieder das Standard-Logo aus der Vorlage.',
                'geloeschte_datei': datei,
            })
        return Response({
            'detail': 'Es war kein Logo hinterlegt.',
        }, status=status.HTTP_200_OK)
