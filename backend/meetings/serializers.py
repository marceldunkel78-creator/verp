from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import MondayMeetingTodo, SalesMeetingTodo, VisiViewMeetingTodo

User = get_user_model()


class MondayMeetingTodoSerializer(serializers.ModelSerializer):
    """Serializer für Montagsmeeting Todos"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = MondayMeetingTodo
        fields = [
            'id', 'title', 'description', 'is_completed', 'priority',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class SalesMeetingTodoSerializer(serializers.ModelSerializer):
    """Serializer für Vertriebsmeeting Todos"""
    created_by_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SalesMeetingTodo
        fields = [
            'id', 'title', 'description', 'is_completed', 'completed_at',
            'completed_by', 'completed_by_name', 'priority',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'completed_at']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_completed_by_name(self, obj):
        if obj.completed_by:
            return f"{obj.completed_by.first_name} {obj.completed_by.last_name}".strip() or obj.completed_by.username
        return None
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Wenn is_completed auf True gesetzt wird, setze completed_by
        if validated_data.get('is_completed') and not instance.is_completed:
            validated_data['completed_by'] = self.context['request'].user
        return super().update(instance, validated_data)


class VisiViewMeetingTodoSerializer(serializers.ModelSerializer):
    """Serializer für VisiView-Meeting Todos"""
    created_by_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()
    visiview_ticket_display = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewMeetingTodo
        fields = [
            'id', 'title', 'description', 'is_completed', 'completed_at',
            'completed_by', 'completed_by_name', 
            'visiview_ticket', 'visiview_ticket_display',
            'priority', 'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'completed_at']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_completed_by_name(self, obj):
        if obj.completed_by:
            return f"{obj.completed_by.first_name} {obj.completed_by.last_name}".strip() or obj.completed_by.username
        return None
    
    def get_visiview_ticket_display(self, obj):
        if obj.visiview_ticket:
            return f"#{obj.visiview_ticket.ticket_number} - {obj.visiview_ticket.title}"
        return None
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Wenn is_completed auf True gesetzt wird, setze completed_by
        if validated_data.get('is_completed') and not instance.is_completed:
            validated_data['completed_by'] = self.context['request'].user
        return super().update(instance, validated_data)
