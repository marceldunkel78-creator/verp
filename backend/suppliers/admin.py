from django.contrib import admin
from .models import (
    Supplier, SupplierContact, TradingProduct,
    SupplierProduct
)


class SupplierContactInline(admin.TabularInline):
    model = SupplierContact
    extra = 1


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'email', 'phone', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['company_name', 'email', 'phone']
    inlines = [SupplierContactInline]
    readonly_fields = ['created_by', 'created_at', 'updated_at']


@admin.register(SupplierContact)
class SupplierContactAdmin(admin.ModelAdmin):
    list_display = ['supplier', 'contact_type', 'contact_person', 'email', 'phone']
    list_filter = ['contact_type']
    search_fields = ['supplier__company_name', 'contact_person', 'email']


@admin.register(TradingProduct)
class TradingProductAdmin(admin.ModelAdmin):
    list_display = ['visitron_part_number', 'name', 'supplier', 'category', 'list_price', 'list_price_currency', 'is_active']
    list_filter = ['supplier', 'category', 'list_price_currency', 'is_active', 'created_at']
    search_fields = ['name', 'visitron_part_number', 'supplier_part_number', 'description']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Grundinformationen', {
            'fields': ('name', 'visitron_part_number', 'supplier_part_number', 'supplier', 'category', 'description', 'unit')
        }),
        ('Preisinformationen', {
            'fields': ('list_price', 'list_price_currency', 'price_valid_from', 'price_valid_until', 'discount_percent', 'markup_percent')
        }),
        ('Zusätzliche Kosten', {
            'fields': (
                'costs_currency',
                ('shipping_cost', 'shipping_cost_is_percent'),
                ('import_cost', 'import_cost_is_percent'),
                ('handling_cost', 'handling_cost_is_percent'),
                ('storage_cost', 'storage_cost_is_percent'),
            )
        }),
        ('Status & Metadaten', {
            'fields': ('is_active', 'minimum_stock', 'created_at', 'updated_at')
        }),
    )


@admin.register(SupplierProduct)
class SupplierProductAdmin(admin.ModelAdmin):
    list_display = [
        'supplier', 'product', 'supplier_article_number',
        'purchase_price', 'is_preferred_supplier'
    ]
    list_filter = ['is_preferred_supplier', 'currency']
    search_fields = [
        'supplier__company_name', 'product__name',
        'supplier_article_number'
    ]
    readonly_fields = ['created_at', 'updated_at']
