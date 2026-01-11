from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerOrderViewSet, 
    CustomerOrderItemViewSet,
    DeliveryNoteViewSet,
    InvoiceViewSet,
    PaymentViewSet,
    CustomerOrderCommissionRecipientViewSet,
    EmployeeCommissionViewSet
)

router = DefaultRouter()
router.register(r'customer-orders', CustomerOrderViewSet, basename='customerorder')
router.register(r'items', CustomerOrderItemViewSet, basename='customerorderitem')
router.register(r'delivery-notes', DeliveryNoteViewSet, basename='deliverynote')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'commission-recipients', CustomerOrderCommissionRecipientViewSet, basename='commissionrecipient')
router.register(r'employee-commissions', EmployeeCommissionViewSet, basename='employeecommission')

urlpatterns = [
    path('', include(router.urls)),
]
