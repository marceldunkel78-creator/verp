from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VSServiceViewSet, VSServicePriceViewSet, ServiceTicketViewSet, RMACaseViewSet, TroubleshootingViewSet,
    RMAItemViewSet, RMAReturnViewSet, RMAItemPhotoViewSet, RMAAttachmentViewSet, RMACostLineItemViewSet,
    RMAManufacturerReturnViewSet
)
from .views_travel_report import TravelReportViewSet

router = DefaultRouter()
router.register(r'vs-service', VSServiceViewSet)
router.register(r'vs-service-prices', VSServicePriceViewSet)
router.register(r'tickets', ServiceTicketViewSet)
router.register(r'rma', RMACaseViewSet)
router.register(r'rma-items', RMAItemViewSet, basename='rma-item')
router.register(r'rma-returns', RMAReturnViewSet, basename='rma-return')
router.register(r'rma-manufacturer-returns', RMAManufacturerReturnViewSet, basename='rma-manufacturer-return')
router.register(r'rma-photos', RMAItemPhotoViewSet, basename='rma-photo')
router.register(r'rma-attachments', RMAAttachmentViewSet, basename='rma-attachment')
router.register(r'rma-cost-line-items', RMACostLineItemViewSet, basename='rma-cost-line-item')
router.register(r'troubleshooting', TroubleshootingViewSet)
router.register(r'travel-reports', TravelReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
