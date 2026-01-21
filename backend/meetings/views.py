from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta

from .models import MondayMeetingTodo, SalesMeetingTodo, VisiViewMeetingTodo
from .serializers import (
    MondayMeetingTodoSerializer, SalesMeetingTodoSerializer, 
    VisiViewMeetingTodoSerializer
)
from customer_orders.models import CustomerOrder
from orders.models import Order
from visiview.models import VisiViewTicket


class MondayMeetingTodoViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Montagsmeeting Todos.
    - GET /api/meetings/monday-todos/ - Liste aller Todos
    - POST /api/meetings/monday-todos/ - Neues Todo erstellen
    - GET /api/meetings/monday-todos/{id}/ - Todo Details
    - PUT/PATCH /api/meetings/monday-todos/{id}/ - Todo bearbeiten
    - DELETE /api/meetings/monday-todos/{id}/ - Todo löschen
    - POST /api/meetings/monday-todos/save-meeting/ - Meeting speichern (erledigte löschen)
    """
    queryset = MondayMeetingTodo.objects.all()
    serializer_class = MondayMeetingTodoSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def save_meeting(self, request):
        """
        Speichert das Meeting und löscht alle erledigten Todos.
        """
        # Lösche alle erledigten Todos
        deleted_count = MondayMeetingTodo.objects.filter(is_completed=True).delete()[0]
        
        # Verbleibende Todos zurückgeben
        todos = MondayMeetingTodo.objects.all()
        serializer = self.get_serializer(todos, many=True)
        
        return Response({
            'message': f'{deleted_count} erledigte Todos gelöscht',
            'deleted_count': deleted_count,
            'todos': serializer.data
        })


class SalesMeetingTodoViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Vertriebsmeeting Todos.
    Todos werden nicht automatisch gelöscht, sondern nur durchgestrichen.
    """
    queryset = SalesMeetingTodo.objects.all()
    serializer_class = SalesMeetingTodoSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Optional: Filter nach completed status
        show_completed = self.request.query_params.get('show_completed', 'true')
        if show_completed.lower() == 'false':
            queryset = queryset.filter(is_completed=False)
        
        return queryset


class VisiViewMeetingTodoViewSet(viewsets.ModelViewSet):
    """
    ViewSet für VisiView-Meeting Todos.
    """
    queryset = VisiViewMeetingTodo.objects.all()
    serializer_class = VisiViewMeetingTodoSerializer
    permission_classes = [IsAuthenticated]


