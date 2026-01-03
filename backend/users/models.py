from django.contrib.auth.models import AbstractUser
from django.db import models
from datetime import datetime, timedelta
import os


def default_work_days():
    return ['mon', 'tue', 'wed', 'thu', 'fri']


def travel_expense_pdf_path(instance, filename):
    """Generiert den Pfad für Reisekosten-PDFs"""
    user = instance.user
    employee = getattr(user, 'employee', None)
    if employee:
        folder_name = f"{employee.first_name}_{employee.last_name}-{employee.employee_id}"
    else:
        folder_name = user.username
    return f"MyVERP/{folder_name}/Reisekosten/{instance.year}/{filename}"


def travel_expense_receipt_path(instance, filename):
    """Generiert den Pfad für Reisekosten-Belege"""
    report = instance.day.report
    user = report.user
    employee = getattr(user, 'employee', None)
    if employee:
        folder_name = f"{employee.first_name}_{employee.last_name}-{employee.employee_id}"
    else:
        folder_name = user.username
    return f"MyVERP/{folder_name}/Reisekosten/{report.year}/Belege/{filename}"


class User(AbstractUser):
    """
    Custom User Model für VERP
    Erweitert Django's AbstractUser mit zusätzlichen Feldern
    """
    email = models.EmailField(unique=True, verbose_name='E-Mail')
    phone = models.CharField(max_length=50, blank=True, verbose_name='Telefon')
    position = models.CharField(max_length=100, blank=True, verbose_name='Position')
    department = models.CharField(max_length=100, blank=True, verbose_name='Abteilung')
    # Optionaler Verweis auf einen Mitarbeiter-Eintrag (HR)
    employee = models.ForeignKey('Employee', null=True, blank=True, on_delete=models.SET_NULL, related_name='users', verbose_name='Mitarbeiter')
    
    # Berechtigungen für Module - Lesen
    can_read_accounting = models.BooleanField(default=False, verbose_name='Buchhaltung - Lesen')
    can_read_hr = models.BooleanField(default=False, verbose_name='HR - Lesen')
    can_read_suppliers = models.BooleanField(default=False, verbose_name='Lieferanten - Lesen')
    can_read_customers = models.BooleanField(default=False, verbose_name='Kunden - Lesen')
    can_read_manufacturing = models.BooleanField(default=False, verbose_name='Produktion - Lesen')
    can_read_service = models.BooleanField(default=False, verbose_name='Service - Lesen')
    can_read_settings = models.BooleanField(default=False, verbose_name='Einstellungen - Lesen')
    # Neue Lese-Berechtigungen für Module
    can_read_sales = models.BooleanField(default=False, verbose_name='Sales - Lesen')
    can_read_trading = models.BooleanField(default=False, verbose_name='Handelsware - Lesen')
    can_read_material_supplies = models.BooleanField(default=False, verbose_name='Material & Supplies - Lesen')
    
    # Berechtigungen für Module - Schreiben
    can_write_accounting = models.BooleanField(default=False, verbose_name='Buchhaltung - Schreiben')
    can_write_hr = models.BooleanField(default=False, verbose_name='HR - Schreiben')
    can_write_suppliers = models.BooleanField(default=False, verbose_name='Lieferanten - Schreiben')
    can_write_customers = models.BooleanField(default=False, verbose_name='Kunden - Schreiben')
    can_write_manufacturing = models.BooleanField(default=False, verbose_name='Produktion - Schreiben')
    can_write_service = models.BooleanField(default=False, verbose_name='Service - Schreiben')
    can_write_settings = models.BooleanField(default=False, verbose_name='Einstellungen - Schreiben')
    # Neue Schreib-Berechtigungen für Module
    can_write_sales = models.BooleanField(default=False, verbose_name='Sales - Schreiben')
    can_write_trading = models.BooleanField(default=False, verbose_name='Handelsware - Schreiben')
    can_write_material_supplies = models.BooleanField(default=False, verbose_name='Material & Supplies - Schreiben')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Benutzer'
        verbose_name_plural = 'Benutzer'
        ordering = ['username']
    
    def __str__(self):
        return f"{self.get_full_name() or self.username}"


