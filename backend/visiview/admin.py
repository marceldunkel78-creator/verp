from django.contrib import admin
from .models import (
    VisiViewProduct, VisiViewProductPrice, VisiViewLicense, VisiViewOption,
    VisiViewTicket, VisiViewTicketComment, VisiViewTicketChangeLog, VisiViewTicketAttachment,
    VisiViewTicketTimeEntry, MaintenanceTimeCredit, MaintenanceTimeExpenditure, MaintenanceTimeCreditDeduction
)
from .production_orders import (
    VisiViewProductionOrder, VisiViewProductionOrderItem, VisiViewLicenseHistory
)


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
            'fields': ('customer', 'customer_name_legacy', 'customer_address_legacy', 'dealer', 'distributor_legacy')
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


# ============================================================
# VisiView Tickets Admin
# ============================================================

class VisiViewTicketCommentInline(admin.TabularInline):
    model = VisiViewTicketComment
    extra = 0
    fields = ['comment', 'created_by_name', 'created_by', 'created_at', 'is_imported']
    readonly_fields = ['created_at']
    ordering = ['-created_at']


class VisiViewTicketChangeLogInline(admin.TabularInline):
    model = VisiViewTicketChangeLog
    extra = 0
    fields = ['field_name', 'old_value', 'new_value', 'changed_by', 'changed_at']
    readonly_fields = ['field_name', 'old_value', 'new_value', 'changed_by', 'changed_at']
    ordering = ['-changed_at']
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(VisiViewTicket)
class VisiViewTicketAdmin(admin.ModelAdmin):
    list_display = [
        'ticket_number', 'tracker', 'title', 'status', 'priority',
        'category', 'assigned_to_display', 'target_version', 'percent_done',
        'updated_at'
    ]
    list_filter = ['tracker', 'status', 'priority', 'category', 'is_private', 'assigned_to']
    search_fields = ['ticket_number', 'title', 'description', 'author', 'customers']
    readonly_fields = ['created_at', 'updated_at', 'imported_created_at', 'imported_updated_at']
    raw_id_fields = ['parent_ticket', 'author_user', 'assigned_to', 'created_by']
    filter_horizontal = ['watchers']
    date_hierarchy = 'created_at'
    inlines = [VisiViewTicketCommentInline, VisiViewTicketChangeLogInline]
    
    fieldsets = (
        ('Ticket-Identifikation', {
            'fields': ('ticket_number', 'tracker', 'parent_ticket')
        }),
        ('Inhalt', {
            'fields': ('title', 'description')
        }),
        ('Status & Priorität', {
            'fields': ('status', 'priority', 'category', 'percent_done')
        }),
        ('Personen', {
            'fields': ('author', 'author_user', 'assigned_to', 'assigned_to_name', 'last_changed_by', 'watchers')
        }),
        ('Versionen', {
            'fields': ('target_version', 'affected_version', 'visiview_id')
        }),
        ('Zeitplanung', {
            'fields': ('start_date', 'due_date', 'estimated_hours', 'total_estimated_hours', 'spent_hours')
        }),
        ('Kunden & Verknüpfungen', {
            'fields': ('customers', 'attachments', 'related_tickets')
        }),
        ('Flags', {
            'fields': ('is_private', 'add_to_worklist', 'rank'),
            'classes': ('collapse',)
        }),
        ('Zeitstempel', {
            'fields': ('created_at', 'updated_at', 'closed_at', 'imported_created_at', 'imported_updated_at'),
            'classes': ('collapse',)
        }),
        ('Metadaten', {
            'fields': ('created_by',),
            'classes': ('collapse',)
        }),
    )
    
    def assigned_to_display(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return obj.assigned_to_name or '-'
    assigned_to_display.short_description = 'Zugewiesen an'
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(VisiViewTicketComment)
class VisiViewTicketCommentAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'created_by_display', 'created_at', 'is_imported']
    list_filter = ['is_imported', 'created_at']
    search_fields = ['ticket__ticket_number', 'comment', 'created_by_name']
    raw_id_fields = ['ticket', 'created_by']
    readonly_fields = ['created_at']
    
    def created_by_display(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return obj.created_by_name or 'Unbekannt'
    created_by_display.short_description = 'Erstellt von'


@admin.register(VisiViewTicketChangeLog)
class VisiViewTicketChangeLogAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'field_name', 'changed_by', 'changed_at']
    list_filter = ['field_name', 'changed_at']
    search_fields = ['ticket__ticket_number', 'field_name', 'old_value', 'new_value']
    raw_id_fields = ['ticket', 'changed_by']
    readonly_fields = ['ticket', 'field_name', 'old_value', 'new_value', 'changed_by', 'changed_at']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(VisiViewTicketAttachment)
class VisiViewTicketAttachmentAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'filename', 'file_size', 'is_image', 'uploaded_by', 'uploaded_at']
    list_filter = ['uploaded_at', 'content_type']
    search_fields = ['ticket__ticket_number', 'filename']
    raw_id_fields = ['ticket', 'uploaded_by']
    readonly_fields = ['uploaded_at', 'file_size', 'content_type', 'is_image']


@admin.register(VisiViewTicketTimeEntry)
class VisiViewTicketTimeEntryAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'date', 'time', 'employee', 'hours_spent', 'description', 'created_at']
    list_filter = ['date', 'employee']
    search_fields = ['ticket__ticket_number', 'description']
    raw_id_fields = ['ticket', 'employee', 'created_by']
    readonly_fields = ['created_by', 'created_at', 'updated_at']
    date_hierarchy = 'date'


@admin.register(MaintenanceTimeCredit)
class MaintenanceTimeCreditAdmin(admin.ModelAdmin):
    list_display = ['license', 'start_date', 'end_date', 'credit_hours', 'remaining_hours', 'user', 'created_at']
    list_filter = ['start_date', 'end_date', 'user']
    search_fields = ['license__license_number', 'license__serial_number']
    raw_id_fields = ['license', 'user', 'created_by']
    readonly_fields = ['created_by', 'created_at', 'updated_at']
    date_hierarchy = 'start_date'
    
    fieldsets = (
        ('Lizenz', {
            'fields': ('license',)
        }),
        ('Zeitgutschrift', {
            'fields': ('start_date', 'end_date', 'credit_hours', 'remaining_hours', 'user')
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


class MaintenanceTimeCreditDeductionInline(admin.TabularInline):
    model = MaintenanceTimeCreditDeduction
    extra = 0
    fields = ['credit', 'hours_deducted']
    readonly_fields = ['credit', 'hours_deducted']

@admin.register(MaintenanceTimeExpenditure)
class MaintenanceTimeExpenditureAdmin(admin.ModelAdmin):
    list_display = ['license', 'date', 'time', 'user', 'activity', 'task_type', 'hours_spent', 'is_goodwill', 'created_at']
    list_filter = ['date', 'activity', 'task_type', 'is_goodwill', 'user']
    search_fields = ['license__license_number', 'license__serial_number', 'comment']
    raw_id_fields = ['license', 'user', 'created_by']
    readonly_fields = ['created_by', 'created_at', 'updated_at']
    date_hierarchy = 'date'
    inlines = [MaintenanceTimeCreditDeductionInline]
    
    fieldsets = (
        ('Lizenz', {
            'fields': ('license',)
        }),
        ('Zeitaufwendung', {
            'fields': ('date', 'time', 'user', 'activity', 'task_type', 'hours_spent', 'comment', 'is_goodwill')
        }),
        ('Abrechnung', {
            'fields': ('created_debt',),
            'classes': ('collapse',)
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


# ============================================================
# VisiView Production Orders & License History
# ============================================================

class VisiViewProductionOrderItemInline(admin.TabularInline):
    model = VisiViewProductionOrderItem
    extra = 0
    fields = ['customer_order_item', 'selected_options', 'maintenance_months']
    readonly_fields = []


@admin.register(VisiViewProductionOrder)
class VisiViewProductionOrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'customer', 'status', 'processing_type', 'created_at', 'completed_at']
    list_filter = ['status', 'processing_type', 'created_at']
    search_fields = ['order_number', 'customer__last_name', 'customer_order__order_number']
    readonly_fields = ['order_number', 'created_by', 'created_at', 'updated_at', 'completed_at']
    inlines = [VisiViewProductionOrderItemInline]
    
    fieldsets = (
        ('Auftragsinformationen', {
            'fields': ('order_number', 'customer_order', 'customer')
        }),
        ('Bearbeitungstyp', {
            'fields': ('processing_type', 'target_license', 'status')
        }),
        ('Notizen', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at', 'completed_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(VisiViewLicenseHistory)
class VisiViewLicenseHistoryAdmin(admin.ModelAdmin):
    list_display = ['license', 'change_type', 'description', 'changed_by', 'changed_at']
    list_filter = ['change_type', 'changed_at']
    search_fields = ['license__serial_number', 'description', 'changed_by__username']
    readonly_fields = ['changed_at']
    
    fieldsets = (
        ('Lizenz', {
            'fields': ('license',)
        }),
        ('Änderung', {
            'fields': ('change_type', 'description', 'old_value', 'new_value')
        }),
        ('Verknüpfung', {
            'fields': ('production_order',),
            'classes': ('collapse',)
        }),
        ('Metadaten', {
            'fields': ('changed_by', 'changed_at'),
            'classes': ('collapse',)
        }),
    )
