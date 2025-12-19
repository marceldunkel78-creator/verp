from django.contrib import admin
from .models import Customer, CustomerAddress, CustomerPhone, CustomerEmail


class CustomerAddressInline(admin.TabularInline):
    model = CustomerAddress
    extra = 1
    fields = ['address_type', 'is_active', 'university', 'institute', 'department',
              'street', 'house_number', 'postal_code', 'city', 'country']


class CustomerPhoneInline(admin.TabularInline):
    model = CustomerPhone
    extra = 1
    fields = ['phone_type', 'phone_number', 'is_primary']


class CustomerEmailInline(admin.TabularInline):
    model = CustomerEmail
    extra = 1
    fields = ['email', 'is_primary', 'newsletter_consent', 'marketing_consent']


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['customer_number', 'last_name', 'first_name', 'language', 'is_active', 'created_at']
    list_filter = ['is_active', 'language', 'created_at']
    search_fields = ['customer_number', 'first_name', 'last_name', 'title']
    readonly_fields = ['customer_number', 'created_by', 'created_at', 'updated_at']
    inlines = [CustomerAddressInline, CustomerPhoneInline, CustomerEmailInline]
    
    fieldsets = (
        ('Grunddaten', {
            'fields': ('customer_number', 'title', 'first_name', 'last_name', 'language')
        }),
        ('Status', {
            'fields': ('is_active', 'notes')
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(CustomerAddress)
class CustomerAddressAdmin(admin.ModelAdmin):
    list_display = ['customer', 'address_type', 'city', 'country', 'is_active']
    list_filter = ['address_type', 'is_active', 'country']
    search_fields = ['customer__first_name', 'customer__last_name', 'university', 'institute', 'city']


@admin.register(CustomerPhone)
class CustomerPhoneAdmin(admin.ModelAdmin):
    list_display = ['customer', 'phone_type', 'phone_number', 'is_primary']
    list_filter = ['phone_type', 'is_primary']
    search_fields = ['customer__first_name', 'customer__last_name', 'phone_number']


@admin.register(CustomerEmail)
class CustomerEmailAdmin(admin.ModelAdmin):
    list_display = ['customer', 'email', 'is_primary', 'newsletter_consent', 'marketing_consent']
    list_filter = ['is_primary', 'newsletter_consent', 'marketing_consent']
    search_fields = ['customer__first_name', 'customer__last_name', 'email']
