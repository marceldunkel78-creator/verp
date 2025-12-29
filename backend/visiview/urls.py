from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VisiViewProductViewSet, VisiViewProductPriceViewSet

router = DefaultRouter()
router.register(r'products', VisiViewProductViewSet, basename='visiview-products')
router.register(r'product-prices', VisiViewProductPriceViewSet, basename='visiview-product-prices')

urlpatterns = [
    path('', include(router.urls)),
]
