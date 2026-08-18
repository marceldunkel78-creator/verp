from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.core.files.base import ContentFile

from .models import (VSService, VSServicePrice, ServiceTicket, RMACase, TicketComment, 
                     TicketChangeLog, TroubleshootingTicket, TroubleshootingComment,
                     ServiceTicketAttachment, TroubleshootingAttachment, ServiceTicketTimeEntry,
                     RMACaseTimeEntry, RMAItem, RMAItemPhoto, RMAReceipt, RMAReturn, RMAReturnItem,
                     RMAAttachment, RMACostLineItem, RMAManufacturerReturn, RMAManufacturerReturnItem)
from .serializers import (
    VSServiceListSerializer, VSServiceDetailSerializer, VSServiceCreateUpdateSerializer,
    VSServicePriceSerializer,
    ServiceTicketListSerializer, ServiceTicketDetailSerializer, ServiceTicketCreateUpdateSerializer,
    TicketCommentSerializer, TicketChangeLogSerializer, ServiceTicketAttachmentSerializer,
    ServiceTicketTimeEntrySerializer,
    RMACaseListSerializer, RMACaseDetailSerializer, RMACaseCreateUpdateSerializer,
    RMACaseTimeEntrySerializer,
    RMAItemSerializer, RMAItemPhotoSerializer, RMAReceiptSerializer,
    RMAReturnSerializer, RMAReturnCreateSerializer, RMAReturnItemSerializer,
    RMAAttachmentSerializer, RMACostLineItemSerializer,
    RMAManufacturerReturnSerializer, RMAManufacturerReturnCreateSerializer, RMAManufacturerReturnItemSerializer,
    TroubleshootingListSerializer, TroubleshootingDetailSerializer, TroubleshootingCreateUpdateSerializer,
    TroubleshootingCommentSerializer, TroubleshootingAttachmentSerializer
)
from .rma_pdf_generator import generate_rma_delivery_note_pdf
from .rma_report_pdf import generate_rma_repair_report_pdf
from .rma_calculation_pdf import generate_rma_calculation_pdf
from .rma_manufacturer_pdf import generate_rma_manufacturer_delivery_note_pdf
from .rma_proforma_pdf import generate_proforma_invoice_pdf
from users.models import Message


class VSServiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet für VS-Service Produkte
    """
    # Pagination für infinite scroll
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = VSService.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['article_number', 'name', 'description', 'short_description']
    ordering_fields = ['article_number', 'name', 'created_at']
    ordering = ['article_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VSServiceListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VSServiceCreateUpdateSerializer
        return VSServiceDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def add_price(self, request, pk=None):
        """Fügt einen neuen Preis hinzu"""
        vs_service = self.get_object()
        serializer = VSServicePriceSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(vs_service=vs_service, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def prices(self, request, pk=None):
        """Gibt alle Preise zurück"""
        vs_service = self.get_object()
        prices = vs_service.prices.all()
        serializer = VSServicePriceSerializer(prices, many=True)
        return Response(serializer.data)


class VSServicePriceViewSet(viewsets.ModelViewSet):
    """
    ViewSet für VS-Service Preise
    """
    queryset = VSServicePrice.objects.all()
    serializer_class = VSServicePriceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['vs_service']
    ordering = ['-valid_from']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ServiceTicketViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Service Tickets
    """
    queryset = ServiceTicket.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'billing', 'customer', 'assigned_to', 'linked_system']
    search_fields = ['ticket_number', 'title', 'description', 'contact_email']
    ordering_fields = ['ticket_number', 'created_at', 'updated_at', 'status', 'title', 'category', 'priority', 'author__last_name']
    ordering = ['-updated_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ServiceTicketListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ServiceTicketCreateUpdateSerializer
        return ServiceTicketDetailSerializer
    
    def get_queryset(self):
        queryset = ServiceTicket.objects.all()
        # Filter für offene/geschlossene Tickets
        is_open = self.request.query_params.get('is_open')
        if is_open is not None:
            if is_open.lower() == 'true':
                queryset = queryset.exclude(status__in=['no_solution', 'resolved'])
            else:
                queryset = queryset.filter(status__in=['no_solution', 'resolved'])
        return queryset
    
    def perform_create(self, serializer):
        ticket = serializer.save(created_by=self.request.user)
        # Ersteller und zugewiesener User werden automatisch als Beobachter hinzugefügt
        if ticket.created_by:
            ticket.watchers.add(ticket.created_by)
        if ticket.assigned_to:
            ticket.watchers.add(ticket.assigned_to)
            # Erstelle Erinnerung und Notification für zugewiesenen User
            try:
                from django.utils import timezone
                from datetime import timedelta
                from users.models import Reminder, Notification
                due = timezone.now().date() + timedelta(days=1)
                Reminder.objects.create(
                    user=ticket.assigned_to,
                    title=f"Zugewiesen: Service-Ticket #{ticket.ticket_number}",
                    description=f"Ticket '{ticket.title}' wurde Ihnen zugewiesen.",
                    due_date=due,
                    related_object_type='service_ticket',
                    related_object_id=ticket.id,
                    related_url=f"/service/tickets/{ticket.id}"
                )
                # Benachrichtigung im NotificationCenter
                Notification.objects.create(
                    user=ticket.assigned_to,
                    title=f"Service-Ticket #{ticket.ticket_number} zugewiesen",
                    message=f"Das Ticket '{ticket.title}' wurde Ihnen zugewiesen.",
                    notification_type='info',
                    related_url=f'/service/tickets/{ticket.id}'
                )
            except Exception:
                pass
    
    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_data = {
            'title': old_instance.title,
            'status': old_instance.status,
            'billing': old_instance.billing,
            'assigned_to': old_instance.assigned_to_id,
            'customer': old_instance.customer_id,
            'contact_email': old_instance.contact_email,
            'linked_rma': old_instance.linked_rma_id,
            'linked_visiview_ticket': old_instance.linked_visiview_ticket,
        }
        old_assigned_to = old_instance.assigned_to
        
        instance = serializer.save()
        
        # Änderungen protokollieren
        field_labels = {
            'title': 'Thema',
            'status': 'Status',
            'billing': 'Abrechnung',
            'assigned_to': 'Zugewiesen an',
            'customer': 'Kunde',
            'contact_email': 'E-Mail',
            'linked_rma': 'Verknüpfte RMA',
            'linked_visiview_ticket': 'VisiView Ticket',
        }
        
        changes = []
        new_data = {
            'title': instance.title,
            'status': instance.status,
            'billing': instance.billing,
            'assigned_to': instance.assigned_to_id,
            'customer': instance.customer_id,
            'contact_email': instance.contact_email,
            'linked_rma': instance.linked_rma_id,
            'linked_visiview_ticket': instance.linked_visiview_ticket,
        }
        
        for field, old_value in old_data.items():
            new_value = new_data.get(field)
            if old_value != new_value:
                TicketChangeLog.objects.create(
                    ticket=instance,
                    field_name=field_labels.get(field, field),
                    old_value=str(old_value or ''),
                    new_value=str(new_value or ''),
                    changed_by=self.request.user
                )
                changes.append(field_labels.get(field, field))
        
        # Wenn "Zugewiesen an" geändert wurde, Beobachter aktualisieren
        if old_assigned_to != instance.assigned_to:
            if old_assigned_to:
                instance.watchers.remove(old_assigned_to)
            if instance.assigned_to:
                instance.watchers.add(instance.assigned_to)
                # Erstelle Erinnerung und Notification für neu zugewiesenen User
                try:
                    from django.utils import timezone
                    from datetime import timedelta
                    from users.models import Reminder, Notification
                    due = timezone.now().date() + timedelta(days=1)
                    Reminder.objects.create(
                        user=instance.assigned_to,
                        title=f"Zugewiesen: Service-Ticket #{instance.ticket_number}",
                        description=f"Ticket '{instance.title}' wurde Ihnen zugewiesen.",
                        due_date=due,
                        related_object_type='service_ticket',
                        related_object_id=instance.id,
                        related_url=f"/service/tickets/{instance.id}"
                    )
                    # Benachrichtigung im NotificationCenter
                    Notification.objects.create(
                        user=instance.assigned_to,
                        title=f"Service-Ticket #{instance.ticket_number} zugewiesen",
                        message=f"Das Ticket '{instance.title}' wurde Ihnen zugewiesen.",
                        notification_type='info',
                        related_url=f'/service/tickets/{instance.id}'
                    )
                except Exception:
                    pass
        
        # Benachrichtigungen an Beobachter senden
        if changes:
            self._send_notifications(instance, f"Ticket {instance.ticket_number} wurde aktualisiert", 
                                    f"Folgende Felder wurden geändert: {', '.join(changes)}")
    
    def _send_notifications(self, ticket, title, content):
        """Sendet Benachrichtigungen an alle Beobachter"""
        for watcher in ticket.watchers.all():
            # Nicht an den User senden, der die Änderung gemacht hat
            if watcher != self.request.user:
                Message.objects.create(
                    sender=self.request.user,
                    user=watcher,
                    title=title,
                    content=content,
                    message_type='ticket',
                    related_ticket=ticket
                )
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_attachment(self, request, pk=None):
        """Lädt eine Datei für das Ticket hoch"""
        ticket = self.get_object()
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({'error': 'Keine Datei hochgeladen'}, status=status.HTTP_400_BAD_REQUEST)
        
        attachment = ServiceTicketAttachment.objects.create(
            ticket=ticket,
            file=file_obj,
            filename=file_obj.name,
            file_size=file_obj.size,
            content_type=file_obj.content_type or '',
            uploaded_by=request.user
        )
        
        serializer = ServiceTicketAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='delete_attachment/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Löscht einen Dateianhang"""
        ticket = self.get_object()
        try:
            attachment = ServiceTicketAttachment.objects.get(id=attachment_id, ticket=ticket)
            attachment.file.delete()  # Löscht die Datei vom Speicher
            attachment.delete()  # Löscht den Datenbankeintrag
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceTicketAttachment.DoesNotExist:
            raise Http404("Anhang nicht gefunden")
    
    @action(detail=True, methods=['get'], url_path='download_attachment/(?P<attachment_id>[^/.]+)')
    def download_attachment(self, request, pk=None, attachment_id=None):
        """Lädt einen Dateianhang herunter"""
        ticket = self.get_object()
        try:
            attachment = ServiceTicketAttachment.objects.get(id=attachment_id, ticket=ticket)
            return FileResponse(attachment.file.open('rb'), 
                              as_attachment=True, 
                              filename=attachment.filename)
        except ServiceTicketAttachment.DoesNotExist:
            raise Http404("Anhang nicht gefunden")
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Fügt einen Kommentar zum Ticket hinzu"""
        ticket = self.get_object()
        comment_text = request.data.get('comment', '').strip()
        
        if not comment_text:
            return Response({'error': 'Kommentar darf nicht leer sein'}, status=status.HTTP_400_BAD_REQUEST)
        
        comment = TicketComment.objects.create(
            ticket=ticket,
            comment=comment_text,
            created_by=request.user
        )
        
        # Änderungsprotokoll für Kommentar
        TicketChangeLog.objects.create(
            ticket=ticket,
            field_name='Kommentar',
            old_value='',
            new_value=f"Neuer Kommentar von {request.user.get_full_name() or request.user.username}",
            changed_by=request.user
        )
        
        # Benachrichtigungen an Beobachter senden
        self._send_notifications(
            ticket,
            f"Neuer Kommentar zu Ticket {ticket.ticket_number}",
            f"{request.user.get_full_name() or request.user.username}: {comment_text[:100]}..."
        )
        
        serializer = TicketCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Gibt alle Kommentare zurück"""
        ticket = self.get_object()
        comments = ticket.comments.all().order_by('-created_at')
        serializer = TicketCommentSerializer(comments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def change_log(self, request, pk=None):
        """Gibt das Änderungsprotokoll zurück"""
        ticket = self.get_object()
        logs = ticket.change_logs.all().order_by('-changed_at')
        serializer = TicketChangeLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def time_entries(self, request, pk=None):
        """Gibt alle Zeiteinträge zurück"""
        ticket = self.get_object()
        entries = ticket.time_entries.all().order_by('-date', '-time')
        serializer = ServiceTicketTimeEntrySerializer(entries, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_time_entry(self, request, pk=None):
        """Fügt einen Zeiteintrag zum Ticket hinzu"""
        from datetime import datetime, date
        ticket = self.get_object()
        
        # Standard-Werte wenn nicht angegeben
        entry_date = request.data.get('date') or date.today().isoformat()
        entry_time = request.data.get('time') or datetime.now().strftime('%H:%M:%S')
        employee_id = request.data.get('employee', request.user.id)
        hours_spent = request.data.get('hours_spent')
        description = request.data.get('description', '').strip()
        
        if not hours_spent:
            return Response({'error': 'Aufgewendete Zeit ist erforderlich'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not description:
            return Response({'error': 'Beschreibung ist erforderlich'}, status=status.HTTP_400_BAD_REQUEST)
        
        time_entry = ServiceTicketTimeEntry.objects.create(
            ticket=ticket,
            date=entry_date,
            time=entry_time,
            employee_id=employee_id,
            hours_spent=hours_spent,
            description=description,
            created_by=request.user
        )
        
        serializer = ServiceTicketTimeEntrySerializer(time_entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['put', 'patch'], url_path='update_time_entry/(?P<entry_id>[^/.]+)')
    def update_time_entry(self, request, pk=None, entry_id=None):
        """Aktualisiert einen Zeiteintrag"""
        ticket = self.get_object()
        try:
            time_entry = ServiceTicketTimeEntry.objects.get(id=entry_id, ticket=ticket)
        except ServiceTicketTimeEntry.DoesNotExist:
            raise Http404("Zeiteintrag nicht gefunden")
        
        # Update fields if provided
        if 'date' in request.data:
            time_entry.date = request.data['date']
        if 'time' in request.data:
            time_entry.time = request.data['time']
        if 'employee' in request.data:
            time_entry.employee_id = request.data['employee']
        if 'hours_spent' in request.data:
            time_entry.hours_spent = request.data['hours_spent']
        if 'description' in request.data:
            time_entry.description = request.data['description']
        
        time_entry.save()
        
        serializer = ServiceTicketTimeEntrySerializer(time_entry)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_time_entry/(?P<entry_id>[^/.]+)')
    def delete_time_entry(self, request, pk=None, entry_id=None):
        """Löscht einen Zeiteintrag"""
        ticket = self.get_object()
        try:
            time_entry = ServiceTicketTimeEntry.objects.get(id=entry_id, ticket=ticket)
            time_entry.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceTicketTimeEntry.DoesNotExist:
            raise Http404("Zeiteintrag nicht gefunden")
    
    @action(detail=True, methods=['post'])
    def update_watchers(self, request, pk=None):
        """Aktualisiert die Beobachterliste"""
        ticket = self.get_object()
        watcher_ids = request.data.get('watcher_ids', [])
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Setze neue Beobachter
        ticket.watchers.clear()
        for user_id in watcher_ids:
            try:
                user = User.objects.get(id=user_id)
                ticket.watchers.add(user)
            except User.DoesNotExist:
                pass
        
        # Ersteller und zugewiesener User sollten immer Beobachter sein
        if ticket.created_by:
            ticket.watchers.add(ticket.created_by)
        if ticket.assigned_to:
            ticket.watchers.add(ticket.assigned_to)
        
        return Response({'status': 'success', 'watcher_ids': list(ticket.watchers.values_list('id', flat=True))})
    
    @action(detail=False, methods=['get'])
    def open_tickets(self, request):
        """Gibt nur offene Tickets zurück"""
        queryset = self.get_queryset().exclude(status__in=['no_solution', 'resolved'])
        serializer = ServiceTicketListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def create_rma(self, request, pk=None):
        """Erstellt einen neuen RMA-Fall und verknüpft ihn mit diesem Ticket"""
        ticket = self.get_object()
        
        rma_data = {
            'title': f"RMA zu Ticket {ticket.ticket_number}",
            'description': ticket.description,
            'customer': ticket.customer_id,
            'customer_name': str(ticket.customer) if ticket.customer else '',
            'customer_email': ticket.contact_email,
        }
        
        rma = RMACase.objects.create(**rma_data, created_by=request.user)
        ticket.linked_rma = rma
        ticket.save()
        
        # Änderungsprotokoll
        TicketChangeLog.objects.create(
            ticket=ticket,
            field_name='Verknüpfte RMA',
            old_value='',
            new_value=rma.rma_number,
            changed_by=request.user
        )
        
        return Response({
            'rma_id': rma.id,
            'rma_number': rma.rma_number,
            'message': f'RMA {rma.rma_number} erstellt und verknüpft'
        }, status=status.HTTP_201_CREATED)


class RMACaseViewSet(viewsets.ModelViewSet):
    """
    ViewSet für RMA-Fälle
    """
    queryset = RMACase.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'customer', 'warranty_status', 'assigned_to', 'linked_system', 'customer_order', 'service_ticket']
    search_fields = ['rma_number', 'title', 'description', 'serial_number', 'product_name']
    ordering_fields = ['rma_number', 'created_at', 'status', 'title', 'customer__last_name', 'product_serial', 'received_date']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return RMACaseListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return RMACaseCreateUpdateSerializer
        return RMACaseDetailSerializer
    
    def create(self, request, *args, **kwargs):
        """Override create to return RMACaseDetailSerializer response"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        detail_serializer = RMACaseDetailSerializer(serializer.instance, context={'request': request})
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def update(self, request, *args, **kwargs):
        """Override update to return RMACaseDetailSerializer response"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        
        detail_serializer = RMACaseDetailSerializer(serializer.instance, context={'request': request})
        return Response(detail_serializer.data)
    
    def perform_create(self, serializer):
        # Standard-Stundensatz und Verwaltungskostenpauschale aus Firmeneinstellungen übernehmen, falls nicht gesetzt
        from company.models import CompanySettings
        settings = CompanySettings.get_settings()
        if 'hourly_rate' not in serializer.validated_data or serializer.validated_data.get('hourly_rate') in (None, ''):
            serializer.validated_data['hourly_rate'] = settings.default_hourly_rate or 0
        if 'admin_fee' not in serializer.validated_data or serializer.validated_data.get('admin_fee') in (None, ''):
            serializer.validated_data['admin_fee'] = settings.default_admin_fee or 0
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        """Gibt alle Positionen eines RMA-Falls zurück"""
        rma_case = self.get_object()
        items = rma_case.items.all()
        serializer = RMAItemSerializer(items, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Fügt eine Position zur Warenlieferung hinzu"""
        from django.db.models import Max
        rma_case = self.get_object()
        
        max_pos = rma_case.items.aggregate(max_pos=Max('position'))['max_pos'] or 0
        request.data['position'] = max_pos + 1
        request.data['rma_case'] = rma_case.id
        
        serializer = RMAItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def create_receipt(self, request, pk=None):
        """Erstellt den Wareneingang"""
        rma_case = self.get_object()
        
        if hasattr(rma_case, 'receipt'):
            return Response(
                {'error': 'Wareneingang existiert bereits'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        receipt_date = request.data.get('receipt_date')
        receipt = RMAReceipt.objects.create(
            rma_case=rma_case,
            receipt_date=receipt_date,
            received_by=request.user,
            notes=request.data.get('notes', '')
        )
        
        # Falls noch nicht gesetzt, Eingangsdatum am Fall selbst nachtragen
        if not rma_case.received_date:
            rma_case.received_date = receipt_date
            rma_case.save()
        
        serializer = RMAReceiptSerializer(receipt)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def upload_receipt_document(self, request, pk=None):
        """Lädt den Eingangslieferschein zum Wareneingang hoch"""
        rma_case = self.get_object()
        
        if not hasattr(rma_case, 'receipt'):
            return Response(
                {'error': 'Wareneingang existiert noch nicht'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        receipt = rma_case.receipt
        file = request.FILES.get('file')
        
        if not file:
            return Response(
                {'error': 'Keine Datei hochgeladen'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        receipt.delivery_note = file
        receipt.save()
        serializer = RMAReceiptSerializer(receipt)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def upload_photo(self, request, pk=None):
        """Lädt ein Foto zu einer Position hoch"""
        rma_case = self.get_object()
        item_id = request.data.get('item_id')
        
        item = get_object_or_404(RMAItem, id=item_id, rma_case=rma_case)
        
        photo = RMAItemPhoto.objects.create(
            rma_item=item,
            photo=request.FILES.get('photo'),
            description=request.data.get('description', ''),
            uploaded_by=request.user
        )
        
        serializer = RMAItemPhotoSerializer(photo)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def create_return(self, request, pk=None):
        """Erstellt einen Warenausgang und generiert den Lieferschein"""
        rma_case = self.get_object()
        
        items_data = request.data.get('items', [])
        if not items_data:
            return Response(
                {'error': 'Keine Positionen zum Versand ausgewählt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.utils.dateparse import parse_date
        
        raw_date = request.data.get('return_date')
        if isinstance(raw_date, str):
            parsed_date = parse_date(raw_date)
            if parsed_date is None:
                return Response({'error': 'Ungültiges Datum für return_date'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            parsed_date = raw_date
        
        rma_return = RMAReturn.objects.create(
            rma_case=rma_case,
            return_date=parsed_date,
            shipping_carrier=request.data.get('shipping_carrier', ''),
            tracking_number=request.data.get('tracking_number', ''),
            notes=request.data.get('notes', ''),
            created_by=request.user
        )
        
        for item_data in items_data:
            RMAReturnItem.objects.create(
                rma_return=rma_return,
                rma_item_id=item_data.get('rma_item_id'),
                quantity_returned=item_data.get('quantity_returned', 0),
                condition_notes=item_data.get('condition_notes', '')
            )
        
        # Sprache für den Lieferschein auswerten (de/en)
        language = request.data.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'
        pdf_content = generate_rma_delivery_note_pdf(rma_return, language=language)
        filename = f"Lieferschein_{rma_return.return_number}.pdf"
        rma_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
        
        # Falls noch nicht gesetzt, Versanddatum am Fall selbst nachtragen
        if not rma_case.shipped_date:
            rma_case.shipped_date = parsed_date
            rma_case.save()
        
        serializer = RMAReturnSerializer(rma_return)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'], url_path='returns')
    def get_returns(self, request, pk=None):
        """Gibt alle Warenausgänge eines RMA-Falls zurück"""
        rma_case = self.get_object()
        returns = rma_case.returns.all()
        serializer = RMAReturnSerializer(returns, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def create_manufacturer_return(self, request, pk=None):
        """Erstellt eine Herstellerreparatur und generiert den Lieferschein"""
        rma_case = self.get_object()
        
        items_data = request.data.get('items', [])
        if not items_data:
            return Response(
                {'error': 'Keine Positionen zum Versand ausgewählt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.utils.dateparse import parse_date
        
        raw_date = request.data.get('return_date')
        if isinstance(raw_date, str):
            parsed_date = parse_date(raw_date)
            if parsed_date is None:
                return Response({'error': 'Ungültiges Datum für return_date'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            parsed_date = raw_date
        
        manufacturer_return = RMAManufacturerReturn.objects.create(
            rma_case=rma_case,
            return_date=parsed_date,
            shipping_carrier=request.data.get('shipping_carrier', ''),
            tracking_number=request.data.get('tracking_number', ''),
            notes=request.data.get('notes', ''),
            proforma_title=request.data.get('proforma_title', 'Proforma Invoice – For Customs Purposes Only / No Commercial Value'),
            proforma_comment=request.data.get('proforma_comment', ''),
            proforma_address_name=request.data.get('proforma_address_name', ''),
            proforma_address_street=request.data.get('proforma_address_street', ''),
            proforma_address_house_number=request.data.get('proforma_address_house_number', ''),
            proforma_address_postal_code=request.data.get('proforma_address_postal_code', ''),
            proforma_address_city=request.data.get('proforma_address_city', ''),
            proforma_address_country=request.data.get('proforma_address_country', ''),
            created_by=request.user
        )
        
        for item_data in items_data:
            RMAManufacturerReturnItem.objects.create(
                manufacturer_return=manufacturer_return,
                rma_item_id=item_data.get('rma_item_id'),
                quantity_returned=item_data.get('quantity_returned', 0),
                condition_notes=item_data.get('condition_notes', ''),
                proforma_description=item_data.get('proforma_description', ''),
                proforma_weight=item_data.get('proforma_weight'),
                proforma_hs_code=item_data.get('proforma_hs_code', ''),
                proforma_value=item_data.get('proforma_value'),
                proforma_origin_country=item_data.get('proforma_origin_country', '')
            )
        
        # Sprache für den Lieferschein auswerten (de/en)
        language = request.data.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'
        pdf_content = generate_rma_manufacturer_delivery_note_pdf(manufacturer_return, language=language)
        filename = f"Lieferschein_{manufacturer_return.return_number}.pdf"
        manufacturer_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
        
        # Falls noch nicht gesetzt, Versanddatum zum Hersteller am Fall selbst nachtragen
        if not rma_case.manufacturer_ship_date:
            rma_case.manufacturer_ship_date = parsed_date
            rma_case.save()
        
        serializer = RMAManufacturerReturnSerializer(manufacturer_return)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'], url_path='manufacturer-returns')
    def get_manufacturer_returns(self, request, pk=None):
        """Gibt alle Herstellerreparaturen eines RMA-Falls zurück"""
        rma_case = self.get_object()
        manufacturer_returns = rma_case.manufacturer_returns.all()
        serializer = RMAManufacturerReturnSerializer(manufacturer_returns, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def generate_report_pdf(self, request, pk=None):
        """Generiert den Reparaturbericht als PDF und legt ihn im Medienordner ab"""
        rma_case = self.get_object()
        
        try:
            language = request.data.get('language', 'de')
            if language not in ('de', 'en'):
                language = 'de'
            pdf_buffer = generate_rma_repair_report_pdf(rma_case, language=language)
            
            filename = f"Reparaturbericht_{rma_case.rma_number}.pdf"
            
            # Alte PDF-Datei löschen, bevor neue gespeichert wird
            if rma_case.report_pdf:
                old_file = rma_case.report_pdf
                rma_case.report_pdf = None
                rma_case.save(update_fields=['report_pdf'])
                old_file.delete(save=False)
            
            rma_case.report_pdf.save(filename, ContentFile(pdf_buffer), save=True)
            
            serializer = RMACaseDetailSerializer(rma_case, context={'request': request})
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Fehler bei der PDF-Generierung: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def download_report_pdf(self, request, pk=None):
        """Download des Reparaturberichts"""
        rma_case = self.get_object()
        
        if not rma_case.report_pdf:
            return Response(
                {'error': 'Noch kein Reparaturbericht generiert'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        response = HttpResponse(rma_case.report_pdf.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Reparaturbericht_{rma_case.rma_number}.pdf"'
        return response
    
    @action(detail=True, methods=['get'])
    def view_report_pdf(self, request, pk=None):
        """Zeigt den Reparaturbericht inline im Browser an"""
        rma_case = self.get_object()
        
        if not rma_case.report_pdf:
            return Response(
                {'error': 'Noch kein Reparaturbericht generiert'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        response = HttpResponse(rma_case.report_pdf.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="Reparaturbericht_{rma_case.rma_number}.pdf"'
        return response
    
    @action(detail=True, methods=['get'])
    def download_calculation_pdf(self, request, pk=None):
        """Generiert und lädt die RMA-Kalkulation als PDF (Dokumentation, keine Rechnung)"""
        rma_case = self.get_object()
        
        language = request.query_params.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'
        
        try:
            pdf_buffer = generate_rma_calculation_pdf(rma_case, language=language)
            filename = f"RMA_Kalkulation_{rma_case.rma_number}.pdf"
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response(
                {'error': f'Fehler bei der PDF-Generierung: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def view_calculation_pdf(self, request, pk=None):
        """Zeigt die RMA-Kalkulation inline im Browser an"""
        rma_case = self.get_object()
        
        language = request.query_params.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'
        
        try:
            pdf_buffer = generate_rma_calculation_pdf(rma_case, language=language)
            filename = f"RMA_Kalkulation_{rma_case.rma_number}.pdf"
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return response
        except Exception as e:
            return Response(
                {'error': f'Fehler bei der PDF-Generierung: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def time_entries(self, request, pk=None):
        """Gibt alle Zeiteinträge zurück"""
        rma_case = self.get_object()
        entries = rma_case.time_entries.all().order_by('-date', '-time')
        serializer = RMACaseTimeEntrySerializer(entries, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_time_entry(self, request, pk=None):
        """Fügt einen Zeiteintrag zum RMA-Fall hinzu"""
        from datetime import datetime, date
        rma_case = self.get_object()
        
        # Standard-Werte wenn nicht angegeben
        entry_date = request.data.get('date') or date.today().isoformat()
        entry_time = request.data.get('time') or datetime.now().strftime('%H:%M:%S')
        employee_id = request.data.get('employee', request.user.id)
        hours_spent = request.data.get('hours_spent')
        description = request.data.get('description', '').strip()
        
        if not hours_spent:
            return Response({'error': 'Aufgewendete Zeit ist erforderlich'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not description:
            return Response({'error': 'Beschreibung ist erforderlich'}, status=status.HTTP_400_BAD_REQUEST)
        
        time_entry = RMACaseTimeEntry.objects.create(
            rma_case=rma_case,
            date=entry_date,
            time=entry_time,
            employee_id=employee_id,
            hours_spent=hours_spent,
            description=description,
            created_by=request.user
        )
        
        serializer = RMACaseTimeEntrySerializer(time_entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['put', 'patch'], url_path='update_time_entry/(?P<entry_id>[^/.]+)')
    def update_time_entry(self, request, pk=None, entry_id=None):
        """Aktualisiert einen Zeiteintrag"""
        rma_case = self.get_object()
        try:
            time_entry = RMACaseTimeEntry.objects.get(id=entry_id, rma_case=rma_case)
        except RMACaseTimeEntry.DoesNotExist:
            raise Http404("Zeiteintrag nicht gefunden")
        
        # Update fields if provided
        if 'date' in request.data:
            time_entry.date = request.data['date']
        if 'time' in request.data:
            time_entry.time = request.data['time']
        if 'employee' in request.data:
            time_entry.employee_id = request.data['employee']
        if 'hours_spent' in request.data:
            time_entry.hours_spent = request.data['hours_spent']
        if 'description' in request.data:
            time_entry.description = request.data['description']
        
        time_entry.save()
        
        serializer = RMACaseTimeEntrySerializer(time_entry)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_time_entry/(?P<entry_id>[^/.]+)')
    def delete_time_entry(self, request, pk=None, entry_id=None):
        """Löscht einen Zeiteintrag"""
        rma_case = self.get_object()
        try:
            time_entry = RMACaseTimeEntry.objects.get(id=entry_id, rma_case=rma_case)
            time_entry.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except RMACaseTimeEntry.DoesNotExist:
            raise Http404("Zeiteintrag nicht gefunden")
    
    @action(detail=True, methods=['post'])
    def upload_attachment(self, request, pk=None):
        """Lädt ein Auftragsdokument zum RMA-Fall hoch"""
        rma_case = self.get_object()
        file = request.FILES.get('file')
        
        if not file:
            return Response(
                {'error': 'Keine Datei hochgeladen'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        attachment = RMAAttachment.objects.create(
            rma_case=rma_case,
            file=file,
            description=request.data.get('description', ''),
            uploaded_by=request.user
        )
        
        serializer = RMAAttachmentSerializer(attachment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='delete_attachment/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Löscht ein Auftragsdokument"""
        rma_case = self.get_object()
        try:
            attachment = RMAAttachment.objects.get(id=attachment_id, rma_case=rma_case)
            attachment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except RMAAttachment.DoesNotExist:
            raise Http404("Dokument nicht gefunden")
    
    @action(detail=True, methods=['post'])
    def add_cost_line_item(self, request, pk=None):
        """Fügt einen Kostenposten zur RMA-Kalkulation hinzu"""
        rma_case = self.get_object()
        
        cost_type = request.data.get('cost_type', 'material')
        if cost_type not in ('material', 'labor', 'shipping'):
            cost_type = 'material'
        
        line = RMACostLineItem.objects.create(
            rma_case=rma_case,
            cost_type=cost_type,
            description=request.data.get('description', ''),
            quantity=request.data.get('quantity', 1),
            unit=request.data.get('unit', 'Stk'),
            unit_price=request.data.get('unit_price', 0)
        )
        
        serializer = RMACostLineItemSerializer(line)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='delete_cost_line_item/(?P<line_id>[^/.]+)')
    def delete_cost_line_item(self, request, pk=None, line_id=None):
        """Löscht einen Kostenposten"""
        rma_case = self.get_object()
        try:
            line = RMACostLineItem.objects.get(id=line_id, rma_case=rma_case)
            line.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except RMACostLineItem.DoesNotExist:
            raise Http404("Kostenposition nicht gefunden")
    
    @action(detail=True, methods=['post'])
    def import_time_to_labor(self, request, pk=None):
        """Importiert Zeiteinträge in Arbeitskosten-Positionen (Stunden x Stundensatz)"""
        rma_case = self.get_object()
        
        # Stundensatz aus Firmeneinstellungen oder vom Fall
        from company.models import CompanySettings
        settings = CompanySettings.get_settings()
        hourly_rate = request.data.get('hourly_rate')
        if hourly_rate in (None, ''):
            hourly_rate = rma_case.hourly_rate or settings.default_hourly_rate or 0
        
        entry_id = request.data.get('entry_id')
        
        if entry_id:
            entries = rma_case.time_entries.filter(id=entry_id)
        else:
            # Alle Zeiteinträge importieren, die noch keinen Kostenposten haben
            already_imported = RMACostLineItem.objects.filter(
                rma_case=rma_case,
                source_time_entry__isnull=False
            ).values_list('source_time_entry_id', flat=True)
            entries = rma_case.time_entries.exclude(id__in=already_imported)
        
        imported_count = 0
        for entry in entries:
            # Bereits importierte überspringen
            if RMACostLineItem.objects.filter(rma_case=rma_case, source_time_entry=entry).exists():
                continue
            RMACostLineItem.objects.create(
                rma_case=rma_case,
                cost_type='labor',
                description=f"Zeiterfassung {entry.date.strftime('%d.%m.%Y')}: {entry.description[:250]}" if entry.description else f"Zeiterfassung {entry.date.strftime('%d.%m.%Y')}",
                quantity=entry.hours_spent,
                unit='Std',
                unit_price=hourly_rate,
                source_time_entry=entry
            )
            imported_count += 1
        
        detail_serializer = RMACaseDetailSerializer(rma_case, context={'request': request})
        return Response({
            'imported': imported_count,
            'hourly_rate': hourly_rate,
            'rma_case': detail_serializer.data
        })


class RMAItemViewSet(viewsets.ModelViewSet):
    """ViewSet für RMA-Positionen"""
    permission_classes = [IsAuthenticated]
    queryset = RMAItem.objects.all()
    serializer_class = RMAItemSerializer


class RMAReturnViewSet(viewsets.ModelViewSet):
    """ViewSet für Warenausgänge (Rückversand)"""
    permission_classes = [IsAuthenticated]
    queryset = RMAReturn.objects.all().order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return RMAReturnCreateSerializer
        return RMAReturnSerializer
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Download des Lieferscheins"""
        rma_return = self.get_object()
        language = request.query_params.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'

        # Wenn gewünschte Sprache von der gespeicherten Datei abweicht, neu generieren
        if not rma_return.pdf_file or rma_return.pdf_language != language:
            pdf_content = generate_rma_delivery_note_pdf(rma_return, language=language)
            filename = f"Lieferschein_{rma_return.return_number}.pdf"
            rma_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
            rma_return.pdf_language = language
            rma_return.save(update_fields=['pdf_language'])

        response = HttpResponse(rma_return.pdf_file.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Lieferschein_{rma_return.return_number}.pdf"'
        return response
    
    @action(detail=True, methods=['get'])
    def view_pdf(self, request, pk=None):
        """Zeigt den Lieferschein inline im Browser an (neuer Tab)"""
        rma_return = self.get_object()
        language = request.query_params.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'

        if not rma_return.pdf_file or rma_return.pdf_language != language:
            pdf_content = generate_rma_delivery_note_pdf(rma_return, language=language)
            filename = f"Lieferschein_{rma_return.return_number}.pdf"
            rma_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
            rma_return.pdf_language = language
            rma_return.save(update_fields=['pdf_language'])

        response = HttpResponse(rma_return.pdf_file.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="Lieferschein_{rma_return.return_number}.pdf"'
        return response
    
    @action(detail=True, methods=['post'])
    def regenerate_pdf(self, request, pk=None):
        """Regeneriert den PDF-Lieferschein"""
        rma_return = self.get_object()
        language = request.data.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'

        if rma_return.pdf_file:
            rma_return.pdf_file.delete(save=False)
        
        pdf_content = generate_rma_delivery_note_pdf(rma_return, language=language)
        filename = f"Lieferschein_{rma_return.return_number}.pdf"
        rma_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
        rma_return.pdf_language = language
        rma_return.save(update_fields=['pdf_language'])
        
        serializer = RMAReturnSerializer(rma_return)
        return Response(serializer.data)
    
    def perform_destroy(self, instance):
        """Löscht den Warenausgang inkl. PDF, sodass der Lieferschein neu erstellt werden kann"""
        if instance.pdf_file:
            instance.pdf_file.delete(save=False)
        instance.delete()


class RMAManufacturerReturnViewSet(viewsets.ModelViewSet):
    """ViewSet für Herstellerreparaturen (Versand an den Hersteller)"""
    permission_classes = [IsAuthenticated]
    queryset = RMAManufacturerReturn.objects.all().order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return RMAManufacturerReturnCreateSerializer
        return RMAManufacturerReturnSerializer
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Download des Hersteller-Lieferscheins"""
        manufacturer_return = self.get_object()
        language = request.query_params.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'

        if not manufacturer_return.pdf_file or manufacturer_return.pdf_language != language:
            pdf_content = generate_rma_manufacturer_delivery_note_pdf(manufacturer_return, language=language)
            filename = f"Lieferschein_{manufacturer_return.return_number}.pdf"
            manufacturer_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
            manufacturer_return.pdf_language = language
            manufacturer_return.save(update_fields=['pdf_language'])

        response = HttpResponse(manufacturer_return.pdf_file.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Lieferschein_{manufacturer_return.return_number}.pdf"'
        return response
    
    @action(detail=True, methods=['get'])
    def view_pdf(self, request, pk=None):
        """Zeigt den Hersteller-Lieferschein inline im Browser an (neuer Tab)"""
        manufacturer_return = self.get_object()
        language = request.query_params.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'

        if not manufacturer_return.pdf_file or manufacturer_return.pdf_language != language:
            pdf_content = generate_rma_manufacturer_delivery_note_pdf(manufacturer_return, language=language)
            filename = f"Lieferschein_{manufacturer_return.return_number}.pdf"
            manufacturer_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
            manufacturer_return.pdf_language = language
            manufacturer_return.save(update_fields=['pdf_language'])

        response = HttpResponse(manufacturer_return.pdf_file.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="Lieferschein_{manufacturer_return.return_number}.pdf"'
        return response
    
    @action(detail=True, methods=['post'])
    def regenerate_pdf(self, request, pk=None):
        """Regeneriert den Hersteller-Lieferschein"""
        manufacturer_return = self.get_object()
        language = request.data.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'

        if manufacturer_return.pdf_file:
            manufacturer_return.pdf_file.delete(save=False)
        
        pdf_content = generate_rma_manufacturer_delivery_note_pdf(manufacturer_return, language=language)
        filename = f"Lieferschein_{manufacturer_return.return_number}.pdf"
        manufacturer_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
        manufacturer_return.pdf_language = language
        manufacturer_return.save(update_fields=['pdf_language'])
        
        serializer = RMAManufacturerReturnSerializer(manufacturer_return)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def generate_proforma_pdf(self, request, pk=None):
        """Generiert die Proforma-Invoice (immer Englisch)"""
        manufacturer_return = self.get_object()
        
        # Titel, Kommentar und Adresse aus dem Request übernehmen (editierbar)
        if 'proforma_title' in request.data:
            manufacturer_return.proforma_title = request.data.get('proforma_title', '')
        if 'proforma_comment' in request.data:
            manufacturer_return.proforma_comment = request.data.get('proforma_comment', '')
        if 'proforma_address_name' in request.data:
            manufacturer_return.proforma_address_name = request.data.get('proforma_address_name', '')
        if 'proforma_address_street' in request.data:
            manufacturer_return.proforma_address_street = request.data.get('proforma_address_street', '')
        if 'proforma_address_house_number' in request.data:
            manufacturer_return.proforma_address_house_number = request.data.get('proforma_address_house_number', '')
        if 'proforma_address_postal_code' in request.data:
            manufacturer_return.proforma_address_postal_code = request.data.get('proforma_address_postal_code', '')
        if 'proforma_address_city' in request.data:
            manufacturer_return.proforma_address_city = request.data.get('proforma_address_city', '')
        if 'proforma_address_country' in request.data:
            manufacturer_return.proforma_address_country = request.data.get('proforma_address_country', '')
        manufacturer_return.save()
        
        if manufacturer_return.proforma_pdf:
            manufacturer_return.proforma_pdf.delete(save=False)
        
        pdf_content = generate_proforma_invoice_pdf(manufacturer_return)
        filename = f"Proforma_Invoice_{manufacturer_return.return_number}.pdf"
        manufacturer_return.proforma_pdf.save(filename, ContentFile(pdf_content), save=True)
        
        serializer = RMAManufacturerReturnSerializer(manufacturer_return)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def download_proforma_pdf(self, request, pk=None):
        """Download der Proforma-Invoice"""
        manufacturer_return = self.get_object()
        
        if not manufacturer_return.proforma_pdf:
            pdf_content = generate_proforma_invoice_pdf(manufacturer_return)
            filename = f"Proforma_Invoice_{manufacturer_return.return_number}.pdf"
            manufacturer_return.proforma_pdf.save(filename, ContentFile(pdf_content), save=True)
        
        response = HttpResponse(manufacturer_return.proforma_pdf.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Proforma_Invoice_{manufacturer_return.return_number}.pdf"'
        return response
    
    @action(detail=True, methods=['get'])
    def view_proforma_pdf(self, request, pk=None):
        """Zeigt die Proforma-Invoice inline im Browser an (neuer Tab)"""
        manufacturer_return = self.get_object()
        
        if not manufacturer_return.proforma_pdf:
            pdf_content = generate_proforma_invoice_pdf(manufacturer_return)
            filename = f"Proforma_Invoice_{manufacturer_return.return_number}.pdf"
            manufacturer_return.proforma_pdf.save(filename, ContentFile(pdf_content), save=True)
        
        response = HttpResponse(manufacturer_return.proforma_pdf.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="Proforma_Invoice_{manufacturer_return.return_number}.pdf"'
        return response
    
    def perform_destroy(self, instance):
        """Löscht die Herstellerreparatur inkl. PDF, sodass der Lieferschein neu erstellt werden kann"""
        if instance.pdf_file:
            instance.pdf_file.delete(save=False)
        if instance.proforma_pdf:
            instance.proforma_pdf.delete(save=False)
        instance.delete()


class RMAItemPhotoViewSet(viewsets.ModelViewSet):
    """ViewSet für RMA-Positions-Fotos"""
    permission_classes = [IsAuthenticated]
    queryset = RMAItemPhoto.objects.all()
    serializer_class = RMAItemPhotoSerializer
    
    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class RMAAttachmentViewSet(viewsets.ModelViewSet):
    """ViewSet für RMA Auftragsdokumente"""
    permission_classes = [IsAuthenticated]
    queryset = RMAAttachment.objects.all()
    serializer_class = RMAAttachmentSerializer
    
    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class RMACostLineItemViewSet(viewsets.ModelViewSet):
    """ViewSet für RMA Kostenpositionen"""
    permission_classes = [IsAuthenticated]
    queryset = RMACostLineItem.objects.all()
    serializer_class = RMACostLineItemSerializer


class TroubleshootingViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Troubleshooting Tickets
    """
    queryset = TroubleshootingTicket.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'category', 'assigned_to']
    search_fields = ['ticket_number', 'title', 'description', 'root_cause', 'corrective_action', 'affected_version']
    ordering_fields = ['ticket_number', 'created_at', 'updated_at', 'status', 'priority']
    ordering = ['-updated_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TroubleshootingListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return TroubleshootingCreateUpdateSerializer
        return TroubleshootingDetailSerializer
    
    def get_queryset(self):
        queryset = TroubleshootingTicket.objects.all()
        # Filter für offene/geschlossene Tickets
        is_open = self.request.query_params.get('is_open')
        if is_open is not None:
            if is_open.lower() == 'true':
                queryset = queryset.exclude(status__in=['resolved', 'closed'])
            else:
                queryset = queryset.filter(status__in=['resolved', 'closed'])
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(author=self.request.user, last_changed_by=self.request.user)
    
    def perform_update(self, serializer):
        serializer.save(last_changed_by=self.request.user)
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_attachment(self, request, pk=None):
        """Lädt eine Datei für das Ticket hoch"""
        ticket = self.get_object()
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({'error': 'Keine Datei hochgeladen'}, status=status.HTTP_400_BAD_REQUEST)
        
        is_image = False
        if file_obj.content_type:
            is_image = file_obj.content_type.startswith('image/')
        else:
            lower_name = (file_obj.name or '').lower()
            is_image = lower_name.endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'))

        has_primary = ticket.attachments.filter(is_primary=True).exists()

        attachment = TroubleshootingAttachment.objects.create(
            ticket=ticket,
            file=file_obj,
            filename=file_obj.name,
            file_size=file_obj.size,
            content_type=file_obj.content_type or '',
            is_primary=(is_image and not has_primary),
            uploaded_by=request.user
        )
        
        serializer = TroubleshootingAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='delete_attachment/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Löscht einen Dateianhang"""
        ticket = self.get_object()
        try:
            attachment = TroubleshootingAttachment.objects.get(id=attachment_id, ticket=ticket)
            attachment.file.delete()
            attachment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except TroubleshootingAttachment.DoesNotExist:
            raise Http404("Anhang nicht gefunden")

    @action(detail=True, methods=['post'], url_path='set_primary_attachment/(?P<attachment_id>[^/.]+)')
    def set_primary_attachment(self, request, pk=None, attachment_id=None):
        """Setzt ein Bild als Hauptfoto"""
        ticket = self.get_object()
        try:
            attachment = TroubleshootingAttachment.objects.get(id=attachment_id, ticket=ticket)
        except TroubleshootingAttachment.DoesNotExist:
            raise Http404("Anhang nicht gefunden")

        attachment.is_primary = True
        attachment.save()
        serializer = TroubleshootingAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='download_attachment/(?P<attachment_id>[^/.]+)')
    def download_attachment(self, request, pk=None, attachment_id=None):
        """Lädt einen Dateianhang herunter"""
        ticket = self.get_object()
        try:
            attachment = TroubleshootingAttachment.objects.get(id=attachment_id, ticket=ticket)
            return FileResponse(attachment.file.open('rb'), 
                              as_attachment=True, 
                              filename=attachment.filename)
        except TroubleshootingAttachment.DoesNotExist:
            raise Http404("Anhang nicht gefunden")
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Fügt einen Kommentar zum Ticket hinzu"""
        ticket = self.get_object()
        comment_text = request.data.get('comment', '').strip()
        
        if not comment_text:
            return Response({'error': 'Kommentar darf nicht leer sein'}, status=status.HTTP_400_BAD_REQUEST)
        
        comment = TroubleshootingComment.objects.create(
            ticket=ticket,
            comment=comment_text,
            created_by=request.user
        )
        
        serializer = TroubleshootingCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Gibt alle Kommentare zurück"""
        ticket = self.get_object()
        comments = ticket.comments.all().order_by('-created_at')
        serializer = TroubleshootingCommentSerializer(comments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Gibt Statistiken zurück"""
        total = TroubleshootingTicket.objects.count()
        by_status = {}
        for status_code, status_label in TroubleshootingTicket.STATUS_CHOICES:
            by_status[status_code] = TroubleshootingTicket.objects.filter(status=status_code).count()
        by_category = {}
        for cat_code, cat_label in TroubleshootingTicket.CATEGORY_CHOICES:
            by_category[cat_code] = TroubleshootingTicket.objects.filter(category=cat_code).count()
        return Response({
            'total': total,
            'by_status': by_status,
            'by_category': by_category
        })
