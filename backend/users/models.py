from django.contrib.auth.models import AbstractUser
from django.db import models
from datetime import datetime, timedelta


def default_work_days():
    return ['mon', 'tue', 'wed', 'thu', 'fri']


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
    can_read_assets = models.BooleanField(default=False, verbose_name='Assets - Lesen')
    
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
    can_write_assets = models.BooleanField(default=False, verbose_name='Assets - Schreiben')
    
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


class Message(models.Model):
    """
    Persönliche Nachrichten für User
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages')
    title = models.CharField(max_length=200, verbose_name='Titel')
    content = models.TextField(verbose_name='Inhalt')
    is_read = models.BooleanField(default=False, verbose_name='Gelesen')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Nachricht'
        verbose_name_plural = 'Nachrichten'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.title}"


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
