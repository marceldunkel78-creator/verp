from django.contrib import admin
from .models import CalendarEvent, EventReminder


class EventReminderInline(admin.TabularInline):
    model = EventReminder
    extra = 1


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ['title', 'event_type', 'start_date', 'end_date', 'is_all_day', 'created_by', 'is_system_generated']
    list_filter = ['event_type', 'is_all_day', 'is_system_generated', 'is_active']
    search_fields = ['title', 'description']
    date_hierarchy = 'start_date'
    inlines = [EventReminderInline]


@admin.register(EventReminder)
class EventReminderAdmin(admin.ModelAdmin):
    list_display = ['event', 'recipient', 'notify_all', 'minutes_before', 'is_sent']
    list_filter = ['notify_all', 'is_sent', 'minutes_before']
