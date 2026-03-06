"""
Views für Reiseberichte/Serviceberichte
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import HttpResponse, FileResponse
from django.core.files.base import ContentFile

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
    ordering_fields = ['date', 'created_at', 'location', 'report_type', 'customer__company_name', 'linked_system__system_name', 'created_by__first_name']
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
        """PDF für Servicebericht generieren und im Medienordner speichern"""
        travel_report = self.get_object()
        
        # Only for service reports
        if travel_report.report_type != 'service':
            return Response(
                {'error': 'PDF-Generierung ist nur für Serviceberichte verfügbar'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        language = request.query_params.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'
        
        try:
            pdf_buffer = generate_service_report_pdf(travel_report, language=language)
            
            # Create filename
            order_number = ''
            if travel_report.linked_order:
                order_number = travel_report.linked_order.order_number
            lang_suffix = '_EN' if language == 'en' else ''
            filename = f"Servicebericht_{order_number or travel_report.id}{lang_suffix}.pdf"
            
            # Delete old PDF file from storage before saving new one
            if travel_report.pdf_file:
                old_file = travel_report.pdf_file
                travel_report.pdf_file = None
                travel_report.save(update_fields=['pdf_file'])
                old_file.delete(save=False)
            
            # Save new PDF to model / media folder
            travel_report.pdf_file.save(filename, ContentFile(pdf_buffer.read()), save=True)
            pdf_buffer.seek(0)
            
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response(
                {'error': f'Fehler bei der PDF-Generierung: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def serve_pdf(self, request, pk=None):
        """Gespeichertes PDF ausliefern"""
        travel_report = self.get_object()
        
        if not travel_report.pdf_file:
            return Response(
                {'error': 'Kein PDF vorhanden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            return FileResponse(
                travel_report.pdf_file.open('rb'),
                content_type='application/pdf',
                filename=travel_report.pdf_file.name.split('/')[-1]
            )
        except FileNotFoundError:
            return Response(
                {'error': 'PDF-Datei nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