class Employee(models.Model):
    """
    Employee Model für HR-Daten (Minimalset)
    Basierend auf hr_schema.minimal.json
    """
    CONTRACT_TYPE_CHOICES = [
        ('unbefristet', 'Unbefristet'),
        ('befristet', 'Befristet'),
        ('teilzeit', 'Teilzeit'),
        ('vollzeit', 'Vollzeit'),
        ('ausbildung', 'Ausbildung'),
        ('minijob', 'Minijob'),
        ('praktikum', 'Praktikum'),
    ]
    
    EMPLOYMENT_STATUS_CHOICES = [
        ('aktiv', 'Aktiv'),
        ('inaktiv', 'Inaktiv'),
        ('urlaub', 'Urlaub'),
        ('krank', 'Krank'),
        ('aufkündigung', 'Aufkündigung'),
    ]
    
    employee_id = models.CharField(max_length=50, unique=True, blank=True, verbose_name='Mitarbeiter-ID')
    first_name = models.CharField(max_length=100, verbose_name='Vorname')
    last_name = models.CharField(max_length=100, verbose_name='Nachname')
    date_of_birth = models.DateField(verbose_name='Geburtsdatum')
    address = models.TextField(blank=True, verbose_name='Anschrift/Adresse')
    personal_email = models.EmailField(blank=True, verbose_name='Private E-Mail')
    work_email = models.EmailField(blank=True, verbose_name='Dienstliche E-Mail')
    phone = models.CharField(max_length=50, blank=True, verbose_name='Telefonnummer')
    employment_start_date = models.DateField(verbose_name='Eintrittsdatum')
    employment_end_date = models.DateField(blank=True, null=True, verbose_name='Austrittsdatum')
    contract_type = models.CharField(max_length=20, choices=CONTRACT_TYPE_CHOICES, verbose_name='Vertragsart')
    job_title = models.CharField(max_length=150, verbose_name='Stellenbezeichnung')
    department = models.CharField(max_length=100, blank=True, verbose_name='Abteilung')
    working_time_percentage = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, verbose_name='Beschäftigungsumfang (%)')
    weekly_work_hours = models.DecimalField(max_digits=5, decimal_places=2, default=40.00, verbose_name='Wochenarbeitszeit (h)')
    # Arbeitstage als Liste von Wochentagskürzeln, z.B. ['mon','tue','wed','thu','fri']
    work_days = models.JSONField(default=default_work_days, verbose_name='Arbeitstage')
    # Jahresurlaubstage (standardmäßig 30) - allow half-days
    from django.core.validators import MinValueValidator
    annual_vacation_days = models.DecimalField(max_digits=5, decimal_places=1, default=30.0, verbose_name='Jahresurlaubstage', validators=[MinValueValidator(0)])
    # Aktuelles Urlaubsguthaben (wird beim Erstellen auf Jahresurlaub gesetzt) - allow halves
    vacation_balance = models.DecimalField(max_digits=5, decimal_places=1, default=30.0, verbose_name='Urlaubskonto (Tage)')
    employment_status = models.CharField(max_length=20, choices=EMPLOYMENT_STATUS_CHOICES, verbose_name='Beschäftigungsstatus')
    
    # Unterschriftsbild für Angebote/Dokumente
    signature_image = models.ImageField(
        upload_to='hr/signatures/',
        blank=True,
        null=True,
        verbose_name='Unterschrift',
        help_text='Unterschriftsbild für Angebote und Dokumente (PNG/JPG)'
    )
    
    # Grußformel für Angebote/Dokumente
    closing_greeting = models.CharField(
        max_length=200,
        blank=True,
        default='Mit freundlichen Grüßen',
        verbose_name='Grußformel',
        help_text='z.B. "Mit freundlichen Grüßen" oder "Best regards"'
    )
    
    # Bankverbindung für Reisekostenerstattung
    bank_account_holder = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Kontoinhaber',
        help_text='Name des Kontoinhabers'
    )
    bank_iban = models.CharField(
        max_length=34,
        blank=True,
        verbose_name='IBAN',
        help_text='Internationale Bankkontonummer'
    )
    bank_bic = models.CharField(
        max_length=11,
        blank=True,
        verbose_name='BIC',
        help_text='Bank Identifier Code'
    )
    bank_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Bankname',
        help_text='Name der Bank'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        if not self.employee_id:
            self.employee_id = self.generate_employee_id()
        # ensure vacation_balance initialized to annual_vacation_days on create
        if not self.pk and (self.vacation_balance is None or float(self.vacation_balance) == 0.0):
            try:
                self.vacation_balance = float(self.annual_vacation_days)
            except Exception:
                self.vacation_balance = 30.0
        super().save(*args, **kwargs)
    
    def generate_employee_id(self):
        """Generiert eine eindeutige Mitarbeiter-ID im Format EMP001, EMP002, etc."""
        last_employee = Employee.objects.order_by('-id').first()
        if last_employee and last_employee.employee_id.startswith('EMP'):
            try:
                last_number = int(last_employee.employee_id[3:])
                new_number = last_number + 1
            except ValueError:
                new_number = 1
        else:
            new_number = 1
        return f"EMP{new_number:03d}"


