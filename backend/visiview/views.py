from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    VisiViewProduct, VisiViewProductPrice, VisiViewLicense, VisiViewOption,
    VisiViewTicket, VisiViewTicketComment, VisiViewTicketChangeLog
)
from .serializers import (
    VisiViewProductListSerializer,
    VisiViewProductDetailSerializer,
    VisiViewProductCreateUpdateSerializer,
    VisiViewProductPriceSerializer,
    VisiViewLicenseListSerializer,
    VisiViewLicenseDetailSerializer,
    VisiViewLicenseCreateUpdateSerializer,
    VisiViewOptionSerializer,
    VisiViewTicketListSerializer,
    VisiViewTicketDetailSerializer,
    VisiViewTicketCreateUpdateSerializer,
    VisiViewTicketCommentSerializer,
    VisiViewTicketChangeLogSerializer
)


class VisiViewProductViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Produkte"""
    # Pagination für infinite scroll
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = VisiViewProduct.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'product_category']
    search_fields = ['article_number', 'name', 'description']
    ordering_fields = ['article_number', 'name', 'created_at']
    ordering = ['article_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewProductListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewProductCreateUpdateSerializer
        return VisiViewProductDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VisiViewProductPriceViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Produkt Preise"""
    queryset = VisiViewProductPrice.objects.all()
    serializer_class = VisiViewProductPriceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product']
    ordering = ['-valid_from']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VisiViewOptionViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Optionen"""
    queryset = VisiViewOption.objects.all()
    serializer_class = VisiViewOptionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['bit_position', 'name', 'price']
    ordering = ['bit_position']


class VisiViewLicenseViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Lizenzen"""
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = VisiViewLicense.objects.select_related('customer', 'created_by').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'is_demo', 'is_loaner', 'customer', 'is_outdated']
    search_fields = ['license_number', 'serial_number', 'customer_name_legacy', 'customer__last_name', 'distributor']
    ordering_fields = ['license_number', 'serial_number', 'delivery_date', 'created_at']
    ordering = ['-serial_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewLicenseListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewLicenseCreateUpdateSerializer
        return VisiViewLicenseDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def toggle_option(self, request, pk=None):
        """Aktiviert oder deaktiviert eine Option für die Lizenz"""
        license = self.get_object()
        bit_position = request.data.get('bit_position')
        enabled = request.data.get('enabled', True)
        
        if bit_position is None:
            return Response(
                {'error': 'bit_position ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            bit_position = int(bit_position)
            option = VisiViewOption.objects.get(bit_position=bit_position)
        except (ValueError, VisiViewOption.DoesNotExist):
            return Response(
                {'error': f'Option mit Bit-Position {bit_position} nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        license.set_option(bit_position, enabled)
        license.save()
        
        return Response({
            'success': True,
            'option': option.name,
            'enabled': enabled,
            'options_bitmask': license.options_bitmask,
            'options_upper_32bit': license.options_upper_32bit
        })
    
    @action(detail=False, methods=['get'])
    def by_customer(self, request):
        """Gibt alle Lizenzen eines Kunden zurück"""
        customer_id = request.query_params.get('customer_id')
        if not customer_id:
            return Response(
                {'error': 'customer_id ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        licenses = self.queryset.filter(customer_id=customer_id)
        serializer = VisiViewLicenseListSerializer(licenses, many=True)
        return Response(serializer.data)


class VisiViewTicketViewSet(viewsets.ModelViewSet):
    """
    ViewSet für VisiView Tickets (Bug/Fehler und Feature Requests)
    """
    queryset = VisiViewTicket.objects.select_related(
        'parent_ticket', 'author_user', 'assigned_to', 'created_by'
    ).all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tracker', 'status', 'priority', 'category', 'assigned_to', 'is_private', 'target_version']
    search_fields = ['ticket_number', 'title', 'description', 'author', 'target_version', 'affected_version']
    ordering_fields = ['ticket_number', 'priority', 'status', 'created_at', 'updated_at', 'target_version', 'assigned_to']
    ordering = ['-ticket_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewTicketListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewTicketCreateUpdateSerializer
        return VisiViewTicketDetailSerializer
    
    def get_queryset(self):
        queryset = VisiViewTicket.objects.select_related(
            'parent_ticket', 'author_user', 'assigned_to', 'created_by'
        ).all()
        
        # Filter für offene/geschlossene Tickets
        is_open = self.request.query_params.get('is_open')
        if is_open is not None:
            if is_open.lower() == 'true':
                queryset = queryset.exclude(status__in=['resolved', 'closed', 'rejected'])
            else:
                queryset = queryset.filter(status__in=['resolved', 'closed', 'rejected'])
        
        return queryset
    
    def perform_create(self, serializer):
        ticket = serializer.save(created_by=self.request.user)
        # Ersteller und zugewiesener User werden automatisch als Beobachter hinzugefügt
        if ticket.created_by:
            ticket.watchers.add(ticket.created_by)
        if ticket.assigned_to:
            ticket.watchers.add(ticket.assigned_to)
            # Erstelle eine Erinnerungsaufgabe für den zugewiesenen Mitarbeiter (Fällig: morgen)
            try:
                from django.utils import timezone
                from datetime import timedelta
                from users.models import Reminder
                due = timezone.now().date() + timedelta(days=1)
                Reminder.objects.create(
                    user=ticket.assigned_to,
                    title=f"Zugewiesen: Ticket #{ticket.ticket_number}",
                    description=f"Ticket '{ticket.title}' wurde Ihnen zugewiesen.",
                    due_date=due,
                    related_object_type='visiview_ticket',
                    related_object_id=ticket.id,
                    related_url=f"/visiview/tickets/{ticket.id}"
                )
            except Exception:
                # Nicht fatal für Ticket-Erstellung
                pass
    
    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_data = {
            'title': old_instance.title,
            'tracker': old_instance.tracker,
            'status': old_instance.status,
            'priority': old_instance.priority,
            'category': old_instance.category,
            'assigned_to': old_instance.assigned_to_id,
            'target_version': old_instance.target_version,
            'percent_done': old_instance.percent_done,
        }
        old_assigned_to = old_instance.assigned_to
        
        instance = serializer.save()
        
        # Änderungen protokollieren
        field_labels = {
            'title': 'Thema',
            'tracker': 'Tracker',
            'status': 'Status',
            'priority': 'Priorität',
            'category': 'Kategorie',
            'assigned_to': 'Zugewiesen an',
            'target_version': 'Zielversion',
            'percent_done': '% erledigt',
        }
        
        new_data = {
            'title': instance.title,
            'tracker': instance.tracker,
            'status': instance.status,
            'priority': instance.priority,
            'category': instance.category,
            'assigned_to': instance.assigned_to_id,
            'target_version': instance.target_version,
            'percent_done': instance.percent_done,
        }
        
        changes = []
        for field, old_value in old_data.items():
            new_value = new_data.get(field)
            if old_value != new_value:
                VisiViewTicketChangeLog.objects.create(
                    ticket=instance,
                    field_name=field_labels.get(field, field),
                    old_value=str(old_value or ''),
                    new_value=str(new_value or ''),
                    changed_by=self.request.user
                )
                changes.append((field_labels.get(field, field), str(old_value or ''), str(new_value or '')))
        
        # Wenn "Zugewiesen an" geändert wurde, Beobachter aktualisieren
        if old_assigned_to != instance.assigned_to:
            if old_assigned_to:
                instance.watchers.remove(old_assigned_to)
            if instance.assigned_to:
                instance.watchers.add(instance.assigned_to)
                # Erstelle eine Erinnerungsaufgabe für den neuen zugewiesenen Mitarbeiter (Fällig: morgen)
                try:
                    from django.utils import timezone
                    from datetime import timedelta
                    from users.models import Reminder
                    due = timezone.now().date() + timedelta(days=1)
                    Reminder.objects.create(
                        user=instance.assigned_to,
                        title=f"Zugewiesen: Ticket #{instance.ticket_number}",
                        description=f"Ticket '{instance.title}' wurde Ihnen zugewiesen.",
                        due_date=due,
                        related_object_type='visiview_ticket',
                        related_object_id=instance.id,
                        related_url=f"/visiview/tickets/{instance.id}"
                    )
                except Exception:
                    pass

        # Benachrichtige Beobachter über die Änderungen (als Nachricht in der Inbox)
        if changes:
            try:
                from users.models import Message
                message_lines = [f"Änderungen an VisiView Ticket #{instance.ticket_number} - {instance.title}"]
                message_lines.append("")  # Leerzeile
                for label, oldv, newv in changes:
                    message_lines.append(f"• {label}: {oldv or '(leer)'} → {newv or '(leer)'}")
                message_lines.append("")  # Leerzeile
                message_lines.append(f"Link zum Ticket: /visiview/tickets/{instance.id}")
                message_text = "\n".join(message_lines)

                # Sammle alle zu benachrichtigenden User (Beobachter + zugewiesener Mitarbeiter)
                recipients = set(instance.watchers.all())
                if instance.assigned_to:
                    recipients.add(instance.assigned_to)

                for recipient in recipients:
                    # Sende nicht an den Ändernden selbst
                    if recipient == self.request.user:
                        continue
                    Message.objects.create(
                        sender=self.request.user,
                        user=recipient,
                        title=f"Änderung des Tickets #{instance.ticket_number}",
                        content=message_text,
                        message_type='ticket'
                    )
            except Exception as e:
                # Nicht fatal - loggen für Debugging
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Fehler beim Senden von Ticket-Benachrichtigungen: {e}")
                pass
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Fügt einen Kommentar zum Ticket hinzu"""
        ticket = self.get_object()
        comment_text = request.data.get('comment', '').strip()
        
        if not comment_text:
            return Response(
                {'error': 'Kommentar darf nicht leer sein'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comment = VisiViewTicketComment.objects.create(
            ticket=ticket,
            comment=comment_text,
            created_by=request.user
        )
        
        # Änderungsprotokoll für Kommentar
        VisiViewTicketChangeLog.objects.create(
            ticket=ticket,
            field_name='Kommentar',
            old_value='',
            new_value=f"Neuer Kommentar von {request.user.get_full_name() or request.user.username}",
            changed_by=request.user
        )
        
        serializer = VisiViewTicketCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Gibt alle Kommentare zurück"""
        ticket = self.get_object()
        comments = ticket.comments.all().order_by('-created_at')
        serializer = VisiViewTicketCommentSerializer(comments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def change_log(self, request, pk=None):
        """Gibt das Änderungsprotokoll zurück"""
        ticket = self.get_object()
        logs = ticket.change_logs.all().order_by('-changed_at')
        serializer = VisiViewTicketChangeLogSerializer(logs, many=True)
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
        
        return Response({
            'status': 'success',
            'watcher_ids': list(ticket.watchers.values_list('id', flat=True))
        })
    
    @action(detail=False, methods=['get'])
    def open_tickets(self, request):
        """Gibt nur offene Tickets zurück"""
        queryset = self.get_queryset().exclude(status__in=['resolved', 'closed', 'rejected'])
        serializer = VisiViewTicketListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def bugs(self, request):
        """Gibt nur Bug/Fehler-Tickets zurück"""
        queryset = self.get_queryset().filter(tracker='bug')
        serializer = VisiViewTicketListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def features(self, request):
        """Gibt nur Feature Request-Tickets zurück"""
        queryset = self.get_queryset().filter(tracker='feature')
        serializer = VisiViewTicketListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Gibt Statistiken zu den Tickets zurück"""
        queryset = self.get_queryset()
        
        # Status-Verteilung
        status_counts = {}
        for status_choice in VisiViewTicket.STATUS_CHOICES:
            status_counts[status_choice[0]] = queryset.filter(status=status_choice[0]).count()
        
        # Tracker-Verteilung
        tracker_counts = {
            'bug': queryset.filter(tracker='bug').count(),
            'feature': queryset.filter(tracker='feature').count(),
        }
        
        # Prioritäts-Verteilung
        priority_counts = {}
        for priority_choice in VisiViewTicket.PRIORITY_CHOICES:
            priority_counts[priority_choice[0]] = queryset.filter(priority=priority_choice[0]).count()
        
        return Response({
            'total': queryset.count(),
            'open': queryset.exclude(status__in=['resolved', 'closed', 'rejected']).count(),
            'closed': queryset.filter(status__in=['resolved', 'closed', 'rejected']).count(),
            'by_status': status_counts,
            'by_tracker': tracker_counts,
            'by_priority': priority_counts,
        })


# ==================== VisiView Macro Views ====================

from django.http import HttpResponse
import zipfile
import io
from .models import VisiViewMacro, VisiViewMacroExampleImage, VisiViewMacroChangeLog
from .serializers import (
    VisiViewMacroListSerializer,
    VisiViewMacroDetailSerializer,
    VisiViewMacroCreateUpdateSerializer,
    VisiViewMacroExampleImageSerializer,
    VisiViewMacroChangeLogSerializer
)


class VisiViewMacroViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Macros"""
    queryset = VisiViewMacro.objects.prefetch_related('dependencies', 'example_images', 'change_logs').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category', 'author_user']
    search_fields = ['macro_id', 'title', 'author', 'keywords', 'purpose', 'category']
    ordering_fields = ['macro_id', 'title', 'created_at', 'updated_at', 'status']
    ordering = ['-macro_id']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewMacroListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewMacroCreateUpdateSerializer
        return VisiViewMacroDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download des Macros als .txt Datei"""
        macro = self.get_object()
        content = macro.generate_download_content()
        
        response = HttpResponse(content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{macro.filename}"'
        return response
    
    @action(detail=True, methods=['get'])
    def download_with_dependencies(self, request, pk=None):
        """Download des Macros mit allen Abhängigkeiten als ZIP"""
        macro = self.get_object()
        
        # Sammle alle Macros (Haupt-Macro + Abhängigkeiten)
        macros_to_download = [macro]
        macros_to_download.extend(macro.dependencies.all())
        
        # Erstelle ZIP-Datei
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for m in macros_to_download:
                content = m.generate_download_content()
                zip_file.writestr(m.filename, content)
        
        buffer.seek(0)
        
        # Dateiname für ZIP
        safe_title = "".join(c for c in macro.title if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title.replace(' ', '_')
        zip_filename = f"{macro.macro_id}_{safe_title}_with_dependencies.zip"
        
        response = HttpResponse(buffer.read(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{zip_filename}"'
        return response
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Gibt alle vorhandenen Kategorien zurück"""
        categories = VisiViewMacro.objects.exclude(
            category__isnull=True
        ).exclude(
            category=''
        ).values_list('category', flat=True).distinct().order_by('category')
        return Response(list(categories))
    
    @action(detail=False, methods=['get'])
    def keywords_list(self, request):
        """Gibt alle vorhandenen Keywords zurück"""
        macros = VisiViewMacro.objects.exclude(keywords='').values_list('keywords', flat=True)
        all_keywords = set()
        for kw_string in macros:
            if kw_string:
                for kw in kw_string.split(','):
                    kw = kw.strip()
                    if kw:
                        all_keywords.add(kw)
        return Response(sorted(list(all_keywords)))
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Gibt Statistiken zu den Macros zurück"""
        queryset = self.get_queryset()
        
        # Status-Verteilung
        status_counts = {}
        for status_choice in VisiViewMacro.STATUS_CHOICES:
            status_counts[status_choice[0]] = queryset.filter(status=status_choice[0]).count()
        
        return Response({
            'total': queryset.count(),
            'by_status': status_counts,
        })


class VisiViewMacroExampleImageViewSet(viewsets.ModelViewSet):
    """ViewSet für Macro Beispielbilder"""
    queryset = VisiViewMacroExampleImage.objects.all()
    serializer_class = VisiViewMacroExampleImageSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['macro']


class VisiViewMacroChangeLogViewSet(viewsets.ModelViewSet):
    """ViewSet für Macro Änderungsprotokoll"""
    queryset = VisiViewMacroChangeLog.objects.all()
    serializer_class = VisiViewMacroChangeLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['macro']
    ordering = ['-changed_at']
    
    def perform_create(self, serializer):
        serializer.save(changed_by=self.request.user)
