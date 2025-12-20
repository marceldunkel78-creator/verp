from django.contrib import admin
from .models import CompanySettings


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'city', 'managing_director']
    
    fieldsets = (
        ('Firmeninformationen', {
            'fields': ('company_name',)
        }),
        ('Adresse', {
            'fields': ('street', 'house_number', 'postal_code', 'city', 'country')
        }),
        ('Kontaktdaten', {
            'fields': ('phone', 'fax', 'email', 'website')
        }),
        ('Bankverbindung', {
            'fields': ('bank_name', 'iban', 'bic')
        }),
        ('Rechtliche Informationen', {
            'fields': ('managing_director', 'commercial_register', 'register_court', 'tax_number', 'vat_id')
        }),
        ('Dokumente', {
            'fields': ('document_header',)
        }),
    )
    
    def has_add_permission(self, request):
        # Nur eine Instanz erlauben
        return not CompanySettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Löschen verhindern
        return False
