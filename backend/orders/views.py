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
    
    @action(detail=True, methods=['post'])
    def transfer_to_incoming_goods(self, request, pk=None):
        """Überträgt Bestellpositionen in den Wareneingang"""
        from inventory.models import IncomingGoods
        
        order = self.get_object()
        
        # Prüfe ob Order bestätigt ist
        if order.status not in ['bestaetigt', 'geliefert', 'bezahlt']:
            return Response(
                {'error': 'Nur bestätigte Bestellungen können in den Wareneingang übertragen werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Hole die zu übertragenden Positionen aus dem Request
        item_ids = request.data.get('item_ids', [])
        
        if not item_ids:
            return Response(
                {'error': 'Keine Positionen zum Übertragen ausgewählt.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        transferred_count = 0
        errors = []
        
        for item_id in item_ids:
            try:
                order_item = OrderItem.objects.get(id=item_id, order=order)
                
                # Prüfe ob bereits im Wareneingang
                existing = IncomingGoods.objects.filter(order_item=order_item, is_transferred=False).first()
                if existing:
                    errors.append(f'Position {order_item.position} ist bereits im Wareneingang.')
                    continue
                
                # Erstelle Wareneingangsposition
                IncomingGoods.objects.create(
                    order_item=order_item,
                    article_number=order_item.article_number,
                    name=order_item.name,
                    description=order_item.description,
                    delivered_quantity=order_item.quantity,
                    unit=order_item.unit,
                    purchase_price=order_item.final_price,
                    currency=order_item.currency,
                    item_function='TRADING_GOOD',  # Default, kann im Wareneingang editiert werden
                    item_category='',
                    serial_number='',
                    trading_product=order_item.trading_product,
                    material_supply=order_item.material_supply,
                    supplier=order.supplier,
                    order_number=order.order_number,
                    customer_order_number=order_item.customer_order_number,
                    management_info=order_item.management_info or {},
                    created_by=request.user
                )
                
                transferred_count += 1
                
            except OrderItem.DoesNotExist:
                errors.append(f'Position mit ID {item_id} nicht gefunden.')
            except Exception as e:
                errors.append(f'Fehler bei Position ID {item_id}: {str(e)}')
        
        response_data = {
            'message': f'{transferred_count} Position(en) wurden in den Wareneingang übertragen.',
            'transferred_count': transferred_count
        }
        
        if errors:
            response_data['errors'] = errors
        
        return Response(response_data, status=status.HTTP_200_OK)


class OrderItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Bestellpositionen
    """
    queryset = OrderItem.objects.all()
    serializer_class = OrderItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order']
