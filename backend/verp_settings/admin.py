from django.contrib import admin
from .models import ExchangeRate, CompanySettings, CompanyAddress, CompanyManager, CompanyBankAccount


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
