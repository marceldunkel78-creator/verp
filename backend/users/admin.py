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
        ('Modulberechtigungen', {
            'fields': (
                'can_access_accounting', 'can_access_hr', 'can_access_suppliers',
                'can_access_customers', 'can_access_manufacturing', 'can_access_service'
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
