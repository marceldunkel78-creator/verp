from rest_framework import viewsets, filters
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from .models import Customer, CustomerAddress, CustomerPhone, CustomerEmail
from .serializers import (
    CustomerListSerializer, CustomerDetailSerializer,
    CustomerCreateUpdateSerializer, CustomerAddressSerializer,
    CustomerPhoneSerializer, CustomerEmailSerializer
)


class CustomerPagination(PageNumberPagination):
    page_size = 9
    page_size_query_param = 'page_size'
    max_page_size = 100


class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Kunden
    """
    queryset = Customer.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'language']
    search_fields = ['customer_number', 'first_name', 'last_name', 'title']
    ordering_fields = ['customer_number', 'last_name', 'first_name', 'created_at']
    ordering = ['last_name', 'first_name']
    pagination_class = CustomerPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Suche nach Stadt
        city = self.request.query_params.get('city', None)
        if city:
            queryset = queryset.filter(addresses__city__icontains=city).distinct()
        
        # Suche nach Land
        country = self.request.query_params.get('country', None)
        if country:
            queryset = queryset.filter(addresses__country=country).distinct()
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return CustomerCreateUpdateSerializer
        return CustomerDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CustomerAddressViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Kundenadressen
    """
    queryset = CustomerAddress.objects.all()
    serializer_class = CustomerAddressSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['customer', 'address_type', 'is_active', 'country']
    search_fields = ['university', 'institute', 'department', 'city', 'street']


class CustomerPhoneViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Telefonnummern
    """
    queryset = CustomerPhone.objects.all()
    serializer_class = CustomerPhoneSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['customer', 'phone_type', 'is_primary']


class CustomerEmailViewSet(viewsets.ModelViewSet):
    """
    ViewSet für E-Mail-Adressen
    """
    queryset = CustomerEmail.objects.all()
    serializer_class = CustomerEmailSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['customer', 'is_primary', 'newsletter_consent', 'marketing_consent']
