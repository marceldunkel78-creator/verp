from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ExchangeRateViewSet, CompanySettingsViewSet,
    CompanyAddressViewSet, CompanyManagerViewSet, CompanyBankAccountViewSet,
    PaymentTermViewSet, DeliveryTermViewSet, DeliveryInstructionViewSet,
    ProductCategoryViewSet
)

router = DefaultRouter()
router.register(r'exchange-rates', ExchangeRateViewSet, basename='exchange-rate')
router.register(r'company-settings', CompanySettingsViewSet, basename='company-settings')
router.register(r'company-addresses', CompanyAddressViewSet, basename='company-address')
router.register(r'company-managers', CompanyManagerViewSet, basename='company-manager')
router.register(r'company-bank-accounts', CompanyBankAccountViewSet, basename='company-bank-account')
router.register(r'payment-terms', PaymentTermViewSet, basename='payment-term')
router.register(r'delivery-terms', DeliveryTermViewSet, basename='delivery-term')
router.register(r'delivery-instructions', DeliveryInstructionViewSet, basename='delivery-instruction')
router.register(r'product-categories', ProductCategoryViewSet, basename='product-category')

urlpatterns = [
    path('', include(router.urls)),
]
