from rest_framework import serializers
from .models import (
    Quotation, QuotationItem, MarketingItem, MarketingItemFile,
    SalesTicket, SalesTicketAttachment, SalesTicketComment, SalesTicketChangeLog
)
from customers.models import Customer
from suppliers.models import TradingProduct
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model

User = get_user_model()


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
                # Prefer common name fields, fall back to title or str()
                name = getattr(obj.item, 'name', None) or getattr(obj.item, 'name_en', None)
                if name:
                    return name
                title = getattr(obj.item, 'title', None) or getattr(obj.item, 'title_en', None)
                if title:
                    return title
                # Last resort
                return str(obj.item)
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
        """Gesamtsumme NETTO - nur Gruppen-Header und Einzelpositionen (ohne group_id)"""
        from decimal import Decimal
        
        items = [it for it in obj.items.all() if (it.is_group_header or not it.group_id)]
        total = Decimal('0.00')

        # Detect items using system price
        uses_system = any(getattr(it, 'uses_system_price', False) and obj.system_price for it in items)

        # Sum subtotals for items not using system price
        for it in items:
            if getattr(it, 'uses_system_price', False) and obj.system_price:
                continue
            total += it.subtotal  # Netto (nicht total welches Brutto ist)

        # If any item uses system price, add the quotation.system_price once (netto)
        if uses_system:
            total += (obj.system_price or Decimal('0.00'))

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
            'recipient_salutation', 'recipient_title', 'recipient_company', 'recipient_name', 'recipient_street',
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

        items = [it for it in obj.items.all() if (it.is_group_header or not it.group_id)]
        total = Decimal('0.00')

        # Detect items using system price
        uses_system = any(getattr(it, 'uses_system_price', False) and obj.system_price for it in items)

        # Sum subtotals for items not using system price
        for it in items:
            if getattr(it, 'uses_system_price', False) and obj.system_price:
                continue
            total += it.subtotal

        # If any item uses system price, add the quotation.system_price once
        if uses_system:
            total += (obj.system_price or Decimal('0.00'))

        return float(total)
    
    def get_total_tax(self, obj):
        """Gesamtsumme MwSt - nur Gruppen-Header und Einzelpositionen"""
        from decimal import Decimal

        items = [it for it in obj.items.all() if (it.is_group_header or not it.group_id)]
        total_tax = Decimal('0.00')

        # Sum tax for items not using system price
        for it in items:
            if getattr(it, 'uses_system_price', False) and obj.system_price:
                continue
            total_tax += it.tax_amount

        # If any item uses system price, compute tax on the system price once
        if any(getattr(it, 'uses_system_price', False) and obj.system_price for it in items):
            if obj.tax_enabled:
                total_tax += (obj.system_price or Decimal('0.00')) * (obj.tax_rate / Decimal('100'))

        return float(total_tax)
    
    def get_total_gross(self, obj):
        """Gesamtsumme brutto - nur Gruppen-Header und Einzelpositionen"""
        from decimal import Decimal

        items = [it for it in obj.items.all() if (it.is_group_header or not it.group_id)]
        total = Decimal('0.00')

        # Sum totals for items not using system price
        for it in items:
            if getattr(it, 'uses_system_price', False) and obj.system_price:
                continue
            total += it.total

        # If any item uses system price, add system price + tax once
        if any(getattr(it, 'uses_system_price', False) and obj.system_price for it in items):
            sys_price = obj.system_price or Decimal('0.00')
            sys_tax = sys_price * (obj.tax_rate / Decimal('100')) if obj.tax_enabled else Decimal('0.00')
            total += sys_price + sys_tax

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
            'recipient_salutation', 'recipient_title', 'recipient_company', 'recipient_name', 'recipient_street',
            'recipient_postal_code', 'recipient_city', 'recipient_country',
            'description_text', 'footer_text',
            'notes', 'created_by', 'commission_user'
        ]


# ==================== Marketing Serializers ====================

class MarketingItemFileSerializer(serializers.ModelSerializer):
    """Serializer für Marketing-Dateien"""
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = MarketingItemFile
        fields = [
            'id', 'marketing_item', 'file', 'file_url', 'filename', 
            'file_size', 'content_type', 'uploaded_by', 'uploaded_by_name',
            'uploaded_at', 'is_image'
        ]
        read_only_fields = ['uploaded_at', 'is_image']
    
    def get_file_url(self, obj):
        """Gibt die vollständige URL zur Datei zurück"""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_uploaded_by_name(self, obj):
        """Gibt den Namen des Uploaders zurück"""
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None


