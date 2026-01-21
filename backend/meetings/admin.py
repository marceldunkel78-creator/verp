from django.contrib import admin
from .models import (
    MondayMeetingTodo, SalesMeetingTodo, VisiViewMeetingTodo
)


@admin.register(MondayMeetingTodo)
class MondayMeetingTodoAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_completed', 'created_at', 'created_by']
    list_filter = ['is_completed', 'created_at']
    search_fields = ['title', 'description']
    ordering = ['-created_at']


@admin.register(SalesMeetingTodo)
class SalesMeetingTodoAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_completed', 'completed_at', 'created_at', 'created_by']
    list_filter = ['is_completed', 'created_at']
    search_fields = ['title', 'description']
    ordering = ['-created_at']


@admin.register(VisiViewMeetingTodo)
class VisiViewMeetingTodoAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_completed', 'created_at', 'created_by']
    list_filter = ['is_completed', 'created_at']
    search_fields = ['title', 'description']
    ordering = ['-created_at']
