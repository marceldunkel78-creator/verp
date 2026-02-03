from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    dashboard_stats, module_list, MediaBrowserViewSet,
    admin_delete_types, admin_delete_preview, admin_delete_execute
)

router = DefaultRouter()
router.register(r'media-browser', MediaBrowserViewSet, basename='media-browser')

urlpatterns = [
    path('dashboard/', dashboard_stats, name='dashboard-stats'),
    path('modules/', module_list, name='module-list'),
    # Admin Delete Module
    path('admin-delete/types/', admin_delete_types, name='admin-delete-types'),
    path('admin-delete/preview/', admin_delete_preview, name='admin-delete-preview'),
    path('admin-delete/execute/', admin_delete_execute, name='admin-delete-execute'),
] + router.urls