class MarketingItemSerializer(serializers.ModelSerializer):
    """Serializer für Marketing-Items mit verschachtelten Dateien und Mitarbeitern"""
    files = MarketingItemFileSerializer(many=True, read_only=True)
    responsible_employees_data = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    is_event = serializers.ReadOnlyField()
    
    class Meta:
        model = MarketingItem
        fields = [
            'id', 'category', 'category_display', 'title', 'description',
            'responsible_employees', 'responsible_employees_data',
            'event_date', 'event_location', 'is_event',
            'created_at', 'created_by', 'created_by_name', 'updated_at',
            'files'
        ]
        read_only_fields = ['created_at', 'updated_at', 'is_event']
    
    def get_responsible_employees_data(self, obj):
        """Gibt detaillierte Mitarbeiter-Informationen zurück"""
        from users.models import Employee
        employees = obj.responsible_employees.all()
        return [{
            'id': emp.id,
            'employee_id': emp.employee_id,
            'first_name': emp.first_name,
            'last_name': emp.last_name,
            'full_name': f"{emp.first_name} {emp.last_name}"
        } for emp in employees]
    
    def get_created_by_name(self, obj):
        """Gibt den Namen des Erstellers zurück"""
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class MarketingItemCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von Marketing-Items"""
    
    class Meta:
        model = MarketingItem
        fields = [
            'category', 'title', 'description', 'responsible_employees',
            'event_date', 'event_location', 'created_by'
        ]
    
    def validate(self, data):
        """Validierung: Event-Felder nur für Shows/Workshops"""
        category = data.get('category')
        if category not in ['show', 'workshop']:
            # Event-Felder löschen wenn nicht Show/Workshop
            data.pop('event_date', None)
            data.pop('event_location', None)
        return data


# ==================== Sales Ticket Serializers ====================

class SalesTicketAttachmentSerializer(serializers.ModelSerializer):
    """Serializer für Sales-Ticket Anhänge"""
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SalesTicketAttachment
        fields = [
            'id', 'ticket', 'file', 'file_url', 'filename',
            'file_size', 'content_type', 'uploaded_by', 'uploaded_by_name',
            'uploaded_at', 'is_image'
        ]
        read_only_fields = ['uploaded_at', 'is_image']
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None


class SalesTicketCommentSerializer(serializers.ModelSerializer):
    """Serializer für Sales-Ticket Kommentare"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SalesTicketComment
        fields = ['id', 'ticket', 'comment', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['created_at']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class SalesTicketChangeLogSerializer(serializers.ModelSerializer):
    """Serializer für Sales-Ticket ChangeLog"""
    changed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SalesTicketChangeLog
        fields = ['id', 'field_name', 'old_value', 'new_value', 'changed_by', 'changed_by_name', 'changed_at']
    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return None


class SalesTicketListSerializer(serializers.ModelSerializer):
    """List-Serializer für Sales-Tickets"""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SalesTicket
        fields = [
            'id', 'ticket_number', 'category', 'category_display',
            'status', 'status_display', 'title', 'due_date',
            'created_by', 'created_by_name', 'assigned_to', 'assigned_to_name',
            'created_at', 'updated_at'
        ]
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None


class SalesTicketDetailSerializer(serializers.ModelSerializer):
    """Detail-Serializer für Sales-Tickets"""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    attachments = SalesTicketAttachmentSerializer(many=True, read_only=True)
    comments = SalesTicketCommentSerializer(many=True, read_only=True)
    change_logs = SalesTicketChangeLogSerializer(many=True, read_only=True)
    watchers = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    watcher_names = serializers.SerializerMethodField()
    
    class Meta:
        model = SalesTicket
        fields = [
            'id', 'ticket_number', 'category', 'category_display',
            'status', 'status_display', 'title', 'description',
            'created_by', 'created_by_name', 'assigned_to', 'assigned_to_name',
            'due_date', 'completed_date', 'notes',
            'attachments', 'comments', 'change_logs',
            'watchers', 'watcher_names',
            'created_at', 'updated_at'
        ]
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None
    
    def get_watcher_names(self, obj):
        return [{'id': w.id, 'name': w.get_full_name() or w.username} for w in obj.watchers.all()]


class SalesTicketCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von Sales-Tickets"""
    id = serializers.IntegerField(read_only=True)
    ticket_number = serializers.CharField(read_only=True)
    watchers = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        required=False
    )
    
    class Meta:
        model = SalesTicket
        fields = [
            'id', 'ticket_number', 'category', 'status', 'title', 'description',
            'assigned_to', 'due_date', 'completed_date', 'notes', 'watchers', 'created_by'
        ]

    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return None