class TimeEntry(models.Model):
    """
    Arbeitszeiterfassung für Mitarbeiter
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='time_entries')
    date = models.DateField(verbose_name='Datum')
    start_time = models.TimeField(verbose_name='Startzeit')
    end_time = models.TimeField(verbose_name='Endzeit')
    break_time = models.CharField(max_length=20, default='00:30:00', verbose_name='Pausenzeit')
    description = models.CharField(max_length=255, blank=True, verbose_name='Beschreibung')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Zeiteintrag'
        verbose_name_plural = 'Zeiteinträge'
        ordering = ['-date', '-start_time']
        unique_together = ['user', 'date', 'start_time']  # Verhindert doppelte Einträge

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.date} {self.start_time}-{self.end_time}"

    @property
    def duration(self):
        """Berechnet die Arbeitsdauer abzüglich Pause"""
        if self.end_time and self.start_time:
            total_duration = datetime.combine(self.date, self.end_time) - datetime.combine(self.date, self.start_time)
            # Parse break_time (HH:MM:SS)
            try:
                h, m, s = map(int, self.break_time.split(':'))
                break_duration = timedelta(hours=h, minutes=m, seconds=s)
            except ValueError:
                break_duration = timedelta(minutes=30)  # Fallback
            return total_duration - break_duration
        return timedelta(0)


class VacationYearBalance(models.Model):
    """
    Jahresurlaubskonto für einen Mitarbeiter.
    Trackt: Anspruch, Übertrag aus Vorjahr, genommen, Rest.
    Wird bei Jahresabschluss erstellt/aktualisiert.
    """
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='vacation_year_balances')
    year = models.PositiveIntegerField(verbose_name='Jahr')
    
    # Anspruch basierend auf Beschäftigungsmonaten (anteilig)
    entitlement = models.DecimalField(max_digits=5, decimal_places=1, default=0, verbose_name='Jahresanspruch (anteilig)')
    # Übertrag aus dem Vorjahr
    carryover = models.DecimalField(max_digits=5, decimal_places=1, default=0, verbose_name='Übertrag aus Vorjahr')
    # Manuelle Anpassungen (Summe aus VacationAdjustment)
    manual_adjustment = models.DecimalField(max_digits=5, decimal_places=1, default=0, verbose_name='Manuelle Anpassungen')
    # Genommene Tage (genehmigter Urlaub in diesem Jahr)
    taken = models.DecimalField(max_digits=5, decimal_places=1, default=0, verbose_name='Genommen')
    # Berechnetes Guthaben: entitlement + carryover + manual_adjustment - taken
    balance = models.DecimalField(max_digits=5, decimal_places=1, default=0, verbose_name='Resturlaub')
    
    # Ob der Jahresabschluss durchgeführt wurde
    is_closed = models.BooleanField(default=False, verbose_name='Jahr abgeschlossen')
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name='Abgeschlossen am')
    closed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='closed_vacation_years')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Jahresurlaubskonto'
        verbose_name_plural = 'Jahresurlaubskonten'
        unique_together = ['employee', 'year']
        ordering = ['-year']
    
    def __str__(self):
        return f"{self.employee.employee_id} - {self.year}: {self.balance} Tage"
    
    def recalculate_balance(self):
        """Berechnet das Guthaben neu basierend auf allen Komponenten."""
        from decimal import Decimal
        self.balance = (
            Decimal(str(self.entitlement)) +
            Decimal(str(self.carryover)) +
            Decimal(str(self.manual_adjustment)) -
            Decimal(str(self.taken))
        )
        return self.balance
    
    @classmethod
    def get_or_create_for_year(cls, employee, year):
        """
        Erstellt oder gibt das Jahresurlaubskonto für einen Mitarbeiter und Jahr zurück.
        Berechnet den anteiligen Anspruch basierend auf Beschäftigungsmonaten.
        """
        from decimal import Decimal
        from datetime import date
        
        obj, created = cls.objects.get_or_create(
            employee=employee,
            year=year,
            defaults={'entitlement': 0, 'carryover': 0, 'taken': 0, 'balance': 0}
        )
        
        # Berechne anteiligen Anspruch, Übertrag und genommene Tage (taken)
        annual_days = Decimal(str(employee.annual_vacation_days or 30))
        start_date = employee.employment_start_date
        end_date = employee.employment_end_date

        year_start = date(year, 1, 1)
        year_end = date(year, 12, 31)

        # Beschäftigungsbeginn in diesem Jahr
        effective_start = max(start_date, year_start) if start_date else year_start
        # Beschäftigungsende in diesem Jahr (oder Jahresende)
        effective_end = min(end_date, year_end) if end_date else year_end

        # Nur zählen wenn Beschäftigung in diesem Jahr liegt
        if effective_start <= year_end and effective_end >= year_start:
            # Monate berechnen (vereinfacht: volle Monate)
            months_employed = 0
            for month in range(1, 13):
                month_start = date(year, month, 1)
                if month == 12:
                    month_end = date(year, 12, 31)
                else:
                    month_end = date(year, month + 1, 1) - timedelta(days=1)

                # Prüfen ob der Mitarbeiter in diesem Monat mindestens 15 Tage beschäftigt war
                if effective_start <= month_end and effective_end >= month_start:
                    overlap_start = max(effective_start, month_start)
                    overlap_end = min(effective_end, month_end)
                    days_in_month = (overlap_end - overlap_start).days + 1
                    if days_in_month >= 15:
                        months_employed += 1

            # Anteiliger Anspruch: (annual_days / 12) * months_employed
            obj.entitlement = (annual_days / Decimal('12') * Decimal(str(months_employed))).quantize(Decimal('0.1'))

        # Übertrag aus Vorjahr holen
        try:
            prev_year = cls.objects.get(employee=employee, year=year - 1)
            if prev_year.is_closed:
                obj.carryover = prev_year.balance
        except cls.DoesNotExist:
            pass

        # Berechne genommene Tage aus genehmigten Urlaubsanträgen, damit 'taken' stets konsistent ist
        try:
            from django.db.models import Sum
            taken_sum = VacationRequest.objects.filter(
                user__employee=employee,
                status='approved',
                start_date__year=year
            ).aggregate(total=Sum('days_requested'))['total']
            obj.taken = Decimal(str(taken_sum or 0))
        except Exception:
            # fallback: falls etwas schiefgeht, leave existing taken value
            pass

        obj.recalculate_balance()
        obj.save()

        # Synchronisiere das Mitarbeiter-Guthaben mit dem berechneten Jahreskonto
        try:
            if employee:
                employee.vacation_balance = float(obj.balance)
                employee.save()
        except Exception:
            pass

        return obj


class VacationAdjustment(models.Model):
    """
    Manuelle Anpassungen am Urlaubskonto eines Mitarbeiters.
    Dient als Changelog für alle Änderungen.
    """
    ADJUSTMENT_TYPE_CHOICES = [
        ('manual', 'Manuelle Anpassung'),
        ('carryover', 'Übertrag'),
        ('year_close', 'Jahresabschluss'),
        ('correction', 'Korrektur'),
        ('approval', 'Genehmigung'),
        ('rejection', 'Ablehnung'),
        ('cancellation', 'Stornierung'),
        ('entitlement_change', 'Anspruchsänderung'),
    ]
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='vacation_adjustments')
    year_balance = models.ForeignKey(VacationYearBalance, on_delete=models.CASCADE, null=True, blank=True, related_name='adjustments')
    vacation_request = models.ForeignKey('VacationRequest', on_delete=models.SET_NULL, null=True, blank=True, related_name='adjustments')
    
    adjustment_type = models.CharField(max_length=20, choices=ADJUSTMENT_TYPE_CHOICES, verbose_name='Art der Anpassung')
    days = models.DecimalField(max_digits=5, decimal_places=1, verbose_name='Tage (+/-)')
    balance_before = models.DecimalField(max_digits=5, decimal_places=1, verbose_name='Kontostand vorher')
    balance_after = models.DecimalField(max_digits=5, decimal_places=1, verbose_name='Kontostand nachher')
    reason = models.TextField(verbose_name='Begründung')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='vacation_adjustments_made')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Urlaubsanpassung'
        verbose_name_plural = 'Urlaubsanpassungen'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.employee.employee_id} - {self.get_adjustment_type_display()}: {self.days:+.1f} Tage"


class VacationRequest(models.Model):
    """
    Urlaubsanträge
    """
    STATUS_CHOICES = [
        ('pending', 'Ausstehend'),
        ('approved', 'Genehmigt'),
        ('rejected', 'Abgelehnt'),
        ('cancelled', 'Storniert'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vacation_requests')
    start_date = models.DateField(verbose_name='Startdatum')
    end_date = models.DateField(verbose_name='Enddatum')

    HALF_DAY_CHOICES = [
        ('none', 'Kein Halbtag'),
        ('am', 'Vormittag'),
        ('pm', 'Nachmittag'),
    ]

    # Optional half-day specifiers for start and end
    start_half = models.CharField(max_length=10, choices=HALF_DAY_CHOICES, default='none', verbose_name='Beginn als Halbtag')
    end_half = models.CharField(max_length=10, choices=HALF_DAY_CHOICES, default='none', verbose_name='Ende als Halbtag')

    days_requested = models.DecimalField(max_digits=4, decimal_places=1, verbose_name='Urlaubstage')
    reason = models.TextField(blank=True, verbose_name='Grund')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='Status')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_vacations')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Urlaubsantrag'
        verbose_name_plural = 'Urlaubsanträge'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.start_date} bis {self.end_date}"
    
    def get_year(self):
        """Gibt das Jahr zurück, in dem der Urlaub hauptsächlich liegt (Startdatum)."""
        return self.start_date.year if self.start_date else None


class Message(models.Model):
    """
    Persönliche Nachrichten für User - mit Sender/Empfänger für Posteingang/-ausgang
    """
    MESSAGE_TYPE_CHOICES = [
        ('user', 'Benutzer'),
        ('system', 'System'),
        ('ticket', 'Ticket-Benachrichtigung'),
    ]
    
    sender = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='sent_messages',
        verbose_name='Absender'
    )
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='messages',
        verbose_name='Empfänger'
    )
    title = models.CharField(max_length=200, verbose_name='Betreff')
    content = models.TextField(verbose_name='Inhalt')
    message_type = models.CharField(
        max_length=20,
        choices=MESSAGE_TYPE_CHOICES,
        default='user',
        verbose_name='Nachrichtentyp'
    )
    is_read = models.BooleanField(default=False, verbose_name='Gelesen')
    is_deleted_by_sender = models.BooleanField(default=False, verbose_name='Vom Sender gelöscht')
    is_deleted_by_recipient = models.BooleanField(default=False, verbose_name='Vom Empfänger gelöscht')
    # Optionale Verknüpfung mit einem Service-Ticket
    related_ticket = models.ForeignKey(
        'service.ServiceTicket',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name='Verknüpftes Ticket'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Nachricht'
        verbose_name_plural = 'Nachrichten'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sender or 'System'} -> {self.user.get_full_name()}: {self.title}"


class Reminder(models.Model):
    """
    Persönliche Erinnerungen
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reminders')
    title = models.CharField(max_length=200, verbose_name='Titel')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    due_date = models.DateTimeField(verbose_name='Fälligkeitsdatum')
    is_completed = models.BooleanField(default=False, verbose_name='Erledigt')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Erinnerung'
        verbose_name_plural = 'Erinnerungen'
        ordering = ['due_date']

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.title}"


