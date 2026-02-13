from rest_framework import serializers
from .models import (
    Dealer, DealerDocument, DealerEmployee, 
    DealerCustomerSystem, DealerCustomerSystemTicket,
    DealerPriceListLog, DealerQuotationLog
)


class DealerDocumentSerializer(serializers.ModelSerializer):
    """Serializer für Händler-Dokumente"""
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    
    class Meta:
        model = DealerDocument
        fields = [
            'id', 'document_type', 'document_type_display', 'title', 
            'file', 'description', 'uploaded_by', 'uploaded_by_name', 'uploaded_at'
        ]
        read_only_fields = ['uploaded_by', 'uploaded_at']


class DealerEmployeeSerializer(serializers.ModelSerializer):
    """Serializer für Händler-Mitarbeiter"""
    full_name = serializers.CharField(read_only=True)
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    
    class Meta:
        model = DealerEmployee
        fields = [
            'id', 'dealer', 'salutation', 'title', 'first_name', 'last_name', 'full_name',
            'language', 'language_display',
            'phone', 'mobile', 'fax', 'email',
            'street', 'house_number', 'postal_code', 'city', 'country',
            'is_primary', 'is_active', 'notes',
            'created_at', 'updated_at'
        ]


class DealerCustomerSystemTicketSerializer(serializers.ModelSerializer):
    """Serializer für Dealer-Kundensystem-Tickets"""
    ticket_type_display = serializers.CharField(source='get_ticket_type_display', read_only=True)
    service_ticket_number = serializers.CharField(
        source='service_ticket.ticket_number', 
        read_only=True
    )
    
    class Meta:
        model = DealerCustomerSystemTicket
        fields = [
            'id', 'ticket_type', 'ticket_type_display',
            'service_ticket', 'service_ticket_number', 'ticket_reference',
            'description', 'created_at'
        ]


class DealerCustomerSystemSerializer(serializers.ModelSerializer):
    """Serializer für Dealer-Kundensysteme"""
    tickets = DealerCustomerSystemTicketSerializer(many=True, read_only=True)
    
    class Meta:
        model = DealerCustomerSystem
        fields = [
            'id', 'customer_name',
            'customer_street', 'customer_house_number', 
            'customer_postal_code', 'customer_city', 'customer_country',
            'visiview_license_id', 'system_hardware', 'notes',
            'tickets', 'created_at', 'updated_at'
        ]


class DealerPriceListLogSerializer(serializers.ModelSerializer):
    """Serializer für Preislisten-Protokolle"""
    pricelist_type_display = serializers.CharField(source='get_pricelist_type_display', read_only=True)
    sent_by_name = serializers.CharField(source='sent_by.get_full_name', read_only=True)
    
    class Meta:
        model = DealerPriceListLog
        fields = [
            'id', 'pricelist_type', 'pricelist_type_display',
            'sent_date', 'valid_until', 'file', 'notes',
            'sent_by', 'sent_by_name', 'created_at'
        ]
        read_only_fields = ['sent_by', 'created_at']


class DealerQuotationLogSerializer(serializers.ModelSerializer):
    """Serializer für Angebots-Protokolle"""
    sent_by_name = serializers.CharField(source='sent_by.get_full_name', read_only=True)
    
    class Meta:
        model = DealerQuotationLog
        fields = [
            'id', 'quotation', 'quotation_number',
            'sent_date', 'subject', 'notes',
            'sent_by', 'sent_by_name', 'created_at'
        ]
        read_only_fields = ['sent_by', 'created_at']


class DealerListSerializer(serializers.ModelSerializer):
    """Serializer für Händlerliste (reduzierte Daten)"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    payment_terms_display = serializers.CharField(source='get_payment_terms_display', read_only=True)
    employee_count = serializers.SerializerMethodField()
    primary_contact = serializers.SerializerMethodField()
    customer_system_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Dealer
        fields = [
            'id', 'dealer_number', 'company_name',
            'city', 'country', 'status', 'status_display',
            'dealer_discount', 'payment_terms', 'payment_terms_display',
            'language', 'language_display',
            'employee_count', 'primary_contact', 'customer_system_count',
            'created_at', 'updated_at'
        ]
    
    def get_employee_count(self, obj):
        return obj.employees.filter(is_active=True).count()
    
    def get_primary_contact(self, obj):
        primary = obj.employees.filter(is_primary=True, is_active=True).first()
        if primary:
            return {
                'name': primary.full_name,
                'email': primary.email,
                'phone': primary.phone or primary.mobile
            }
        return None
    
    def get_customer_system_count(self, obj):
        return obj.customer_systems.count()


class DealerDetailSerializer(serializers.ModelSerializer):
    """Serializer für Händlerdetails (alle Daten)"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    payment_terms_display = serializers.CharField(source='get_payment_terms_display', read_only=True)
    documents = DealerDocumentSerializer(many=True, read_only=True)
    employees = DealerEmployeeSerializer(many=True, read_only=True)
    customer_systems = DealerCustomerSystemSerializer(many=True, read_only=True)
    pricelist_logs = DealerPriceListLogSerializer(many=True, read_only=True)
    quotation_logs = DealerQuotationLogSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Dealer
        fields = [
            'id', 'dealer_number', 'company_name',
            'street', 'house_number', 'address_supplement',
            'postal_code', 'city', 'state', 'country',
            'status', 'status_display',
            'dealer_discount', 'payment_terms', 'payment_terms_display',
            'notes', 'language', 'language_display',
            'documents', 'employees', 'customer_systems',
            'pricelist_logs', 'quotation_logs',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['dealer_number', 'created_by', 'created_at', 'updated_at']


class DealerCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Bearbeiten von Händlern"""
    employees = DealerEmployeeSerializer(many=True, required=False)
    
    class Meta:
        model = Dealer
        fields = [
            'id', 'dealer_number', 'company_name',
            'street', 'house_number', 'address_supplement',
            'postal_code', 'city', 'state', 'country',
            'status', 'dealer_discount', 'payment_terms',
            'notes', 'language', 'employees'
        ]
        read_only_fields = ['dealer_number']
    
    def create(self, validated_data):
        employees_data = validated_data.pop('employees', [])
        dealer = Dealer.objects.create(**validated_data)
        
        for employee_data in employees_data:
            DealerEmployee.objects.create(dealer=dealer, **employee_data)
        
        return dealer
    
    def update(self, instance, validated_data):
        employees_data = validated_data.pop('employees', None)
        
        # Update dealer fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update employees if provided
        if employees_data is not None:
            # Delete existing employees that are not in the new data
            existing_ids = [emp.get('id') for emp in employees_data if emp.get('id')]
            instance.employees.exclude(id__in=existing_ids).delete()
            
            for employee_data in employees_data:
                employee_id = employee_data.pop('id', None)
                if employee_id:
                    DealerEmployee.objects.filter(id=employee_id, dealer=instance).update(**employee_data)
                else:
                    DealerEmployee.objects.create(dealer=instance, **employee_data)
        
        return instance
