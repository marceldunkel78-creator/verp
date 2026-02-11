from rest_framework import serializers
from .models import Project, ProjectComment, ProjectTodo, ProjectDocument, ProjectOrderPosition
from systems.models import System


class ProjectCommentSerializer(serializers.ModelSerializer):
    """Serializer für Projekt-Kommentare"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ProjectComment
        fields = ['id', 'project', 'comment', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['created_by', 'created_at']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class ProjectTodoSerializer(serializers.ModelSerializer):
    """Serializer für Projekt-ToDos"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ProjectTodo
        fields = ['id', 'project', 'text', 'is_completed', 'position', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class ProjectDocumentSerializer(serializers.ModelSerializer):
    """Serializer für Projekt-Dokumente"""
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ProjectDocument
        fields = ['id', 'project', 'file', 'file_url', 'filename', 'file_size', 'content_type', 
                  'description', 'uploaded_by', 'uploaded_by_name', 'uploaded_at', 'is_image']
        read_only_fields = ['uploaded_by', 'uploaded_at', 'file_size', 'content_type']
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None
    
    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class ProjectOrderPositionSerializer(serializers.ModelSerializer):
    """Serializer für Projekt-Auftragspositionen"""
    order_item_data = serializers.SerializerMethodField()
    supplier_order_number = serializers.CharField(source='supplier_order.order_number', read_only=True)
    production_order_number = serializers.CharField(source='production_order.production_number', read_only=True)
    
    class Meta:
        model = ProjectOrderPosition
        fields = ['id', 'project', 'order_item', 'order_item_data', 'supplier_order_created', 
                  'supplier_order', 'supplier_order_number', 'production_order_created', 
                  'production_order', 'production_order_number', 'visiview_order_created',
                  'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_order_item_data(self, obj):
        if obj.order_item:
            return {
                'id': obj.order_item.id,
                'position': obj.order_item.position,
                'description': obj.order_item.description,
                'quantity': str(obj.order_item.quantity),
                'unit_price': str(obj.order_item.unit_price),
                'product_type': obj.order_item.content_type.model if obj.order_item.content_type else None,
                'product_id': obj.order_item.object_id,
            }
        return None


class ProjectListSerializer(serializers.ModelSerializer):
    """Serializer für Projektliste"""
    customer_name = serializers.CharField(source='customer.__str__', read_only=True)
    systems_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    responsible_employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'name', 'customer', 'customer_name',
            'description', 'status', 'status_display', 'systems_count',
            'responsible_employee', 'responsible_employee_name',
            'forecast_date', 'forecast_revenue', 'forecast_probability',
            'tender_submission_deadline', 'planned_delivery_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['project_number', 'created_at', 'updated_at']

    def get_systems_count(self, obj):
        return obj.systems.count()
    
    def get_responsible_employee_name(self, obj):
        if obj.responsible_employee:
            return str(obj.responsible_employee)
        return None


class ProjectDetailSerializer(serializers.ModelSerializer):
    """Serializer für Projektdetails mit allen Informationen"""
    # Writeable list of system IDs
    systems = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)
    customer_name = serializers.CharField(source='customer.__str__', read_only=True)
    customer_number = serializers.CharField(source='customer.customer_number', read_only=True)
    systems_data = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.__str__', read_only=True)
    responsible_employee_name = serializers.SerializerMethodField()
    
    # Related data
    comments = ProjectCommentSerializer(many=True, read_only=True)
    todos = ProjectTodoSerializer(many=True, read_only=True)
    documents = ProjectDocumentSerializer(many=True, read_only=True)
    
    # All dates for calendar
    all_dates = serializers.SerializerMethodField()
    
    # Quotations linked to this project
    linked_quotations = serializers.SerializerMethodField()
    
    # Order data
    linked_order_data = serializers.SerializerMethodField()
    order_positions = ProjectOrderPositionSerializer(many=True, read_only=True)
    
    # Manufacturing status
    manufacturing_status = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'name', 'customer', 'customer_name',
            'customer_number', 'systems', 'systems_data', 'description',
            'status', 'status_display',
            'responsible_employee', 'responsible_employee_name',
            'linked_order', 'linked_order_data',
            'forecast_date', 'forecast_revenue', 'forecast_probability',
            'demo_date_from', 'demo_date_to',
            'tender_bidder_questions_deadline', 'tender_submission_deadline', 'tender_award_deadline',
            'planned_delivery_date', 'actual_delivery_date',
            'planned_installation_date', 'actual_installation_date',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
            'comments', 'todos', 'documents', 'order_positions',
            'all_dates', 'linked_quotations', 'manufacturing_status'
        ]
        read_only_fields = ['project_number', 'created_by', 'created_at', 'updated_at']

    def get_systems_data(self, obj):
        """Hole alle System-Details"""
        systems = obj.systems.all()
        return [
            {
                'id': sys.id,
                'system_number': sys.system_number,
                'system_name': sys.system_name,
                'customer_name': str(sys.customer) if sys.customer else None,
            }
            for sys in systems
        ]
    
    def get_responsible_employee_name(self, obj):
        if obj.responsible_employee:
            return str(obj.responsible_employee)
        return None
    
    def get_all_dates(self, obj):
        """Get all important dates for calendar display"""
        return obj.get_all_dates()
    
    def get_linked_quotations(self, obj):
        """Get all quotations linked to this project"""
        from sales.models import Quotation
        quotations = Quotation.objects.filter(
            project_reference__icontains=obj.project_number
        ).values('id', 'quotation_number', 'status', 'date', 'customer__first_name', 'customer__last_name')
        
        return list(quotations)
    
    def get_linked_order_data(self, obj):
        """Get linked order details"""
        if obj.linked_order:
            return {
                'id': obj.linked_order.id,
                'order_number': obj.linked_order.order_number,
                'status': obj.linked_order.status,
                'order_date': obj.linked_order.order_date,
            }
        return None
    
    def get_manufacturing_status(self, obj):
        """Get manufacturing and order status for this project"""
        from manufacturing.models import ProductionOrder
        from orders.models import Order
        
        result = {
            'production_orders': [],
            'supplier_orders': []
        }
        
        # Get production orders linked to this project
        production_orders = ProductionOrder.objects.filter(
            project_positions__project=obj
        ).distinct()
        
        for po in production_orders:
            result['production_orders'].append({
                'id': po.id,
                'production_number': po.production_number,
                'status': po.status,
                'planned_end_date': po.planned_end_date,
            })
        
        # Get supplier orders linked to this project
        supplier_orders = Order.objects.filter(
            project_positions__project=obj
        ).distinct()
        
        for so in supplier_orders:
            result['supplier_orders'].append({
                'id': so.id,
                'order_number': so.order_number,
                'status': so.status,
                'order_date': so.order_date,
                'supplier_confirmation_date': getattr(so, 'supplier_confirmation_date', None),
                'expected_delivery_date': getattr(so, 'expected_delivery_date', None),
            })
        
        return result

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Return systems as a list of IDs for the frontend
        data['systems'] = list(instance.systems.values_list('id', flat=True))
        return data

    def validate_systems(self, value):
        """Validate incoming list of system IDs and ensure they exist."""
        if not value:
            return []

        # Ensure all are integers
        ids = []
        for x in value:
            try:
                ids.append(int(x))
            except (TypeError, ValueError):
                raise serializers.ValidationError(f"Ungültiger System-Wert: {x}")

        # Check existence in systems.System
        existing = set(System.objects.filter(id__in=ids).values_list('id', flat=True))
        missing = [i for i in ids if i not in existing]
        if missing:
            raise serializers.ValidationError(f"Ungültige System-ID(s): {missing}")

        # Optionally check if systems belong to the same customer
        customer_id = self.initial_data.get('customer')
        if not customer_id and self.instance and getattr(self.instance, 'customer', None):
            customer_id = self.instance.customer.id
        
        if customer_id:
            try:
                cust_int = int(customer_id)
                wrong_owner = list(System.objects.filter(id__in=ids).exclude(customer_id=cust_int).values_list('id', flat=True))
                if wrong_owner:
                    # Just a warning - allow systems from different customers
                    pass  # Could raise validation error if strict ownership is required
            except (TypeError, ValueError):
                pass

        return ids

    def update(self, instance, validated_data):
        """Handle setting systems (M2M) on update explicitly."""
        systems_ids = validated_data.pop('systems', None)
        instance = super().update(instance, validated_data)
        if systems_ids is not None:
            systems_qs = System.objects.filter(id__in=systems_ids)
            instance.systems.set(systems_qs)
        return instance


