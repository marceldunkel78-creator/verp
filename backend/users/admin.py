from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model

User = get_user_model()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin Interface für User Model"""
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Zusätzliche Informationen', {
            'fields': ('phone', 'position', 'department')
        }),
        ('Modulberechtigungen - Lesen', {
            'fields': (
                'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
                'can_read_customers', 'can_read_manufacturing', 'can_read_service'
            )
        }),
        ('Modulberechtigungen - Schreiben', {
            'fields': (
                'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
                'can_write_customers', 'can_write_manufacturing', 'can_write_service'
            )
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Zusätzliche Informationen', {
            'fields': ('email', 'phone', 'position', 'department')
        }),
    )
    
    list_display = ['username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
