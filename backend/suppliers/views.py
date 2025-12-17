from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import (
    Supplier, SupplierContact, TradingProduct,
    SupplierProduct
)
from .serializers import (
    SupplierSerializer, SupplierCreateUpdateSerializer,
    SupplierContactSerializer, SupplierProductSerializer
)
from .trading_serializers import (
    TradingProductListSerializer,
    TradingProductDetailSerializer,
    TradingProductCreateUpdateSerializer
)
from .permissions import SupplierPermission


class SupplierViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanten
    """
    queryset = Supplier.objects.all()
    permission_classes = [IsAuthenticated, SupplierPermission]
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
    permission_classes = [IsAuthenticated, SupplierPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['supplier', 'contact_type']


class TradingProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Handelswaren
    """
    queryset = TradingProduct.objects.select_related('supplier').all()
    permission_classes = [IsAuthenticated, SupplierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['supplier', 'category', 'is_active', 'list_price_currency']
    search_fields = ['name', 'visitron_part_number', 'supplier_part_number', 'description']
    ordering_fields = ['visitron_part_number', 'name', 'category', 'supplier__company_name', 'price_valid_from', 'price_valid_until', 'created_at']
    ordering = ['visitron_part_number']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TradingProductDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return TradingProductCreateUpdateSerializer
        return TradingProductListSerializer
    
    @action(detail=True, methods=['get'])
    def price_history(self, request, pk=None):
        """
        Gibt die Preishistorie für ein Produkt zurück
        """
        product = self.get_object()
        # Hier könnte man später eine Price History Tabelle abfragen
        return Response({
            'current_price': product.list_price,
            'currency': product.list_price_currency,
            'valid_from': product.price_valid_from,
            'valid_until': product.price_valid_until,
        })
    
    @action(detail=True, methods=['post'])
    def calculate_price(self, request, pk=None):
        """
        Berechnet den Preis mit einem spezifischen Wechselkurs
        """
        product = self.get_object()
        exchange_rate = float(request.data.get('exchange_rate', 1.0))
        
        final_price = product.calculate_final_price(exchange_rate)
        serializer = TradingProductDetailSerializer(product)
        
        return Response({
            'product': serializer.data,
            'exchange_rate': exchange_rate,
            'final_price_converted': round(final_price, 2)
        })


class SupplierProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanten-Produkt Verknüpfungen
    """
    queryset = SupplierProduct.objects.all()
    serializer_class = SupplierProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['supplier', 'product', 'is_preferred_supplier']
