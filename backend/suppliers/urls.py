from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet, SupplierContactViewSet,
    TradingProductViewSet, SupplierProductViewSet,
    ProductGroupViewSet, PriceListViewSet, MaterialSupplyViewSet
)

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'contacts', SupplierContactViewSet, basename='supplier-contact')
router.register(r'products', TradingProductViewSet, basename='trading-product')
router.register(r'supplier-products', SupplierProductViewSet, basename='supplier-product')
router.register(r'product-groups', ProductGroupViewSet, basename='product-group')
router.register(r'price-lists', PriceListViewSet, basename='price-list')
router.register(r'material-supplies', MaterialSupplyViewSet, basename='material-supply')

urlpatterns = [
    path('', include(router.urls)),
]
