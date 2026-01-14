from django.contrib import admin
from .models import Project, ProjectComment, ProjectTodo, ProjectDocument, ProjectOrderPosition


class ProjectCommentInline(admin.TabularInline):
    model = ProjectComment
    extra = 0
    readonly_fields = ['created_by', 'created_at']


class ProjectTodoInline(admin.TabularInline):
    model = ProjectTodo
    extra = 0
    readonly_fields = ['created_by', 'created_at']


class ProjectDocumentInline(admin.TabularInline):
    model = ProjectDocument
    extra = 0
    readonly_fields = ['uploaded_by', 'uploaded_at', 'file_size', 'content_type']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['project_number', 'name', 'customer', 'responsible_employee', 'status', 'tender_submission_deadline', 'created_at']
    list_filter = ['status', 'responsible_employee', 'created_at']
    search_fields = ['project_number', 'name', 'description', 'customer__first_name', 'customer__last_name']
    readonly_fields = ['project_number', 'created_by', 'created_at', 'updated_at']
    filter_horizontal = ['systems']
    raw_id_fields = ['customer', 'responsible_employee', 'linked_order']
    inlines = [ProjectCommentInline, ProjectTodoInline, ProjectDocumentInline]
    
    fieldsets = (
        ('Basisinformationen', {
            'fields': ('project_number', 'name', 'customer', 'responsible_employee', 'systems', 'description')
        }),
        ('Status', {
            'fields': ('status', 'linked_order')
        }),
        ('Forecast', {
            'fields': ('forecast_date', 'forecast_revenue', 'forecast_probability')
        }),
        ('Demoplanung', {
            'fields': ('demo_date_from', 'demo_date_to'),
            'classes': ('collapse',)
        }),
        ('Ausschreibung', {
            'fields': ('tender_bidder_questions_deadline', 'tender_submission_deadline', 'tender_award_deadline'),
            'classes': ('collapse',)
        }),
        ('Lieferung & Installation', {
            'fields': ('planned_delivery_date', 'actual_delivery_date', 'planned_installation_date', 'actual_installation_date'),
            'classes': ('collapse',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ProjectComment)
class ProjectCommentAdmin(admin.ModelAdmin):
    list_display = ['project', 'created_by', 'created_at']
    list_filter = ['created_at']
    search_fields = ['project__project_number', 'comment']
    readonly_fields = ['created_by', 'created_at']


@admin.register(ProjectTodo)
class ProjectTodoAdmin(admin.ModelAdmin):
    list_display = ['project', 'text', 'is_completed', 'position', 'created_at']
    list_filter = ['is_completed', 'created_at']
    search_fields = ['project__project_number', 'text']
    readonly_fields = ['created_by', 'created_at', 'updated_at']


@admin.register(ProjectDocument)
class ProjectDocumentAdmin(admin.ModelAdmin):
    list_display = ['project', 'filename', 'file_size', 'uploaded_by', 'uploaded_at']
    list_filter = ['uploaded_at']
    search_fields = ['project__project_number', 'filename', 'description']
    readonly_fields = ['uploaded_by', 'uploaded_at', 'file_size', 'content_type']


@admin.register(ProjectOrderPosition)
class ProjectOrderPositionAdmin(admin.ModelAdmin):
    list_display = ['project', 'order_item', 'supplier_order_created', 'production_order_created', 'visiview_order_created']
    list_filter = ['supplier_order_created', 'production_order_created', 'visiview_order_created']
    search_fields = ['project__project_number']
    raw_id_fields = ['project', 'order_item', 'supplier_order', 'production_order']
