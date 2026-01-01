from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VisiViewProductViewSet,
    VisiViewProductPriceViewSet,
    VisiViewLicenseViewSet,
    VisiViewOptionViewSet
)

router = DefaultRouter()
router.register(r'products', VisiViewProductViewSet, basename='visiview-products')
router.register(r'product-prices', VisiViewProductPriceViewSet, basename='visiview-product-prices')
router.register(r'licenses', VisiViewLicenseViewSet, basename='visiview-licenses')
router.register(r'options', VisiViewOptionViewSet, basename='visiview-options')

urlpatterns = [
    path('', include(router.urls)),
]
