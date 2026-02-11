from rest_framework import serializers
from .models import SalesPriceList
from suppliers.models import Supplier


class SupplierSimpleSerializer(serializers.ModelSerializer):
    """Einfacher Serializer für Lieferantenauswahl"""
    class Meta:
        model = Supplier
        fields = ['id', 'supplier_number', 'company_name']


class SalesPriceListListSerializer(serializers.ModelSerializer):
    """Serializer für Preislisten-Übersicht"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True, allow_null=True)
    trading_supplier_name = serializers.CharField(source='trading_supplier.company_name', read_only=True, allow_null=True)
    pricelist_type_display = serializers.CharField(source='get_pricelist_type_display', read_only=True)
    display_name = serializers.SerializerMethodField()
    validity_period = serializers.SerializerMethodField()
    has_pdf = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = SalesPriceList
        fields = [
            'id', 'pricelist_type', 'pricelist_type_display', 'display_name',
            'supplier', 'supplier_name', 
            'trading_supplier', 'trading_supplier_name',
            'include_vs_hardware', 'include_visiview', 'include_trading', 'include_vs_service',
            'valid_from_month', 'valid_from_year',
            'valid_until_month', 'valid_until_year',
            'validity_period', 'subtitle',
            'has_pdf', 'pdf_url',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
    
    def get_display_name(self, obj):
        return str(obj)
    
    def get_validity_period(self, obj):
        return f"{obj.valid_from_month:02d}/{obj.valid_from_year} - {obj.valid_until_month:02d}/{obj.valid_until_year}"
    
    def get_has_pdf(self, obj):
        return bool(obj.pdf_file)
    
    def get_pdf_url(self, obj):
        if obj.pdf_file:
            return obj.pdf_file.url
        return None


class SalesPriceListDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für Preislisten"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True, allow_null=True)
    trading_supplier_name = serializers.CharField(source='trading_supplier.company_name', read_only=True, allow_null=True)
    pricelist_type_display = serializers.CharField(source='get_pricelist_type_display', read_only=True)
    display_name = serializers.SerializerMethodField()
    validity_period = serializers.SerializerMethodField()
    validity_string = serializers.SerializerMethodField()
    subtitle_generated = serializers.SerializerMethodField()
    has_pdf = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = SalesPriceList
        fields = [
            'id', 'pricelist_type', 'pricelist_type_display', 'display_name',
            'supplier', 'supplier_name',
            'trading_supplier', 'trading_supplier_name',
            'include_vs_hardware', 'include_visiview', 'include_trading', 'include_vs_service',
            'valid_from_month', 'valid_from_year',
            'valid_until_month', 'valid_until_year',
            'validity_period', 'validity_string', 'subtitle', 'subtitle_generated',
            'pdf_file', 'has_pdf', 'pdf_url', 'filename',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
    
    def get_display_name(self, obj):
        return str(obj)
    
    def get_validity_period(self, obj):
        return f"{obj.valid_from_month:02d}/{obj.valid_from_year} - {obj.valid_until_month:02d}/{obj.valid_until_year}"
    
    def get_validity_string(self, obj):
        return obj.get_validity_string()
    
    def get_subtitle_generated(self, obj):
        return obj.get_subtitle()
    
    def get_has_pdf(self, obj):
        return bool(obj.pdf_file)
    
    def get_pdf_url(self, obj):
        if obj.pdf_file:
            return obj.pdf_file.url
        return None
    
    def get_filename(self, obj):
        return obj.get_filename()


class SalesPriceListCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen und Bearbeiten von Preislisten"""
    
    class Meta:
        model = SalesPriceList
        fields = [
            'id', 'pricelist_type',
            'supplier', 'trading_supplier',
            'include_vs_hardware', 'include_visiview', 'include_trading', 'include_vs_service',
            'valid_from_month', 'valid_from_year',
            'valid_until_month', 'valid_until_year',
            'subtitle'
        ]
    
    def validate(self, data):
        """Validiere die Daten"""
        from django.core.exceptions import ValidationError as DjangoValidationError
        
        # Erstelle temporäres Objekt für clean() Validierung
        instance = self.instance or SalesPriceList()
        for key, value in data.items():
            setattr(instance, key, value)
        
        try:
            instance.clean()
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message_dict if hasattr(e, 'message_dict') else str(e))
        
        return data
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
