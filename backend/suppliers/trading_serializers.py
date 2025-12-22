from rest_framework import serializers
from .models import TradingProduct, Supplier


class TradingProductListSerializer(serializers.ModelSerializer):
    """
    Serializer für die Auflistung von Handelswaren
    """
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    product_group_name = serializers.CharField(source='product_group.name', read_only=True)
    price_list_name = serializers.CharField(source='price_list.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    purchase_price_eur = serializers.SerializerMethodField()
    visitron_list_price = serializers.SerializerMethodField()
    
    class Meta:
        model = TradingProduct
        fields = [
            'id', 'visitron_part_number', 'supplier_part_number', 'name',
            'supplier', 'supplier_name', 'product_group', 'product_group_name',
            'price_list', 'price_list_name', 'category', 'category_display',
            'short_description', 'description', 'list_price', 'list_price_currency', 'exchange_rate', 'discount_percent',
            'price_valid_from', 'price_valid_until', 'margin_percent',
            'purchase_price_eur', 'visitron_list_price', 'is_active', 'created_at'
        ]
    
    def get_purchase_price_eur(self, obj):
        """Berechnet den Einkaufspreis in EUR (ohne Wechselkurs)"""
        return float(round(obj.calculate_purchase_price(), 2))
    
    def get_visitron_list_price(self, obj):
        """Berechnet den Visitron-Listenpreis (auf volle Euros gerundet)"""
        return float(obj.calculate_visitron_list_price())


class TradingProductDetailSerializer(serializers.ModelSerializer):
    """
    Detaillierter Serializer für Handelswaren
    """
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    purchase_price_eur = serializers.SerializerMethodField()
    visitron_list_price = serializers.SerializerMethodField()
    price_breakdown = serializers.SerializerMethodField()
    
    class Meta:
        model = TradingProduct
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def get_purchase_price_eur(self, obj):
        """Berechnet den Einkaufspreis"""
        return float(round(obj.calculate_purchase_price(), 2))
    
    def get_visitron_list_price(self, obj):
        """Berechnet den Visitron-Listenpreis (auf volle Euros gerundet)"""
        return float(obj.calculate_visitron_list_price())
    
    def get_price_breakdown(self, obj):
        """Detaillierte Preisaufschlüsselung"""
        from decimal import Decimal
        
        base_price = obj.list_price * (Decimal('1') - obj.discount_percent / Decimal('100'))
        
        shipping = obj.shipping_cost if not obj.shipping_cost_is_percent else base_price * (obj.shipping_cost / Decimal('100'))
        import_c = obj.import_cost if not obj.import_cost_is_percent else base_price * (obj.import_cost / Decimal('100'))
        handling = obj.handling_cost if not obj.handling_cost_is_percent else base_price * (obj.handling_cost / Decimal('100'))
        storage = obj.storage_cost if not obj.storage_cost_is_percent else base_price * (obj.storage_cost / Decimal('100'))
        
        return {
            'list_price': float(obj.list_price),
            'list_price_currency': obj.list_price_currency,
            'exchange_rate': float(obj.exchange_rate),
            'discount_percent': float(obj.discount_percent),
            'base_price_after_discount': round(float(base_price), 2),
            'shipping_cost': round(float(shipping), 2),
            'import_cost': round(float(import_c), 2),
            'handling_cost': round(float(handling), 2),
            'storage_cost': round(float(storage), 2),
            'purchase_price': round(float(obj.calculate_purchase_price()), 2),
            'margin_percent': float(obj.margin_percent),
            'visitron_list_price': float(obj.calculate_visitron_list_price()),
            'costs_currency': obj.costs_currency,
        }


class TradingProductCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer für Erstellen und Aktualisieren von Handelswaren
    """
    class Meta:
        model = TradingProduct
        fields = [
            'name', 'visitron_part_number', 'supplier_part_number',
            'supplier', 'product_group', 'price_list', 'category', 'description', 'unit',
            'list_price', 'list_price_currency', 'exchange_rate', 'price_valid_from', 'price_valid_until',
            'discount_percent', 'margin_percent',
            'shipping_cost', 'shipping_cost_is_percent',
            'import_cost', 'import_cost_is_percent',
            'handling_cost', 'handling_cost_is_percent',
            'storage_cost', 'storage_cost_is_percent',
            'costs_currency', 'minimum_stock', 'is_active'
        ]
        read_only_fields = ['visitron_part_number']
    
    def validate(self, data):
        """Validierung der Daten"""
        # Prüfe ob price_valid_until nach price_valid_from liegt
        if data.get('price_valid_until') and data.get('price_valid_from'):
            if data['price_valid_until'] < data['price_valid_from']:
                raise serializers.ValidationError({
                    'price_valid_until': 'Das Enddatum muss nach dem Startdatum liegen.'
                })
        
        # Prüfe ob Rabatt zwischen 0 und 100 liegt
        if data.get('discount_percent'):
            if data['discount_percent'] < 0 or data['discount_percent'] > 100:
                raise serializers.ValidationError({
                    'discount_percent': 'Der Rabatt muss zwischen 0 und 100% liegen.'
                })
        
        return data