class MonthlyWorkSummary(models.Model):
    """
    Aggregierte Monatsübersicht für einen Mitarbeiter / Nutzer
    Enthält die zusammengefassten Ist-/Soll-Stunden für einen Monat.
    """
    employee = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL, related_name='monthly_summaries')
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='monthly_summaries')
    month = models.DateField(verbose_name='Monat')  # store first day of month
    actual_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0.0, verbose_name='Ist-Stunden')
    expected_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0.0, verbose_name='Soll-Stunden')
    difference = models.DecimalField(max_digits=8, decimal_places=2, default=0.0, verbose_name='Differenz')
    note = models.TextField(blank=True, verbose_name='Anmerkung')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Monatliche Arbeitsübersicht'
        verbose_name_plural = 'Monatliche Arbeitsübersichten'
        unique_together = (('employee', 'month'), ('user', 'month'))
        ordering = ['-month']

    def __str__(self):
        who = self.employee.employee_id if self.employee else (self.user.get_full_name() if self.user else 'Unknown')
        return f"{who} - {self.month:%Y-%m}"


class TravelExpenseReport(models.Model):
    """
    Reisekostenabrechnung pro Kalenderwoche
    """
    STATUS_CHOICES = [
        ('draft', 'Entwurf'),
        ('submitted', 'Eingereicht'),
        ('approved', 'Genehmigt'),
        ('rejected', 'Abgelehnt'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='travel_expense_reports')
    calendar_week = models.PositiveIntegerField(verbose_name='Kalenderwoche')
    year = models.PositiveIntegerField(verbose_name='Jahr')
    destination = models.CharField(max_length=200, verbose_name='Reiseziel')
    country = models.CharField(max_length=100, default='Deutschland', verbose_name='Land')
    purpose = models.TextField(verbose_name='Reisezweck')
    start_date = models.DateField(verbose_name='Reisebeginn')
    end_date = models.DateField(verbose_name='Reiseende')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='Status')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Gesamtbetrag')
    pdf_file = models.FileField(upload_to=travel_expense_pdf_path, blank=True, null=True, verbose_name='PDF-Datei')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_travel_expenses')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Reisekostenabrechnung'
        verbose_name_plural = 'Reisekostenabrechnungen'
        unique_together = ['user', 'calendar_week', 'year']
        ordering = ['-year', '-calendar_week']

    def __str__(self):
        return f"{self.user.get_full_name()} - KW{self.calendar_week}/{self.year}"

    def get_upload_path(self):
        """Returns the path for storing files"""
        return f"myverp/{self.user.username}/Reisekosten/KW{self.calendar_week}_{self.year}/"


