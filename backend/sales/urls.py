from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import QuotationViewSet, QuotationItemViewSet

router = DefaultRouter()
router.register(r'quotations', QuotationViewSet, basename='quotation')
router.register(r'quotation-items', QuotationItemViewSet, basename='quotation-item')

urlpatterns = [
    path('', include(router.urls)),
]
