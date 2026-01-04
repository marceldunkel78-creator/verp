from django.db import models
from django.contrib.auth import get_user_model
from customers.models import Customer
from core.upload_paths import system_upload_path

User = get_user_model()


def system_photo_upload_path(instance, filename):
    """Upload-Pfad: /Systems/Systemnummer/fotos/filename"""
    import re
    
    def _sanitize(name):
        if not name:
            return ''
        name = name.replace('/', '_').replace('\\', '_').replace(' ', '_')
        return re.sub(r'[^A-Za-z0-9_.-]', '_', name)
    
    system_number = _sanitize(instance.system.system_number) if instance.system else 'unknown'
    safe_filename = _sanitize(filename)
    
    return f"Systems/{system_number}/fotos/{safe_filename}"


class System(models.Model):
    """
    Kunden-Mikroskopsystem
    """
    system_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Systemnummer',
        help_text='Automatisch generiert im Format S-00001'
    )
    
    system_name = models.CharField(
        max_length=100,
        verbose_name='Systemname',
        help_text='Name des Systems (z.B. IAU-Sternname)'
    )
    
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='system_records',
        verbose_name='Kunde',
        null=True,
        blank=True
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Systembeschreibung'
    )
    
    # Status
    STATUS_CHOICES = [
        ('active', 'Aktiv'),
        ('inactive', 'Inaktiv'),
        ('maintenance', 'In Wartung'),
        ('decommissioned', 'Außer Betrieb'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='Status'
    )
    
    # Standort-Informationen
    location = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Standort',
        help_text='z.B. Labor, Raum, Gebäude'
    )
    
    installation_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Installationsdatum'
    )
    
    # Notizen
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    # VisiView Lizenz (optional)
    visiview_license = models.ForeignKey(
        'visiview.VisiViewLicense',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='associated_systems',
        verbose_name='VisiView Lizenz'
    )
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='systems_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'System'
        verbose_name_plural = 'Systeme'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.system_number} - {self.system_name}" if self.system_number else self.system_name
    
    def save(self, *args, **kwargs):
        if not self.system_number:
            self.system_number = self._generate_system_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_system_number():
        """Generiert die nächste Systemnummer im Format S-00001"""
        from django.db.models import Max
        
        last_system = System.objects.filter(
            system_number__isnull=False
        ).aggregate(Max('system_number'))
        
        last_number = last_system['system_number__max']
        
        if last_number:
            # Extrahiere die Nummer aus S-00001
            try:
                num = int(last_number.split('-')[1])
                next_num = num + 1
            except (IndexError, ValueError):
                next_num = 1
        else:
            next_num = 1
        
        return f"S-{next_num:05d}"


class SystemComponent(models.Model):
    """
    Komponente eines Systems - kann aus Warenlager oder custom sein
    """
    system = models.ForeignKey(
        System,
        on_delete=models.CASCADE,
        related_name='components',
        verbose_name='System'
    )
    
    # Position in der Komponentenliste
    position = models.PositiveIntegerField(
        default=1,
        verbose_name='Position'
    )
    
    # Verknüpfung mit Warenlager (optional)
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='system_usages',
        verbose_name='Lagerartikel'
    )
    
    # Custom Komponenten-Daten (wenn nicht aus Warenlager)
    COMPONENT_TYPE_CHOICES = [
        ('inventory', 'Aus Warenlager'),
        ('custom', 'Benutzerdefiniert'),
    ]
    component_type = models.CharField(
        max_length=20,
        choices=COMPONENT_TYPE_CHOICES,
        default='custom',
        verbose_name='Komponententyp'
    )
    
    # Komponenten-Details (für custom oder Überschreibung)
    name = models.CharField(
        max_length=200,
        verbose_name='Modell/Name'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    
    manufacturer = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Hersteller'
    )
    
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Seriennummer'
    )
    
    version = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Version/Treiber'
    )
    
    # Kategorie für bessere Organisation
    CATEGORY_CHOICES = [
        ('microscope', 'Mikroskop'),
        ('camera', 'Kamera'),
        ('objective', 'Objektiv'),
        ('stage', 'Tisch/Stage'),
        ('illumination', 'Beleuchtung'),
        ('filter', 'Filter'),
        ('controller', 'Controller'),
        ('software', 'Software'),
        ('accessory', 'Zubehör'),
        ('other', 'Sonstiges'),
    ]
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='other',
        verbose_name='Kategorie'
    )
    
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Systemkomponente'
        verbose_name_plural = 'Systemkomponenten'
        ordering = ['system', 'position']
    
    def __str__(self):
        return f"{self.system.system_number} - {self.name}"


class SystemPhoto(models.Model):
    """
    Fotos eines Systems
    """
    system = models.ForeignKey(
        System,
        on_delete=models.CASCADE,
        related_name='photos',
        verbose_name='System'
    )
    
    image = models.ImageField(
        upload_to=system_photo_upload_path,
        verbose_name='Foto'
    )
    
    title = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Titel'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    
    is_primary = models.BooleanField(
        default=False,
        verbose_name='Hauptbild'
    )
    
    position = models.PositiveIntegerField(
        default=1,
        verbose_name='Position'
    )
    
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Hochgeladen von'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Systemfoto'
        verbose_name_plural = 'Systemfotos'
        ordering = ['system', 'position']
    
    def __str__(self):
        return f"{self.system.system_number} - {self.title or 'Foto'}"
    
    def save(self, *args, **kwargs):
        # Wenn als Hauptbild markiert, andere Hauptbilder entfernen
        if self.is_primary:
            SystemPhoto.objects.filter(
                system=self.system,
                is_primary=True
            ).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)
