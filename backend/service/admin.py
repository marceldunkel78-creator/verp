from django.contrib import admin
from .models import (VSService, VSServicePrice, ServiceTicket, TicketComment, TicketChangeLog, 
                     RMACase, TroubleshootingTicket, TroubleshootingComment,
                     ServiceTicketAttachment, TroubleshootingAttachment, ServiceTicketTimeEntry, RMACaseTimeEntry)


@admin.register(VSService)
class VSServiceAdmin(admin.ModelAdmin):
    list_display = ['article_number', 'name', 'unit', 'is_active', 'created_at']
    list_filter = ['is_active', 'product_category']
    search_fields = ['article_number', 'name', 'description']
    readonly_fields = ['article_number', 'created_at', 'updated_at']


@admin.register(VSServicePrice)
class VSServicePriceAdmin(admin.ModelAdmin):
    list_display = ['vs_service', 'purchase_price', 'sales_price', 'valid_from', 'valid_until']
    list_filter = ['valid_from']
    search_fields = ['vs_service__name', 'vs_service__article_number']


@admin.register(ServiceTicket)
class ServiceTicketAdmin(admin.ModelAdmin):
    list_display = ['ticket_number', 'title', 'status', 'customer', 'assigned_to', 'created_at']
    list_filter = ['status', 'billing', 'assigned_to']
    search_fields = ['ticket_number', 'title', 'description']
    readonly_fields = ['ticket_number', 'created_at', 'updated_at']


@admin.register(RMACase)
class RMACaseAdmin(admin.ModelAdmin):
    list_display = ['rma_number', 'title', 'status', 'customer_name', 'created_at']
    list_filter = ['status', 'warranty_status']
    search_fields = ['rma_number', 'title', 'product_serial']
    readonly_fields = ['rma_number', 'created_at', 'updated_at']


@admin.register(TroubleshootingTicket)
class TroubleshootingTicketAdmin(admin.ModelAdmin):
    list_display = ['ticket_number', 'legacy_id', 'title', 'status', 'priority', 'category', 'assigned_to', 'created_at']
    list_filter = ['status', 'priority', 'category', 'assigned_to']
    search_fields = ['ticket_number', 'title', 'description', 'root_cause', 'corrective_action']
    readonly_fields = ['ticket_number', 'created_at', 'updated_at']
    fieldsets = (
        ('Basis', {
            'fields': ('ticket_number', 'legacy_id', 'title', 'description', 'status', 'priority', 'category')
        }),
        ('Troubleshooting', {
            'fields': ('affected_version', 'root_cause', 'corrective_action', 'related_tickets', 'files', 'last_comments')
        }),
        ('Zuweisung', {
            'fields': ('author', 'assigned_to', 'last_changed_by')
        }),
        ('Metadaten', {
            'fields': ('created_at', 'updated_at', 'closed_at')
        }),
    )


@admin.register(TroubleshootingComment)
class TroubleshootingCommentAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'created_by', 'created_at']
    list_filter = ['created_at']


@admin.register(ServiceTicketAttachment)
class ServiceTicketAttachmentAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'filename', 'file_size', 'is_image', 'uploaded_by', 'uploaded_at']
    list_filter = ['uploaded_at', 'content_type']
    search_fields = ['ticket__ticket_number', 'filename']
    readonly_fields = ['uploaded_at', 'file_size', 'content_type']


@admin.register(TroubleshootingAttachment)
class TroubleshootingAttachmentAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'filename', 'file_size', 'is_image', 'uploaded_by', 'uploaded_at']
    list_filter = ['uploaded_at', 'content_type']
    search_fields = ['ticket__ticket_number', 'filename']
    readonly_fields = ['uploaded_at', 'file_size', 'content_type']
    search_fields = ['comment', 'ticket__title']


@admin.register(ServiceTicketTimeEntry)
class ServiceTicketTimeEntryAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'date', 'time', 'employee', 'hours_spent', 'description', 'created_at']
    list_filter = ['date', 'employee']
    search_fields = ['ticket__ticket_number', 'description']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(RMACaseTimeEntry)
class RMACaseTimeEntryAdmin(admin.ModelAdmin):
    list_display = ['rma_case', 'date', 'time', 'employee', 'hours_spent', 'description', 'created_at']
    list_filter = ['date', 'employee']
    search_fields = ['rma_case__rma_number', 'description']
    readonly_fields = ['created_at', 'updated_at']
