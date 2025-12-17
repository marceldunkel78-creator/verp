from django.contrib import admin
from .models import ExchangeRate


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ['currency', 'rate_to_eur', 'last_updated']
    search_fields = ['currency']
    readonly_fields = ['last_updated']
