from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerOrderViewSet, CustomerOrderItemViewSet

router = DefaultRouter()
router.register(r'customer-orders', CustomerOrderViewSet, basename='customerorder')
router.register(r'items', CustomerOrderItemViewSet, basename='customerorderitem')

urlpatterns = [
    path('', include(router.urls)),
]
