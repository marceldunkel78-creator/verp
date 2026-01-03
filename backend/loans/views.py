from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.core.files.base import ContentFile
from django.db.models import Q
import os

from .models import (
    Loan, LoanItem, LoanReceipt, LoanItemReceipt,
    LoanItemPhoto, LoanReturn, LoanReturnItem
)
from .serializers import (
    LoanListSerializer, LoanDetailSerializer, LoanCreateUpdateSerializer,
    LoanItemSerializer, LoanItemReceiptSerializer, LoanItemPhotoSerializer,
    LoanReceiptSerializer, LoanReturnSerializer, LoanReturnCreateSerializer,
    LoanReturnItemSerializer
)
from .pdf_generator import generate_return_note_pdf
from users.models import Notification, Reminder


def create_loan_notifications(loan, is_new=False):
    """Erstellt Benachrichtigungen für zuständigen Mitarbeiter und Beobachter"""
    action_text = "erstellt" if is_new else "aktualisiert"
    # use existing notification type values defined in users.models.Notification.NOTIFICATION_TYPES
    notification_type = 'loan'
    
    # Sammle alle zu benachrichtigenden User
    users_to_notify = set()
    
    # Zuständiger Mitarbeiter
    if loan.responsible_employee:
        # User ist über das reverse-relationship `users` auf `Employee` erreichbar
        rep_user = loan.responsible_employee.users.filter(is_active=True).first()
        if rep_user:
            users_to_notify.add(rep_user)
    
    # Beobachter
    for observer in loan.observers.all():
        # Jeder Beobachter kann 0..n User haben; benachrichtige alle aktiven
        for u in observer.users.filter(is_active=True):
            users_to_notify.add(u)
    
    # Erstelle Benachrichtigungen
    for user in users_to_notify:
            Notification.objects.create(
            user=user,
            title=f"Leihung {loan.loan_number} {action_text}",
            message=f"Leihung {loan.loan_number} von {loan.supplier.company_name if loan.supplier else 'Unbekannt'} wurde {action_text}.",
            notification_type=notification_type,
            related_url=f"/procurement/loans/{loan.id}"
        )


def create_loan_reminder(loan):
    """Erstellt eine Erinnerung für das Rückgabedatum"""
    if not loan.return_deadline or not loan.responsible_employee:
        return
    # finde den zugehörigen User über Employee.users
    responsible_user = loan.responsible_employee.users.filter(is_active=True).first()
    if not responsible_user:
        return
    
    # Lösche bestehende Erinnerungen für diese Leihung
    Reminder.objects.filter(
        related_object_type='loan',
        related_object_id=loan.id
    ).delete()
    
    # Erstelle neue Erinnerung
    Reminder.objects.create(
        user=responsible_user,
        title=f"Leihung {loan.loan_number} zurückgeben",
        description=f"Die Leihung {loan.loan_number} von {loan.supplier.company_name if loan.supplier else 'Unbekannt'} muss bis {loan.return_deadline.strftime('%d.%m.%Y')} zurückgegeben werden.",
        due_date=loan.return_deadline,
        related_object_type='loan',
        related_object_id=loan.id,
        related_url=f"/procurement/loans/{loan.id}"
    )


