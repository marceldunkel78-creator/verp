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
    max_page_size = 10000


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
            'customer_name': str(order.customer) if order.customer else None,
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
    
    # =========================================================================
    # PROCUREMENT ACTIONS (Beschaffung)
    # =========================================================================
    
    @action(detail=True, methods=['post'], url_path='create-visiview-production-order')
    def create_visiview_production_order(self, request, pk=None):
        """
        Erstellt einen VisiView Fertigungsauftrag für ausgewählte Positionen
        
        POST /api/customer-orders/{id}/create-visiview-production-order/
        Body: { "item_ids": [1, 2, 3], "processing_type": "NEW_LICENSE", "notes": "" }
        """
        from visiview.models import VisiViewProductionOrder
        from visiview.production_orders import VisiViewProductionOrderItem
        
        order = self.get_object()
        item_ids = request.data.get('item_ids', [])
        processing_type = request.data.get('processing_type', 'NEW_LICENSE')
        notes = request.data.get('notes', '')
        
        if not item_ids:
            return Response(
                {'error': 'Keine Positionen ausgewählt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        items = order.items.filter(id__in=item_ids)
        
        # Validate all items are VisiView products
        for item in items:
            if not item.article_number.upper().startswith('VV-'):
                return Response(
                    {'error': f'Position {item.position} ({item.article_number}) ist kein VisiView-Produkt'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create VisiView production order
        production_order = VisiViewProductionOrder.objects.create(
            customer_order=order,
            customer=order.customer,
            status='DRAFT',
            processing_type=processing_type,
            notes=notes,
            created_by=request.user
        )
        
        # Add items to production order
        for item in items:
            VisiViewProductionOrderItem.objects.create(
                production_order=production_order,
                customer_order_item=item,
                notes=f"Artikelnr: {item.article_number}, Menge: {item.quantity}, Produkt: {item.name}"
            )
            
            # Update item procurement status
            item.visiview_production_order = production_order
            item.procurement_status = 'in_production'
            item.save()
        
        return Response({
            'status': 'success',
            'message': f'VisiView Fertigungsauftrag {production_order.order_number} wurde erstellt.',
            'production_order_id': production_order.id,
            'production_order_number': production_order.order_number
        })
    
    @action(detail=True, methods=['post'], url_path='create-supplier-order')
    def create_supplier_order(self, request, pk=None):
        """
        Erstellt eine Lieferantenbestellung für ausgewählte Positionen
        
        POST /api/customer-orders/{id}/create-supplier-order/
        Body: { "item_ids": [1, 2, 3], "supplier_id": 123, "notes": "" }
        """
        from orders.models import Order, OrderItem
        from suppliers.models import Supplier
        
        order = self.get_object()
        item_ids = request.data.get('item_ids', [])
        supplier_id = request.data.get('supplier_id')
        notes = request.data.get('notes', '')
        
        if not item_ids:
            return Response(
                {'error': 'Keine Positionen ausgewählt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not supplier_id:
            return Response(
                {'error': 'Kein Lieferant ausgewählt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            supplier = Supplier.objects.get(id=supplier_id)
        except Supplier.DoesNotExist:
            return Response(
                {'error': 'Lieferant nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        items = order.items.filter(id__in=item_ids)
        
        # Create supplier order
        supplier_order = Order.objects.create(
            supplier=supplier,
            order_type='customer_order',
            status='angelegt',
            order_date=timezone.now().date(),
            notes=f"Aus Kundenauftrag {order.order_number or order.id}\n{notes}".strip(),
            created_by=request.user
        )
        
        # Add items to supplier order
        for idx, item in enumerate(items, start=1):
            OrderItem.objects.create(
                order=supplier_order,
                position=idx,
                article_number=item.article_number,
                name=item.name,
                description=item.description,
                quantity=item.quantity,
                unit=item.unit,
                list_price=item.purchase_price,
                final_price=item.purchase_price,
                customer_order_number=order.order_number or str(order.id)
            )
            
            # Update item procurement status
            item.supplier_order = supplier_order
            item.supplier = supplier
            item.procurement_status = 'ordered'
            item.save()
        
        return Response({
            'status': 'success',
            'message': f'Lieferantenbestellung {supplier_order.order_number} wurde erstellt.',
            'supplier_order_id': supplier_order.id,
            'supplier_order_number': supplier_order.order_number
        })
    
    @action(detail=True, methods=['post'], url_path='create-hardware-production-order')
    def create_hardware_production_order(self, request, pk=None):
        """
        Erstellt einen VS-Hardware Fertigungsauftrag für eine Position
        
        POST /api/customer-orders/{id}/create-hardware-production-order/
        Body: { "item_id": 123, "vs_hardware_id": 456, "quantity": 1, "notes": "" }
        """
        from manufacturing.models import ProductionOrder, VSHardware
        
        order = self.get_object()
        item_id = request.data.get('item_id')
        vs_hardware_id = request.data.get('vs_hardware_id')
        quantity = request.data.get('quantity', 1)
        notes = request.data.get('notes', '')
        
        if not item_id:
            return Response(
                {'error': 'Keine Position ausgewählt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not vs_hardware_id:
            return Response(
                {'error': 'Kein VS-Hardware Produkt ausgewählt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            item = order.items.get(id=item_id)
        except CustomerOrderItem.DoesNotExist:
            return Response(
                {'error': 'Position nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            vs_hardware = VSHardware.objects.get(id=vs_hardware_id)
        except VSHardware.DoesNotExist:
            return Response(
                {'error': 'VS-Hardware Produkt nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create hardware production order
        production_order = ProductionOrder.objects.create(
            vs_hardware=vs_hardware,
            customer_order=order,
            quantity=quantity,
            status='created',
            notes=f"Aus Kundenauftrag {order.order_number or order.id}\nPosition: {item.name}\n{notes}".strip(),
            created_by=request.user
        )
        
        # Try to get project from order references
        if order.project_reference:
            from projects.models import Project
            try:
                project = Project.objects.filter(name__icontains=order.project_reference).first()
                if project:
                    production_order.project = project
                    production_order.save()
            except Exception:
                pass
        
        # Update item procurement status
        item.hardware_production_order = production_order
        item.procurement_status = 'in_production'
        item.save()
        
        return Response({
            'status': 'success',
            'message': f'Fertigungsauftrag {production_order.order_number} wurde erstellt.',
            'production_order_id': production_order.id,
            'production_order_number': production_order.order_number
        })
    
    @action(detail=True, methods=['get'], url_path='procurement-data')
    def procurement_data(self, request, pk=None):
        """
        Liefert Beschaffungsdaten für alle Positionen des Auftrags
        
        GET /api/customer-orders/{id}/procurement-data/
        """
        from suppliers.models import Supplier, TradingProduct
        from manufacturing.models import VSHardware
        
        order = self.get_object()
        items_data = []
        
        for item in order.items.all():
            item_data = {
                'id': item.id,
                'position': item.position,
                'position_display': item.position_display,
                'article_number': item.article_number,
                'name': item.name,
                'quantity': float(item.quantity),
                'unit': item.unit,
                'is_group_header': item.is_group_header,
                'procurement_status': item.procurement_status,
                'supplier': None,
                'supplier_name': None,
                'product_type': None,
                'supplier_order': None,
                'supplier_order_number': None,
                'visiview_production_order': None,
                'visiview_production_order_number': None,
                'hardware_production_order': None,
                'hardware_production_order_number': None,
            }
            
            # Determine product type and supplier
            article_upper = (item.article_number or '').upper()
            if article_upper.startswith('VV-'):
                item_data['product_type'] = 'VISIVIEW'
            elif article_upper.startswith('VSH-'):
                item_data['product_type'] = 'VS_HARDWARE'
                # Try to find VS-Hardware product
                try:
                    vs_hw = VSHardware.objects.filter(article_number__iexact=item.article_number).first()
                    if vs_hw:
                        item_data['vs_hardware_id'] = vs_hw.id
                except Exception:
                    pass
            elif article_upper.startswith('VSS-'):
                item_data['product_type'] = 'VS_SERVICE'
            else:
                # Trading product - try to find supplier
                item_data['product_type'] = 'TRADING'
                try:
                    trading = TradingProduct.objects.filter(
                        article_number__iexact=item.article_number
                    ).select_related('supplier').first()
                    if trading and trading.supplier:
                        item_data['supplier'] = trading.supplier.id
                        item_data['supplier_name'] = trading.supplier.company_name
                except Exception:
                    pass
            
            # Fill in existing order references
            if item.supplier:
                item_data['supplier'] = item.supplier.id
                item_data['supplier_name'] = item.supplier.company_name
            if item.supplier_order:
                item_data['supplier_order'] = item.supplier_order.id
                item_data['supplier_order_number'] = item.supplier_order.order_number
            if item.visiview_production_order:
                item_data['visiview_production_order'] = item.visiview_production_order.id
                item_data['visiview_production_order_number'] = item.visiview_production_order.order_number
            if item.hardware_production_order:
                item_data['hardware_production_order'] = item.hardware_production_order.id
                item_data['hardware_production_order_number'] = item.hardware_production_order.order_number
            
            items_data.append(item_data)
        
        return Response({
            'order_id': order.id,
            'order_number': order.order_number,
            'customer_id': order.customer.id if order.customer else None,
            'customer_name': str(order.customer) if order.customer else None,
            'project_reference': order.project_reference,
            'system_reference': order.system_reference,
            'items': items_data
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
