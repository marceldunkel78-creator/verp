from django.urls import path
from .views import CompanySettingsViewSet

urlpatterns = [
    path('', CompanySettingsViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='company-settings-list'),
    path('<int:pk>/', CompanySettingsViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update'
    }), name='company-settings-detail'),
    # Logo entfernen. Muss hier explizit verdrahtet werden - das ist
    # kein DefaultRouter, sondern ein manuell gebautes ViewSet. Ein
    # @action-Dekorator allein erzeugt keine URL.
    path('clear-logo/', CompanySettingsViewSet.as_view({
        'post': 'clear_logo'
    }), name='company-clear-logo'),
]
