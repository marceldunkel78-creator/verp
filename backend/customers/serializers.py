from rest_framework import serializers
from .models import Customer, CustomerAddress, CustomerPhone, CustomerEmail, ContactHistory, CustomerSystem, CustomerLegacyMapping


class CustomerAddressSerializer(serializers.ModelSerializer):
    """Serializer für Kundenadressen"""
    address_type_display = serializers.CharField(source='get_address_type_display', read_only=True)
    
    class Meta:
        model = CustomerAddress
        fields = [
            'id', 'address_type', 'address_type_display', 'is_active',
            'university', 'institute', 'department',
            'street', 'house_number', 'address_supplement',
            'postal_code', 'city', 'state', 'country',
            'directions', 'latitude', 'longitude',
            'created_at', 'updated_at'
        ]


class CustomerPhoneSerializer(serializers.ModelSerializer):
    """Serializer für Telefonnummern"""
    
    class Meta:
        model = CustomerPhone
        fields = ['id', 'phone_type', 'phone_number', 'is_primary']


class CustomerEmailSerializer(serializers.ModelSerializer):
    """Serializer für E-Mail-Adressen"""
    
    class Meta:
        model = CustomerEmail
        fields = ['id', 'email', 'is_primary', 'newsletter_consent', 'marketing_consent']


class CustomerListSerializer(serializers.ModelSerializer):
    """Serializer für Kundenliste (reduzierte Daten)"""
    full_name = serializers.SerializerMethodField()
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    advertising_status_display = serializers.CharField(source='get_advertising_status_display', read_only=True)
    responsible_user_name = serializers.CharField(source='responsible_user.get_full_name', read_only=True)
    primary_email = serializers.SerializerMethodField()
    primary_phone = serializers.SerializerMethodField()
    primary_address_city = serializers.SerializerMethodField()
    primary_address_country = serializers.SerializerMethodField()
    primary_address_latitude = serializers.SerializerMethodField()
    primary_address_longitude = serializers.SerializerMethodField()
    system_count = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()
    open_ticket_count = serializers.SerializerMethodField()
    legacy_sql_ids = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'customer_number', 'legacy_sql_id', 'legacy_sql_ids', 'salutation', 'title', 'first_name', 'last_name',
            'full_name', 'language', 'language_display',
            'advertising_status', 'advertising_status_display',
            'is_reference', 'responsible_user', 'responsible_user_name',
            'primary_email', 'primary_phone', 'is_active',
            'primary_address_city', 'primary_address_country',
            'primary_address_latitude', 'primary_address_longitude',
            'system_count', 'project_count', 'open_ticket_count',
            'created_at', 'updated_at'
        ]
    
    def get_full_name(self, obj):
        return f"{obj.title} {obj.first_name} {obj.last_name}".strip()
    
    def get_primary_email(self, obj):
        primary = obj.emails.filter(is_primary=True).first()
        return primary.email if primary else None
    
    def get_primary_phone(self, obj):
        primary = obj.phones.filter(is_primary=True).first()
        return primary.phone_number if primary else None
    
    def get_primary_address_city(self, obj):
        # Get first active address (ordered by is_active DESC, address_type)
        primary = obj.addresses.filter(is_active=True).first()
        return primary.city if primary else None
    
    def get_primary_address_country(self, obj):
        primary = obj.addresses.filter(is_active=True).first()
        return primary.country if primary else None
    
    def get_primary_address_latitude(self, obj):
        primary = obj.addresses.filter(is_active=True).first()
        return str(primary.latitude) if primary and primary.latitude else None
    
    def get_primary_address_longitude(self, obj):
        primary = obj.addresses.filter(is_active=True).first()
        return str(primary.longitude) if primary and primary.longitude else None

    def get_system_count(self, obj):
        # system_records is the related_name from systems.System
        if hasattr(obj, 'system_records'):
            return obj.system_records.count()
        return 0

    def get_project_count(self, obj):
        if hasattr(obj, 'projects'):
            return obj.projects.count()
        return 0

    def get_open_ticket_count(self, obj):
        if hasattr(obj, 'service_tickets'):
            return obj.service_tickets.exclude(status__in=['resolved', 'no_solution']).count()
        return 0

    def get_legacy_sql_ids(self, obj):
        return list(obj.legacy_mappings.values_list('sql_id', flat=True))


class CustomerDetailSerializer(serializers.ModelSerializer):
    """Serializer für Kundendetails (alle Daten)"""
    full_name = serializers.SerializerMethodField()
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    advertising_status_display = serializers.CharField(source='get_advertising_status_display', read_only=True)
    addresses = CustomerAddressSerializer(many=True, read_only=True)
    phones = CustomerPhoneSerializer(many=True, read_only=True)
    emails = CustomerEmailSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    responsible_user_name = serializers.CharField(source='responsible_user.get_full_name', read_only=True)
    legacy_sql_ids = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'customer_number', 'legacy_sql_id', 'legacy_sql_ids', 'salutation', 'title', 'first_name', 'last_name',
            'full_name', 'language', 'language_display',
            'advertising_status', 'advertising_status_display',
            'description', 'is_reference', 'responsible_user', 'responsible_user_name',
            'addresses', 'phones', 'emails',
            'notes', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'customer_number', 'created_by', 'created_at', 'updated_at']
    
    def get_full_name(self, obj):
        return f"{obj.title} {obj.first_name} {obj.last_name}".strip()

    def get_legacy_sql_ids(self, obj):
        return list(obj.legacy_mappings.values_list('sql_id', flat=True))


class CustomerCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Kundenerstellung/-aktualisierung mit verschachtelten Objekten"""
    addresses = CustomerAddressSerializer(many=True, required=False)
    phones = CustomerPhoneSerializer(many=True, required=False)
    emails = CustomerEmailSerializer(many=True, required=False)
    
    class Meta:
        model = Customer
        fields = [
            'salutation', 'title', 'first_name', 'last_name', 'language',
            'advertising_status', 'description', 'is_reference', 'responsible_user',
            'addresses', 'phones', 'emails',
            'notes', 'is_active'
        ]
    
    def create(self, validated_data):
        addresses_data = validated_data.pop('addresses', [])
        phones_data = validated_data.pop('phones', [])
        emails_data = validated_data.pop('emails', [])
        
        customer = Customer.objects.create(**validated_data)
        
        # Adressen erstellen
        for address_data in addresses_data:
            CustomerAddress.objects.create(customer=customer, **address_data)
        
        # Telefonnummern erstellen
        for phone_data in phones_data:
            CustomerPhone.objects.create(customer=customer, **phone_data)
        
        # E-Mails erstellen
        for email_data in emails_data:
            CustomerEmail.objects.create(customer=customer, **email_data)
        
        return customer
    
    def update(self, instance, validated_data):
        addresses_data = validated_data.pop('addresses', None)
        phones_data = validated_data.pop('phones', None)
        emails_data = validated_data.pop('emails', None)
        
        # Update Customer fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update Addresses - preserve existing if they have IDs
        if addresses_data is not None:
            # Track which IDs we're keeping
            incoming_ids = [addr.get('id') for addr in addresses_data if addr.get('id')]
            # Delete addresses not in incoming data
            instance.addresses.exclude(id__in=incoming_ids).delete()
            
            for address_data in addresses_data:
                address_id = address_data.pop('id', None)
                if address_id:
                    # Update existing address
                    CustomerAddress.objects.filter(id=address_id, customer=instance).update(**address_data)
                else:
                    # Create new address
                    CustomerAddress.objects.create(customer=instance, **address_data)
        
        # Update Phones - preserve existing if they have IDs
        if phones_data is not None:
            incoming_ids = [phone.get('id') for phone in phones_data if phone.get('id')]
            instance.phones.exclude(id__in=incoming_ids).delete()
            
            for phone_data in phones_data:
                phone_id = phone_data.pop('id', None)
                if phone_id:
                    CustomerPhone.objects.filter(id=phone_id, customer=instance).update(**phone_data)
                else:
                    CustomerPhone.objects.create(customer=instance, **phone_data)
        
        # Update Emails - preserve existing if they have IDs
        if emails_data is not None:
            incoming_ids = [email.get('id') for email in emails_data if email.get('id')]
            instance.emails.exclude(id__in=incoming_ids).delete()
            
            for email_data in emails_data:
                email_id = email_data.pop('id', None)
                if email_id:
                    CustomerEmail.objects.filter(id=email_id, customer=instance).update(**email_data)
                else:
                    CustomerEmail.objects.create(customer=instance, **email_data)
        
        return instance


class ContactHistorySerializer(serializers.ModelSerializer):
    """Serializer für Kontakthistorie"""
    contact_type_display = serializers.CharField(source='get_contact_type_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    system_name = serializers.SerializerMethodField()
    system_number = serializers.CharField(source='system.system_number', read_only=True)
    # Akzeptiert systems.System ID und mappt zu CustomerSystem
    systems_system_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = ContactHistory
        fields = [
            'id', 'customer', 'customer_name', 'system', 'system_name', 'system_number',
            'systems_system_id',
            'contact_date', 'contact_type', 'contact_type_display',
            'comment', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        """Konvertiert systems.System ID zu CustomerSystem"""
        systems_system_id = attrs.pop('systems_system_id', None)
        
        if systems_system_id and not attrs.get('system'):
            # Hole das systems.System und finde/erstelle das entsprechende CustomerSystem
            from systems.models import System as SystemsSystem
            try:
                systems_system = SystemsSystem.objects.get(id=systems_system_id)
                # Suche CustomerSystem mit gleicher system_number
                customer_system = CustomerSystem.objects.filter(
                    system_number=systems_system.system_number
                ).first()
                
                if customer_system:
                    attrs['system'] = customer_system
                    # Stelle sicher, dass der Kunde gesetzt ist
                    if not attrs.get('customer') and customer_system.customer:
                        attrs['customer'] = customer_system.customer
                else:
                    # Kein CustomerSystem gefunden - system bleibt None
                    # aber Customer sollte trotzdem gesetzt werden
                    if not attrs.get('customer') and systems_system.customer:
                        attrs['customer'] = systems_system.customer
            except SystemsSystem.DoesNotExist:
                pass
        
        return attrs
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_customer_name(self, obj):
        if obj.customer:
            return f"{obj.customer.first_name} {obj.customer.last_name}".strip() or obj.customer.customer_number
        return None
    
    def get_system_name(self, obj):
        if obj.system:
            return obj.system.name
        return None
