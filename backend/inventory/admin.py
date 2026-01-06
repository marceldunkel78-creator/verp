from django.contrib import admin
from .models import IncomingGoods, InventoryItem


@admin.register(IncomingGoods)
class IncomingGoodsAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'name', 'delivered_quantity', 'unit', 'item_function', 'is_transferred', 'received_at']
    list_filter = ['is_transferred', 'item_function', 'item_category', 'received_at']
    search_fields = ['name', 'article_number', 'order_number', 'customer_order_number', 'serial_number']
    readonly_fields = ['received_at', 'transferred_at', 'transferred_by']
    
    fieldsets = (
        ('Bestellinformationen', {
            'fields': ('order_item', 'order_number', 'customer_order_number', 'supplier')
        }),
        ('Artikelinformationen', {
            'fields': ('article_number', 'name', 'description', 'delivered_quantity', 'unit', 'purchase_price', 'currency')
        }),
        ('Wareneigenschaften', {
            'fields': ('item_function', 'item_category', 'serial_number', 'trading_product', 'material_supply')
        }),
        ('Management', {
            'fields': ('management_info',)
        }),
        ('Status', {
            'fields': ('is_transferred', 'transferred_at', 'transferred_by', 'received_at', 'created_by')
        }),
    )


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ['inventory_number', 'name', 'item_function', 'item_category', 'quantity', 'delivery_date', 'status', 'stored_at']
    list_filter = ['status', 'item_function', 'item_category', 'supplier', 'delivery_date', 'stored_at']
    search_fields = [
        'inventory_number', 'name', 'article_number', 'visitron_part_number', 
        'serial_number', 'customer_order_number', 'order_number'
    ]
    readonly_fields = ['inventory_number', 'stored_at', 'updated_at']
    
    fieldsets = (
        ('Inventarinformationen', {
            'fields': ('inventory_number', 'status')
        }),
        ('Artikelinformationen', {
            'fields': ('article_number', 'visitron_part_number', 'name', 'description', 'item_function', 'item_category')
        }),
        ('Bestand', {
            'fields': ('serial_number', 'quantity', 'unit', 'delivery_date')
        }),
        ('Einkauf', {
            'fields': ('purchase_price', 'currency', 'supplier', 'order_number', 'customer_order_number')
        }),
        ('Verknüpfungen', {
            'fields': ('trading_product', 'material_supply')
        }),
        ('Management', {
            'fields': ('management_info',)
        }),
        ('Metadaten', {
            'fields': ('stored_at', 'stored_by', 'updated_at')
        }),
    )
