from django.db import models
from django.conf import settings


class CalendarEvent(models.Model):
    """
    Firmenkalender-Termine.
    Enthält sowohl manuell erstellte Termine als auch aggregierte Daten
    aus anderen Modulen (Urlaub, Krankheit, Liefertermine).
    """
    
    # Termintypen für manuell erstellte Termine
    EVENT_TYPE_CHOICES = [
        ('vs_meeting', 'VS-Meeting'),
        ('doctor_visit', 'Arztbesuch'),
        ('business_trip', 'Dienstreiseplanung'),
        ('birthday', 'Geburtstag'),
        ('inhouse_demo', 'In-House Demo'),
        ('remote_demo', 'Remote Demo'),
        ('remote_session', 'Remote Session'),
        ('event', 'Veranstaltung'),
        ('other', 'Sonstige'),
        # Systemgenerierte Typen (read-only)
        ('vacation', 'Urlaub'),
        ('sick_leave', 'Krankheit'),
        ('order_delivery', 'Liefertermin Bestellung'),
        ('customer_order_delivery', 'Liefertermin Kundenauftrag'),
    ]
    
    # Farben für die verschiedenen Termintypen (Hex-Codes)
    EVENT_TYPE_COLORS = {
        'vs_meeting': '#3B82F6',        # blue-500
        'doctor_visit': '#EC4899',       # pink-500
        'business_trip': '#8B5CF6',      # violet-500
        'birthday': '#F59E0B',           # amber-500
        'inhouse_demo': '#10B981',       # emerald-500
        'remote_demo': '#06B6D4',        # cyan-500
        'remote_session': '#6366F1',     # indigo-500
        'event': '#F97316',              # orange-500
        'other': '#6B7280',              # gray-500
        'vacation': '#22C55E',           # green-500
        'sick_leave': '#EF4444',         # red-500
        'order_delivery': '#A855F7',     # purple-500
        'customer_order_delivery': '#14B8A6',  # teal-500
    }
    
    title = models.CharField(max_length=255, verbose_name='Titel')
    description = models.TextField(blank=True, null=True, verbose_name='Beschreibung')
    event_type = models.CharField(
        max_length=30,
        choices=EVENT_TYPE_CHOICES,
        default='other',
        verbose_name='Termintyp'
    )
    
    # Datum und Zeit
    start_date = models.DateField(verbose_name='Startdatum')
    end_date = models.DateField(blank=True, null=True, verbose_name='Enddatum')
    start_time = models.TimeField(blank=True, null=True, verbose_name='Startzeit')
    end_time = models.TimeField(blank=True, null=True, verbose_name='Endzeit')
    is_all_day = models.BooleanField(default=True, verbose_name='Ganztägig')
    
    # Wiederholung
    RECURRENCE_CHOICES = [
        ('none', 'Keine Wiederholung'),
        ('daily', 'Täglich'),
        ('weekly', 'Wöchentlich'),
        ('monthly', 'Monatlich'),
        ('yearly', 'Jährlich'),
    ]
    recurrence_type = models.CharField(
        max_length=20,
        choices=RECURRENCE_CHOICES,
        default='none',
        verbose_name='Wiederholung'
    )
    recurrence_end_date = models.DateField(
        blank=True,
        null=True,
        verbose_name='Wiederholen bis'
    )
    parent_event = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='recurring_instances',
        verbose_name='Ursprünglicher Termin'
    )
    
    # Zuordnung
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_calendar_events',
        verbose_name='Erstellt von'
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_calendar_events',
        verbose_name='Zugewiesen an'
    )
    
    # Verknüpfungen zu anderen Modulen (für systemgenerierte Termine)
    # Diese werden automatisch gesetzt wenn Termine aus anderen Modulen stammen
    vacation_request = models.ForeignKey(
        'users.VacationRequest',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='calendar_events',
        verbose_name='Urlaubsantrag'
    )
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='calendar_events',
        verbose_name='Bestellung'
    )
    customer_order = models.ForeignKey(
        'customer_orders.CustomerOrder',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='calendar_events',
        verbose_name='Kundenauftrag'
    )
    
    # Ob der Termin manuell erstellt wurde oder vom System generiert
    is_system_generated = models.BooleanField(default=False, verbose_name='Systemgeneriert')
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    
    class Meta:
        verbose_name = 'Kalendereintrag'
        verbose_name_plural = 'Kalendereinträge'
        ordering = ['start_date', 'start_time']
    
    def __str__(self):
        return f"{self.title} ({self.get_event_type_display()}) - {self.start_date}"
    
    @property
    def color(self):
        """Gibt die Farbe für diesen Termintyp zurück."""
        return self.EVENT_TYPE_COLORS.get(self.event_type, '#6B7280')
    
    def save(self, *args, **kwargs):
        # Wenn kein Enddatum gesetzt ist, verwende Startdatum
        if not self.end_date:
            self.end_date = self.start_date
        
        # Speichere zuerst das Event selbst
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        # Erstelle wiederkehrende Termine nur beim ersten Speichern
        if is_new and self.recurrence_type != 'none' and not self.parent_event and self.recurrence_end_date:
            self._create_recurring_events()
    
    def _create_recurring_events(self):
        """Erstellt wiederkehrende Termine basierend auf recurrence_type."""
        from datetime import timedelta
        from django.db import transaction
        
        if self.recurrence_type == 'none' or not self.recurrence_end_date:
            return
        
        current_date = self.start_date
        end_date = self.recurrence_end_date
        
        # Lösche bestehende wiederkehrende Termine
        self.recurring_instances.all().delete()
        
        events_to_create = []
        
        while current_date <= end_date:
            if current_date != self.start_date:  # Überspringe das ursprüngliche Datum
                # Berechne das Enddatum für diesen Termin
                if self.end_date and self.end_date != self.start_date:
                    # Multi-Day Event
                    duration = (self.end_date - self.start_date).days
                    event_end_date = current_date + timedelta(days=duration)
                else:
                    event_end_date = current_date
                
                # Berechne Zeiten falls nötig
                event_start_time = self.start_time
                event_end_time = self.end_time
                
                events_to_create.append(CalendarEvent(
                    title=self.title,
                    description=self.description,
                    event_type=self.event_type,
                    start_date=current_date,
                    end_date=event_end_date,
                    start_time=event_start_time,
                    end_time=event_end_time,
                    is_all_day=self.is_all_day,
                    created_by=self.created_by,
                    assigned_to=self.assigned_to,
                    parent_event=self,
                    is_system_generated=False
                ))
            
            # Berechne nächstes Datum basierend auf recurrence_type
            if self.recurrence_type == 'daily':
                current_date += timedelta(days=1)
            elif self.recurrence_type == 'weekly':
                current_date += timedelta(weeks=1)
            elif self.recurrence_type == 'monthly':
                # Füge einen Monat hinzu
                if current_date.month == 12:
                    current_date = current_date.replace(year=current_date.year + 1, month=1)
                else:
                    current_date = current_date.replace(month=current_date.month + 1)
            elif self.recurrence_type == 'yearly':
                current_date = current_date.replace(year=current_date.year + 1)
        
        # Bulk create für bessere Performance
        if events_to_create:
            CalendarEvent.objects.bulk_create(events_to_create)


