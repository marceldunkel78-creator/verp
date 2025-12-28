from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
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
    filterset_fields = ['status', 'customer']
    search_fields = ['system_number', 'system_name', 'description', 'customer__name', 'customer__company_name']
    ordering_fields = ['system_number', 'system_name', 'created_at', 'customer__name']
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
        # projects reference the customers.CustomerSystem model; match by system_number/name
        projects = Project.objects.filter(
            Q(systems__system_number=system.system_number) |
            Q(systems__name__icontains=system.system_name) |
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
