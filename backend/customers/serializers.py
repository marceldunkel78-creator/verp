from rest_framework import serializers
from .models import Customer, CustomerAddress, CustomerPhone, CustomerEmail


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
    primary_email = serializers.SerializerMethodField()
    primary_phone = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'customer_number', 'title', 'first_name', 'last_name',
            'full_name', 'language', 'language_display',
            'primary_email', 'primary_phone', 'is_active',
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


class CustomerDetailSerializer(serializers.ModelSerializer):
    """Serializer für Kundendetails (alle Daten)"""
    full_name = serializers.SerializerMethodField()
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    addresses = CustomerAddressSerializer(many=True, read_only=True)
    phones = CustomerPhoneSerializer(many=True, read_only=True)
    emails = CustomerEmailSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Customer
        fields = [
            'id', 'customer_number', 'title', 'first_name', 'last_name',
            'full_name', 'language', 'language_display',
            'addresses', 'phones', 'emails',
            'notes', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'customer_number', 'created_by', 'created_at', 'updated_at']
    
    def get_full_name(self, obj):
        return f"{obj.title} {obj.first_name} {obj.last_name}".strip()


class CustomerCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Kundenerstellung/-aktualisierung mit verschachtelten Objekten"""
    addresses = CustomerAddressSerializer(many=True, required=False)
    phones = CustomerPhoneSerializer(many=True, required=False)
    emails = CustomerEmailSerializer(many=True, required=False)
    
    class Meta:
        model = Customer
        fields = [
            'title', 'first_name', 'last_name', 'language',
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
        
        # Update Addresses
        if addresses_data is not None:
            instance.addresses.all().delete()
            for address_data in addresses_data:
                CustomerAddress.objects.create(customer=instance, **address_data)
        
        # Update Phones
        if phones_data is not None:
            instance.phones.all().delete()
            for phone_data in phones_data:
                CustomerPhone.objects.create(customer=instance, **phone_data)
        
        # Update Emails
        if emails_data is not None:
            instance.emails.all().delete()
            for email_data in emails_data:
                CustomerEmail.objects.create(customer=instance, **email_data)
        
        return instance
