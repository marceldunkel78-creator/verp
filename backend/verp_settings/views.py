from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    ExchangeRate, CompanySettings, CompanyAddress,
    CompanyManager, CompanyBankAccount, PaymentTerm,
    DeliveryTerm, DeliveryInstruction
)
from .serializers import (
    ExchangeRateSerializer, CompanySettingsSerializer,
    CompanySettingsUpdateSerializer, CompanyAddressSerializer,
    CompanyManagerSerializer, CompanyBankAccountSerializer,
    PaymentTermSerializer, DeliveryTermSerializer, DeliveryInstructionSerializer
)


class CompanySettingsViewSet(viewsets.ViewSet):
    """
    ViewSet für Firmeneinstellungen (Singleton)
    """
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """GET /company-settings/ - Gibt die Firmeneinstellungen zurück"""
        settings = CompanySettings.load()
        serializer = CompanySettingsSerializer(settings)
        return Response(serializer.data)
    
    def retrieve(self, request, pk=None):
        """GET /company-settings/1/ - Gibt die Firmeneinstellungen zurück"""
        settings = CompanySettings.load()
        serializer = CompanySettingsSerializer(settings)
        return Response(serializer.data)
    
    def update(self, request, pk=None):
        """PUT /company-settings/1/ - Aktualisiert die Firmeneinstellungen"""
        settings = CompanySettings.load()
        serializer = CompanySettingsUpdateSerializer(settings, data=request.data)
        if serializer.is_valid():
            serializer.save()
            # Return mit allen nested objects
            response_serializer = CompanySettingsSerializer(settings)
            return Response(response_serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def partial_update(self, request, pk=None):
        """PATCH /company-settings/1/ - Partielles Update"""
        settings = CompanySettings.load()
        serializer = CompanySettingsUpdateSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            response_serializer = CompanySettingsSerializer(settings)
            return Response(response_serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CompanyAddressViewSet(viewsets.ModelViewSet):
    """ViewSet für Firmenadressen"""
    serializer_class = CompanyAddressSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        settings = CompanySettings.load()
        return CompanyAddress.objects.filter(company_settings=settings)
    
    def perform_create(self, serializer):
        settings = CompanySettings.load()
        serializer.save(company_settings=settings)


class CompanyManagerViewSet(viewsets.ModelViewSet):
    """ViewSet für Geschäftsführer"""
    serializer_class = CompanyManagerSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        settings = CompanySettings.load()
        return CompanyManager.objects.filter(company_settings=settings)
    
    def perform_create(self, serializer):
        settings = CompanySettings.load()
        serializer.save(company_settings=settings)


class CompanyBankAccountViewSet(viewsets.ModelViewSet):
    """ViewSet für Bankverbindungen"""
    serializer_class = CompanyBankAccountSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        settings = CompanySettings.load()
        return CompanyBankAccount.objects.filter(company_settings=settings)
    
    def perform_create(self, serializer):
        settings = CompanySettings.load()
        serializer.save(company_settings=settings)


class ExchangeRateViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Wechselkurse
    """
    queryset = ExchangeRate.objects.all()
    serializer_class = ExchangeRateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['currency']
    ordering = ['currency']


class PaymentTermViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Zahlungsbedingungen
    """
    queryset = PaymentTerm.objects.all()
    serializer_class = PaymentTermSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'notes']
    filterset_fields = ['is_active']
    ordering = ['name']


class DeliveryTermViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferbedingungen (Incoterms)
    """
    queryset = DeliveryTerm.objects.all()
    serializer_class = DeliveryTermSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['incoterm', 'description']
    filterset_fields = ['is_active']
    ordering = ['incoterm']


class DeliveryInstructionViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanweisungen
    """
    queryset = DeliveryInstruction.objects.all()
    serializer_class = DeliveryInstructionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'instruction_text']
    filterset_fields = ['is_active']
    ordering = ['name']
