from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ExchangeRateViewSet, CompanySettingsViewSet,
    CompanyAddressViewSet, CompanyManagerViewSet, CompanyBankAccountViewSet,
    PaymentTermViewSet, DeliveryTermViewSet, DeliveryInstructionViewSet,
    ProductCategoryViewSet, WarrantyTermViewSet, ChecklistTemplateViewSet
)
from .backup_views import DatabaseBackupView, DatabaseRestoreView, DatabaseStatsView
from .customer_sync_views import (
    CustomerSyncStatusView, CustomerSyncTestConnectionView,
    CustomerSyncPreviewView, CustomerSyncExecuteView
)
from .order_import_views import (
    OrderImportStatusView, OrderImportTestConnectionView,
    OrderImportPreviewView, OrderImportExecuteView
)
from .redmine_sync_views import (
    RedmineSyncStatusView, RedmineSyncTestConnectionView,
    RedmineSyncPreviewView, RedmineSyncExecuteView
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
router.register(r'checklist-templates', ChecklistTemplateViewSet, basename='checklist-template')

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
    # Legacy Order Import aus SQL Server
    path('order-import/status/', OrderImportStatusView.as_view(), name='order-import-status'),
    path('order-import/test-connection/', OrderImportTestConnectionView.as_view(), name='order-import-test'),
    path('order-import/preview/', OrderImportPreviewView.as_view(), name='order-import-preview'),
    path('order-import/execute/', OrderImportExecuteView.as_view(), name='order-import-execute'),
    # Redmine Ticket-Sync
    path('redmine-sync/status/', RedmineSyncStatusView.as_view(), name='redmine-sync-status'),
    path('redmine-sync/test-connection/', RedmineSyncTestConnectionView.as_view(), name='redmine-sync-test'),
    path('redmine-sync/preview/', RedmineSyncPreviewView.as_view(), name='redmine-sync-preview'),
    path('redmine-sync/execute/', RedmineSyncExecuteView.as_view(), name='redmine-sync-execute'),
]
