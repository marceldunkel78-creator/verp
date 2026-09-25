from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class DemoSystem(models.Model):
    """
    Mikroskop-Demosystem (Demo-Setup) - z.B. die beiden Demo-Mikroskope.
    """

    demo_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Demo-Nummer',
        help_text='Automatisch generiert im Format D-00001'
    )

    name = models.CharField(
        max_length=200,
        verbose_name='Name des Demo-Systems'
    )

    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )

    STATUS_CHOICES = [
        ('active', 'Aktiv'),
        ('defect', 'Defekt'),
        ('loaned', 'Verliehen'),
        ('demo_away', 'Demo außer Haus'),
        ('fair', 'Auf Messe'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='Status'
    )

    location = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Standort',
        help_text='z.B. Labor, Raum, Gebäude'
    )

    responsible_employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responsible_demo_systems',
        verbose_name='Zuständiger Mitarbeiter'
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name='Aktiv'
    )

    # Audit-Felder
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_systems_created',
        verbose_name='Erstellt von'
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_systems_updated',
        verbose_name='Aktualisiert von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')

    class Meta:
        verbose_name = 'Demo-System'
        verbose_name_plural = 'Demo-Systeme'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.demo_number} - {self.name}" if self.demo_number else self.name

    def save(self, *args, **kwargs):
        if not self.demo_number:
            self.demo_number = self._generate_demo_number()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_demo_number():
        """Generiert die nächste Demo-Nummer im Format D-00001"""
        from django.db.models import Max

        last = DemoSystem.objects.filter(
            demo_number__isnull=False
        ).aggregate(Max('demo_number'))

        last_number = last['demo_number__max']

        if last_number:
            try:
                num = int(last_number.split('-')[1])
                next_num = num + 1
            except (IndexError, ValueError):
                next_num = 1
        else:
            next_num = 1

        return f"D-{next_num:05d}"


class DemoDevice(models.Model):
    """
    Gerät/Element eines Demo-Systems (Lasersystem, Kamera, Confocal, Mikroskop,
    Beleuchtungsgerät, Scanningtisch, Inkubationskammer, PC, custom, ...).
    Wird im Setup-Diagramm als Quadrat mit 4 Andockpunkten dargestellt.
    """

    DEVICE_TYPE_CHOICES = [
        ('laser_system', 'Lasersystem'),
        ('camera', 'Kamera'),
        ('confocal', 'Confocal'),
        ('microscope', 'Mikroskop'),
        ('illumination', 'Beleuchtungsgerät'),
        ('scanning_stage', 'Scanningtisch'),
        ('incubation_chamber', 'Inkubationskammer'),
        ('virtex', 'ViRTEx'),
        ('pc', 'PC'),
        ('custom', 'Benutzerdefiniert'),
    ]

    STATUS_CHOICES = [
        ('active', 'Aktiv'),
        ('defect', 'Defekt'),
        ('loaned', 'Verliehen'),
        ('removed', 'Abgebaut'),
    ]

    demo_system = models.ForeignKey(
        DemoSystem,
        on_delete=models.CASCADE,
        related_name='devices',
        verbose_name='Demo-System'
    )

    # Verknüpfung mit Warenlager (optional) - Anzeige, keine Bestandsautomatik
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='demo_device_usages',
        verbose_name='Lagerartikel'
    )

    device_type = models.CharField(
        max_length=20,
        choices=DEVICE_TYPE_CHOICES,
        default='custom',
        verbose_name='Gerätetyp'
    )

    name = models.CharField(
        max_length=200,
        verbose_name='Bezeichnung'
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

    # Freie Grundeigenschaften (z.B. PC: OS/CPU/RAM, custom Geräte: beliebige Werte)
    properties = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Grundeigenschaften',
        help_text='Freie Eigenschaften als Schlüssel/Wert-Paare (z.B. OS, CPU, RAM bei PC)'
    )

    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='Status'
    )

    # Position im Setup-Diagramm (React-Flow-Koordinaten)
    position_x = models.FloatField(default=0, verbose_name='Position X')
    position_y = models.FloatField(default=0, verbose_name='Position Y')

    # Audit-Felder
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_devices_created',
        verbose_name='Erstellt von'
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_devices_updated',
        verbose_name='Aktualisiert von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')

    class Meta:
        verbose_name = 'Demo-Gerät'
        verbose_name_plural = 'Demo-Geräte'
        ordering = ['demo_system', 'id']

    def __str__(self):
        return f"{self.get_device_type_display()} - {self.name}"


