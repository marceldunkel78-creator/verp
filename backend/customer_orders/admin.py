from django.contrib import admin
from .models import CustomerOrder, CustomerOrderItem


class CustomerOrderItemInline(admin.TabularInline):
    model = CustomerOrderItem
    extra = 0


@admin.register(CustomerOrder)
class CustomerOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'customer', 'status', 'created_at')
    inlines = [CustomerOrderItemInline]
