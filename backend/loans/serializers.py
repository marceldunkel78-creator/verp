from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Loan, LoanItem, LoanReceipt, LoanItemReceipt, 
    LoanItemPhoto, LoanReturn, LoanReturnItem
)
from suppliers.models import Supplier
from users.models import Employee
from users.serializers import EmployeeSerializer

User = get_user_model()


class ObserverSerializer(serializers.ModelSerializer):
    """
    Schlanker Serializer fuer Beobachter. UserSerializer waere hier
    unbrauchbar, weil er alle Berechtigungs-Flags mitschickt.
    """
    name = serializers.SerializerMethodField()
    employee_number = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'name', 'employee_number']
        read_only_fields = fields

    def get_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_employee_number(self, obj):
        return obj.employee.employee_id if obj.employee else None


class LoanItemPhotoSerializer(serializers.ModelSerializer):
    """Serializer für Fotos von Leihpositionen"""
    uploaded_by_display = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = LoanItemPhoto
        fields = [
            'id', 'loan_item', 'photo', 'photo_url', 'description', 
            'uploaded_at', 'uploaded_by', 'uploaded_by_display'
        ]
        read_only_fields = ['uploaded_at', 'uploaded_by', 'uploaded_by_display', 'photo_url']
    
    def get_photo_url(self, obj):
        if obj.photo:
            return obj.photo.url
        return None


class LoanItemReceiptSerializer(serializers.ModelSerializer):
    """Serializer für Wareneingangs-Checklist pro Position"""
    
    class Meta:
        model = LoanItemReceipt
        fields = ['id', 'loan_item', 'is_complete', 'is_intact', 'notes']


class LoanItemSerializer(serializers.ModelSerializer):
    """Serializer für Leihpositionen"""
    receipt = LoanItemReceiptSerializer(source='receipt_check', read_only=True)
    photos = serializers.SerializerMethodField()
    
    class Meta:
        model = LoanItem
        fields = [
            'id', 'loan', 'position', 'product_name', 
            'supplier_article_number', 'quantity', 'unit',
            'serial_number', 'notes', 'receipt', 'photos'
        ]
    
    def get_photos(self, obj):
        photos = obj.photos.all()
        return LoanItemPhotoSerializer(photos, many=True, context=self.context).data


class LoanItemNestedSerializer(serializers.ModelSerializer):
    """Nested serializer used when creating/updating Loans: excludes loan field"""
    # Explicitly declare id as not read-only so it can be used for updates
    id = serializers.IntegerField(required=False, allow_null=True)
    
    class Meta:
        model = LoanItem
        fields = [
            'id', 'position', 'product_name',
            'supplier_article_number', 'quantity', 'unit',
            'serial_number', 'notes'
        ]


class LoanReceiptSerializer(serializers.ModelSerializer):
    """Serializer für Wareneingang"""
    received_by_display = serializers.CharField(source='received_by.get_full_name', read_only=True)
    delivery_note_url = serializers.SerializerMethodField()
    loan_agreement_url = serializers.SerializerMethodField()
    
    class Meta:
        model = LoanReceipt
        fields = [
            'id', 'loan', 'receipt_date', 'received_by', 'received_by_display', 
            'delivery_note', 'delivery_note_url', 'loan_agreement', 'loan_agreement_url',
            'notes'
        ]
        read_only_fields = ['received_by', 'received_by_display', 'delivery_note_url', 'loan_agreement_url']
    
    def get_delivery_note_url(self, obj):
        if obj.delivery_note:
            return obj.delivery_note.url
        return None
    
    def get_loan_agreement_url(self, obj):
        if obj.loan_agreement:
            return obj.loan_agreement.url
        return None


class LoanReturnItemSerializer(serializers.ModelSerializer):
    """Serializer für Rücksendepositionen"""
    loan_item_detail = LoanItemSerializer(source='loan_item', read_only=True)
    
    class Meta:
        model = LoanReturnItem
        fields = ['id', 'loan_return', 'loan_item', 'loan_item_detail', 'quantity_returned', 'condition_notes']


class LoanReturnSerializer(serializers.ModelSerializer):
    """Serializer für Rücksendungen"""
    items = LoanReturnItemSerializer(many=True, read_only=True)
    created_by_display = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = LoanReturn
        fields = [
            'id', 'loan', 'return_number', 'return_date', 
            'shipping_carrier', 'tracking_number', 'pdf_file', 'pdf_language',
            'notes', 'created_at', 'created_by', 'created_by_display', 'items'
        ]
        read_only_fields = ['return_number', 'created_at', 'created_by',
                            'created_by_display', 'pdf_file', 'pdf_language']


