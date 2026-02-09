from datetime import date
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
            'is_primary', 'is_outdated', 'position', 'uploaded_by', 'created_at'
        ]
        read_only_fields = ['id', 'uploaded_by', 'created_at']
    
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            # Use MEDIA_BASE_URL if configured, otherwise build from request
            from django.conf import settings
            if hasattr(settings, 'MEDIA_BASE_URL') and settings.MEDIA_BASE_URL:
                return settings.MEDIA_BASE_URL + obj.image.url
            elif request:
                return request.build_absolute_uri(obj.image.url)
            else:
                return obj.image.url
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
            'category_display', 'notes', 'is_legacy', 'created_at', 'updated_at'
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
    location_full = serializers.SerializerMethodField()
    responsible_employee_name = serializers.SerializerMethodField()
    last_contact_date = serializers.SerializerMethodField()
    contact_overdue = serializers.SerializerMethodField()
    visiview_license_serial = serializers.SerializerMethodField()
    
    class Meta:
        model = System
        fields = [
            'id', 'system_number', 'system_name', 'customer', 'customer_name',
            'description', 'status', 'status_display', 'model_organism', 'research_field', 'location', 'location_full',
            'location_university', 'location_institute', 'location_department',
            'location_street', 'location_house_number', 'location_address_supplement',
            'location_postal_code', 'location_city', 'location_country',
            'location_latitude', 'location_longitude',
            'installation_date', 'component_count', 'photo_count', 'primary_photo_url', 
            'service_ticket_count', 'project_count', 'responsible_employee', 
            'responsible_employee_name', 'last_contact_date', 'contact_overdue',
            'visiview_license_serial', 'created_at'
        ]
    
    def get_responsible_employee_name(self, obj):
        if obj.responsible_employee:
            emp = obj.responsible_employee
            return f"{emp.first_name} {emp.last_name}".strip() or emp.employee_number
        return None
    
    def get_location_full(self, obj):
        """Gibt die vollständige Standortadresse als String zurück"""
        parts = []
        if obj.location:
            parts.append(obj.location)
        if obj.location_university:
            parts.append(obj.location_university)
        if obj.location_institute:
            parts.append(obj.location_institute)
        if obj.location_street and obj.location_house_number:
            parts.append(f"{obj.location_street} {obj.location_house_number}")
        elif obj.location_street:
            parts.append(obj.location_street)
        if obj.location_postal_code and obj.location_city:
            parts.append(f"{obj.location_postal_code} {obj.location_city}")
        elif obj.location_city:
            parts.append(obj.location_city)
        return ', '.join(parts) if parts else None
    
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
            Q(systems=obj) |
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

    def get_last_contact_date(self, obj):
        """Liefert das Datum des letzten Kontakteintrags"""
        from customers.models import ContactHistory, CustomerSystem
        
        # ContactHistory ist mit CustomerSystem verknüpft, nicht mit systems.System
        # Daher müssen wir über die system_number oder den Kunden suchen
        last_contact = None
        
        # Suche nach CustomerSystem mit gleicher system_number
        try:
            customer_system = CustomerSystem.objects.get(system_number=obj.system_number)
            last_contact = ContactHistory.objects.filter(
                system=customer_system
            ).order_by('-contact_date').first()
        except CustomerSystem.DoesNotExist:
            pass
        
        # Auch Kunden-Kontakte ohne System-Verknüpfung berücksichtigen
        if obj.customer:
            customer_contact = ContactHistory.objects.filter(
                customer=obj.customer,
                system__isnull=True
            ).order_by('-contact_date').first()
            
            if customer_contact:
                if not last_contact or customer_contact.contact_date > last_contact.contact_date:
                    last_contact = customer_contact
        
        return last_contact.contact_date if last_contact else None
    
    def get_contact_overdue(self, obj):
        """Prüft ob der letzte Kontakt > 6 Monate her ist"""
        from customers.models import ContactHistory
        from datetime import date
        from dateutil.relativedelta import relativedelta
        
        last_date = self.get_last_contact_date(obj)
        if not last_date:
            # Kein Kontakt vorhanden - prüfe Installationsdatum oder created_at
            reference_date = obj.installation_date or obj.created_at.date()
            six_months_ago = date.today() - relativedelta(months=6)
            return reference_date < six_months_ago
        
        six_months_ago = date.today() - relativedelta(months=6)
        return last_date < six_months_ago

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

    def get_visiview_license_serial(self, obj):
        """Gibt die Seriennummer der verknüpften VisiView-Lizenz zurück"""
        if obj.visiview_license:
            return obj.visiview_license.serial_number
        return None


class SystemDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für System-Ansicht"""
    customer_name = serializers.SerializerMethodField()
    customer_data = serializers.SerializerMethodField()
    customer_details = serializers.SerializerMethodField()
    customer_address = serializers.SerializerMethodField()
    visiview_license_details = serializers.SerializerMethodField()
    responsible_employee_details = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    components = SystemComponentSerializer(many=True, read_only=True)
    photos = SystemPhotoSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    location_full = serializers.SerializerMethodField()
    last_contact_date = serializers.SerializerMethodField()
    contact_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = System
        fields = [
            'id', 'system_number', 'system_name', 'customer', 'customer_name',
            'customer_data', 'customer_details', 'customer_address', 'description', 'status', 'status_display',
            'model_organism', 'research_field',
            'location', 'location_full',
            'location_university', 'location_institute', 'location_department',
            'location_street', 'location_house_number', 'location_address_supplement',
            'location_postal_code', 'location_city', 'location_country',
            'location_latitude', 'location_longitude',
            'installation_date', 'notes',
            'visiview_license', 'visiview_license_details',
            'responsible_employee', 'responsible_employee_details',
            'components', 'photos', 'created_by', 'created_by_name',
            'created_at', 'updated_at',
            'last_contact_date', 'contact_overdue'
        ]
        read_only_fields = ['id', 'system_number', 'created_by', 'created_at', 'updated_at']
    
    def get_location_full(self, obj):
        """Gibt die vollständige Standortadresse als String zurück"""
        parts = []
        if obj.location:
            parts.append(obj.location)
        if obj.location_university:
            parts.append(obj.location_university)
        if obj.location_institute:
            parts.append(obj.location_institute)
        if obj.location_street and obj.location_house_number:
            parts.append(f"{obj.location_street} {obj.location_house_number}")
        elif obj.location_street:
            parts.append(obj.location_street)
        if obj.location_postal_code and obj.location_city:
            parts.append(f"{obj.location_postal_code} {obj.location_city}")
        elif obj.location_city:
            parts.append(obj.location_city)
        return ', '.join(parts) if parts else None
    
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
    
    def get_customer_details(self, obj):
        if obj.customer:
            cust = obj.customer
            parts = [cust.title or '', cust.first_name or '', cust.last_name or '']
            name = ' '.join([p for p in parts if p]).strip()
            return {
                'id': cust.id,
                'customer_number': getattr(cust, 'customer_number', None),
                'full_name': name,
                'first_name': getattr(cust, 'first_name', None),
                'last_name': getattr(cust, 'last_name', None),
            }
        return None
    
    def get_customer_address(self, obj):
        """Gibt die primäre Adresse des Kunden zurück (Office/Labor)"""
        if not obj.customer:
            return None
        
        # Versuche zuerst Office, dann Labor Adresse zu finden
        address = obj.customer.addresses.filter(
            is_active=True,
            address_type__in=['Office', 'Labor']
        ).order_by('address_type').first()
        
        if not address:
            # Fallback auf erste aktive Adresse
            address = obj.customer.addresses.filter(is_active=True).first()
        
        if address:
            return {
                'id': address.id,
                'address_type': address.address_type,
                'university': address.university,
                'institute': address.institute,
                'department': address.department,
                'street': address.street,
                'house_number': address.house_number,
                'address_supplement': address.address_supplement,
                'postal_code': address.postal_code,
                'city': address.city,
                'country': address.country,
            }
        return None
    
    def get_visiview_license_details(self, obj):
        if obj.visiview_license:
            lic = obj.visiview_license
            return {
                'id': lic.id,
                'license_number': lic.license_number,
                'serial_number': lic.serial_number,
                'version': lic.version or '',
                'status': lic.status,
            }
        return None
    
    def get_responsible_employee_details(self, obj):
        if obj.responsible_employee:
            emp = obj.responsible_employee
            return {
                'id': emp.id,
                'employee_id': emp.employee_id,
                'full_name': f"{emp.first_name} {emp.last_name}",
                'first_name': emp.first_name,
                'last_name': emp.last_name,
                'department': emp.department,
            }
        return None

    def get_last_contact_date(self, obj):
        """Gibt das Datum des letzten Kontakts zurück"""
        from customers.models import ContactHistory, CustomerSystem
        
        # ContactHistory ist mit CustomerSystem verknüpft, nicht mit systems.System
        # Daher müssen wir über die system_number oder den Kunden suchen
        system_contact = None
        
        # Suche nach CustomerSystem mit gleicher system_number
        try:
            customer_system = CustomerSystem.objects.get(system_number=obj.system_number)
            system_contact = ContactHistory.objects.filter(
                system=customer_system
            ).order_by('-contact_date').first()
        except CustomerSystem.DoesNotExist:
            pass
        
        # Prüfe auch ContactHistory für den Kunden (ohne System-Bezug)
        customer_contact = None
        if obj.customer:
            customer_contact = ContactHistory.objects.filter(
                customer=obj.customer,
                system__isnull=True
            ).order_by('-contact_date').first()
        
        # Nimm das neueste Datum
        dates = []
        if system_contact:
            dates.append(system_contact.contact_date)
        if customer_contact:
            dates.append(customer_contact.contact_date)
        
        if dates:
            return max(dates)
        
        # Fallback: Installationsdatum oder Erstellungsdatum
        if obj.installation_date:
            return obj.installation_date
        return obj.created_at.date() if obj.created_at else None

    def get_contact_overdue(self, obj):
        """Prüft ob der letzte Kontakt länger als 6 Monate her ist"""
        from dateutil.relativedelta import relativedelta
        
        last_contact = self.get_last_contact_date(obj)
        if not last_contact:
            return True  # Kein Kontakt = überfällig
        
        six_months_ago = date.today() - relativedelta(months=6)
        return last_contact < six_months_ago


class SystemCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für System erstellen/bearbeiten"""
    components = SystemComponentSerializer(many=True, required=False)
    
    class Meta:
        model = System
        fields = [
            'id', 'system_number', 'system_name', 'customer', 'description',
            'status', 'model_organism', 'research_field', 'location', 
            'location_university', 'location_institute', 'location_department',
            'location_street', 'location_house_number', 'location_address_supplement',
            'location_postal_code', 'location_city', 'location_country',
            'location_latitude', 'location_longitude',
            'installation_date', 'notes', 'visiview_license', 'responsible_employee', 'components'
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
