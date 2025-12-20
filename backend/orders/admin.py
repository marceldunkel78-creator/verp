from django.contrib import admin
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1
    fields = ['position', 'customer_order_number', 'article_number', 'name', 'quantity', 'unit', 'list_price', 'discount_percent', 'final_price', 'currency']
    ordering = ['position']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'supplier', 'status', 'order_date', 'created_at']
    list_filter = ['status', 'order_date', 'created_at']
    search_fields = ['order_number', 'supplier__company_name', 'notes']
    readonly_fields = ['order_number', 'created_by', 'created_at', 'updated_at']
    inlines = [OrderItemInline]
    
    fieldsets = (
        ('Bestellung', {
            'fields': ('order_number', 'status', 'supplier')
        }),
        ('Daten', {
            'fields': ('order_date', 'delivery_date', 'payment_date')
        }),
        ('Angebot & Text', {
            'fields': ('offer_reference', 'custom_text')
        }),
        ('Notizen', {
            'fields': ('notes',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'position', 'article_number', 'name', 'quantity', 'final_price', 'currency']
    list_filter = ['order__status', 'currency']
    search_fields = ['article_number', 'name', 'order__order_number']
    ordering = ['order', 'position']
