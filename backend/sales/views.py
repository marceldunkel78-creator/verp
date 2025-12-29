from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import FileResponse, HttpResponse
from .models import Quotation, QuotationItem
from .serializers import (
    QuotationListSerializer,
    QuotationDetailSerializer,
    QuotationCreateUpdateSerializer,
    QuotationItemSerializer,
    QuotationItemCreateUpdateSerializer
)
import traceback
import json


class QuotationViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Angebote
    """
    queryset = Quotation.objects.select_related('customer', 'created_by').prefetch_related('items').all()
    permission_classes = [AllowAny]  # Temporär für Debugging
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['customer', 'status', 'language', 'created_by']
    search_fields = ['quotation_number', 'reference', 'customer__first_name', 'customer__last_name', 'customer__customer_number']
    ordering_fields = ['date', 'valid_until', 'quotation_number', 'status']
    ordering = ['-date']
    
    def get_queryset(self):
        """Custom queryset mit Jahresfilterung"""
        queryset = super().get_queryset()
        
        # Jahresfilter
        year = self.request.query_params.get('year', None)
        if year:
            queryset = queryset.filter(date__year=year)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return QuotationDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return QuotationCreateUpdateSerializer
        return QuotationListSerializer
    
    def create(self, request, *args, **kwargs):
        """Custom create um items als JSON zu verarbeiten"""
        data = request.data.copy()
        
        # Parse items if it's a JSON string
        if 'items' in data and isinstance(data['items'], str):
            try:
                data['items'] = json.loads(data['items'])
            except json.JSONDecodeError:
                pass
        
        print(f"DEBUG VIEW: Creating quotation with {len(data.get('items', []))} items")
        
        # Trenne items vom rest der Daten
        items_data = data.pop('items', [])
        
        # Check if items_data is a nested list (happens with some JSON parsing)
        if items_data and isinstance(items_data, list) and len(items_data) > 0 and isinstance(items_data[0], list):
            items_data = items_data[0]
            print(f"DEBUG: Unwrapped nested list in create()")
        
        print(f"DEBUG: Items data type: {type(items_data)}, length: {len(items_data) if items_data else 0}")
        if items_data:
            print(f"DEBUG: First item type: {type(items_data[0]) if items_data else 'N/A'}")
            if items_data and isinstance(items_data[0], dict):
                print(f"DEBUG: First item preview: {list(items_data[0].keys())}")
        
        # Create quotation ohne items
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        print(f"DEBUG VIEW: Serializer is valid")
        self.perform_create(serializer)
        instance = serializer.instance
        
        # Items manuell verarbeiten
        print(f"DEBUG: Creating {len(items_data)} items")
        
        for item_data in items_data:
            print(f"DEBUG: Creating item")
            item_serializer = QuotationItemCreateUpdateSerializer(data=item_data)
            
            if item_serializer.is_valid():
                saved_item = item_serializer.save(quotation=instance)
                print(f"DEBUG: Item saved successfully: {saved_item.id}")
            else:
                print(f"DEBUG: Item validation failed: {item_serializer.errors}")
                # Rollback: Lösche das gerade erstellte Angebot
                instance.delete()
                return Response(item_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Nutze DetailSerializer für die Response um items zu inkludieren
        detail_serializer = QuotationDetailSerializer(instance)
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def update(self, request, *args, **kwargs):
        """Custom update um items als JSON zu verarbeiten"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data.copy()
        
        # Parse items if it's a JSON string
        if 'items' in data and isinstance(data['items'], str):
            try:
                data['items'] = json.loads(data['items'])
            except json.JSONDecodeError:
                pass
        
        print(f"DEBUG VIEW: Updating quotation {instance.id} with {len(data.get('items', []))} items")
        if 'items' in data and data['items']:
            print(f"DEBUG VIEW: First item data: {data['items'][0]}")
            print(f"DEBUG VIEW: First item type: {type(data['items'][0])}")
        
        # Trenne items vom rest der Daten
        items_data = data.pop('items', [])
        
        # Check if items_data is a nested list (happens with some JSON parsing)
        if items_data and isinstance(items_data, list) and len(items_data) > 0 and isinstance(items_data[0], list):
            items_data = items_data[0]
            print(f"DEBUG: Unwrapped nested list")
        
        # Check if items_data is already a list - might be double-parsed JSON
        if items_data and isinstance(items_data, str):
            try:
                items_data = json.loads(items_data)
            except:
                pass
        
        print(f"DEBUG: Items data type: {type(items_data)}, length: {len(items_data) if items_data else 0}")
        if items_data:
            print(f"DEBUG: First item type: {type(items_data[0]) if items_data else 'N/A'}")
            if items_data and isinstance(items_data[0], dict):
                print(f"DEBUG: First item: {items_data[0].get('id', 'new')}")
        
        # Update quotation ohne items
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        print(f"DEBUG VIEW: Serializer is valid")
        self.perform_update(serializer)
        
        # Items manuell verarbeiten
        print(f"DEBUG: Processing {len(items_data)} items")
        
        # Bestehende items sammeln
        existing_items = {item.id: item for item in instance.items.all()}
        processed_item_ids = set()
        
        for item_data in items_data:
            print(f"DEBUG: Processing item: {item_data.get('id', 'new')}")
            
            item_id = item_data.get('id')
            
            if item_id and item_id in existing_items:
                # Update existing item
                print(f"DEBUG: Updating existing item {item_id}")
                item_serializer = QuotationItemCreateUpdateSerializer(
                    existing_items[item_id],
                    data=item_data,
                    partial=True
                )
            else:
                # Create new item
                print(f"DEBUG: Creating new item")
                item_serializer = QuotationItemCreateUpdateSerializer(data=item_data)
            
            if item_serializer.is_valid():
                saved_item = item_serializer.save(quotation=instance)
                processed_item_ids.add(saved_item.id)
                print(f"DEBUG: Item saved successfully: {saved_item.id}")
            else:
                print(f"DEBUG: Item validation failed: {item_serializer.errors}")
                return Response(item_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Delete items that weren't in the update
        for item_id, item in existing_items.items():
            if item_id not in processed_item_ids:
                print(f"DEBUG: Deleting item {item_id}")
                item.delete()
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        
        # Nutze DetailSerializer für die Response um items zu inkludieren
        detail_serializer = QuotationDetailSerializer(instance)
        return Response(detail_serializer.data)
    
    def perform_create(self, serializer):
        """Setze den erstellen User"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """
        Generiert und lädt ein PDF für das Angebot herunter
        """
        quotation = self.get_object()
        
        try:
            from .pdf_generator import generate_quotation_pdf
            pdf_buffer = generate_quotation_pdf(quotation)
            
            response = FileResponse(
                pdf_buffer,
                content_type='application/pdf',
                as_attachment=True,
                filename=f'Angebot_{quotation.quotation_number}.pdf'
            )
            return response
        except Exception as e:
            print(f"Error generating PDF: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Fehler beim Generieren des PDFs'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def create_and_save_pdf(self, request, pk=None):
        """
        Generiert PDF, speichert es im Dateisystem und gibt es zurück.
        Setzt den Status auf SENT nach erfolgreicher Erstellung.
        """
        import os
        from django.conf import settings
        from django.core.files.base import ContentFile
        
        quotation = self.get_object()
        
        try:
            from .pdf_generator import generate_quotation_pdf
            pdf_buffer = generate_quotation_pdf(quotation)
            
            # Speichere das PDF im media/quotations/Jahr/ Verzeichnis
            year = quotation.date.year
            save_dir = os.path.join(settings.MEDIA_ROOT, 'quotations', str(year))
            os.makedirs(save_dir, exist_ok=True)
            
            filename = f'Angebot_{quotation.quotation_number}.pdf'
            filepath = os.path.join(save_dir, filename)
            
            # Schreibe Datei
            pdf_content = pdf_buffer.getvalue()
            with open(filepath, 'wb') as f:
                f.write(pdf_content)
            
            # Speichere Datei-Referenz im Model und setze Status auf SENT
            relative_path = f'quotations/{year}/{filename}'
            quotation.pdf_file = relative_path
            quotation.status = 'SENT'
            quotation.save(update_fields=['pdf_file', 'status'])
            
            # Gebe das PDF zurück
            pdf_buffer.seek(0)
            response = FileResponse(
                pdf_buffer,
                content_type='application/pdf',
                as_attachment=False,
                filename=filename
            )
            return response
        except Exception as e:
            print(f"Error generating/saving PDF: {e}")
            traceback.print_exc()
            return Response(
                {'error': f'Fehler beim Generieren des PDFs: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """
        Dupliziert ein Angebot
        """
        original = self.get_object()
        
        # Erstelle Kopie
        original.pk = None
        original.quotation_number = None
        original.status = 'DRAFT'
        original.created_by = request.user
        original.save()
        
        serializer = QuotationDetailSerializer(original)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuotationItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Angebotspositionen
    """
    queryset = QuotationItem.objects.select_related('quotation', 'content_type').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['quotation']
    ordering_fields = ['position']
    ordering = ['position']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return QuotationItemCreateUpdateSerializer
        return QuotationItemSerializer
