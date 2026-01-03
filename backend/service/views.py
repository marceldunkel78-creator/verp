from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import VSService, VSServicePrice, ServiceTicket, RMACase, TicketComment, TicketChangeLog
from .serializers import (
    VSServiceListSerializer, VSServiceDetailSerializer, VSServiceCreateUpdateSerializer,
    VSServicePriceSerializer,
    ServiceTicketListSerializer, ServiceTicketDetailSerializer, ServiceTicketCreateUpdateSerializer,
    TicketCommentSerializer, TicketChangeLogSerializer,
    RMACaseListSerializer, RMACaseDetailSerializer, RMACaseCreateUpdateSerializer
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
    filterset_fields = ['status', 'billing', 'customer', 'assigned_to']
    search_fields = ['ticket_number', 'title', 'description', 'contact_email']
    ordering_fields = ['ticket_number', 'created_at', 'updated_at', 'status']
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
    filterset_fields = ['status', 'customer', 'warranty_status', 'assigned_to']
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
