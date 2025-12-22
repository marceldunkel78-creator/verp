from rest_framework import serializers
from .models import CustomerOrder, CustomerOrderItem


class CustomerOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerOrderItem
        fields = ['id', 'article_number', 'name', 'description', 'quantity', 'unit', 'list_price', 'final_price', 'currency', 'position']


class CustomerOrderListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.company_name', read_only=True)

    class Meta:
        model = CustomerOrder
        fields = ['id', 'order_number', 'customer', 'customer_name', 'status', 'order_date', 'created_at']


class CustomerOrderDetailSerializer(serializers.ModelSerializer):
    items = CustomerOrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.company_name', read_only=True)

    class Meta:
        model = CustomerOrder
        fields = ['id', 'order_number', 'status', 'customer', 'customer_name', 'project_reference', 'system_reference', 'order_date', 'delivery_date', 'customer_document', 'customer_order_number', 'customer_name', 'confirmation_address', 'shipping_address', 'billing_address', 'confirmation_email', 'billing_email', 'notes', 'vat_id', 'items', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'order_number', 'created_by', 'created_at', 'updated_at']


class CustomerOrderCreateUpdateSerializer(serializers.ModelSerializer):
    items = CustomerOrderItemSerializer(many=True, required=False)

    class Meta:
        model = CustomerOrder
        fields = ['customer', 'project_reference', 'system_reference', 'order_date', 'delivery_date', 'customer_document', 'customer_order_number', 'customer_name', 'confirmation_address', 'shipping_address', 'billing_address', 'confirmation_email', 'billing_email', 'notes', 'vat_id', 'items']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        import json
        if isinstance(items_data, str):
            try:
                items_data = json.loads(items_data)
            except Exception:
                items_data = []

        order = CustomerOrder.objects.create(**validated_data)
        for idx, item in enumerate(items_data):
            item['position'] = item.get('position', idx + 1)
            CustomerOrderItem.objects.create(order=order, **item)
        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        import json
        if isinstance(items_data, str):
            try:
                items_data = json.loads(items_data)
            except Exception:
                items_data = None

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for idx, item in enumerate(items_data):
                item['position'] = item.get('position', idx + 1)
                CustomerOrderItem.objects.create(order=instance, **item)
        return instance
