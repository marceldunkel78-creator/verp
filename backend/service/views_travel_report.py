"""
Views für Reiseberichte/Serviceberichte
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import HttpResponse

from .models_travel_report import TravelReport, TravelReportMeasurement, TravelReportPhoto
from .serializers_travel_report import (
    TravelReportListSerializer,
    TravelReportDetailSerializer,
    TravelReportCreateUpdateSerializer,
    TravelReportPhotoSerializer,
    TravelReportMeasurementSerializer
)
from .service_report_pdf import generate_service_report_pdf


class TravelReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Reiseberichte/Serviceberichte
    """
    queryset = TravelReport.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['report_type', 'customer', 'linked_system', 'linked_order', 'created_by']
    search_fields = ['location', 'notes']
    ordering_fields = ['date', 'created_at', 'location']
    ordering = ['-date', '-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TravelReportListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return TravelReportCreateUpdateSerializer
        return TravelReportDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def upload_photo(self, request, pk=None):
        """Foto zu einem Reisebericht hochladen"""
        travel_report = self.get_object()
        
        photo_file = request.FILES.get('photo')
        caption = request.data.get('caption', '')
        
        if not photo_file:
            return Response(
                {'error': 'Keine Datei hochgeladen'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        photo = TravelReportPhoto.objects.create(
            travel_report=travel_report,
            photo=photo_file,
            caption=caption
        )
        
        serializer = TravelReportPhotoSerializer(photo, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def photos(self, request, pk=None):
        """Alle Fotos eines Reiseberichts abrufen"""
        travel_report = self.get_object()
        photos = travel_report.photos.all()
        serializer = TravelReportPhotoSerializer(photos, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'])
    def delete_photo(self, request, pk=None):
        """Foto löschen"""
        travel_report = self.get_object()
        photo_id = request.data.get('photo_id')
        if not photo_id:
            return Response(
                {'error': 'photo_id erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            photo = travel_report.photos.get(id=photo_id)
            photo.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except TravelReportPhoto.DoesNotExist:
            return Response(
                {'error': 'Foto nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def add_measurement(self, request, pk=None):
        """Messung zu einem Reisebericht hinzufügen"""
        travel_report = self.get_object()
        
        title = request.data.get('title', 'Messungen')
        data = request.data.get('data', {})
        
        measurement = TravelReportMeasurement.objects.create(
            travel_report=travel_report,
            title=title,
            data=data
        )
        
        serializer = TravelReportMeasurementSerializer(measurement)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def measurements(self, request, pk=None):
        """Alle Messungen eines Reiseberichts abrufen"""
        travel_report = self.get_object()
        measurements = travel_report.measurements.all()
        serializer = TravelReportMeasurementSerializer(measurements, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['put'])
    def update_measurement(self, request, pk=None):
        """Messung aktualisieren"""
        travel_report = self.get_object()
        measurement_id = request.data.get('measurement_id')
        if not measurement_id:
            return Response(
                {'error': 'measurement_id erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            measurement = travel_report.measurements.get(id=measurement_id)
            if 'title' in request.data:
                measurement.title = request.data.get('title')
            if 'data' in request.data:
                measurement.data = request.data.get('data')
            measurement.save()
            serializer = TravelReportMeasurementSerializer(measurement)
            return Response(serializer.data)
        except TravelReportMeasurement.DoesNotExist:
            return Response(
                {'error': 'Messung nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['delete'])
    def delete_measurement(self, request, pk=None):
        """Messung löschen"""
        travel_report = self.get_object()
        measurement_id = request.data.get('measurement_id')
        if not measurement_id:
            return Response(
                {'error': 'measurement_id erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            measurement = travel_report.measurements.get(id=measurement_id)
            measurement.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except TravelReportMeasurement.DoesNotExist:
            return Response(
                {'error': 'Messung nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'])
    def generate_pdf(self, request, pk=None):
        """PDF für Servicebericht generieren"""
        travel_report = self.get_object()
        
        # Only for service reports
        if travel_report.report_type != 'service':
            return Response(
                {'error': 'PDF-Generierung ist nur für Serviceberichte verfügbar'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            pdf_buffer = generate_service_report_pdf(travel_report)
            
            # Create filename
            order_number = ''
            if travel_report.linked_order:
                order_number = travel_report.linked_order.order_number
            filename = f"Servicebericht_{order_number or travel_report.id}.pdf"
            
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response(
                {'error': f'Fehler bei der PDF-Generierung: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
