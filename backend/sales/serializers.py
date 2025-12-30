from rest_framework import serializers
from .models import Quotation, QuotationItem
from customers.models import Customer
from suppliers.models import TradingProduct
from django.contrib.contenttypes.models import ContentType


class QuotationItemSerializer(serializers.ModelSerializer):
    """
    Serializer für Angebotspositionen (inkl. Warensammlungen und Systempreise)
    """
    item_type = serializers.SerializerMethodField()
    item_name = serializers.SerializerMethodField()
    item_description = serializers.SerializerMethodField()
    item_article_number = serializers.SerializerMethodField()
    content_type_data = serializers.SerializerMethodField()
    subtotal = serializers.ReadOnlyField()
    tax_amount = serializers.ReadOnlyField()
    total = serializers.ReadOnlyField()
    total_purchase_cost = serializers.ReadOnlyField()
    margin_absolute = serializers.ReadOnlyField()
    margin_percent = serializers.ReadOnlyField()
    group_margin = serializers.SerializerMethodField()
    
    class Meta:
        model = QuotationItem
        fields = [
            'id', 'quotation', 'content_type', 'content_type_data', 'object_id',
            'item_type', 'item_name', 'item_description', 'item_article_number',
            'group_id', 'group_name', 'is_group_header',
            'position', 'description_type', 'quantity', 
            'unit_price', 'purchase_price', 'sale_price', 'uses_system_price',
            'discount_percent', 'tax_rate', 'notes', 'custom_description',
            'subtotal', 'tax_amount', 'total',
            'total_purchase_cost', 'margin_absolute', 'margin_percent', 'group_margin'
        ]
        read_only_fields = ['subtotal', 'tax_amount', 'total', 'total_purchase_cost', 
                           'margin_absolute', 'margin_percent']
    
    def get_content_type_data(self, obj):
        """Gibt den Content Type als Dict zurück für Frontend-Kompatibilität"""
        if obj.content_type:
            return {
                'app_label': obj.content_type.app_label,
                'model': obj.content_type.model
            }
        return None
    
    def get_item_type(self, obj):
        """Gibt den Typ des Items zurück (TradingProduct oder Asset)"""
        if obj.content_type:
            return obj.content_type.model
        return None
    
    def get_item_name(self, obj):
        """Gibt den Namen des Items zurück"""
        if obj.is_group_header and obj.group_name:
            return obj.group_name
        try:
            if obj.item:
                return obj.item.name
        except Exception:
            pass
        return None
    
    def get_item_description(self, obj):
        """Gibt die Beschreibung basierend auf description_type zurück"""
        try:
            if not obj.item:
                return None
            
            if obj.description_type == 'SHORT':
                return getattr(obj.item, 'short_description', '')
            else:
                return getattr(obj.item, 'description', '')
        except Exception:
            return None
    
    def get_item_article_number(self, obj):
        """Gibt die Artikelnummer des Items zurück"""
        # Für Warensammlungen verwende die generierte Artikelnummer
        if obj.item_article_number:
            return obj.item_article_number
        # Sonst die Artikelnummer vom Item (Visitron priorisiert)
        try:
            if obj.item:
                return getattr(obj.item, 'visitron_part_number', '') or getattr(obj.item, 'supplier_part_number', '')
        except Exception:
            pass
        return None
    
    def get_group_margin(self, obj):
        """Marge für Gruppen"""
        if obj.is_group_header and obj.sale_price:
            return obj.get_group_margin()
        return None


class QuotationItemCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer für Erstellen/Aktualisieren von Angebotspositionen
    """
    content_type = serializers.DictField(write_only=True, required=False, allow_null=True)
    quotation = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = QuotationItem
        fields = [
            'id', 'quotation', 'content_type', 'object_id',
            'group_id', 'group_name', 'is_group_header',
            'position', 'description_type', 'quantity', 
            'unit_price', 'purchase_price', 'sale_price', 'uses_system_price',
            'discount_percent', 'tax_rate', 'notes', 'item_article_number',
            'custom_description'
        ]
    
    def to_internal_value(self, data):
        """Override to add debugging"""
        print(f"DEBUG ITEM to_internal_value: Received data: {data}")
        try:
            result = super().to_internal_value(data)
            print(f"DEBUG ITEM to_internal_value: Result: {result}")
            return result
        except Exception as e:
            print(f"DEBUG ITEM to_internal_value ERROR: {e}")
            raise
    
    def validate(self, data):
        """Validiere dass das Item existiert (außer für Gruppen-Header)"""
        content_type_dict = data.get('content_type')
        object_id = data.get('object_id')
        is_group_header = data.get('is_group_header', False)
        
        print(f"DEBUG ITEM validate: content_type={content_type_dict}, object_id={object_id}, is_group_header={is_group_header}")
        
        # Gruppen-Header brauchen kein konkretes Item
        if is_group_header:
            # Entferne content_type wenn es leer/None ist
            if not content_type_dict:
                data.pop('content_type', None)
            print(f"DEBUG ITEM: Is group header, validation passed")
            return data
        
        # Wenn wir ein Update machen und content_type nicht gesetzt ist, 
        # versuche es vom existierenden Item zu nehmen
        if self.instance and not content_type_dict:
            # content_type bleibt unverändert, entferne es aus data
            data.pop('content_type', None)
            print(f"DEBUG ITEM: Is update without content_type, validation passed")
            return data
        
        if content_type_dict and object_id:
            # Konvertiere Dict zu ContentType
            from django.contrib.contenttypes.models import ContentType
            try:
                content_type = ContentType.objects.get(
                    app_label=content_type_dict['app_label'],
                    model=content_type_dict['model']
                )
                data['content_type'] = content_type
                
                model_class = content_type.model_class()
                if not model_class.objects.filter(id=object_id).exists():
                    print(f"DEBUG ITEM ERROR: Item with id {object_id} does not exist")
                    raise serializers.ValidationError(
                        f"{content_type.model} mit ID {object_id} existiert nicht"
                    )
                print(f"DEBUG ITEM: Validation passed, content_type converted")
            except ContentType.DoesNotExist:
                print(f"DEBUG ITEM ERROR: ContentType does not exist")
                raise serializers.ValidationError(
                    f"Content Type {content_type_dict} existiert nicht"
                )
        elif not is_group_header:
            # Normale Items brauchen content_type und object_id
            # Aber nur bei Create, nicht bei Update
            if not self.instance:
                print(f"DEBUG ITEM ERROR: Missing content_type or object_id for new item")
                raise serializers.ValidationError(
                    "content_type und object_id sind erforderlich für normale Positionen"
                )
        
        print(f"DEBUG ITEM: Validation passed")
        return data
        
        return data


class QuotationListSerializer(serializers.ModelSerializer):
    """
    Serializer für Auflistung von Angeboten
    """
    customer_name = serializers.CharField(source='customer.__str__', read_only=True)
    customer_number = serializers.CharField(source='customer.customer_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items_count = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = Quotation
        fields = [
            'id', 'quotation_number', 'customer', 'customer_name', 'customer_number',
            'date', 'valid_until', 'status', 'status_display', 'language',
            'reference', 'items_count', 'total_amount', 'created_at'
        ]
    
    def get_items_count(self, obj):
        """Anzahl der Positionen"""
        return obj.items.count()
    
    def get_total_amount(self, obj):
        """Gesamtsumme - nur Gruppen-Header und Einzelpositionen (ohne group_id)"""
        from decimal import Decimal
        total = Decimal('0.00')
        for item in obj.items.all():
            # Nur Gruppen-Header oder Einzelpositionen (ohne group_id) zählen
            if item.is_group_header or not item.group_id:
                total += item.total
        return float(total)


class QuotationDetailSerializer(serializers.ModelSerializer):
    """
    Detaillierter Serializer für Angebote mit allen Positionen
    """
    customer_name = serializers.CharField(source='customer.__str__', read_only=True)
    customer_number = serializers.CharField(source='customer.customer_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    items = QuotationItemSerializer(many=True, read_only=True)
    payment_term_display = serializers.SerializerMethodField()
    delivery_term_display = serializers.SerializerMethodField()
    total_net = serializers.SerializerMethodField()
    total_tax = serializers.SerializerMethodField()
    total_gross = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    commission_user_name = serializers.SerializerMethodField()
    pdf_file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Quotation
        fields = [
            'id', 'quotation_number', 'customer', 'customer_name', 'customer_number',
            'project_reference', 'system_reference', 'reference',
            'date', 'valid_until', 'delivery_time_weeks',
            'status', 'status_display', 'language', 'language_display',
            'payment_term', 'payment_term_display',
            'delivery_term', 'delivery_term_display',
            'show_terms_conditions', 'show_group_item_prices', 'system_price', 'delivery_cost', 'tax_enabled', 'tax_rate',
            'recipient_company', 'recipient_name', 'recipient_street',
            'recipient_postal_code', 'recipient_city', 'recipient_country',
            'description_text', 'footer_text', 'pdf_file', 'pdf_file_url',
            'notes',
            'items', 'total_net', 'total_tax', 'total_gross',
            'created_by', 'created_by_name', 'commission_user', 'commission_user_name', 'created_at', 'updated_at'
        ]
    
    def get_pdf_file_url(self, obj):
        """URL zur PDF-Datei"""
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None
    
    def get_payment_term_display(self, obj):
        """Zahlungsbedingung formatiert"""
        if obj.payment_term:
            try:
                return obj.payment_term.get_formatted_terms()
            except Exception as e:
                print(f"Error getting payment term: {e}")
                return str(obj.payment_term)
        return None
    
    def get_delivery_term_display(self, obj):
        """Lieferbedingung formatiert"""
        if obj.delivery_term:
            try:
                return obj.delivery_term.get_incoterm_display()
            except Exception as e:
                print(f"Error getting delivery term: {e}")
                return str(obj.delivery_term)
        return None
    
    def get_total_net(self, obj):
        """Gesamtsumme netto - nur Gruppen-Header und Einzelpositionen"""
        from decimal import Decimal
        total = Decimal('0.00')
        for item in obj.items.all():
            # Nur Gruppen-Header oder Einzelpositionen (ohne group_id) zählen
            if item.is_group_header or not item.group_id:
                total += item.subtotal
        return float(total)
    
    def get_total_tax(self, obj):
        """Gesamtsumme MwSt - nur Gruppen-Header und Einzelpositionen"""
        from decimal import Decimal
        total = Decimal('0.00')
        for item in obj.items.all():
            # Nur Gruppen-Header oder Einzelpositionen (ohne group_id) zählen
            if item.is_group_header or not item.group_id:
                total += item.tax_amount
        return float(total)
    
    def get_total_gross(self, obj):
        """Gesamtsumme brutto - nur Gruppen-Header und Einzelpositionen"""
        from decimal import Decimal
        total = Decimal('0.00')
        for item in obj.items.all():
            # Nur Gruppen-Header oder Einzelpositionen (ohne group_id) zählen
            if item.is_group_header or not item.group_id:
                total += item.total
        return float(total)
    
    def get_created_by_name(self, obj):
        """Name des Erstellers"""
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return None
    
    def get_commission_user_name(self, obj):
        """Name des Provisionsempfängers"""
        if obj.commission_user:
            return f"{obj.commission_user.first_name} {obj.commission_user.last_name}".strip()
        return None


class QuotationCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer für Erstellen und Aktualisieren von Angeboten
    Items werden manuell in der View verarbeitet!
    """
    
    class Meta:
        model = Quotation
        fields = [
            'customer', 'project_reference', 'system_reference', 'reference',
            'date', 'valid_until', 'delivery_time_weeks', 'status', 'language',
            'payment_term', 'delivery_term',
            'show_terms_conditions', 'show_group_item_prices', 'system_price', 'delivery_cost', 'tax_enabled', 'tax_rate',
            'recipient_company', 'recipient_name', 'recipient_street',
            'recipient_postal_code', 'recipient_city', 'recipient_country',
            'description_text', 'footer_text',
            'notes', 'created_by', 'commission_user'
        ]

