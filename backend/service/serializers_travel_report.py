"""
Serializers für Reiseberichte/Serviceberichte
"""
from rest_framework import serializers
from .models_travel_report import TravelReport, TravelReportMeasurement, TravelReportPhoto


class TravelReportPhotoSerializer(serializers.ModelSerializer):
    """Serializer für Reisebericht-Fotos"""
    photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = TravelReportPhoto
        fields = ['id', 'photo', 'photo_url', 'caption', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at', 'photo_url']
    
    def get_photo_url(self, obj):
        if obj.photo:
            return obj.photo.url
        return None


class TravelReportMeasurementSerializer(serializers.ModelSerializer):
    """Serializer für Messungen"""
    
    class Meta:
        model = TravelReportMeasurement
        fields = ['id', 'title', 'data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TravelReportListSerializer(serializers.ModelSerializer):
    """List Serializer für Reiseberichte"""
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    customer_name = serializers.SerializerMethodField()
    system_name = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    photo_count = serializers.SerializerMethodField()
    
    class Meta:
        model = TravelReport
        fields = [
            'id', 'report_type', 'report_type_display', 'date', 'location',
            'customer', 'customer_name', 'linked_system', 'system_name',
            'linked_order', 'order_number', 'created_by', 'created_by_name',
            'photo_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.company_name or f"{obj.customer.first_name} {obj.customer.last_name}"
        return None
    
    def get_system_name(self, obj):
        if obj.linked_system:
            return obj.linked_system.system_name
        return None
    
    def get_order_number(self, obj):
        if obj.linked_order:
            return obj.linked_order.order_number
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_photo_count(self, obj):
        return obj.photos.count()


class TravelReportDetailSerializer(serializers.ModelSerializer):
    """Detail Serializer für Reiseberichte"""
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    customer_details = serializers.SerializerMethodField()
    system_details = serializers.SerializerMethodField()
    order_details = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    photos = TravelReportPhotoSerializer(many=True, read_only=True)
    measurements = TravelReportMeasurementSerializer(many=True, read_only=True)
    
    class Meta:
        model = TravelReport
        fields = [
            'id', 'report_type', 'report_type_display', 'date', 'location',
            'customer', 'customer_details', 'linked_system', 'system_details',
            'linked_order', 'order_details', 'notes',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'photos', 'measurements'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_customer_details(self, obj):
        if obj.customer:
            return {
                'id': obj.customer.id,
                'name': obj.customer.company_name or f"{obj.customer.first_name} {obj.customer.last_name}",
                'customer_number': obj.customer.customer_number
            }
        return None
    
    def get_system_details(self, obj):
        if obj.linked_system:
            return {
                'id': obj.linked_system.id,
                'name': obj.linked_system.system_name,
                'system_number': getattr(obj.linked_system, 'system_number', None)
            }
        return None
    
    def get_order_details(self, obj):
        if obj.linked_order:
            return {
                'id': obj.linked_order.id,
                'order_number': obj.linked_order.order_number
            }
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class TravelReportCreateUpdateSerializer(serializers.ModelSerializer):
    """Create/Update Serializer für Reiseberichte"""
    
    class Meta:
        model = TravelReport
        fields = [
            'id', 'report_type', 'date', 'location',
            'customer', 'linked_system', 'linked_order', 'notes'
        ]
        read_only_fields = ['id']
