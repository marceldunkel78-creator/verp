from rest_framework import serializers
from .models import System, SystemComponent, SystemPhoto
from customers.models import Customer


class SystemPhotoSerializer(serializers.ModelSerializer):
    """Serializer für Systemfotos"""
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = SystemPhoto
        fields = [
            'id', 'system', 'image', 'image_url', 'title', 'description',
            'is_primary', 'position', 'uploaded_by', 'created_at'
        ]
        read_only_fields = ['id', 'uploaded_by', 'created_at']
    
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


class SystemComponentSerializer(serializers.ModelSerializer):
    """Serializer für Systemkomponenten"""
    inventory_item_name = serializers.CharField(
        source='inventory_item.name',
        read_only=True
    )
    category_display = serializers.CharField(
        source='get_category_display',
        read_only=True
    )
    component_type_display = serializers.CharField(
        source='get_component_type_display',
        read_only=True
    )
    
    class Meta:
        model = SystemComponent
        fields = [
            'id', 'system', 'position', 'inventory_item', 'inventory_item_name',
            'component_type', 'component_type_display', 'name', 'description',
            'manufacturer', 'serial_number', 'version', 'category',
            'category_display', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SystemListSerializer(serializers.ModelSerializer):
    """Kompakter Serializer für Systemliste"""
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    component_count = serializers.SerializerMethodField()
    photo_count = serializers.SerializerMethodField()
    primary_photo_url = serializers.SerializerMethodField()
    service_ticket_count = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()
    
    class Meta:
        model = System
        fields = [
            'id', 'system_number', 'system_name', 'customer', 'customer_name',
            'description', 'status', 'status_display', 'location', 'installation_date',
            'component_count', 'photo_count', 'primary_photo_url', 
            'service_ticket_count', 'project_count', 'created_at'
        ]
    
    def get_component_count(self, obj):
        return obj.components.count()
    
    def get_photo_count(self, obj):
        return obj.photos.count()
    
    def get_service_ticket_count(self, obj):
        from service.models import ServiceTicket
        from django.db.models import Q
        return ServiceTicket.objects.filter(
            Q(linked_system=obj) |
            Q(customer=obj.customer, description__icontains=obj.system_number)
        ).distinct().count()
    
    def get_project_count(self, obj):
        from projects.models import Project
        from django.db.models import Q
        return Project.objects.filter(
            Q(linked_system=obj) |
            Q(customer=obj.customer, description__icontains=obj.system_number)
        ).distinct().count()
    
    def get_primary_photo_url(self, obj):
        request = self.context.get('request')
        primary = obj.photos.filter(is_primary=True).first()
        if not primary:
            primary = obj.photos.first()
        if primary and primary.image and request:
            return request.build_absolute_uri(primary.image.url)
        return None

    def get_customer_name(self, obj):
        cust = obj.customer
        if not cust:
            return None
        # Compose display name from available fields
        parts = [cust.title or '', cust.first_name or '', cust.last_name or '']
        name = ' '.join([p for p in parts if p]).strip()
        if cust.customer_number:
            return f"{cust.customer_number} - {name}" if name else cust.customer_number
        return name or None


class SystemDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für System-Ansicht"""
    customer_name = serializers.SerializerMethodField()
    customer_data = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    components = SystemComponentSerializer(many=True, read_only=True)
    photos = SystemPhotoSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    
    class Meta:
        model = System
        fields = [
            'id', 'system_number', 'system_name', 'customer', 'customer_name',
            'customer_data', 'description', 'status', 'status_display',
            'location', 'installation_date', 'warranty_end', 'notes',
            'components', 'photos', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'system_number', 'created_by', 'created_at', 'updated_at']
    
    def get_customer_data(self, obj):
        if obj.customer:
            cust = obj.customer
            parts = [cust.title or '', cust.first_name or '', cust.last_name or '']
            name = ' '.join([p for p in parts if p]).strip()
            return {
                'id': cust.id,
                'display_name': f"{cust.customer_number} - {name}" if getattr(cust, 'customer_number', None) else name,
                'first_name': getattr(cust, 'first_name', None),
                'last_name': getattr(cust, 'last_name', None),
            }
        return None

    def get_customer_name(self, obj):
        cust = obj.customer
        if not cust:
            return None
        parts = [cust.title or '', cust.first_name or '', cust.last_name or '']
        name = ' '.join([p for p in parts if p]).strip()
        return f"{cust.customer_number} - {name}" if getattr(cust, 'customer_number', None) else name


class SystemCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für System erstellen/bearbeiten"""
    components = SystemComponentSerializer(many=True, required=False)
    
    class Meta:
        model = System
        fields = [
            'id', 'system_number', 'system_name', 'customer', 'description',
            'status', 'location', 'installation_date', 'warranty_end',
            'notes', 'components'
        ]
        read_only_fields = ['id', 'system_number']
    
    def create(self, validated_data):
        components_data = validated_data.pop('components', [])
        system = System.objects.create(**validated_data)
        
        for idx, component_data in enumerate(components_data):
            component_data['position'] = idx + 1
            SystemComponent.objects.create(system=system, **component_data)
        
        return system
    
    def update(self, instance, validated_data):
        components_data = validated_data.pop('components', None)
        
        # Update System fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update components if provided
        if components_data is not None:
            # Get existing component IDs
            existing_ids = set(instance.components.values_list('id', flat=True))
            updated_ids = set()
            
            for idx, component_data in enumerate(components_data):
                component_id = component_data.get('id')
                component_data['position'] = idx + 1
                
                if component_id and component_id in existing_ids:
                    # Update existing component
                    component = SystemComponent.objects.get(id=component_id)
                    for attr, value in component_data.items():
                        if attr != 'id':
                            setattr(component, attr, value)
                    component.save()
                    updated_ids.add(component_id)
                else:
                    # Create new component
                    if 'id' in component_data:
                        del component_data['id']
                    new_component = SystemComponent.objects.create(
                        system=instance,
                        **component_data
                    )
                    updated_ids.add(new_component.id)
            
            # Delete removed components
            to_delete = existing_ids - updated_ids
            if to_delete:
                SystemComponent.objects.filter(id__in=to_delete).delete()
        
        return instance


class CustomerSimpleSerializer(serializers.ModelSerializer):
    """Einfacher Serializer für Kunden-Dropdown"""
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'customer_number', 'title', 'first_name', 'last_name', 'display_name']

    def get_display_name(self, obj):
        parts = [obj.title or '', obj.first_name or '', obj.last_name or '']
        name = ' '.join([p for p in parts if p]).strip()
        if getattr(obj, 'customer_number', None):
            return f"{obj.customer_number} - {name}" if name else obj.customer_number
        return name