class MondayMeetingDataViewSet(viewsets.ViewSet):
    """
    ViewSet für Montagsmeeting-Daten:
    - Neue Kundenaufträge (Bestätigung in der Vorwoche)
    - Kundenaufträge mit voraussichtlichem Lieferdatum
    - Eingehende Bestellungen (Lieferdatum diese Woche)
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def new_customer_orders(self, request):
        """
        Neue Kundenaufträge (Bestätigungsdatum in der Vorwoche).
        """
        today = timezone.now().date()
        
        # Berechne Start und Ende der Vorwoche (Montag bis Sonntag)
        # Aktueller Wochentag (0=Montag, 6=Sonntag)
        days_since_monday = today.weekday()
        this_monday = today - timedelta(days=days_since_monday)
        last_monday = this_monday - timedelta(days=7)
        last_sunday = this_monday - timedelta(days=1)
        
        orders = CustomerOrder.objects.filter(
            confirmation_date__gte=last_monday,
            confirmation_date__lte=last_sunday
        ).select_related('customer').order_by('-confirmation_date')
        
        data = []
        for order in orders:
            data.append({
                'id': order.id,
                'order_number': order.order_number,
                'customer_name': order.customer.name if order.customer else 'N/A',
                'customer_id': order.customer_id,
                'status': order.status,
                'status_display': order.get_status_display(),
                'confirmation_date': order.confirmation_date,
                'order_date': order.order_date,
                'delivery_date': order.delivery_date,
                'project_reference': order.project_reference,
            })
        
        return Response({
            'period': {
                'start': last_monday,
                'end': last_sunday
            },
            'count': len(data),
            'orders': data
        })
    
    @action(detail=False, methods=['get'])
    def upcoming_deliveries(self, request):
        """
        Kundenaufträge mit voraussichtlichem Lieferdatum.
        Zeigt alle Aufträge mit gesetztem delivery_date, sortiert nach Datum.
        """
        today = timezone.now().date()
        
        # Aufträge mit Lieferdatum, die noch nicht geliefert sind
        orders = CustomerOrder.objects.filter(
            delivery_date__isnull=False,
            status__in=['bestaetigt', 'in_produktion']
        ).select_related('customer').order_by('delivery_date')
        
        data = []
        for order in orders:
            days_until = (order.delivery_date - today).days if order.delivery_date else None
            data.append({
                'id': order.id,
                'order_number': order.order_number,
                'customer_name': order.customer.name if order.customer else 'N/A',
                'customer_id': order.customer_id,
                'status': order.status,
                'status_display': order.get_status_display(),
                'delivery_date': order.delivery_date,
                'days_until_delivery': days_until,
                'project_reference': order.project_reference,
                'delivery_time_weeks': order.delivery_time_weeks,
            })
        
        return Response({
            'count': len(data),
            'orders': data
        })
    
    @action(detail=False, methods=['get'])
    def incoming_orders(self, request):
        """
        Bestellte Waren, die diese Woche eintreffen sollen.
        Basiert auf dem Lieferdatum aus orders.Order.
        """
        today = timezone.now().date()
        
        # Berechne Start und Ende der aktuellen Woche (Montag bis Sonntag)
        days_since_monday = today.weekday()
        this_monday = today - timedelta(days=days_since_monday)
        this_sunday = this_monday + timedelta(days=6)
        
        orders = Order.objects.filter(
            delivery_date__gte=this_monday,
            delivery_date__lte=this_sunday,
            status__in=['angelegt', 'bestellt', 'bestaetigt']
        ).select_related('supplier').order_by('delivery_date')
        
        data = []
        for order in orders:
            data.append({
                'id': order.id,
                'order_number': order.order_number,
                'supplier_name': order.supplier.name if order.supplier else 'N/A',
                'supplier_id': order.supplier_id,
                'status': order.status,
                'status_display': order.get_status_display(),
                'order_date': order.order_date,
                'delivery_date': order.delivery_date,
                'order_type': order.order_type,
            })
        
        return Response({
            'period': {
                'start': this_monday,
                'end': this_sunday
            },
            'count': len(data),
            'orders': data
        })


class VisiViewMeetingDataViewSet(viewsets.ViewSet):
    """
    ViewSet für VisiView-Meeting-Daten:
    - Tickets mit Worklist-Flag
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def worklist_tickets(self, request):
        """
        VisiView Tickets bei denen add_to_worklist=True ist.
        """
        tickets = VisiViewTicket.objects.filter(
            add_to_worklist=True
        ).exclude(
            status__in=['closed', 'rejected']
        ).order_by('-priority', '-updated_at')
        
        data = []
        for ticket in tickets:
            data.append({
                'id': ticket.id,
                'ticket_number': ticket.ticket_number,
                'title': ticket.title,
                'tracker': ticket.tracker,
                'tracker_display': ticket.get_tracker_display(),
                'status': ticket.status,
                'status_display': ticket.get_status_display(),
                'priority': ticket.priority,
                'priority_display': ticket.get_priority_display(),
                'category': ticket.category,
                'category_display': ticket.get_category_display() if ticket.category else None,
                'assigned_to_name': ticket.assigned_to_name or (
                    f"{ticket.assigned_to.first_name} {ticket.assigned_to.last_name}".strip() 
                    if ticket.assigned_to else None
                ),
                'target_version': ticket.target_version,
                'percent_done': ticket.percent_done,
                'updated_at': ticket.updated_at,
            })
        
        return Response({
            'count': len(data),
            'tickets': data
        })
