from rest_framework import viewsets, filters, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from .models import (
    Dealer, DealerDocument, DealerEmployee, 
    DealerCustomerSystem, DealerCustomerSystemTicket,
    DealerPriceListLog, DealerQuotationLog
)
from .serializers import (
    DealerListSerializer, DealerDetailSerializer,
    DealerCreateUpdateSerializer, DealerDocumentSerializer,
    DealerEmployeeSerializer, DealerCustomerSystemSerializer,
    DealerCustomerSystemTicketSerializer,
    DealerPriceListLogSerializer, DealerQuotationLogSerializer
)


class DealerPagination(PageNumberPagination):
    page_size = 9
    page_size_query_param = 'page_size'
    max_page_size = 100


class DealerViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Händler
    """
    queryset = Dealer.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'country', 'language']
    search_fields = ['dealer_number', 'company_name', 'city']
    ordering_fields = ['dealer_number', 'company_name', 'created_at', 'dealer_discount']
    ordering = ['company_name']
    pagination_class = DealerPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Suche nach Stadt
        city = self.request.query_params.get('city', None)
        if city:
            queryset = queryset.filter(city__icontains=city)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return DealerListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return DealerCreateUpdateSerializer
        return DealerDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def employees(self, request, pk=None):
        """Hole alle Mitarbeiter eines Händlers"""
        dealer = self.get_object()
        employees = dealer.employees.all()
        serializer = DealerEmployeeSerializer(employees, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def customer_systems(self, request, pk=None):
        """Hole alle Kundensysteme eines Händlers"""
        dealer = self.get_object()
        systems = dealer.customer_systems.all()
        serializer = DealerCustomerSystemSerializer(systems, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        """Hole alle Dokumente eines Händlers"""
        dealer = self.get_object()
        documents = dealer.documents.all()
        serializer = DealerDocumentSerializer(documents, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """Hole alle Protokolle (Preislisten und Angebote) eines Händlers"""
        dealer = self.get_object()
        pricelist_logs = DealerPriceListLogSerializer(dealer.pricelist_logs.all(), many=True).data
        quotation_logs = DealerQuotationLogSerializer(dealer.quotation_logs.all(), many=True).data
        return Response({
            'pricelist_logs': pricelist_logs,
            'quotation_logs': quotation_logs
        })


class DealerDocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Händler-Dokumente
    """
    queryset = DealerDocument.objects.all()
    serializer_class = DealerDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['dealer', 'document_type']
    
    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class DealerEmployeeViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Händler-Mitarbeiter
    """
    queryset = DealerEmployee.objects.all()
    serializer_class = DealerEmployeeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['dealer', 'is_primary', 'is_active', 'language']
    search_fields = ['first_name', 'last_name', 'email']


class DealerCustomerSystemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Dealer-Kundensysteme
    """
    queryset = DealerCustomerSystem.objects.all()
    serializer_class = DealerCustomerSystemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['dealer']
    search_fields = ['customer_name', 'visiview_license_id', 'system_hardware']


class DealerCustomerSystemTicketViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Dealer-Kundensystem-Tickets
    """
    queryset = DealerCustomerSystemTicket.objects.all()
    serializer_class = DealerCustomerSystemTicketSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['dealer_customer_system', 'ticket_type']


class DealerPriceListLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Preislisten-Protokolle
    """
    queryset = DealerPriceListLog.objects.all()
    serializer_class = DealerPriceListLogSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['dealer', 'pricelist_type']
    ordering_fields = ['sent_date', 'created_at']
    ordering = ['-sent_date']
    
    def perform_create(self, serializer):
        serializer.save(sent_by=self.request.user)


class DealerQuotationLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Angebots-Protokolle
    """
    queryset = DealerQuotationLog.objects.all()
    serializer_class = DealerQuotationLogSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['dealer', 'quotation']
    ordering_fields = ['sent_date', 'created_at']
    ordering = ['-sent_date']
    
    def perform_create(self, serializer):
        serializer.save(sent_by=self.request.user)
