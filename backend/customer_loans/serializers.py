from rest_framework import serializers
from .models import CustomerLoan, CustomerLoanItem
from users.serializers import EmployeeSerializer


class CustomerLoanItemSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(
        source='inventory_item.name', read_only=True, allow_null=True
    )
    inventory_number = serializers.CharField(
        source='inventory_item.inventory_number', read_only=True, allow_null=True
    )

    class Meta:
        model = CustomerLoanItem
        fields = [
            'id', 'position', 'product_name', 'article_number',
            'quantity', 'unit', 'serial_number', 'notes',
            'inventory_item', 'inventory_item_name', 'inventory_number',
            'is_returned', 'is_returned_complete', 'is_returned_intact',
            'is_purchased', 'return_date', 'return_notes'
        ]


class CustomerLoanItemNestedSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = CustomerLoanItem
        fields = [
            'id', 'position', 'product_name', 'article_number',
            'quantity', 'unit', 'serial_number', 'notes',
            'inventory_item',
            'is_returned', 'is_returned_complete', 'is_returned_intact',
            'is_purchased', 'return_date', 'return_notes'
        ]


class CustomerLoanListSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items_count = serializers.SerializerMethodField()
    responsible_employee_display = serializers.SerializerMethodField()

    class Meta:
        model = CustomerLoan
        fields = [
            'id', 'loan_number', 'customer', 'customer_name',
            'status', 'status_display', 'loan_date', 'return_deadline',
            'items_count', 'created_at',
            'responsible_employee', 'responsible_employee_display'
        ]

    def get_items_count(self, obj):
        return obj.items.count()

    def get_responsible_employee_display(self, obj):
        if obj.responsible_employee:
            return obj.responsible_employee.get_full_name()
        return None

    def get_customer_name(self, obj):
        c = obj.customer
        return f"{c.title} {c.first_name} {c.last_name}".strip() if c else ''


class CustomerLoanDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = CustomerLoanItemSerializer(many=True, read_only=True)
    created_by_display = serializers.SerializerMethodField()
    updated_by_display = serializers.SerializerMethodField()
    responsible_employee_detail = EmployeeSerializer(
        source='responsible_employee', read_only=True
    )
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = CustomerLoan
        fields = [
            'id', 'loan_number', 'customer', 'customer_name',
            'status', 'status_display', 'loan_date', 'return_deadline',
            'delivery_address_name', 'delivery_address_street',
            'delivery_address_house_number', 'delivery_address_postal_code',
            'delivery_address_city', 'delivery_address_country',
            'standard_clause', 'notes',
            'responsible_employee', 'responsible_employee_detail',
            'items', 'pdf_file', 'pdf_url',
            'created_at', 'updated_at',
            'created_by', 'created_by_display',
            'updated_by', 'updated_by_display'
        ]
        read_only_fields = [
            'loan_number', 'created_at', 'updated_at',
            'created_by', 'created_by_display',
            'updated_by', 'updated_by_display'
        ]

    def get_created_by_display(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_updated_by_display(self, obj):
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return None

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            return obj.pdf_file.url
        return None

    def get_customer_name(self, obj):
        c = obj.customer
        return f"{c.title} {c.first_name} {c.last_name}".strip() if c else ''


class CustomerLoanCreateUpdateSerializer(serializers.ModelSerializer):
    items = CustomerLoanItemNestedSerializer(many=True, required=False)
    return_deadline = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = CustomerLoan
        fields = [
            'customer', 'status', 'loan_date', 'return_deadline',
            'delivery_address_name', 'delivery_address_street',
            'delivery_address_house_number', 'delivery_address_postal_code',
            'delivery_address_city', 'delivery_address_country',
            'standard_clause', 'notes', 'items',
            'responsible_employee'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        customer_loan = CustomerLoan.objects.create(**validated_data)

        for idx, item_data in enumerate(items_data, 1):
            item_data.pop('customer_loan', None)
            position = item_data.pop('position', idx)
            CustomerLoanItem.objects.create(
                customer_loan=customer_loan, position=position, **item_data
            )

        return customer_loan

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
                item_data.pop('customer_loan', None)
                item_data.pop('position', None)

                if item_id and item_id in existing_ids:
                    CustomerLoanItem.objects.filter(id=item_id).update(
                        position=idx, **item_data
                    )
                    updated_ids.add(item_id)
                else:
                    CustomerLoanItem.objects.create(
                        customer_loan=instance, position=idx, **item_data
                    )

            items_to_delete = existing_ids - updated_ids
            instance.items.filter(id__in=items_to_delete).delete()

        return instance
