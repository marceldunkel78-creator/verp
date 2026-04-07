from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerLoanViewSet, CustomerLoanItemViewSet

router = DefaultRouter()
router.register(r'customer-loans', CustomerLoanViewSet, basename='customer-loan')
router.register(r'customer-loan-items', CustomerLoanItemViewSet, basename='customer-loan-item')

urlpatterns = [
    path('', include(router.urls)),
]
