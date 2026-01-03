from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import (
    VSHardware, VSHardwarePrice, VSHardwareMaterialItem,
    VSHardwareCostCalculation, VSHardwareDocument,
    ProductionOrderInbox, ProductionOrder
)
from .serializers import (
    VSHardwareListSerializer, VSHardwareDetailSerializer, VSHardwareCreateUpdateSerializer,
    VSHardwarePriceSerializer, VSHardwareMaterialItemSerializer,
    VSHardwareCostCalculationSerializer, VSHardwareDocumentSerializer,
    ProductionOrderInboxSerializer, ProductionOrderSerializer,
    PriceTransferSerializer
)


# ============================================
# VS-HARDWARE VIEWSETS
# ============================================

class VSHardwareViewSet(viewsets.ModelViewSet):
    """ViewSet für VS-Hardware Produkte"""
    # Pagination für infinite scroll
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = VSHardware.objects.all()
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['part_number', 'name', 'model_designation', 'description']
    ordering_fields = ['part_number', 'name', 'created_at']
    ordering = ['part_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VSHardwareListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VSHardwareCreateUpdateSerializer
        return VSHardwareDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def copy_material_list(self, request, pk=None):
        """Kopiert die Materialliste von einer anderen VS-Hardware"""
        source_id = request.data.get('source_id')
        if not source_id:
            return Response(
                {'error': 'source_id ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            source = VSHardware.objects.get(pk=source_id)
        except VSHardware.DoesNotExist:
            return Response(
                {'error': 'Quell-VS-Hardware nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        target = self.get_object()
        
        # Bestehende Materialien optional löschen
        if request.data.get('replace', False):
            target.material_items.all().delete()
        
        # Materialien kopieren
        new_items = []
        for item in source.material_items.all():
            new_item = VSHardwareMaterialItem.objects.create(
                vs_hardware=target,
                material_supply=item.material_supply,
                quantity=item.quantity,
                position=item.position,
                notes=item.notes
            )
            new_items.append(new_item)
        
        return Response({
            'message': f'{len(new_items)} Material-Positionen kopiert',
            'items': VSHardwareMaterialItemSerializer(new_items, many=True).data
        })


class VSHardwarePriceViewSet(viewsets.ModelViewSet):
    """ViewSet für VS-Hardware Preise"""
    queryset = VSHardwarePrice.objects.all()
    serializer_class = VSHardwarePriceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['vs_hardware']
    ordering = ['-valid_from']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VSHardwareMaterialItemViewSet(viewsets.ModelViewSet):
    """ViewSet für Material-Positionen"""
    queryset = VSHardwareMaterialItem.objects.all()
    serializer_class = VSHardwareMaterialItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['vs_hardware']
    ordering = ['position', 'id']
    
    @action(detail=False, methods=['post'])
    def bulk_update_positions(self, request):
        """Aktualisiert die Positionen mehrerer Items"""
        items = request.data.get('items', [])
        for item_data in items:
            try:
                item = VSHardwareMaterialItem.objects.get(pk=item_data.get('id'))
                item.position = item_data.get('position', item.position)
                item.save()
            except VSHardwareMaterialItem.DoesNotExist:
                continue
        return Response({'message': 'Positionen aktualisiert'})


class VSHardwareCostCalculationViewSet(viewsets.ModelViewSet):
    """ViewSet für Kostenkalkulationen"""
    queryset = VSHardwareCostCalculation.objects.all()
    serializer_class = VSHardwareCostCalculationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['vs_hardware', 'is_active']
    ordering = ['-created_at']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """Berechnet die Kalkulation neu"""
        calculation = self.get_object()
        calculation.calculate_costs()
        calculation.save()
        return Response(VSHardwareCostCalculationSerializer(calculation).data)
    
    @action(detail=True, methods=['post'])
    def transfer_price(self, request, pk=None):
        """Überträgt die Preise in die Preisliste"""
        calculation = self.get_object()
        
        serializer = PriceTransferSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            price = calculation.transfer_to_price(
                valid_from=serializer.validated_data['valid_from'],
                valid_until=serializer.validated_data.get('valid_until'),
                user=request.user
            )
            return Response({
                'message': 'Preise erfolgreich übertragen',
                'price': VSHardwarePriceSerializer(price).data
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class VSHardwareDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet für Fertigungsdokumente"""
    queryset = VSHardwareDocument.objects.all()
    serializer_class = VSHardwareDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['vs_hardware', 'document_type']
    ordering = ['document_type', 'title']
    
    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


# ============================================
# FERTIGUNGSAUFTRÄGE VIEWSETS
# ============================================

class ProductionOrderInboxViewSet(viewsets.ModelViewSet):
    """ViewSet für Fertigungsauftragseingang"""
    queryset = ProductionOrderInbox.objects.all()
    serializer_class = ProductionOrderInboxSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vs_hardware', 'customer_order']
    search_fields = ['vs_hardware__name', 'vs_hardware__part_number', 'notes']
    ordering = ['-received_at']
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Nimmt den Eingang an und erstellt einen Fertigungsauftrag"""
        inbox_item = self.get_object()
        
        if inbox_item.status != 'pending':
            return Response(
                {'error': 'Nur ausstehende Eingänge können angenommen werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            order = inbox_item.accept(user=request.user)
            return Response({
                'message': 'Fertigungsauftrag erstellt',
                'order': ProductionOrderSerializer(order).data,
                'inbox_item': ProductionOrderInboxSerializer(inbox_item).data
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Lehnt den Eingang ab"""
        inbox_item = self.get_object()
        
        if inbox_item.status != 'pending':
            return Response(
                {'error': 'Nur ausstehende Eingänge können abgelehnt werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            inbox_item.reject(
                user=request.user,
                reason=request.data.get('reason', '')
            )
            return Response({
                'message': 'Eingang abgelehnt',
                'inbox_item': ProductionOrderInboxSerializer(inbox_item).data
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ProductionOrderViewSet(viewsets.ModelViewSet):
    """ViewSet für Fertigungsaufträge"""
    queryset = ProductionOrder.objects.all()
    serializer_class = ProductionOrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vs_hardware', 'customer_order']
    search_fields = ['order_number', 'vs_hardware__name', 'vs_hardware__part_number', 'notes']
    ordering = ['-created_at']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Startet den Fertigungsauftrag"""
        order = self.get_object()
        
        if order.status not in ['created']:
            return Response(
                {'error': 'Auftrag kann nicht gestartet werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order.status = 'in_progress'
        order.actual_start = timezone.now().date()
        order.save()
        
        return Response(ProductionOrderSerializer(order).data)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Schließt den Fertigungsauftrag ab"""
        order = self.get_object()
        
        if order.status not in ['in_progress']:
            return Response(
                {'error': 'Auftrag kann nicht abgeschlossen werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order.status = 'completed'
        order.actual_end = timezone.now().date()
        order.save()
        
        return Response(ProductionOrderSerializer(order).data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Storniert den Fertigungsauftrag"""
        order = self.get_object()
        
        if order.status in ['completed', 'cancelled']:
            return Response(
                {'error': 'Auftrag kann nicht storniert werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order.status = 'cancelled'
        if request.data.get('reason'):
            order.notes = f"{order.notes}\n\nStornierungsgrund: {request.data['reason']}".strip()
        order.save()
        
        return Response(ProductionOrderSerializer(order).data)
