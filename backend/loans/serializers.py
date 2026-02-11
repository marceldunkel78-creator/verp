from rest_framework import serializers
from .models import (
    Loan, LoanItem, LoanReceipt, LoanItemReceipt, 
    LoanItemPhoto, LoanReturn, LoanReturnItem
)
from suppliers.models import Supplier
from users.serializers import EmployeeSerializer


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
            'shipping_carrier', 'tracking_number', 'pdf_file',
            'notes', 'created_at', 'created_by', 'created_by_display', 'items'
        ]
        read_only_fields = ['return_number', 'created_at', 'created_by', 'created_by_display', 'pdf_file']


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
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items_count = serializers.SerializerMethodField()
    responsible_employee_display = serializers.CharField(
        source='responsible_employee.full_name', read_only=True, allow_null=True
    )
    
    class Meta:
        model = Loan
        fields = [
            'id', 'loan_number', 'supplier', 'supplier_name',
            'status', 'status_display', 'request_date', 'return_deadline',
            'items_count', 'created_at', 'responsible_employee', 'responsible_employee_display'
        ]
    
    def get_items_count(self, obj):
        return obj.items.count()


class LoanDetailSerializer(serializers.ModelSerializer):
    """Detailansicht für Leihungen"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = serializers.SerializerMethodField()
    receipt = serializers.SerializerMethodField()
    returns = LoanReturnSerializer(many=True, read_only=True)
    created_by_display = serializers.CharField(source='created_by.get_full_name', read_only=True)
    updated_by_display = serializers.CharField(source='updated_by.get_full_name', read_only=True)
    responsible_employee_detail = EmployeeSerializer(source='responsible_employee', read_only=True)
    observers_detail = EmployeeSerializer(source='observers', many=True, read_only=True)
    
    class Meta:
        model = Loan
        fields = [
            'id', 'loan_number', 'supplier', 'supplier_name',
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
    # observers als Liste von IDs
    from django.db.models import Q
    from users.models import Employee  # lokal import, App ist geladen
    # Employee considered active if HR status is 'aktiv' or linked User is active
    observers = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Employee.objects.filter(Q(employment_status='aktiv') | Q(users__is_active=True)).distinct(),
        required=False
    )
    
    class Meta:
        model = Loan
        fields = [
            'supplier', 'status', 'request_date', 'return_deadline',
            'return_address_name', 'return_address_street', 'return_address_house_number',
            'return_address_postal_code', 'return_address_city', 'return_address_country',
            'supplier_reference', 'notes', 'items',
            'responsible_employee', 'observers'
        ]
    
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
