from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.http import HttpResponse
from django.core.files.base import ContentFile
from django.db.models import Q
from .models import SalesPriceList
from .serializers import (
    SalesPriceListListSerializer,
    SalesPriceListDetailSerializer,
    SalesPriceListCreateUpdateSerializer
)
from .pdf_generator import generate_pricelist_pdf


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class SalesPriceListViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Verkaufs-Preislisten
    
    list: Alle Preislisten anzeigen
    retrieve: Einzelne Preisliste anzeigen
    create: Neue Preisliste erstellen
    update: Preisliste bearbeiten
    destroy: Preisliste löschen
    generate_pdf: PDF generieren
    download_pdf: PDF herunterladen
    """
    queryset = SalesPriceList.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SalesPriceListListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SalesPriceListCreateUpdateSerializer
        return SalesPriceListDetailSerializer
    
    def get_queryset(self):
        queryset = SalesPriceList.objects.select_related(
            'supplier', 'trading_supplier', 'created_by'
        ).order_by('-valid_from_year', '-valid_from_month', 'pricelist_type')
        
        # Filter nach Typ
        pricelist_type = self.request.query_params.get('type')
        if pricelist_type:
            queryset = queryset.filter(pricelist_type=pricelist_type)
        
        # Filter nach Jahr
        year = self.request.query_params.get('year')
        if year:
            try:
                year_int = int(year)
                queryset = queryset.filter(
                    Q(valid_from_year=year_int) | Q(valid_until_year=year_int)
                )
            except ValueError:
                pass
        
        # Filter nach Lieferant
        supplier = self.request.query_params.get('supplier')
        if supplier:
            try:
                supplier_id = int(supplier)
                queryset = queryset.filter(
                    Q(supplier_id=supplier_id) | Q(trading_supplier_id=supplier_id)
                )
            except ValueError:
                pass
        
        # Suche
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(subtitle__icontains=search) |
                Q(supplier__company_name__icontains=search) |
                Q(trading_supplier__company_name__icontains=search)
            )
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        """Generiert das PDF für eine Preisliste"""
        pricelist = self.get_object()
        
        try:
            # PDF generieren
            pdf_bytes = generate_pricelist_pdf(pricelist)
            
            # Dateinamen ermitteln
            filename = pricelist.get_filename()
            
            # Altes PDF löschen wenn vorhanden
            if pricelist.pdf_file:
                pricelist.pdf_file.delete(save=False)
            
            # Neues PDF speichern
            pricelist.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)
            
            # Serializer mit aktualisierten Daten zurückgeben
            serializer = SalesPriceListDetailSerializer(pricelist, context={'request': request})
            return Response({
                'success': True,
                'message': 'PDF wurde erfolgreich generiert.',
                'data': serializer.data
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Fehler beim Generieren des PDFs: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Lädt das PDF einer Preisliste herunter"""
        pricelist = self.get_object()
        
        if not pricelist.pdf_file:
            return Response({
                'success': False,
                'message': 'Kein PDF vorhanden. Bitte zuerst generieren.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            response = HttpResponse(
                pricelist.pdf_file.read(),
                content_type='application/pdf'
            )
            response['Content-Disposition'] = f'attachment; filename="{pricelist.get_filename()}"'
            return response
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Fehler beim Herunterladen: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def preview_pdf(self, request, pk=None):
        """Zeigt das PDF im Browser an"""
        pricelist = self.get_object()
        
        if not pricelist.pdf_file:
            return Response({
                'success': False,
                'message': 'Kein PDF vorhanden. Bitte zuerst generieren.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        try:
            response = HttpResponse(
                pricelist.pdf_file.read(),
                content_type='application/pdf'
            )
            response['Content-Disposition'] = f'inline; filename="{pricelist.get_filename()}"'
            return response
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Fehler beim Anzeigen: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def types(self, request):
        """Gibt alle verfügbaren Preislistentypen zurück"""
        return Response([
            {'value': choice[0], 'label': choice[1]}
            for choice in SalesPriceList.PRICELIST_TYPE_CHOICES
        ])
    
    @action(detail=False, methods=['get'])
    def suppliers(self, request):
        """Gibt alle Lieferanten für die Auswahl zurück"""
        from suppliers.models import Supplier
        
        suppliers = Supplier.objects.filter(is_active=True).order_by('company_name')
        
        # Einfache Daten zurückgeben
        return Response([
            {
                'id': s.id,
                'supplier_number': s.supplier_number,
                'company_name': s.company_name
            }
            for s in suppliers
        ])
