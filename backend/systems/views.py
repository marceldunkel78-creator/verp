from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models
from django.db.models import Q

from .models import System, SystemComponent, SystemPhoto
from .serializers import (
    SystemListSerializer, SystemDetailSerializer, SystemCreateUpdateSerializer,
    SystemComponentSerializer, SystemPhotoSerializer
)
from .star_names import get_unused_star_name, search_star_names, IAU_STAR_NAMES


class SystemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Systeme
    """
    queryset = System.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'responsible_employee', 'location_city', 'location_country']
    # Use actual Customer model fields for related searches/ordering
    search_fields = [
        'system_number', 'system_name', 'description',
        'customer__customer_number', 'customer__first_name', 'customer__last_name',
        'location_city', 'location_university', 'location_institute', 'location_country',
        'visiview_license__serial_number', 'visiview_license__license_number'
    ]
    ordering_fields = ['system_number', 'system_name', 'created_at', 'customer__last_name']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SystemListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SystemCreateUpdateSerializer
        return SystemDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Return detailed view
        system = serializer.instance
        detail_serializer = SystemDetailSerializer(system, context={'request': request})
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Return detailed view
        detail_serializer = SystemDetailSerializer(instance, context={'request': request})
        return Response(detail_serializer.data)
    
    @action(detail=False, methods=['get'])
    def suggest_name(self, request):
        """Schlägt einen verfügbaren IAU-Sternnamen vor"""
        name = get_unused_star_name()
        return Response({'suggested_name': name})
    
    @action(detail=False, methods=['get'])
    def search_star_names(self, request):
        """Sucht in den IAU-Sternnamen"""
        query = request.query_params.get('q', '')
        names = search_star_names(query)
        return Response({'names': names})
    
    @action(detail=False, methods=['get'])
    def all_star_names(self, request):
        """Gibt alle IAU-Sternnamen zurück"""
        return Response({'names': IAU_STAR_NAMES})
    
    @action(detail=True, methods=['get'])
    def related_items(self, request, pk=None):
        """Gibt alle verknüpften Elemente zurück (Projekte, Aufträge, etc.)"""
        system = self.get_object()
        
        # Projekte mit diesem System
        from projects.models import Project
        # Project.systems is M2M to systems.System
        projects = Project.objects.filter(
            Q(systems=system) |
            Q(description__icontains=system.system_number)
        ).distinct().values('id', 'project_number', 'name', 'status', 'created_at')[:20]
        
        # Customer Orders für diesen Kunden (später: direkte Verknüpfung)
        from customer_orders.models import CustomerOrder
        customer_orders = CustomerOrder.objects.filter(
            customer=system.customer
        ).values('id', 'order_number', 'status', 'order_date', 'created_at')[:20]
        
        # Bestellungen (später: direkte Verknüpfung)
        # Hier könnten später Bestellungen verknüpft werden, die für dieses System sind
        
        return Response({
            'projects': list(projects),
            'customer_orders': list(customer_orders),
            'orders': [],  # Später: verknüpfte Lieferantenbestellungen
            'visiview_licenses': [],  # Noch zu erstellen
            'service_tickets': [],  # Noch zu erstellen
            'visiview_tickets': [],  # Noch zu erstellen
        })
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Gibt die komplette Historie eines Systems zurück (Projekte, Aufträge, Bestellungen, Tickets)"""
        system = self.get_object()
        
        # Projekte mit diesem System
        from projects.models import Project
        projects = Project.objects.filter(
            Q(systems=system) |
            Q(customer=system.customer, description__icontains=system.system_number)
        ).distinct().values('id', 'project_number', 'name', 'status', 'created_at')[:50]
        
        # Kundenaufträge (Customer Orders)
        from customer_orders.models import CustomerOrder
        customer_orders = CustomerOrder.objects.filter(
            Q(customer=system.customer)
        ).order_by('-created_at').values('id', 'order_number', 'status', 'order_date', 'created_at')[:50]
        
        # Einkaufsbestellungen (Orders)
        from orders.models import Order
        # Orders related to this system via inventory items
        orders = Order.objects.filter(
            Q(inventory_items__system=system) |
            Q(inventory_items__system_number=system.system_number)
        ).distinct().order_by('-created_at').values('id', 'order_number', 'status', 'order_date', 'confirmed_total', 'created_at')[:50]
        
        # Service Tickets
        from service.models import ServiceTicket
        service_tickets = ServiceTicket.objects.filter(
            Q(linked_system=system) |
            Q(customer=system.customer, description__icontains=system.system_number)
        ).distinct().order_by('-created_at').values('id', 'ticket_number', 'title', 'status', 'priority', 'created_at')[:50]
        
        return Response({
            'projects': list(projects),
            'customer_orders': list(customer_orders),
            'orders': list(orders),
            'service_tickets': list(service_tickets),
        })
    
    @action(detail=True, methods=['get'])
    def customer_inventory(self, request, pk=None):
        """Gibt alle Warenlager-Items des Kunden für dieses System zurück (alle Status)"""
        system = self.get_object()
        
        from inventory.models import InventoryItem
        # Alle Warenlager-Items des Kunden ohne Status-Filter
        items = InventoryItem.objects.filter(
            customer=system.customer
        ).select_related('product_category').order_by('name')
        
        data = []
        for item in items:
            data.append({
                'id': item.id,
                'inventory_number': item.inventory_number,
                'name': item.name,
                'serial_number': item.serial_number,
                'article_number': item.article_number,
                'product_category': item.product_category.code if item.product_category else None,
                'product_category_name': item.product_category.name if item.product_category else item.item_category,
                'manufacturer': getattr(item, 'manufacturer', ''),
                'description': item.description,
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def search_orders(self, request):
        """Sucht nach Kundenaufträgen anhand von Kundennamen oder Auftragsnummer"""
        search = request.query_params.get('search', '')
        if not search or len(search) < 2:
            return Response([])
        
        from customer_orders.models import CustomerOrder
        from django.db.models import Q
        
        orders = CustomerOrder.objects.filter(
            Q(order_number__icontains=search) |
            Q(customer__first_name__icontains=search) |
            Q(customer__last_name__icontains=search) |
            Q(customer__customer_number__icontains=search)
        ).select_related('customer').order_by('-created_at')[:20]
        
        data = []
        for order in orders:
            customer_name = ''
            if order.customer:
                parts = [order.customer.title or '', order.customer.first_name or '', order.customer.last_name or '']
                customer_name = ' '.join([p for p in parts if p]).strip()
            
            data.append({
                'id': order.id,
                'order_number': order.order_number,
                'customer_id': order.customer_id,
                'customer_name': customer_name,
                'customer_number': order.customer.customer_number if order.customer else None,
                'order_date': order.order_date,
                'status': order.status,
                'total': str(order.total_net) if order.total_net else None,
                'position_count': order.items.count()
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def order_positions(self, request):
        """Gibt die Positionen eines Auftrags zurück"""
        order_id = request.query_params.get('order_id')
        if not order_id:
            return Response({'error': 'order_id required'}, status=400)
        
        from customer_orders.models import CustomerOrder, CustomerOrderItem
        
        try:
            order = CustomerOrder.objects.get(id=order_id)
        except CustomerOrder.DoesNotExist:
            return Response({'error': 'Order not found'}, status=404)
        
        positions = order.items.filter(is_group_header=False).order_by('position')
        
        data = []
        for pos in positions:
            data.append({
                'id': pos.id,
                'position': pos.position,
                'position_display': pos.position_display or str(pos.position),
                'article_number': pos.article_number,
                'name': pos.name,
                'description': pos.description,
                'serial_number': pos.serial_number,
                'quantity': str(pos.quantity),
                'unit': pos.unit,
                'final_price': str(pos.final_price),
            })
        
        return Response(data)
    
    @action(detail=True, methods=['post'])
    def import_order_positions(self, request, pk=None):
        """Importiert Auftragspositionen als Systemkomponenten"""
        system = self.get_object()
        position_ids = request.data.get('position_ids', [])
        
        if not position_ids:
            return Response({'error': 'position_ids required'}, status=400)
        
        from customer_orders.models import CustomerOrderItem
        
        positions = CustomerOrderItem.objects.filter(id__in=position_ids)
        
        # Ermittle höchste Position im System
        max_pos = system.components.aggregate(
            max_pos=models.Max('position')
        )['max_pos'] or 0
        
        created_components = []
        for pos in positions:
            max_pos += 1
            component = SystemComponent.objects.create(
                system=system,
                position=max_pos,
                component_type='custom',
                name=pos.name,
                description=pos.description,
                serial_number=pos.serial_number,
                category='other',  # Standardkategorie, kann später angepasst werden
                notes=f'Importiert aus Auftrag {pos.order.order_number}, Pos. {pos.position}'
            )
            created_components.append({
                'id': component.id,
                'name': component.name,
                'position': component.position
            })
        
        return Response({
            'success': True,
            'created_count': len(created_components),
            'components': created_components
        })


class SystemComponentViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Systemkomponenten
    """
    queryset = SystemComponent.objects.all()
    serializer_class = SystemComponentSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['system', 'component_type', 'category']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        system_id = self.request.query_params.get('system')
        if system_id:
            queryset = queryset.filter(system_id=system_id)
        return queryset


class SystemPhotoViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Systemfotos
    """
    queryset = SystemPhoto.objects.all()
    serializer_class = SystemPhotoSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['system']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        system_id = self.request.query_params.get('system')
        if system_id:
            queryset = queryset.filter(system_id=system_id)
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def set_primary(self, request, pk=None):
        """Setzt dieses Foto als Hauptbild"""
        photo = self.get_object()
        photo.is_primary = True
        photo.save()  # save() kümmert sich um das Entfernen anderer Hauptbilder
        return Response({'status': 'ok'})
