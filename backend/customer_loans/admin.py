from django.contrib import admin
from .models import CustomerLoan, CustomerLoanItem


class CustomerLoanItemInline(admin.TabularInline):
    model = CustomerLoanItem
    extra = 1


@admin.register(CustomerLoan)
class CustomerLoanAdmin(admin.ModelAdmin):
    list_display = ['loan_number', 'customer', 'status', 'loan_date', 'return_deadline', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['loan_number', 'customer__name', 'notes']
    readonly_fields = ['loan_number', 'created_at', 'updated_at', 'created_by', 'updated_by']
    inlines = [CustomerLoanItemInline]

    fieldsets = (
        ('Allgemein', {
            'fields': ('loan_number', 'customer', 'status', 'loan_date', 'return_deadline', 'responsible_employee')
        }),
        ('Lieferadresse', {
            'fields': (
                'delivery_address_name', 'delivery_address_street', 'delivery_address_house_number',
                'delivery_address_postal_code', 'delivery_address_city', 'delivery_address_country'
            )
        }),
        ('Klausel & Bemerkungen', {
            'fields': ('standard_clause', 'notes')
        }),
        ('PDF', {
            'fields': ('pdf_file',)
        }),
        ('System', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )
