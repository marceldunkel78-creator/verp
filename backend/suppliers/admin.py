from django.contrib import admin
from .models import (
    Supplier, SupplierContact, TradingProduct,
    SupplierProduct, ProductCategory
)


class SupplierContactInline(admin.TabularInline):
    model = SupplierContact
    extra = 1


class SupplierProductInline(admin.TabularInline):
    model = SupplierProduct
    extra = 1


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'email', 'phone', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['company_name', 'email', 'phone']
    inlines = [SupplierContactInline, SupplierProductInline]
    readonly_fields = ['created_by', 'created_at', 'updated_at']


@admin.register(SupplierContact)
class SupplierContactAdmin(admin.ModelAdmin):
    list_display = ['supplier', 'contact_type', 'contact_person', 'email', 'phone']
    list_filter = ['contact_type']
    search_fields = ['supplier__company_name', 'contact_person', 'email']


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    search_fields = ['name']


@admin.register(TradingProduct)
class TradingProductAdmin(admin.ModelAdmin):
    list_display = ['article_number', 'name', 'category', 'unit', 'is_active']
    list_filter = ['category', 'is_active', 'created_at']
    search_fields = ['name', 'article_number', 'description']
    readonly_fields = ['created_at', 'updated_at']


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
