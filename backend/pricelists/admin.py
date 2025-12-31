from django.contrib import admin
from .models import SalesPriceList


@admin.register(SalesPriceList)
class SalesPriceListAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'pricelist_type', 'get_validity', 'supplier', 
        'has_pdf', 'created_by', 'created_at'
    ]
    list_filter = ['pricelist_type', 'valid_from_year', 'supplier']
    search_fields = ['subtitle', 'supplier__company_name']
    readonly_fields = ['created_at', 'updated_at', 'created_by']
    
    fieldsets = (
        ('Typ', {
            'fields': ('pricelist_type', 'subtitle')
        }),
        ('Lieferantenfilter', {
            'fields': ('supplier',),
            'description': 'Nur bei Trading Products relevant'
        }),
        ('Combined-Optionen', {
            'fields': (
                'include_vs_hardware', 'include_visiview', 
                'include_trading', 'include_vs_service',
                'trading_supplier'
            ),
            'classes': ('collapse',),
            'description': 'Nur bei Combined-Preislisten relevant'
        }),
        ('Gültigkeitszeitraum', {
            'fields': (
                ('valid_from_month', 'valid_from_year'),
                ('valid_until_month', 'valid_until_year')
            )
        }),
        ('PDF', {
            'fields': ('pdf_file',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_validity(self, obj):
        return f"{obj.valid_from_month:02d}/{obj.valid_from_year} - {obj.valid_until_month:02d}/{obj.valid_until_year}"
    get_validity.short_description = 'Gültigkeit'
    
    def has_pdf(self, obj):
        return bool(obj.pdf_file)
    has_pdf.boolean = True
    has_pdf.short_description = 'PDF'
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
