from rest_framework import serializers
from .models import Asset, Supplier


class AssetListSerializer(serializers.ModelSerializer):
    """
    Serializer für die Auflistung von Assets
    """
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    product_group_name = serializers.CharField(source='product_group.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Asset
        fields = [
            'id', 'visitron_part_number', 'supplier_part_number', 'serial_number',
            'name', 'supplier', 'supplier_name', 'product_group', 'product_group_name',
            'short_description', 'description', 'purchase_price', 'purchase_currency', 'sale_price', 
            'purchase_date', 'expected_delivery_date', 'actual_delivery_date',
            'warranty_months', 'current_value', 'status', 'status_display',
            'is_active', 'created_at'
        ]


class AssetDetailSerializer(serializers.ModelSerializer):
    """
    Detaillierter Serializer für Assets
    """
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    product_group_name = serializers.CharField(source='product_group.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Asset
        fields = '__all__'
        read_only_fields = ['visitron_part_number', 'created_at', 'updated_at']


class AssetCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer für Erstellen und Aktualisieren von Assets
    """
    class Meta:
        model = Asset
        fields = [
            'name', 'visitron_part_number', 'supplier_part_number', 'serial_number',
            'supplier', 'product_group', 'description',
            'purchase_price', 'purchase_currency', 'sale_price',
            'purchase_date', 'expected_delivery_date', 'actual_delivery_date',
            'warranty_months', 'current_value',
            'status', 'notes', 'is_active'
        ]
        read_only_fields = ['visitron_part_number']
    
    def validate(self, data):
        """Validierung der Daten"""
        # Prüfe ob actual_delivery_date nach purchase_date liegt
        if data.get('actual_delivery_date') and data.get('purchase_date'):
            if data['actual_delivery_date'] < data['purchase_date']:
                raise serializers.ValidationError({
                    'actual_delivery_date': 'Das tatsächliche Lieferdatum muss nach dem Kaufdatum liegen.'
                })
        
        # Prüfe ob expected_delivery_date nach purchase_date liegt
        if data.get('expected_delivery_date') and data.get('purchase_date'):
            if data['expected_delivery_date'] < data['purchase_date']:
                raise serializers.ValidationError({
                    'expected_delivery_date': 'Das erwartete Lieferdatum muss nach dem Kaufdatum liegen.'
                })
        
        return data
