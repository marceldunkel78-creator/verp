from rest_framework import serializers
from decimal import Decimal
from .models import CustomerOrder, CustomerOrderItem, DeliveryNote, Invoice, Payment, CustomerOrderCommissionRecipient, EmployeeCommission


# =============================================================================
# Item Serializers
# =============================================================================

class CustomerOrderItemSerializer(serializers.ModelSerializer):
    """Serializer für Auftragspositionen"""
    total_price = serializers.SerializerMethodField()
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    supplier_order_number = serializers.CharField(source='supplier_order.order_number', read_only=True)
    visiview_production_order_number = serializers.CharField(source='visiview_production_order.order_number', read_only=True)
    hardware_production_order_number = serializers.CharField(source='hardware_production_order.order_number', read_only=True)
    
    class Meta:
        model = CustomerOrderItem
        fields = [
            'id', 'position', 'position_display', 'article_number', 'name', 'description',
            'quantity', 'unit', 'purchase_price', 'list_price', 'discount_percent', 'final_price',
            'currency', 'quotation_position', 'serial_number',
            'delivery_note_number', 'invoice_number', 'is_delivered', 'is_invoiced',
            'is_group_header', 'group_id', 'total_price',
            # Procurement fields
            'procurement_status', 'supplier', 'supplier_name',
            'supplier_order', 'supplier_order_number',
            'visiview_production_order', 'visiview_production_order_number',
            'hardware_production_order', 'hardware_production_order_number'
        ]
    
    def get_total_price(self, obj):
        return obj.get_total_price()


class CustomerOrderItemCreateSerializer(serializers.ModelSerializer):
    """Serializer zum Erstellen/Bearbeiten von Positionen"""
    
    class Meta:
        model = CustomerOrderItem
        fields = [
            'id', 'position', 'position_display', 'article_number', 'name', 'description',
            'quantity', 'unit', 'purchase_price', 'list_price', 'discount_percent', 'final_price',
            'currency', 'quotation_position', 'serial_number',
            'is_group_header', 'group_id', 'delivery_note_number', 'invoice_number'
        ]


# =============================================================================
# Payment Serializers
# =============================================================================

class PaymentSerializer(serializers.ModelSerializer):
    """Serializer für Zahlungen"""
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'invoice_number', 'payment_date', 'amount',
            'payment_method', 'reference', 'notes',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']


class PaymentCreateSerializer(serializers.ModelSerializer):
    """Serializer zum Erstellen von Zahlungen"""
    
    class Meta:
        model = Payment
        fields = [
            'invoice', 'payment_date', 'amount',
            'payment_method', 'reference', 'notes'
        ]


# =============================================================================
# Invoice Serializers
# =============================================================================

class InvoiceListSerializer(serializers.ModelSerializer):
    """Listenansicht für Rechnungen"""
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    paid_amount = serializers.SerializerMethodField()
    open_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'order', 'order_number', 'customer_name',
            'invoice_date', 'due_date', 'status', 'status_display',
            'gross_amount', 'paid_amount', 'open_amount'
        ]
    
    def get_paid_amount(self, obj):
        return obj.get_paid_amount()
    
    def get_open_amount(self, obj):
        return obj.get_open_amount()

    def get_customer_name(self, obj):
        cust = getattr(getattr(obj, 'order', None), 'customer', None)
        if not cust:
            return None
        name = getattr(cust, 'company_name', None)
        if name:
            return name
        return f"{getattr(cust, 'first_name', '')} {getattr(cust, 'last_name', '')}".strip()


