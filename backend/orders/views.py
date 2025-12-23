from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Order, OrderItem
from .serializers import (
    OrderListSerializer, OrderDetailSerializer,
    OrderCreateUpdateSerializer, OrderItemSerializer
)
from .pdf_generator import generate_order_pdf


class OrderPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class OrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Bestellungen
    """
    queryset = Order.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'supplier', 'order_type']
    search_fields = ['order_number', 'notes', 'supplier__company_name']
    ordering_fields = ['order_number', 'order_date', 'created_at', 'status']
    ordering = ['-created_at']
    pagination_class = OrderPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        year = self.request.query_params.get('year', None)
        if year:
            # Filter by year in order_number (format: B-003-12/25)
            year_suffix = year[-2:]  # Get last 2 digits (2025 -> 25)
            queryset = queryset.filter(order_number__endswith=f'/{year_suffix}')
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return OrderListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return OrderCreateUpdateSerializer
        return OrderDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        # Use create serializer to validate/save then return full detail serializer so the client gets id and order_number
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        order = serializer.instance
        # Refresh from DB to pick up file field updates applied by post_save signal
        order = Order.objects.get(pk=order.pk)
        detail_serializer = OrderDetailSerializer(order, context={'request': request})
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        # Ensure that on update we also return the full detail representation
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        order = serializer.instance
        # Refresh from DB to pick up file field updates applied by post_save signal
        order = Order.objects.get(pk=order.pk)
        detail_serializer = OrderDetailSerializer(order, context={'request': request})
        return Response(detail_serializer.data)

    def partial_update(self, request, *args, **kwargs):
        """Nutze die gleiche Logik für PATCH-Requests"""
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Generiere und lade Bestelldokument als PDF herunter"""
        print(f"download_pdf called for order pk={pk} by user={request.user}")
        try:
            order = self.get_object()
            # Don't allow generating a server-side PDF for online orders — they should upload a receipt
            if getattr(order, 'order_type', None) == 'online':
                print(f"download_pdf: rejected for online order id={order.id}, order_number={order.order_number}")
                return Response({'error': 'PDF generation is disabled for online orders. Please upload an order receipt.'}, status=404)

            print(f"Generating PDF for order id={order.id}, order_number={order.order_number}")
            return generate_order_pdf(order)
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"PDF Generation Error: {error_details}")
            from rest_framework.response import Response
            return Response(
                {'error': str(e), 'details': error_details}, 
                status=500
            )


class OrderItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Bestellpositionen
    """
    queryset = OrderItem.objects.all()
    serializer_class = OrderItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order']
