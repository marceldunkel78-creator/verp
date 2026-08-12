"""
Serializers für Reiseberichte/Serviceberichte
"""
from rest_framework import serializers
from .models_travel_report import TravelReport, TravelReportMeasurement, TravelReportPhoto
from .notizen_utils import sanitize_editor_html, html_to_plain_text


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
    executing_employee_name = serializers.SerializerMethodField()
    photo_count = serializers.SerializerMethodField()
    has_pdf = serializers.SerializerMethodField()
    
    class Meta:
        model = TravelReport
        fields = [
            'id', 'report_type', 'report_type_display', 'date', 'location',
            'work_effort_hours', 'travel_effort_hours', 'work_start_time', 'work_end_time',
            'customer', 'customer_name', 'linked_system', 'system_name',
            'linked_order', 'order_number', 'executing_employee', 'executing_employee_name',
            'created_by', 'created_by_name',
            'photo_count', 'has_pdf', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_customer_name(self, obj):
        if obj.customer:
            return f"{obj.customer.first_name} {obj.customer.last_name}".strip() or obj.customer.last_name
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

    def get_executing_employee_name(self, obj):
        if obj.executing_employee:
            return f"{obj.executing_employee.first_name} {obj.executing_employee.last_name}".strip()
        return None
    
    def get_photo_count(self, obj):
        return obj.photos.count()
    
    def get_has_pdf(self, obj):
        return bool(obj.pdf_file)


class TravelReportDetailSerializer(serializers.ModelSerializer):
    """Detail Serializer für Reiseberichte"""
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    customer_details = serializers.SerializerMethodField()
    system_details = serializers.SerializerMethodField()
    order_details = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    executing_employee_details = serializers.SerializerMethodField()
    photos = TravelReportPhotoSerializer(many=True, read_only=True)
    measurements = TravelReportMeasurementSerializer(many=True, read_only=True)
    has_pdf = serializers.SerializerMethodField()
    
    class Meta:
        model = TravelReport
        fields = [
            'id', 'report_type', 'report_type_display', 'date', 'location',
            'work_effort_hours', 'travel_effort_hours', 'work_start_time', 'work_end_time',
            'customer', 'customer_details', 'linked_system', 'system_details',
            'linked_order', 'order_details', 'executing_employee', 'executing_employee_details',
            'notes', 'notes_html',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'photos', 'measurements', 'has_pdf'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'notes']
    
    def get_customer_details(self, obj):
        if obj.customer:
            return {
                'id': obj.customer.id,
                'name': f"{obj.customer.first_name} {obj.customer.last_name}".strip() or obj.customer.last_name,
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

    def get_executing_employee_details(self, obj):
        if obj.executing_employee:
            return {
                'id': obj.executing_employee.id,
                'name': f"{obj.executing_employee.first_name} {obj.executing_employee.last_name}".strip(),
                'employee_id': obj.executing_employee.employee_id,
            }
        return None
    
    def get_has_pdf(self, obj):
        return bool(obj.pdf_file)


class TravelReportCreateUpdateSerializer(serializers.ModelSerializer):

    notes_html = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=False,
    )

    class Meta:
        model = TravelReport
        fields = [
            'id', 'report_type', 'date', 'location',
            'customer', 'linked_system', 'linked_order', 'executing_employee',
            'notes', 'notes_html',
            'work_effort_hours', 'travel_effort_hours', 'work_start_time', 'work_end_time'
        ]
        read_only_fields = ['id', 'notes']

    def validate_notes_html(self, value):
        """Bereinigt das Editor-HTML serverseitig."""
        return sanitize_editor_html(value or '')

    def to_internal_value(self, data):
        """
        Akzeptiert legacy 'notes' (Plain-Text) und konvertiert ihn zu HTML,
        falls kein notes_html mitgegeben wird.
        """
        internal = super().to_internal_value(data)
        # Falls Frontend 'notes_html' mitschickt, ist es schon sanitized.
        if 'notes_html' in internal:
            html = internal.get('notes_html') or ''
            internal['notes'] = html_to_plain_text(html)
        return internal
        read_only_fields = ['id']
