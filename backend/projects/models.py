from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


def project_document_upload_path(instance, filename):
    """Upload-Pfad für Projekt-Dokumente: /sales/projects/Projektnummer/filename"""
    import re
    import os
    
    def _sanitize_path_component(name):
        if not name:
            return ''
        name = name.replace('/', '_').replace('\\', '_')
        name = name.replace(' ', '_')
        return re.sub(r'[^A-Za-z0-9_.-]', '_', name)
    
    safe_filename = _sanitize_path_component(filename)
    project = getattr(instance, 'project', instance)
    project_number = _sanitize_path_component(getattr(project, 'project_number', '') or '')
    
    if project_number:
        return os.path.join('sales', 'projects', project_number, safe_filename)
    return os.path.join('sales', 'projects', 'unknown', safe_filename)


class Project(models.Model):
    """
    Kundenprojekte mit automatischer Projektnummer
    """
    STATUS_CHOICES = [
        ('NEU', 'Neu'),
        ('IN_BEARBEITUNG', 'In Bearbeitung'),
        ('ANGEBOT_ERSTELLT', 'Angebot erstellt'),
        ('DEMO_GEPLANT', 'Demo geplant'),
        ('AUSSCHREIBUNG', 'Ausschreibung'),
        ('AUFTRAG_ERTEILT', 'Auftrag erteilt'),
        ('IN_FERTIGUNG', 'In Fertigung'),
        ('LIEFERUNG', 'Lieferung'),
        ('INSTALLATION', 'Installation'),
        ('ABGESCHLOSSEN', 'Abgeschlossen'),
        ('STORNIERT', 'Storniert'),
    ]

    project_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Projektnummer',
        help_text='Automatisch generierte Projektnummer (P-00001)'
    )

    name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Projektname'
    )

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='projects',
        verbose_name='Kunde'
    )

    # Many-to-Many zu Systems (System model in systems app)
    systems = models.ManyToManyField(
        'systems.System',
        blank=True,
        related_name='projects',
        verbose_name='Systeme'
    )
    
    # Zuständiger Mitarbeiter
    responsible_employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responsible_projects',
        verbose_name='Zuständiger Mitarbeiter'
    )
    
    # Link to CustomerOrder (after order is placed)
    linked_order = models.ForeignKey(
        'customer_orders.CustomerOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_projects',
        verbose_name='Verknüpfter Auftrag'
    )

    description = models.TextField(
        blank=True,
        verbose_name='Projektbeschreibung'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='NEU',
        verbose_name='Status'
    )

    # Forecast Felder
    forecast_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Erwartetes Auftragsdatum',
        help_text='Voraussichtliches Datum des Auftragseingangs'
    )
    
    forecast_revenue = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Erwarteter Umsatz',
        help_text='Erwarteter Auftragsumsatz'
    )
    
    forecast_probability = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Wahrscheinlichkeit (%)',
        help_text='Wahrscheinlichkeit des Auftragseingangs (0-100%)'
    )
    
    # Demoplanung Felder
    demo_date_from = models.DateField(
        null=True,
        blank=True,
        verbose_name='Demo-Datum von'
    )
    
    demo_date_to = models.DateField(
        null=True,
        blank=True,
        verbose_name='Demo-Datum bis'
    )
    
    # Ausschreibung Felder
    tender_bidder_questions_deadline = models.DateField(
        null=True,
        blank=True,
        verbose_name='Ende Bieterfragen',
        help_text='Frist für Bieterfragen'
    )
    
    tender_submission_deadline = models.DateField(
        null=True,
        blank=True,
        verbose_name='Angebotsabgabefrist',
        help_text='Frist für Angebotsabgabe'
    )
    
    tender_award_deadline = models.DateField(
        null=True,
        blank=True,
        verbose_name='Zuschlagsfrist',
        help_text='Frist für Zuschlagserteilung'
    )
    
    # Lieferung Felder
    planned_delivery_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Geplantes Lieferdatum'
    )
    
    actual_delivery_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Tatsächliches Lieferdatum'
    )
    
    # Installation Felder
    planned_installation_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Geplantes Installationsdatum'
    )
    
    actual_installation_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Tatsächliches Installationsdatum'
    )

    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='projects_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')

    class Meta:
        verbose_name = 'Projekt'
        verbose_name_plural = 'Projekte'
        ordering = ['-created_at']

    def __str__(self):
        if self.name:
            return f"{self.project_number} - {self.name}"
        return f"{self.project_number} - {self.customer}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_instance = None
        if not is_new:
            try:
                old_instance = Project.objects.get(pk=self.pk)
            except Project.DoesNotExist:
                pass
        
        if not self.project_number:
            self.project_number = self._generate_project_number()
        super().save(*args, **kwargs)
        
        # Create reminders for tender deadlines
        self._create_tender_reminders(old_instance)
    
    def _create_tender_reminders(self, old_instance):
        """Creates reminders for tender deadlines"""
        from users.models import Reminder
        
        if not self.responsible_employee or not self.responsible_employee.user:
            return
        
        user = self.responsible_employee.user
        
        # Helper function to check if date changed and create reminder
        def create_reminder_for_date(date_field, old_date, title_suffix, days_before=1):
            new_date = getattr(self, date_field)
            if new_date and new_date != old_date:
                due_date = new_date - timedelta(days=days_before)
                # Delete existing reminders for this project and field
                Reminder.objects.filter(
                    user=user,
                    related_object_type='project',
                    related_object_id=self.id,
                    title__contains=title_suffix
                ).delete()
                
                Reminder.objects.create(
                    user=user,
                    title=f"Projekt {self.project_number}: {title_suffix}",
                    description=f"Frist am {new_date.strftime('%d.%m.%Y')} für Projekt '{self.name or self.project_number}'",
                    due_date=due_date,
                    related_object_type='project',
                    related_object_id=self.id,
                    related_url=f'/sales/projects/{self.id}'
                )
        
        old_bidder = getattr(old_instance, 'tender_bidder_questions_deadline', None) if old_instance else None
        old_submission = getattr(old_instance, 'tender_submission_deadline', None) if old_instance else None
        old_award = getattr(old_instance, 'tender_award_deadline', None) if old_instance else None
        old_delivery = getattr(old_instance, 'planned_delivery_date', None) if old_instance else None
        
        create_reminder_for_date('tender_bidder_questions_deadline', old_bidder, 'Ende Bieterfragen')
        create_reminder_for_date('tender_submission_deadline', old_submission, 'Angebotsabgabefrist')
        create_reminder_for_date('tender_award_deadline', old_award, 'Zuschlagsfrist')
        create_reminder_for_date('planned_delivery_date', old_delivery, 'Liefertermin')

    @staticmethod
    def _generate_project_number():
        """Generiert die nächste freie Projektnummer im Format P-XXXXX"""
        existing_numbers = Project.objects.filter(
            project_number__isnull=False
        ).values_list('project_number', flat=True)

        if not existing_numbers:
            return 'P-00001'

        # Extrahiere Nummern und finde Maximum
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue

        if not numeric_numbers:
            return 'P-00001'

        next_number = max(numeric_numbers) + 1
        return f'P-{next_number:05d}'
    
    def get_all_dates(self):
        """Returns all important dates for calendar display"""
        dates = []
        
        if self.forecast_date:
            dates.append({'date': self.forecast_date, 'label': 'Erwartetes Auftragsdatum', 'type': 'forecast'})
        if self.demo_date_from:
            dates.append({'date': self.demo_date_from, 'label': 'Demo Start', 'type': 'demo'})
        if self.demo_date_to:
            dates.append({'date': self.demo_date_to, 'label': 'Demo Ende', 'type': 'demo'})
        if self.tender_bidder_questions_deadline:
            dates.append({'date': self.tender_bidder_questions_deadline, 'label': 'Ende Bieterfragen', 'type': 'tender'})
        if self.tender_submission_deadline:
            dates.append({'date': self.tender_submission_deadline, 'label': 'Angebotsabgabefrist', 'type': 'tender'})
        if self.tender_award_deadline:
            dates.append({'date': self.tender_award_deadline, 'label': 'Zuschlagsfrist', 'type': 'tender'})
        if self.planned_delivery_date:
            dates.append({'date': self.planned_delivery_date, 'label': 'Geplante Lieferung', 'type': 'delivery'})
        if self.actual_delivery_date:
            dates.append({'date': self.actual_delivery_date, 'label': 'Tatsächliche Lieferung', 'type': 'delivery'})
        if self.planned_installation_date:
            dates.append({'date': self.planned_installation_date, 'label': 'Geplante Installation', 'type': 'installation'})
        if self.actual_installation_date:
            dates.append({'date': self.actual_installation_date, 'label': 'Tatsächliche Installation', 'type': 'installation'})
        
        return sorted(dates, key=lambda x: x['date'])


