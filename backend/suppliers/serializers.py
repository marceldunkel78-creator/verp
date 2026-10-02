import logging
from django.db import transaction
from rest_framework import serializers
from .models import (
    Supplier, SupplierContact, TradingProduct, 
    SupplierProduct, ProductGroup, PriceList, SupplierAttachment
)

logger = logging.getLogger(__name__)
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


class SupplierListSerializer(serializers.ModelSerializer):
    """
    Kompakte Lieferantenliste fuer Kachel- und Tabellenansicht.

    Enthaelt bewusst die Verknuepfungszahlen (Lagerartikel/Bestellungen/Kontakte/
    Warengruppen/Preislisten), weil beim Aufraeumen von Dubletten sofort
    sichtbar sein muss, welcher Lieferant ueberhaupt Daten hat.

    WICHTIG: Diese Liste liefert KEINE verschachtelten Objekte (`contacts`,
    `product_groups`, `price_lists`), sondern nur Zaehler. Vorher kam der
    volle `SupplierSerializer` und schleppte alle Listen mit - das kostete
    pro Lieferant Dutzende Zeilen und ist im Detail ohnehin nicht noetig
    (die Detailseite holt sie ueber `/suppliers/{id}/`).

    Die Zaehler kommen per Annotation aus `SupplierViewSet.get_queryset()`,
    damit keine N+1-Queries entstehen.
    """
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    # Annotierte Zaehler sind KEINE Modellfelder. Ohne ausdrueckliche
    # Deklaration sucht DRF sie im Model nach und meldet
    # "Field name `inventory_items_count` is not valid for model `Supplier`".
    # IntegerField(read_only=True) liest einfach das Attribut, das
    # `SupplierViewSet.get_queryset()` per annotate() gesetzt hat.
    inventory_items_count = serializers.IntegerField(read_only=True)
    orders_count = serializers.IntegerField(read_only=True)
    contacts_count = serializers.IntegerField(read_only=True)
    product_groups_count = serializers.IntegerField(read_only=True)
    price_lists_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Supplier
        fields = [
            'id', 'supplier_number', 'company_name', 'street', 'house_number',
            'address_supplement', 'postal_code', 'city', 'state', 'country',
            'email', 'phone', 'website', 'customer_number',
            'notes', 'is_active', 'created_by_name', 'created_at',
            'inventory_items_count', 'orders_count',
            'contacts_count', 'product_groups_count', 'price_lists_count',
        ]
        read_only_fields = ['id', 'supplier_number', 'created_at']


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
    
    @staticmethod
    def _normalize_fk_fields(data):
        """Konvertiere leere Strings zu None für ForeignKey-Felder"""
        fk_fields = ['payment_term', 'delivery_term', 'delivery_instruction']
        for field in fk_fields:
            if field in data and data[field] == '':
                data[field] = None
        return data
    
    def create(self, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        validated_data = self._normalize_fk_fields(validated_data)
        
        try:
            with transaction.atomic():
                supplier = Supplier.objects.create(**validated_data)
                for contact_data in contacts_data:
                    clean_data = self._clean_contact_data(contact_data)
                    SupplierContact.objects.create(supplier=supplier, **clean_data)
        except Exception as e:
            logger.error(f'Fehler beim Erstellen des Lieferanten: {e}', exc_info=True)
            raise serializers.ValidationError({'detail': f'Fehler beim Erstellen: {str(e)}'})
        
        return supplier
    
    def update(self, instance, validated_data):
        contacts_data = validated_data.pop('contacts', None)
        validated_data = self._normalize_fk_fields(validated_data)
        
        try:
            with transaction.atomic():
                # Update Supplier Felder
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                instance.save()
                
                # Update Kontakte wenn vorhanden
                if contacts_data is not None:
                    # Lösche alte Kontakte und erstelle neue
                    instance.contacts.all().delete()
                    for i, contact_data in enumerate(contacts_data):
                        clean_data = self._clean_contact_data(contact_data)
                        try:
                            SupplierContact.objects.create(supplier=instance, **clean_data)
                        except Exception as ce:
                            logger.error(f'Fehler bei Kontakt {i}: {ce}, Daten: {clean_data}', exc_info=True)
                            raise
        except serializers.ValidationError:
            raise
        except Exception as e:
            logger.error(f'Fehler beim Aktualisieren des Lieferanten {instance.pk}: {e}', exc_info=True)
            raise serializers.ValidationError({'detail': f'Fehler beim Speichern: {str(e)}'})
        
        return instance