class EventReminder(models.Model):
    """
    Erinnerungen für Kalendertermine.
    Ermöglicht das Senden von Erinnerungen an bestimmte Benutzer.
    """
    
    REMINDER_TIMING_CHOICES = [
        (0, 'Zum Zeitpunkt'),
        (5, '5 Minuten vorher'),
        (15, '15 Minuten vorher'),
        (30, '30 Minuten vorher'),
        (60, '1 Stunde vorher'),
        (120, '2 Stunden vorher'),
        (1440, '1 Tag vorher'),
        (2880, '2 Tage vorher'),
        (10080, '1 Woche vorher'),
    ]
    
    event = models.ForeignKey(
        CalendarEvent,
        on_delete=models.CASCADE,
        related_name='reminders',
        verbose_name='Termin'
    )
    
    # Einzelner Empfänger oder alle
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='event_reminders',
        verbose_name='Empfänger'
    )
    notify_all = models.BooleanField(default=False, verbose_name='Alle benachrichtigen')
    
    # Wann die Erinnerung fällig wird (Minuten vor dem Termin)
    minutes_before = models.IntegerField(
        choices=REMINDER_TIMING_CHOICES,
        default=60,
        verbose_name='Erinnerung'
    )
    
    # Wurde die Erinnerung bereits gesendet?
    is_sent = models.BooleanField(default=False, verbose_name='Gesendet')
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name='Gesendet am')
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Terminerinnerung'
        verbose_name_plural = 'Terminerinnerungen'
        ordering = ['event', 'minutes_before']
    
    def __str__(self):
        recipient_str = "Alle" if self.notify_all else (self.recipient.get_full_name() if self.recipient else "?")
        return f"Erinnerung für {self.event.title} an {recipient_str}"
