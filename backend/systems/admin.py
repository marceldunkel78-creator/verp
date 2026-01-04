from django.contrib import admin
from .models import System, SystemComponent, SystemPhoto


class SystemComponentInline(admin.TabularInline):
    model = SystemComponent
    extra = 0
    fields = ['position', 'name', 'category', 'manufacturer', 'serial_number', 'version']


class SystemPhotoInline(admin.TabularInline):
    model = SystemPhoto
    extra = 0
    fields = ['title', 'image', 'is_primary', 'position']


@admin.register(System)
class SystemAdmin(admin.ModelAdmin):
    list_display = ['system_number', 'system_name', 'customer', 'status', 'location', 'created_at']
    list_filter = ['status', 'customer']
    search_fields = ['system_number', 'system_name', 'customer__name', 'customer__company_name']
    readonly_fields = ['system_number', 'created_at', 'updated_at', 'created_by']
    inlines = [SystemComponentInline, SystemPhotoInline]
    
    fieldsets = (
        ('Basisinformationen', {
            'fields': ('system_number', 'system_name', 'customer', 'description')
        }),
        ('Status & Standort', {
            'fields': ('status', 'location', 'installation_date')
        }),
        ('Notizen', {
            'fields': ('notes',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(SystemComponent)
class SystemComponentAdmin(admin.ModelAdmin):
    list_display = ['system', 'name', 'category', 'manufacturer', 'serial_number']
    list_filter = ['category', 'component_type']
    search_fields = ['name', 'manufacturer', 'serial_number', 'system__system_number']


@admin.register(SystemPhoto)
class SystemPhotoAdmin(admin.ModelAdmin):
    list_display = ['system', 'title', 'is_primary', 'position', 'created_at']
    list_filter = ['is_primary', 'system']
    search_fields = ['title', 'system__system_number']
