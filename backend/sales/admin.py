from django.contrib import admin
from .models import (
    Quotation, QuotationItem, MarketingItem, MarketingItemFile,
    SalesTicket, SalesTicketAttachment, SalesTicketComment
)


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 1
    fields = ['position', 'content_type', 'object_id', 'description_type', 'quantity', 'unit_price', 'discount_percent', 'tax_rate']


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ['quotation_number', 'customer', 'date', 'valid_until', 'status', 'language']
    list_filter = ['status', 'language', 'date']
    search_fields = ['quotation_number', 'reference', 'customer__first_name', 'customer__last_name']
    readonly_fields = ['quotation_number', 'created_at', 'updated_at']
    inlines = [QuotationItemInline]
    
    fieldsets = (
        ('Grundinformationen', {
            'fields': ('quotation_number', 'customer', 'reference', 'date', 'valid_until', 'status', 'language')
        }),
        ('Lieferung', {
            'fields': ('delivery_time_weeks', 'payment_term', 'delivery_term', 'delivery_instruction')
        }),
        ('Empfängeradresse', {
            'fields': ('recipient_company', 'recipient_name', 'recipient_street', 'recipient_postal_code', 'recipient_city', 'recipient_country')
        }),
        ('Verwaltung', {
            'fields': ('project_reference', 'system_reference', 'notes', 'show_terms_conditions', 'quotation_document')
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at')
        }),
    )


@admin.register(QuotationItem)
class QuotationItemAdmin(admin.ModelAdmin):
    list_display = ['quotation', 'position', 'content_type', 'object_id', 'quantity', 'unit_price']
    list_filter = ['description_type']
    search_fields = ['quotation__quotation_number']


# ==================== Marketing Admin ====================

class MarketingItemFileInline(admin.TabularInline):
    model = MarketingItemFile
    extra = 1
    fields = ['file', 'filename', 'uploaded_by', 'uploaded_at']
    readonly_fields = ['uploaded_at']


@admin.register(MarketingItem)
class MarketingItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'event_date', 'event_location', 'created_at']
    list_filter = ['category', 'event_date', 'created_at']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at']
    filter_horizontal = ['responsible_employees']
    inlines = [MarketingItemFileInline]
    
    fieldsets = (
        ('Basisinformationen', {
            'fields': ('category', 'title', 'description', 'responsible_employees')
        }),
        ('Veranstaltungsdaten', {
            'fields': ('event_date', 'event_location'),
            'description': 'Nur für Shows und Workshops relevant'
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at')
        }),
    )


@admin.register(MarketingItemFile)
class MarketingItemFileAdmin(admin.ModelAdmin):
    list_display = ['filename', 'marketing_item', 'uploaded_by', 'uploaded_at', 'file_size']
    list_filter = ['uploaded_at', 'content_type']
    search_fields = ['filename', 'marketing_item__title']
    readonly_fields = ['uploaded_at']


# ==================== Sales Ticket Admin ====================

class SalesTicketAttachmentInline(admin.TabularInline):
    model = SalesTicketAttachment
    extra = 0
    fields = ['file', 'filename', 'uploaded_by', 'uploaded_at']
    readonly_fields = ['uploaded_at']


class SalesTicketCommentInline(admin.TabularInline):
    model = SalesTicketComment
    extra = 0
    fields = ['comment', 'created_by', 'created_at']
    readonly_fields = ['created_at']


@admin.register(SalesTicket)
class SalesTicketAdmin(admin.ModelAdmin):
    list_display = ['ticket_number', 'title', 'category', 'status', 'assigned_to', 'due_date', 'created_at']
    list_filter = ['category', 'status', 'assigned_to', 'created_at', 'due_date']
    search_fields = ['ticket_number', 'title', 'description']
    readonly_fields = ['ticket_number', 'created_at', 'updated_at']
    inlines = [SalesTicketAttachmentInline, SalesTicketCommentInline]
    
    fieldsets = (
        ('Basisinformationen', {
            'fields': ('ticket_number', 'category', 'status', 'title', 'description')
        }),
        ('Zuständigkeit & Termine', {
            'fields': ('assigned_to', 'due_date', 'completed_date')
        }),
        ('Notizen', {
            'fields': ('notes',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at')
        }),
    )


@admin.register(SalesTicketAttachment)
class SalesTicketAttachmentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'ticket', 'uploaded_by', 'uploaded_at', 'file_size']
    list_filter = ['uploaded_at', 'content_type']
    search_fields = ['filename', 'ticket__ticket_number', 'ticket__title']
    readonly_fields = ['uploaded_at']


@admin.register(SalesTicketComment)
class SalesTicketCommentAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'created_by', 'created_at', 'comment_preview']
    list_filter = ['created_at', 'created_by']
    search_fields = ['ticket__ticket_number', 'ticket__title', 'comment']
    readonly_fields = ['created_at']
    
    def comment_preview(self, obj):
        return obj.comment[:50] + '...' if len(obj.comment) > 50 else obj.comment
    comment_preview.short_description = 'Kommentar'