class ProjectComment(models.Model):
    """
    Kommentare zu Projekten (Kommunikations-Tab)
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Projekt'
    )
    comment = models.TextField(verbose_name='Kommentar')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='project_comments',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    
    class Meta:
        verbose_name = 'Projekt Kommentar'
        verbose_name_plural = 'Projekt Kommentare'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Kommentar zu {self.project.project_number} von {self.created_by}"


class ProjectTodo(models.Model):
    """
    ToDo-Einträge für Projekte (Demoplanung Tab)
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='todos',
        verbose_name='Projekt'
    )
    text = models.TextField(verbose_name='Aufgabe')
    is_completed = models.BooleanField(default=False, verbose_name='Erledigt')
    position = models.PositiveIntegerField(default=0, verbose_name='Position')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_project_todos',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'ToDo'
        verbose_name_plural = 'ToDos'
        ordering = ['position', 'created_at']
    
    def __str__(self):
        return f"ToDo: {self.text[:50]}..."


class ProjectDocument(models.Model):
    """
    Dokumente für Projekte (Ausschreibungs-Tab)
    Dokumente werden unter VERP_Media/sales/projects/projektnummer/ gespeichert
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='documents',
        verbose_name='Projekt'
    )
    file = models.FileField(
        upload_to=project_document_upload_path,
        verbose_name='Datei'
    )
    filename = models.CharField(
        max_length=255,
        verbose_name='Dateiname'
    )
    file_size = models.IntegerField(
        verbose_name='Dateigröße (Bytes)',
        null=True,
        blank=True
    )
    content_type = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Content-Type'
    )
    description = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Beschreibung'
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='project_document_uploads',
        verbose_name='Hochgeladen von'
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Hochgeladen am'
    )
    
    class Meta:
        verbose_name = 'Projekt-Dokument'
        verbose_name_plural = 'Projekt-Dokumente'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.filename} ({self.project.project_number})"
    
    @property
    def is_image(self):
        """Prüft ob die Datei ein Bild ist"""
        if self.content_type:
            return self.content_type.startswith('image/')
        return self.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'))


class ProjectOrderPosition(models.Model):
    """
    Tracks processing status of order positions within a project.
    Used to track whether supplier orders or production orders have been created.
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='order_positions',
        verbose_name='Projekt'
    )
    order_item = models.ForeignKey(
        'customer_orders.CustomerOrderItem',
        on_delete=models.CASCADE,
        related_name='project_positions',
        verbose_name='Auftragsposition'
    )
    
    # Status tracking
    supplier_order_created = models.BooleanField(
        default=False,
        verbose_name='Lieferantenbestellung erstellt'
    )
    supplier_order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_positions',
        verbose_name='Lieferantenbestellung'
    )
    
    production_order_created = models.BooleanField(
        default=False,
        verbose_name='Fertigungsauftrag erstellt'
    )
    production_order = models.ForeignKey(
        'manufacturing.ProductionOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_positions',
        verbose_name='Fertigungsauftrag'
    )
    
    visiview_order_created = models.BooleanField(
        default=False,
        verbose_name='VisiView-Auftrag erstellt'
    )
    # VisiView-Auftrag wird in zukünftigem Modul implementiert
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Projekt-Auftragsposition'
        verbose_name_plural = 'Projekt-Auftragspositionen'
        unique_together = ['project', 'order_item']
    
    def __str__(self):
        return f"{self.project.project_number} - Position {self.order_item.position}"
