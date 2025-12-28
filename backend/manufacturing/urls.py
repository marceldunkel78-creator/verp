from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    VSHardwareViewSet, VSHardwarePriceViewSet, VSHardwareMaterialItemViewSet,
    VSHardwareCostCalculationViewSet, VSHardwareDocumentViewSet,
    ProductionOrderInboxViewSet, ProductionOrderViewSet
)

router = DefaultRouter()

# VS-Hardware
router.register(r'vs-hardware', VSHardwareViewSet, basename='vs-hardware')
router.register(r'vs-hardware-prices', VSHardwarePriceViewSet, basename='vs-hardware-prices')
router.register(r'vs-hardware-materials', VSHardwareMaterialItemViewSet, basename='vs-hardware-materials')
router.register(r'vs-hardware-calculations', VSHardwareCostCalculationViewSet, basename='vs-hardware-calculations')
router.register(r'vs-hardware-documents', VSHardwareDocumentViewSet, basename='vs-hardware-documents')

# Fertigungsaufträge
router.register(r'production-inbox', ProductionOrderInboxViewSet, basename='production-inbox')
router.register(r'production-orders', ProductionOrderViewSet, basename='production-orders')

urlpatterns = [
    path('', include(router.urls)),
]
