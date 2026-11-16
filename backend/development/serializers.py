from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    DevelopmentProject, DevelopmentTicket, DevelopmentProjectComment, DevelopmentTicketComment,
    DevelopmentProjectMaterialItem, DevelopmentProjectInvestment, DevelopmentProjectCostCalculation,
    DevelopmentProjectAttachment, DevelopmentTicketAttachment, DevelopmentProjectTimeEntry, DevelopmentProjectSource
)

User = get_user_model()


class DevelopmentTicketCommentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DevelopmentTicketComment
        fields = ['id', 'ticket', 'comment', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['ticket', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class DevelopmentTicketAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = DevelopmentTicketAttachment
        fields = ['id', 'ticket', 'file', 'filename', 'file_size', 'content_type', 'is_image', 'file_url', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['ticket', 'uploaded_at', 'uploaded_by', 'is_image']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return None

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None


class DevelopmentProjectTimeEntrySerializer(serializers.ModelSerializer):
    """Serializer for project and ticket time entries."""
    employee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    ticket_number = serializers.CharField(source='ticket.ticket_number', read_only=True, allow_null=True)
    ticket_title = serializers.CharField(source='ticket.title', read_only=True, allow_null=True)

    class Meta:
        model = DevelopmentProjectTimeEntry
        fields = ['id', 'project', 'ticket', 'ticket_number', 'ticket_title', 'date', 'time', 'employee', 'employee_name', 'hours_spent', 'description', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'ticket']

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip() or obj.employee.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class DevelopmentTicketListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    project_number = serializers.CharField(source='project.project_number', read_only=True, allow_null=True)
    project_name = serializers.CharField(source='project.name', read_only=True, allow_null=True)
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = DevelopmentTicket
        fields = ['id', 'ticket_number', 'title', 'category', 'category_display', 'status', 'status_display', 'priority', 'priority_display', 'project', 'project_number', 'project_name', 'assigned_to', 'assigned_to_name', 'start_date', 'end_date', 'updated_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None


class DevelopmentTicketSerializer(serializers.ModelSerializer):
    """Serializer for development tickets."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    project_number = serializers.CharField(source='project.project_number', read_only=True, allow_null=True)
    project_name = serializers.CharField(source='project.name', read_only=True, allow_null=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    time_entries = serializers.SerializerMethodField()
    total_hours_spent = serializers.SerializerMethodField()

    class Meta:
        model = DevelopmentTicket
        fields = ['id', 'ticket_number', 'title', 'description', 'category', 'category_display', 'status', 'status_display', 'priority', 'priority_display', 'start_date', 'end_date', 'project', 'project_number', 'project_name', 'assigned_to', 'assigned_to_name', 'comments', 'attachments', 'time_entries', 'total_hours_spent', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['ticket_number', 'created_by', 'created_at', 'updated_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_comments(self, obj):
        return DevelopmentTicketCommentSerializer(obj.comments.all(), many=True).data

    def get_attachments(self, obj):
        return DevelopmentTicketAttachmentSerializer(obj.attachments.all(), many=True, context=self.context).data

    def get_time_entries(self, obj):
        return DevelopmentProjectTimeEntrySerializer(obj.time_entries.all(), many=True).data

    def get_total_hours_spent(self, obj):
        from django.db.models import Sum
        total = obj.time_entries.aggregate(Sum('hours_spent'))['hours_spent__sum']
        return float(total) if total else 0.0


class DevelopmentProjectCommentSerializer(serializers.ModelSerializer):
    """Serializer für Kommentare"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProjectComment
        fields = [
            'id', 'project', 'comment', 'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']
    
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


class DevelopmentProjectInvestmentSerializer(serializers.ModelSerializer):
    """Serializer für Sachkosten und Investitionen."""
    net_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    procurement_order_number = serializers.CharField(source='procurement_order.order_number', read_only=True, allow_null=True)
    procurement_supplier_name = serializers.CharField(source='procurement_order.supplier.company_name', read_only=True, allow_null=True)

    class Meta:
        model = DevelopmentProjectInvestment
        fields = [
            'id', 'project', 'description', 'order_number', 'procurement_order', 'procurement_order_number',
            'procurement_supplier_name', 'date', 'net_amount', 'created_at'
        ]
        read_only_fields = ['project', 'created_at']


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
            'id', 'project', 'investment', 'is_investment_receipt', 'file', 'filename', 'file_size', 'content_type',
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


class DevelopmentProjectSourceSerializer(serializers.ModelSerializer):
    """Serializer für Quellen/Links"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProjectSource
        fields = [
            'id', 'project', 'title', 'url', 'description', 'position',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']
    
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
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    total_hours_spent = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProject
        fields = [
            'id', 'project_number', 'name', 'status', 'status_display',
            'priority', 'priority_display',
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
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    
    # Related data
    tickets = DevelopmentTicketSerializer(many=True, read_only=True)
    comments = DevelopmentProjectCommentSerializer(many=True, read_only=True)
    material_items = DevelopmentProjectMaterialItemSerializer(many=True, read_only=True)
    investments = DevelopmentProjectInvestmentSerializer(many=True, read_only=True)
    cost_calculations = DevelopmentProjectCostCalculationSerializer(many=True, read_only=True)
    attachments = DevelopmentProjectAttachmentSerializer(many=True, read_only=True)
    time_entries = DevelopmentProjectTimeEntrySerializer(many=True, read_only=True)
    sources = DevelopmentProjectSourceSerializer(many=True, read_only=True)
    
    # Computed fields
    total_hours_spent = serializers.SerializerMethodField()
    total_material_cost = serializers.SerializerMethodField()
    
    class Meta:
        model = DevelopmentProject
        fields = [
            'id', 'project_number', 'name', 'description',
            'status', 'status_display', 'priority', 'priority_display',
            'assigned_to', 'assigned_to_name',
            'project_start', 'planned_end', 'is_open',
            'tickets', 'comments', 'material_items', 'investments', 'cost_calculations',
            'attachments', 'time_entries', 'sources',
            'total_hours_spent', 'total_material_cost',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'project_number', 'created_at', 'updated_at',
            'tickets', 'comments', 'material_items', 'investments', 'cost_calculations',
            'attachments', 'time_entries', 'sources'
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
            'status', 'priority', 'assigned_to', 'project_start', 'planned_end'
        ]
        read_only_fields = ['id', 'project_number']
