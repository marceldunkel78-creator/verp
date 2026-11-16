from django.contrib import admin
from .models import (
    DevelopmentProject, DevelopmentTicket, DevelopmentTicketComment, DevelopmentProjectComment,
    DevelopmentProjectMaterialItem, DevelopmentProjectInvestment, DevelopmentProjectCostCalculation,
    DevelopmentProjectAttachment, DevelopmentTicketAttachment, DevelopmentProjectTimeEntry
)


class DevelopmentProjectCommentInline(admin.TabularInline):
    model = DevelopmentProjectComment
    extra = 0
    fields = ['comment', 'created_by', 'created_at']
    readonly_fields = ['created_at']


class DevelopmentProjectMaterialItemInline(admin.TabularInline):
    model = DevelopmentProjectMaterialItem
    extra = 0
    autocomplete_fields = ['material_supply']


class DevelopmentProjectInvestmentInline(admin.TabularInline):
    model = DevelopmentProjectInvestment
    extra = 0


class DevelopmentProjectAttachmentInline(admin.TabularInline):
    model = DevelopmentProjectAttachment
    extra = 0
    readonly_fields = ['file_size', 'content_type', 'uploaded_by', 'uploaded_at']


class DevelopmentProjectTimeEntryInline(admin.TabularInline):
    model = DevelopmentProjectTimeEntry
    extra = 0
    readonly_fields = ['created_at', 'updated_at']


@admin.register(DevelopmentProject)
class DevelopmentProjectAdmin(admin.ModelAdmin):
    list_display = ['project_number', 'name', 'status', 'assigned_to', 'project_start', 'planned_end', 'updated_at']
    list_filter = ['status', 'assigned_to', 'project_start']
    search_fields = ['project_number', 'name', 'description']
    readonly_fields = ['project_number', 'created_at', 'updated_at', 'created_by']
    autocomplete_fields = ['assigned_to']
    inlines = [
        DevelopmentProjectCommentInline,
        DevelopmentProjectMaterialItemInline,
        DevelopmentProjectInvestmentInline,
        DevelopmentProjectAttachmentInline,
        DevelopmentProjectTimeEntryInline
    ]
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


class DevelopmentTicketCommentInline(admin.TabularInline):
    model = DevelopmentTicketComment
    extra = 0
    readonly_fields = ['created_at', 'updated_at']


class DevelopmentTicketAttachmentInline(admin.TabularInline):
    model = DevelopmentTicketAttachment
    extra = 0
    readonly_fields = ['file_size', 'content_type', 'uploaded_by', 'uploaded_at']


@admin.register(DevelopmentTicket)
class DevelopmentTicketAdmin(admin.ModelAdmin):
    list_display = ['ticket_number', 'title', 'category', 'status', 'priority', 'project', 'assigned_to']
    list_filter = ['category', 'status', 'priority']
    search_fields = ['ticket_number', 'title', 'description', 'project__name']
    autocomplete_fields = ['project', 'assigned_to']
    readonly_fields = ['ticket_number', 'created_at', 'updated_at', 'created_by']
    inlines = [DevelopmentTicketCommentInline, DevelopmentTicketAttachmentInline]


@admin.register(DevelopmentProjectCostCalculation)
class DevelopmentProjectCostCalculationAdmin(admin.ModelAdmin):
    list_display = ['project', 'name', 'material_cost', 'labor_cost', 'total_cost', 'is_active']
    list_filter = ['is_active', 'project']
    readonly_fields = ['material_cost', 'labor_cost', 'development_cost_per_unit', 'total_cost', 'created_at', 'updated_at']
