from django.contrib import admin
from .models import (
    ExchangeRate, CompanySettings, CompanyAddress, CompanyManager, 
    CompanyBankAccount, PaymentTerm, DeliveryTerm, WarrantyTerm
)


class CompanyAddressInline(admin.TabularInline):
    model = CompanyAddress
    extra = 1
    fields = ['address_type', 'street', 'house_number', 'postal_code', 'city', 'state', 'country', 'is_primary']


class CompanyManagerInline(admin.TabularInline):
    model = CompanyManager
    extra = 1
    fields = ['title', 'first_name', 'last_name', 'position', 'email', 'phone']


class CompanyBankAccountInline(admin.TabularInline):
    model = CompanyBankAccount
    extra = 1
    fields = ['bank_name', 'account_holder', 'iban', 'bic', 'currency', 'is_primary']


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Grunddaten', {
            'fields': ('company_name',)
        }),
        ('Kontaktinformationen', {
            'fields': ('email_orders', 'email_general', 'email_service', 'email_sales', 'phone_central', 'website')
        }),
        ('Registrierungen', {
            'fields': ('trade_register_number', 'professional_association', 'vat_id')
        }),
        ('Zeitstempel', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['created_at', 'updated_at']
    inlines = [CompanyAddressInline, CompanyManagerInline, CompanyBankAccountInline]
    
    def has_add_permission(self, request):
        # Only allow one CompanySettings instance
        return not CompanySettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion of the singleton
        return False


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ['currency', 'rate_to_eur', 'last_updated']
    search_fields = ['currency']
    readonly_fields = ['last_updated']


@admin.register(PaymentTerm)
class PaymentTermAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_prepayment', 'payment_days', 'discount_percent', 'is_active']
    list_filter = ['is_active', 'is_prepayment']
    search_fields = ['name']


@admin.register(DeliveryTerm)
class DeliveryTermAdmin(admin.ModelAdmin):
    list_display = ['incoterm', 'is_active']
    list_filter = ['is_active']


@admin.register(WarrantyTerm)
class WarrantyTermAdmin(admin.ModelAdmin):
    list_display = ['name', 'duration_months', 'is_default', 'is_active']
    list_filter = ['is_active', 'is_default']
    search_fields = ['name', 'description']
    fieldsets = (
        (None, {
            'fields': ('name', 'name_en', 'duration_months')
        }),
        ('Beschreibung', {
            'fields': ('description', 'description_en')
        }),
        ('Status', {
            'fields': ('is_active', 'is_default')
        }),
    )
