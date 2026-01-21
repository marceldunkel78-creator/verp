from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import CalendarEvent, EventReminder

User = get_user_model()


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimaler User Serializer für Kalender."""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name']
    
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class EventReminderSerializer(serializers.ModelSerializer):
    recipient_details = UserMinimalSerializer(source='recipient', read_only=True)
    timing_display = serializers.CharField(source='get_minutes_before_display', read_only=True)
    
    class Meta:
        model = EventReminder
        fields = [
            'id', 'event', 'recipient', 'recipient_details', 'notify_all',
            'minutes_before', 'timing_display', 'is_sent', 'sent_at', 'created_at'
        ]
        read_only_fields = ['is_sent', 'sent_at', 'created_at']
        extra_kwargs = {
            'event': {'read_only': True}
        }


class CalendarEventSerializer(serializers.ModelSerializer):
    created_by_details = UserMinimalSerializer(source='created_by', read_only=True)
    assigned_to_details = UserMinimalSerializer(source='assigned_to', read_only=True)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    color = serializers.CharField(read_only=True)
    reminders = EventReminderSerializer(many=True, read_only=True)
    recurrence_type_display = serializers.CharField(source='get_recurrence_type_display', read_only=True)
    is_recurring = serializers.SerializerMethodField()
    parent_event_details = serializers.SerializerMethodField()
    
    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'description', 'event_type', 'event_type_display', 'color',
            'start_date', 'end_date', 'start_time', 'end_time', 'is_all_day',
            'recurrence_type', 'recurrence_type_display', 'recurrence_end_date',
            'parent_event', 'parent_event_details', 'is_recurring',
            'created_by', 'created_by_details', 'assigned_to', 'assigned_to_details',
            'vacation_request', 'order', 'customer_order',
            'is_system_generated', 'is_active',
            'created_at', 'updated_at', 'reminders'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'is_system_generated']
    
    def get_is_recurring(self, obj):
        return obj.recurrence_type != 'none' or obj.parent_event is not None
    
    def get_parent_event_details(self, obj):
        if obj.parent_event:
            return {
                'id': obj.parent_event.id,
                'title': obj.parent_event.title,
                'recurrence_type': obj.parent_event.recurrence_type,
                'recurrence_end_date': obj.parent_event.recurrence_end_date
            }
        return None


class CalendarEventCreateSerializer(serializers.ModelSerializer):
    """Serializer für das Erstellen von Terminen mit Erinnerungen."""
    reminders = EventReminderSerializer(many=True, required=False)
    
class CalendarEventCreateSerializer(serializers.ModelSerializer):
    """Serializer für das Erstellen von Terminen mit Erinnerungen."""
    reminders = EventReminderSerializer(many=True, required=False)
    
    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'description', 'event_type',
            'start_date', 'end_date', 'start_time', 'end_time', 'is_all_day',
            'recurrence_type', 'recurrence_end_date',
            'assigned_to', 'reminders'
        ]
    
    def create(self, validated_data):
        reminders_data = validated_data.pop('reminders', [])
        validated_data['created_by'] = self.context['request'].user
        event = CalendarEvent.objects.create(**validated_data)
        
        for reminder_data in reminders_data:
            EventReminder.objects.create(event=event, **reminder_data)
        
        return event
    
    def update(self, instance, validated_data):
        reminders_data = validated_data.pop('reminders', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update reminders if provided
        if reminders_data is not None:
            # Delete existing reminders and create new ones
            instance.reminders.all().delete()
            for reminder_data in reminders_data:
                EventReminder.objects.create(event=instance, **reminder_data)
        
        return instance


class CalendarEventListSerializer(serializers.ModelSerializer):
    """Minimaler Serializer für Kalenderübersicht."""
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    color = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'event_type', 'event_type_display', 'color',
            'start_date', 'end_date', 'start_time', 'end_time', 'is_all_day',
            'created_by', 'created_by_name', 'assigned_to', 'assigned_to_name',
            'is_system_generated'
        ]
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None


class EventTypeChoicesSerializer(serializers.Serializer):
    """Serializer für Termintyp-Auswahl."""
    value = serializers.CharField()
    label = serializers.CharField()
    color = serializers.CharField()
    is_manual = serializers.BooleanField()


class RecurrenceChoicesSerializer(serializers.Serializer):
    """Serializer für Wiederholungsoptionen."""
    value = serializers.CharField()
    label = serializers.CharField()


class CalendarStatisticsSerializer(serializers.Serializer):
    """Serializer für Kalenderstatistiken."""
    total_events = serializers.IntegerField()
    events_by_type = serializers.DictField()
    events_by_user = serializers.ListField()
    date_range = serializers.DictField()
