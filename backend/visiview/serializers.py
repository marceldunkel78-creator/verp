from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import VisiViewProduct, VisiViewProductPrice

User = get_user_model()


class VisiViewProductPriceSerializer(serializers.ModelSerializer):
    """Serializer für VisiView Produkt Preise"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewProductPrice
        fields = [
            'id', 'product', 'purchase_price', 'list_price',
            'valid_from', 'valid_until', 'notes',
            'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def validate(self, data):
        """Prüft auf Überlappungen bei Gültigkeitszeiträumen"""
        product = data.get('product') or (self.instance.product if self.instance else None)
        valid_from = data.get('valid_from') or (self.instance.valid_from if self.instance else None)
        valid_until = data.get('valid_until', None)
        
        if not product or not valid_from:
            return data
        
        # Alle bestehenden Preise für dieses Produkt
        overlapping = VisiViewProductPrice.objects.filter(product=product)
        
        if self.instance:
            overlapping = overlapping.exclude(pk=self.instance.pk)
        
        for price in overlapping:
            # Überlappungsprüfung
            if not valid_until and not price.valid_until:
                # Beide ohne Enddatum - überlappen immer
                raise serializers.ValidationError({
                    'valid_from': f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                })
            elif not valid_until:
                # Neuer Preis ohne Enddatum
                if price.valid_until and price.valid_until >= valid_from:
                    raise serializers.ValidationError({
                        'valid_from': f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                    })
                if not price.valid_until and price.valid_from <= valid_from:
                    raise serializers.ValidationError({
                        'valid_from': f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    })
            elif not price.valid_until:
                # Bestehender Preis ohne Enddatum
                if price.valid_from <= valid_until:
                    raise serializers.ValidationError({
                        'valid_until': f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    })
            else:
                # Beide mit Enddatum
                if not (valid_until < price.valid_from or valid_from > price.valid_until):
                    raise serializers.ValidationError({
                        'valid_from': f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                    })
        
        return data


class VisiViewProductListSerializer(serializers.ModelSerializer):
    """Serializer für Produktliste (kompakt)"""
    current_purchase_price = serializers.SerializerMethodField()
    current_list_price = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VisiViewProduct
        fields = [
            'id', 'article_number', 'name', 'description', 'description_en',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'current_purchase_price', 'current_list_price',
            'created_at', 'updated_at'
        ]
    
    def get_current_purchase_price(self, obj):
        return obj.get_current_purchase_price()
    
    def get_current_list_price(self, obj):
        return obj.get_current_sales_price()


class VisiViewProductDetailSerializer(serializers.ModelSerializer):
    """Serializer für Produktdetails mit allen Preisen"""
    prices = VisiViewProductPriceSerializer(many=True, read_only=True)
    current_purchase_price = serializers.SerializerMethodField()
    current_list_price = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewProduct
        fields = [
            'id', 'article_number', 'name', 'description', 'description_en',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'prices', 'current_purchase_price', 'current_list_price',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
    
    def get_current_purchase_price(self, obj):
        return obj.get_current_purchase_price()
    
    def get_current_list_price(self, obj):
        return obj.get_current_sales_price()
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class VisiViewProductCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Produkt erstellen/bearbeiten"""
    
    class Meta:
        model = VisiViewProduct
        fields = [
            'id', 'article_number', 'name', 'description', 'description_en',
            'product_category', 'unit', 'is_active'
        ]
        read_only_fields = ['article_number']