class LoanViewSet(viewsets.ModelViewSet):
    """ViewSet für Leihungen"""
    permission_classes = [IsAuthenticated]
    queryset = Loan.objects.all().order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return LoanListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return LoanCreateUpdateSerializer
        return LoanDetailSerializer
    
    def create(self, request, *args, **kwargs):
        """Override create to return LoanDetailSerializer response"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Return response with LoanDetailSerializer for full data including receipts
        detail_serializer = LoanDetailSerializer(serializer.instance, context={'request': request})
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def update(self, request, *args, **kwargs):
        """Override update to return LoanDetailSerializer response"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        
        # Return response with LoanDetailSerializer for full data including receipts
        detail_serializer = LoanDetailSerializer(serializer.instance, context={'request': request})
        return Response(detail_serializer.data)
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by supplier
        supplier_id = self.request.query_params.get('supplier', None)
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        
        # Search
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(loan_number__icontains=search) |
                Q(supplier__company_name__icontains=search) |
                Q(supplier_reference__icontains=search) |
                Q(items__product_name__icontains=search)
            ).distinct()
        
        return queryset
    
    def perform_create(self, serializer):
        loan = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        # Benachrichtigungen und Erinnerungen erstellen
        create_loan_notifications(loan, is_new=True)
        create_loan_reminder(loan)
    
    def perform_update(self, serializer):
        loan = serializer.save(updated_by=self.request.user)
        # Benachrichtigungen und Erinnerungen aktualisieren
        create_loan_notifications(loan, is_new=False)
        create_loan_reminder(loan)
    
    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        """Gibt alle Positionen einer Leihung zurück"""
        loan = self.get_object()
        items = loan.items.all()
        serializer = LoanItemSerializer(items, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Fügt eine Position hinzu"""
        loan = self.get_object()
        
        # Get next position
        max_pos = loan.items.aggregate(max_pos=models.Max('position'))['max_pos'] or 0
        request.data['position'] = max_pos + 1
        request.data['loan'] = loan.id
        
        serializer = LoanItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def create_receipt(self, request, pk=None):
        """Erstellt den Wareneingang"""
        loan = self.get_object()
        
        if hasattr(loan, 'receipt'):
            return Response(
                {'error': 'Wareneingang existiert bereits'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        receipt = LoanReceipt.objects.create(
            loan=loan,
            receipt_date=request.data.get('receipt_date'),
            received_by=request.user,
            notes=request.data.get('notes', '')
        )
        
        # Update status to "entliehen"
        loan.status = 'entliehen'
        loan.save()
        
        serializer = LoanReceiptSerializer(receipt)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def update_item_receipt(self, request, pk=None):
        """Aktualisiert die Wareneingangs-Checklist für eine Position"""
        loan = self.get_object()
        item_id = request.data.get('item_id')
        
        item = get_object_or_404(LoanItem, id=item_id, loan=loan)
        
        receipt, created = LoanItemReceipt.objects.update_or_create(
            loan_item=item,
            defaults={
                'is_complete': request.data.get('is_complete', False),
                'is_intact': request.data.get('is_intact', False),
                'notes': request.data.get('notes', '')
            }
        )
        
        serializer = LoanItemReceiptSerializer(receipt)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def upload_receipt_document(self, request, pk=None):
        """Lädt ein Dokument (Lieferschein/Leihvereinbarung) zum Wareneingang hoch"""
        loan = self.get_object()
        
        if not hasattr(loan, 'receipt'):
            return Response(
                {'error': 'Wareneingang existiert noch nicht'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        receipt = loan.receipt
        document_type = request.data.get('document_type')  # 'delivery_note' or 'loan_agreement'
        file = request.FILES.get('file')
        
        if not file:
            return Response(
                {'error': 'Keine Datei hochgeladen'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if document_type == 'delivery_note':
            receipt.delivery_note = file
        elif document_type == 'loan_agreement':
            receipt.loan_agreement = file
        else:
            return Response(
                {'error': 'Ungültiger Dokumenttyp'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        receipt.save()
        serializer = LoanReceiptSerializer(receipt)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def upload_photo(self, request, pk=None):
        """Lädt ein Foto zu einer Position hoch"""
        loan = self.get_object()
        item_id = request.data.get('item_id')
        
        item = get_object_or_404(LoanItem, id=item_id, loan=loan)
        
        photo = LoanItemPhoto.objects.create(
            loan_item=item,
            photo=request.FILES.get('photo'),
            description=request.data.get('description', ''),
            uploaded_by=request.user
        )
        
        serializer = LoanItemPhotoSerializer(photo)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def create_return(self, request, pk=None):
        """Erstellt eine Rücksendung und generiert den Rücklieferschein"""
        loan = self.get_object()
        
        # Validate items
        items_data = request.data.get('items', [])
        if not items_data:
            return Response(
                {'error': 'Keine Positionen zur Rücksendung ausgewählt'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse and validate return_date (accepts date string or date)
        from django.utils.dateparse import parse_date

        raw_date = request.data.get('return_date')
        if isinstance(raw_date, str):
            parsed_date = parse_date(raw_date)
            if parsed_date is None:
                return Response({'error': 'Ungültiges Datum für return_date'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            parsed_date = raw_date

        # Create return
        loan_return = LoanReturn.objects.create(
            loan=loan,
            return_date=parsed_date,
            shipping_carrier=request.data.get('shipping_carrier', ''),
            tracking_number=request.data.get('tracking_number', ''),
            notes=request.data.get('notes', ''),
            created_by=request.user
        )
        
        # Create return items
        for item_data in items_data:
            LoanReturnItem.objects.create(
                loan_return=loan_return,
                loan_item_id=item_data.get('loan_item_id'),
                quantity_returned=item_data.get('quantity_returned', 0),
                condition_notes=item_data.get('condition_notes', '')
            )
        
        # Generate PDF
        pdf_content = generate_return_note_pdf(loan_return)
        filename = f"Ruecklieferschein_{loan_return.return_number}.pdf"
        loan_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
        
        # Check if all items are returned, then update status
        total_items = loan.items.count()
        returned_items = LoanReturnItem.objects.filter(
            loan_return__loan=loan
        ).values('loan_item').distinct().count()
        
        if returned_items >= total_items:
            loan.status = 'abgeschlossen'
            loan.save()
        
        serializer = LoanReturnSerializer(loan_return)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'], url_path='returns')
    def get_returns(self, request, pk=None):
        """Gibt alle Rücksendungen einer Leihung zurück"""
        loan = self.get_object()
        returns = loan.returns.all()
        serializer = LoanReturnSerializer(returns, many=True)
        return Response(serializer.data)


class LoanItemViewSet(viewsets.ModelViewSet):
    """ViewSet für Leihpositionen"""
    permission_classes = [IsAuthenticated]
    queryset = LoanItem.objects.all()
    serializer_class = LoanItemSerializer


class LoanReturnViewSet(viewsets.ModelViewSet):
    """ViewSet für Rücksendungen"""
    permission_classes = [IsAuthenticated]
    queryset = LoanReturn.objects.all().order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return LoanReturnCreateSerializer
        return LoanReturnSerializer
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Download des Rücklieferscheins"""
        loan_return = self.get_object()
        
        if not loan_return.pdf_file:
            # Regenerate if missing
            pdf_content = generate_return_note_pdf(loan_return)
            filename = f"Ruecklieferschein_{loan_return.return_number}.pdf"
            loan_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
        
        response = HttpResponse(loan_return.pdf_file.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Ruecklieferschein_{loan_return.return_number}.pdf"'
        return response
    
    @action(detail=True, methods=['post'])
    def regenerate_pdf(self, request, pk=None):
        """Regeneriert den PDF-Rücklieferschein"""
        loan_return = self.get_object()
        
        # Delete old file if exists
        if loan_return.pdf_file:
            loan_return.pdf_file.delete(save=False)
        
        # Generate new PDF
        pdf_content = generate_return_note_pdf(loan_return)
        filename = f"Ruecklieferschein_{loan_return.return_number}.pdf"
        loan_return.pdf_file.save(filename, ContentFile(pdf_content), save=True)
        
        serializer = LoanReturnSerializer(loan_return)
        return Response(serializer.data)


class LoanItemPhotoViewSet(viewsets.ModelViewSet):
    """ViewSet für Leihpositions-Fotos"""
    permission_classes = [IsAuthenticated]
    queryset = LoanItemPhoto.objects.all()
    serializer_class = LoanItemPhotoSerializer
    
    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
