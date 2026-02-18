from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    DevelopmentProject, DevelopmentProjectTodo, DevelopmentProjectComment,
    DevelopmentProjectMaterialItem, DevelopmentProjectCostCalculation,
    DevelopmentProjectAttachment, DevelopmentProjectTimeEntry
)

User = get_user_model()


class DevelopmentProjectTodoSerializer(serializers.ModelSerializer):
    """Serializer für ToDo-Einträge"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProjectTodo
        fields = [
            'id', 'project', 'text', 'is_completed', 'position',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class DevelopmentProjectCommentSerializer(serializers.ModelSerializer):
    """Serializer für Kommentare"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProjectComment
        fields = [
            'id', 'project', 'comment', 'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class DevelopmentProjectMaterialItemSerializer(serializers.ModelSerializer):
    """Serializer für Material-Positionen"""
    material_supply_name = serializers.CharField(source='material_supply.name', read_only=True)
    material_supply_part_number = serializers.CharField(source='material_supply.visitron_part_number', read_only=True)
    supplier_part_number = serializers.CharField(source='material_supply.supplier_part_number', read_only=True)
    material_supply_unit = serializers.CharField(source='material_supply.unit', read_only=True)
    item_cost = serializers.SerializerMethodField()
    unit_price = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProjectMaterialItem
        fields = [
            'id', 'project', 'material_supply',
            'material_supply_name', 'material_supply_part_number', 'supplier_part_number', 'material_supply_unit',
            'quantity', 'position', 'notes',
            'unit_price', 'item_cost'
        ]
    
    def get_item_cost(self, obj):
        return float(obj.get_item_cost())
    
    def get_unit_price(self, obj):
        if obj.material_supply:
            unit_price = getattr(obj.material_supply, 'calculate_purchase_price', lambda: obj.material_supply.list_price)()
            return float(unit_price) if unit_price else 0
        return 0


class DevelopmentProjectCostCalculationSerializer(serializers.ModelSerializer):
    """Serializer für Kostenkalkulationen"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProjectCostCalculation
        fields = [
            'id', 'project', 'name', 'is_active',
            'labor_hours', 'labor_rate',
            'development_cost_total', 'expected_sales_volume',
            'material_cost', 'labor_cost', 'development_cost_per_unit', 'total_cost',
            'notes', 'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = [
            'material_cost', 'labor_cost', 'development_cost_per_unit', 'total_cost',
            'created_at', 'updated_at', 'created_by'
        ]
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class DevelopmentProjectAttachmentSerializer(serializers.ModelSerializer):
    """Serializer für Dateianhänge"""
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProjectAttachment
        fields = [
            'id', 'project', 'file', 'filename', 'file_size', 'content_type',
            'is_image', 'file_url', 'uploaded_by', 'uploaded_by_name', 'uploaded_at'
        ]
        read_only_fields = ['uploaded_at', 'uploaded_by', 'is_image']
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return None
    
    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class DevelopmentProjectTimeEntrySerializer(serializers.ModelSerializer):
    """Serializer für Zeiteinträge"""
    employee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProjectTimeEntry
        fields = [
            'id', 'project', 'date', 'time', 'employee', 'employee_name',
            'hours_spent', 'description',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']
    
    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip() or obj.employee.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


# ============================================
# LIST/DETAIL SERIALIZERS
# ============================================

class DevelopmentProjectListSerializer(serializers.ModelSerializer):
    """Serializer für die Listenansicht"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    total_hours_spent = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProject
        fields = [
            'id', 'project_number', 'name', 'status', 'status_display',
            'assigned_to', 'assigned_to_name', 'project_start', 'planned_end',
            'is_open', 'total_hours_spent', 'created_at', 'updated_at'
        ]
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None
    
    def get_total_hours_spent(self, obj):
        from django.db.models import Sum
        total = obj.time_entries.aggregate(Sum('hours_spent'))['hours_spent__sum']
        return float(total) if total else 0.0


class DevelopmentProjectDetailSerializer(serializers.ModelSerializer):
    """Serializer für die Detailansicht"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    
    # Related data
    todos = DevelopmentProjectTodoSerializer(many=True, read_only=True)
    comments = DevelopmentProjectCommentSerializer(many=True, read_only=True)
    material_items = DevelopmentProjectMaterialItemSerializer(many=True, read_only=True)
    cost_calculations = DevelopmentProjectCostCalculationSerializer(many=True, read_only=True)
    attachments = DevelopmentProjectAttachmentSerializer(many=True, read_only=True)
    time_entries = DevelopmentProjectTimeEntrySerializer(many=True, read_only=True)
    
    # Computed fields
    total_hours_spent = serializers.SerializerMethodField()
    total_material_cost = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProject
        fields = [
            'id', 'project_number', 'name', 'description',
            'status', 'status_display', 'assigned_to', 'assigned_to_name',
            'project_start', 'planned_end', 'is_open',
            'todos', 'comments', 'material_items', 'cost_calculations',
            'attachments', 'time_entries',
            'total_hours_spent', 'total_material_cost',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'project_number', 'project_start', 'created_at', 'updated_at',
            'todos', 'comments', 'material_items', 'cost_calculations',
            'attachments', 'time_entries'
        ]
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_total_hours_spent(self, obj):
        from django.db.models import Sum
        total = obj.time_entries.aggregate(Sum('hours_spent'))['hours_spent__sum']
        return float(total) if total else 0.0
    
    def get_total_material_cost(self, obj):
        total = sum(item.get_item_cost() for item in obj.material_items.all())
        return float(total)


class DevelopmentProjectCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Create/Update Operationen"""
    
    class Meta:
        model = DevelopmentProject
        fields = [
            'id', 'project_number', 'name', 'description',
            'status', 'assigned_to', 'planned_end'
        ]
        read_only_fields = ['id', 'project_number']