class InvoiceDetailSerializer(serializers.ModelSerializer):
    """Detailansicht für Rechnungen"""
    payments = PaymentSerializer(many=True, read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    paid_amount = serializers.SerializerMethodField()
    open_amount = serializers.SerializerMethodField()
    is_fully_paid = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'order', 'order_number', 'customer_name',
            'sequence_number', 'invoice_date', 'due_date', 'status', 'status_display',
            'net_amount', 'tax_amount', 'gross_amount',
            'billing_address', 'notes',
            'pdf_file', 'payments', 'paid_amount', 'open_amount', 'is_fully_paid',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'invoice_number', 'created_by', 'created_at']
    
    def get_paid_amount(self, obj):
        return obj.get_paid_amount()
    
    def get_open_amount(self, obj):
        return obj.get_open_amount()
    
    def get_is_fully_paid(self, obj):
        return obj.is_fully_paid()

    def get_customer_name(self, obj):
        cust = getattr(getattr(obj, 'order', None), 'customer', None)
        if not cust:
            return None
        name = getattr(cust, 'company_name', None)
        if name:
            return name
        return f"{getattr(cust, 'first_name', '')} {getattr(cust, 'last_name', '')}".strip()


class InvoiceCreateSerializer(serializers.ModelSerializer):
    """Serializer zum Erstellen von Rechnungen"""
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="IDs der Positionen die berechnet werden sollen"
    )
    invoice_number = serializers.CharField(read_only=True)
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'order', 'invoice_date', 'due_date', 'net_amount', 'tax_amount', 'gross_amount',
            'billing_address', 'notes', 'item_ids'
        ]
        read_only_fields = ['id', 'invoice_number']
    
    def create(self, validated_data):
        item_ids = validated_data.pop('item_ids', [])
        order = validated_data.get('order')

        # Berechne sequence_number für diesen Auftrag
        existing_count = Invoice.objects.filter(order=order).count()
        validated_data['sequence_number'] = existing_count + 1
        
        # Compute amounts from selected positions
        from django.utils import timezone
        from decimal import Decimal, ROUND_HALF_UP

        # Default invoice_date to today if not provided
        inv_date = validated_data.get('invoice_date')
        if not inv_date:
            validated_data['invoice_date'] = timezone.now().date()

        # Determine items to include
        items_qs = CustomerOrderItem.objects.filter(order=order)
        if item_ids:
            items_qs = items_qs.filter(id__in=item_ids)

        net_total = Decimal('0.00')
        for it in items_qs:
            price = (it.final_price if it.final_price is not None else it.list_price) or Decimal('0.00')
            qty = Decimal(str(it.quantity or 0))
            line = (Decimal(str(price)) * qty).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            net_total += line

        # Tax rate from order
        tax_rate = (order.tax_rate or Decimal('19'))
        tax_amount = (net_total * (Decimal(str(tax_rate)) / Decimal('100'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        gross_total = (net_total + tax_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        validated_data['net_amount'] = net_total
        validated_data['tax_amount'] = tax_amount
        validated_data['gross_amount'] = gross_total

        # Set due_date automatically from order.payment_term.payment_days if not provided
        due = validated_data.get('due_date')
        if not due and getattr(order, 'payment_term', None):
            try:
                days = int(order.payment_term.payment_days or 0)
                if days > 0:
                    validated_data['due_date'] = validated_data['invoice_date'] + timezone.timedelta(days=days)
            except Exception:
                pass

        # Erstelle Invoice ohne invoice_number (wird generiert)
        invoice = Invoice(**validated_data)
        invoice.generate_number()  # Generiere Nummer
        invoice.save()

        # Markiere Positionen als berechnet
        if item_ids:
            CustomerOrderItem.objects.filter(
                id__in=item_ids,
                order=invoice.order
            ).update(
                invoice_number=invoice.sequence_number,
                is_invoiced=True
            )

        return invoice


# =============================================================================
# Delivery Note Serializers
# =============================================================================

class DeliveryNoteListSerializer(serializers.ModelSerializer):
    """Listenansicht für Lieferscheine"""
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    customer_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DeliveryNote
        fields = [
            'id', 'delivery_note_number', 'order', 'order_number', 'customer_name',
            'delivery_date', 'shipping_date', 'carrier', 'tracking_number', 'created_at'
        ]

    def get_customer_name(self, obj):
        cust = getattr(getattr(obj, 'order', None), 'customer', None)
        if not cust:
            return None
        name = getattr(cust, 'company_name', None)
        if name:
            return name
        return f"{getattr(cust, 'first_name', '')} {getattr(cust, 'last_name', '')}".strip()


class DeliveryNoteDetailSerializer(serializers.ModelSerializer):
    """Detailansicht für Lieferscheine"""
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    customer_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    delivered_items = serializers.SerializerMethodField()
    
    class Meta:
        model = DeliveryNote
        fields = [
            'id', 'delivery_note_number', 'order', 'order_number', 'customer_name',
            'sequence_number', 'delivery_date', 'shipping_date',
            'shipping_address', 'carrier', 'tracking_number',
            'notes', 'pdf_file',
            'delivered_items', 'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'delivery_note_number', 'created_by', 'created_at']
    
    def get_delivered_items(self, obj):
        """Liefert die Positionen die mit diesem Lieferschein verknüpft sind"""
        items = CustomerOrderItem.objects.filter(
            order=obj.order,
            delivery_note_number=obj.delivery_note_number
        )
        return CustomerOrderItemSerializer(items, many=True).data

    def get_customer_name(self, obj):
        cust = getattr(getattr(obj, 'order', None), 'customer', None)
        if not cust:
            return None
        name = getattr(cust, 'company_name', None)
        if name:
            return name
        return f"{getattr(cust, 'first_name', '')} {getattr(cust, 'last_name', '')}".strip()


class DeliveryNoteCreateSerializer(serializers.ModelSerializer):
    """Serializer zum Erstellen von Lieferscheinen"""
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="IDs der Positionen die geliefert werden sollen"
    )
    delivery_note_number = serializers.CharField(read_only=True)
    
    class Meta:
        model = DeliveryNote
        fields = [
            'id', 'delivery_note_number', 'order', 'delivery_date', 'shipping_address',
            'carrier', 'tracking_number',
            'notes', 'item_ids'
        ]
        read_only_fields = ['id', 'delivery_note_number']
    
    def create(self, validated_data):
        item_ids = validated_data.pop('item_ids', [])
        order = validated_data.get('order')
        # Berechne sequence_number für diesen Auftrag
        existing_count = DeliveryNote.objects.filter(order=order).count()

        # If all positions are already delivered in an existing delivery note,
        # return the first delivery note instead of creating a new version.
        total_positions = order.items.count()
        delivered_positions = order.items.filter(is_delivered=True).count()
        if existing_count >= 1 and total_positions > 0 and delivered_positions >= total_positions:
            # Return the first delivery note (sequence_number == 1) to avoid versioning when unnecessary
            existing_dn = DeliveryNote.objects.filter(order=order, sequence_number=1).first()
            if existing_dn:
                return existing_dn

        # Otherwise create a new delivery note (sequence_number increments)
        validated_data['sequence_number'] = existing_count + 1
        delivery_note = DeliveryNote(**validated_data)
        delivery_note.generate_number()  # Generiere Nummer
        delivery_note.save()

        # Markiere Positionen als geliefert
        if item_ids:
            CustomerOrderItem.objects.filter(
                id__in=item_ids,
                order=delivery_note.order
            ).update(
                delivery_note_number=delivery_note.sequence_number,
                is_delivered=True
            )

        return delivery_note


# =============================================================================
# Commission Serializers
# =============================================================================

class CustomerOrderCommissionRecipientSerializer(serializers.ModelSerializer):
    """Serializer für Provisionsempfänger"""
    employee_name = serializers.SerializerMethodField()
    employee_commission_rate = serializers.DecimalField(
        source='employee.commission_rate', 
        max_digits=5, 
        decimal_places=2, 
        read_only=True
    )
    
    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}"
        return f"Mitarbeiter {obj.employee_id}"
    
    class Meta:
        model = CustomerOrderCommissionRecipient
        fields = [
            'id', 'employee', 'employee_name', 'employee_commission_rate',
            'commission_percentage', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeeCommissionSerializer(serializers.ModelSerializer):
    """Serializer für Mitarbeiterprovisionen"""
    employee_name = serializers.SerializerMethodField()
    order_number = serializers.CharField(source='customer_order.order_number', read_only=True)
    customer_name = serializers.SerializerMethodField()
    
    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}"
        return f"Mitarbeiter {obj.employee_id}"
    
    class Meta:
        model = EmployeeCommission
        fields = [
            'id', 'employee', 'employee_name', 'customer_order', 'order_number',
            'customer_name', 'fiscal_year', 'commission_amount', 'order_net_total',
            'commission_rate', 'commission_percentage', 'calculated_at'
        ]
        read_only_fields = ['id', 'calculated_at']
    
    def get_customer_name(self, obj):
        customer = obj.customer_order.customer
        # Customer model doesn't have company_name - use university/institute from primary address if available
        primary_address = customer.addresses.first()
        if primary_address:
            if primary_address.university:
                return primary_address.university
            if primary_address.institute:
                return primary_address.institute
        # Fall back to customer name
        return f"{customer.first_name} {customer.last_name}".strip()


# =============================================================================
# Customer Order Serializers
# =============================================================================

class CustomerOrderListSerializer(serializers.ModelSerializer):
    """Listenansicht für Aufträge"""
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_amount = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerOrder
        fields = [
            'id', 'order_number', 'customer', 'customer_name',
            'status', 'status_display', 'order_date', 'delivery_date',
            'total_amount', 'items_count', 'created_at'
        ]
    
    def get_total_amount(self, obj):
        return obj.calculate_total()
    
    def get_items_count(self, obj):
        return obj.items.count()

    def get_customer_name(self, obj):
        cust = getattr(obj, 'customer', None)
        if not cust:
            return None
        name = getattr(cust, 'company_name', None)
        if name:
            return name
        return f"{getattr(cust, 'first_name', '')} {getattr(cust, 'last_name', '')}".strip()


class CustomerOrderDetailSerializer(serializers.ModelSerializer):
    """Detailansicht für Aufträge"""
    items = CustomerOrderItemSerializer(many=True, read_only=True)
    delivery_notes = DeliveryNoteListSerializer(many=True, read_only=True)
    invoices = InvoiceListSerializer(many=True, read_only=True)
    commission_recipients = CustomerOrderCommissionRecipientSerializer(many=True, read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_data = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Calculated fields
    total_net = serializers.SerializerMethodField()
    total_tax = serializers.SerializerMethodField()
    total_gross = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    open_amount = serializers.SerializerMethodField()
    
    # Quotation reference
    quotation_number = serializers.CharField(source='quotation.quotation_number', read_only=True)
    
    # Terms
    payment_term_name = serializers.CharField(source='payment_term.name', read_only=True)
    delivery_term_name = serializers.CharField(source='delivery_term.incoterm', read_only=True)
    warranty_term_name = serializers.CharField(source='warranty_term.name', read_only=True)
    
    # User
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.get_full_name', read_only=True)
    sales_person_name = serializers.CharField(source='sales_person.get_full_name', read_only=True)
    
    class Meta:
        model = CustomerOrder
        fields = [
            'id', 'order_number', 'status', 'status_display',
            'customer', 'customer_name', 'customer_data',
            'quotation', 'quotation_number',
            'project_reference', 'system_reference',
            'order_date', 'delivery_date', 'confirmation_date',
            'customer_document', 'customer_order_number',
            'confirmation_address', 'shipping_address', 'billing_address',
            'confirmation_email', 'billing_email', 'customer_vat_id',
            'payment_term', 'payment_term_name',
            'delivery_term', 'delivery_term_name',
            'warranty_term', 'warranty_term_name',
            'tax_rate', 'tax_included',
            'order_notes', 'production_notes', 'delivery_notes_text',
            'confirmation_pdf', 'sales_person', 'sales_person_name',
            'commission_recipients',
            'total_net', 'total_tax', 'total_gross', 'total_paid', 'open_amount',
            'items', 'delivery_notes', 'invoices',
            'created_by', 'created_by_name', 'confirmed_by', 'confirmed_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'order_number', 'confirmation_date', 'confirmation_pdf',
            'created_by', 'confirmed_by', 'created_at', 'updated_at'
        ]
    
    def get_customer_data(self, obj):
        """Vollständige Kundendaten für Formulare"""
        if not obj.customer:
            return None
        cust = obj.customer
        # Try to gather email/phone/address from related objects if available
        email = None
        phone = None
        addr = None
        postal_code = None
        city = None
        country = None
        addresses = []
        
        if hasattr(cust, 'emails'):
            first_email = cust.emails.first()
            if first_email:
                email = first_email.email
        if hasattr(cust, 'phones'):
            first_phone = cust.phones.first()
            if first_phone:
                phone = first_phone.phone_number
        if hasattr(cust, 'addresses'):
            # Get all addresses for dropdown selection
            for a in cust.addresses.all():
                addresses.append({
                    'id': a.id,
                    'address_type': a.address_type,
                    'is_primary': getattr(a, 'is_primary', False),
                    'university': getattr(a, 'university', ''),
                    'institute': getattr(a, 'institute', ''),
                    'department': getattr(a, 'department', ''),
                    'street': a.street or '',
                    'house_number': a.house_number or '',
                    'address_supplement': getattr(a, 'address_supplement', ''),
                    'postal_code': a.postal_code or '',
                    'city': a.city or '',
                    'country': a.country or 'DE',
                })
            first_addr = cust.addresses.first()
            if first_addr:
                addr = f"{first_addr.street} {first_addr.house_number or ''}".strip()
                postal_code = first_addr.postal_code
                city = first_addr.city
                country = first_addr.country

        return {
            'id': cust.id,
            'company_name': getattr(cust, 'company_name', None) or f"{getattr(cust, 'first_name', '')} {getattr(cust, 'last_name', '')}".strip(),
            'full_name': f"{getattr(cust, 'first_name', '')} {getattr(cust, 'last_name', '')}".strip(),
            'salutation': getattr(cust, 'salutation', ''),
            'title': getattr(cust, 'title', ''),
            'first_name': getattr(cust, 'first_name', ''),
            'last_name': getattr(cust, 'last_name', ''),
            'email': email,
            'phone': phone,
            'address': addr,
            'postal_code': postal_code,
            'city': city,
            'country': country,
            'addresses': addresses,
            'primary_email': email,
        }

    def get_customer_name(self, obj):
        cust = getattr(obj, 'customer', None)
        if not cust:
            return None
        name = getattr(cust, 'company_name', None)
        if name:
            return name
        return f"{getattr(cust, 'first_name', '')} {getattr(cust, 'last_name', '')}".strip()
    
    def get_total_net(self, obj):
        return obj.calculate_total()
    
    def get_total_tax(self, obj):
        net = obj.calculate_total()
        rate = obj.tax_rate or Decimal('19.00')
        return round(net * rate / Decimal('100'), 2)
    
    def get_total_gross(self, obj):
        net = obj.calculate_total()
        rate = obj.tax_rate or Decimal('19.00')
        tax = net * rate / Decimal('100')
        return round(net + tax, 2)
    
    def get_total_paid(self, obj):
        return sum(
            payment.amount
            for invoice in obj.invoices.all()
            for payment in invoice.payments.all()
        )
    
    def get_open_amount(self, obj):
        gross = self.get_total_gross(obj)
        paid = self.get_total_paid(obj)
        return gross - paid


class CustomerOrderCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer zum Erstellen und Bearbeiten von Aufträgen"""
    items = CustomerOrderItemCreateSerializer(many=True, required=False)
    commission_recipients = CustomerOrderCommissionRecipientSerializer(many=True, required=False)
    customer_document = serializers.FileField(required=False, allow_null=True, allow_empty_file=True)

    class Meta:
        model = CustomerOrder
        fields = [
            'customer', 'quotation',
            'project_reference', 'system_reference',
            'order_date', 'delivery_date',
            'customer_document', 'customer_order_number',
            'confirmation_address', 'shipping_address', 'billing_address',
            'confirmation_email', 'billing_email', 'customer_vat_id',
            'payment_term', 'delivery_term', 'warranty_term',
            'tax_rate', 'tax_included',
            'order_notes', 'production_notes', 'delivery_notes_text',
            'sales_person',
            'commission_recipients',
            'items'
        ]
    
    def to_internal_value(self, data):
        # Entferne customer_document wenn es ein leerer String ist
        if 'customer_document' in data and data['customer_document'] in ['', None]:
            data = data.copy()
            del data['customer_document']
        return super().to_internal_value(data)

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        commission_recipients_data = validated_data.pop('commission_recipients', [])
        import json
        if isinstance(items_data, str):
            try:
                items_data = json.loads(items_data)
            except Exception:
                items_data = []

        # Accept legacy 'vat_id' key from frontend and map to 'customer_vat_id'
        if 'vat_id' in validated_data and 'customer_vat_id' not in validated_data:
            validated_data['customer_vat_id'] = validated_data.pop('vat_id')

        order = CustomerOrder.objects.create(**validated_data)
        
        # Create commission recipients
        for recipient_data in commission_recipients_data:
            CustomerOrderCommissionRecipient.objects.create(
                customer_order=order,
                **recipient_data
            )
        
        # If this order was created from a quotation, mark that quotation as ORDERED
        quotation = validated_data.get('quotation') or getattr(order, 'quotation', None)
        try:
            if quotation:
                # quotation may be an id or an instance
                from sales.models import Quotation
                if isinstance(quotation, int):
                    q = Quotation.objects.filter(id=quotation).first()
                elif isinstance(quotation, Quotation):
                    q = quotation
                else:
                    q = getattr(order, 'quotation', None)

                if q:
                    q.status = 'ORDERED'
                    q.save(update_fields=['status'])
        except Exception:
            # Be tolerant: falls das Quotation-Modul nicht verfügbar ist, nichts tun
            pass
        for idx, item in enumerate(items_data):
            item['position'] = item.get('position', idx + 1)
            CustomerOrderItem.objects.create(order=order, **item)
        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        commission_recipients_data = validated_data.pop('commission_recipients', None)
        import json
        if isinstance(items_data, str):
            try:
                items_data = json.loads(items_data)
            except Exception:
                items_data = None

        # Map legacy 'vat_id' to model field 'customer_vat_id'
        if 'vat_id' in validated_data and 'customer_vat_id' not in validated_data:
            validated_data['customer_vat_id'] = validated_data.pop('vat_id')

        # Check if status is changing to 'bestaetigt' (for commission calculation)
        old_status = instance.status
        new_status = validated_data.get('status', old_status)
        should_calculate_commissions = (old_status == 'angelegt' and new_status == 'bestaetigt')

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        
        # Update commission recipients
        if commission_recipients_data is not None:
            # Delete old recipients and create new ones
            instance.commission_recipients.all().delete()
            for recipient_data in commission_recipients_data:
                CustomerOrderCommissionRecipient.objects.create(
                    customer_order=instance,
                    **recipient_data
                )
        
        # Calculate commissions AFTER recipients are saved
        if should_calculate_commissions:
            # Delete old commissions for this order
            from customer_orders.models import EmployeeCommission
            EmployeeCommission.objects.filter(customer_order=instance).delete()
            # Recalculate
            instance._calculate_commissions()
        
        if items_data is not None:
            # Lösche alte Positionen und erstelle neue
            instance.items.all().delete()
            for idx, item in enumerate(items_data):
                item['position'] = item.get('position', idx + 1)
                CustomerOrderItem.objects.create(order=instance, **item)
        return instance


# =============================================================================
# Confirmation Serializer (für Auftragsbestätigung)
# =============================================================================

class CustomerOrderConfirmSerializer(serializers.Serializer):
    """Serializer für die Auftragsbestätigung"""
    confirmation_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        """Prüft ob der Auftrag bestätigt werden kann"""
        order = self.context.get('order')
        if order.status != 'angelegt':
            raise serializers.ValidationError(
                "Nur Aufträge mit Status 'angelegt' können bestätigt werden."
            )
        if not order.items.exists():
            raise serializers.ValidationError(
                "Der Auftrag hat keine Positionen."
            )
        return data
