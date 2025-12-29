from rest_framework import serializers
from .models import TradingProduct, TradingProductPrice, Supplier


class TradingProductPriceSerializer(serializers.ModelSerializer):
    """
    Serializer für Trading Product Preise (Preishistorie)
    """
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = TradingProductPrice
        fields = [
            'id', 'product', 'supplier_list_price', 'supplier_currency', 'exchange_rate',
            'discount_percent', 'shipping_cost', 'shipping_cost_is_percent',
            'import_cost', 'import_cost_is_percent', 'handling_cost', 'handling_cost_is_percent',
            'storage_cost', 'storage_cost_is_percent', 'margin_percent',
            'purchase_price', 'list_price', 'valid_from', 'valid_until',
            'notes', 'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['purchase_price', 'list_price', 'created_at', 'created_by']
    
    def validate(self, data):
        """Prüft auf überlappende Gültigkeitszeiträume"""
        product = data.get('product') or (self.instance.product if self.instance else None)
        valid_from = data.get('valid_from') or (self.instance.valid_from if self.instance else None)
        valid_until = data.get('valid_until')
        
        if product and valid_from:
            overlapping = TradingProductPrice.objects.filter(product=product)
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            
            for price in overlapping:
                # Prüfe Überlappung
                if not valid_until and not price.valid_until:
                    # Beide ohne Enddatum
                    raise serializers.ValidationError(
                        f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    )
                elif not valid_until:
                    if price.valid_until and price.valid_until >= valid_from:
                        raise serializers.ValidationError(
                            f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                        )
                elif not price.valid_until:
                    if price.valid_from <= valid_until:
                        raise serializers.ValidationError(
                            f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                        )
                else:
                    # Beide haben Enddatum
                    if not (valid_until < price.valid_from or valid_from > price.valid_until):
                        raise serializers.ValidationError(
                            f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                        )
        
        return data
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


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
    current_price = serializers.SerializerMethodField()
    
    class Meta:
        model = TradingProduct
        fields = [
            'id', 'visitron_part_number', 'supplier_part_number', 'name',
            'supplier', 'supplier_name', 'product_group', 'product_group_name',
            'price_list', 'price_list_name', 'category', 'category_display',
            'short_description', 'short_description_en', 'description', 'description_en',
            'list_price', 'list_price_currency', 'exchange_rate', 'discount_percent',
            'price_valid_from', 'price_valid_until', 'margin_percent',
            'purchase_price_eur', 'visitron_list_price', 'current_price', 'is_active', 'created_at'
        ]
    
    def get_purchase_price_eur(self, obj):
        """Berechnet den Einkaufspreis in EUR (ohne Wechselkurs)"""
        return float(round(obj.calculate_purchase_price(), 2))
    
    def get_visitron_list_price(self, obj):
        """Berechnet den Visitron-Listenpreis (auf volle Euros gerundet)"""
        return float(obj.calculate_visitron_list_price())
    
    def get_current_price(self, obj):
        """Gibt den aktuell gültigen Preis aus der Preishistorie zurück"""
        current = obj.get_current_price()
        if current:
            return {
                'id': current.id,
                'purchase_price': float(current.purchase_price),
                'list_price': float(current.list_price),
                'valid_from': current.valid_from,
                'valid_until': current.valid_until
            }
        return None


class TradingProductDetailSerializer(serializers.ModelSerializer):
    """
    Detaillierter Serializer für Handelswaren
    """
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    purchase_price_eur = serializers.SerializerMethodField()
    visitron_list_price = serializers.SerializerMethodField()
    price_breakdown = serializers.SerializerMethodField()
    price_history = TradingProductPriceSerializer(many=True, read_only=True)
    current_price = serializers.SerializerMethodField()
    
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
    
    def get_current_price(self, obj):
        """Gibt den aktuell gültigen Preis aus der Preishistorie zurück"""
        current = obj.get_current_price()
        if current:
            return TradingProductPriceSerializer(current).data
        return None
    
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
            'supplier', 'product_group', 'price_list', 'category',
            'description', 'description_en', 'short_description', 'short_description_en',
            'unit', 'list_price', 'list_price_currency', 'exchange_rate',
            'price_valid_from', 'price_valid_until', 'discount_percent', 'margin_percent',
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
