from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VisiViewProductViewSet,
    VisiViewProductPriceViewSet,
    VisiViewLicenseViewSet,
    VisiViewOptionViewSet,
    VisiViewTicketViewSet,
    VisiViewMacroViewSet,
    VisiViewMacroExampleImageViewSet,
    VisiViewMacroChangeLogViewSet
)

router = DefaultRouter()
router.register(r'products', VisiViewProductViewSet, basename='visiview-products')
router.register(r'product-prices', VisiViewProductPriceViewSet, basename='visiview-product-prices')
router.register(r'licenses', VisiViewLicenseViewSet, basename='visiview-licenses')
router.register(r'options', VisiViewOptionViewSet, basename='visiview-options')
router.register(r'tickets', VisiViewTicketViewSet, basename='visiview-tickets')
router.register(r'macros', VisiViewMacroViewSet, basename='visiview-macros')
router.register(r'macro-images', VisiViewMacroExampleImageViewSet, basename='visiview-macro-images')
router.register(r'macro-changelog', VisiViewMacroChangeLogViewSet, basename='visiview-macro-changelog')

urlpatterns = [
    path('', include(router.urls)),
]
