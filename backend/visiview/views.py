from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import VisiViewProduct, VisiViewProductPrice, VisiViewLicense, VisiViewOption
from .serializers import (
    VisiViewProductListSerializer,
    VisiViewProductDetailSerializer,
    VisiViewProductCreateUpdateSerializer,
    VisiViewProductPriceSerializer,
    VisiViewLicenseListSerializer,
    VisiViewLicenseDetailSerializer,
    VisiViewLicenseCreateUpdateSerializer,
    VisiViewOptionSerializer
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


class VisiViewOptionViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Optionen"""
    queryset = VisiViewOption.objects.all()
    serializer_class = VisiViewOptionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['bit_position', 'name', 'price']
    ordering = ['bit_position']


class VisiViewLicenseViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Lizenzen"""
    queryset = VisiViewLicense.objects.select_related('customer', 'created_by').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'is_demo', 'is_loaner', 'customer', 'is_outdated']
    search_fields = ['license_number', 'serial_number', 'customer_name_legacy', 'customer__last_name', 'distributor']
    ordering_fields = ['license_number', 'serial_number', 'delivery_date', 'created_at']
    ordering = ['-serial_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewLicenseListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewLicenseCreateUpdateSerializer
        return VisiViewLicenseDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def toggle_option(self, request, pk=None):
        """Aktiviert oder deaktiviert eine Option für die Lizenz"""
        license = self.get_object()
        bit_position = request.data.get('bit_position')
        enabled = request.data.get('enabled', True)
        
        if bit_position is None:
            return Response(
                {'error': 'bit_position ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            bit_position = int(bit_position)
            option = VisiViewOption.objects.get(bit_position=bit_position)
        except (ValueError, VisiViewOption.DoesNotExist):
            return Response(
                {'error': f'Option mit Bit-Position {bit_position} nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        license.set_option(bit_position, enabled)
        license.save()
        
        return Response({
            'success': True,
            'option': option.name,
            'enabled': enabled,
            'options_bitmask': license.options_bitmask,
            'options_upper_32bit': license.options_upper_32bit
        })
    
    @action(detail=False, methods=['get'])
    def by_customer(self, request):
        """Gibt alle Lizenzen eines Kunden zurück"""
        customer_id = request.query_params.get('customer_id')
        if not customer_id:
            return Response(
                {'error': 'customer_id ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        licenses = self.queryset.filter(customer_id=customer_id)
        serializer = VisiViewLicenseListSerializer(licenses, many=True)
        return Response(serializer.data)
