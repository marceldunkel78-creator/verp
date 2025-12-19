from rest_framework import serializers
from .models import (
    Supplier, SupplierContact, TradingProduct, 
    SupplierProduct, ProductGroup, PriceList
)


class SupplierContactSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanten-Kontakte"""
    contact_type_display = serializers.CharField(source='get_contact_type_display', read_only=True)
    
    class Meta:
        model = SupplierContact
        fields = [
            'id', 'contact_type', 'contact_type_display', 'contact_person',
            'contact_function', 'street', 'house_number', 'address_supplement',
            'postal_code', 'city', 'state', 'country', 'address',
            'email', 'phone', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate(self, data):
        """Validiere mit der clean() Methode des Models"""
        # Nur validieren wenn wir bereits eine Instanz haben
        # Bei neuen Kontakten wird die Validierung in SupplierCreateUpdateSerializer durchgeführt
        if self.instance:
            instance = SupplierContact(**data)
            instance.pk = self.instance.pk
            instance.supplier = self.instance.supplier
            instance.clean()
        return data


class ProductGroupSerializer(serializers.ModelSerializer):
    """Serializer für Warengruppen"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    
    class Meta:
        model = ProductGroup
        fields = [
            'id', 'supplier', 'supplier_name', 'name', 'discount_percent',
            'description', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PriceListSerializer(serializers.ModelSerializer):
    """Serializer für Preislisten"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    
    class Meta:
        model = PriceList
        fields = [
            'id', 'supplier', 'supplier_name', 'name', 'valid_from', 'valid_until',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, data):
        """Validierung mit clean() Methode des Models"""
        instance = PriceList(**data)
        if self.instance:
            instance.pk = self.instance.pk
        instance.clean()
        return data


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
    product_groups = ProductGroupSerializer(many=True, read_only=True)
    price_lists = PriceListSerializer(many=True, read_only=True)
    supplier_products = SupplierProductSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Supplier
        fields = [
            'id', 'supplier_number', 'company_name', 'street', 'house_number',
            'address_supplement', 'postal_code', 'city', 'state', 'country',
            'address', 'email', 'phone', 'website', 'contacts', 'product_groups', 'price_lists',
            'supplier_products', 'notes', 'is_active', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'supplier_number', 'created_by', 'created_at', 'updated_at']


class SupplierCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanten Erstellung/Update mit verschachtelten Kontakten"""
    contacts = SupplierContactSerializer(many=True, required=False)
    
    class Meta:
        model = Supplier
        fields = [
            'company_name', 'street', 'house_number', 'address_supplement',
            'postal_code', 'city', 'state', 'country', 'address',
            'email', 'phone', 'website', 'contacts', 'notes', 'is_active'
        ]
    
    def create(self, validated_data):
        from django.core.exceptions import ValidationError
        contacts_data = validated_data.pop('contacts', [])
        supplier = Supplier.objects.create(**validated_data)
        
        for contact_data in contacts_data:
            contact = SupplierContact(supplier=supplier, **contact_data)
            try:
                contact.clean()  # Validierung durchführen
            except ValidationError as e:
                supplier.delete()  # Rollback bei Fehler
                raise serializers.ValidationError(e.message_dict)
            contact.save()
        
        return supplier
    
    def update(self, instance, validated_data):
        from django.core.exceptions import ValidationError
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
                contact = SupplierContact(supplier=instance, **contact_data)
                try:
                    contact.clean()  # Validierung durchführen
                except ValidationError as e:
                    raise serializers.ValidationError(e.message_dict)
                contact.save()
        
        return instance
