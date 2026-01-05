from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from .models import (
    NotificationTask, NotificationTaskRecipient,
    NOTIFICATION_ENABLED_MODELS, get_model_status_choices
)
# Import Notification from users app
from users.models import Notification

User = get_user_model()


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimaler User-Serializer für Empfänger-Listen"""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'first_name', 'last_name']
    
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class NotificationTaskRecipientSerializer(serializers.ModelSerializer):
    """Serializer für Mitteilungsempfänger"""
    user_details = UserMinimalSerializer(source='user', read_only=True)
    
    class Meta:
        model = NotificationTaskRecipient
        fields = [
            'id', 'task', 'user', 'user_details',
            'notify_creator_only', 'notify_assigned_only', 'notify_hr_approvers', 'created_at'
        ]
        read_only_fields = ['created_at']


class NotificationTaskSerializer(serializers.ModelSerializer):
    """Serializer für Mitteilungsaufgaben"""
    recipients = NotificationTaskRecipientSerializer(many=True, read_only=True)
    recipient_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source='recipients_write'
    )
    notify_hr_approvers = serializers.BooleanField(write_only=True, required=False, default=False)
    content_type_display = serializers.SerializerMethodField()
    module_name = serializers.SerializerMethodField()
    status_choices = serializers.SerializerMethodField()
    trigger_status_display = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = NotificationTask
        fields = [
            'id', 'content_type', 'content_type_display', 'module_name',
            'status_field', 'trigger_status', 'trigger_status_display',
            'status_choices', 'name', 'message_template', 'is_active',
            'recipients', 'recipient_ids',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_content_type_display(self, obj):
        """Gibt den lesbaren ContentType-Namen zurück"""
        return f"{obj.content_type.app_label}.{obj.content_type.model}"
    
    def get_module_name(self, obj):
        """Gibt den deutschen Modulnamen zurück"""
        for app_label, model_name, status_field, display_name in NOTIFICATION_ENABLED_MODELS:
            if obj.content_type.app_label == app_label and obj.content_type.model == model_name:
                return display_name
        return obj.content_type.model.title()
    
    def get_status_choices(self, obj):
        """Gibt die verfügbaren Status-Werte für das Model zurück"""
        return get_model_status_choices(obj.content_type)
    
    def get_trigger_status_display(self, obj):
        """Gibt den lesbaren Statusnamen zurück"""
        choices = get_model_status_choices(obj.content_type)
        for value, label in choices:
            if value == obj.trigger_status:
                return label
        return obj.trigger_status
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def create(self, validated_data):
        recipients_data = validated_data.pop('recipients_write', [])
        notify_hr_approvers = validated_data.pop('notify_hr_approvers', False)
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
        
        task = NotificationTask.objects.create(**validated_data)
        
        # Empfänger hinzufügen
        for user in recipients_data:
            NotificationTaskRecipient.objects.create(task=task, user=user)
        
        # Wenn notify_hr_approvers aktiviert ist, erstelle einen speziellen Empfänger-Eintrag
        if notify_hr_approvers:
            # Erstelle einen "Dummy"-Eintrag mit dem aktuellen User aber notify_hr_approvers=True
            # Der Signal-Handler wird dann alle HR-User benachrichtigen
            NotificationTaskRecipient.objects.create(
                task=task,
                user=request.user if request else User.objects.filter(is_staff=True).first(),
                notify_hr_approvers=True
            )
        
        return task
    
    def update(self, instance, validated_data):
        recipients_data = validated_data.pop('recipients_write', None)
        notify_hr_approvers = validated_data.pop('notify_hr_approvers', False)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Empfänger aktualisieren (falls mitgegeben)
        if recipients_data is not None or notify_hr_approvers is not None:
            # Alle bisherigen entfernen
            instance.recipients.all().delete()
            # Neue hinzufügen
            if recipients_data:
                for user in recipients_data:
                    NotificationTaskRecipient.objects.create(task=instance, user=user)
            
            # Wenn notify_hr_approvers aktiviert ist
            if notify_hr_approvers:
                request = self.context.get('request')
                NotificationTaskRecipient.objects.create(
                    task=instance,
                    user=request.user if request else User.objects.filter(is_staff=True).first(),
                    notify_hr_approvers=True
                )
        
        return instance


class NotificationTaskListSerializer(serializers.ModelSerializer):
    """Kompakter Serializer für Listenansicht"""
    module_name = serializers.SerializerMethodField()
    trigger_status_display = serializers.SerializerMethodField()
    recipient_count = serializers.SerializerMethodField()
    
    class Meta:
        model = NotificationTask
        fields = [
            'id', 'name', 'module_name', 'status_field',
            'trigger_status', 'trigger_status_display',
            'is_active', 'recipient_count', 'created_at'
        ]
    
    def get_module_name(self, obj):
        for app_label, model_name, status_field, display_name in NOTIFICATION_ENABLED_MODELS:
            if obj.content_type.app_label == app_label and obj.content_type.model == model_name:
                return display_name
        return obj.content_type.model.title()
    
    def get_trigger_status_display(self, obj):
        choices = get_model_status_choices(obj.content_type)
        for value, label in choices:
            if value == obj.trigger_status:
                return label
        return obj.trigger_status
    
    def get_recipient_count(self, obj):
        return obj.recipients.count()


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer für Mitteilungen (basierend auf users.Notification)"""
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'title', 'message', 'notification_type',
            'notification_type_display', 'is_read', 'related_url', 'created_at'
        ]
        read_only_fields = ['created_at']


class NotificationListSerializer(serializers.ModelSerializer):
    """Kompakter Serializer für Benachrichtigungslisten"""
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type',
            'notification_type_display', 'is_read', 'related_url', 'created_at'
        ]


class AvailableModuleSerializer(serializers.Serializer):
    """Serializer für verfügbare Module mit Statusfeldern"""
    content_type_id = serializers.IntegerField()
    app_label = serializers.CharField()
    model = serializers.CharField()
    display_name = serializers.CharField()
    status_field = serializers.CharField()
    status_choices = serializers.ListField(child=serializers.ListField())


class BulkNotificationReadSerializer(serializers.Serializer):
    """Serializer für Massenmarkierung als gelesen"""
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="IDs der Benachrichtigungen, die als gelesen markiert werden sollen. Wenn leer, werden alle markiert."
    )
