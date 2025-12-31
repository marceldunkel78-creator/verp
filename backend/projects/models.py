from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


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

    # Many-to-Many zu Customer Systems (CustomerSystem model in customers app)
    systems = models.ManyToManyField(
        'customers.CustomerSystem',
        blank=True,
        related_name='projects',
        verbose_name='Systeme'
    )
    
    # Direkte Verknüpfung zu System (aus systems app)
    linked_system = models.ForeignKey(
        'systems.System',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='projects',
        verbose_name='Verknüpftes System'
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
        if not self.project_number:
            self.project_number = self._generate_project_number()
        super().save(*args, **kwargs)

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