class DemoConnection(models.Model):
    """
    Andock-Verbindung zwischen zwei Geräten im Setup-Diagramm.
    Jedes Gerät hat 4 Andockpunkte (Nord/Ost/Süd/West); pro Andockpunkt
    ist max. eine Verbindung erlaubt.
    """

    SIDE_CHOICES = [
        ('north', 'Nord'),
        ('east', 'Ost'),
        ('south', 'Süd'),
        ('west', 'West'),
    ]

    demo_system = models.ForeignKey(
        DemoSystem,
        on_delete=models.CASCADE,
        related_name='connections',
        verbose_name='Demo-System'
    )

    from_device = models.ForeignKey(
        DemoDevice,
        on_delete=models.CASCADE,
        related_name='connections_from',
        verbose_name='Von Gerät'
    )
    from_side = models.CharField(
        max_length=10,
        choices=SIDE_CHOICES,
        verbose_name='Andockpunkt (von)'
    )

    to_device = models.ForeignKey(
        DemoDevice,
        on_delete=models.CASCADE,
        related_name='connections_to',
        verbose_name='Zu Gerät'
    )
    to_side = models.CharField(
        max_length=10,
        choices=SIDE_CHOICES,
        verbose_name='Andockpunkt (zu)'
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_connections_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')

    class Meta:
        verbose_name = 'Demo-Verbindung'
        verbose_name_plural = 'Demo-Verbindungen'
        constraints = [
            models.UniqueConstraint(
                fields=['from_device', 'from_side'],
                name='unique_from_dock'
            ),
            models.UniqueConstraint(
                fields=['to_device', 'to_side'],
                name='unique_to_dock'
            ),
        ]

    def __str__(self):
        return f"{self.from_device} [{self.from_side}] -> {self.to_device} [{self.to_side}]"


class DemoDeviceComponent(models.Model):
    """
    Komponente/Ausstattungsmerkmal eines Demo-Geräts.

    Wechsler-Typen (Filterrad, Objektivwechsler, motorisierter Lichtweg,
    Einsteckkarten-Wechsler) sind Listen mit 1-10 Positionen (slots).
    Ein Gerät kann mehrere Wechsler haben. Shutter haben nur einen Namen,
    Slider (z.B. Intensitätsregler) einen Namen, custom freie Werte.
    """

    COMPONENT_TYPE_CHOICES = [
        ('filter_wheel', 'Filterrad'),
        ('objective_changer', 'Objektivwechsler'),
        ('light_path_changer', 'Lichtwegwechsler (motorisiert)'),
        ('card_changer', 'Einsteckkarten-Wechsler'),
        ('shutter', 'Shutter'),
        ('slider', 'Slider (Intensitätsregler)'),
        ('custom', 'Benutzerdefiniert'),
    ]

    # Typen, die als Positionsliste (1-10 Slots) geführt werden
    CHANGER_TYPES = ['filter_wheel', 'objective_changer', 'light_path_changer', 'card_changer']

    device = models.ForeignKey(
        DemoDevice,
        on_delete=models.CASCADE,
        related_name='components',
        verbose_name='Gerät'
    )

    component_type = models.CharField(
        max_length=20,
        choices=COMPONENT_TYPE_CHOICES,
        default='custom',
        verbose_name='Komponententyp'
    )

    name = models.CharField(
        max_length=200,
        verbose_name='Bezeichnung'
    )

    # Sortierung innerhalb des Geräts
    position = models.PositiveIntegerField(
        default=1,
        verbose_name='Position'
    )

    # Positionsliste für Wechsler-Typen:
    # {"slots": [{"position": 1, "label": "DAPI", "comment": ""}, ...]} (max. 10)
    slots = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Belegung',
        help_text='Positionsliste (1-10) für Wechsler-Typen: {"slots": [{"position": 1, "label": "...", "comment": "..."}]}'
    )

    # Freier Wert für custom-Komponenten
    value = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Wert'
    )

    comment = models.TextField(
        blank=True,
        verbose_name='Kommentar'
    )

    # Audit-Felder
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_components_created',
        verbose_name='Erstellt von'
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_components_updated',
        verbose_name='Aktualisiert von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')

    class Meta:
        verbose_name = 'Demo-Gerätekomponente'
        verbose_name_plural = 'Demo-Gerätekomponenten'
        ordering = ['device', 'position', 'id']

    def __str__(self):
        return f"{self.device} - {self.name}"

    @property
    def is_changer(self):
        return self.component_type in self.CHANGER_TYPES