class TravelExpenseDay(models.Model):
    """
    Einzelner Reisetag mit Pauschalen und Kosten
    """
    report = models.ForeignKey(TravelExpenseReport, on_delete=models.CASCADE, related_name='days')
    date = models.DateField(verbose_name='Datum')
    location = models.CharField(max_length=200, blank=True, verbose_name='Aufenthaltsort')
    country = models.CharField(max_length=100, default='Deutschland', verbose_name='Land')
    
    # Reisekostenpauschalen (automatisch berechnet)
    per_diem_full = models.DecimalField(max_digits=8, decimal_places=2, default=0, verbose_name='Tagespauschale (Vollständig)')
    per_diem_partial = models.DecimalField(max_digits=8, decimal_places=2, default=0, verbose_name='Tagespauschale (Teil)')
    per_diem_applied = models.DecimalField(max_digits=8, decimal_places=2, default=0, verbose_name='Angewendete Pauschale')
    
    # Aufenthaltsdauer
    departure_time = models.TimeField(null=True, blank=True, verbose_name='Abfahrt')
    arrival_time = models.TimeField(null=True, blank=True, verbose_name='Ankunft')
    is_full_day = models.BooleanField(default=True, verbose_name='Ganztags')
    travel_hours = models.DecimalField(max_digits=4, decimal_places=1, default=0, verbose_name='Reisestunden')
    
    # Übernachtungspauschale
    overnight_allowance = models.DecimalField(max_digits=8, decimal_places=2, default=0, verbose_name='Übernachtungspauschale')
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Reisetag'
        verbose_name_plural = 'Reisetage'
        unique_together = ['report', 'date']
        ordering = ['date']

    def __str__(self):
        return f"{self.report} - {self.date}"


