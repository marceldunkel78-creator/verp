from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductCollectionViewSet, ProductCollectionItemViewSet

router = DefaultRouter()
router.register(r'product-collections', ProductCollectionViewSet, basename='product-collection')
router.register(r'product-collection-items', ProductCollectionItemViewSet, basename='product-collection-item')

urlpatterns = [
    path('', include(router.urls)),
]
