from django.contrib import admin
from .models import ProductCollection, ProductCollectionItem


class ProductCollectionItemInline(admin.TabularInline):
    model = ProductCollectionItem
    extra = 0
    readonly_fields = ['article_number', 'name', 'total_purchase_price', 'total_list_price']
    fields = ['position', 'article_number', 'name', 'quantity', 'unit', 
              'unit_purchase_price', 'unit_list_price', 'total_purchase_price', 'total_list_price']


@admin.register(ProductCollection)
class ProductCollectionAdmin(admin.ModelAdmin):
    list_display = [
        'collection_number', 'title', 'product_source', 'supplier',
        'total_purchase_price', 'total_list_price', 'is_active', 'created_at'
    ]
    list_filter = ['is_active', 'product_source', 'product_category', 'supplier']
    search_fields = ['collection_number', 'title', 'title_en', 'description']
    readonly_fields = ['collection_number', 'total_purchase_price', 'total_list_price', 
                       'price_valid_until', 'created_at', 'updated_at']
    inlines = [ProductCollectionItemInline]
    
    fieldsets = (
        ('Grundinformationen', {
            'fields': ('collection_number', 'title', 'title_en', 'is_active')
        }),
        ('Beschreibungen', {
            'fields': (
                'short_description', 'short_description_en',
                'description', 'description_en'
            )
        }),
        ('Klassifizierung', {
            'fields': ('product_source', 'supplier', 'product_category', 'unit')
        }),
        ('Preise', {
            'fields': ('total_purchase_price', 'total_list_price', 'price_valid_until'),
            'classes': ('collapse',)
        }),
        ('Angebotstexte', {
            'fields': (
                'quotation_text_short', 'quotation_text_short_en',
                'quotation_text_long', 'quotation_text_long_en'
            ),
            'classes': ('collapse',)
        }),
        ('Dokumente', {
            'fields': ('manual',)
        }),
        ('Metadaten', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ProductCollectionItem)
class ProductCollectionItemAdmin(admin.ModelAdmin):
    list_display = [
        'collection', 'position', 'article_number', 'name', 
        'quantity', 'unit_list_price', 'total_list_price'
    ]
    list_filter = ['collection__product_source', 'collection']
    search_fields = ['article_number', 'name', 'collection__collection_number']
    readonly_fields = ['total_purchase_price', 'total_list_price']