class TravelExpenseItem(models.Model):
    """
    Einzelne Reisekostenposition
    """
    EXPENSE_TYPE_CHOICES = [
        ('transport', 'Transport'),
        ('hotel', 'Hotel'),
        ('parking', 'Parken'),
        ('shipping', 'Versand'),
        ('hospitality', 'Bewirtung'),
        ('other', 'Sonstiges'),
    ]

    day = models.ForeignKey(TravelExpenseDay, on_delete=models.CASCADE, related_name='expenses')
    expense_type = models.CharField(max_length=20, choices=EXPENSE_TYPE_CHOICES, verbose_name='Kostenart')
    description = models.CharField(max_length=500, verbose_name='Beschreibung')
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Betrag')
    
    # Für Bewirtung
    guest_names = models.TextField(blank=True, verbose_name='Gastnamen')
    hospitality_reason = models.TextField(blank=True, verbose_name='Bewirtungsgrund')
    
    # Beleg
    receipt = models.FileField(upload_to=travel_expense_receipt_path, blank=True, null=True, verbose_name='Beleg')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Reisekostenposition'
        verbose_name_plural = 'Reisekostenpositionen'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.get_expense_type_display()} - {self.amount}€"


class TravelPerDiemRate(models.Model):
    """
    Reisekostenpauschalen pro Land (aktualisierbar)
    Basierend auf deutschen Steuerrichtlinien
    """
    country = models.CharField(max_length=100, unique=True, verbose_name='Land')
    country_code = models.CharField(max_length=3, blank=True, verbose_name='Ländercode')
    full_day_rate = models.DecimalField(max_digits=8, decimal_places=2, verbose_name='Tagespauschale (24h)')
    partial_day_rate = models.DecimalField(max_digits=8, decimal_places=2, verbose_name='Tagespauschale (>8h)')
    overnight_rate = models.DecimalField(max_digits=8, decimal_places=2, verbose_name='Übernachtungspauschale')
    valid_from = models.DateField(verbose_name='Gültig ab')
    valid_until = models.DateField(null=True, blank=True, verbose_name='Gültig bis')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Reisekostenpauschale'
        verbose_name_plural = 'Reisekostenpauschalen'
        ordering = ['country']

    def __str__(self):
        return f"{self.country} - {self.full_day_rate}€/Tag"

    @classmethod
    def get_rate_for_country(cls, country, date=None):
        """Gibt die aktuell gültige Pauschale für ein Land zurück"""
        from django.utils import timezone
        if date is None:
            date = timezone.now().date()
        
        rate = cls.objects.filter(
            country__iexact=country,
            is_active=True,
            valid_from__lte=date
        ).filter(
            models.Q(valid_until__isnull=True) | models.Q(valid_until__gte=date)
        ).first()
        
        if not rate:
            # Fallback auf Deutschland
            rate = cls.objects.filter(country='Deutschland', is_active=True).first()
        
        return rate


