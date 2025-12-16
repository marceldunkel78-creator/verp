from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import (
    Supplier, SupplierContact, TradingProduct,
    SupplierProduct, ProductCategory
)
from .serializers import (
    SupplierSerializer, SupplierCreateUpdateSerializer,
    SupplierContactSerializer, TradingProductSerializer,
    TradingProductDetailSerializer, SupplierProductSerializer,
    ProductCategorySerializer
)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanten
    """
    queryset = Supplier.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['company_name', 'email', 'phone']
    ordering_fields = ['company_name', 'created_at']
    ordering = ['company_name']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SupplierCreateUpdateSerializer
        return SupplierSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def add_contact(self, request, pk=None):
        """Fügt einen neuen Kontakt zu einem Lieferanten hinzu"""
        supplier = self.get_object()
        serializer = SupplierContactSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(supplier=supplier)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def link_product(self, request, pk=None):
        """Verknüpft ein Produkt mit einem Lieferanten"""
        supplier = self.get_object()
        serializer = SupplierProductSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(supplier=supplier)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SupplierContactViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanten-Kontakte
    """
    queryset = SupplierContact.objects.all()
    serializer_class = SupplierContactSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['supplier', 'contact_type']


class TradingProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Vertriebswaren
    """
    queryset = TradingProduct.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'article_number', 'description']
    ordering_fields = ['name', 'article_number', 'created_at']
    ordering = ['name']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TradingProductDetailSerializer
        return TradingProductSerializer


class SupplierProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanten-Produkt Verknüpfungen
    """
    queryset = SupplierProduct.objects.all()
    serializer_class = SupplierProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['supplier', 'product', 'is_preferred_supplier']


class ProductCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Produktkategorien
    """
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'description']
    ordering = ['name']
