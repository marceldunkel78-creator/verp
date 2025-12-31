from django.contrib import admin
from .models import (
    Dealer, DealerDocument, DealerEmployee, 
    DealerCustomerSystem, DealerCustomerSystemTicket,
    DealerPriceListLog, DealerQuotationLog
)


class DealerDocumentInline(admin.TabularInline):
    model = DealerDocument
    extra = 0


class DealerEmployeeInline(admin.TabularInline):
    model = DealerEmployee
    extra = 0


class DealerCustomerSystemInline(admin.TabularInline):
    model = DealerCustomerSystem
    extra = 0


@admin.register(Dealer)
class DealerAdmin(admin.ModelAdmin):
    list_display = ['dealer_number', 'company_name', 'city', 'country', 'status', 'dealer_discount', 'created_at']
    list_filter = ['status', 'country', 'language', 'payment_terms']
    search_fields = ['dealer_number', 'company_name', 'city']
    readonly_fields = ['dealer_number', 'created_at', 'updated_at']
    inlines = [DealerDocumentInline, DealerEmployeeInline, DealerCustomerSystemInline]
    
    fieldsets = (
        ('Grunddaten', {
            'fields': ('dealer_number', 'company_name', 'status', 'language')
        }),
        ('Adresse', {
            'fields': ('street', 'house_number', 'address_supplement', 'postal_code', 'city', 'state', 'country')
        }),
        ('Konditionen', {
            'fields': ('dealer_discount', 'payment_terms')
        }),
        ('Notizen', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(DealerDocument)
class DealerDocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'dealer', 'document_type', 'uploaded_at']
    list_filter = ['document_type', 'uploaded_at']
    search_fields = ['title', 'dealer__company_name']


@admin.register(DealerEmployee)
class DealerEmployeeAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'dealer', 'email', 'phone', 'is_primary', 'is_active']
    list_filter = ['is_primary', 'is_active', 'language']
    search_fields = ['first_name', 'last_name', 'email', 'dealer__company_name']


@admin.register(DealerCustomerSystem)
class DealerCustomerSystemAdmin(admin.ModelAdmin):
    list_display = ['dealer', 'customer_name', 'visiview_license_id', 'created_at']
    list_filter = ['dealer']
    search_fields = ['customer_name', 'visiview_license_id', 'dealer__company_name']


@admin.register(DealerCustomerSystemTicket)
class DealerCustomerSystemTicketAdmin(admin.ModelAdmin):
    list_display = ['dealer_customer_system', 'ticket_type', 'ticket_reference', 'created_at']
    list_filter = ['ticket_type']


@admin.register(DealerPriceListLog)
class DealerPriceListLogAdmin(admin.ModelAdmin):
    list_display = ['dealer', 'pricelist_type', 'sent_date', 'valid_until', 'sent_by']
    list_filter = ['pricelist_type', 'sent_date']
    search_fields = ['dealer__company_name']


@admin.register(DealerQuotationLog)
class DealerQuotationLogAdmin(admin.ModelAdmin):
    list_display = ['dealer', 'quotation_number', 'sent_date', 'subject', 'sent_by']
    list_filter = ['sent_date']
    search_fields = ['dealer__company_name', 'quotation_number', 'subject']
