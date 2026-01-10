from django.db import models
from django.contrib.auth import get_user_model
from decimal import Decimal
from core.upload_paths import development_project_attachment_path

User = get_user_model()


class DevelopmentProject(models.Model):
    """
    Entwicklungsprojekte - Für interne Entwicklungsprojekte und Tracking
    Projektnummer im Format DEV-00001
    """
    STATUS_CHOICES = [
        ('new', 'Neu'),
        ('in_progress', 'In Arbeit'),
        ('testing', 'Im Test'),
        ('paused', 'Pausiert'),
        ('completed', 'Abgeschlossen'),
        ('rejected', 'Abgelehnt'),
    ]
    
    project_number = models.CharField(
        max_length=15,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Projektnummer',
        help_text='Automatisch generiert im Format DEV-00001'
    )
    
    name = models.CharField(max_length=200, verbose_name='Projektname')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        verbose_name='Status'
    )
    
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_development_projects',
        verbose_name='Zugewiesen an'
    )
    
    project_start = models.DateField(
        auto_now_add=True,
        verbose_name='Projektbeginn'
    )
    
    planned_end = models.DateField(
        null=True,
        blank=True,
        verbose_name='Geplantes Projektende'
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_development_projects',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Entwicklungsprojekt'
        verbose_name_plural = 'Entwicklungsprojekte'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.project_number} - {self.name}" if self.project_number else self.name
    
    @property
    def is_open(self):
        """Gibt zurück ob das Projekt offen ist"""
        return self.status not in ['completed', 'rejected']
    
    def save(self, *args, **kwargs):
        if not self.project_number:
            self.project_number = self._generate_project_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_project_number():
        """Generiert die nächste freie Projektnummer im Format DEV-00001"""
        existing_numbers = DevelopmentProject.objects.filter(
            project_number__isnull=False
        ).values_list('project_number', flat=True)
        
        if not existing_numbers:
            return 'DEV-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'DEV-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'DEV-{next_number:05d}'


class DevelopmentProjectTodo(models.Model):
    """
    ToDo-Einträge für Entwicklungsprojekte
    """
    project = models.ForeignKey(
        DevelopmentProject,
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
        related_name='created_dev_todos',
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


class DevelopmentProjectComment(models.Model):
    """
    Kommentare zu Entwicklungsprojekten
    """
    project = models.ForeignKey(
        DevelopmentProject,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Projekt'
    )
    comment = models.TextField(verbose_name='Kommentar')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='dev_project_comments',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    
    class Meta:
        verbose_name = 'Projekt Kommentar'
        verbose_name_plural = 'Projekt Kommentare'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Kommentar von {self.created_by} am {self.created_at}"


class DevelopmentProjectMaterialItem(models.Model):
    """
    Material-Position in der Materialliste eines Entwicklungsprojekts
    Referenziert M&S Produkte mit Mengenangabe
    """
    project = models.ForeignKey(
        DevelopmentProject,
        on_delete=models.CASCADE,
        related_name='material_items',
        verbose_name='Entwicklungsprojekt'
    )
    
    material_supply = models.ForeignKey(
        'suppliers.MaterialSupply',
        on_delete=models.PROTECT,
        related_name='dev_project_usages',
        verbose_name='Material & Supply'
    )
    
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=1,
        verbose_name='Menge'
    )
    
    position = models.PositiveIntegerField(default=0, verbose_name='Position')
    notes = models.CharField(max_length=200, blank=True, verbose_name='Notizen')
    
    class Meta:
        verbose_name = 'Material-Position'
        verbose_name_plural = 'Material-Positionen'
        ordering = ['position', 'id']
    
    def __str__(self):
        return f"{self.project.project_number}: {self.quantity}x {self.material_supply.name}"
    
    def get_item_cost(self):
        """Berechnet die Kosten dieser Position"""
        if self.material_supply:
            # Nutze calculate_purchase_price falls vorhanden
            unit_price = getattr(self.material_supply, 'calculate_purchase_price', lambda: self.material_supply.list_price)()
            return self.quantity * unit_price
        return Decimal('0')


