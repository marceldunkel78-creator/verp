from django.contrib import admin
from .models import VisiViewProduct, VisiViewProductPrice


class VisiViewProductPriceInline(admin.TabularInline):
    model = VisiViewProductPrice
    extra = 0
    fields = ['purchase_price', 'list_price', 'valid_from', 'valid_until', 'notes']
    ordering = ['-valid_from']


@admin.register(VisiViewProduct)
class VisiViewProductAdmin(admin.ModelAdmin):
    list_display = ['article_number', 'name', 'product_category', 'is_active', 'created_at']
    list_filter = ['is_active', 'product_category']
    search_fields = ['article_number', 'name', 'description']
    readonly_fields = ['article_number', 'created_at', 'updated_at', 'created_by']
    inlines = [VisiViewProductPriceInline]
    
    fieldsets = (
        ('Produktinformationen', {
            'fields': ('article_number', 'name', 'description', 'product_category', 'unit')
        }),
        ('Status', {
            'fields': ('is_active',)
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


@admin.register(VisiViewProductPrice)
class VisiViewProductPriceAdmin(admin.ModelAdmin):
    list_display = ['product', 'purchase_price', 'list_price', 'valid_from', 'valid_until']
    list_filter = ['valid_from']
    search_fields = ['product__article_number', 'product__name']
    raw_id_fields = ['product']
