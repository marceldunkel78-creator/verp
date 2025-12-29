from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import VisiViewProduct, VisiViewProductPrice
from .serializers import (
    VisiViewProductListSerializer,
    VisiViewProductDetailSerializer,
    VisiViewProductCreateUpdateSerializer,
    VisiViewProductPriceSerializer
)


class VisiViewProductViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Produkte"""
    queryset = VisiViewProduct.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'product_category']
    search_fields = ['article_number', 'name', 'description']
    ordering_fields = ['article_number', 'name', 'created_at']
    ordering = ['article_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewProductListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewProductCreateUpdateSerializer
        return VisiViewProductDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VisiViewProductPriceViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Produkt Preise"""
    queryset = VisiViewProductPrice.objects.all()
    serializer_class = VisiViewProductPriceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product']
    ordering = ['-valid_from']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
