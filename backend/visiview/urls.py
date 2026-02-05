from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VisiViewProductViewSet,
    VisiViewProductPriceViewSet,
    VisiViewLicenseViewSet,
    VisiViewOptionViewSet,
    VisiViewTicketViewSet,
    VisiViewMacroViewSet,
    VisiViewMacroExampleImageViewSet,
    VisiViewMacroChangeLogViewSet,
    MaintenanceTimeEntryViewSet,
    SupportedHardwareViewSet,
    SupportedHardwareUseCaseViewSet
)
from .production_views import VisiViewProductionOrderViewSet

router = DefaultRouter()
router.register(r'products', VisiViewProductViewSet, basename='visiview-products')
router.register(r'product-prices', VisiViewProductPriceViewSet, basename='visiview-product-prices')
router.register(r'licenses', VisiViewLicenseViewSet, basename='visiview-licenses')
router.register(r'options', VisiViewOptionViewSet, basename='visiview-options')
router.register(r'tickets', VisiViewTicketViewSet, basename='visiview-tickets')
router.register(r'macros', VisiViewMacroViewSet, basename='visiview-macros')
router.register(r'macro-images', VisiViewMacroExampleImageViewSet, basename='visiview-macro-images')
router.register(r'macro-changelog', VisiViewMacroChangeLogViewSet, basename='visiview-macro-changelog')
router.register(r'maintenance-time-entries', MaintenanceTimeEntryViewSet, basename='maintenance-time-entries')
router.register(r'production-orders', VisiViewProductionOrderViewSet, basename='visiview-production-orders')
router.register(r'supported-hardware', SupportedHardwareViewSet, basename='visiview-supported-hardware')
router.register(r'hardware-use-cases', SupportedHardwareUseCaseViewSet, basename='visiview-hardware-use-cases')

urlpatterns = [
    path('', include(router.urls)),
]
