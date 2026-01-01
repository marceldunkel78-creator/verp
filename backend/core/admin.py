from django.contrib import admin
from .models import MediaTrash, DeletionLog


@admin.register(MediaTrash)
class MediaTrashAdmin(admin.ModelAdmin):
    list_display = ['filename', 'object_description', 'file_size', 'deleted_by', 'deleted_at', 'can_restore']
    list_filter = ['deleted_at', 'can_restore', 'content_type']
    search_fields = ['filename', 'object_description', 'original_path']
    readonly_fields = ['deleted_at', 'file_size']
    date_hierarchy = 'deleted_at'


@admin.register(DeletionLog)
class DeletionLogAdmin(admin.ModelAdmin):
    list_display = ['entity_type', 'entity_description', 'action', 'deleted_by', 'deleted_at', 'was_forced']
    list_filter = ['entity_type', 'action', 'was_forced', 'deleted_at']
    search_fields = ['entity_description', 'reason']
    readonly_fields = ['deleted_at']
    date_hierarchy = 'deleted_at'