class ProjectCreateSerializer(serializers.ModelSerializer):
    """Serializer für Projekterstellung"""

    # Accept a list of system IDs on write
    systems = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'name', 'customer', 'systems', 'description', 'status',
            'responsible_employee',
            'forecast_date', 'forecast_revenue', 'forecast_probability',
            'demo_date_from', 'demo_date_to',
            'tender_bidder_questions_deadline', 'tender_submission_deadline', 'tender_award_deadline',
            'planned_delivery_date', 'planned_installation_date',
            'created_at'
        ]
        read_only_fields = ['id', 'project_number', 'created_at']

    def validate_customer(self, value):
        """Prüfe, ob Kunde existiert und aktiv ist"""
        if not value.is_active:
            raise serializers.ValidationError("Der ausgewählte Kunde ist nicht aktiv.")
        return value

    def validate_systems(self, value):
        """Validate incoming list of system IDs and ensure they exist."""
        if not value:
            return []

        ids = []
        for x in value:
            try:
                ids.append(int(x))
            except (TypeError, ValueError):
                raise serializers.ValidationError(f"Ungültiger System-Wert: {x}")

        existing = set(System.objects.filter(id__in=ids).values_list('id', flat=True))
        missing = [i for i in ids if i not in existing]
        if missing:
            raise serializers.ValidationError(f"Ungültige System-ID(s): {missing}")

        return ids

    def create(self, validated_data):
        """Erstelle Projekt mit automatischer Projektnummer und Status 'NEU'."""
        systems_ids = validated_data.pop('systems', [])

        # Extract created_by from validated_data if provided, otherwise use request user
        created_by = validated_data.pop('created_by', None)
        if not created_by and self.context.get('request'):
            created_by = getattr(self.context['request'], 'user', None)

        # Ensure new projects default to status 'NEU' unless provided
        status = validated_data.pop('status', None) or 'NEU'

        project = Project.objects.create(created_by=created_by, status=status, **validated_data)

        if systems_ids:
            systems_qs = System.objects.filter(id__in=systems_ids)
            project.systems.set(systems_qs)
        return project
