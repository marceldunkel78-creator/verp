from django.contrib import admin
from .models import Quotation, QuotationItem


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 1
    fields = ['position', 'content_type', 'object_id', 'description_type', 'quantity', 'unit_price', 'discount_percent', 'tax_rate']


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ['quotation_number', 'customer', 'date', 'valid_until', 'status', 'language']
    list_filter = ['status', 'language', 'date']
    search_fields = ['quotation_number', 'reference', 'customer__first_name', 'customer__last_name']
    readonly_fields = ['quotation_number', 'created_at', 'updated_at']
    inlines = [QuotationItemInline]
    
    fieldsets = (
        ('Grundinformationen', {
            'fields': ('quotation_number', 'customer', 'reference', 'date', 'valid_until', 'status', 'language')
        }),
        ('Lieferung', {
            'fields': ('delivery_time_weeks', 'payment_term', 'delivery_term', 'delivery_instruction')
        }),
        ('Empfängeradresse', {
            'fields': ('recipient_company', 'recipient_name', 'recipient_street', 'recipient_postal_code', 'recipient_city', 'recipient_country')
        }),
        ('Verwaltung', {
            'fields': ('project_reference', 'system_reference', 'notes', 'show_terms_conditions', 'quotation_document')
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at')
        }),
    )


@admin.register(QuotationItem)
class QuotationItemAdmin(admin.ModelAdmin):
    list_display = ['quotation', 'position', 'content_type', 'object_id', 'quantity', 'unit_price']
    list_filter = ['description_type']
    search_fields = ['quotation__quotation_number']
