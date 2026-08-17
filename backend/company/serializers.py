from rest_framework import serializers
from .models import CompanySettings


class CompanySettingsSerializer(serializers.ModelSerializer):
    """Serializer für Firmeneinstellungen"""
    
    class Meta:
        model = CompanySettings
        fields = [
            'id', 'company_name', 
            'street', 'house_number', 'postal_code', 'city', 'country',
            'phone', 'fax', 'email', 'website',
            'bank_name', 'iban', 'bic',
            'managing_director', 'commercial_register', 'register_court',
            'tax_number', 'vat_id',
            'document_header',
            'fiscal_year_start_month', 'fiscal_year_start_day', 'default_hourly_rate', 'default_admin_fee',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
