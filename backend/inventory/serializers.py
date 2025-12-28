from rest_framework import serializers
from .models import IncomingGoods, InventoryItem
from suppliers.serializers import SupplierSerializer


class IncomingGoodsSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    supplier_number = serializers.CharField(source='supplier.supplier_number', read_only=True)
    
    class Meta:
        model = IncomingGoods
        fields = [
            'id',
            'order_item',
            'article_number',
            'name',
            'description',
            'delivered_quantity',
            'unit',
            'purchase_price',
            'currency',
            'item_function',
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
    total_value = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryItem
        fields = [
            'id',
            'inventory_number',
            'article_number',
            'visitron_part_number',
            'name',
            'description',
            'item_function',
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
            'order_number',
            'customer_order_number',
            'management_info',
            'status',
            'stored_at',
            'stored_by',
            'updated_at',
        ]
        read_only_fields = ['inventory_number', 'stored_at', 'stored_by', 'updated_at']
    
    def get_total_value(self, obj):
        """Berechnet den Gesamtwert (Menge * Einkaufspreis)"""
        return float(obj.quantity * obj.purchase_price)


class InventoryItemDetailSerializer(serializers.ModelSerializer):
    supplier = SupplierSerializer(read_only=True)
    stored_by_name = serializers.CharField(source='stored_by.get_full_name', read_only=True)
    total_value = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryItem
        fields = '__all__'
        read_only_fields = ['inventory_number', 'stored_at', 'stored_by', 'updated_at']
    
    def get_total_value(self, obj):
        """Berechnet den Gesamtwert (Menge * Einkaufspreis)"""
        return float(obj.quantity * obj.purchase_price)


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
