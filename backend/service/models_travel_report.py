"""
Models für Reiseberichte/Serviceberichte
"""
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class TravelReport(models.Model):
    """
    Reisebericht/Servicebericht Model
    Kann mit Kunden, Systemen und Aufträgen verknüpft werden
    """
    REPORT_TYPE_CHOICES = [
        ('travel', 'Reisebericht'),
        ('service', 'Servicebericht'),
    ]
    
    report_type = models.CharField(
        max_length=20,
        choices=REPORT_TYPE_CHOICES,
        default='travel',
        verbose_name='Berichtstyp'
    )
    
    # Basis-Informationen
    date = models.DateField(verbose_name='Datum')
    location = models.CharField(max_length=255, verbose_name='Ort')
    
    # Verknüpfungen
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='travel_reports',
        verbose_name='Kunde'
    )
    linked_system = models.ForeignKey(
        'systems.System',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='travel_reports',
        verbose_name='Verknüpftes System'
    )
    linked_order = models.ForeignKey(
        'customer_orders.CustomerOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='travel_reports',
        verbose_name='Verknüpfter Auftrag'
    )
    
    # Inhalt
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='travel_reports_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Reisebericht'
        verbose_name_plural = 'Reiseberichte'
    
    def __str__(self):
        return f"{self.get_report_type_display()} - {self.date} - {self.location}"


class TravelReportMeasurement(models.Model):
    """
    Variable Tabelle für Messungen (z.B. Lasermessungen)
    """
    travel_report = models.ForeignKey(
        TravelReport,
        on_delete=models.CASCADE,
        related_name='measurements',
        verbose_name='Reisebericht'
    )
    
    # Titel der Messtabelle
    title = models.CharField(
        max_length=255,
        blank=True,
        default='Messungen',
        verbose_name='Titel'
    )
    
    # Messungs-Daten als JSON für Flexibilität
    data = models.JSONField(
        default=dict,
        verbose_name='Messdaten',
        help_text='Flexible Tabellendaten als JSON'
    )
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        ordering = ['created_at']
        verbose_name = 'Messung'
        verbose_name_plural = 'Messungen'
    
    def __str__(self):
        return f"Messung für {self.travel_report}"


class TravelReportPhoto(models.Model):
    """
    Fotos für Reiseberichte
    """
    travel_report = models.ForeignKey(
        TravelReport,
        on_delete=models.CASCADE,
        related_name='photos',
        verbose_name='Reisebericht'
    )
    
    photo = models.ImageField(
        upload_to='travel_reports/photos/%Y/%m/',
        verbose_name='Foto'
    )
    caption = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Bildunterschrift'
    )
    
    # Metadaten
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='Hochgeladen am')
    
    class Meta:
        ordering = ['uploaded_at']
        verbose_name = 'Foto'
        verbose_name_plural = 'Fotos'
    
    def __str__(self):
        return f"Foto für {self.travel_report}"
