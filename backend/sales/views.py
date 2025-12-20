from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import FileResponse, HttpResponse
from .models import Quotation, QuotationItem
from .serializers import (
    QuotationListSerializer,
    QuotationDetailSerializer,
    QuotationCreateUpdateSerializer,
    QuotationItemSerializer,
    QuotationItemCreateUpdateSerializer
)
import traceback
import json


class QuotationViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Angebote
    """
    queryset = Quotation.objects.select_related('customer', 'created_by').prefetch_related('items').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['customer', 'status', 'language']
    search_fields = ['quotation_number', 'reference', 'customer__first_name', 'customer__last_name']
    ordering_fields = ['date', 'valid_until', 'quotation_number', 'status']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return QuotationDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return QuotationCreateUpdateSerializer
        return QuotationListSerializer
    
    def create(self, request, *args, **kwargs):
        """Custom create um items als JSON zu verarbeiten"""
        data = request.data.copy()
        
        # Parse items if it's a JSON string
        if 'items' in data and isinstance(data['items'], str):
            try:
                data['items'] = json.loads(data['items'])
            except json.JSONDecodeError:
                pass
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Nutze DetailSerializer für die Response um items zu inkludieren
        instance = serializer.instance
        detail_serializer = QuotationDetailSerializer(instance)
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def update(self, request, *args, **kwargs):
        """Custom update um items als JSON zu verarbeiten"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data.copy()
        
        # Parse items if it's a JSON string
        if 'items' in data and isinstance(data['items'], str):
            try:
                data['items'] = json.loads(data['items'])
            except json.JSONDecodeError:
                pass
        
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        
        # Nutze DetailSerializer für die Response um items zu inkludieren
        detail_serializer = QuotationDetailSerializer(instance)
        return Response(detail_serializer.data)
    
    def perform_create(self, serializer):
        """Setze den erstellen User"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """
        Generiert und lädt ein PDF für das Angebot herunter
        """
        quotation = self.get_object()
        
        try:
            from .pdf_generator import generate_quotation_pdf
            pdf_buffer = generate_quotation_pdf(quotation)
            
            response = FileResponse(
                pdf_buffer,
                content_type='application/pdf',
                as_attachment=True,
                filename=f'Angebot_{quotation.quotation_number}.pdf'
            )
            return response
        except Exception as e:
            print(f"Error generating PDF: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Fehler beim Generieren des PDFs'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """
        Dupliziert ein Angebot
        """
        original = self.get_object()
        
        # Erstelle Kopie
        original.pk = None
        original.quotation_number = None
        original.status = 'DRAFT'
        original.created_by = request.user
        original.save()
        
        serializer = QuotationDetailSerializer(original)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuotationItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Angebotspositionen
    """
    queryset = QuotationItem.objects.select_related('quotation', 'content_type').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['quotation']
    ordering_fields = ['position']
    ordering = ['position']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return QuotationItemCreateUpdateSerializer
        return QuotationItemSerializer
