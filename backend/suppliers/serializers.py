from rest_framework import serializers
from .models import (
    Supplier, SupplierContact, TradingProduct, 
    SupplierProduct, ProductGroup, PriceList, SupplierAttachment
)
from verp_settings.serializers import PaymentTermSerializer, DeliveryTermSerializer, DeliveryInstructionSerializer


class SupplierContactSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanten-Kontakte"""
    contact_type_display = serializers.CharField(source='get_contact_type_display', read_only=True)
    
    class Meta:
        model = SupplierContact
        fields = [
            'id', 'contact_type', 'contact_type_display', 'is_primary', 'contact_person',
            'contact_function', 'street', 'house_number', 'address_supplement',
            'postal_code', 'city', 'state', 'country', 'latitude', 'longitude',
            'address', 'email', 'phone', 'mobile', 'notes', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SupplierAttachmentSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanten-Anhänge"""
    attachment_type_display = serializers.CharField(source='get_attachment_type_display', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    price_list_name = serializers.CharField(source='price_list.name', read_only=True)
    
    class Meta:
        model = SupplierAttachment
        fields = [
            'id', 'supplier', 'attachment_type', 'attachment_type_display', 'name',
            'file', 'file_url', 'filename', 'file_size', 'mime_type',
            'price_list', 'price_list_name', 'valid_from', 'valid_until', 'notes',
            'uploaded_by', 'uploaded_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'filename', 'file_size', 'file_url', 'uploaded_by', 'created_at', 'updated_at']


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
    attachments = SupplierAttachmentSerializer(many=True, read_only=True)
    product_groups = ProductGroupSerializer(many=True, read_only=True)
    price_lists = PriceListSerializer(many=True, read_only=True)
    supplier_products = SupplierProductSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    # Nested Serializer für Payment & Delivery Settings
    payment_term_detail = PaymentTermSerializer(source='payment_term', read_only=True)
    delivery_term_detail = DeliveryTermSerializer(source='delivery_term', read_only=True)
    delivery_instruction_detail = DeliveryInstructionSerializer(source='delivery_instruction', read_only=True)
    
    class Meta:
        model = Supplier
        fields = [
            'id', 'supplier_number', 'company_name', 'street', 'house_number',
            'address_supplement', 'postal_code', 'city', 'state', 'country',
            'address', 'email', 'phone', 'website', 'customer_number', 
            'payment_term', 'delivery_term', 'delivery_instruction',
            'payment_term_detail', 'delivery_term_detail', 'delivery_instruction_detail',
            'contacts', 'attachments', 'product_groups', 'price_lists', 'supplier_products',
            'notes', 'is_active', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'supplier_number', 'created_by', 'created_at', 'updated_at']


class SupplierCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanten Erstellung/Update mit verschachtelten Kontakten"""
    contacts = SupplierContactSerializer(many=True, required=False)
    website = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    
    class Meta:
        model = Supplier
        fields = [
            'company_name', 'street', 'house_number', 'address_supplement',
            'postal_code', 'city', 'state', 'country', 'address',
            'email', 'phone', 'website', 'customer_number',
            'payment_term', 'delivery_term', 'delivery_instruction',
            'contacts', 'notes', 'is_active'
        ]
    
    def validate_website(self, value):
        """Website-Feld: Leere Werte erlauben, automatisch Schema hinzufügen"""
        if not value or not value.strip():
            return ''
        value = value.strip()
        if value and not value.startswith(('http://', 'https://')):
            value = 'https://' + value
        return value
    
    @staticmethod
    def _clean_contact_data(contact_data):
        """Entfernt Read-Only und berechnete Felder aus Kontaktdaten"""
        read_only_keys = ['id', 'contact_type_display', 'created_at', 'updated_at', 'supplier']
        return {k: v for k, v in contact_data.items() if k not in read_only_keys}
    
    def create(self, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        supplier = Supplier.objects.create(**validated_data)
        
        for contact_data in contacts_data:
            clean_data = self._clean_contact_data(contact_data)
            SupplierContact.objects.create(supplier=supplier, **clean_data)
        
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
                clean_data = self._clean_contact_data(contact_data)
                SupplierContact.objects.create(supplier=instance, **clean_data)
        
        return instance
