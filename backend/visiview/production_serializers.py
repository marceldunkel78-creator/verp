# VisiView Production Order Serializers
from rest_framework import serializers
from .production_orders import VisiViewProductionOrder, VisiViewProductionOrderItem


class VisiViewProductionOrderItemSerializer(serializers.ModelSerializer):
    """Serializer für VisiView Production Order Item"""
    customer_order_item_details = serializers.SerializerMethodField()
    selected_options_details = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewProductionOrderItem
        fields = [
            'id', 'production_order', 'customer_order_item', 'customer_order_item_details',
            'selected_options', 'selected_options_details', 'maintenance_months', 'notes'
        ]
    
    def get_customer_order_item_details(self, obj):
        item = obj.customer_order_item
        return {
            'id': item.id,
            'position_number': item.position_number,
            'article_number': item.article_number,
            'description': item.description,
            'quantity': float(item.quantity)
        }
    
    def get_selected_options_details(self, obj):
        return [{
            'id': opt.id,
            'name': opt.name,
            'bit_position': opt.bit_position
        } for opt in obj.selected_options.all()]


class VisiViewProductionOrderListSerializer(serializers.ModelSerializer):
    """Serializer für VisiView Production Order Liste"""
    customer_name = serializers.CharField(source='customer.last_name', read_only=True)
    customer_order_number = serializers.CharField(source='customer_order.order_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    processing_type_display = serializers.CharField(source='get_processing_type_display', read_only=True)
    target_license_number = serializers.CharField(source='target_license.serial_number', read_only=True, allow_null=True)
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    
    class Meta:
        model = VisiViewProductionOrder
        fields = [
            'id', 'order_number', 'customer', 'customer_name',
            'customer_order', 'customer_order_number',
            'status', 'status_display', 'processing_type', 'processing_type_display',
            'target_license', 'target_license_number', 'items_count',
            'created_at', 'completed_at'
        ]


class VisiViewProductionOrderDetailSerializer(serializers.ModelSerializer):
    """Serializer für VisiView Production Order Detail"""
    customer_details = serializers.SerializerMethodField()
    customer_order_details = serializers.SerializerMethodField()
    target_license_details = serializers.SerializerMethodField()
    items = VisiViewProductionOrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    processing_type_display = serializers.CharField(source='get_processing_type_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewProductionOrder
        fields = [
            'id', 'order_number', 'customer', 'customer_details',
            'customer_order', 'customer_order_details',
            'status', 'status_display', 'processing_type', 'processing_type_display',
            'target_license', 'target_license_details', 'items',
            'notes', 'created_by', 'created_by_name', 'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = ['order_number', 'created_at', 'updated_at', 'completed_at', 'created_by']
    
    def get_customer_details(self, obj):
        if obj.customer:
            return {
                'id': obj.customer.id,
                'last_name': obj.customer.last_name,
                'first_name': obj.customer.first_name,
                'company': obj.customer.company
            }
        return None
    
    def get_customer_order_details(self, obj):
        if obj.customer_order:
            return {
                'id': obj.customer_order.id,
                'order_number': obj.customer_order.order_number,
                'order_date': obj.customer_order.order_date
            }
        return None
    
    def get_target_license_details(self, obj):
        if obj.target_license:
            return {
                'id': obj.target_license.id,
                'serial_number': obj.target_license.serial_number,
                'license_number': obj.target_license.license_number,
                'version': obj.target_license.version
            }
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class VisiViewProductionOrderCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für VisiView Production Order Create/Update"""
    
    class Meta:
        model = VisiViewProductionOrder
        fields = [
            'customer_order', 'customer', 'status', 'processing_type',
            'target_license', 'notes'
        ]
    
    def validate(self, data):
        # Bei EXTEND_LICENSE muss target_license gesetzt sein
        if data.get('processing_type') == 'EXTEND_LICENSE' and not data.get('target_license'):
            raise serializers.ValidationError({
                'target_license': 'Bei Lizenzerweiterung muss eine Ziel-Lizenz angegeben werden.'
            })
        
        # Bei NEW_LICENSE sollte keine target_license gesetzt sein
        if data.get('processing_type') == 'NEW_LICENSE' and data.get('target_license'):
            raise serializers.ValidationError({
                'target_license': 'Bei neuer Lizenz darf keine Ziel-Lizenz angegeben werden.'
            })
        
        return data
