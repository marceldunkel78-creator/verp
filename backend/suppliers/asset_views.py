from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Asset
from .asset_serializers import AssetListSerializer, AssetDetailSerializer, AssetCreateUpdateSerializer
from .permissions import SupplierPermission


class AssetViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Assets (Anlagen)
    """
    queryset = Asset.objects.select_related('supplier', 'product_group').all()
    permission_classes = [SupplierPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['supplier', 'status', 'is_active', 'product_group']
    search_fields = ['name', 'visitron_part_number', 'serial_number', 'supplier_part_number']
    ordering_fields = ['visitron_part_number', 'name', 'purchase_date', 'status', 'created_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return AssetListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return AssetCreateUpdateSerializer
        return AssetDetailSerializer
