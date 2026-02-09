from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ExchangeRateViewSet, CompanySettingsViewSet,
    CompanyAddressViewSet, CompanyManagerViewSet, CompanyBankAccountViewSet,
    PaymentTermViewSet, DeliveryTermViewSet, DeliveryInstructionViewSet,
    ProductCategoryViewSet, WarrantyTermViewSet
)
from .backup_views import DatabaseBackupView, DatabaseRestoreView, DatabaseStatsView
from .customer_sync_views import (
    CustomerSyncStatusView, CustomerSyncTestConnectionView,
    CustomerSyncPreviewView, CustomerSyncExecuteView
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
router.register(r'warranty-terms', WarrantyTermViewSet, basename='warranty-term')

urlpatterns = [
    path('', include(router.urls)),
    # Backup & Restore
    path('backup/', DatabaseBackupView.as_view(), name='database-backup'),
    path('restore/', DatabaseRestoreView.as_view(), name='database-restore'),
    path('database-stats/', DatabaseStatsView.as_view(), name='database-stats'),
    # Customer Sync mit SQL Server
    path('customer-sync/status/', CustomerSyncStatusView.as_view(), name='customer-sync-status'),
    path('customer-sync/test-connection/', CustomerSyncTestConnectionView.as_view(), name='customer-sync-test'),
    path('customer-sync/preview/', CustomerSyncPreviewView.as_view(), name='customer-sync-preview'),
    path('customer-sync/execute/', CustomerSyncExecuteView.as_view(), name='customer-sync-execute'),
]
