# VisiView Production Order Models
# Separate file to keep models.py manageable

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class VisiViewProductionOrder(models.Model):
    """
    VisiView Fertigungsauftrag - fasst mehrere VisiView-Positionen zusammen
    Ermöglicht Lizenzanlage, Optionserweiterung oder Maintenance-Gutschrift
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Entwurf'),
        ('IN_PROGRESS', 'In Bearbeitung'),
        ('COMPLETED', 'Abgeschlossen'),
        ('CANCELLED', 'Storniert'),
    ]
    
    PROCESSING_TYPE_CHOICES = [
        ('NEW_LICENSE', 'Neue Lizenz'),
        ('EXTEND_LICENSE', 'Lizenz erweitern'),
        ('MAINTENANCE_CREDIT', 'Maintenance-Gutschrift'),
    ]
    
    # Auftragsnummer
    order_number = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        verbose_name='Auftragsnummer',
        help_text='Automatisch generiert: VVP-00001'
    )
    
    # Verknüpfung zum Kundenauftrag
    customer_order = models.ForeignKey(
        'customer_orders.CustomerOrder',
        on_delete=models.PROTECT,
        related_name='visiview_production_orders',
        verbose_name='Kundenauftrag'
    )
    
    # Kunde
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='visiview_production_orders',
        verbose_name='Kunde'
    )
    
    # Status und Typ
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        verbose_name='Status'
    )
    
    processing_type = models.CharField(
        max_length=30,
        choices=PROCESSING_TYPE_CHOICES,
        null=True,
        blank=True,
        verbose_name='Bearbeitungsart'
    )
    
    # Lizenz-Zuordnung (falls Erweiterung oder Maintenance)
    target_license = models.ForeignKey(
        'visiview.VisiViewLicense',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_orders',
        verbose_name='Ziel-Lizenz'
    )
    
    # Notizen
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='visiview_production_orders_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Abgeschlossen am'
    )
    
    class Meta:
        verbose_name = 'VisiView Fertigungsauftrag'
        verbose_name_plural = 'VisiView Fertigungsaufträge'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.order_number} - {self.customer}"
    
    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self._generate_order_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_order_number():
        """Generiert die nächste freie Auftragsnummer im Format VVP-00001"""
        existing_numbers = VisiViewProductionOrder.objects.filter(
            order_number__isnull=False
        ).values_list('order_number', flat=True)
        
        if not existing_numbers:
            return 'VVP-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'VVP-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'VVP-{next_number:05d}'
    
    def mark_completed(self):
        """Markiert den Auftrag als abgeschlossen"""
        self.status = 'COMPLETED'
        self.completed_at = timezone.now()
        self.save()


class VisiViewProductionOrderItem(models.Model):
    """
    Position eines VisiView Fertigungsauftrags
    Verknüpft mit CustomerOrderItem
    """
    production_order = models.ForeignKey(
        VisiViewProductionOrder,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Fertigungsauftrag'
    )
    
    customer_order_item = models.ForeignKey(
        'customer_orders.CustomerOrderItem',
        on_delete=models.PROTECT,
        related_name='visiview_production_items',
        verbose_name='Auftragsposition'
    )
    
    # Optionale Auswahl spezifischer Optionen für diese Position
    selected_options = models.ManyToManyField(
        'visiview.VisiViewOption',
        blank=True,
        related_name='production_order_items',
        verbose_name='Ausgewählte Optionen'
    )
    
    # Maintenance-Zeit in Monaten (falls Maintenance-Gutschrift)
    maintenance_months = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Maintenance-Monate'
    )
    
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    class Meta:
        verbose_name = 'VisiView Fertigungsauftrags-Position'
        verbose_name_plural = 'VisiView Fertigungsauftrags-Positionen'
    
    def __str__(self):
        return f"{self.production_order.order_number} - Position {self.id}"


class VisiViewLicenseHistory(models.Model):
    """
    Änderungsprotokoll für VisiView-Lizenzen
    Dokumentiert alle Änderungen an Lizenzen
    """
    CHANGE_TYPE_CHOICES = [
        ('CREATED', 'Lizenz erstellt'),
        ('OPTION_ADDED', 'Option hinzugefügt'),
        ('OPTION_REMOVED', 'Option entfernt'),
        ('MAINTENANCE_EXTENDED', 'Maintenance verlängert'),
        ('MAJOR_VERSION_UPDATE', 'Major Version Update'),
        ('STATUS_CHANGED', 'Status geändert'),
        ('CUSTOMER_CHANGED', 'Kunde geändert'),
        ('OTHER', 'Sonstige Änderung'),
    ]
    
    license = models.ForeignKey(
        'visiview.VisiViewLicense',
        on_delete=models.CASCADE,
        related_name='history',
        verbose_name='Lizenz'
    )
    
    change_type = models.CharField(
        max_length=30,
        choices=CHANGE_TYPE_CHOICES,
        verbose_name='Änderungstyp'
    )
    
    description = models.TextField(
        verbose_name='Beschreibung',
        help_text='Detaillierte Beschreibung der Änderung'
    )
    
    # Verknüpfung zu Fertigungsauftrag (falls anwendbar)
    production_order = models.ForeignKey(
        VisiViewProductionOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='license_changes',
        verbose_name='Fertigungsauftrag'
    )
    
    # Alte und neue Werte (JSON)
    old_value = models.TextField(
        blank=True,
        verbose_name='Alter Wert'
    )
    
    new_value = models.TextField(
        blank=True,
        verbose_name='Neuer Wert'
    )
    
    # Metadaten
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='visiview_license_changes',
        verbose_name='Geändert von'
    )
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name='Geändert am')
    
    class Meta:
        verbose_name = 'Lizenz-Änderungsprotokoll'
        verbose_name_plural = 'Lizenz-Änderungsprotokolle'
        ordering = ['-changed_at']
    
    def __str__(self):
        return f"{self.license.license_number} - {self.change_type} - {self.changed_at.strftime('%Y-%m-%d %H:%M')}"
