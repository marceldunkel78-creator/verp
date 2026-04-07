from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.files.base import ContentFile
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.http import FileResponse

from .models import CustomerLoan, CustomerLoanItem
from .serializers import (
    CustomerLoanListSerializer,
    CustomerLoanDetailSerializer,
    CustomerLoanCreateUpdateSerializer,
    CustomerLoanItemSerializer,
)
from .pdf_generator import generate_loan_delivery_note_pdf


class CustomerLoanViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CustomerLoan.objects.all().order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerLoanListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return CustomerLoanCreateUpdateSerializer
        return CustomerLoanDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        customer_id = self.request.query_params.get('customer', None)
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(loan_number__icontains=search) |
                Q(customer__first_name__icontains=search) |
                Q(customer__last_name__icontains=search) |
                Q(items__product_name__icontains=search)
            ).distinct()

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Return detail serializer so frontend gets id, loan_number, etc.
        detail = CustomerLoanDetailSerializer(
            serializer.instance, context={'request': request}
        )
        return Response(detail.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        detail = CustomerLoanDetailSerializer(
            serializer.instance, context={'request': request}
        )
        return Response(detail.data)

    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        """Generate Leihlieferschein PDF"""
        customer_loan = self.get_object()
        language = request.data.get('language', 'de')
        if language not in ('de', 'en'):
            language = 'de'

        pdf_content = generate_loan_delivery_note_pdf(customer_loan, language=language)
        prefix = 'LoanDeliveryNote' if language == 'en' else 'Leihlieferschein'
        filename = f"{prefix}_{customer_loan.loan_number}.pdf"
        customer_loan.pdf_file.save(filename, ContentFile(pdf_content), save=True)

        # Update status to verliehen if still offen
        if customer_loan.status == 'offen':
            customer_loan.status = 'verliehen'
            customer_loan.save()

        serializer = CustomerLoanDetailSerializer(
            customer_loan, context={'request': request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Download the generated PDF"""
        customer_loan = self.get_object()

        if not customer_loan.pdf_file:
            return Response(
                {'error': 'Kein PDF vorhanden. Bitte zuerst generieren.'},
                status=status.HTTP_404_NOT_FOUND
            )

        return FileResponse(
            customer_loan.pdf_file.open('rb'),
            content_type='application/pdf',
            as_attachment=True,
            filename=f"Leihlieferschein_{customer_loan.loan_number}.pdf"
        )

    @action(detail=True, methods=['post'])
    def update_item_return(self, request, pk=None):
        """Update return status for a single item"""
        customer_loan = self.get_object()
        item_id = request.data.get('item_id')

        item = get_object_or_404(CustomerLoanItem, id=item_id, customer_loan=customer_loan)

        item.is_returned = request.data.get('is_returned', item.is_returned)
        item.is_returned_complete = request.data.get('is_returned_complete', item.is_returned_complete)
        item.is_returned_intact = request.data.get('is_returned_intact', item.is_returned_intact)
        item.is_purchased = request.data.get('is_purchased', item.is_purchased)
        item.return_date = request.data.get('return_date', item.return_date)
        item.return_notes = request.data.get('return_notes', item.return_notes)
        item.save()

        # Auto-update loan status
        self._update_loan_status(customer_loan)

        return Response(CustomerLoanItemSerializer(item).data)

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Add item to loan"""
        customer_loan = self.get_object()

        last_position = customer_loan.items.order_by('-position').first()
        next_position = (last_position.position + 1) if last_position else 1

        item = CustomerLoanItem.objects.create(
            customer_loan=customer_loan,
            position=next_position,
            product_name=request.data.get('product_name', ''),
            article_number=request.data.get('article_number', ''),
            quantity=request.data.get('quantity', 1),
            unit=request.data.get('unit', 'Stück'),
            serial_number=request.data.get('serial_number', ''),
            notes=request.data.get('notes', ''),
            inventory_item_id=request.data.get('inventory_item', None),
        )

        return Response(
            CustomerLoanItemSerializer(item).data,
            status=status.HTTP_201_CREATED
        )

    def _update_loan_status(self, customer_loan):
        """Auto-update loan status based on item return states"""
        items = customer_loan.items.all()
        total = items.count()
        if total == 0:
            return

        returned_or_purchased = items.filter(
            Q(is_returned=True) | Q(is_purchased=True)
        ).count()

        if returned_or_purchased >= total:
            customer_loan.status = 'abgeschlossen'
        elif returned_or_purchased > 0:
            customer_loan.status = 'teilrueckgabe'
        customer_loan.save()

    @action(detail=False, methods=['get'])
    def procurement_loans(self, request):
        """Search procurement loans (Leihungen) for importing items"""
        from loans.models import Loan, LoanItem
        search = request.query_params.get('search', '')
        if len(search) < 2:
            return Response([])

        loans = Loan.objects.filter(
            Q(loan_number__icontains=search) |
            Q(supplier__company_name__icontains=search)
        ).order_by('-created_at')[:20]

        result = []
        for loan in loans:
            items = []
            for item in loan.items.all():
                items.append({
                    'id': item.id,
                    'position': item.position,
                    'product_name': item.product_name,
                    'article_number': item.supplier_article_number,
                    'quantity': item.quantity,
                    'unit': item.unit,
                    'serial_number': item.serial_number,
                    'notes': item.notes,
                })
            result.append({
                'id': loan.id,
                'loan_number': loan.loan_number,
                'supplier_name': loan.supplier.company_name if loan.supplier else '',
                'status': loan.get_status_display(),
                'items': items,
            })
        return Response(result)


class CustomerLoanItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerLoanItemSerializer
    queryset = CustomerLoanItem.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        loan_id = self.request.query_params.get('customer_loan', None)
        if loan_id:
            queryset = queryset.filter(customer_loan_id=loan_id)
        return queryset
