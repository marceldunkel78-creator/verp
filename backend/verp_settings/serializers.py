from rest_framework import serializers
from .models import (
    ExchangeRate, CompanySettings, CompanyAddress,
    CompanyManager, CompanyBankAccount, PaymentTerm,
    DeliveryTerm, DeliveryInstruction, ProductCategory
)


class CompanyAddressSerializer(serializers.ModelSerializer):
    """Serializer für Firmenadressen"""
    
    class Meta:
        model = CompanyAddress
        fields = [
            'id', 'address_type', 'street', 'house_number', 'address_supplement',
            'postal_code', 'city', 'state', 'country', 'is_primary'
        ]


class CompanyManagerSerializer(serializers.ModelSerializer):
    """Serializer für Geschäftsführer"""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CompanyManager
        fields = [
            'id', 'title', 'first_name', 'last_name', 'full_name',
            'position', 'email', 'phone'
        ]
    
    def get_full_name(self, obj):
        name_parts = []
        if obj.title:
            name_parts.append(obj.title)
        name_parts.extend([obj.first_name, obj.last_name])
        return ' '.join(name_parts)


class CompanyBankAccountSerializer(serializers.ModelSerializer):
    """Serializer für Bankverbindungen"""
    
    class Meta:
        model = CompanyBankAccount
        fields = [
            'id', 'bank_name', 'account_holder', 'iban', 'bic',
            'currency', 'is_primary', 'notes'
        ]


class CompanySettingsSerializer(serializers.ModelSerializer):
    """Serializer für Firmeneinstellungen mit allen Related Objects"""
    addresses = CompanyAddressSerializer(many=True, read_only=True)
    managers = CompanyManagerSerializer(many=True, read_only=True)
    bank_accounts = CompanyBankAccountSerializer(many=True, read_only=True)
    
    class Meta:
        model = CompanySettings
        fields = [
            'id', 'company_name',
            'email_orders', 'email_general', 'email_service', 'email_sales',
            'phone_central', 'website',
            'trade_register_number', 'professional_association', 'vat_id',
            'addresses', 'managers', 'bank_accounts',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CompanySettingsUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Update der Firmeneinstellungen"""
    addresses = CompanyAddressSerializer(many=True, required=False)
    managers = CompanyManagerSerializer(many=True, required=False)
    bank_accounts = CompanyBankAccountSerializer(many=True, required=False)
    
    class Meta:
        model = CompanySettings
        fields = [
            'company_name',
            'email_orders', 'email_general', 'email_service', 'email_sales',
            'phone_central', 'website',
            'trade_register_number', 'professional_association', 'vat_id',
            'addresses', 'managers', 'bank_accounts'
        ]
    
    def update(self, instance, validated_data):
        # Extrahiere nested data
        addresses_data = validated_data.pop('addresses', None)
        managers_data = validated_data.pop('managers', None)
        bank_accounts_data = validated_data.pop('bank_accounts', None)
        
        # Update main fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update addresses
        if addresses_data is not None:
            # Lösche alte Adressen
            instance.addresses.all().delete()
            # Erstelle neue
            for addr_data in addresses_data:
                CompanyAddress.objects.create(company_settings=instance, **addr_data)
        
        # Update managers
        if managers_data is not None:
            instance.managers.all().delete()
            for mgr_data in managers_data:
                CompanyManager.objects.create(company_settings=instance, **mgr_data)
        
        # Update bank accounts
        if bank_accounts_data is not None:
            instance.bank_accounts.all().delete()
            for bank_data in bank_accounts_data:
                CompanyBankAccount.objects.create(company_settings=instance, **bank_data)
        
        return instance


class ExchangeRateSerializer(serializers.ModelSerializer):
    """Serializer für Wechselkurse"""
    
    class Meta:
        model = ExchangeRate
        fields = ['id', 'currency', 'rate_to_eur', 'last_updated']
        read_only_fields = ['id', 'last_updated']


class PaymentTermSerializer(serializers.ModelSerializer):
    """Serializer für Zahlungsbedingungen"""
    formatted_terms = serializers.CharField(source='get_formatted_terms', read_only=True)
    
    class Meta:
        model = PaymentTerm
        fields = [
            'id', 'name', 'is_prepayment', 'payment_days',
            'discount_days', 'discount_percent',
            'has_custom_terms', 'down_payment_percent', 'down_payment_description',
            'delivery_payment_percent', 'delivery_payment_description',
            'acceptance_payment_percent', 'acceptance_payment_description',
            'notes', 'is_active', 'formatted_terms',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DeliveryTermSerializer(serializers.ModelSerializer):
    """Serializer für Lieferbedingungen (Incoterms)"""
    incoterm_display = serializers.CharField(source='get_incoterm_display', read_only=True)
    
    class Meta:
        model = DeliveryTerm
        fields = [
            'id', 'incoterm', 'incoterm_display', 'is_active',
            'description', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DeliveryInstructionSerializer(serializers.ModelSerializer):
    """Serializer für Lieferanweisungen"""
    
    class Meta:
        model = DeliveryInstruction
        fields = [
            'id', 'name', 'instruction_text', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductCategorySerializer(serializers.ModelSerializer):
    """Serializer für Warenkategorien"""
    code_display = serializers.CharField(source='get_code_display', read_only=True)
    
    class Meta:
        model = ProductCategory
        fields = [
            'id', 'code', 'code_display', 'name', 'description',
            'applies_to_trading_goods', 'applies_to_material_supplies',
            'applies_to_vs_hardware', 'applies_to_vs_software', 'applies_to_vs_service',
            'requires_serial_number', 'is_active', 'sort_order',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
