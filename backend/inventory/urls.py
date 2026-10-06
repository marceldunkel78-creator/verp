from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import IncomingGoodsViewSet, InventoryItemViewSet
from .inventory_sync_views import InventorySyncPreviewView, InventorySyncExecuteView

router = DefaultRouter()
router.register(r'incoming-goods', IncomingGoodsViewSet, basename='incoming-goods')
router.register(r'inventory-items', InventoryItemViewSet, basename='inventory-items')

urlpatterns = [
    # Manueller Excel-Lagerabgleich (Settings-Modul "Lager-Abgleich")
    path('inventory-sync/preview/', InventorySyncPreviewView.as_view(), name='inventory-sync-preview'),
    path('inventory-sync/execute/', InventorySyncExecuteView.as_view(), name='inventory-sync-execute'),
    path('', include(router.urls)),
]