class DemoChangeLog(models.Model):
    """
    Änderungsprotokoll eines Demo-Systems.
    Erfasst Setup-, Geräte-, Verbindungs-, Komponenten- und Buchungsänderungen
    mit User, Zeitpunkt, Feld, alt -> neu. Einträgen kann ein Kommentar
    nachträglich hinzugefügt werden.
    """

    ENTITY_TYPE_CHOICES = [
        ('system', 'Demo-System'),
        ('device', 'Gerät'),
        ('connection', 'Verbindung'),
        ('component', 'Komponente'),
        ('booking', 'Buchung'),
    ]

    ACTION_CHOICES = [
        ('created', 'Angelegt'),
        ('updated', 'Geändert'),
        ('deleted', 'Gelöscht'),
        ('status_changed', 'Status geändert'),
        ('connected', 'Verbunden'),
        ('disconnected', 'Getrennt'),
        ('comment', 'Kommentar'),
    ]

    demo_system = models.ForeignKey(
        DemoSystem,
        on_delete=models.CASCADE,
        related_name='change_logs',
        verbose_name='Demo-System'
    )

    entity_type = models.CharField(
        max_length=20,
        choices=ENTITY_TYPE_CHOICES,
        verbose_name='Objekttyp'
    )
    entity_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Objekt-ID'
    )
    entity_label = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Objekt',
        help_text='Lesbare Bezeichnung (bleibt auch nach Löschen des Objekts erhalten)'
    )

    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        verbose_name='Aktion'
    )

    field_name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Feld'
    )
    old_value = models.TextField(
        blank=True,
        verbose_name='Alter Wert'
    )
    new_value = models.TextField(
        blank=True,
        verbose_name='Neuer Wert'
    )

    # Nachträglich hinzufügbarer Kommentar zum Protokolleintrag
    comment = models.TextField(
        blank=True,
        verbose_name='Kommentar'
    )
    comment_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='demo_changelog_comments',
        verbose_name='Kommentiert von'
    )
    comment_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Kommentiert am'
    )

    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_changes_made',
        verbose_name='Geändert von'
    )
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name='Geändert am')

    class Meta:
        verbose_name = 'Demo-Änderungsprotokoll'
        verbose_name_plural = 'Demo-Änderungsprotokoll'
        ordering = ['-changed_at', '-id']

    def __str__(self):
        return f"{self.demo_system} - {self.get_action_display()} - {self.entity_label}"


class DemoBooking(models.Model):
    """
    Belegung/Buchung eines Demo-Systems (einfacher Belegungskalender).
    """

    demo_system = models.ForeignKey(
        DemoSystem,
        on_delete=models.CASCADE,
        related_name='bookings',
        verbose_name='Demo-System'
    )

    title = models.CharField(
        max_length=200,
        verbose_name='Zweck/Titel'
    )

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='demo_bookings',
        verbose_name='Kunde'
    )

    reserved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='demo_bookings',
        verbose_name='Gebucht von'
    )

    start_date = models.DateField(verbose_name='Beginn')
    end_date = models.DateField(verbose_name='Ende')

    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )

    is_cancelled = models.BooleanField(
        default=False,
        verbose_name='Storniert'
    )

    # Audit-Felder
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_bookings_created',
        verbose_name='Erstellt von'
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_bookings_updated',
        verbose_name='Aktualisiert von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')

    class Meta:
        verbose_name = 'Demo-Buchung'
        verbose_name_plural = 'Demo-Buchungen'
        ordering = ['start_date', 'id']

    def __str__(self):
        return f"{self.demo_system} - {self.title} ({self.start_date} - {self.end_date})"


class DemoConfigTemplate(models.Model):
    """
    Gespeicherte Konfigurationsvorlage eines Demo-Setups.
    Speichert den kompletten Snapshot (Geräte, Verbindungen, Komponenten)
    als JSON und kann auf ein Demo-System angewendet (wiederhergestellt) werden.
    """

    name = models.CharField(
        max_length=200,
        unique=True,
        verbose_name='Name der Vorlage'
    )

    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )

    is_default = models.BooleanField(
        default=False,
        verbose_name='Standard-Vorlage'
    )

    # Snapshot: {"system": {...}, "devices": [...], "connections": [...], "components": [...]}
    data = models.JSONField(
        default=dict,
        verbose_name='Konfigurationsdaten'
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_config_templates_created',
        verbose_name='Erstellt von'
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='demo_config_templates_updated',
        verbose_name='Aktualisiert von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')

    class Meta:
        verbose_name = 'Demo-Konfigurationsvorlage'
        verbose_name_plural = 'Demo-Konfigurationsvorlagen'
        ordering = ['-is_default', 'name']

    def __str__(self):
        prefix = '[Standard] ' if self.is_default else ''
        return f"{prefix}{self.name}"