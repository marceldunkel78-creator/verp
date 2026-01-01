from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import dashboard_stats, module_list, MediaBrowserViewSet

router = DefaultRouter()
router.register(r'media-browser', MediaBrowserViewSet, basename='media-browser')

urlpatterns = [
    path('dashboard/', dashboard_stats, name='dashboard-stats'),
    path('modules/', module_list, name='module-list'),
] + router.urls

