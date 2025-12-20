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
]
