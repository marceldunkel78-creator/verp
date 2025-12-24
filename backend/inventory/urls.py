from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import IncomingGoodsViewSet, InventoryItemViewSet

router = DefaultRouter()
router.register(r'incoming-goods', IncomingGoodsViewSet, basename='incoming-goods')
router.register(r'inventory-items', InventoryItemViewSet, basename='inventory-items')

urlpatterns = [
    path('', include(router.urls)),
]