class LoanReturnCreateSerializer(serializers.ModelSerializer):
    """Serializer für Rücksendungs-Erstellung"""
    items = LoanReturnItemSerializer(many=True, write_only=True)
    
    class Meta:
        model = LoanReturn
        fields = ['loan', 'return_date', 'shipping_carrier', 'tracking_number', 'notes', 'items']
    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        loan_return = LoanReturn.objects.create(**validated_data)
        
        for item_data in items_data:
            LoanReturnItem.objects.create(loan_return=loan_return, **item_data)
        
        return loan_return


class LoanListSerializer(serializers.ModelSerializer):
    """Listenansicht für Leihungen"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True, default=None)
    lender_customer_name = serializers.SerializerMethodField()
    lender_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items_count = serializers.SerializerMethodField()
    responsible_employee_display = serializers.CharField(
        source='responsible_employee.get_full_name', read_only=True, allow_null=True
    )

    class Meta:
        model = Loan
        fields = [
            'id', 'loan_number', 'lender_type', 'supplier', 'supplier_name',
            'lender_customer', 'lender_customer_name', 'lender_display',
            'status', 'status_display', 'request_date', 'return_deadline',
            'items_count', 'created_at', 'responsible_employee', 'responsible_employee_display'
        ]

    def get_lender_customer_name(self, obj):
        return obj.lender_name if obj.lender_type == 'customer' else None

    def get_lender_display(self, obj):
        """Anzeigename der Gegenpartei, unabhaengig vom Typ.

        Die Liste zeigt in der Spalte "Lieferant" bislang den Namen.
        Bei einer Kunden-Leihung ist supplier leer, dort muss der
        Kundenname stehen - sonst waere die Zeile leer und nicht
        zuordenbar.
        """
        return obj.lender_name or '—'

    def get_items_count(self, obj):
        return obj.items.count()


class LoanDetailSerializer(serializers.ModelSerializer):
    """Detailansicht für Leihungen"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True, default=None)
    lender_customer_name = serializers.SerializerMethodField()
    lender_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = serializers.SerializerMethodField()
    receipt = serializers.SerializerMethodField()
    returns = LoanReturnSerializer(many=True, read_only=True)
    created_by_display = serializers.CharField(source='created_by.get_full_name', read_only=True)
    updated_by_display = serializers.CharField(source='updated_by.get_full_name', read_only=True)
    responsible_employee_detail = EmployeeSerializer(source='responsible_employee', read_only=True)
    observers_detail = ObserverSerializer(source='observers', many=True, read_only=True)
    
    class Meta:
        model = Loan
        fields = [
            'id', 'loan_number', 'lender_type',
            'supplier', 'supplier_name',
            'lender_customer', 'lender_customer_name', 'lender_display',
            'status', 'status_display', 'request_date', 'return_deadline',
            'return_address_name', 'return_address_street', 'return_address_house_number',
            'return_address_postal_code', 'return_address_city', 'return_address_country',
            'supplier_reference', 'notes',
            'responsible_employee', 'responsible_employee_detail',
            'observers', 'observers_detail',
            'items', 'receipt', 'returns',
            'created_at', 'updated_at', 'created_by', 'created_by_display',
            'updated_by', 'updated_by_display'
        ]
        read_only_fields = [
            'loan_number', 'created_at', 'updated_at', 
            'created_by', 'created_by_display', 'updated_by', 'updated_by_display'
        ]

    def get_lender_customer_name(self, obj):
        return obj.lender_name if obj.lender_type == 'customer' else None

    def get_lender_display(self, obj):
        """Name der Gegenpartei, unabhaengig vom gewaehlten Typ."""
        return obj.lender_name or '—'
    
    def get_items(self, obj):
        items = obj.items.all()
        return LoanItemSerializer(items, many=True, context=self.context).data
    
    def get_receipt(self, obj):
        if hasattr(obj, 'receipt'):
            return LoanReceiptSerializer(obj.receipt, context=self.context).data
        return None


class LoanCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellung/Bearbeitung von Leihungen"""
    # use nested serializer without 'loan' to avoid validation error saying loan is required
    items = LoanItemNestedSerializer(many=True, required=False)
    # make return_deadline optional at serializer level
    return_deadline = serializers.DateField(required=False, allow_null=True)
    # Beobachter als Liste von User-IDs. Bewusst User statt Employee:
    # Beobachter werden direkt per Notification adressiert, ein Mitarbeiter
    # ohne Login kann keine Benachrichtigung empfangen.
    observers = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.filter(is_active=True),
        required=False
    )
    # Zuständiger Mitarbeiter: nur Mitarbeiter mit aktivem VERP-Login sind wählbar.
    # Ohne diese Einschränkung könnte ein Legacy-Mitarbeiter ohne Zugang
    # eingetragen werden - er kann weder benachrichtigt noch buchen.
    responsible_employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.filter(users__is_active=True).distinct(),
        required=False, allow_null=True
    )
    class Meta:
        model = Loan
        fields = [
            'lender_type', 'supplier', 'lender_customer',
            'status', 'request_date', 'return_deadline',
            'return_address_name', 'return_address_street', 'return_address_house_number',
            'return_address_postal_code', 'return_address_city', 'return_address_country',
            'supplier_reference', 'notes', 'items',
            'responsible_employee', 'observers'
        ]

    def validate(self, attrs):
        """
        Genau eine Gegenpartei, passend zum gewaehlten Typ.

        Wird das nicht geprueft, koennte ein Datensatz mit beiden
        gesetzt entstehen (der Typ waere dann irrefuehrend) oder mit
        keinem - letzteres fuehrt in __str__ und in den
        PDF-Generatoren zu einem AttributeError.
        """
        lender_type = attrs.get(
            'lender_type',
            getattr(self.instance, 'lender_type', 'supplier'))

        if lender_type == 'customer':
            kunde = attrs.get(
                'lender_customer',
                getattr(self.instance, 'lender_customer', None))
            if not kunde:
                raise serializers.ValidationError(
                    {'lender_customer':
                     'Bei Gegenpartei "Kunde" muss ein Kunde gewählt sein.'})
            lieferant = attrs.get(
                'supplier', getattr(self.instance, 'supplier', None))
            if lieferant:
                raise serializers.ValidationError(
                    {'supplier':
                     'Bei Gegenpartei "Kunde" darf kein Lieferant gesetzt sein.'})
        else:
            lieferant = attrs.get(
                'supplier', getattr(self.instance, 'supplier', None))
            if not lieferant:
                raise serializers.ValidationError(
                    {'supplier':
                     'Bei Gegenpartei "Lieferant" muss ein Lieferant '
                     'gewählt sein.'})
            kunde = attrs.get(
                'lender_customer',
                getattr(self.instance, 'lender_customer', None))
            if kunde:
                raise serializers.ValidationError(
                    {'lender_customer':
                     'Bei Gegenpartei "Lieferant" darf kein Kunde gesetzt sein.'})
        return attrs
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # no-op: observers queryset is defined on the field itself
    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        observers_data = validated_data.pop('observers', [])
        loan = Loan.objects.create(**validated_data)
        
        # set observers if provided
        if observers_data:
            loan.observers.set(observers_data)
        
        for idx, item_data in enumerate(items_data, 1):
            # ensure we don't pass 'position' or 'loan' twice
            item_data.pop('loan', None)
            position = item_data.pop('position', idx)
            LoanItem.objects.create(loan=loan, position=position, **item_data)
        
        return loan
    
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        observers_data = validated_data.pop('observers', None)
        
        # Update loan fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update observers if provided (explicit set)
        if observers_data is not None:
            instance.observers.set(observers_data)

        # Update items if provided
        if items_data is not None:
            # Get existing item IDs
            existing_ids = set(instance.items.values_list('id', flat=True))
            updated_ids = set()
            
            for idx, item_data in enumerate(items_data, 1):
                item_id = item_data.pop('id', None)
                # remove potential loan/position keys from payload to avoid multiple values
                item_data.pop('loan', None)
                item_data.pop('position', None)

                if item_id and item_id in existing_ids:
                    # Update existing item
                    LoanItem.objects.filter(id=item_id).update(position=idx, **item_data)
                    updated_ids.add(item_id)
                else:
                    # Create new item with explicit position
                    LoanItem.objects.create(loan=instance, position=idx, **item_data)
            
            # Delete removed items
            items_to_delete = existing_ids - updated_ids
            instance.items.filter(id__in=items_to_delete).delete()
        
        return instance
