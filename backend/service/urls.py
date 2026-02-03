from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VSServiceViewSet, VSServicePriceViewSet, ServiceTicketViewSet, RMACaseViewSet, TroubleshootingViewSet
from .views_travel_report import TravelReportViewSet

router = DefaultRouter()
router.register(r'vs-service', VSServiceViewSet)
router.register(r'vs-service-prices', VSServicePriceViewSet)
router.register(r'tickets', ServiceTicketViewSet)
router.register(r'rma', RMACaseViewSet)
router.register(r'troubleshooting', TroubleshootingViewSet)
router.register(r'travel-reports', TravelReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
