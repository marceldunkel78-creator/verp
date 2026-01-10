from django.contrib import admin
from .models import (
    DevelopmentProject, DevelopmentProjectTodo, DevelopmentProjectComment,
    DevelopmentProjectMaterialItem, DevelopmentProjectCostCalculation,
    DevelopmentProjectAttachment, DevelopmentProjectTimeEntry
)


class DevelopmentProjectTodoInline(admin.TabularInline):
    model = DevelopmentProjectTodo
    extra = 0
    fields = ['text', 'is_completed', 'position']


class DevelopmentProjectCommentInline(admin.TabularInline):
    model = DevelopmentProjectComment
    extra = 0
    fields = ['comment', 'created_by', 'created_at']
    readonly_fields = ['created_at']


class DevelopmentProjectMaterialItemInline(admin.TabularInline):
    model = DevelopmentProjectMaterialItem
    extra = 0
    autocomplete_fields = ['material_supply']


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
    readonly_fields = ['project_number', 'project_start', 'created_at', 'updated_at', 'created_by']
    autocomplete_fields = ['assigned_to']
    inlines = [
        DevelopmentProjectTodoInline,
        DevelopmentProjectCommentInline,
        DevelopmentProjectMaterialItemInline,
        DevelopmentProjectAttachmentInline,
        DevelopmentProjectTimeEntryInline
    ]
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(DevelopmentProjectCostCalculation)
class DevelopmentProjectCostCalculationAdmin(admin.ModelAdmin):
    list_display = ['project', 'name', 'material_cost', 'labor_cost', 'total_cost', 'is_active']
    list_filter = ['is_active', 'project']
    readonly_fields = ['material_cost', 'labor_cost', 'development_cost_per_unit', 'total_cost', 'created_at', 'updated_at']
