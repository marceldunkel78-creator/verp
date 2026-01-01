from django.contrib import admin
from .models import VisiViewProduct, VisiViewProductPrice, VisiViewLicense, VisiViewOption


class VisiViewProductPriceInline(admin.TabularInline):
    model = VisiViewProductPrice
    extra = 0
    fields = ['purchase_price', 'list_price', 'valid_from', 'valid_until', 'notes']
    ordering = ['-valid_from']


@admin.register(VisiViewProduct)
class VisiViewProductAdmin(admin.ModelAdmin):
    list_display = ['article_number', 'name', 'product_category', 'is_active', 'created_at']
    list_filter = ['is_active', 'product_category']
    search_fields = ['article_number', 'name', 'description']
    readonly_fields = ['article_number', 'created_at', 'updated_at', 'created_by']
    inlines = [VisiViewProductPriceInline]
    
    fieldsets = (
        ('Produktinformationen', {
            'fields': ('article_number', 'name', 'description', 'product_category', 'unit')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(VisiViewProductPrice)
class VisiViewProductPriceAdmin(admin.ModelAdmin):
    list_display = ['product', 'purchase_price', 'list_price', 'valid_from', 'valid_until']
    list_filter = ['valid_from']
    search_fields = ['product__article_number', 'product__name']
    raw_id_fields = ['product']


@admin.register(VisiViewOption)
class VisiViewOptionAdmin(admin.ModelAdmin):
    list_display = ['bit_position', 'name', 'price', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'description']
    ordering = ['bit_position']


@admin.register(VisiViewLicense)
class VisiViewLicenseAdmin(admin.ModelAdmin):
    list_display = ['license_number', 'serial_number', 'get_customer_display', 'version', 'status', 'delivery_date']
    list_filter = ['status', 'is_demo', 'is_loaner', 'is_outdated']
    search_fields = ['license_number', 'serial_number', 'customer_name_legacy', 'customer__last_name']
    readonly_fields = ['license_number', 'created_at', 'updated_at', 'created_by']
    raw_id_fields = ['customer']
    date_hierarchy = 'delivery_date'
    
    fieldsets = (
        ('Lizenzidentifikation', {
            'fields': ('license_number', 'serial_number', 'internal_serial')
        }),
        ('Kunde', {
            'fields': ('customer', 'customer_name_legacy', 'customer_address_legacy', 'distributor')
        }),
        ('Software', {
            'fields': ('version', 'options_bitmask', 'options_upper_32bit')
        }),
        ('Daten', {
            'fields': ('delivery_date', 'expire_date', 'maintenance_date', 'purchase_order')
        }),
        ('Status', {
            'fields': ('status', 'is_demo', 'is_loaner', 'is_defect', 'is_returned', 'is_cancelled', 'is_lost', 'is_outdated', 'return_date')
        }),
        ('Demo-Optionen', {
            'fields': ('demo_options', 'demo_options_expire_date'),
            'classes': ('collapse',)
        }),
        ('Dongle', {
            'fields': ('dongle_batch_id', 'dongle_version', 'dongle_mod_count'),
            'classes': ('collapse',)
        }),
        ('Support', {
            'fields': ('support_end', 'support_warning'),
            'classes': ('collapse',)
        }),
        ('Notizen', {
            'fields': ('info', 'todo')
        }),
        ('Import', {
            'fields': ('legacy_id',),
            'classes': ('collapse',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_customer_display(self, obj):
        if obj.customer:
            return str(obj.customer)
        return obj.customer_name_legacy or '-'
    get_customer_display.short_description = 'Kunde'
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
