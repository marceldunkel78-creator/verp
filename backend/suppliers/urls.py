from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet, SupplierContactViewSet,
    TradingProductViewSet, SupplierProductViewSet,
    ProductCategoryViewSet
)

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'contacts', SupplierContactViewSet, basename='supplier-contact')
router.register(r'products', TradingProductViewSet, basename='trading-product')
router.register(r'supplier-products', SupplierProductViewSet, basename='supplier-product')
router.register(r'categories', ProductCategoryViewSet, basename='product-category')

urlpatterns = [
    path('', include(router.urls)),
]
