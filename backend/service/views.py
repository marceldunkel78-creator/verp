from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import FileResponse, Http404

from .models import (VSService, VSServicePrice, ServiceTicket, RMACase, TicketComment, 
                     TicketChangeLog, TroubleshootingTicket, TroubleshootingComment,
                     ServiceTicketAttachment, TroubleshootingAttachment, ServiceTicketTimeEntry,
                     RMACaseTimeEntry)
from .serializers import (
    VSServiceListSerializer, VSServiceDetailSerializer, VSServiceCreateUpdateSerializer,
    VSServicePriceSerializer,
    ServiceTicketListSerializer, ServiceTicketDetailSerializer, ServiceTicketCreateUpdateSerializer,
    TicketCommentSerializer, TicketChangeLogSerializer, ServiceTicketAttachmentSerializer,
    ServiceTicketTimeEntrySerializer,
    RMACaseListSerializer, RMACaseDetailSerializer, RMACaseCreateUpdateSerializer,
    RMACaseTimeEntrySerializer,
    TroubleshootingListSerializer, TroubleshootingDetailSerializer, TroubleshootingCreateUpdateSerializer,
    TroubleshootingCommentSerializer, TroubleshootingAttachmentSerializer
)
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
    filterset_fields = ['status', 'customer', 'warranty_status', 'assigned_to', 'linked_system']
    search_fields = ['rma_number', 'title', 'description', 'serial_number', 'product_name']
    ordering_fields = ['rma_number', 'created_at', 'status']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return RMACaseListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return RMACaseCreateUpdateSerializer
        return RMACaseDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
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
