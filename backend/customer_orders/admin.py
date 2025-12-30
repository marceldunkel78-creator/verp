from django.contrib import admin
from .models import CustomerOrder, CustomerOrderItem, DeliveryNote, Invoice, Payment


class CustomerOrderItemInline(admin.TabularInline):
    model = CustomerOrderItem
    extra = 0
    fields = ['position', 'article_number', 'name', 'quantity', 'final_price', 'delivery_note_number', 'invoice_number', 'serial_number']


class DeliveryNoteInline(admin.TabularInline):
    model = DeliveryNote
    extra = 0
    fields = ['delivery_note_number', 'sequence_number', 'delivery_date', 'tracking_number']
    readonly_fields = ['delivery_note_number']


class InvoiceInline(admin.TabularInline):
    model = Invoice
    extra = 0
    fields = ['invoice_number', 'sequence_number', 'invoice_date', 'status', 'gross_amount']
    readonly_fields = ['invoice_number']


@admin.register(CustomerOrder)
class CustomerOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'customer', 'quotation', 'status', 'order_date', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('order_number', 'customer__name', 'customer_order_number')
    inlines = [CustomerOrderItemInline, DeliveryNoteInline, InvoiceInline]
    
    fieldsets = (
        ('Grunddaten', {
            'fields': ('order_number', 'status', 'customer', 'quotation')
        }),
        ('Referenzen', {
            'fields': ('project_reference', 'system_reference', 'customer_order_number', 'customer_contact_name')
        }),
        ('Daten', {
            'fields': ('order_date', 'delivery_date', 'confirmation_date')
        }),
        ('Konditionen', {
            'fields': ('delivery_time_weeks', 'payment_term', 'delivery_term', 'warranty_term', 'delivery_cost')
        }),
        ('MwSt', {
            'fields': ('tax_enabled', 'tax_rate')
        }),
        ('Dokumente', {
            'fields': ('customer_document', 'confirmation_pdf'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['order_number']


@admin.register(DeliveryNote)
class DeliveryNoteAdmin(admin.ModelAdmin):
    list_display = ('delivery_note_number', 'order', 'delivery_date', 'tracking_number')
    list_filter = ('delivery_date',)
    search_fields = ('delivery_note_number', 'order__order_number')


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'order', 'status', 'invoice_date', 'gross_amount')
    list_filter = ('status', 'invoice_date')
    search_fields = ('invoice_number', 'order__order_number')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'amount', 'payment_date', 'payment_method')
    list_filter = ('payment_method', 'payment_date')
    search_fields = ('invoice__invoice_number', 'reference')
