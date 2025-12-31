from django.contrib import admin
from .models import (
    Loan, LoanItem, LoanReceipt, LoanItemReceipt,
    LoanItemPhoto, LoanReturn, LoanReturnItem
)


class LoanItemInline(admin.TabularInline):
    model = LoanItem
    extra = 1


class LoanReceiptInline(admin.StackedInline):
    model = LoanReceipt
    extra = 0
    max_num = 1


class LoanReturnInline(admin.TabularInline):
    model = LoanReturn
    extra = 0
    readonly_fields = ['return_number', 'pdf_file', 'created_at', 'created_by']


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ['loan_number', 'supplier', 'status', 'request_date', 'return_deadline', 'created_at']
    list_filter = ['status', 'supplier', 'created_at']
    search_fields = ['loan_number', 'supplier__company_name', 'supplier_reference']
    readonly_fields = ['loan_number', 'created_at', 'updated_at', 'created_by', 'updated_by']
    inlines = [LoanItemInline, LoanReceiptInline, LoanReturnInline]
    
    fieldsets = (
        ('Allgemein', {
            'fields': ('loan_number', 'supplier', 'status', 'request_date', 'return_deadline', 'supplier_reference')
        }),
        ('Rücksendeadresse', {
            'fields': (
                'return_address_name', 'return_address_street', 'return_address_house_number',
                'return_address_postal_code', 'return_address_city', 'return_address_country'
            )
        }),
        ('Bemerkungen', {
            'fields': ('notes',)
        }),
        ('System', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(LoanItem)
class LoanItemAdmin(admin.ModelAdmin):
    list_display = ['loan', 'position', 'product_name', 'supplier_article_number', 'quantity', 'unit']
    list_filter = ['loan__supplier', 'loan__status']
    search_fields = ['product_name', 'supplier_article_number', 'serial_number']


class LoanItemReceiptInline(admin.TabularInline):
    model = LoanItemReceipt
    extra = 0


@admin.register(LoanReceipt)
class LoanReceiptAdmin(admin.ModelAdmin):
    list_display = ['loan', 'receipt_date', 'received_by']
    list_filter = ['receipt_date', 'received_by']


class LoanReturnItemInline(admin.TabularInline):
    model = LoanReturnItem
    extra = 0


@admin.register(LoanReturn)
class LoanReturnAdmin(admin.ModelAdmin):
    list_display = ['return_number', 'loan', 'return_date', 'shipping_carrier', 'created_at']
    list_filter = ['return_date', 'shipping_carrier']
    search_fields = ['return_number', 'loan__loan_number', 'tracking_number']
    readonly_fields = ['return_number', 'pdf_file', 'created_at', 'created_by']
    inlines = [LoanReturnItemInline]


@admin.register(LoanItemPhoto)
class LoanItemPhotoAdmin(admin.ModelAdmin):
    list_display = ['loan_item', 'description', 'uploaded_at', 'uploaded_by']
    list_filter = ['uploaded_at', 'uploaded_by']