class DevelopmentProjectCostCalculation(models.Model):
    """
    Kostenkalkulation für ein Entwicklungsprojekt
    """
    project = models.ForeignKey(
        DevelopmentProject,
        on_delete=models.CASCADE,
        related_name='cost_calculations',
        verbose_name='Entwicklungsprojekt'
    )
    
    name = models.CharField(max_length=100, default='Standard', verbose_name='Kalkulationsname')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    
    # Arbeitszeit-Kalkulation
    labor_hours = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0,
        verbose_name='Arbeitsstunden'
    )
    labor_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('65.00'),
        verbose_name='Stundensatz (EUR)'
    )
    
    # Entwicklungskosten
    development_cost_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Gesamtentwicklungskosten (EUR)'
    )
    expected_sales_volume = models.PositiveIntegerField(
        default=1,
        verbose_name='Erwarteter Absatz (Stück)'
    )
    
    # Berechnete Werte (werden bei Speichern aktualisiert)
    material_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Materialkosten (EUR)'
    )
    labor_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Arbeitskosten (EUR)'
    )
    development_cost_per_unit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Entwicklungskosten pro Stück (EUR)'
    )
    total_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Gesamtkosten (EUR)'
    )
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='dev_cost_calculations_created'
    )
    
    class Meta:
        verbose_name = 'Kostenkalkulation'
        verbose_name_plural = 'Kostenkalkulationen'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.project.project_number} - {self.name}"
    
    def recalculate(self):
        """Berechnet alle Kostenwerte neu"""
        # Materialkosten aus MaterialItems
        total_material = Decimal('0')
        for item in self.project.material_items.all():
            total_material += item.get_item_cost()
        
        self.material_cost = total_material
        self.labor_cost = self.labor_hours * self.labor_rate
        
        if self.expected_sales_volume > 0:
            self.development_cost_per_unit = self.development_cost_total / self.expected_sales_volume
        else:
            self.development_cost_per_unit = Decimal('0')
        
        self.total_cost = (
            self.material_cost +
            self.labor_cost +
            self.development_cost_per_unit
        )
    
    def save(self, *args, **kwargs):
        self.recalculate()
        super().save(*args, **kwargs)


class DevelopmentProjectAttachment(models.Model):
    """
    Dateianhänge für Entwicklungsprojekte
    """
    project = models.ForeignKey(
        DevelopmentProject,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Projekt'
    )
    file = models.FileField(
        upload_to=development_project_attachment_path,
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
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='dev_project_uploads',
        verbose_name='Hochgeladen von'
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Hochgeladen am'
    )
    
    class Meta:
        verbose_name = 'Projekt-Anhang'
        verbose_name_plural = 'Projekt-Anhänge'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.filename} ({self.project.project_number})"
    
    @property
    def is_image(self):
        """Prüft ob die Datei ein Bild ist"""
        if self.content_type:
            return self.content_type.startswith('image/')
        return self.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'))


class DevelopmentProjectTimeEntry(models.Model):
    """
    Zeiterfassung für Entwicklungsprojekte
    """
    project = models.ForeignKey(
        DevelopmentProject,
        on_delete=models.CASCADE,
        related_name='time_entries',
        verbose_name='Projekt'
    )
    date = models.DateField(
        verbose_name='Datum',
        help_text='Datum der Arbeitsleistung'
    )
    time = models.TimeField(
        verbose_name='Uhrzeit',
        help_text='Uhrzeit der Arbeitsleistung'
    )
    employee = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='dev_project_time_entries',
        verbose_name='Mitarbeiter'
    )
    hours_spent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name='Aufgewendete Zeit (Stunden)',
        help_text='Aufgewendete Zeit in Stunden (z.B. 2.5 für 2,5 Stunden)'
    )
    description = models.TextField(
        verbose_name='Beschreibung',
        help_text='Kurze Beschreibung der durchgeführten Arbeiten'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_dev_time_entries',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Zeiteintrag'
        verbose_name_plural = 'Zeiteinträge'
        ordering = ['-date', '-time']
    
    def __str__(self):
        return f"{self.date} {self.time} - {self.hours_spent}h ({self.project.project_number})"
