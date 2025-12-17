from rest_framework import serializers
from .models import (
    Supplier, SupplierContact, TradingProduct, 
    SupplierProduct
)


class SupplierContactSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanten-Kontakte"""
    contact_type_display = serializers.CharField(source='get_contact_type_display', read_only=True)
    
    class Meta:
        model = SupplierContact
        fields = [
            'id', 'contact_type', 'contact_type_display', 'contact_person',
            'contact_function', 'address', 'email', 'phone', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SupplierProductSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanten-Produkt Verknüpfungen"""
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_article_number = serializers.CharField(source='product.article_number', read_only=True)
    
    class Meta:
        model = SupplierProduct
        fields = [
            'id', 'product', 'product_name', 'product_article_number',
            'supplier_article_number', 'purchase_price', 'currency',
            'delivery_time_days', 'minimum_order_quantity',
            'is_preferred_supplier', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SupplierSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanten mit verschachtelten Kontakten"""
    contacts = SupplierContactSerializer(many=True, read_only=True)
    supplier_products = SupplierProductSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Supplier
        fields = [
            'id', 'company_name', 'address', 'email', 'phone',
            'contacts', 'supplier_products', 'notes', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class SupplierCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanten Erstellung/Update mit verschachtelten Kontakten"""
    contacts = SupplierContactSerializer(many=True, required=False)
    
    class Meta:
        model = Supplier
        fields = [
            'company_name', 'address', 'email', 'phone',
            'contacts', 'notes', 'is_active'
        ]
    
    def create(self, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        supplier = Supplier.objects.create(**validated_data)
        
        for contact_data in contacts_data:
            SupplierContact.objects.create(supplier=supplier, **contact_data)
        
        return supplier
    
    def update(self, instance, validated_data):
        contacts_data = validated_data.pop('contacts', None)
        
        # Update Supplier Felder
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update Kontakte wenn vorhanden
        if contacts_data is not None:
            # Lösche alte Kontakte und erstelle neue
            instance.contacts.all().delete()
            for contact_data in contacts_data:
                SupplierContact.objects.create(supplier=instance, **contact_data)
        
        return instance
