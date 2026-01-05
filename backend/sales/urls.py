from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    QuotationViewSet, QuotationItemViewSet, 
    MarketingItemViewSet, MarketingItemFileViewSet,
    SalesTicketViewSet
)

router = DefaultRouter()
router.register(r'quotations', QuotationViewSet, basename='quotation')
router.register(r'quotation-items', QuotationItemViewSet, basename='quotation-item')
router.register(r'marketing-items', MarketingItemViewSet, basename='marketing-item')
router.register(r'marketing-files', MarketingItemFileViewSet, basename='marketing-file')
router.register(r'sales-tickets', SalesTicketViewSet, basename='sales-ticket')

urlpatterns = [
    path('', include(router.urls)),
]
