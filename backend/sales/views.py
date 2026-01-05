from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import FileResponse, HttpResponse, Http404
from .models import (
    Quotation, QuotationItem, MarketingItem, MarketingItemFile,
    SalesTicket, SalesTicketAttachment, SalesTicketComment
)
from .serializers import (
    QuotationListSerializer,
    QuotationDetailSerializer,
    QuotationCreateUpdateSerializer,
    QuotationItemSerializer,
    QuotationItemCreateUpdateSerializer,
    SalesTicketListSerializer,
    SalesTicketDetailSerializer,
    SalesTicketCreateUpdateSerializer,
    SalesTicketAttachmentSerializer,
    SalesTicketCommentSerializer
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
        """Custom queryset mit Jahresfilterung und exclude_ordered"""
        queryset = super().get_queryset()
        
        # Jahresfilter
        year = self.request.query_params.get('year', None)
        if year:
            queryset = queryset.filter(date__year=year)
        
        # Exclude ordered quotations (für Auftragsauswahl)
        exclude_ordered = self.request.query_params.get('exclude_ordered', None)
        if exclude_ordered and exclude_ordered.lower() in ['true', '1', 'yes']:
            queryset = queryset.exclude(status='ORDERED')
        
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
        Dupliziert ein Angebot mit allen Items
        """
        from datetime import timedelta
        
        original = self.get_object()
        original_items = list(original.items.all())
        
        # Erstelle Kopie des Angebots
        original.pk = None
        original.id = None
        original.quotation_number = None
        original.status = 'DRAFT'
        original.date = None  # Wird automatisch beim Speichern gesetzt
        
        # Verlängere Gültigkeit um 30 Tage
        if original.valid_until:
            original.valid_until = original.valid_until + timedelta(days=30)
        
        # Setze created_by
        original.created_by = request.user
        original.pdf_file = None  # Kein PDF für Kopie
        
        original.save()
        
        # Kopiere alle Items
        for item in original_items:
            item.pk = None
            item.id = None
            item.quotation = original
            item.save()
        
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


# ==================== Marketing ViewSets ====================

class MarketingItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Marketing-Items (Newsletter, AppNotes, TechNotes, Broschüren, Shows, Workshops)
    """
    queryset = MarketingItem.objects.prefetch_related('files', 'responsible_employees', 'created_by').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'event_date', 'title']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        from .serializers import MarketingItemSerializer, MarketingItemCreateUpdateSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return MarketingItemCreateUpdateSerializer
        return MarketingItemSerializer
    
    def perform_create(self, serializer):
        """Setze created_by automatisch"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_attachment(self, request, pk=None):
        """Lädt eine Datei für das Marketing-Item hoch"""
        marketing_item = self.get_object()
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({'error': 'Keine Datei hochgeladen'}, status=status.HTTP_400_BAD_REQUEST)
        
        attachment = MarketingItemFile.objects.create(
            marketing_item=marketing_item,
            file=file_obj,
            filename=file_obj.name,
            file_size=file_obj.size,
            content_type=file_obj.content_type or '',
            uploaded_by=request.user
        )
        
        from .serializers import MarketingItemFileSerializer
        serializer = MarketingItemFileSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='delete_attachment/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Löscht einen Dateianhang"""
        marketing_item = self.get_object()
        try:
            attachment = MarketingItemFile.objects.get(id=attachment_id, marketing_item=marketing_item)
            attachment.file.delete()  # Löscht die Datei vom Speicher
            attachment.delete()  # Löscht den Datenbankeintrag
            return Response(status=status.HTTP_204_NO_CONTENT)
        except MarketingItemFile.DoesNotExist:
            raise Http404("Anhang nicht gefunden")
    
    @action(detail=True, methods=['get'], url_path='download_attachment/(?P<attachment_id>[^/.]+)')
    def download_attachment(self, request, pk=None, attachment_id=None):
        """Lädt einen Dateianhang herunter"""
        marketing_item = self.get_object()
        try:
            attachment = MarketingItemFile.objects.get(id=attachment_id, marketing_item=marketing_item)
            return FileResponse(attachment.file.open('rb'), 
                              as_attachment=True, 
                              filename=attachment.filename)
        except MarketingItemFile.DoesNotExist:
            raise Http404("Anhang nicht gefunden")


class MarketingItemFileViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Marketing-Dateien
    """
    queryset = MarketingItemFile.objects.select_related('marketing_item', 'uploaded_by').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['marketing_item']
    
    def get_serializer_class(self):
        from .serializers import MarketingItemFileSerializer
        return MarketingItemFileSerializer
    
    def perform_create(self, serializer):
        """Setze uploaded_by und file_size automatisch"""
        file_obj = self.request.FILES.get('file')
        if file_obj:
            serializer.save(
                uploaded_by=self.request.user,
                filename=file_obj.name,
                file_size=file_obj.size,
                content_type=file_obj.content_type
            )
        else:
            serializer.save(uploaded_by=self.request.user)


# ==================== Sales Ticket ViewSet ====================

class SalesTicketViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Sales-Tickets
    """
    queryset = SalesTicket.objects.select_related('created_by', 'assigned_to').prefetch_related('attachments', 'comments').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'status', 'assigned_to', 'created_by']
    search_fields = ['ticket_number', 'title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'due_date', 'ticket_number']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SalesTicketListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SalesTicketCreateUpdateSerializer
        return SalesTicketDetailSerializer
    
    def perform_create(self, serializer):
        """Setze created_by beim Erstellen"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_attachment(self, request, pk=None):
        """Datei zu Sales-Ticket hochladen"""
        ticket = self.get_object()
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response(
                {'error': 'Keine Datei bereitgestellt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            attachment = SalesTicketAttachment.objects.create(
                ticket=ticket,
                file=file_obj,
                filename=file_obj.name,
                file_size=file_obj.size,
                content_type=file_obj.content_type,
                uploaded_by=request.user
            )
            
            serializer = SalesTicketAttachmentSerializer(attachment, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response(
                {'error': f'Upload fehlgeschlagen: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'], url_path='download-attachment/(?P<attachment_id>[^/.]+)')
    def download_attachment(self, request, pk=None, attachment_id=None):
        """Datei herunterladen"""
        try:
            attachment = SalesTicketAttachment.objects.get(id=attachment_id, ticket_id=pk)
            
            if not attachment.file:
                raise Http404('Datei nicht gefunden')
            
            response = FileResponse(attachment.file.open('rb'))
            response['Content-Disposition'] = f'attachment; filename="{attachment.filename}"'
            response['Content-Type'] = attachment.content_type or 'application/octet-stream'
            
            return response
        
        except SalesTicketAttachment.DoesNotExist:
            raise Http404('Anhang nicht gefunden')
        except Exception as e:
            return Response(
                {'error': f'Download fehlgeschlagen: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['delete'], url_path='delete-attachment/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Datei löschen"""
        try:
            attachment = SalesTicketAttachment.objects.get(id=attachment_id, ticket_id=pk)
            
            # Datei vom Speicher löschen
            if attachment.file:
                attachment.file.delete(save=False)
            
            attachment.delete()
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        
        except SalesTicketAttachment.DoesNotExist:
            raise Http404('Anhang nicht gefunden')
        except Exception as e:
            return Response(
                {'error': f'Löschen fehlgeschlagen: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Kommentar zu Sales-Ticket hinzufügen"""
        ticket = self.get_object()
        comment_text = request.data.get('comment')
        
        if not comment_text:
            return Response(
                {'error': 'Kein Kommentar bereitgestellt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            comment = SalesTicketComment.objects.create(
                ticket=ticket,
                comment=comment_text,
                created_by=request.user
            )
            
            serializer = SalesTicketCommentSerializer(comment, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response(
                {'error': f'Kommentar hinzufügen fehlgeschlagen: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

