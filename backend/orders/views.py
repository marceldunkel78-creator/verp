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
    filterset_fields = ['status', 'supplier']
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
    
    def update(self, request, *args, **kwargs):
        """
        Überschreibe update, um Änderungen an nicht-Datumsfeldern zu verhindern,
        wenn Status 'bestellt' oder höher ist.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Status-Hierarchie definieren
        protected_statuses = ['bestellt', 'bestaetigt', 'geliefert', 'bezahlt', 'zahlung_on_hold']
        
        # Wenn Status geschützt ist, nur Datumsfelder und Status erlauben
        if instance.status in protected_statuses:
            allowed_fields = ['order_date', 'confirmation_date', 'delivery_date', 'payment_date', 'status', 'notes']
            
            # Prüfe ob nicht-erlaubte Felder geändert werden sollen
            for field in request.data.keys():
                if field not in allowed_fields:
                    return Response(
                        {
                            'error': f'Bestellung mit Status "{instance.get_status_display()}" kann nicht mehr bearbeitet werden. '
                                    f'Nur Datumsfelder, Status und Notizen können geändert werden.'
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)
    
    def partial_update(self, request, *args, **kwargs):
        """Nutze die gleiche Logik für PATCH-Requests"""
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Generiere und lade Bestelldokument als PDF herunter"""
        try:
            order = self.get_object()
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
