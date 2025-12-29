from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import VSService, VSServicePrice, ServiceTicket, RMACase
from .serializers import (
    VSServiceListSerializer, VSServiceDetailSerializer, VSServiceCreateUpdateSerializer,
    VSServicePriceSerializer,
    ServiceTicketListSerializer, ServiceTicketDetailSerializer,
    RMACaseListSerializer, RMACaseDetailSerializer, RMACaseCreateUpdateSerializer
)


class VSServiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet für VS-Service Produkte
    """
    queryset = VSService.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['article_number', 'name', 'description', 'short_description']
    ordering_fields = ['article_number', 'name', 'created_at']
    ordering = ['article_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VSServiceListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VSServiceCreateUpdateSerializer
        return VSServiceDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def add_price(self, request, pk=None):
        """Fügt einen neuen Preis hinzu"""
        vs_service = self.get_object()
        serializer = VSServicePriceSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(vs_service=vs_service, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def prices(self, request, pk=None):
        """Gibt alle Preise zurück"""
        vs_service = self.get_object()
        prices = vs_service.prices.all()
        serializer = VSServicePriceSerializer(prices, many=True)
        return Response(serializer.data)


class VSServicePriceViewSet(viewsets.ModelViewSet):
    """
    ViewSet für VS-Service Preise
    """
    queryset = VSServicePrice.objects.all()
    serializer_class = VSServicePriceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['vs_service']
    ordering = ['-valid_from']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ServiceTicketViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Service Tickets (Upcoming)
    """
    queryset = ServiceTicket.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'customer', 'assigned_to']
    search_fields = ['ticket_number', 'title', 'description']
    ordering_fields = ['ticket_number', 'created_at', 'priority', 'status']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ServiceTicketListSerializer
        return ServiceTicketDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class RMACaseViewSet(viewsets.ModelViewSet):
    """
    ViewSet für RMA-Fälle
    """
    queryset = RMACase.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'customer', 'warranty_status', 'assigned_to']
    search_fields = ['rma_number', 'title', 'description', 'serial_number', 'product_name']
    ordering_fields = ['rma_number', 'created_at', 'status']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return RMACaseListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return RMACaseCreateUpdateSerializer
        return RMACaseDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
