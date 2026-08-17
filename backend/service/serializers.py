from rest_framework import serializers
from .models import (VSService, VSServicePrice, ServiceTicket, RMACase, TicketComment, 
                     TicketChangeLog, TroubleshootingTicket, TroubleshootingComment,
                     ServiceTicketAttachment, TroubleshootingAttachment, ServiceTicketTimeEntry,
                     RMACaseTimeEntry, RMAItem, RMAItemPhoto, RMAReceipt, RMAReturn, RMAReturnItem,
                     RMAAttachment, RMACostLineItem)


class VSServicePriceSerializer(serializers.ModelSerializer):
    """Serializer für VS-Service Preise"""
    # Map frontend field names to model field names
    service = serializers.PrimaryKeyRelatedField(
        source='vs_service',
        queryset=VSService.objects.all(),
        required=False
    )
    list_price = serializers.DecimalField(
        source='sales_price',
        max_digits=12,
        decimal_places=2
    )
    
    class Meta:
        model = VSServicePrice
        fields = [
            'id', 'vs_service', 'service', 'purchase_price', 'list_price', 'sales_price',
            'valid_from', 'valid_until', 'notes', 'created_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'created_by']
        extra_kwargs = {
            'vs_service': {'required': False},
            'sales_price': {'required': False}
        }


class VSServiceListSerializer(serializers.ModelSerializer):
    """Serializer für VS-Service Liste mit aktuellen Preisen"""
    current_purchase_price = serializers.SerializerMethodField()
    current_sales_price = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VSService
        fields = [
            'id', 'article_number', 'name', 'short_description',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'current_purchase_price', 'current_sales_price',
            'created_at', 'updated_at'
        ]
    
    def get_current_purchase_price(self, obj):
        price = obj.get_current_purchase_price()
        return float(price) if price else None
    
    def get_current_sales_price(self, obj):
        price = obj.get_current_sales_price()
        return float(price) if price else None


class VSServiceDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für VS-Service mit allen Preisen"""
    prices = VSServicePriceSerializer(many=True, read_only=True)
    current_purchase_price = serializers.SerializerMethodField()
    current_list_price = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VSService
        fields = [
            'id', 'article_number', 'name',
            'short_description', 'short_description_en',
            'description', 'description_en',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'prices', 'current_purchase_price', 'current_list_price',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['article_number', 'created_at', 'updated_at']
    
    def get_current_purchase_price(self, obj):
        price = obj.get_current_purchase_price()
        return float(price) if price else None
    
    def get_current_list_price(self, obj):
        price = obj.get_current_sales_price()
        return float(price) if price else None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class VSServiceCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von VS-Service"""
    
    class Meta:
        model = VSService
        fields = [
            'id', 'article_number',
            'name', 'short_description', 'short_description_en',
            'description', 'description_en',
            'product_category',
            'unit', 'is_active'
        ]
        read_only_fields = ['id', 'article_number']


class ServiceTicketListSerializer(serializers.ModelSerializer):
    """Serializer für Service Ticket Liste"""
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    billing_display = serializers.CharField(source='get_billing_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ServiceTicket
        fields = [
            'id', 'ticket_number', 'title', 'customer', 'customer_name',
            'status', 'status_display', 'billing', 'billing_display',
            'assigned_to', 'assigned_to_name', 'is_open',
            'created_at', 'updated_at'
        ]
    
    def get_customer_name(self, obj):
        if obj.customer:
            return str(obj.customer)
        return None
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None


class TicketCommentSerializer(serializers.ModelSerializer):
    """Serializer für Ticket Kommentare"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TicketComment
        fields = ['id', 'comment', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at', 'created_by', 'created_by_name']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class TicketChangeLogSerializer(serializers.ModelSerializer):
    """Serializer für Ticket Änderungsprotokoll"""
    changed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TicketChangeLog
        fields = ['id', 'field_name', 'old_value', 'new_value', 'changed_by', 'changed_by_name', 'changed_at']
        read_only_fields = ['id', 'changed_at', 'changed_by', 'changed_by_name']
    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip() or obj.changed_by.username
        return None


class ServiceTicketAttachmentSerializer(serializers.ModelSerializer):
    """Serializer für Service-Ticket Anhänge"""
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceTicketAttachment
        fields = ['id', 'file', 'file_url', 'filename', 'file_size', 'content_type', 
                  'is_image', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at', 'file_size', 'content_type', 'is_image']
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return None
    
    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class ServiceTicketTimeEntrySerializer(serializers.ModelSerializer):
    """Serializer für Service-Ticket Zeiteinträge"""
    employee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceTicketTimeEntry
        fields = ['id', 'ticket', 'date', 'time', 'employee', 'employee_name', 
                  'hours_spent', 'description', 'created_by', 'created_by_name', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip() or obj.employee.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class ServiceTicketDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für Service Tickets"""
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    billing_display = serializers.CharField(source='get_billing_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    linked_rma_number = serializers.SerializerMethodField()
    linked_system_name = serializers.SerializerMethodField()
    comments = TicketCommentSerializer(many=True, read_only=True)
    change_logs = TicketChangeLogSerializer(many=True, read_only=True)
    ticket_attachments = ServiceTicketAttachmentSerializer(many=True, read_only=True)
    time_entries = ServiceTicketTimeEntrySerializer(many=True, read_only=True)
    total_hours_spent = serializers.SerializerMethodField()
    watcher_ids = serializers.PrimaryKeyRelatedField(
        source='watchers',
        many=True,
        read_only=True
    )
    is_open = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ServiceTicket
        fields = [
            'id', 'ticket_number', 'title', 'description',
            'customer', 'customer_name', 'contact_email',
            'status', 'status_display', 'billing', 'billing_display',
            'assigned_to', 'assigned_to_name',
            'linked_rma', 'linked_rma_number', 'linked_visiview_ticket', 'linked_system', 'linked_system_name',
            'watchers', 'watcher_ids',
            'comments', 'change_logs', 'ticket_attachments', 'time_entries', 'total_hours_spent',
            'is_open',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['ticket_number', 'created_at', 'updated_at', 'comments', 'change_logs', 'ticket_attachments', 'time_entries']
    
    def get_customer_name(self, obj):
        if obj.customer:
            return str(obj.customer)
        return None
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_linked_rma_number(self, obj):
        if obj.linked_rma:
            return obj.linked_rma.rma_number
        return None

    def get_linked_system_name(self, obj):
        if obj.linked_system:
            # Prefer system number + name when available
            if getattr(obj.linked_system, 'system_number', None):
                return f"{obj.linked_system.system_number} - {obj.linked_system.system_name}"
            return getattr(obj.linked_system, 'system_name', None)
        return None
    
    def get_total_hours_spent(self, obj):
        """Berechnet die Gesamtstunden aus allen Zeiteinträgen"""
        from django.db.models import Sum
        total = obj.time_entries.aggregate(Sum('hours_spent'))['hours_spent__sum']
        return float(total) if total else 0.0


class ServiceTicketCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von Service Tickets"""
    
    class Meta:
        model = ServiceTicket
        fields = [
            'id', 'ticket_number', 'title', 'description',
            'customer', 'contact_email', 'status', 'billing',
            'assigned_to', 'linked_rma', 'linked_visiview_ticket', 'linked_system',
            'watchers'
        ]
        read_only_fields = ['id', 'ticket_number']


class RMACaseTimeEntrySerializer(serializers.ModelSerializer):
    """Serializer für RMA-Fall Zeiteinträge"""
    employee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = RMACaseTimeEntry
        fields = ['id', 'rma_case', 'date', 'time', 'employee', 'employee_name', 
                  'hours_spent', 'description', 'created_by', 'created_by_name', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip() or obj.employee.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class RMAItemPhotoSerializer(serializers.ModelSerializer):
    """Serializer für Fotos von RMA-Positionen"""
    uploaded_by_display = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = RMAItemPhoto
        fields = [
            'id', 'rma_item', 'photo', 'photo_url', 'description',
            'uploaded_at', 'uploaded_by', 'uploaded_by_display'
        ]
        read_only_fields = ['uploaded_at', 'uploaded_by', 'uploaded_by_display', 'photo_url']

    def get_photo_url(self, obj):
        if obj.photo:
            return obj.photo.url
        return None


class RMAItemSerializer(serializers.ModelSerializer):
    """Serializer für RMA-Positionen"""
    photos = serializers.SerializerMethodField()

    class Meta:
        model = RMAItem
        fields = [
            'id', 'rma_case', 'position', 'product_name',
            'article_number', 'quantity', 'unit',
            'serial_number', 'notes', 'photos'
        ]

    def get_photos(self, obj):
        photos = obj.photos.all()
        return RMAItemPhotoSerializer(photos, many=True, context=self.context).data


class RMAItemNestedSerializer(serializers.ModelSerializer):
    """Nested serializer für verschachtelte Item-Erstellung/Aktualisierung ohne rma_case-Feld"""
    id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = RMAItem
        fields = [
            'id', 'position', 'product_name',
            'article_number', 'quantity', 'unit',
            'serial_number', 'notes'
        ]


class RMAReceiptSerializer(serializers.ModelSerializer):
    """Serializer für Wareneingang eines RMA-Falls"""
    received_by_display = serializers.CharField(source='received_by.get_full_name', read_only=True)
    delivery_note_url = serializers.SerializerMethodField()

    class Meta:
        model = RMAReceipt
        fields = [
            'id', 'rma_case', 'receipt_date', 'received_by', 'received_by_display',
            'delivery_note', 'delivery_note_url', 'notes'
        ]
        read_only_fields = ['received_by', 'received_by_display', 'delivery_note_url']

    def get_delivery_note_url(self, obj):
        if obj.delivery_note:
            return obj.delivery_note.url
        return None


class RMAReturnItemSerializer(serializers.ModelSerializer):
    """Serializer für Warenausgangs-Positionen"""
    rma_item_detail = RMAItemSerializer(source='rma_item', read_only=True)

    class Meta:
        model = RMAReturnItem
        fields = ['id', 'rma_return', 'rma_item', 'rma_item_detail', 'quantity_returned', 'condition_notes']


class RMAReturnSerializer(serializers.ModelSerializer):
    """Serializer für Warenausgänge (Rückversand)"""
    items = RMAReturnItemSerializer(many=True, read_only=True)
    created_by_display = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = RMAReturn
        fields = [
            'id', 'rma_case', 'return_number', 'return_date',
            'shipping_carrier', 'tracking_number', 'pdf_file', 'pdf_language',
            'notes', 'created_at', 'created_by', 'created_by_display', 'items'
        ]
        read_only_fields = ['return_number', 'created_at', 'created_by', 'created_by_display', 'pdf_file', 'pdf_language']


class RMAReturnCreateSerializer(serializers.ModelSerializer):
    """Serializer für Warenausgangs-Erstellung"""
    items = RMAReturnItemSerializer(many=True, write_only=True)

    class Meta:
        model = RMAReturn
        fields = ['rma_case', 'return_date', 'shipping_carrier', 'tracking_number', 'notes', 'items']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        rma_return = RMAReturn.objects.create(**validated_data)

        for item_data in items_data:
            RMAReturnItem.objects.create(rma_return=rma_return, **item_data)

        return rma_return


class RMAAttachmentSerializer(serializers.ModelSerializer):
    """Serializer für RMA Auftragsdokumente"""
    uploaded_by_display = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = RMAAttachment
        fields = [
            'id', 'rma_case', 'file', 'file_url', 'description',
            'uploaded_at', 'uploaded_by', 'uploaded_by_display'
        ]
        read_only_fields = ['uploaded_at', 'uploaded_by', 'uploaded_by_display', 'file_url']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class RMACostLineItemSerializer(serializers.ModelSerializer):
    """Serializer für RMA Kostenpositionen"""
    total_price = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=2)
    cost_type_display = serializers.CharField(source='get_cost_type_display', read_only=True)

    class Meta:
        model = RMACostLineItem
        fields = [
            'id', 'rma_case', 'cost_type', 'cost_type_display',
            'description', 'quantity', 'unit', 'unit_price', 'total_price',
            'source_time_entry'
        ]
        read_only_fields = ['source_time_entry']


class RMACaseListSerializer(serializers.ModelSerializer):
    """Serializer für RMA-Fall Liste"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    customer_display = serializers.SerializerMethodField()
    
    class Meta:
        model = RMACase
        fields = [
            'id', 'rma_number', 'title', 'description',
            'customer', 'customer_name', 'customer_display', 'product_serial',
            'status', 'status_display',
            'received_date', 'created_at', 'updated_at'
        ]
    
    def get_customer_display(self, obj):
        """Zeigt den verknüpften Kunden aus den Basisinfos (FK) an"""
        if obj.customer:
            return str(obj.customer)
        return obj.customer_name or None


class RMACaseDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für RMA-Fälle - alle Felder für Edit-Form"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    time_entries = RMACaseTimeEntrySerializer(many=True, read_only=True)
    total_hours_spent = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    receipt = serializers.SerializerMethodField()
    returns = RMAReturnSerializer(many=True, read_only=True)
    report_pdf_url = serializers.SerializerMethodField()
    attachments = RMAAttachmentSerializer(many=True, read_only=True)
    cost_line_items = RMACostLineItemSerializer(many=True, read_only=True)
    cost_totals = serializers.SerializerMethodField()
    
    class Meta:
        model = RMACase
        fields = [
            # Identifikation
            'id', 'rma_number',
            
            # Tab 1: Basisinfos
            'title', 'description', 'status', 'status_display',
            'customer', 'customer_name', 'customer_contact', 'customer_email', 'customer_phone',
            'linked_system', 'inventory_item',
            'product_name', 'product_serial', 'product_purchase_date',
            'warranty_status', 'fault_description', 'attachments',
            
            # Tab 2: Wareneingang/-ausgang
            'received_date', 'received_by', 'received_condition', 'tracking_inbound',
            'shipped_date', 'shipped_by', 'tracking_outbound', 'shipping_notes',
            'address_name', 'address_street', 'address_house_number',
            'address_postal_code', 'address_city', 'address_country',
            'items', 'receipt', 'returns',
            
            # Tab 3: RMA-Kalkulation
            'estimated_cost', 'actual_cost', 'parts_cost', 'labor_cost',
            'shipping_cost', 'total_cost', 'evaluation_cost', 'margin_percent',
            'final_price', 'hourly_rate', 'admin_fee', 'cost_line_items', 'cost_totals',
            'quote_sent', 'quote_accepted',
            
            # Tab 4: Reparaturbericht
            'diagnosis', 'repair_actions', 'parts_used', 'repair_date',
            'repaired_by', 'test_results', 'final_notes',
            'report_pdf', 'report_pdf_url',
            
            # Metadaten
            'assigned_to', 'assigned_to_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            
            # Zeiterfassung
            'time_entries', 'total_hours_spent'
        ]
        read_only_fields = ['rma_number', 'created_at', 'updated_at', 'report_pdf', 'report_pdf_url']

    def get_cost_totals(self, obj):
        return obj.get_cost_totals()
    
    
    def get_report_pdf_url(self, obj):
        if obj.report_pdf:
            return obj.report_pdf.url
        return None
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_total_hours_spent(self, obj):
        """Berechnet die Gesamtstunden aus allen Zeiteinträgen"""
        from django.db.models import Sum
        total = obj.time_entries.aggregate(Sum('hours_spent'))['hours_spent__sum']
        return float(total) if total else 0.0
    
    def get_items(self, obj):
        items = obj.items.all()
        return RMAItemSerializer(items, many=True, context=self.context).data
    
    def get_receipt(self, obj):
        if hasattr(obj, 'receipt'):
            return RMAReceiptSerializer(obj.receipt, context=self.context).data
        return None


class RMACaseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von RMA-Fällen"""
    items = RMAItemNestedSerializer(many=True, required=False)
    
    class Meta:
        model = RMACase
        fields = [
            # Identifikation (read-only für Response)
            'id', 'rma_number',
            
            # Tab 1 - Basisinfos
            'customer', 'customer_name', 'customer_contact', 'customer_email', 'customer_phone',
            'linked_system', 'inventory_item',
            'title', 'description', 'status',
            'product_name', 'product_serial', 'product_purchase_date', 'warranty_status', 'fault_description',

            # Tab 2 - Wareneingang / Warenausgang
            'received_date', 'received_by', 'received_condition', 'tracking_inbound',
            'shipped_date', 'shipped_by', 'tracking_outbound', 'shipping_notes',
            'address_name', 'address_street', 'address_house_number',
            'address_postal_code', 'address_city', 'address_country',
            'items',

            # Tab 3 - Kalkulation
            'estimated_cost', 'actual_cost', 'parts_cost', 'labor_cost', 'shipping_cost', 'total_cost',
            'evaluation_cost', 'margin_percent', 'final_price', 'hourly_rate', 'admin_fee',
            'quote_sent', 'quote_accepted',

            # Tab 4 - Reparaturbericht
            'diagnosis', 'repair_actions', 'parts_used', 'repair_date', 'repaired_by', 'test_results', 'final_notes',

            # Metadaten
            'assigned_to'
        ]
        read_only_fields = ['id', 'rma_number', 'final_price']

    def to_internal_value(self, data):
        """Leere Datums-Strings in None umwandeln, damit optionale Datumsfelder leer bleiben können"""
        nullable_date_fields = [
            'product_purchase_date', 'received_date', 'shipped_date', 'repair_date'
        ]
        if isinstance(data, dict):
            data = data.copy()
            for field in nullable_date_fields:
                if field in data and data[field] in (None, ''):
                    data[field] = None
        return super().to_internal_value(data)

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        rma_case = RMACase.objects.create(**validated_data)

        for idx, item_data in enumerate(items_data, 1):
            item_data.pop('rma_case', None)
            position = item_data.pop('position', idx)
            RMAItem.objects.create(rma_case=rma_case, position=position, **item_data)

        return rma_case

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            existing_ids = set(instance.items.values_list('id', flat=True))
            updated_ids = set()

            for idx, item_data in enumerate(items_data, 1):
                item_id = item_data.pop('id', None)
                item_data.pop('rma_case', None)
                item_data.pop('position', None)

                if item_id and item_id in existing_ids:
                    RMAItem.objects.filter(id=item_id).update(position=idx, **item_data)
                    updated_ids.add(item_id)
                else:
                    RMAItem.objects.create(rma_case=instance, position=idx, **item_data)

            items_to_delete = existing_ids - updated_ids
            instance.items.filter(id__in=items_to_delete).delete()

        return instance


class TroubleshootingCommentSerializer(serializers.ModelSerializer):
    """Serializer für Troubleshooting Kommentare"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TroubleshootingComment
        fields = ['id', 'comment', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at', 'created_by', 'created_by_name']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class TroubleshootingAttachmentSerializer(serializers.ModelSerializer):
    """Serializer für Troubleshooting Anhänge"""
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = TroubleshootingAttachment
        fields = ['id', 'file', 'file_url', 'filename', 'file_size', 'content_type', 
                  'is_image', 'is_primary', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at', 'file_size', 'content_type', 'is_image']
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return None
    
    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class TroubleshootingListSerializer(serializers.ModelSerializer):
    """Serializer für Troubleshooting Ticket Liste"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    main_photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = TroubleshootingTicket
        fields = [
            'id', 'ticket_number', 'legacy_id', 'title',
            'status', 'status_display', 'priority', 'priority_display',
            'category', 'category_display',
            'assigned_to', 'assigned_to_name',
            'author', 'author_name',
            'affected_version', 'is_open', 'main_photo_url',
            'created_at', 'updated_at'
        ]
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None
    
    def get_author_name(self, obj):
        if obj.author:
            return f"{obj.author.first_name} {obj.author.last_name}".strip() or obj.author.username
        return None

    def get_main_photo_url(self, obj):
        attachments = list(obj.attachments.all())
        primary = next((att for att in attachments if att.is_primary and att.is_image), None)
        if not primary:
            primary = next((att for att in attachments if att.is_image), None)
        if primary and primary.file:
            return primary.file.url
        return None


class TroubleshootingDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für Troubleshooting Tickets"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    last_changed_by_name = serializers.SerializerMethodField()
    comments = TroubleshootingCommentSerializer(many=True, read_only=True)
    attachments = TroubleshootingAttachmentSerializer(many=True, read_only=True)
    is_open = serializers.BooleanField(read_only=True)
    main_photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = TroubleshootingTicket
        fields = [
            'id', 'ticket_number', 'legacy_id', 'title', 'description',
            'status', 'status_display', 'priority', 'priority_display',
            'category', 'category_display',
            'assigned_to', 'assigned_to_name',
            'affected_version', 'root_cause', 'corrective_action',
            'related_tickets', 'files', 'last_comments',
            'author', 'author_name',
            'last_changed_by', 'last_changed_by_name',
            'comments', 'is_open',
            'attachments', 'main_photo_url',
            'created_at', 'updated_at', 'closed_at'
        ]
        read_only_fields = ['ticket_number', 'created_at', 'updated_at', 'comments', 'attachments']
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None
    
    def get_author_name(self, obj):
        if obj.author:
            return f"{obj.author.first_name} {obj.author.last_name}".strip() or obj.author.username
        return None
    
    def get_last_changed_by_name(self, obj):
        if obj.last_changed_by:
            return f"{obj.last_changed_by.first_name} {obj.last_changed_by.last_name}".strip() or obj.last_changed_by.username
        return None

    def get_main_photo_url(self, obj):
        attachments = list(obj.attachments.all())
        primary = next((att for att in attachments if att.is_primary and att.is_image), None)
        if not primary:
            primary = next((att for att in attachments if att.is_image), None)
        if primary and primary.file:
            return primary.file.url
        return None


class TroubleshootingCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von Troubleshooting Tickets"""
    
    class Meta:
        model = TroubleshootingTicket
        fields = [
            'id', 'ticket_number', 'title', 'description',
            'status', 'priority', 'category',
            'assigned_to', 'affected_version',
            'root_cause', 'corrective_action',
            'related_tickets', 'files', 'last_comments',
            'closed_at'
        ]
        read_only_fields = ['id', 'ticket_number']
