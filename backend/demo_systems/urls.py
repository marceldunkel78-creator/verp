from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DemoSystemViewSet,
    DemoDeviceViewSet,
    DemoConnectionViewSet,
    DemoDeviceComponentViewSet,
    DemoChangeLogViewSet,
    DemoBookingViewSet,
    DemoConfigTemplateViewSet,
)

router = DefaultRouter()
router.register(r'demo-systems', DemoSystemViewSet, basename='demo-system')
router.register(r'demo-devices', DemoDeviceViewSet, basename='demo-device')
router.register(r'demo-connections', DemoConnectionViewSet, basename='demo-connection')
router.register(r'demo-device-components', DemoDeviceComponentViewSet, basename='demo-device-component')
router.register(r'demo-change-logs', DemoChangeLogViewSet, basename='demo-change-log')
router.register(r'demo-bookings', DemoBookingViewSet, basename='demo-booking')
router.register(r'demo-config-templates', DemoConfigTemplateViewSet, basename='demo-config-template')

urlpatterns = [
    path('', include(router.urls)),
]