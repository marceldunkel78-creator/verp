from rest_framework import viewsets, filters, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.http import FileResponse, Http404
from django.utils import timezone
from datetime import date
from decimal import Decimal

from core.permissions import (
    VisiViewProductPermission,
    VisiViewLicensePermission,
    VisiViewTicketPermission,
    VisiViewMacroPermission,
    VisiViewMaintenanceTimePermission,
    VisiViewSupportedHardwarePermission,
)

from .models import (
    VisiViewProduct, VisiViewProductPrice, VisiViewLicense, VisiViewOption,
    VisiViewTicket, VisiViewTicketComment, VisiViewTicketChangeLog, VisiViewTicketAttachment,
    VisiViewTicketTimeEntry, MaintenanceTimeCredit, MaintenanceTimeExpenditure, VisiViewLicenseHistory,
    SupportedHardware, SupportedHardwareUseCase
)
from .serializers import (
    VisiViewProductListSerializer,
    VisiViewProductDetailSerializer,
    VisiViewProductCreateUpdateSerializer,
    VisiViewProductPriceSerializer,
    VisiViewLicenseListSerializer,
    VisiViewLicenseDetailSerializer,
    VisiViewLicenseCreateUpdateSerializer,
    VisiViewOptionSerializer,
    VisiViewTicketListSerializer,
    VisiViewTicketDetailSerializer,
    VisiViewTicketCreateUpdateSerializer,
    VisiViewTicketCommentSerializer,
    VisiViewTicketChangeLogSerializer,
    VisiViewTicketAttachmentSerializer,
    VisiViewTicketTimeEntrySerializer,
    MaintenanceTimeCreditSerializer,
    MaintenanceTimeExpenditureSerializer,
    MaintenanceTimeExpenditureListSerializer,
    VisiViewLicenseHistorySerializer,
    SupportedHardwareSerializer,
    SupportedHardwareListSerializer,
    SupportedHardwareUseCaseSerializer,
    calculate_maintenance_balance,
    calculate_interim_settlements,
    process_expenditure_deduction,
    apply_new_credit_to_debt
)


class VisiViewProductViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Produkte"""
    # Pagination für infinite scroll
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = VisiViewProduct.objects.all()
    permission_classes = [IsAuthenticated, VisiViewProductPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'product_category']
    search_fields = ['article_number', 'name', 'description']
    ordering_fields = ['article_number', 'name', 'created_at']
    ordering = ['article_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewProductListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewProductCreateUpdateSerializer
        return VisiViewProductDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VisiViewProductPriceViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Produkt Preise"""
    queryset = VisiViewProductPrice.objects.all()
    serializer_class = VisiViewProductPriceSerializer
    permission_classes = [IsAuthenticated, VisiViewProductPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product']
    ordering = ['-valid_from']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VisiViewOptionViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Optionen"""
    queryset = VisiViewOption.objects.all()
    serializer_class = VisiViewOptionSerializer
    permission_classes = [IsAuthenticated, VisiViewProductPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['bit_position', 'name', 'price']
    ordering = ['bit_position']


class VisiViewLicenseViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Lizenzen"""
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = VisiViewLicense.objects.select_related('customer', 'created_by', 'dealer').all()
    permission_classes = [IsAuthenticated, VisiViewLicensePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'is_demo', 'is_loaner', 'customer', 'dealer', 'is_outdated']
    search_fields = ['license_number', 'serial_number', 'customer_name_legacy', 'customer__last_name', 'dealer__company_name', 'distributor_legacy']
    ordering_fields = ['license_number', 'serial_number', 'delivery_date', 'created_at', 'customer__last_name', 'version', 'status']
    ordering = ['-serial_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewLicenseListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewLicenseCreateUpdateSerializer
        return VisiViewLicenseDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            raise PermissionDenied("Nur Admins dürfen Lizenzen löschen.")
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=False, methods=['get'])
    def next_serial(self, request):
        """Gibt die nächste freie Seriennummer zurück.
        Optional: prefix, width, start Query-Parameter zur Formatierung.
        - prefix: Seriennummern mit diesem Prefix berücksichtigen
        - width: Mindestanzahl Stellen für numerischen Teil (mit führenden Nullen)
        - start: Startwert, wenn keine existierende gefunden wurde (Default 1)
        """
        prefix = request.query_params.get('prefix', '') or ''
        try:
            width = int(request.query_params.get('width', 0))
        except (TypeError, ValueError):
            width = 0
        try:
            start = int(request.query_params.get('start', 1))
        except (TypeError, ValueError):
            start = 1

        # Sammle vorhandene Seriennummern mit Prefix und extrahiere numerischen Rest
        qs = VisiViewLicense.objects.filter(serial_number__startswith=prefix)
        numbers = []
        for s in qs.values_list('serial_number', flat=True):
            rest = s[len(prefix):]
            if rest.isdigit():
                try:
                    numbers.append(int(rest))
                except ValueError:
                    continue

        base_next = (max(numbers) + 1) if numbers else start
        if width and width > 0:
            next_serial = f"{prefix}{base_next:0{width}d}"
        else:
            next_serial = f"{prefix}{base_next}"

        return Response({
            'next_serial': next_serial,
            'prefix': prefix,
            'width': width,
            'base_next': base_next
        })

    @action(detail=True, methods=['post'])
    def toggle_option(self, request, pk=None):
        """Aktiviert oder deaktiviert eine Option für die Lizenz"""
        license = self.get_object()
        bit_position = request.data.get('bit_position')
        enabled = request.data.get('enabled', True)
        
        if bit_position is None:
            return Response(
                {'error': 'bit_position ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            bit_position = int(bit_position)
            option = VisiViewOption.objects.get(bit_position=bit_position)
        except (ValueError, VisiViewOption.DoesNotExist):
            return Response(
                {'error': f'Option mit Bit-Position {bit_position} nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        license.set_option(bit_position, enabled)
        license.save()
        
        return Response({
            'success': True,
            'option': option.name,
            'enabled': enabled,
            'options_bitmask': license.options_bitmask,
            'options_upper_32bit': license.options_upper_32bit
        })
    
    @action(detail=False, methods=['get'])
    def by_customer(self, request):
        """Gibt alle Lizenzen eines Kunden zurück"""
        customer_id = request.query_params.get('customer_id')
        if not customer_id:
            return Response(
                {'error': 'customer_id ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        licenses = self.queryset.filter(customer_id=customer_id)
        serializer = VisiViewLicenseListSerializer(licenses, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search_by_customer(self, request):
        """
        Sucht VisiView-Lizenzen für Lieferscheine basierend auf Kunde.
        Gibt Seriennummern und Lizenzinformationen zurück.
        """
        customer_id = request.query_params.get('customer_id')
        article_number = request.query_params.get('article_number', '')
        
        if not customer_id:
            return Response({'results': []})
        
        # Suche nach Lizenzen dieses Kunden
        queryset = VisiViewLicense.objects.filter(
            customer_id=customer_id
        ).select_related('customer').order_by('-created_at')[:20]
        
        # Wenn article_number angegeben, filtere nach Produkt
        if article_number:
            # TODO: Verknüpfung zwischen VisiViewProduct und Lizenz wenn vorhanden
            pass
        
        serializer = VisiViewLicenseListSerializer(queryset, many=True)
        return Response({'results': serializer.data})

    # ============================================================
    # Maintenance Time Credits & Expenditures
    # ============================================================
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Gibt alle History-Einträge für eine Lizenz zurück"""
        license = self.get_object()
        history_entries = license.history.select_related(
            'changed_by', 'production_order'
        ).order_by('-changed_at')
        
        serializer = VisiViewLicenseHistorySerializer(history_entries, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def maintenance(self, request, pk=None):
        """Gibt alle Wartungsdaten für eine Lizenz zurück inkl. Berechnung und Zwischenabrechnungen"""
        license = self.get_object()
        
        # Zeitgutschriften
        credits = MaintenanceTimeCredit.objects.filter(license=license).order_by('start_date', 'end_date')
        
        # Zeitaufwendungen
        expenditures = MaintenanceTimeExpenditure.objects.filter(license=license).order_by('-date', '-time')
        
        # Saldo berechnen (inkl. Zwischenabrechnungen)
        balance = calculate_maintenance_balance(license.id)
        
        # Settlements für Frontend aufbereiten
        settlements_data = []
        for settlement in balance.get('settlements', []):
            settlement_dict = {
                'credit': MaintenanceTimeCreditSerializer(settlement['credit']).data if settlement['credit'] else None,
                'expenditures': MaintenanceTimeExpenditureSerializer(settlement['expenditures'], many=True).data,
                'credit_amount': str(settlement['credit_amount']),
                'carry_over_in': str(settlement['carry_over_in']),
                'expenditure_total': str(settlement['expenditure_total']),
                'balance': str(settlement['balance']),
                'carry_over_out': str(settlement['carry_over_out']),
                'is_final': settlement['is_final'],
            }
            settlements_data.append(settlement_dict)
        
        return Response({
            'total_expenditures': balance['total_expenditures'],
            'total_credits': balance['total_credits'],
            'current_balance': balance['current_balance'],
            'time_credits': MaintenanceTimeCreditSerializer(credits, many=True).data,
            'time_expenditures': MaintenanceTimeExpenditureSerializer(expenditures, many=True).data,
            'settlements': settlements_data
        })
    
    @action(detail=True, methods=['get'])
    def time_credits(self, request, pk=None):
        """Gibt alle Zeitgutschriften für eine Lizenz zurück"""
        license = self.get_object()
        credits = MaintenanceTimeCredit.objects.filter(license=license).order_by('start_date', 'end_date')
        serializer = MaintenanceTimeCreditSerializer(credits, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_time_credit(self, request, pk=None):
        """Fügt eine neue Zeitgutschrift hinzu"""
        license = self.get_object()
        
        data = request.data.copy()
        data['license'] = license.id
        
        # Defaults
        if not data.get('start_date'):
            data['start_date'] = date.today().isoformat()
        if not data.get('user'):
            data['user'] = request.user.id
        
        # remaining_hours wird automatisch auf credit_hours gesetzt
        if data.get('credit_hours') and not data.get('remaining_hours'):
            data['remaining_hours'] = data['credit_hours']
        
        serializer = MaintenanceTimeCreditSerializer(data=data)
        if serializer.is_valid():
            credit = serializer.save(created_by=request.user)
            # Prüfe ob bestehende Zeitschuld getilgt werden kann
            apply_new_credit_to_debt(credit)
            return Response(MaintenanceTimeCreditSerializer(credit).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['patch', 'put'], url_path='update_time_credit/(?P<credit_id>[^/.]+)')
    def update_time_credit(self, request, pk=None, credit_id=None):
        """Aktualisiert eine Zeitgutschrift"""
        license = self.get_object()
        try:
            credit = MaintenanceTimeCredit.objects.get(id=credit_id, license=license)
        except MaintenanceTimeCredit.DoesNotExist:
            return Response({'error': 'Zeitgutschrift nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = MaintenanceTimeCreditSerializer(credit, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'], url_path='delete_time_credit/(?P<credit_id>[^/.]+)')
    def delete_time_credit(self, request, pk=None, credit_id=None):
        """Löscht eine Zeitgutschrift. Falls bereits Teile der Gutschrift verwendet wurden,
        erzeugen wir eine Zeitschuld in Höhe von (credit_hours - remaining_hours),
        damit bereits verbuchte Zeitaufwendungen berücksichtigt bleiben.
        """
        license = self.get_object()
        try:
            credit = MaintenanceTimeCredit.objects.get(id=credit_id, license=license)
        except MaintenanceTimeCredit.DoesNotExist:
            return Response({'error': 'Zeitgutschrift nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)
        
        # Transferiere Deductionen zurück in Zeitschuld für die betroffenen Aufwendungen
        from .models import MaintenanceTimeCreditDeduction
        deductions = list(MaintenanceTimeCreditDeduction.objects.filter(credit=credit))
        total_deducted = Decimal('0')
        for d in deductions:
            exp = d.expenditure
            exp.created_debt = Decimal(exp.created_debt or 0) + Decimal(d.hours_deducted)
            exp.save()
            total_deducted += Decimal(d.hours_deducted)
            # entferne die Deduction
            d.delete()

        # Berechne, wie viel der Gutschrift tatsächlich verwendet wurde
        used = (Decimal(credit.credit_hours) - Decimal(credit.remaining_hours)) if credit.credit_hours is not None and credit.remaining_hours is not None else Decimal('0')

        # Falls es eine Differenz zwischen dem verwendeten Betrag und den dokumentierten Deductionen
        # gibt, erzeugen wir nur diese Differenz als zusätzliche Zeitschuld.
        residual = used - total_deducted
        if residual > 0:
            try:
                MaintenanceTimeExpenditure.objects.create(
                    license=license,
                    date=date.today(),
                    time=None,
                    user=credit.user if credit.user_id else request.user,
                    activity='remote_support',
                    task_type='other',
                    hours_spent=Decimal('0'),
                    comment=f'Automatische Zeitschuld durch Löschen der Gutschrift #{credit.id} (Residual)',
                    is_goodwill=False,
                    created_debt=residual,
                    created_by=request.user
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.exception('Fehler beim Erstellen der Zeitschuld: %s', e)

        credit.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['get'])
    def time_expenditures(self, request, pk=None):
        """Gibt alle Zeitaufwendungen für eine Lizenz zurück"""
        license = self.get_object()
        expenditures = MaintenanceTimeExpenditure.objects.filter(license=license).order_by('-date', '-time')
        serializer = MaintenanceTimeExpenditureSerializer(expenditures, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_time_expenditure(self, request, pk=None):
        """Fügt eine neue Zeitaufwendung hinzu"""
        license = self.get_object()
        
        data = request.data.copy()
        data['license'] = license.id
        
        # Defaults
        if not data.get('date'):
            data['date'] = date.today().isoformat()
        if not data.get('time'):
            data['time'] = timezone.now().strftime('%H:%M')
        if not data.get('user'):
            data['user'] = request.user.id
        
        serializer = MaintenanceTimeExpenditureSerializer(data=data)
        if serializer.is_valid():
            expenditure = serializer.save(created_by=request.user)
            # Verarbeite die Zeitabzüge von Gutschriften
            process_expenditure_deduction(expenditure)
            return Response(MaintenanceTimeExpenditureSerializer(expenditure).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['patch', 'put'], url_path='update_time_expenditure/(?P<expenditure_id>[^/.]+)')
    def update_time_expenditure(self, request, pk=None, expenditure_id=None):
        """Aktualisiert eine Zeitaufwendung"""
        license = self.get_object()
        try:
            expenditure = MaintenanceTimeExpenditure.objects.get(id=expenditure_id, license=license)
        except MaintenanceTimeExpenditure.DoesNotExist:
            return Response({'error': 'Zeitaufwendung nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = MaintenanceTimeExpenditureSerializer(expenditure, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'], url_path='delete_time_expenditure/(?P<expenditure_id>[^/.]+)')
    def delete_time_expenditure(self, request, pk=None, expenditure_id=None):
        """Löscht eine Zeitaufwendung"""
        license = self.get_object()
        try:
            expenditure = MaintenanceTimeExpenditure.objects.get(id=expenditure_id, license=license)
        except MaintenanceTimeExpenditure.DoesNotExist:
            return Response({'error': 'Zeitaufwendung nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)
        
        expenditure.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    # Maintenance Invoices
    @action(detail=True, methods=['get'])
    def maintenance_invoices(self, request, pk=None):
        """Gibt alle Maintenance-Abrechnungen für eine Lizenz zurück"""
        license = self.get_object()
        from .models import MaintenanceInvoice
        from .serializers import MaintenanceInvoiceSerializer
        
        invoices = MaintenanceInvoice.objects.filter(license=license).order_by('-created_at')
        serializer = MaintenanceInvoiceSerializer(invoices, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def generate_maintenance_invoice(self, request, pk=None):
        """Erstellt eine neue Maintenance-Abrechnung als PDF"""
        license = self.get_object()
        from .models import MaintenanceInvoice, MaintenanceTimeCredit, MaintenanceTimeExpenditure
        from .serializers import MaintenanceInvoiceSerializer, calculate_maintenance_balance
        from .maintenance_invoice_pdf_generator import generate_maintenance_invoice_pdf
        from django.core.files.base import ContentFile
        from decimal import Decimal
        import os
        
        # Optional: Start- und Enddatum für Filterung
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        invoice_number = request.data.get('invoice_number', '')
        
        start_date = None
        end_date = None
        
        if start_date_str:
            from datetime import datetime
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        if end_date_str:
            from datetime import datetime
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        try:
            # Generiere PDF
            pdf_buffer = generate_maintenance_invoice_pdf(license, start_date, end_date)
            
            # Berechne Totale für diese Abrechnung
            credits_qs = MaintenanceTimeCredit.objects.filter(license=license)
            expenditures_qs = MaintenanceTimeExpenditure.objects.filter(license=license)
            
            if start_date:
                credits_qs = credits_qs.filter(start_date__gte=start_date)
                expenditures_qs = expenditures_qs.filter(date__gte=start_date)
            if end_date:
                credits_qs = credits_qs.filter(end_date__lte=end_date)
                expenditures_qs = expenditures_qs.filter(date__lte=end_date)
            
            total_credits = sum(Decimal(str(c.credit_hours)) for c in credits_qs)
            total_expenditures = sum(Decimal(str(e.hours_spent)) for e in expenditures_qs)
            balance = total_credits - total_expenditures
            
            # Erstelle MaintenanceInvoice-Eintrag
            invoice = MaintenanceInvoice.objects.create(
                license=license,
                invoice_number=invoice_number,
                start_date=start_date,
                end_date=end_date,
                total_credits=total_credits,
                total_expenditures=total_expenditures,
                balance=balance,
                created_by=request.user
            )
            
            # Speichere PDF in license-specific folder
            serial_number = license.serial_number or f'L{license.id}'
            # Sanitize serial number for filename
            safe_serial = ''.join(c if c.isalnum() or c in ['-', '_'] else '_' for c in serial_number)
            filename = f"maintenance_invoice_{safe_serial}_{invoice.id}.pdf"
            filepath = os.path.join('VisiView', 'Lizenzen', safe_serial, filename)
            
            invoice.pdf_file.save(filepath, ContentFile(pdf_buffer.read()), save=True)
            
            serializer = MaintenanceInvoiceSerializer(invoice, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.exception('Error generating maintenance invoice: %s', e)
            return Response(
                {'error': f'Fehler beim Generieren der Abrechnung: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['delete'], url_path='delete_maintenance_invoice/(?P<invoice_id>[^/.]+)')
    def delete_maintenance_invoice(self, request, pk=None, invoice_id=None):
        """Löscht eine Maintenance-Abrechnung"""
        license = self.get_object()
        from .models import MaintenanceInvoice
        
        try:
            invoice = MaintenanceInvoice.objects.get(id=invoice_id, license=license)
        except MaintenanceInvoice.DoesNotExist:
            return Response({'error': 'Abrechnung nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)
        
        # Lösche PDF-Datei vom Speicher
        if invoice.pdf_file:
            try:
                invoice.pdf_file.delete(save=False)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning('Could not delete PDF file: %s', e)
        
        invoice.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VisiViewTicketViewSet(viewsets.ModelViewSet):
    """
    ViewSet für VisiView Tickets (Bug/Fehler und Feature Requests)
    """
    queryset = VisiViewTicket.objects.select_related(
        'parent_ticket', 'author_user', 'assigned_to', 'created_by'
    ).all()
    permission_classes = [IsAuthenticated, VisiViewTicketPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tracker', 'status', 'priority', 'category', 'assigned_to', 'is_private', 'target_version', 'linked_system']
    search_fields = ['ticket_number', 'title', 'description', 'author', 'target_version', 'affected_version']
    ordering_fields = ['ticket_number', 'priority', 'status', 'created_at', 'updated_at', 'target_version', 'assigned_to']
    ordering = ['-ticket_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewTicketListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewTicketCreateUpdateSerializer
        return VisiViewTicketDetailSerializer
    
    def get_queryset(self):
        queryset = VisiViewTicket.objects.select_related(
            'parent_ticket', 'author_user', 'assigned_to', 'created_by'
        ).all()
        
        # Filter für offene/geschlossene Tickets
        is_open = self.request.query_params.get('is_open')
        if is_open is not None:
            if is_open.lower() == 'true':
                queryset = queryset.exclude(status__in=['resolved', 'closed', 'rejected'])
            else:
                queryset = queryset.filter(status__in=['resolved', 'closed', 'rejected'])
        
        return queryset
    
    def perform_create(self, serializer):
        ticket = serializer.save(created_by=self.request.user)
        # Ersteller automatisch als Beobachter hinzufügen
        if ticket.created_by:
            ticket.watchers.add(ticket.created_by)
        # Zugewiesener User als Beobachter
        if ticket.assigned_to:
            ticket.watchers.add(ticket.assigned_to)
            # Erstelle eine Erinnerungsaufgabe für den zugewiesenen Mitarbeiter (Fällig: morgen)
            try:
                from django.utils import timezone
                from datetime import timedelta
                from users.models import Reminder, Notification
                due = timezone.now().date() + timedelta(days=1)
                Reminder.objects.create(
                    user=ticket.assigned_to,
                    title=f"Zugewiesen: Ticket #{ticket.ticket_number}",
                    description=f"Ticket '{ticket.title}' wurde Ihnen zugewiesen.",
                    due_date=due,
                    related_object_type='visiview_ticket',
                    related_object_id=ticket.id,
                    related_url=f"/visiview/tickets/{ticket.id}"
                )
                # Benachrichtigung im NotificationCenter
                Notification.objects.create(
                    user=ticket.assigned_to,
                    title=f"Ticket #{ticket.ticket_number} zugewiesen",
                    message=f"Das Ticket '{ticket.title}' wurde Ihnen zugewiesen.",
                    notification_type='info',
                    related_url=f'/visiview/tickets/{ticket.id}'
                )
            except Exception:
                # Nicht fatal für Ticket-Erstellung
                pass
    
    def perform_update(self, serializer):
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"=== perform_update aufgerufen für Ticket ===")
        
        old_instance = self.get_object()
        old_data = {
            'title': old_instance.title,
            'tracker': old_instance.tracker,
            'status': old_instance.status,
            'priority': old_instance.priority,
            'category': old_instance.category,
            'assigned_to': old_instance.assigned_to_id,
            'target_version': old_instance.target_version,
            'percent_done': old_instance.percent_done,
        }
        old_assigned_to = old_instance.assigned_to
        
        instance = serializer.save()
        logger.warning(f"Ticket gespeichert: #{instance.ticket_number}, Watchers: {list(instance.watchers.values_list('username', flat=True))}")
        
        # Änderungen protokollieren
        field_labels = {
            'title': 'Thema',
            'tracker': 'Tracker',
            'status': 'Status',
            'priority': 'Priorität',
            'category': 'Kategorie',
            'assigned_to': 'Zugewiesen an',
            'target_version': 'Zielversion',
            'percent_done': '% erledigt',
        }
        
        new_data = {
            'title': instance.title,
            'tracker': instance.tracker,
            'status': instance.status,
            'priority': instance.priority,
            'category': instance.category,
            'assigned_to': instance.assigned_to_id,
            'target_version': instance.target_version,
            'percent_done': instance.percent_done,
        }
        
        changes = []
        for field, old_value in old_data.items():
            new_value = new_data.get(field)
            if old_value != new_value:
                VisiViewTicketChangeLog.objects.create(
                    ticket=instance,
                    field_name=field_labels.get(field, field),
                    old_value=str(old_value or ''),
                    new_value=str(new_value or ''),
                    changed_by=self.request.user
                )
                changes.append((field_labels.get(field, field), str(old_value or ''), str(new_value or '')))
        
        logger.warning(f"Änderungen gefunden: {len(changes)} - {[c[0] for c in changes]}")
        
        # Wenn "Zugewiesen an" geändert wurde, Beobachter aktualisieren
        if old_assigned_to != instance.assigned_to:
            if old_assigned_to:
                instance.watchers.remove(old_assigned_to)
            if instance.assigned_to:
                instance.watchers.add(instance.assigned_to)
                # Erstelle eine Erinnerungsaufgabe für den neuen zugewiesenen Mitarbeiter (Fällig: morgen)
                try:
                    from django.utils import timezone
                    from datetime import timedelta
                    from users.models import Reminder, Notification
                    due = timezone.now().date() + timedelta(days=1)
                    Reminder.objects.create(
                        user=instance.assigned_to,
                        title=f"Zugewiesen: Ticket #{instance.ticket_number}",
                        description=f"Ticket '{instance.title}' wurde Ihnen zugewiesen.",
                        due_date=due,
                        related_object_type='visiview_ticket',
                        related_object_id=instance.id,
                        related_url=f"/visiview/tickets/{instance.id}"
                    )
                    # Benachrichtigung im NotificationCenter
                    Notification.objects.create(
                        user=instance.assigned_to,
                        title=f"Ticket #{instance.ticket_number} zugewiesen",
                        message=f"Das Ticket '{instance.title}' wurde Ihnen zugewiesen.",
                        notification_type='info',
                        related_url=f'/visiview/tickets/{instance.id}'
                    )
                except Exception:
                    pass

        # Benachrichtige Beobachter über die Änderungen (als Nachricht in der Inbox)
        if changes:
            from users.models import Message
            import logging
            logger = logging.getLogger(__name__)
            
            try:
                message_lines = [f"Änderungen an VisiView Ticket #{instance.ticket_number} - {instance.title}"]
                message_lines.append("")  # Leerzeile
                for label, oldv, newv in changes:
                    message_lines.append(f"• {label}: {oldv or '(leer)'} → {newv or '(leer)'}")
                message_lines.append("")  # Leerzeile
                message_lines.append(f"Link zum Ticket: /visiview/tickets/{instance.id}")
                message_text = "\n".join(message_lines)

                # Sammle alle zu benachrichtigenden User (Beobachter + zugewiesener Mitarbeiter)
                recipients = set(instance.watchers.all())
                if instance.assigned_to:
                    recipients.add(instance.assigned_to)

                logger.warning(f"Sende Ticket-Benachrichtigungen an {len(recipients)} Empfänger")
                
                for recipient in recipients:
                    # Sende nicht an den Ändernden selbst
                    if recipient == self.request.user:
                        continue
                    try:
                        notification = Notification.objects.create(
                            user=recipient,
                            title=f"Änderung des Tickets #{instance.ticket_number}",
                            message=message_text,
                            notification_type='info',
                            related_url=f'/visiview/tickets/{instance.id}'
                        )
                        logger.warning(f"Benachrichtigung erstellt für {recipient.username}: ID {notification.id}")
                    except Exception as e:
                        logger.error(f"Fehler beim Erstellen der Benachrichtigung für {recipient.username}: {e}")
                        
            except Exception as e:
                # Nicht fatal - loggen für Debugging
                logger.error(f"Fehler beim Senden von Ticket-Benachrichtigungen: {e}")
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_attachment(self, request, pk=None):
        """Lädt eine Datei für das Ticket hoch"""
        ticket = self.get_object()
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({'error': 'Keine Datei hochgeladen'}, status=status.HTTP_400_BAD_REQUEST)
        
        attachment = VisiViewTicketAttachment.objects.create(
            ticket=ticket,
            file=file_obj,
            filename=file_obj.name,
            file_size=file_obj.size,
            content_type=file_obj.content_type or '',
            uploaded_by=request.user
        )
        
        serializer = VisiViewTicketAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='delete_attachment/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Löscht einen Dateianhang"""
        ticket = self.get_object()
        try:
            attachment = VisiViewTicketAttachment.objects.get(id=attachment_id, ticket=ticket)
            attachment.file.delete()
            attachment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except VisiViewTicketAttachment.DoesNotExist:
            raise Http404("Anhang nicht gefunden")
    
    @action(detail=True, methods=['get'], url_path='download_attachment/(?P<attachment_id>[^/.]+)')
    def download_attachment(self, request, pk=None, attachment_id=None):
        """Lädt einen Dateianhang herunter"""
        ticket = self.get_object()
        try:
            attachment = VisiViewTicketAttachment.objects.get(id=attachment_id, ticket=ticket)
            return FileResponse(attachment.file.open('rb'), 
                              as_attachment=True, 
                              filename=attachment.filename)
        except VisiViewTicketAttachment.DoesNotExist:
            raise Http404("Anhang nicht gefunden")
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Fügt einen Kommentar zum Ticket hinzu"""
        ticket = self.get_object()
        comment_text = request.data.get('comment', '').strip()
        
        if not comment_text:
            return Response(
                {'error': 'Kommentar darf nicht leer sein'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comment = VisiViewTicketComment.objects.create(
            ticket=ticket,
            comment=comment_text,
            created_by=request.user
        )
        
        # Änderungsprotokoll für Kommentar
        VisiViewTicketChangeLog.objects.create(
            ticket=ticket,
            field_name='Kommentar',
            old_value='',
            new_value=f"Neuer Kommentar von {request.user.get_full_name() or request.user.username}",
            changed_by=request.user
        )
        
        serializer = VisiViewTicketCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Gibt alle Kommentare zurück"""
        ticket = self.get_object()
        comments = ticket.comments.all().order_by('-created_at')
        serializer = VisiViewTicketCommentSerializer(comments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def change_log(self, request, pk=None):
        """Gibt das Änderungsprotokoll zurück"""
        ticket = self.get_object()
        logs = ticket.change_logs.all().order_by('-changed_at')
        serializer = VisiViewTicketChangeLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def update_watchers(self, request, pk=None):
        """Aktualisiert die Beobachterliste"""
        ticket = self.get_object()
        watcher_ids = request.data.get('watcher_ids', [])
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Setze neue Beobachter
        ticket.watchers.clear()
        for user_id in watcher_ids:
            try:
                user = User.objects.get(id=user_id)
                ticket.watchers.add(user)
            except User.DoesNotExist:
                pass
        
        # Ersteller und zugewiesener User sollten immer Beobachter sein
        if ticket.created_by:
            ticket.watchers.add(ticket.created_by)
        if ticket.assigned_to:
            ticket.watchers.add(ticket.assigned_to)
        
        return Response({
            'status': 'success',
            'watcher_ids': list(ticket.watchers.values_list('id', flat=True))
        })
    
    @action(detail=False, methods=['get'])
    def open_tickets(self, request):
        """Gibt nur offene Tickets zurück"""
        queryset = self.get_queryset().exclude(status__in=['resolved', 'closed', 'rejected'])
        serializer = VisiViewTicketListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def bugs(self, request):
        """Gibt nur Bug/Fehler-Tickets zurück"""
        queryset = self.get_queryset().filter(tracker='bug')
        serializer = VisiViewTicketListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def features(self, request):
        """Gibt nur Feature Request-Tickets zurück"""
        queryset = self.get_queryset().filter(tracker='feature')
        serializer = VisiViewTicketListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Gibt Statistiken zu den Tickets zurück"""
        queryset = self.get_queryset()
        
        # Status-Verteilung
        status_counts = {}
        for status_choice in VisiViewTicket.STATUS_CHOICES:
            status_counts[status_choice[0]] = queryset.filter(status=status_choice[0]).count()
        
        # Tracker-Verteilung
        tracker_counts = {
            'bug': queryset.filter(tracker='bug').count(),
            'feature': queryset.filter(tracker='feature').count(),
        }
        
        # Prioritäts-Verteilung
        priority_counts = {}
        for priority_choice in VisiViewTicket.PRIORITY_CHOICES:
            priority_counts[priority_choice[0]] = queryset.filter(priority=priority_choice[0]).count()
        
        return Response({
            'total': queryset.count(),
            'open': queryset.exclude(status__in=['resolved', 'closed', 'rejected']).count(),
            'closed': queryset.filter(status__in=['resolved', 'closed', 'rejected']).count(),
            'by_status': status_counts,
            'by_tracker': tracker_counts,
            'by_priority': priority_counts,
        })
    
    @action(detail=True, methods=['get'])
    def time_entries(self, request, pk=None):
        """Gibt alle Zeiteinträge für das Ticket zurück"""
        ticket = self.get_object()
        entries = ticket.time_entries.all().order_by('-date', '-time')
        serializer = VisiViewTicketTimeEntrySerializer(entries, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_time_entry(self, request, pk=None):
        """Fügt einen Zeiteintrag zum Ticket hinzu"""
        from django.utils import timezone
        from django.contrib.auth import get_user_model
        
        ticket = self.get_object()
        User = get_user_model()
        
        # Auto-Defaults
        date = request.data.get('date', timezone.now().date())
        time = request.data.get('time', timezone.now().time())
        employee_id = request.data.get('employee')
        
        # Wenn kein Mitarbeiter angegeben ist, verwende den zugewiesenen User oder den ersten User
        if not employee_id:
            if ticket.assigned_to:
                employee_id = ticket.assigned_to.id
            else:
                first_user = User.objects.first()
                employee_id = first_user.id if first_user else None
        
        hours_spent = request.data.get('hours_spent')
        description = request.data.get('description', '').strip()
        
        # Validierung
        if not hours_spent or not description:
            return Response(
                {'error': 'Aufgewendete Stunden und Beschreibung sind erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            hours_spent = float(hours_spent)
            if hours_spent <= 0:
                raise ValueError("Stunden müssen größer als 0 sein")
        except ValueError as e:
            return Response(
                {'error': f'Ungültiger Wert für aufgewendete Stunden: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Erstelle den Zeiteintrag
        time_entry = VisiViewTicketTimeEntry.objects.create(
            ticket=ticket,
            date=date,
            time=time,
            employee_id=employee_id,
            hours_spent=hours_spent,
            description=description,
            created_by=request.user
        )
        
        serializer = VisiViewTicketTimeEntrySerializer(time_entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['put', 'patch'], url_path='update_time_entry/(?P<entry_id>[^/.]+)')
    def update_time_entry(self, request, pk=None, entry_id=None):
        """Aktualisiert einen Zeiteintrag"""
        ticket = self.get_object()
        try:
            time_entry = VisiViewTicketTimeEntry.objects.get(id=entry_id, ticket=ticket)
        except VisiViewTicketTimeEntry.DoesNotExist:
            raise Http404("Zeiteintrag nicht gefunden")
        
        # Update nur die bereitgestellten Felder
        if 'date' in request.data:
            time_entry.date = request.data['date']
        if 'time' in request.data:
            time_entry.time = request.data['time']
        if 'employee' in request.data:
            time_entry.employee_id = request.data['employee']
        if 'hours_spent' in request.data:
            try:
                hours_spent = float(request.data['hours_spent'])
                if hours_spent <= 0:
                    raise ValueError("Stunden müssen größer als 0 sein")
                time_entry.hours_spent = hours_spent
            except ValueError as e:
                return Response(
                    {'error': f'Ungültiger Wert für aufgewendete Stunden: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if 'description' in request.data:
            time_entry.description = request.data['description']
        
        time_entry.save()
        
        serializer = VisiViewTicketTimeEntrySerializer(time_entry)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_time_entry/(?P<entry_id>[^/.]+)')
    def delete_time_entry(self, request, pk=None, entry_id=None):
        """Löscht einen Zeiteintrag"""
        ticket = self.get_object()
        try:
            time_entry = VisiViewTicketTimeEntry.objects.get(id=entry_id, ticket=ticket)
            time_entry.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except VisiViewTicketTimeEntry.DoesNotExist:
            raise Http404("Zeiteintrag nicht gefunden")


# ==================== VisiView Macro Views ====================

from django.http import HttpResponse
import zipfile
import io
from .models import VisiViewMacro, VisiViewMacroExampleImage, VisiViewMacroChangeLog
from .serializers import (
    VisiViewMacroListSerializer,
    VisiViewMacroDetailSerializer,
    VisiViewMacroCreateUpdateSerializer,
    VisiViewMacroExampleImageSerializer,
    VisiViewMacroChangeLogSerializer
)


class VisiViewMacroViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView Macros"""
    queryset = VisiViewMacro.objects.prefetch_related('dependencies', 'example_images', 'change_logs').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category', 'author_user']
    search_fields = ['macro_id', 'title', 'author', 'keywords', 'purpose', 'category']
    ordering_fields = ['macro_id', 'title', 'created_at', 'updated_at', 'status']
    ordering = ['-macro_id']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return VisiViewMacroListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return VisiViewMacroCreateUpdateSerializer
        return VisiViewMacroDetailSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download des Macros als .txt Datei"""
        macro = self.get_object()
        content = macro.generate_download_content()
        
        response = HttpResponse(content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{macro.filename}"'
        return response
    
    @action(detail=True, methods=['get'])
    def download_with_dependencies(self, request, pk=None):
        """Download des Macros mit allen Abhängigkeiten als ZIP"""
        macro = self.get_object()
        
        # Sammle alle Macros (Haupt-Macro + Abhängigkeiten)
        macros_to_download = [macro]
        macros_to_download.extend(macro.dependencies.all())
        
        # Erstelle ZIP-Datei
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for m in macros_to_download:
                content = m.generate_download_content()
                zip_file.writestr(m.filename, content)
        
        buffer.seek(0)
        
        # Dateiname für ZIP
        safe_title = "".join(c for c in macro.title if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title.replace(' ', '_')
        zip_filename = f"{macro.macro_id}_{safe_title}_with_dependencies.zip"
        
        response = HttpResponse(buffer.read(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{zip_filename}"'
        return response
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Gibt alle vorhandenen Kategorien zurück"""
        categories = VisiViewMacro.objects.exclude(
            category__isnull=True
        ).exclude(
            category=''
        ).values_list('category', flat=True).distinct().order_by('category')
        return Response(list(categories))
    
    @action(detail=False, methods=['get'])
    def keywords_list(self, request):
        """Gibt alle vorhandenen Keywords zurück"""
        macros = VisiViewMacro.objects.exclude(keywords='').values_list('keywords', flat=True)
        all_keywords = set()
        for kw_string in macros:
            if kw_string:
                for kw in kw_string.split(','):
                    kw = kw.strip()
                    if kw:
                        all_keywords.add(kw)
        return Response(sorted(list(all_keywords)))
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Gibt Statistiken zu den Macros zurück"""
        queryset = self.get_queryset()
        
        # Status-Verteilung
        status_counts = {}
        for status_choice in VisiViewMacro.STATUS_CHOICES:
            status_counts[status_choice[0]] = queryset.filter(status=status_choice[0]).count()
        
        return Response({
            'total': queryset.count(),
            'by_status': status_counts,
        })


class VisiViewMacroExampleImageViewSet(viewsets.ModelViewSet):
    """ViewSet für Macro Beispielbilder"""
    queryset = VisiViewMacroExampleImage.objects.all()
    serializer_class = VisiViewMacroExampleImageSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['macro']


class VisiViewMacroChangeLogViewSet(viewsets.ModelViewSet):
    """ViewSet für Macro Änderungsprotokoll"""
    queryset = VisiViewMacroChangeLog.objects.all()
    serializer_class = VisiViewMacroChangeLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['macro']
    ordering = ['-changed_at']
    
    def perform_create(self, serializer):
        serializer.save(changed_by=self.request.user)


class MaintenanceTimeEntryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet für alle Maintenance-Zeitaufwendungen (lizenzübergreifend)"""
    queryset = MaintenanceTimeExpenditure.objects.all().select_related('license', 'user', 'created_by')
    serializer_class = MaintenanceTimeExpenditureListSerializer
    permission_classes = [IsAuthenticated, VisiViewMaintenanceTimePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['license', 'user', 'activity', 'task_type', 'is_goodwill']
    search_fields = ['license__serial_number', 'license__customer_name_legacy', 'comment']
    ordering_fields = ['date', 'hours_spent', 'activity', 'created_at']
    ordering = ['-date', '-time']
    
    # Pagination
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination


class SupportedHardwareViewSet(viewsets.ModelViewSet):
    """ViewSet für VisiView kompatible Hardware"""
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = SupportedHardware.objects.all()
    permission_classes = [IsAuthenticated, VisiViewSupportedHardwarePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'manufacturer', 'support_level', 'data_quality']
    search_fields = ['manufacturer', 'device', 'driver_name', 'comment', 'limitations']
    ordering_fields = ['category', 'manufacturer', 'device', 'support_level', 'actualization_date']
    ordering = ['category', 'manufacturer', 'device']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SupportedHardwareListSerializer
        return SupportedHardwareSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Gibt alle verfügbaren Kategorien zurück"""
        return Response([choice[0] for choice in SupportedHardware.CATEGORY_CHOICES])
    
    @action(detail=False, methods=['get'])
    def support_levels(self, request):
        """Gibt alle verfügbaren Support-Level zurück"""
        return Response([choice[0] for choice in SupportedHardware.SUPPORT_LEVEL_CHOICES])
    
    @action(detail=False, methods=['get'])
    def manufacturers(self, request):
        """Gibt alle vorhandenen Hersteller zurück"""
        manufacturers = SupportedHardware.objects.values_list('manufacturer', flat=True).distinct().order_by('manufacturer')
        return Response(list(manufacturers))
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Gibt Statistiken zur unterstützten Hardware zurück"""
        queryset = self.get_queryset()
        
        # Anzahl pro Kategorie
        category_counts = {}
        for category_choice in SupportedHardware.CATEGORY_CHOICES:
            category_counts[category_choice[0]] = queryset.filter(category=category_choice[0]).count()
        
        # Anzahl pro Support-Level
        support_level_counts = {}
        for level_choice in SupportedHardware.SUPPORT_LEVEL_CHOICES:
            support_level_counts[level_choice[0]] = queryset.filter(support_level=level_choice[0]).count()
        
        return Response({
            'total': queryset.count(),
            'by_category': category_counts,
            'by_support_level': support_level_counts,
        })


class SupportedHardwareUseCaseViewSet(viewsets.ModelViewSet):
    """ViewSet für Hardware Use Cases"""
    queryset = SupportedHardwareUseCase.objects.all().select_related(
        'hardware', 'customer', 'license', 'system', 'created_by'
    )
    serializer_class = SupportedHardwareUseCaseSerializer
    permission_classes = [IsAuthenticated, VisiViewSupportedHardwarePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['hardware', 'customer', 'license', 'system']
    search_fields = ['customer__name', 'license__serial_number', 'system__system_number', 'comment', 'visiview_version']
    ordering_fields = ['date', 'created_at']
    ordering = ['-date', '-created_at']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

