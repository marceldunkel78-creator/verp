from rest_framework import serializers
from .models import Project
from systems.models import System


class ProjectListSerializer(serializers.ModelSerializer):
    """Serializer für Projektliste"""
    customer_name = serializers.CharField(source='customer.__str__', read_only=True)
    systems_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'name', 'customer', 'customer_name',
            'description', 'status', 'status_display', 'systems_count',
            'forecast_date', 'forecast_revenue', 'forecast_probability',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['project_number', 'created_at', 'updated_at']

    def get_systems_count(self, obj):
        return obj.systems.count()


class ProjectDetailSerializer(serializers.ModelSerializer):
    """Serializer für Projektdetails mit allen Informationen"""
    # Writeable list of system IDs
    systems = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)
    customer_name = serializers.CharField(source='customer.__str__', read_only=True)
    customer_number = serializers.CharField(source='customer.customer_number', read_only=True)
    systems_data = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.__str__', read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'name', 'customer', 'customer_name',
            'customer_number', 'systems', 'systems_data', 'description',
            'status', 'status_display',
            'forecast_date', 'forecast_revenue', 'forecast_probability',
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
                'system_name': sys.system_name,
                'customer_name': str(sys.customer) if sys.customer else None,
            }
            for sys in systems
        ]

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
            'forecast_date', 'forecast_revenue', 'forecast_probability', 'created_at'
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
