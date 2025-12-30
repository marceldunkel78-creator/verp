from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerOrderViewSet, 
    CustomerOrderItemViewSet,
    DeliveryNoteViewSet,
    InvoiceViewSet,
    PaymentViewSet
)

router = DefaultRouter()
router.register(r'customer-orders', CustomerOrderViewSet, basename='customerorder')
router.register(r'items', CustomerOrderItemViewSet, basename='customerorderitem')
router.register(r'delivery-notes', DeliveryNoteViewSet, basename='deliverynote')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')

urlpatterns = [
    path('', include(router.urls)),
]
