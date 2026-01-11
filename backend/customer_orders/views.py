from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from django_filters import CharFilter
from django.utils import timezone
from django.http import FileResponse
from django.conf import settings
from .models import CustomerOrder, CustomerOrderItem, DeliveryNote, Invoice, Payment, CustomerOrderCommissionRecipient, EmployeeCommission
from .serializers import (
    CustomerOrderListSerializer, 
    CustomerOrderDetailSerializer, 
    CustomerOrderCreateUpdateSerializer,
    CustomerOrderConfirmSerializer,
    CustomerOrderItemSerializer,
    DeliveryNoteListSerializer,
    DeliveryNoteDetailSerializer,
    DeliveryNoteCreateSerializer,
    InvoiceListSerializer,
    InvoiceDetailSerializer,
    InvoiceCreateSerializer,
    PaymentSerializer,
    PaymentCreateSerializer,
    CustomerOrderCommissionRecipientSerializer,
    EmployeeCommissionSerializer,
)
from rest_framework.pagination import PageNumberPagination


class CustomerOrderPagination(PageNumberPagination):
    page_size = 9
    page_size_query_param = 'page_size'
    max_page_size = 100


class CustomerOrderFilter(FilterSet):
    """Custom filter for customer orders with year support"""
    year = CharFilter(field_name='order_date', lookup_expr='year')
    
    class Meta:
        model = CustomerOrder
        fields = ['status', 'customer', 'year']


class CustomerOrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Kundenaufträge
    
    Aktionen:
    - list: Liste aller Aufträge
    - retrieve: Einzelner Auftrag mit Details
    - create: Neuen Auftrag anlegen
    - update/partial_update: Auftrag bearbeiten
    - confirm: Auftrag bestätigen (generiert Auftragsnummer)
    - generate_confirmation_pdf: AB-PDF erstellen
    """
    queryset = CustomerOrder.objects.select_related(
        'customer', 'quotation', 'payment_term', 'delivery_term', 'warranty_term',
        'created_by', 'confirmed_by'
    ).prefetch_related('items', 'delivery_notes', 'invoices')
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = CustomerOrderFilter
    search_fields = ['order_number', 'project_reference', 'system_reference', 
                     'customer__first_name', 'customer__last_name', 
                     'customer__addresses__university', 'customer__addresses__institute',
                     'customer_contact_name']
    ordering_fields = ['order_number', 'order_date', 'created_at', 'status']
    ordering = ['-created_at']
    pagination_class = CustomerOrderPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerOrderListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return CustomerOrderCreateUpdateSerializer
        if self.action == 'confirm':
            return CustomerOrderConfirmSerializer
        return CustomerOrderDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """
        Beim Erstellen eines Auftrags: benutze den Create-Serializer zum Validieren,
        speichere das Objekt und liefere danach das Detail-Serialisierte Objekt
        zurück (inkl. `id`), damit Clients die neue ID erhalten.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = serializer.instance
        # Verwende den Detail-Serializer für die Antwort, damit Felder wie `id`
        # und berechnete Felder enthalten sind.
        out_serializer = CustomerOrderDetailSerializer(instance, context={'request': request})
        headers = self.get_success_headers(out_serializer.data)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """
        Bestätigt einen Auftrag und generiert die Auftragsnummer
        
        POST /api/customer-orders/{id}/confirm/
        Body: { "confirmed_date": "2024-01-15", "notes": "Optional" }
        """
        order = self.get_object()
        
        serializer = CustomerOrderConfirmSerializer(
            data=request.data,
            context={'order': order, 'request': request}
        )
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Auftragsnummer generieren
        order.generate_order_number()
        
        # Status und Bestätigung setzen
        order.status = 'bestaetigt'
        order.confirmation_date = serializer.validated_data.get('confirmation_date', timezone.now().date())
        order.confirmed_by = request.user
        
        # Notizen ergänzen falls vorhanden
        if serializer.validated_data.get('notes'):
            if order.order_notes:
                order.order_notes += f"\n\n{serializer.validated_data['notes']}"
            else:
                order.order_notes = serializer.validated_data['notes']
        
        order.save()
        
        # Verknüpftes Angebot auf Status ORDERED setzen
        if order.quotation:
            from sales.models import Quotation
            try:
                quotation = Quotation.objects.get(id=order.quotation.id)
                if quotation.status != 'ORDERED':
                    quotation.status = 'ORDERED'
                    quotation.save()
            except Quotation.DoesNotExist:
                pass
        
        return Response({
            'status': 'success',
            'message': f'Auftrag {order.order_number} wurde bestätigt.',
            'order_number': order.order_number,
            'confirmation_date': order.confirmation_date
        })

    @action(detail=True, methods=['post'])
    def generate_confirmation_pdf(self, request, pk=None):
        """
        Generiert die Auftragsbestätigung als PDF und gibt sie direkt zurück
        
        POST /api/customer-orders/{id}/generate_confirmation_pdf/
        """
        order = self.get_object()
        
        if order.status == 'angelegt':
            return Response(
                {'error': 'Auftrag muss zuerst bestätigt werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # PDF generieren
        try:
            from .pdf_generator import generate_order_confirmation_pdf
            pdf_path = generate_order_confirmation_pdf(order)
            order.confirmation_pdf = pdf_path
            order.save()
            
            # PDF als FileResponse zurückgeben
            if order.confirmation_pdf:
                import os
                from django.conf import settings
                file_path = os.path.join(settings.MEDIA_ROOT, str(order.confirmation_pdf))
                if os.path.exists(file_path):
                    response = FileResponse(
                        open(file_path, 'rb'),
                        content_type='application/pdf'
                    )
                    response['Content-Disposition'] = f'attachment; filename="AB_{order.order_number}.pdf"'
                    return response
            
            return Response(
                {'error': 'PDF konnte nicht erstellt werden.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except ImportError:
            return Response({
                'status': 'pending',
                'message': 'PDF-Generator wird noch implementiert.'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def recalculate_commissions(self, request, pk=None):
        """
        Berechnet die Provisionen für diesen Auftrag neu
        
        POST /api/customer-orders/{id}/recalculate_commissions/
        """
        order = self.get_object()
        
        if order.status != 'bestaetigt':
            return Response(
                {'error': 'Provisionen können nur für bestätigte Aufträge berechnet werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not order.commission_recipients.exists():
            return Response(
                {'error': 'Keine Provisionsempfänger definiert.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Delete old commissions for this order
            from .models import EmployeeCommission
            deleted_count = EmployeeCommission.objects.filter(customer_order=order).delete()[0]
            
            # Recalculate commissions
            order._calculate_commissions()
            
            # Get new commission count
            new_count = EmployeeCommission.objects.filter(customer_order=order).count()
            
            return Response({
                'status': 'success',
                'message': f'Provisionen neu berechnet.',
                'deleted': deleted_count,
                'created': new_count
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        """
        Setzt den Status des Auftrags
        
        POST /api/customer-orders/{id}/set_status/
        Body: { "status": "in_produktion" }
        """
        order = self.get_object()
        new_status = request.data.get('status')
        
        valid_statuses = [s[0] for s in CustomerOrder.STATUS_CHOICES]
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Ungültiger Status. Erlaubt: {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validierung der Statusübergänge
        if new_status == 'bestaetigt' and order.status != 'angelegt':
            return Response(
                {'error': 'Nur Aufträge mit Status "angelegt" können bestätigt werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order.status = new_status
        order.save()
        
        return Response({
            'status': 'success',
            'message': f'Status auf "{order.get_status_display()}" geändert.',
            'new_status': new_status
        })

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """
        Liefert eine Zusammenfassung des Auftrags
        
        GET /api/customer-orders/{id}/summary/
        """
        order = self.get_object()
        
        items = order.items.all()
        delivered_items = items.filter(is_delivered=True).count()
        invoiced_items = items.filter(is_invoiced=True).count()
        total_items = items.count()
        
        total_paid = sum(
            payment.amount 
            for invoice in order.invoices.all() 
            for payment in invoice.payments.all()
        )
        
        total_gross = order.calculate_total() * (1 + (order.tax_rate or 19) / 100)
        
        return Response({
            'order_number': order.order_number,
            'status': order.status,
            'status_display': order.get_status_display(),
            'customer_name': order.customer.company_name if order.customer else None,
            'items': {
                'total': total_items,
                'delivered': delivered_items,
                'invoiced': invoiced_items,
                'pending_delivery': total_items - delivered_items,
                'pending_invoice': total_items - invoiced_items,
            },
            'financials': {
                'total_net': float(order.calculate_total()),
                'total_gross': float(total_gross),
                'total_paid': float(total_paid),
                'open_amount': float(total_gross - total_paid),
            },
            'documents': {
                'delivery_notes': order.delivery_notes.count(),
                'invoices': order.invoices.count(),
                'has_confirmation_pdf': bool(order.confirmation_pdf),
            }
        })


class CustomerOrderItemViewSet(viewsets.ModelViewSet):
    """ViewSet für Auftragspositionen"""
    queryset = CustomerOrderItem.objects.all()
    serializer_class = CustomerOrderItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order', 'is_delivered', 'is_invoiced']


class DeliveryNoteViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferscheine
    
    Aktionen:
    - list: Liste aller Lieferscheine
    - retrieve: Einzelner Lieferschein
    - create: Neuen Lieferschein erstellen (mit item_ids)
    - generate_pdf: PDF erstellen
    """
    queryset = DeliveryNote.objects.select_related('order', 'order__customer', 'created_by')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['order']
    search_fields = ['delivery_note_number', 'order__order_number']
    ordering_fields = ['delivery_note_number', 'delivery_date', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return DeliveryNoteListSerializer
        if self.action == 'create':
            return DeliveryNoteCreateSerializer
        return DeliveryNoteDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        """Generiert das Lieferschein-PDF und gibt es direkt zurück"""
        delivery_note = self.get_object()
        
        try:
            from .pdf_generator import generate_delivery_note_pdf
            import os
            
            pdf_path = generate_delivery_note_pdf(delivery_note)
            delivery_note.pdf_file = pdf_path
            delivery_note.save()
            
            # PDF als FileResponse zurückgeben (wie AB)
            if delivery_note.pdf_file:
                file_path = os.path.join(settings.MEDIA_ROOT, str(delivery_note.pdf_file))
                if os.path.exists(file_path):
                    response = FileResponse(
                        open(file_path, 'rb'),
                        content_type='application/pdf'
                    )
                    response['Content-Disposition'] = f'inline; filename="LS_{delivery_note.delivery_note_number}.pdf"'
                    return response
            
            return Response(
                {'error': 'PDF konnte nicht erstellt werden.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except ImportError:
            return Response({
                'status': 'pending',
                'message': 'PDF-Generator wird noch implementiert.'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def mark_shipped(self, request, pk=None):
        """Markiert den Lieferschein als versendet"""
        delivery_note = self.get_object()
        
        # Use model field `shipping_date` (existing in DeliveryNote)
        delivery_note.shipping_date = request.data.get('shipped_date', timezone.now().date())
        delivery_note.tracking_number = request.data.get('tracking_number', delivery_note.tracking_number)
        delivery_note.save()
        
        # Auftragsstatus aktualisieren wenn alle Positionen geliefert
        order = delivery_note.order
        undelivered = order.items.filter(is_delivered=False).count()
        if undelivered == 0 and order.status in ['bestaetigt', 'in_produktion']:
            order.status = 'geliefert'
            order.save()
        
        return Response({
            'status': 'success',
            'message': 'Lieferschein als versendet markiert.',
            'shipping_date': delivery_note.shipping_date
        })


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Rechnungen
    
    Aktionen:
    - list: Liste aller Rechnungen
    - retrieve: Einzelne Rechnung mit Zahlungen
    - create: Neue Rechnung erstellen (mit item_ids)
    - generate_pdf: PDF erstellen
    - send: Rechnung versenden
    - mark_paid: Als bezahlt markieren
    """
    queryset = Invoice.objects.select_related('order', 'order__customer', 'created_by').prefetch_related('payments')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['order', 'status']
    search_fields = ['invoice_number', 'order__order_number']
    ordering_fields = ['invoice_number', 'invoice_date', 'due_date', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return InvoiceListSerializer
        if self.action == 'create':
            return InvoiceCreateSerializer
        return InvoiceDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        """Generiert das Rechnungs-PDF und gibt es direkt zurück"""
        invoice = self.get_object()
        
        try:
            from .pdf_generator import generate_invoice_pdf
            import os
            
            pdf_path = generate_invoice_pdf(invoice)
            invoice.pdf_file = pdf_path
            invoice.save()
            
            # PDF als FileResponse zurückgeben (wie AB)
            if invoice.pdf_file:
                file_path = os.path.join(settings.MEDIA_ROOT, str(invoice.pdf_file))
                if os.path.exists(file_path):
                    response = FileResponse(
                        open(file_path, 'rb'),
                        content_type='application/pdf'
                    )
                    response['Content-Disposition'] = f'inline; filename="RE_{invoice.invoice_number}.pdf"'
                    return response
            
            return Response(
                {'error': 'PDF konnte nicht erstellt werden.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except ImportError:
            return Response({
                'status': 'pending',
                'message': 'PDF-Generator wird noch implementiert.'
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    

    @action(detail=True, methods=['post'])
    def generate_xrechnung(self, request, pk=None):
        """
        Generiert eine XRechnung (elektronische Rechnung nach EN 16931).
        
        POST /api/customer-orders/invoices/{id}/generate_xrechnung/
        
        Die XRechnung ist ein XML-Format nach dem deutschen Standard,
        der für B2G-Rechnungen (Business-to-Government) seit Nov 2020 
        verpflichtend ist und ab 2025 auch für B2B relevant wird.
        """
        invoice = self.get_object()
        
        try:
            from .xrechnung_generator import generate_xrechnung_xml, validate_xrechnung
            
            # XRechnung generieren
            xml_path = generate_xrechnung_xml(invoice)
            invoice.xrechnung_file = xml_path
            invoice.save()
            
            # Basis-Validierung
            validation = validate_xrechnung(xml_path)
            
            return Response({
                'status': 'success',
                'message': 'XRechnung wurde erstellt.',
                'xrechnung_url': invoice.xrechnung_file.url if invoice.xrechnung_file else None,
                'validation': validation
            })
        except ImportError as e:
            return Response({
                'status': 'error',
                'message': f'XRechnung-Generator nicht verfügbar: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'Fehler bei XRechnung-Erstellung: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def download_xrechnung(self, request, pk=None):
        """
        Lädt die XRechnung-XML-Datei herunter.
        
        GET /api/customer-orders/invoices/{id}/download_xrechnung/
        """
        invoice = self.get_object()
        
        if not invoice.xrechnung_file:
            return Response(
                {'error': 'Keine XRechnung vorhanden. Bitte zuerst generieren.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        import os
        from django.conf import settings
        
        file_path = os.path.join(settings.MEDIA_ROOT, str(invoice.xrechnung_file))
        if not os.path.exists(file_path):
            return Response(
                {'error': 'XRechnung-Datei nicht gefunden.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        response = FileResponse(
            open(file_path, 'rb'),
            content_type='application/xml'
        )
        response['Content-Disposition'] = f'attachment; filename="XRechnung_{invoice.invoice_number}.xml"'
        return response

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Markiert die Rechnung als versendet"""
        invoice = self.get_object()
        
        if invoice.status != 'draft':
            return Response(
                {'error': 'Nur Rechnungen im Entwurfsstatus können versendet werden.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        invoice.status = 'sent'
        invoice.save()
        
        return Response({
            'status': 'success',
            'message': f'Rechnung {invoice.invoice_number} wurde als versendet markiert.'
        })

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Markiert die Rechnung als vollständig bezahlt"""
        invoice = self.get_object()
        
        invoice.status = 'paid'
        invoice.save()
        
        # Prüfe ob alle Rechnungen des Auftrags bezahlt sind
        order = invoice.order
        unpaid = order.invoices.exclude(status='paid').count()
        if unpaid == 0:
            order.status = 'bezahlt'
            order.save()
        
        return Response({
            'status': 'success',
            'message': f'Rechnung {invoice.invoice_number} wurde als bezahlt markiert.'
        })

    @action(detail=True, methods=['post'])
    def add_payment(self, request, pk=None):
        """Fügt eine Zahlung zur Rechnung hinzu"""
        invoice = self.get_object()
        
        serializer = PaymentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        payment = serializer.save(invoice=invoice, created_by=request.user)
        
        # Prüfe ob Rechnung vollständig bezahlt
        if invoice.is_fully_paid():
            invoice.status = 'paid'
            invoice.save()
        
        return Response({
            'status': 'success',
            'message': 'Zahlung wurde erfasst.',
            'payment': PaymentSerializer(payment).data,
            'open_amount': float(invoice.get_open_amount())
        })


class PaymentViewSet(viewsets.ModelViewSet):
    """ViewSet für Zahlungen"""
    queryset = Payment.objects.select_related('invoice', 'invoice__order', 'created_by')
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['invoice', 'payment_method']
    ordering_fields = ['payment_date', 'created_at']
    ordering = ['-payment_date']

    def get_serializer_class(self):
        if self.action == 'create':
            return PaymentCreateSerializer
        return PaymentSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CustomerOrderCommissionRecipientViewSet(viewsets.ModelViewSet):
    """ViewSet für Provisionsempfänger von Kundenaufträgen"""
    queryset = CustomerOrderCommissionRecipient.objects.select_related(
        'customer_order', 'employee'
    )
    serializer_class = CustomerOrderCommissionRecipientSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['customer_order', 'employee']
    ordering_fields = ['created_at', 'commission_percentage']
    ordering = ['-created_at']


class EmployeeCommissionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet für Mitarbeiterprovisionen (nur lesen)"""
    queryset = EmployeeCommission.objects.select_related(
        'employee', 'customer_order', 'customer_order__customer'
    )
    serializer_class = EmployeeCommissionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'fiscal_year', 'customer_order']
    ordering_fields = ['fiscal_year', 'calculated_at', 'commission_amount']
    ordering = ['-fiscal_year', '-calculated_at']

    @action(detail=False, methods=['get'])
    def by_employee_and_year(self, request):
        """Aggregierte Provisionen pro Mitarbeiter und Geschäftsjahr"""
        employee_id = request.query_params.get('employee')
        fiscal_year = request.query_params.get('year')
        
        if not employee_id or not fiscal_year:
            return Response(
                {'error': 'employee und year Parameter erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        commissions = self.queryset.filter(
            employee_id=employee_id,
            fiscal_year=fiscal_year
        )
        
        total_commission = commissions.aggregate(
            total=models.Sum('commission_amount')
        )['total'] or 0
        
        return Response({
            'employee_id': employee_id,
            'fiscal_year': fiscal_year,
            'total_commission': float(total_commission),
            'commission_count': commissions.count(),
            'commissions': self.get_serializer(commissions, many=True).data
        })
