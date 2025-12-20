from rest_framework import serializers
from .models import Order, OrderItem
from suppliers.models import Supplier


class OrderItemSerializer(serializers.ModelSerializer):
    """Serializer für Bestellpositionen"""
    total_price = serializers.ReadOnlyField()
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'trading_product', 'asset', 'material_supply',
            'customer_order_number',
            'article_number', 'name', 'description',
            'quantity', 'unit', 'list_price', 'discount_percent',
            'final_price', 'currency', 'position', 'total_price'
        ]


class OrderListSerializer(serializers.ModelSerializer):
    """Serializer für Bestellübersicht (reduzierte Daten)"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    items_count = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number',
            'status', 'status_display', 'supplier', 'supplier_name',
            'order_date', 'delivery_date', 'payment_date',
            'items_count', 'total_amount',
            'created_by_name', 'created_at', 'updated_at'
        ]
    
    def get_items_count(self, obj):
        return obj.items.count()
    
    def get_total_amount(self, obj):
        total = sum(item.total_price for item in obj.items.all())
        return float(total)


class OrderDetailSerializer(serializers.ModelSerializer):
    """Serializer für Bestelldetails (alle Daten)"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    total_amount = serializers.SerializerMethodField()
    
    # Display-Felder für Konditionen
    payment_term_display = serializers.SerializerMethodField()
    delivery_term_display = serializers.SerializerMethodField()
    delivery_instruction_display = serializers.SerializerMethodField()
    
    # Lieferanten-Informationen für Bestelldokumente
    supplier_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number',
            'status', 'status_display', 'supplier', 'supplier_name',
            'supplier_details',
            'order_date', 'confirmation_date', 'delivery_date', 'payment_date',
            'payment_term', 'payment_term_display',
            'delivery_term', 'delivery_term_display',
            'delivery_instruction', 'delivery_instruction_display',
            'offer_reference', 'custom_text', 'order_document',
            'notes', 'items', 'total_amount',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'order_number', 'created_by', 'created_at', 'updated_at']
    
    def get_total_amount(self, obj):
        total = sum(item.total_price for item in obj.items.all())
        return float(total)
    
    def get_payment_term_display(self, obj):
        try:
            if obj.payment_term:
                return obj.payment_term.get_formatted_terms()
        except Exception as e:
            print(f"Error getting payment_term_display: {e}")
        return None
    
    def get_delivery_term_display(self, obj):
        try:
            if obj.delivery_term:
                return obj.delivery_term.get_incoterm_display()
        except Exception as e:
            print(f"Error getting delivery_term_display: {e}")
        return None
    
    def get_delivery_instruction_display(self, obj):
        try:
            if obj.delivery_instruction:
                return obj.delivery_instruction.name
        except Exception as e:
            print(f"Error getting delivery_instruction_display: {e}")
        return None
        read_only_fields = ['id', 'order_number', 'created_by', 'created_at', 'updated_at']
    
    def get_total_amount(self, obj):
        total = sum(item.total_price for item in obj.items.all())
        return float(total)
    
    def get_supplier_details(self, obj):
        """Lieferanten-Details für Bestelldokumente"""
        supplier = obj.supplier
        return {
            'company_name': supplier.company_name,
            'street': supplier.street,
            'house_number': supplier.house_number,
            'postal_code': supplier.postal_code,
            'city': supplier.city,
            'state': supplier.state,
            'country': supplier.country,
            'email': supplier.email,
            'phone': supplier.phone,
            'website': supplier.website,
            'customer_number': supplier.customer_number,
        }


class OrderCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellung/Aktualisierung mit verschachtelten Items"""
    items = OrderItemSerializer(many=True, required=False)
    
    class Meta:
        model = Order
        fields = [
            'status', 'supplier',
            'order_date', 'confirmation_date', 'delivery_date', 'payment_date',
            'payment_term', 'delivery_term', 'delivery_instruction',
            'offer_reference', 'custom_text', 'order_document',
            'notes', 'items'
        ]
    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        order = Order.objects.create(**validated_data)
        
        # Items erstellen
        for item_data in items_data:
            OrderItem.objects.create(order=order, **item_data)
        
        return order
    
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        
        # Update Order fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update Items (delete and recreate)
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                OrderItem.objects.create(order=instance, **item_data)
        
        return instance
