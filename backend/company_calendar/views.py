from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from collections import defaultdict

from .models import CalendarEvent, EventReminder
from .serializers import (
    CalendarEventSerializer, CalendarEventCreateSerializer,
    CalendarEventListSerializer, EventReminderSerializer,
    EventTypeChoicesSerializer, CalendarStatisticsSerializer
)


class CalendarEventViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Kalendertermine.
    Unterstützt Filterung nach Datum, Typ und Benutzer.
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = CalendarEvent.objects.filter(is_active=True)
        
        # Filter nach Datumsbereich
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(start_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(start_date__lte=end_date)
        
        # Filter nach Termintyp (mehrere möglich, kommasepariert)
        event_types = self.request.query_params.get('event_type')
        if event_types:
            types_list = event_types.split(',')
            queryset = queryset.filter(event_type__in=types_list)
        
        # Filter nach Benutzer (erstellt von oder zugewiesen an)
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(
                Q(created_by_id=user_id) | Q(assigned_to_id=user_id)
            )
        
        # Filter nach nur manuell erstellten Terminen
        manual_only = self.request.query_params.get('manual_only')
        if manual_only and manual_only.lower() == 'true':
            queryset = queryset.filter(is_system_generated=False)
        
        return queryset.select_related('created_by', 'assigned_to')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CalendarEventListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return CalendarEventCreateSerializer
        return CalendarEventSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    def update(self, request, *args, **kwargs):
        """Aktualisiert ein Event oder eine gesamte Serie."""
        instance = self.get_object()
        update_series = request.query_params.get('update_series', 'false').lower() == 'true'
        
        if update_series and (instance.recurrence_type != 'none' or instance.parent_event):
            # Aktualisiere alle Termine der Serie
            if instance.parent_event:
                # Dies ist eine Instanz - aktualisiere das Parent und alle Instanzen
                parent = instance.parent_event
                serializer = self.get_serializer(parent, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                
                # Aktualisiere alle Instanzen
                for recurring_instance in parent.recurring_instances.all():
                    # Aktualisiere nur bestimmte Felder, nicht Datum/Zeit
                    recurring_instance.title = request.data.get('title', recurring_instance.title)
                    recurring_instance.description = request.data.get('description', recurring_instance.description)
                    recurring_instance.event_type = request.data.get('event_type', recurring_instance.event_type)
                    recurring_instance.assigned_to_id = request.data.get('assigned_to', recurring_instance.assigned_to_id)
                    recurring_instance.is_all_day = request.data.get('is_all_day', recurring_instance.is_all_day)
                    recurring_instance.save()
            else:
                # Dies ist das Parent - aktualisiere alle Instanzen
                serializer = self.get_serializer(instance, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                
                for recurring_instance in instance.recurring_instances.all():
                    recurring_instance.title = request.data.get('title', recurring_instance.title)
                    recurring_instance.description = request.data.get('description', recurring_instance.description)
                    recurring_instance.event_type = request.data.get('event_type', recurring_instance.event_type)
                    recurring_instance.assigned_to_id = request.data.get('assigned_to', recurring_instance.assigned_to_id)
                    recurring_instance.is_all_day = request.data.get('is_all_day', recurring_instance.is_all_day)
                    recurring_instance.save()
            
            return Response(serializer.data)
        else:
            # Normale Aktualisierung eines einzelnen Termins
            return super().update(request, *args, **kwargs)
    
    @action(detail=False, methods=['get'])
    def event_types(self, request):
        """Gibt alle verfügbaren Termintypen mit Farben zurück."""
        manual_types = [
            'vs_meeting', 'doctor_visit', 'business_trip', 'birthday',
            'inhouse_demo', 'remote_demo', 'remote_session', 'event', 'other'
        ]
        
        types = []
        for value, label in CalendarEvent.EVENT_TYPE_CHOICES:
            types.append({
                'value': value,
                'label': label,
                'color': CalendarEvent.EVENT_TYPE_COLORS.get(value, '#6B7280'),
                'is_manual': value in manual_types
            })
        
        return Response(types)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Gibt Statistiken für gefilterte Termine zurück (inkl. System-Termine)."""
        # Datumsbereich
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        if not start_date_str or not end_date_str:
            today = timezone.now().date()
            start_date = today.replace(day=1)
            end_date = (start_date + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        else:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        
        # Manuelle Termine
        queryset = self.get_queryset()
        events_by_type = {}
        user_counts = {}
        
        # Manuelle Termine zählen
        by_type = queryset.values('event_type').annotate(count=Count('id'))
        for item in by_type:
            type_info = dict(CalendarEvent.EVENT_TYPE_CHOICES).get(item['event_type'], item['event_type'])
            events_by_type[item['event_type']] = {
                'count': item['count'],
                'label': type_info,
                'color': CalendarEvent.EVENT_TYPE_COLORS.get(item['event_type'], '#6B7280')
            }
        
        # Users von manuellen Terminen
        for event in queryset:
            user_id = event.created_by_id
            if user_id:
                if user_id not in user_counts:
                    user_counts[user_id] = {
                        'user_id': user_id,
                        'name': event.created_by.get_full_name() or event.created_by.username,
                        'count': 0
                    }
                user_counts[user_id]['count'] += 1
        
        # Urlaubstage aggregieren
        try:
            from users.models import VacationRequest
            vacations = VacationRequest.objects.filter(
                status='approved',
                start_date__lte=end_date,
                end_date__gte=start_date
            ).select_related('user')
            
            vacation_count = vacations.count()
            if vacation_count > 0:
                events_by_type['vacation'] = {
                    'count': vacation_count,
                    'label': 'Urlaub',
                    'color': CalendarEvent.EVENT_TYPE_COLORS.get('vacation', '#10B981')
                }
            
            for vac in vacations:
                user_id = vac.user_id
                if user_id not in user_counts:
                    user_counts[user_id] = {
                        'user_id': user_id,
                        'name': vac.user.get_full_name() or vac.user.username,
                        'count': 0
                    }
                user_counts[user_id]['count'] += 1
        except Exception:
            pass
        
        # Liefertermine von Bestellungen
        try:
            from orders.models import Order
            orders = Order.objects.filter(
                expected_delivery_date__gte=start_date,
                expected_delivery_date__lte=end_date
            ).exclude(status__in=['cancelled', 'delivered'])
            
            order_count = orders.count()
            if order_count > 0:
                events_by_type['order_delivery'] = {
                    'count': order_count,
                    'label': 'Liefertermin Bestellung',
                    'color': CalendarEvent.EVENT_TYPE_COLORS.get('order_delivery', '#F59E0B')
                }
        except Exception:
            pass
        
        # Liefertermine von Kundenaufträgen
        try:
            from customer_orders.models import CustomerOrder
            customer_orders = CustomerOrder.objects.filter(
                delivery_date__gte=start_date,
                delivery_date__lte=end_date
            ).exclude(status__in=['cancelled', 'delivered'])
            
            co_count = customer_orders.count()
            if co_count > 0:
                events_by_type['customer_order_delivery'] = {
                    'count': co_count,
                    'label': 'Liefertermin Kundenauftrag',
                    'color': CalendarEvent.EVENT_TYPE_COLORS.get('customer_order_delivery', '#8B5CF6')
                }
        except Exception:
            pass
        
        # Gesamtzahl berechnen
        total = sum(item['count'] for item in events_by_type.values())
        
        # Top 10 User
        events_by_user = sorted(user_counts.values(), key=lambda x: x['count'], reverse=True)[:10]
        
        return Response({
            'total_events': total,
            'events_by_type': events_by_type,
            'events_by_user': events_by_user,
            'date_range': {
                'min_date': start_date,
                'max_date': end_date
            }
        })
    
    @action(detail=False, methods=['get'])
    def aggregated(self, request):
        """
        Gibt alle Termine inkl. aggregierter Daten aus anderen Modulen zurück.
        Dies schließt Urlaubstage, Krankheitstage und Liefertermine ein.
        """
        # Basis-Queryset für manuelle Termine
        queryset = self.get_queryset()
        events = list(CalendarEventListSerializer(queryset, many=True).data)
        
        # Datumsbereich für Aggregation
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Standard: aktueller Monat
            today = timezone.now().date()
            start_date = today.replace(day=1)
            end_date = (start_date + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        else:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        
        # Typ-Filter
        event_types = request.query_params.get('event_type', '').split(',') if request.query_params.get('event_type') else None
        
        # Urlaubstage aggregieren (falls VacationRequest existiert)
        if not event_types or 'vacation' in event_types:
            try:
                from users.models import VacationRequest
                vacations = VacationRequest.objects.filter(
                    status='approved',
                    start_date__lte=end_date,
                    end_date__gte=start_date
                ).select_related('user')
                
                for vac in vacations:
                    events.append({
                        'id': f'vacation_{vac.id}',
                        'title': f'Urlaub: {vac.user.get_full_name() or vac.user.username}',
                        'event_type': 'vacation',
                        'event_type_display': 'Urlaub',
                        'color': CalendarEvent.EVENT_TYPE_COLORS['vacation'],
                        'start_date': vac.start_date.isoformat(),
                        'end_date': vac.end_date.isoformat(),
                        'start_time': None,
                        'end_time': None,
                        'is_all_day': True,
                        'created_by': vac.user.id,
                        'created_by_name': vac.user.get_full_name() or vac.user.username,
                        'assigned_to': vac.user.id,
                        'assigned_to_name': vac.user.get_full_name() or vac.user.username,
                        'is_system_generated': True
                    })
            except Exception:
                pass
        
        # Liefertermine von Bestellungen
        if not event_types or 'order_delivery' in event_types:
            try:
                from orders.models import Order
                orders = Order.objects.filter(
                    expected_delivery_date__gte=start_date,
                    expected_delivery_date__lte=end_date
                ).exclude(status__in=['cancelled', 'delivered']).select_related('supplier')
                
                for order in orders:
                    events.append({
                        'id': f'order_{order.id}',
                        'title': f'Lieferung: {order.order_number} ({order.supplier.company_name if order.supplier else "?"})',
                        'event_type': 'order_delivery',
                        'event_type_display': 'Liefertermin Bestellung',
                        'color': CalendarEvent.EVENT_TYPE_COLORS['order_delivery'],
                        'start_date': order.expected_delivery_date.isoformat(),
                        'end_date': order.expected_delivery_date.isoformat(),
                        'start_time': None,
                        'end_time': None,
                        'is_all_day': True,
                        'created_by': order.created_by.id if order.created_by else None,
                        'created_by_name': order.created_by.get_full_name() if order.created_by else None,
                        'assigned_to': None,
                        'assigned_to_name': None,
                        'is_system_generated': True
                    })
            except Exception:
                pass
        
        # Liefertermine von Kundenaufträgen
        if not event_types or 'customer_order_delivery' in event_types:
            try:
                from customer_orders.models import CustomerOrder
                customer_orders = CustomerOrder.objects.filter(
                    delivery_date__gte=start_date,
                    delivery_date__lte=end_date
                ).exclude(status__in=['cancelled', 'delivered']).select_related('customer')
                
                for co in customer_orders:
                    events.append({
                        'id': f'customer_order_{co.id}',
                        'title': f'Kundenlieferung: {co.order_number} ({co.customer.name if co.customer else "?"})',
                        'event_type': 'customer_order_delivery',
                        'event_type_display': 'Liefertermin Kundenauftrag',
                        'color': CalendarEvent.EVENT_TYPE_COLORS['customer_order_delivery'],
                        'start_date': co.delivery_date.isoformat(),
                        'end_date': co.delivery_date.isoformat(),
                        'start_time': None,
                        'end_time': None,
                        'is_all_day': True,
                        'created_by': co.created_by.id if co.created_by else None,
                        'created_by_name': co.created_by.get_full_name() if co.created_by else None,
                        'assigned_to': None,
                        'assigned_to_name': None,
                        'is_system_generated': True
                    })
            except Exception:
                pass
        
        # User-Filter anwenden
        user_id = request.query_params.get('user_id')
        if user_id:
            user_id = int(user_id)
            events = [e for e in events if e.get('created_by') == user_id or e.get('assigned_to') == user_id]
        
        return Response(events)

    def destroy(self, request, *args, **kwargs):
        """Löscht einen Termin oder eine Serie von Terminen."""
        instance = self.get_object()
        
        # Prüfe ob es sich um einen Serientermin handelt
        delete_series = request.query_params.get('delete_series', 'false').lower() == 'true'
        
        if delete_series and (instance.recurrence_type != 'none' or instance.parent_event):
            # Lösche die gesamte Serie
            if instance.parent_event:
                # Dies ist eine Instanz - lösche das Parent-Event und alle Instanzen
                parent = instance.parent_event
                parent.recurring_instances.all().delete()
                parent.delete()
            else:
                # Dies ist das Parent-Event - lösche alle Instanzen und das Parent
                instance.recurring_instances.all().delete()
                instance.delete()
        else:
            # Lösche nur diesen einzelnen Termin
            instance.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def recurrence_choices(self, request):
        """Gibt die verfügbaren Wiederholungsoptionen zurück."""
        from .serializers import RecurrenceChoicesSerializer
        
        choices = [
            {'value': 'none', 'label': 'Keine Wiederholung'},
            {'value': 'daily', 'label': 'Täglich'},
            {'value': 'weekly', 'label': 'Wöchentlich'},
            {'value': 'monthly', 'label': 'Monatlich'},
            {'value': 'yearly', 'label': 'Jährlich'},
        ]
        
        serializer = RecurrenceChoicesSerializer(choices, many=True)
        return Response(serializer.data)


class EventReminderViewSet(viewsets.ModelViewSet):
    """ViewSet für Terminerinnerungen."""
    serializer_class = EventReminderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return EventReminder.objects.filter(event__is_active=True)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Gibt ausstehende Erinnerungen für den aktuellen Benutzer zurück."""
        now = timezone.now()
        
        reminders = EventReminder.objects.filter(
            Q(recipient=request.user) | Q(notify_all=True),
            is_sent=False,
            event__is_active=True
        ).select_related('event', 'event__created_by')
        
        # Nur Erinnerungen, die jetzt fällig sind
        pending = []
        for reminder in reminders:
            event = reminder.event
            if event.start_time:
                event_datetime = timezone.make_aware(
                    datetime.combine(event.start_date, event.start_time)
                )
            else:
                event_datetime = timezone.make_aware(
                    datetime.combine(event.start_date, datetime.min.time())
                )
            
            reminder_time = event_datetime - timedelta(minutes=reminder.minutes_before)
            
            if reminder_time <= now:
                pending.append(reminder)
        
        serializer = EventReminderSerializer(pending, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_sent(self, request, pk=None):
        """Markiert eine Erinnerung als gesendet."""
        reminder = self.get_object()
        reminder.is_sent = True
        reminder.sent_at = timezone.now()
        reminder.save()
        return Response({'status': 'marked as sent'})
