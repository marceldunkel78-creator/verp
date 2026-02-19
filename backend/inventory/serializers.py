from rest_framework import serializers
from decimal import Decimal
from .models import IncomingGoods, InventoryItem, EQUIPMENT_TEMPLATES, QM_TEMPLATES
from suppliers.serializers import SupplierSerializer
from verp_settings.serializers import ProductCategorySerializer


class IncomingGoodsSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    supplier_number = serializers.CharField(source='supplier.supplier_number', read_only=True)
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = IncomingGoods
        fields = [
            'id',
            'order_item',
            'article_number',
            'name',
            'description',
            'model_designation',
            'delivered_quantity',
            'unit',
            'purchase_price',
            'currency',
            'item_function',
            'product_category',
            'product_category_name',
            'item_category',
            'serial_number',
            'trading_product',
            'material_supply',
            'supplier',
            'supplier_name',
            'supplier_number',
            'order_number',
            'customer_order_number',
            'management_info',
            'is_transferred',
            'transferred_at',
            'transferred_by',
            'received_at',
            'created_by',
        ]
        read_only_fields = ['received_at', 'transferred_at', 'transferred_by', 'created_by']


class IncomingGoodsDetailSerializer(serializers.ModelSerializer):
    supplier = SupplierSerializer(read_only=True)
    transferred_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    def get_transferred_by_name(self, obj):
        return obj.transferred_by.get_full_name() if obj.transferred_by else None
    
    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None
    
    class Meta:
        model = IncomingGoods
        fields = '__all__'
        read_only_fields = ['received_at', 'transferred_at', 'transferred_by', 'created_by']


class InventoryItemSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    supplier_number = serializers.CharField(source='supplier.supplier_number', read_only=True)
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    product_category_code = serializers.CharField(source='product_category.code', read_only=True)
    total_value = serializers.SerializerMethodField()
    customer_display = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryItem
        fields = [
            'id',
            'inventory_number',
            'article_number',
            'visitron_part_number',
            'name',
            'model_designation',
            'description',
            'item_function',
            'product_category',
            'product_category_name',
            'product_category_code',
            'item_category',
            'serial_number',
            'quantity',
            'unit',
            'purchase_price',
            'currency',
            'total_value',
            'supplier',
            'supplier_name',
            'supplier_number',
            'trading_product',
            'material_supply',
            'order',
            'order_number',
            'customer',
            'customer_name',
            'customer_display',
            'customer_order',
            'customer_order_number',
            'system',
            'system_number',
            'project',
            'project_number',
            'delivery_date',
            'firmware_version',
            'firmware_notes',
            'equipment_data',
            'qm_data',
            'outgoing_checks',
            'production_checklist_data',
            'notes',
            'management_info',
            'status',
            'reserved_by',
            'reserved_until',
            'reservation_reason',
            'stored_at',
            'stored_by',
            'updated_at',
        ]
        read_only_fields = ['inventory_number', 'stored_at', 'stored_by', 'updated_at']
    
    def get_total_value(self, obj):
        """Berechnet den Gesamtwert (Menge * Einkaufspreis)"""
        try:
            q = obj.quantity if obj.quantity is not None else Decimal('0')
            p = obj.purchase_price if obj.purchase_price is not None else Decimal('0')
            return float(q * p)
        except Exception:
            return 0.0
    
    def get_customer_display(self, obj):
        """Gibt den Kundennamen zurück (Nummer - Vorname Nachname)"""
        if obj.customer:
            parts = []
            if obj.customer.customer_number:
                parts.append(obj.customer.customer_number)
            name_parts = []
            if obj.customer.title:
                name_parts.append(obj.customer.title)
            if obj.customer.first_name:
                name_parts.append(obj.customer.first_name)
            if obj.customer.last_name:
                name_parts.append(obj.customer.last_name)
            if name_parts:
                name = ' '.join(name_parts)
                if parts:
                    parts.append(name)
                else:
                    parts.append(name)
            return ' - '.join(parts) if len(parts) > 1 else (parts[0] if parts else str(obj.customer))
        return obj.customer_name


class InventoryItemDetailSerializer(serializers.ModelSerializer):
    supplier = SupplierSerializer(read_only=True)
    product_category_data = ProductCategorySerializer(source='product_category', read_only=True)
    stored_by_name = serializers.CharField(source='stored_by.get_full_name', read_only=True)
    total_value = serializers.SerializerMethodField()
    equipment_template = serializers.SerializerMethodField()
    qm_template = serializers.SerializerMethodField()
    customer_display = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryItem
        fields = '__all__'
        read_only_fields = ['inventory_number', 'stored_at', 'stored_by', 'updated_at']
    
    def get_total_value(self, obj):
        """Berechnet den Gesamtwert (Menge * Einkaufspreis)"""
        try:
            q = obj.quantity if obj.quantity is not None else Decimal('0')
            p = obj.purchase_price if obj.purchase_price is not None else Decimal('0')
            return float(q * p)
        except Exception:
            return 0.0
    
    def get_equipment_template(self, obj):
        """Gibt das Ausstattungs-Template basierend auf der Kategorie zurück"""
        if obj.product_category:
            category_code = obj.product_category.code
        else:
            category_code = obj.item_category
        return EQUIPMENT_TEMPLATES.get(category_code, {})
    
    def get_qm_template(self, obj):
        """Gibt das QM-Template basierend auf der Kategorie zurück"""
        if obj.product_category:
            category_code = obj.product_category.code
        else:
            category_code = obj.item_category
        return QM_TEMPLATES.get(category_code, QM_TEMPLATES.get('DEFAULT', {}))
    
    def get_customer_display(self, obj):
        """Gibt den Kundennamen zurück (Nummer - Vorname Nachname)"""
        if obj.customer:
            parts = []
            if obj.customer.customer_number:
                parts.append(obj.customer.customer_number)
            name_parts = []
            if obj.customer.title:
                name_parts.append(obj.customer.title)
            if obj.customer.first_name:
                name_parts.append(obj.customer.first_name)
            if obj.customer.last_name:
                name_parts.append(obj.customer.last_name)
            if name_parts:
                name = ' '.join(name_parts)
                if parts:
                    parts.append(name)
                else:
                    parts.append(name)
            return ' - '.join(parts) if len(parts) > 1 else (parts[0] if parts else str(obj.customer))
        return obj.customer_name


class TransferToInventorySerializer(serializers.Serializer):
    """
    Serializer für die Überführung einer Wareneingangsposition ins Lager
    """
    incoming_goods_id = serializers.IntegerField()
    
    def validate_incoming_goods_id(self, value):
        try:
            incoming = IncomingGoods.objects.get(id=value)
            if incoming.is_transferred:
                raise serializers.ValidationError("Diese Position wurde bereits ins Lager überführt.")
        except IncomingGoods.DoesNotExist:
            raise serializers.ValidationError("Wareneingang nicht gefunden.")
        return value
