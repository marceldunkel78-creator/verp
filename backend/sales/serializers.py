from rest_framework import serializers
from .models import Quotation, QuotationItem
from customers.models import Customer
from suppliers.models import TradingProduct, Asset
from django.contrib.contenttypes.models import ContentType


class QuotationItemSerializer(serializers.ModelSerializer):
    """
    Serializer für Angebotspositionen (inkl. Warensammlungen und Systempreise)
    """
    item_type = serializers.SerializerMethodField()
    item_name = serializers.SerializerMethodField()
    item_description = serializers.SerializerMethodField()
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
            'id', 'quotation', 'content_type', 'object_id', 'item',
            'item_type', 'item_name', 'item_description',
            'group_id', 'group_name', 'is_group_header',
            'position', 'description_type', 'quantity', 
            'unit_price', 'purchase_price', 'sale_price', 'uses_system_price',
            'discount_percent', 'tax_rate', 'notes',
            'subtotal', 'tax_amount', 'total',
            'total_purchase_cost', 'margin_absolute', 'margin_percent', 'group_margin'
        ]
        read_only_fields = ['subtotal', 'tax_amount', 'total', 'total_purchase_cost', 
                           'margin_absolute', 'margin_percent']
    
    def get_item_type(self, obj):
        """Gibt den Typ des Items zurück (TradingProduct oder Asset)"""
        if obj.content_type:
            return obj.content_type.model
        return None
    
    def get_item_name(self, obj):
        """Gibt den Namen des Items zurück"""
        if obj.is_group_header and obj.group_name:
            return obj.group_name
        if obj.item:
            return obj.item.name
        return None
    
    def get_item_description(self, obj):
        """Gibt die Beschreibung basierend auf description_type zurück"""
        if not obj.item:
            return None
        
        if obj.description_type == 'SHORT':
            return getattr(obj.item, 'short_description', '')
        else:
            return getattr(obj.item, 'description', '')
    
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
    
    class Meta:
        model = QuotationItem
        fields = [
            'id', 'quotation', 'content_type', 'object_id',
            'group_id', 'group_name', 'is_group_header',
            'position', 'description_type', 'quantity', 
            'unit_price', 'purchase_price', 'sale_price', 'uses_system_price',
            'discount_percent', 'tax_rate', 'notes'
        ]
    
    def validate(self, data):
        """Validiere dass das Item existiert (außer für Gruppen-Header)"""
        content_type_dict = data.get('content_type')
        object_id = data.get('object_id')
        is_group_header = data.get('is_group_header', False)
        
        # Gruppen-Header brauchen kein konkretes Item
        if is_group_header:
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
                    raise serializers.ValidationError(
                        f"{content_type.model} mit ID {object_id} existiert nicht"
                    )
            except ContentType.DoesNotExist:
                raise serializers.ValidationError(
                    f"Content Type {content_type_dict} existiert nicht"
                )
        
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
        """Gesamtsumme aller Positionen"""
        from decimal import Decimal
        total = Decimal('0.00')
        for item in obj.items.all():
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
    
    class Meta:
        model = Quotation
        fields = [
            'id', 'quotation_number', 'customer', 'customer_name', 'customer_number',
            'project_reference', 'system_reference', 'reference',
            'date', 'valid_until', 'delivery_time_weeks',
            'status', 'status_display', 'language', 'language_display',
            'payment_term', 'payment_term_display',
            'delivery_term', 'delivery_term_display',
            'show_terms_conditions', 'system_price', 'delivery_cost', 'tax_enabled', 'tax_rate',
            'recipient_company', 'recipient_name', 'recipient_street',
            'recipient_postal_code', 'recipient_city', 'recipient_country',
            'notes',
            'items', 'total_net', 'total_tax', 'total_gross',
            'created_by', 'commission_user', 'created_at', 'updated_at'
        ]
    
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
        """Gesamtsumme netto"""
        from decimal import Decimal
        total = Decimal('0.00')
        for item in obj.items.all():
            total += item.subtotal
        return float(total)
    
    def get_total_tax(self, obj):
        """Gesamtsumme MwSt"""
        from decimal import Decimal
        total = Decimal('0.00')
        for item in obj.items.all():
            total += item.tax_amount
        return float(total)
    
    def get_total_gross(self, obj):
        """Gesamtsumme brutto"""
        from decimal import Decimal
        total = Decimal('0.00')
        for item in obj.items.all():
            total += item.total
        return float(total)


class QuotationCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer für Erstellen und Aktualisieren von Angeboten
    """
    items = QuotationItemCreateUpdateSerializer(many=True, required=False)
    
    class Meta:
        model = Quotation
        fields = [
            'customer', 'project_reference', 'system_reference', 'reference',
            'valid_until', 'delivery_time_weeks', 'status', 'language',
            'payment_term', 'delivery_term',
            'show_terms_conditions', 'system_price', 'delivery_cost', 'tax_enabled', 'tax_rate',
            'recipient_company', 'recipient_name', 'recipient_street',
            'recipient_postal_code', 'recipient_city', 'recipient_country',
            'notes', 'created_by', 'commission_user', 'items'
        ]
    
    def create(self, validated_data):
        """Erstelle Angebot mit Positionen"""
        items_data = validated_data.pop('items', [])
        quotation = Quotation.objects.create(**validated_data)
        
        # Erstelle Positionen
        for item_data in items_data:
            QuotationItem.objects.create(quotation=quotation, **item_data)
        
        return quotation
    
    def update(self, instance, validated_data):
        """Aktualisiere Angebot und Positionen"""
        items_data = validated_data.pop('items', None)
        
        # Aktualisiere Angebot
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Aktualisiere Positionen falls vorhanden
        if items_data is not None:
            # Lösche alte Positionen
            instance.items.all().delete()
            
            # Erstelle neue Positionen
            for item_data in items_data:
                QuotationItem.objects.create(quotation=instance, **item_data)
        
        return instance
