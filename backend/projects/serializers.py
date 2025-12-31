from rest_framework import serializers
from .models import Project
from customers.models import Customer, CustomerSystem


class ProjectListSerializer(serializers.ModelSerializer):
    """Serializer für Projektliste"""
    customer_name = serializers.CharField(source='customer.__str__', read_only=True)
    systems_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    linked_system_name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'name', 'customer', 'customer_name',
            'description', 'status', 'status_display', 'systems_count',
            'linked_system', 'linked_system_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['project_number', 'created_at', 'updated_at']

    def get_systems_count(self, obj):
        return obj.systems.count()
    
    def get_linked_system_name(self, obj):
        if obj.linked_system:
            return f"{obj.linked_system.system_number} - {obj.linked_system.system_name}"
        return None


class ProjectDetailSerializer(serializers.ModelSerializer):
    """Serializer für Projektdetails mit allen Informationen"""
    customer_name = serializers.CharField(source='customer.__str__', read_only=True)
    customer_number = serializers.CharField(source='customer.customer_number', read_only=True)
    systems_data = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.__str__', read_only=True)
    linked_system_name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'name', 'customer', 'customer_name',
            'customer_number', 'systems', 'systems_data', 'description',
            'status', 'status_display', 'linked_system', 'linked_system_name',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['project_number', 'created_by', 'created_at', 'updated_at']

    def get_systems_data(self, obj):
        """Hole alle System-Details"""
        systems = obj.systems.all()
        return [
            {
                'id': sys.id,
                'system_number': sys.system_number,
                'name': sys.name,
                'type': sys.system_type,
            }
            for sys in systems
        ]
    
    def get_linked_system_name(self, obj):
        if obj.linked_system:
            return f"{obj.linked_system.system_number} - {obj.linked_system.system_name}"
        return None


class ProjectCreateSerializer(serializers.ModelSerializer):
    """Serializer für Projekterstellung"""

    class Meta:
        model = Project
        fields = ['name', 'customer', 'systems', 'linked_system', 'description']

    def validate_customer(self, value):
        """Prüfe, ob Kunde existiert und aktiv ist"""
        if not value.is_active:
            raise serializers.ValidationError("Der ausgewählte Kunde ist nicht aktiv.")
        return value

    def validate_systems(self, value):
        """Prüfe, ob alle Systeme zum Kunden gehören"""
        if not value:
            return value
        
        customer_id = self.initial_data.get('customer')
        if customer_id:
            invalid_systems = [sys for sys in value if sys.customer_id != int(customer_id)]
            if invalid_systems:
                raise serializers.ValidationError(
                    "Alle ausgewählten Systeme müssen zum gewählten Kunden gehören."
                )
        return value

    def create(self, validated_data):
        """Erstelle Projekt mit automatischer Projektnummer und Status 'NEU'"""
        systems = validated_data.pop('systems', [])
        project = Project.objects.create(**validated_data)
        if systems:
            project.systems.set(systems)
        return project
