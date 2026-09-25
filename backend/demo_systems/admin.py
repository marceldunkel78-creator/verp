from django.contrib import admin
from .models import (
    DemoSystem,
    DemoDevice,
    DemoConnection,
    DemoDeviceComponent,
    DemoChangeLog,
    DemoBooking,
    DemoConfigTemplate,
)


class DemoDeviceInline(admin.TabularInline):
    model = DemoDevice
    extra = 0
    fields = ('device_type', 'name', 'manufacturer', 'serial_number', 'status', 'inventory_item')


class DemoBookingInline(admin.TabularInline):
    model = DemoBooking
    extra = 0
    fields = ('title', 'customer', 'start_date', 'end_date', 'is_cancelled')


@admin.register(DemoSystem)
class DemoSystemAdmin(admin.ModelAdmin):
    list_display = ('demo_number', 'name', 'location', 'responsible_employee', 'is_active', 'created_at')
    list_filter = ('is_active', 'location')
    search_fields = ('demo_number', 'name', 'description', 'location')
    inlines = [DemoDeviceInline, DemoBookingInline]


@admin.register(DemoDevice)
class DemoDeviceAdmin(admin.ModelAdmin):
    list_display = ('id', 'demo_system', 'device_type', 'name', 'manufacturer', 'serial_number', 'status', 'inventory_item')
    list_filter = ('device_type', 'status')
    search_fields = ('name', 'manufacturer', 'serial_number')


@admin.register(DemoConnection)
class DemoConnectionAdmin(admin.ModelAdmin):
    list_display = ('id', 'demo_system', 'from_device', 'from_side', 'to_device', 'to_side')
    list_filter = ('from_side', 'to_side')


@admin.register(DemoDeviceComponent)
class DemoDeviceComponentAdmin(admin.ModelAdmin):
    list_display = ('id', 'device', 'component_type', 'name', 'position', 'value')
    list_filter = ('component_type',)
    search_fields = ('name', 'value', 'comment')


@admin.register(DemoChangeLog)
class DemoChangeLogAdmin(admin.ModelAdmin):
    list_display = ('changed_at', 'demo_system', 'entity_type', 'entity_label', 'action', 'field_name', 'changed_by')
    list_filter = ('entity_type', 'action')
    search_fields = ('entity_label', 'field_name', 'old_value', 'new_value', 'comment')
    readonly_fields = ('changed_at',)


@admin.register(DemoBooking)
class DemoBookingAdmin(admin.ModelAdmin):
    list_display = ('demo_system', 'title', 'customer', 'start_date', 'end_date', 'is_cancelled')
    list_filter = ('is_cancelled',)
    search_fields = ('title', 'notes')


@admin.register(DemoConfigTemplate)
class DemoConfigTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_default', 'created_by', 'created_at')
    list_filter = ('is_default',)
    search_fields = ('name', 'description')