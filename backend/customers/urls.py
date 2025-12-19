from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, CustomerAddressViewSet, CustomerPhoneViewSet, CustomerEmailViewSet

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'addresses', CustomerAddressViewSet, basename='customer-address')
router.register(r'phones', CustomerPhoneViewSet, basename='customer-phone')
router.register(r'emails', CustomerEmailViewSet, basename='customer-email')

urlpatterns = [
    path('', include(router.urls)),
]