class Reminder(models.Model):
    """
    Erinnerungen für Benutzer
    Zeigt Aufgaben mit Fälligkeitsdatum im MyVERP-Dashboard an
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reminders',
        verbose_name='Benutzer'
    )
    title = models.CharField(
        max_length=200,
        verbose_name='Titel'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    due_date = models.DateField(
        verbose_name='Fälligkeitsdatum'
    )
    is_completed = models.BooleanField(
        default=False,
        verbose_name='Erledigt'
    )
    is_dismissed = models.BooleanField(
        default=False,
        verbose_name='Ausgeblendet',
        help_text='Vom Benutzer ausgeblendet, wird nicht mehr im Modal angezeigt'
    )
    # Optionale Verknüpfung zu anderen Objekten
    related_object_type = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Verknüpfter Objekttyp',
        help_text='z.B. "loan", "quotation", "order"'
    )
    related_object_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Verknüpfte Objekt-ID'
    )
    related_url = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Verknüpfte URL',
        help_text='URL zum verknüpften Objekt'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')

    class Meta:
        verbose_name = 'Erinnerung'
        verbose_name_plural = 'Erinnerungen'
        ordering = ['due_date', '-created_at']

    def __str__(self):
        return f"{self.title} - {self.due_date}"


class Notification(models.Model):
    """
    Mitteilungen für Benutzer (Mitteilungscenter)
    """
    NOTIFICATION_TYPES = [
        ('info', 'Information'),
        ('warning', 'Warnung'),
        ('success', 'Erfolg'),
        ('loan', 'Leihung'),
        ('order', 'Bestellung'),
        ('quotation', 'Angebot'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='Benutzer'
    )
    title = models.CharField(
        max_length=200,
        verbose_name='Titel'
    )
    message = models.TextField(
        verbose_name='Nachricht'
    )
    notification_type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPES,
        default='info',
        verbose_name='Typ'
    )
    is_read = models.BooleanField(
        default=False,
        verbose_name='Gelesen'
    )
    related_url = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Verknüpfte URL'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')

    class Meta:
        verbose_name = 'Mitteilung'
        verbose_name_plural = 'Mitteilungen'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.user.username}"
