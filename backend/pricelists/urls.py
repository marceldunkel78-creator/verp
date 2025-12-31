from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SalesPriceListViewSet

router = DefaultRouter()
router.register(r'', SalesPriceListViewSet, basename='salespricelist')

urlpatterns = [
    path('', include(router.urls)),
]
