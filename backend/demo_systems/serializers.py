from rest_framework import serializers
from .models import (
    DemoSystem,
    DemoDevice,
    DemoConnection,
    DemoDeviceComponent,
    DemoChangeLog,
    DemoBooking,
    DemoConfigTemplate,
)


# ---------------------------------------------------------------------------
# Komponenten
# ---------------------------------------------------------------------------

class DemoDeviceComponentSerializer(serializers.ModelSerializer):
    component_type_display = serializers.CharField(
        source='get_component_type_display', read_only=True
    )
    is_changer = serializers.BooleanField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DemoDeviceComponent
        fields = [
            'id', 'device', 'component_type', 'component_type_display', 'name',
            'position', 'slots', 'value', 'comment', 'is_changer',
            'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None

    def get_updated_by_name(self, obj):
        return str(obj.updated_by) if obj.updated_by else None


# ---------------------------------------------------------------------------
# Geräte
# ---------------------------------------------------------------------------

class DemoDeviceSerializer(serializers.ModelSerializer):
    device_type_display = serializers.CharField(
        source='get_device_type_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    inventory_item_display = serializers.SerializerMethodField()
    inventory_item_number = serializers.SerializerMethodField()
    components = DemoDeviceComponentSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DemoDevice
        fields = [
            'id', 'demo_system', 'inventory_item', 'inventory_item_display',
            'inventory_item_number', 'device_type', 'device_type_display',
            'name', 'manufacturer', 'serial_number', 'properties', 'notes',
            'status', 'status_display', 'position_x', 'position_y',
            'components',
            'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_inventory_item_display(self, obj):
        return str(obj.inventory_item) if obj.inventory_item else None

    def get_inventory_item_number(self, obj):
        return obj.inventory_item.inventory_number if obj.inventory_item else None

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None

    def get_updated_by_name(self, obj):
        return str(obj.updated_by) if obj.updated_by else None


class DemoDeviceCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DemoDevice
        fields = [
            'id', 'demo_system', 'inventory_item', 'device_type', 'name',
            'manufacturer', 'serial_number', 'properties', 'notes', 'status',
            'position_x', 'position_y',
        ]
        read_only_fields = ['id']


# ---------------------------------------------------------------------------
# Verbindungen
# ---------------------------------------------------------------------------

class DemoConnectionSerializer(serializers.ModelSerializer):
    from_device_name = serializers.CharField(source='from_device.name', read_only=True)
    to_device_name = serializers.CharField(source='to_device.name', read_only=True)
    from_side_display = serializers.CharField(
        source='get_from_side_display', read_only=True
    )
    to_side_display = serializers.CharField(
        source='get_to_side_display', read_only=True
    )

    class Meta:
        model = DemoConnection
        fields = [
            'id', 'demo_system', 'from_device', 'from_device_name', 'from_side',
            'from_side_display', 'to_device', 'to_device_name', 'to_side',
            'to_side_display', 'created_by', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


# ---------------------------------------------------------------------------
# Buchungen
# ---------------------------------------------------------------------------

class DemoBookingSerializer(serializers.ModelSerializer):
    customer_display = serializers.SerializerMethodField()
    reserved_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DemoBooking
        fields = [
            'id', 'demo_system', 'title', 'customer', 'customer_display',
            'reserved_by', 'reserved_by_name', 'start_date', 'end_date',
            'notes', 'is_cancelled',
            'created_by', 'created_by_name', 'updated_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_customer_display(self, obj):
        return str(obj.customer) if obj.customer else None

    def get_reserved_by_name(self, obj):
        return str(obj.reserved_by) if obj.reserved_by else None

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None


# ---------------------------------------------------------------------------
# Änderungsprotokoll
# ---------------------------------------------------------------------------

class DemoChangeLogSerializer(serializers.ModelSerializer):
    entity_type_display = serializers.CharField(
        source='get_entity_type_display', read_only=True
    )
    action_display = serializers.CharField(
        source='get_action_display', read_only=True
    )
    changed_by_name = serializers.SerializerMethodField()
    comment_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DemoChangeLog
        fields = [
            'id', 'demo_system', 'entity_type', 'entity_type_display',
            'entity_id', 'entity_label', 'action', 'action_display',
            'field_name', 'old_value', 'new_value',
            'comment', 'comment_by', 'comment_by_name', 'comment_updated_at',
            'changed_by', 'changed_by_name', 'changed_at',
        ]
        read_only_fields = [
            'id', 'demo_system', 'entity_type', 'entity_id', 'entity_label',
            'action', 'field_name', 'old_value', 'new_value',
            'comment_by', 'comment_updated_at', 'changed_by', 'changed_at',
        ]

    def get_changed_by_name(self, obj):
        return str(obj.changed_by) if obj.changed_by else None

    def get_comment_by_name(self, obj):
        return str(obj.comment_by) if obj.comment_by else None


class DemoChangeLogCommentSerializer(serializers.Serializer):
    comment = serializers.CharField(allow_blank=True, required=False)


# ---------------------------------------------------------------------------
# Demo-System
# ---------------------------------------------------------------------------

class DemoSystemListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    device_count = serializers.SerializerMethodField()
    booking_count = serializers.SerializerMethodField()
    responsible_employee_name = serializers.SerializerMethodField()

    class Meta:
        model = DemoSystem
        fields = [
            'id', 'demo_number', 'name', 'description', 'location',
            'responsible_employee', 'responsible_employee_name', 'is_active',
            'status', 'status_display',
            'device_count', 'booking_count', 'created_at', 'updated_at',
        ]

    def get_device_count(self, obj):
        return obj.devices.count()

    def get_booking_count(self, obj):
        return obj.bookings.count()

    def get_responsible_employee_name(self, obj):
        return str(obj.responsible_employee) if obj.responsible_employee else None


class DemoSystemDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    devices = DemoDeviceSerializer(many=True, read_only=True)
    connections = DemoConnectionSerializer(many=True, read_only=True)
    bookings = serializers.SerializerMethodField()
    change_logs = DemoChangeLogSerializer(many=True, read_only=True)
    responsible_employee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DemoSystem
        fields = [
            'id', 'demo_number', 'name', 'description', 'location',
            'responsible_employee', 'responsible_employee_name', 'is_active',
            'status', 'status_display',
            'devices', 'connections', 'bookings', 'change_logs',
            'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
            'created_at', 'updated_at',
        ]

    def get_bookings(self, obj):
        # Stornierte Buchungen am Ende, sonst chronologisch
        bookings = sorted(
            obj.bookings.select_related('customer', 'reserved_by', 'created_by').all(),
            key=lambda b: (b.is_cancelled, b.start_date, b.id)
        )
        return DemoBookingSerializer(bookings, many=True).data

    def get_responsible_employee_name(self, obj):
        return str(obj.responsible_employee) if obj.responsible_employee else None

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None

    def get_updated_by_name(self, obj):
        return str(obj.updated_by) if obj.updated_by else None


class DemoSystemCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DemoSystem
        fields = [
            'id', 'name', 'description', 'location',
            'responsible_employee', 'is_active', 'status',
        ]
        read_only_fields = ['id']


# ---------------------------------------------------------------------------
# Konfigurationsvorlagen
# ---------------------------------------------------------------------------

class DemoConfigTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    device_count = serializers.SerializerMethodField()

    class Meta:
        model = DemoConfigTemplate
        fields = [
            'id', 'name', 'description', 'is_default', 'data',
            'device_count',
            'created_by', 'created_by_name', 'updated_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None

    def get_device_count(self, obj):
        return len((obj.data or {}).get('devices', []))


class DemoConfigTemplateListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    device_count = serializers.SerializerMethodField()

    class Meta:
        model = DemoConfigTemplate
        fields = [
            'id', 'name', 'description', 'is_default', 'device_count',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None

    def get_device_count(self, obj):
        return len((obj.data or {}).get('devices', []))