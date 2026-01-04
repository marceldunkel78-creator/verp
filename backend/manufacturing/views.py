from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import (
    VSHardware, VSHardwarePrice, VSHardwareMaterialItem,
    VSHardwareCostCalculation, VSHardwareDocument,
    ProductionOrderInbox, ProductionOrder
)
from .serializers import (
    VSHardwareListSerializer, VSHardwareDetailSerializer, VSHardwareCreateUpdateSerializer,
    VSHardwarePriceSerializer, VSHardwareMaterialItemSerializer,
    VSHardwareCostCalculationSerializer, VSHardwareDocumentSerializer,
    ProductionOrderInboxSerializer, ProductionOrderSerializer, ProductionOrderDetailSerializer,
    PriceTransferSerializer
)


# ============================================
# VS-HARDWARE VIEWSETS
# ============================================

class VSHardwareViewSet(viewsets.ModelViewSet):
    """ViewSet für VS-Hardware Produkte"""
    # Pagination für infinite scroll
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = VSHardware.objects.all()
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['part_number', 'name', 'model_designation', 'description']
    ordering_fields = ['part_number', 'name', 'created_at']
    ordering = ['part_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VSHardwareListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VSHardwareCreateUpdateSerializer
        return VSHardwareDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def copy_material_list(self, request, pk=None):
        """Kopiert die Materialliste von einer anderen VS-Hardware"""
        source_id = request.data.get('source_id')
        if not source_id:
            return Response(
                {'error': 'source_id ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            source = VSHardware.objects.get(pk=source_id)
        except VSHardware.DoesNotExist:
            return Response(
                {'error': 'Quell-VS-Hardware nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        target = self.get_object()
        
        # Bestehende Materialien optional löschen
        if request.data.get('replace', False):
            target.material_items.all().delete()
        
        # Materialien kopieren
        new_items = []
        for item in source.material_items.all():
            new_item = VSHardwareMaterialItem.objects.create(
                vs_hardware=target,
                material_supply=item.material_supply,
                quantity=item.quantity,
                position=item.position,
                notes=item.notes
            )
            new_items.append(new_item)
        
        return Response({
            'message': f'{len(new_items)} Material-Positionen kopiert',
            'items': VSHardwareMaterialItemSerializer(new_items, many=True).data
        })


class VSHardwarePriceViewSet(viewsets.ModelViewSet):
    """ViewSet für VS-Hardware Preise"""
    queryset = VSHardwarePrice.objects.all()
    serializer_class = VSHardwarePriceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['vs_hardware']
    ordering = ['-valid_from']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VSHardwareMaterialItemViewSet(viewsets.ModelViewSet):
    """ViewSet für Material-Positionen"""
    queryset = VSHardwareMaterialItem.objects.all()
    serializer_class = VSHardwareMaterialItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['vs_hardware']
    ordering = ['position', 'id']
    
    @action(detail=False, methods=['post'])
    def bulk_update_positions(self, request):
        """Aktualisiert die Positionen mehrerer Items"""
        items = request.data.get('items', [])
        for item_data in items:
            try:
                item = VSHardwareMaterialItem.objects.get(pk=item_data.get('id'))
                item.position = item_data.get('position', item.position)
                item.save()
            except VSHardwareMaterialItem.DoesNotExist:
                continue
        return Response({'message': 'Positionen aktualisiert'})


class VSHardwareCostCalculationViewSet(viewsets.ModelViewSet):
    """ViewSet für Kostenkalkulationen"""
    queryset = VSHardwareCostCalculation.objects.all()
    serializer_class = VSHardwareCostCalculationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['vs_hardware', 'is_active']
    ordering = ['-created_at']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """Berechnet die Kalkulation neu"""
        calculation = self.get_object()
        calculation.calculate_costs()
        calculation.save()
        return Response(VSHardwareCostCalculationSerializer(calculation).data)
    
    @action(detail=True, methods=['post'])
    def transfer_price(self, request, pk=None):
        """Überträgt die Preise in die Preisliste"""
        calculation = self.get_object()
        
        serializer = PriceTransferSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            price = calculation.transfer_to_price(
                valid_from=serializer.validated_data['valid_from'],
                valid_until=serializer.validated_data.get('valid_until'),
                user=request.user
            )
            return Response({
                'message': 'Preise erfolgreich übertragen',
                'price': VSHardwarePriceSerializer(price).data
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class VSHardwareDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet für Fertigungsdokumente"""
    queryset = VSHardwareDocument.objects.all()
    serializer_class = VSHardwareDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['vs_hardware', 'document_type']
    ordering = ['document_type', 'title']
    
    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


# ============================================
# FERTIGUNGSAUFTRÄGE VIEWSETS
# ============================================

class ProductionOrderInboxViewSet(viewsets.ModelViewSet):
    """ViewSet für Fertigungsauftragseingang"""
    queryset = ProductionOrderInbox.objects.all()
    serializer_class = ProductionOrderInboxSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vs_hardware', 'customer_order']
    search_fields = ['vs_hardware__name', 'vs_hardware__part_number', 'notes']
    ordering = ['-received_at']
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Nimmt den Eingang an und erstellt einen Fertigungsauftrag"""
        inbox_item = self.get_object()
        
        if inbox_item.status != 'pending':
            return Response(
                {'error': 'Nur ausstehende Eingänge können angenommen werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            order = inbox_item.accept(user=request.user)
            return Response({
                'message': 'Fertigungsauftrag erstellt',
                'order': ProductionOrderSerializer(order).data,
                'inbox_item': ProductionOrderInboxSerializer(inbox_item).data
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Lehnt den Eingang ab"""
        inbox_item = self.get_object()
        
        if inbox_item.status != 'pending':
            return Response(
                {'error': 'Nur ausstehende Eingänge können abgelehnt werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            inbox_item.reject(
                user=request.user,
                reason=request.data.get('reason', '')
            )
            return Response({
                'message': 'Eingang abgelehnt',
                'inbox_item': ProductionOrderInboxSerializer(inbox_item).data
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ProductionOrderViewSet(viewsets.ModelViewSet):
    """ViewSet für Fertigungsaufträge"""
    queryset = ProductionOrder.objects.all()
    serializer_class = ProductionOrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vs_hardware', 'customer_order', 'product_category']
    search_fields = ['order_number', 'vs_hardware__name', 'vs_hardware__part_number', 'notes', 'serial_number']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProductionOrderDetailSerializer
        return ProductionOrderSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Startet den Fertigungsauftrag - erfordert Warenkategorie"""
        order = self.get_object()
        
        if order.status not in ['created']:
            return Response(
                {'error': 'Auftrag kann nicht gestartet werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Warenkategorie kann beim Starten mitgegeben werden
        category_id = request.data.get('product_category')
        if category_id:
            try:
                from verp_settings.models import ProductCategory
                order.product_category = ProductCategory.objects.get(pk=category_id)
            except Exception:
                return Response(
                    {'error': 'Ungültige Warenkategorie'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Prüfe ob Warenkategorie gesetzt ist
        if not order.product_category:
            return Response(
                {'error': 'Warenkategorie muss ausgewählt werden, um den Auftrag zu starten'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Initialisiere leere Checkliste basierend auf Kategorie
        order.checklist_data = self._get_initial_checklist(order.product_category.code)
        
        order.status = 'in_progress'
        order.actual_start = timezone.now().date()
        order.save()
        
        return Response(ProductionOrderDetailSerializer(order, context={'request': request}).data)
    
    def _get_initial_checklist(self, category_code):
        """Gibt die initiale Checklistenstruktur für eine Kategorie zurück"""
        checklists = {
            'VIRTEX': {
                'type': 'VIRTEX',
                'sections': [
                    {
                        'title': 'Allgemein',
                        'items': [
                            {'id': 'fw_update', 'label': 'FW Update OK', 'checked': False},
                            {'id': 'sn_aufkleber', 'label': 'SN Aufkleber OK', 'checked': False}
                        ]
                    },
                    {
                        'title': 'Digital Ports Test',
                        'items': [
                            {'id': 'ttl_out', 'label': 'TTL out OK', 'checked': False},
                            {'id': 'cam_input', 'label': 'Cam Input OK', 'checked': False},
                            {'id': 'ln0_trigger_sync', 'label': 'ln0 / TriggerIN / SyncIn OK', 'checked': False},
                            {'id': 'cam_out', 'label': 'Cam out OK', 'checked': False},
                            {'id': 'trigger_ready', 'label': 'Trigger ready OK', 'checked': False}
                        ]
                    },
                    {
                        'title': 'mit Laser Logic',
                        'items': [
                            {'id': 'ttl_output_laser_logic', 'label': 'TTL Output Laser Logic OK', 'checked': False},
                            {'id': 'interlock', 'label': 'Interlock OK', 'checked': False}
                        ]
                    },
                    {
                        'title': 'mit Multiplexer',
                        'items': [
                            {'id': 'ttl_output_led', 'label': 'TTL Output LED Lampe OK', 'checked': False},
                            {'id': 'ttl_output_laser_mux', 'label': 'TTL Output Laser OK', 'checked': False}
                        ]
                    },
                    {
                        'title': 'mit Orbital',
                        'items': [
                            {'id': 'orbital_ok', 'label': 'Orbital OK', 'checked': False},
                            {'id': 'ttl_output_laser_orbital', 'label': 'TTL Output Laser OK', 'checked': False}
                        ]
                    },
                    {
                        'title': 'mit Break-out Box',
                        'items': [
                            {'id': 'qswitch', 'label': 'QSwitch OK', 'checked': False},
                            {'id': 'ttl_a0_a3', 'label': 'TTL A0-A3 OK', 'checked': False},
                            {'id': 'ttl_b0_b6', 'label': 'TTL B0-B6 OK', 'checked': False}
                        ]
                    },
                    {
                        'title': 'Analog Ports Test',
                        'items': [
                            {'id': 'number_ports_onstate', 'label': 'Number of ports on-state OK', 'checked': False},
                            {'id': 'analog_0_10v', 'label': '0-10V OK', 'checked': False},
                            {'id': 'analog_0_5v', 'label': '0-5V OK', 'checked': False},
                            {'id': 'analog_3_4', 'label': 'Analog #3 #4 OK', 'checked': False},
                            {'id': 'analog_minus5_plus5', 'label': '-5V..+5V OK', 'checked': False}
                        ]
                    }
                ]
            },
            'ORBITAL': {
                'type': 'ORBITAL',
                'sections': [
                    {
                        'title': 'Allgemein',
                        'items': [
                            {'id': 'beschriftung', 'label': 'Beschriftung OK', 'checked': False},
                            {'id': 'tirf', 'label': 'TIRF OK', 'checked': False},
                            {'id': 'frap', 'label': 'FRAP OK', 'checked': False}
                        ]
                    },
                    {
                        'title': 'TTL Outputs',
                        'items': [
                            {'id': 'ttl_out1', 'label': 'TTL Out1 OK', 'checked': False},
                            {'id': 'ttl_out2', 'label': 'TTL Out2 OK', 'checked': False},
                            {'id': 'ttl_out3', 'label': 'TTL Out3 OK', 'checked': False},
                            {'id': 'ttl_out4', 'label': 'TTL Out4 OK', 'checked': False},
                            {'id': 'ttl_out5', 'label': 'TTL Out5 OK', 'checked': False},
                            {'id': 'ttl_out6', 'label': 'TTL Out6 OK', 'checked': False}
                        ]
                    },
                    {
                        'title': 'System',
                        'items': [
                            {'id': 'fw_update', 'label': 'FW Update OK', 'checked': False},
                            {'id': 'sn_aufkleber', 'label': 'SN Aufkleber OK', 'checked': False}
                        ]
                    }
                ],
                'galvo_table': {
                    'headers': ['Galvo-Offset', 'X-Galvo-Spannung V', 'Y-Galvo-Spannung V'],
                    'rows': [
                        {'offset': '2,49', 'x_voltage': '', 'y_voltage': ''},
                        {'offset': '2,00', 'x_voltage': '', 'y_voltage': ''},
                        {'offset': '1,50', 'x_voltage': '', 'y_voltage': ''},
                        {'offset': '1,00', 'x_voltage': '', 'y_voltage': ''},
                        {'offset': '0,50', 'x_voltage': '', 'y_voltage': ''},
                        {'offset': '-0,50', 'x_voltage': '', 'y_voltage': ''},
                        {'offset': '-1,00', 'x_voltage': '', 'y_voltage': ''},
                        {'offset': '-1,50', 'x_voltage': '', 'y_voltage': ''},
                        {'offset': '-2,00', 'x_voltage': '', 'y_voltage': ''},
                        {'offset': '-2,49', 'x_voltage': '', 'y_voltage': ''}
                    ]
                }
            },
            'FRAP': {
                'type': 'FRAP',
                'sections': [
                    {
                        'title': 'Allgemein',
                        'items': [
                            {'id': 'sn_aufkleber', 'label': 'SN Aufkleber OK', 'checked': False},
                            {'id': 'galvo_funktion', 'label': 'Galvo-Funktion OK', 'checked': False}
                        ]
                    }
                ]
            },
            'KABEL': {
                'type': 'KABEL',
                'sections': [
                    {
                        'title': 'Allgemein',
                        'items': [
                            {'id': 'funktion', 'label': 'Funktion OK', 'checked': False},
                            {'id': 'beschriftung', 'label': 'Beschriftung OK', 'checked': False}
                        ]
                    }
                ]
            },
            'VS_LMS': {
                'type': 'VS_LMS',
                'sections': [
                    {
                        'title': 'Allgemein',
                        'items': [
                            {'id': 'sn_aufkleber', 'label': 'SN Aufkleber OK', 'checked': False},
                            {'id': 'beschriftung', 'label': 'Beschriftung OK', 'checked': False}
                        ]
                    },
                    {
                        'title': 'Stromversorgung',
                        'items': [
                            {'id': 'test_laser_1_405', 'label': 'Test Laser 1 (405) OK?', 'checked': False},
                            {'id': 'test_laser_2_445', 'label': 'Test Laser 2 (445) OK?', 'checked': False},
                            {'id': 'test_laser_3_488', 'label': 'Test Laser 3 (488) OK?', 'checked': False},
                            {'id': 'test_laser_4_515', 'label': 'Test Laser 4 (515) OK?', 'checked': False},
                            {'id': 'test_laser_5_561', 'label': 'Test Laser 5 (561) OK?', 'checked': False},
                            {'id': 'test_laser_6_640', 'label': 'Test Laser 6 (640) OK?', 'checked': False},
                            {'id': 'test_laser_safety_12v', 'label': 'Test Laser Safety 12V OK?', 'checked': False},
                            {'id': 'lms_power_12v', 'label': 'LMS Power 12V', 'checked': False},
                            {'id': 'lms_power_15v', 'label': 'LMS Power 15V', 'checked': False},
                            {'id': 'test_galvo_15v', 'label': 'Test Galvo ±15V OK?', 'checked': False}
                        ]
                    },
                    {
                        'title': 'Test Digital Ports',
                        'items': [
                            {'id': 'test_lms_ttl1', 'label': 'Test LMS TTL1 OK?', 'checked': False},
                            {'id': 'test_ttl_input', 'label': 'Test TTL-Input OK?', 'checked': False},
                            {'id': 'test_lms_ttl2', 'label': 'Test LMS TTL2 OK?', 'checked': False},
                            {'id': 'test_interlock', 'label': 'Test Interlock OK?', 'checked': False},
                            {'id': 'test_psw0', 'label': 'Test PSw0 OK?', 'checked': False},
                            {'id': 'test_smb', 'label': 'Test SMB OK?', 'checked': False},
                            {'id': 'test_psw1', 'label': 'Test PSw1 OK?', 'checked': False},
                            {'id': 'test_orbital_ilas', 'label': 'Test Orbital / iLas OK?', 'checked': False}
                        ]
                    },
                    {
                        'title': 'Cable-Kit',
                        'items': [
                            {'id': 'laser_power_neutrik', 'label': 'Laser Power Kabel Neutrik 12p 2m', 'checked': False},
                            {'id': 'galvo_power_safety', 'label': 'Galvo Power / Laser Safety Kabel DIN 7p 2m', 'checked': False},
                            {'id': 'ttl_kabel_no1', 'label': 'TTL-Kabel mini Rund 8p 2m No1', 'checked': False},
                            {'id': 'ttl_kabel_no2', 'label': 'TTL-Kabel mini Rund 8p 2m No2', 'checked': False}
                        ]
                    }
                ],
                'laser_table': {
                    'headers': ['Laser nm', 'Modell', 'Serialnr.', 'Leistung mW', 'Output SDC mW', 'Output TIRF mW', 'Output FRAP mW'],
                    'rows': [
                        {'nm': '', 'modell': '', 'serial': '', 'leistung': '', 'output_sdc': '', 'output_tirf': '', 'output_frap': ''},
                        {'nm': '', 'modell': '', 'serial': '', 'leistung': '', 'output_sdc': '', 'output_tirf': '', 'output_frap': ''},
                        {'nm': '', 'modell': '', 'serial': '', 'leistung': '', 'output_sdc': '', 'output_tirf': '', 'output_frap': ''},
                        {'nm': '', 'modell': '', 'serial': '', 'leistung': '', 'output_sdc': '', 'output_tirf': '', 'output_frap': ''},
                        {'nm': '', 'modell': '', 'serial': '', 'leistung': '', 'output_sdc': '', 'output_tirf': '', 'output_frap': ''},
                        {'nm': '', 'modell': '', 'serial': '', 'leistung': '', 'output_sdc': '', 'output_tirf': '', 'output_frap': ''},
                        {'nm': '', 'modell': '', 'serial': '', 'leistung': '', 'output_sdc': '', 'output_tirf': '', 'output_frap': ''},
                        {'nm': '', 'modell': '', 'serial': '', 'leistung': '', 'output_sdc': '', 'output_tirf': '', 'output_frap': ''}
                    ]
                },
                'leoni_sn': ''
            }
        }
        
        # Fallback für andere Kategorien
        return checklists.get(category_code, {
            'type': category_code,
            'sections': [
                {
                    'title': 'Allgemein',
                    'items': [
                        {'id': 'quality_check', 'label': 'Qualitätsprüfung OK', 'checked': False},
                        {'id': 'function_test', 'label': 'Funktionstest OK', 'checked': False}
                    ]
                }
            ]
        })
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Schließt den Fertigungsauftrag ab"""
        order = self.get_object()
        
        if order.status not in ['in_progress']:
            return Response(
                {'error': 'Auftrag kann nicht abgeschlossen werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order.status = 'completed'
        order.actual_end = timezone.now().date()
        order.save()
        
        return Response(ProductionOrderSerializer(order).data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Storniert den Fertigungsauftrag"""
        order = self.get_object()
        
        if order.status in ['completed', 'cancelled']:
            return Response(
                {'error': 'Auftrag kann nicht storniert werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order.status = 'cancelled'
        if request.data.get('reason'):
            order.notes = f"{order.notes}\n\nStornierungsgrund: {request.data['reason']}".strip()
        order.save()
        
        return Response(ProductionOrderSerializer(order).data)
    
    @action(detail=True, methods=['patch'])
    def update_checklist(self, request, pk=None):
        """Aktualisiert die Fertigungscheckliste"""
        order = self.get_object()
        
        if order.status not in ['in_progress']:
            return Response(
                {'error': 'Checkliste kann nur für laufende Aufträge aktualisiert werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order.checklist_data = request.data.get('checklist_data', order.checklist_data)
        order.save()
        
        return Response(ProductionOrderDetailSerializer(order, context={'request': request}).data)
    
    @action(detail=True, methods=['post'])
    def handover(self, request, pk=None):
        """Übergibt den Fertigungsauftrag an das Warenlager - schließt den Auftrag ab"""
        order = self.get_object()
        
        if order.status != 'in_progress':
            return Response(
                {'error': 'Nur laufende Fertigungsaufträge können übergeben werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prüfe ob alle Checklistenpunkte abgehakt sind
        if not self._is_checklist_complete(order):
            return Response(
                {'error': 'Alle Checklistenpunkte müssen abgehakt sein, bevor die Übergabe erfolgen kann'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Setze Status auf completed und speichere Abschlussdatum
        order.status = 'completed'
        order.actual_end = timezone.now().date()
        order.save()
        
        return Response({
            'message': 'Fertigungsauftrag erfolgreich an Warenlager übergeben',
            'order': ProductionOrderDetailSerializer(order, context={'request': request}).data
        })
    
    def _is_checklist_complete(self, order):
        """Prüft ob alle Checklistenpunkte abgehakt sind"""
        if not order.checklist_data:
            return False
        
        sections = order.checklist_data.get('sections', [])
        if not sections:
            return False
        
        for section in sections:
            for item in section.get('items', []):
                if not item.get('checked', False):
                    return False
        
        return True
