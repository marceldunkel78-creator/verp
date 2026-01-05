from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from .models import (
    NotificationTask, NotificationTaskRecipient,
    NOTIFICATION_ENABLED_MODELS, get_model_status_choices
)
# Import Notification from users app
from users.models import Notification
from .serializers import (
    NotificationTaskSerializer, NotificationTaskListSerializer,
    NotificationTaskRecipientSerializer, NotificationSerializer,
    NotificationListSerializer, AvailableModuleSerializer,
    BulkNotificationReadSerializer
)


class NotificationTaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Mitteilungsaufgaben.
    
    Ermöglicht das Erstellen, Bearbeiten und Löschen von Mitteilungsaufgaben,
    die definieren, wer bei welchem Statuswechsel benachrichtigt wird.
    """
    queryset = NotificationTask.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'trigger_status']
    filterset_fields = ['is_active', 'content_type']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return NotificationTaskListSerializer
        return NotificationTaskSerializer
    
    def get_queryset(self):
        queryset = NotificationTask.objects.select_related(
            'content_type', 'created_by'
        ).prefetch_related('recipients__user')
        return queryset
    
    @action(detail=False, methods=['get'])
    def available_modules(self, request):
        """
        Gibt alle verfügbaren Module zurück, für die Mitteilungsaufgaben 
        erstellt werden können.
        """
        modules = []
        
        for app_label, model_name, status_field, display_name in NOTIFICATION_ENABLED_MODELS:
            try:
                content_type = ContentType.objects.get(
                    app_label=app_label,
                    model=model_name
                )
                status_choices = get_model_status_choices(content_type)
                
                modules.append({
                    'content_type_id': content_type.id,
                    'app_label': app_label,
                    'model': model_name,
                    'display_name': display_name,
                    'status_field': status_field,
                    'status_choices': status_choices
                })
            except ContentType.DoesNotExist:
                # Model existiert nicht (noch nicht migriert), überspringen
                continue
        
        return Response(modules)
    
    @action(detail=False, methods=['get'])
    def status_choices(self, request):
        """
        Gibt die Status-Choices für einen bestimmten ContentType zurück.
        
        Query-Parameter:
        - content_type_id: ID des ContentTypes
        """
        content_type_id = request.query_params.get('content_type_id')
        
        if not content_type_id:
            return Response(
                {'error': 'content_type_id ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            content_type = ContentType.objects.get(id=content_type_id)
            choices = get_model_status_choices(content_type)
            return Response(choices)
        except ContentType.DoesNotExist:
            return Response(
                {'error': 'ContentType nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )


class NotificationTaskRecipientViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Mitteilungsempfänger.
    
    Ermöglicht das Hinzufügen und Entfernen von Empfängern zu Mitteilungsaufgaben.
    """
    queryset = NotificationTaskRecipient.objects.all()
    serializer_class = NotificationTaskRecipientSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['task', 'user']
    
    def get_queryset(self):
        queryset = NotificationTaskRecipient.objects.select_related('task', 'user')
        
        # Optional: Filtern nach Task
        task_id = self.request.query_params.get('task_id')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        
        return queryset


class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Mitteilungen (Mitteilungscenter).
    
    Zeigt die Benachrichtigungen des eingeloggten Users an.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['title', 'message']
    filterset_fields = ['is_read', 'notification_type']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return NotificationListSerializer
        return NotificationSerializer
    
    def get_queryset(self):
        """Gibt nur die Benachrichtigungen des eingeloggten Users zurück"""
        return Notification.objects.filter(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Markiert eine einzelne Benachrichtigung als gelesen"""
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'status': 'marked as read'})
    
    @action(detail=True, methods=['post'])
    def mark_unread(self, request, pk=None):
        """Markiert eine Benachrichtigung als ungelesen"""
        notification = self.get_object()
        notification.is_read = False
        notification.save(update_fields=['is_read'])
        return Response({'status': 'marked as unread'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Markiert alle Benachrichtigungen des Users als gelesen"""
        serializer = BulkNotificationReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        notification_ids = serializer.validated_data.get('notification_ids', [])
        
        queryset = self.get_queryset().filter(is_read=False)
        
        if notification_ids:
            queryset = queryset.filter(id__in=notification_ids)
        
        count = queryset.update(is_read=True)
        
        return Response({
            'status': 'success',
            'marked_count': count
        })
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Gibt die Anzahl ungelesener Benachrichtigungen zurück"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Gibt die letzten 10 Benachrichtigungen zurück"""
        notifications = self.get_queryset()[:10]
        serializer = NotificationListSerializer(notifications, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['delete'])
    def delete_read(self, request):
        """Löscht alle gelesenen Benachrichtigungen"""
        count, _ = self.get_queryset().filter(is_read=True).delete()
        return Response({
            'status': 'success',
            'deleted_count': count
        })

