# VisiView Production Order Views
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction
from datetime import date, timedelta
from decimal import Decimal

from core.permissions import VisiViewLicensePermission
from .production_orders import VisiViewProductionOrder, VisiViewProductionOrderItem, VisiViewLicenseHistory
from .production_serializers import (
    VisiViewProductionOrderListSerializer,
    VisiViewProductionOrderDetailSerializer,
    VisiViewProductionOrderCreateUpdateSerializer,
    VisiViewProductionOrderItemSerializer
)
from .models import VisiViewLicense, VisiViewOption, MaintenanceTimeCredit


class VisiViewProductionOrderViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Fertigungsaufträge"""
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = VisiViewProductionOrder.objects.select_related(
        'customer', 'customer_order', 'target_license', 'created_by'
    ).prefetch_related('items').all()
    permission_classes = [IsAuthenticated, VisiViewLicensePermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'processing_type', 'customer', 'customer_order']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewProductionOrderListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewProductionOrderCreateUpdateSerializer
        return VisiViewProductionOrderDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Fügt eine Position zum Fertigungsauftrag hinzu"""
        production_order = self.get_object()
        
        if production_order.status == 'COMPLETED':
            return Response(
                {'error': 'Abgeschlossene Fertigungsaufträge können nicht mehr bearbeitet werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = VisiViewProductionOrderItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(production_order=production_order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def process_new_license(self, request, pk=None):
        """
        Erstellt eine neue VisiView-Lizenz basierend auf den Positionen des Fertigungsauftrags
        """
        production_order = self.get_object()
        
        if production_order.processing_type != 'NEW_LICENSE':
            return Response(
                {'error': 'Dieser Fertigungsauftrag ist nicht für neue Lizenzen vorgesehen.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if production_order.status == 'COMPLETED':
            return Response(
                {'error': 'Dieser Fertigungsauftrag wurde bereits abgeschlossen.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Lizenz-Daten aus Request
        license_data = request.data.get('license_data', {})
        
        if not license_data.get('serial_number'):
            return Response(
                {'error': 'Seriennummer ist erforderlich.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Erstelle neue Lizenz
        license = VisiViewLicense.objects.create(
            serial_number=license_data.get('serial_number'),
            internal_serial=license_data.get('internal_serial', ''),
            customer=production_order.customer,
            version=license_data.get('version', ''),
            delivery_date=license_data.get('delivery_date', date.today()),
            status='active',
            created_by=request.user
        )
        
        # Setze Optionen basierend auf den Items
        for item in production_order.items.all():
            for option in item.selected_options.all():
                license.set_option(option.bit_position, True)
        
        license.save()
        
        # Erstelle History-Eintrag
        VisiViewLicenseHistory.objects.create(
            license=license,
            change_type='CREATED',
            description=f'Lizenz erstellt durch Fertigungsauftrag {production_order.order_number}',
            production_order=production_order,
            new_value=f'Seriennummer: {license.serial_number}',
            changed_by=request.user
        )
        
        # Markiere Fertigungsauftrag als abgeschlossen
        production_order.status = 'COMPLETED'
        production_order.completed_at = timezone.now()
        production_order.save()
        
        from .serializers import VisiViewLicenseDetailSerializer
        return Response({
            'success': True,
            'message': 'Lizenz erfolgreich erstellt.',
            'license': VisiViewLicenseDetailSerializer(license).data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def process_extend_license(self, request, pk=None):
        """
        Erweitert eine bestehende Lizenz mit neuen Optionen oder Major Version Update
        """
        production_order = self.get_object()
        
        if production_order.processing_type != 'EXTEND_LICENSE':
            return Response(
                {'error': 'Dieser Fertigungsauftrag ist nicht für Lizenzerweiterungen vorgesehen.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if production_order.status == 'COMPLETED':
            return Response(
                {'error': 'Dieser Fertigungsauftrag wurde bereits abgeschlossen.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not production_order.target_license:
            return Response(
                {'error': 'Keine Ziel-Lizenz angegeben.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        license = production_order.target_license
        update_major_version = request.data.get('update_major_version', False)
        new_version = request.data.get('new_version', '')
        
        # Optionen hinzufügen/entfernen
        options_added = []
        options_removed = []
        
        for item in production_order.items.all():
            for option in item.selected_options.all():
                old_value = license.is_option_enabled(option.bit_position)
                
                if not old_value:
                    # Option aktivieren
                    license.set_option(option.bit_position, True)
                    options_added.append(option.name)
                    
                    # History-Eintrag
                    VisiViewLicenseHistory.objects.create(
                        license=license,
                        change_type='OPTION_ADDED',
                        description=f'Option "{option.name}" hinzugefügt durch Fertigungsauftrag {production_order.order_number}',
                        production_order=production_order,
                        new_value=option.name,
                        changed_by=request.user
                    )
        
        license.save()
        
        # Major Version Update
        if update_major_version and new_version:
            old_version = license.version
            license.version = new_version
            license.save()
            
            VisiViewLicenseHistory.objects.create(
                license=license,
                change_type='MAJOR_VERSION_UPDATE',
                description=f'Major Version Update durch Fertigungsauftrag {production_order.order_number}',
                production_order=production_order,
                old_value=old_version,
                new_value=new_version,
                changed_by=request.user
            )
        
        # Markiere Fertigungsauftrag als abgeschlossen
        production_order.status = 'COMPLETED'
        production_order.completed_at = timezone.now()
        production_order.save()
        
        from .serializers import VisiViewLicenseDetailSerializer
        return Response({
            'success': True,
            'message': 'Lizenz erfolgreich erweitert.',
            'options_added': options_added,
            'major_version_updated': update_major_version,
            'license': VisiViewLicenseDetailSerializer(license).data
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def process_maintenance_credit(self, request, pk=None):
        """
        Fügt Maintenance-Zeitgutschriften zu einer Lizenz hinzu
        """
        production_order = self.get_object()
        
        if production_order.processing_type != 'MAINTENANCE_CREDIT':
            return Response(
                {'error': 'Dieser Fertigungsauftrag ist nicht für Maintenance-Gutschriften vorgesehen.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if production_order.status == 'COMPLETED':
            return Response(
                {'error': 'Dieser Fertigungsauftrag wurde bereits abgeschlossen.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not production_order.target_license:
            return Response(
                {'error': 'Keine Ziel-Lizenz angegeben.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        license = production_order.target_license
        total_months_added = 0
        
        # Maintenance-Gutschriften erstellen
        for item in production_order.items.all():
            if item.maintenance_months and item.maintenance_months > 0:
                # Berechne Start- und Enddatum
                start_date = date.today()
                end_date = start_date + timedelta(days=item.maintenance_months * 30)  # Approximation
                
                # Erstelle Maintenance Credit
                MaintenanceTimeCredit.objects.create(
                    license=license,
                    start_date=start_date,
                    end_date=end_date,
                    credit_hours=Decimal(item.maintenance_months * 2),  # 2 Stunden pro Monat
                    user=request.user,
                    created_by=request.user
                )
                
                total_months_added += item.maintenance_months
        
        # History-Eintrag
        VisiViewLicenseHistory.objects.create(
            license=license,
            change_type='MAINTENANCE_EXTENDED',
            description=f'Maintenance um {total_months_added} Monate erweitert durch Fertigungsauftrag {production_order.order_number}',
            production_order=production_order,
            new_value=f'{total_months_added} Monate',
            changed_by=request.user
        )
        
        # Markiere Fertigungsauftrag als abgeschlossen
        production_order.status = 'COMPLETED'
        production_order.completed_at = timezone.now()
        production_order.save()
        
        from .serializers import VisiViewLicenseDetailSerializer
        return Response({
            'success': True,
            'message': f'Maintenance-Gutschrift über {total_months_added} Monate erfolgreich hinzugefügt.',
            'total_months_added': total_months_added,
            'license': VisiViewLicenseDetailSerializer(license).data
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Storniert einen Fertigungsauftrag"""
        production_order = self.get_object()
        
        if production_order.status == 'COMPLETED':
            return Response(
                {'error': 'Abgeschlossene Fertigungsaufträge können nicht storniert werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        production_order.status = 'CANCELLED'
        production_order.save()
        
        return Response({
            'success': True,
            'message': 'Fertigungsauftrag wurde storniert.'
        }, status=status.HTTP_200_OK)
