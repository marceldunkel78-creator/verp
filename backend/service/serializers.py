from rest_framework import serializers
from .models import VSService, VSServicePrice, ServiceTicket, RMACase, TicketComment, TicketChangeLog


class VSServicePriceSerializer(serializers.ModelSerializer):
    """Serializer für VS-Service Preise"""
    # Map frontend field names to model field names
    service = serializers.PrimaryKeyRelatedField(
        source='vs_service',
        queryset=VSService.objects.all(),
        required=False
    )
    list_price = serializers.DecimalField(
        source='sales_price',
        max_digits=12,
        decimal_places=2
    )
    
    class Meta:
        model = VSServicePrice
        fields = [
            'id', 'vs_service', 'service', 'purchase_price', 'list_price', 'sales_price',
            'valid_from', 'valid_until', 'notes', 'created_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'created_by']
        extra_kwargs = {
            'vs_service': {'required': False},
            'sales_price': {'required': False}
        }


class VSServiceListSerializer(serializers.ModelSerializer):
    """Serializer für VS-Service Liste mit aktuellen Preisen"""
    current_purchase_price = serializers.SerializerMethodField()
    current_sales_price = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VSService
        fields = [
            'id', 'article_number', 'name', 'short_description',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'current_purchase_price', 'current_sales_price',
            'created_at', 'updated_at'
        ]
    
    def get_current_purchase_price(self, obj):
        price = obj.get_current_purchase_price()
        return float(price) if price else None
    
    def get_current_sales_price(self, obj):
        price = obj.get_current_sales_price()
        return float(price) if price else None


class VSServiceDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für VS-Service mit allen Preisen"""
    prices = VSServicePriceSerializer(many=True, read_only=True)
    current_purchase_price = serializers.SerializerMethodField()
    current_list_price = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VSService
        fields = [
            'id', 'article_number', 'name',
            'short_description', 'short_description_en',
            'description', 'description_en',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'prices', 'current_purchase_price', 'current_list_price',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['article_number', 'created_at', 'updated_at']
    
    def get_current_purchase_price(self, obj):
        price = obj.get_current_purchase_price()
        return float(price) if price else None
    
    def get_current_list_price(self, obj):
        price = obj.get_current_sales_price()
        return float(price) if price else None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class VSServiceCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von VS-Service"""
    
    class Meta:
        model = VSService
        fields = [
            'id', 'article_number',
            'name', 'short_description', 'short_description_en',
            'description', 'description_en',
            'product_category',
            'unit', 'is_active'
        ]
        read_only_fields = ['id', 'article_number']


class ServiceTicketListSerializer(serializers.ModelSerializer):
    """Serializer für Service Ticket Liste"""
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    billing_display = serializers.CharField(source='get_billing_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ServiceTicket
        fields = [
            'id', 'ticket_number', 'title', 'customer', 'customer_name',
            'status', 'status_display', 'billing', 'billing_display',
            'assigned_to', 'assigned_to_name', 'is_open',
            'created_at', 'updated_at'
        ]
    
    def get_customer_name(self, obj):
        if obj.customer:
            return str(obj.customer)
        return None
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None


class TicketCommentSerializer(serializers.ModelSerializer):
    """Serializer für Ticket Kommentare"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TicketComment
        fields = ['id', 'comment', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at', 'created_by', 'created_by_name']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class TicketChangeLogSerializer(serializers.ModelSerializer):
    """Serializer für Ticket Änderungsprotokoll"""
    changed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TicketChangeLog
        fields = ['id', 'field_name', 'old_value', 'new_value', 'changed_by', 'changed_by_name', 'changed_at']
        read_only_fields = ['id', 'changed_at', 'changed_by', 'changed_by_name']
    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip() or obj.changed_by.username
        return None


class ServiceTicketDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für Service Tickets"""
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    billing_display = serializers.CharField(source='get_billing_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    linked_rma_number = serializers.SerializerMethodField()
    linked_system_name = serializers.SerializerMethodField()
    comments = TicketCommentSerializer(many=True, read_only=True)
    change_logs = TicketChangeLogSerializer(many=True, read_only=True)
    watcher_ids = serializers.PrimaryKeyRelatedField(
        source='watchers',
        many=True,
        read_only=True
    )
    is_open = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ServiceTicket
        fields = [
            'id', 'ticket_number', 'title', 'description',
            'customer', 'customer_name', 'contact_email',
            'status', 'status_display', 'billing', 'billing_display',
            'assigned_to', 'assigned_to_name',
            'linked_rma', 'linked_rma_number', 'linked_visiview_ticket', 'linked_system', 'linked_system_name',
            'watchers', 'watcher_ids',
            'comments', 'change_logs',
            'is_open',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['ticket_number', 'created_at', 'updated_at', 'comments', 'change_logs']
    
    def get_customer_name(self, obj):
        if obj.customer:
            return str(obj.customer)
        return None
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_linked_rma_number(self, obj):
        if obj.linked_rma:
            return obj.linked_rma.rma_number
        return None

    def get_linked_system_name(self, obj):
        if obj.linked_system:
            # Prefer system number + name when available
            if getattr(obj.linked_system, 'system_number', None):
                return f"{obj.linked_system.system_number} - {obj.linked_system.system_name}"
            return getattr(obj.linked_system, 'system_name', None)
        return None


class ServiceTicketCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von Service Tickets"""
    
    class Meta:
        model = ServiceTicket
        fields = [
            'id', 'ticket_number', 'title', 'description',
            'customer', 'contact_email', 'status', 'billing',
            'assigned_to', 'linked_rma', 'linked_visiview_ticket', 'linked_system',
            'watchers'
        ]
        read_only_fields = ['id', 'ticket_number']


class RMACaseListSerializer(serializers.ModelSerializer):
    """Serializer für RMA-Fall Liste"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = RMACase
        fields = [
            'id', 'rma_number', 'title', 'description',
            'customer_name', 'product_serial',
            'status', 'status_display',
            'received_date', 'created_at', 'updated_at'
        ]


class RMACaseDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für RMA-Fälle - alle Felder für Edit-Form"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = RMACase
        fields = [
            # Identifikation
            'id', 'rma_number',
            
            # Tab 1: Basisinfos
            'title', 'description', 'status', 'status_display',
            'customer', 'customer_name', 'customer_contact', 'customer_email', 'customer_phone',
            'linked_system', 'inventory_item',
            'product_name', 'product_serial', 'product_purchase_date',
            'warranty_status', 'fault_description',
            
            # Tab 2: Wareneingang/-ausgang
            'received_date', 'received_by', 'received_condition', 'tracking_inbound',
            'shipped_date', 'shipped_by', 'tracking_outbound', 'shipping_notes',
            
            # Tab 3: RMA-Kalkulation
            'estimated_cost', 'actual_cost', 'parts_cost', 'labor_cost',
            'shipping_cost', 'total_cost', 'quote_sent', 'quote_accepted',
            
            # Tab 4: Reparaturbericht
            'diagnosis', 'repair_actions', 'parts_used', 'repair_date',
            'repaired_by', 'test_results', 'final_notes',
            
            # Metadaten
            'assigned_to', 'assigned_to_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['rma_number', 'created_at', 'updated_at']
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class RMACaseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von RMA-Fällen"""
    
    class Meta:
        model = RMACase
        fields = [
            # Identifikation (read-only für Response)
            'id', 'rma_number',
            
            # Tab 1 - Basisinfos
            'customer', 'customer_name', 'customer_contact', 'customer_email', 'customer_phone',
            'linked_system', 'inventory_item',
            'title', 'description', 'status',
            'product_name', 'product_serial', 'product_purchase_date', 'warranty_status', 'fault_description',

            # Tab 2 - Wareneingang / Warenausgang
            'received_date', 'received_by', 'received_condition', 'tracking_inbound',
            'shipped_date', 'shipped_by', 'tracking_outbound', 'shipping_notes',

            # Tab 3 - Kalkulation
            'estimated_cost', 'actual_cost', 'parts_cost', 'labor_cost', 'shipping_cost', 'total_cost',
            'quote_sent', 'quote_accepted',

            # Tab 4 - Reparaturbericht
            'diagnosis', 'repair_actions', 'parts_used', 'repair_date', 'repaired_by', 'test_results', 'final_notes',

            # Metadaten
            'assigned_to'
        ]
        read_only_fields = ['id', 'rma_number']
