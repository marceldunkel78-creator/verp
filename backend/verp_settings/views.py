from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    ExchangeRate, CompanySettings, CompanyAddress,
    CompanyManager, CompanyBankAccount, PaymentTerm,
    DeliveryTerm, DeliveryInstruction, ProductCategory
)
from .serializers import (
    ExchangeRateSerializer, CompanySettingsSerializer,
    CompanySettingsUpdateSerializer, CompanyAddressSerializer,
    CompanyManagerSerializer, CompanyBankAccountSerializer,
    PaymentTermSerializer, DeliveryTermSerializer, DeliveryInstructionSerializer,
    ProductCategorySerializer
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


class ProductCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Warenkategorien
    """
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'code', 'description']
    filterset_fields = ['is_active', 'applies_to_trading_goods', 'applies_to_material_supplies', 
                        'applies_to_vs_hardware', 'applies_to_vs_software', 'applies_to_vs_service']
    ordering = ['sort_order', 'name']
    
    @action(detail=False, methods=['get'])
    def trading_goods(self, request):
        """Gibt alle für Handelswaren gültigen Kategorien zurück"""
        categories = ProductCategory.get_trading_goods_categories()
        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def material_supplies(self, request):
        """Gibt alle für M&S gültigen Kategorien zurück"""
        categories = ProductCategory.get_material_supplies_categories()
        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def vs_hardware(self, request):
        """Gibt alle für VS-Hardware gültigen Kategorien zurück"""
        categories = ProductCategory.get_vs_hardware_categories()
        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def initialize_defaults(self, request):
        """Initialisiert alle Standard-Kategorien"""
        created_count = 0
        for code, name in ProductCategory.PRODUCT_CATEGORY_CHOICES:
            # Bestimme Standard-Eigenschaften basierend auf Kategorie
            requires_serial = code not in ['ROHSTOFF', 'HILFSSTOFF', 'BETRIEBSSTOFF']
            applies_to_ms = code in ['ROHSTOFF', 'HILFSSTOFF', 'BETRIEBSSTOFF', 'KABEL', 'FILTER', 'SONSTIGES']
            applies_to_tg = code not in ['ROHSTOFF', 'HILFSSTOFF', 'BETRIEBSSTOFF']
            applies_to_vsh = code not in ['ROHSTOFF', 'HILFSSTOFF', 'BETRIEBSSTOFF', 'SERVICE', 'SOFTWARE']
            applies_to_vss = code in ['SOFTWARE', 'VISIVIEW']
            applies_to_service = code in ['SERVICE', 'SONSTIGES']
            
            _, created = ProductCategory.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'requires_serial_number': requires_serial,
                    'applies_to_trading_goods': applies_to_tg,
                    'applies_to_material_supplies': applies_to_ms,
                    'applies_to_vs_hardware': applies_to_vsh,
                    'applies_to_vs_software': applies_to_vss,
                    'applies_to_vs_service': applies_to_service,
                }
            )
            if created:
                created_count += 1
        
        return Response({
            'message': f'{created_count} Kategorien erstellt',
            'total': ProductCategory.objects.count()
        })
