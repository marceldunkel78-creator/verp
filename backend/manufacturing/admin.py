from django.contrib import admin
from .models import (
    VSHardware, VSHardwarePrice, VSHardwareMaterialItem,
    VSHardwareCostCalculation, VSHardwareDocument,
    ProductionOrderInbox, ProductionOrder
)


class VSHardwarePriceInline(admin.TabularInline):
    model = VSHardwarePrice
    extra = 0
    fields = ['purchase_price', 'sales_price', 'valid_from', 'valid_until', 'notes']


class VSHardwareMaterialItemInline(admin.TabularInline):
    model = VSHardwareMaterialItem
    extra = 0
    fields = ['material_supply', 'quantity', 'position', 'notes']
    autocomplete_fields = ['material_supply']


class VSHardwareDocumentInline(admin.TabularInline):
    model = VSHardwareDocument
    extra = 0
    fields = ['document_type', 'title', 'file', 'version']


@admin.register(VSHardware)
class VSHardwareAdmin(admin.ModelAdmin):
    list_display = ['part_number', 'name', 'model_designation', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['part_number', 'name', 'model_designation', 'description']
    readonly_fields = ['part_number', 'created_at', 'updated_at', 'created_by']
    inlines = [VSHardwarePriceInline, VSHardwareMaterialItemInline, VSHardwareDocumentInline]
    
    fieldsets = (
        ('Stammdaten', {
            'fields': ('part_number', 'name', 'model_designation', 'description')
        }),
        ('Handbücher', {
            'fields': ('release_manual', 'draft_manual')
        }),
        ('Einstellungen', {
            'fields': ('unit', 'is_active')
        }),
        ('Metadaten', {
            'fields': ('created_at', 'updated_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(VSHardwarePrice)
class VSHardwarePriceAdmin(admin.ModelAdmin):
    list_display = ['vs_hardware', 'purchase_price', 'sales_price', 'valid_from', 'valid_until']
    list_filter = ['vs_hardware', 'valid_from']
    search_fields = ['vs_hardware__part_number', 'vs_hardware__name']
    autocomplete_fields = ['vs_hardware']


@admin.register(VSHardwareMaterialItem)
class VSHardwareMaterialItemAdmin(admin.ModelAdmin):
    list_display = ['vs_hardware', 'material_supply', 'quantity', 'position']
    list_filter = ['vs_hardware']
    search_fields = ['vs_hardware__part_number', 'material_supply__name']
    autocomplete_fields = ['vs_hardware', 'material_supply']


@admin.register(VSHardwareCostCalculation)
class VSHardwareCostCalculationAdmin(admin.ModelAdmin):
    list_display = ['vs_hardware', 'name', 'total_purchase_price', 'calculated_sales_price', 'is_active', 'created_at']
    list_filter = ['is_active', 'vs_hardware']
    search_fields = ['vs_hardware__part_number', 'vs_hardware__name', 'name']
    readonly_fields = [
        'material_cost', 'labor_cost', 'development_cost_per_unit',
        'total_purchase_price', 'calculated_sales_price',
        'created_at', 'updated_at', 'created_by'
    ]
    autocomplete_fields = ['vs_hardware']
    
    fieldsets = (
        ('VS-Hardware', {
            'fields': ('vs_hardware', 'name', 'is_active')
        }),
        ('Arbeitszeit', {
            'fields': ('labor_hours', 'labor_rate')
        }),
        ('Entwicklungskosten', {
            'fields': ('development_cost_total', 'expected_sales_volume')
        }),
        ('Kalkulierte Werte', {
            'fields': (
                'material_cost', 'labor_cost', 'development_cost_per_unit',
                'total_purchase_price', 'margin_percent', 'calculated_sales_price'
            )
        }),
        ('Metadaten', {
            'fields': ('created_at', 'updated_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(VSHardwareDocument)
class VSHardwareDocumentAdmin(admin.ModelAdmin):
    list_display = ['vs_hardware', 'document_type', 'title', 'version', 'created_at']
    list_filter = ['document_type', 'vs_hardware']
    search_fields = ['vs_hardware__part_number', 'title', 'description']
    autocomplete_fields = ['vs_hardware']


@admin.register(ProductionOrderInbox)
class ProductionOrderInboxAdmin(admin.ModelAdmin):
    list_display = ['id', 'vs_hardware', 'quantity', 'customer_order', 'status', 'received_at']
    list_filter = ['status', 'received_at']
    search_fields = ['vs_hardware__part_number', 'vs_hardware__name', 'notes']
    autocomplete_fields = ['vs_hardware']
    readonly_fields = ['received_at', 'processed_at', 'processed_by']


@admin.register(ProductionOrder)
class ProductionOrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'vs_hardware', 'quantity', 'status', 'planned_start', 'planned_end', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['order_number', 'vs_hardware__part_number', 'vs_hardware__name', 'notes']
    autocomplete_fields = ['vs_hardware']
    readonly_fields = ['order_number', 'created_at', 'updated_at', 'created_by']
    
    fieldsets = (
        ('Stammdaten', {
            'fields': ('order_number', 'vs_hardware', 'quantity', 'status')
        }),
        ('Referenzen', {
            'fields': ('inbox_item', 'customer_order')
        }),
        ('Planung', {
            'fields': ('planned_start', 'planned_end', 'actual_start', 'actual_end')
        }),
        ('Notizen', {
            'fields': ('notes',)
        }),
        ('Metadaten', {
            'fields': ('created_at', 'updated_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
