from django.contrib import admin
from .models import NotificationTask, NotificationTaskRecipient


class NotificationTaskRecipientInline(admin.TabularInline):
    model = NotificationTaskRecipient
    extra = 1
    autocomplete_fields = ['user']


@admin.register(NotificationTask)
class NotificationTaskAdmin(admin.ModelAdmin):
    list_display = ['name', 'get_module', 'status_field', 'trigger_status', 'is_active', 'recipient_count', 'created_at']
    list_filter = ['is_active', 'content_type', 'status_field']
    search_fields = ['name', 'trigger_status', 'message_template']
    readonly_fields = ['created_at', 'updated_at', 'created_by']
    inlines = [NotificationTaskRecipientInline]
    
    fieldsets = (
        ('Grundeinstellungen', {
            'fields': ('name', 'is_active')
        }),
        ('Auslöser', {
            'fields': ('content_type', 'status_field', 'trigger_status'),
            'description': 'Definiert bei welchem Statuswechsel die Mitteilung ausgelöst wird.'
        }),
        ('Nachricht', {
            'fields': ('message_template',),
            'description': 'Optionale Vorlage. Variablen: {object}, {old_status}, {new_status}, {changed_by}'
        }),
        ('Metadaten', {
            'fields': ('created_at', 'updated_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
    
    def get_module(self, obj):
        return f"{obj.content_type.app_label}.{obj.content_type.model}"
    get_module.short_description = 'Modul'
    
    def recipient_count(self, obj):
        return obj.recipients.count()
    recipient_count.short_description = 'Empfänger'
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(NotificationTaskRecipient)
class NotificationTaskRecipientAdmin(admin.ModelAdmin):
    list_display = ['user', 'task', 'notify_creator_only', 'notify_assigned_only', 'created_at']
    list_filter = ['task', 'notify_creator_only', 'notify_assigned_only']
    search_fields = ['user__username', 'user__email', 'task__name']
    autocomplete_fields = ['user', 'task']
