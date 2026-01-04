from django.db import models
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()


class IncomingGoods(models.Model):
    """
    Wareneingang - Zwischenspeicherung gelieferter Waren vor der Einlagerung
    """
    
    ITEM_FUNCTION_CHOICES = [
        ('TRADING_GOOD', 'Handelsware'),
        ('ASSET', 'Asset'),
        ('MATERIAL', 'Material'),
    ]
    
    # Verknüpfung zur Bestellposition
    order_item = models.ForeignKey(
        'orders.OrderItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incoming_goods',
        verbose_name='Bestellposition'
    )
    
    # Artikel-Grundinformationen (aus OrderItem)
    article_number = models.CharField(
        max_length=100,
        verbose_name='Artikelnummer'
    )
    
    name = models.CharField(
        max_length=500,
        verbose_name='Produktname'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    
    # Modellbezeichnung
    model_designation = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Modellbezeichnung'
    )
    
    # Lieferinformationen
    delivered_quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Gelieferte Menge'
    )
    
    unit = models.CharField(
        max_length=50,
        default='Stück',
        verbose_name='Einheit'
    )
    
    # Einkaufspreis pro Stück
    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Einkaufspreis pro Stück'
    )
    
    currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Währung'
    )
    
    # Warenfunktion (editierbar im Wareneingang)
    item_function = models.CharField(
        max_length=20,
        choices=ITEM_FUNCTION_CHOICES,
        default='TRADING_GOOD',
        verbose_name='Warenfunktion'
    )
    
    # Warenkategorie - jetzt als ForeignKey
    product_category = models.ForeignKey(
        'verp_settings.ProductCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incoming_goods',
        verbose_name='Warenkategorie'
    )
    
    # Legacy field - wird beibehalten für Migration
    item_category = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Warenkategorie (Legacy)',
        help_text='Abhängig von Warenfunktion: z.B. Software, Mikroskope für Trading Good; Rohstoff, Hilfsstoff, Betriebsstoff für M&S'
    )
    
    # Seriennummer (nur für Handelsware und Asset, aber nicht für Material-Kategorien Rohstoff/Hilfsstoff/Betriebsstoff)
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Seriennummer',
        help_text='Für Handelsware und Asset erforderlich; nicht für Material-Kategorien'
    )
    
    # Verknüpfungen zu Original-Produkten
    trading_product = models.ForeignKey(
        'suppliers.TradingProduct',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Trading Product'
    )
    
    material_supply = models.ForeignKey(
        'suppliers.MaterialSupply',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Material Supply'
    )
    
    # Bestellinformationen (aus Order und OrderItem)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        verbose_name='Lieferant'
    )
    
    order_number = models.CharField(
        max_length=20,
        verbose_name='Bestellnummer'
    )
    
    customer_order_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Kundenauftragsnummer'
    )
    
    # Management Info (Project, Systems, etc.) - aus OrderItem
    management_info = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        verbose_name='Management Info',
        help_text='Projekt, System, etc.'
    )
    
    # Status
    is_transferred = models.BooleanField(
        default=False,
        verbose_name='Ins Lager überführt'
    )
    
    transferred_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Überführt am'
    )
    
    transferred_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transferred_incoming_goods',
        verbose_name='Überführt von'
    )
    
    # Metadaten
    received_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Empfangen am'
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='incoming_goods_created',
        verbose_name='Erstellt von'
    )
    
    class Meta:
        verbose_name = 'Wareneingang'
        verbose_name_plural = 'Wareneingänge'
        ordering = ['-received_at']
    
    def __str__(self):
        return f"{self.order_number} - {self.name} ({self.delivered_quantity} {self.unit})"


class InventoryItem(models.Model):
    """
    Warenlager - Alle im Lager befindlichen Waren
    """
    
    STATUS_CHOICES = [
        ('AUF_LAGER', 'Auf Lager'),
        ('RMA', 'RMA'),
        ('BEI_KUNDE', 'Bei Kunde'),
    ]
    
    ITEM_FUNCTION_CHOICES = [
        ('TRADING_GOOD', 'Handelsware'),
        ('ASSET', 'Asset'),
        ('MATERIAL', 'Material'),
    ]
    
    # Inventarnummer (automatisch generiert: I-00001)
    inventory_number = models.CharField(
        max_length=10,
        unique=True,
        editable=False,
        verbose_name='Inventarnummer',
        help_text='Format: I-00001'
    )
    
    # =====================
    # TAB 1: Basisinformationen
    # =====================
    
    name = models.CharField(
        max_length=500,
        verbose_name='Produktname'
    )
    
    model_designation = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Modellbezeichnung'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    
    # Lieferant
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='inventory_items',
        verbose_name='Lieferant'
    )
    
    # Artikelnummern
    article_number = models.CharField(
        max_length=100,
        verbose_name='Lieferanten-Artikelnummer'
    )
    
    visitron_part_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='VS-Artikelnummer'
    )
    
    # Warenkategorie - jetzt als ForeignKey
    product_category = models.ForeignKey(
        'verp_settings.ProductCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_items',
        verbose_name='Warenkategorie'
    )
    
    # Legacy field
    item_category = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Warenkategorie (Legacy)'
    )
    
    # Warenfunktion
    item_function = models.CharField(
        max_length=20,
        choices=ITEM_FUNCTION_CHOICES,
        verbose_name='Warenfunktion'
    )
    
    # =====================
    # TAB 2: Instanz-spezifische Infos
    # =====================
    
    # Seriennummer (nur bei einzelnen Instanzen)
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Seriennummer',
        help_text='Für einzelne Instanzen (Handelsware, Asset)'
    )
    
    # Menge (nur bei Waren ohne Seriennummer)
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
        verbose_name='Stückzahl',
        help_text='Anzahl für Waren ohne Seriennummer'
    )
    
    unit = models.CharField(
        max_length=50,
        default='Stück',
        verbose_name='Einheit'
    )
    
    # Kunde
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_items',
        verbose_name='Kunde'
    )
    
    customer_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Kundenname',
        help_text='Für manuelle Eingabe falls kein Kunde im System'
    )
    
    # Bestellinformationen
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_items',
        verbose_name='Bestellung'
    )
    
    order_number = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Bestellnummer'
    )
    
    # Kundenauftrag
    customer_order = models.ForeignKey(
        'customer_orders.CustomerOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_items',
        verbose_name='Kundenauftrag'
    )
    
    customer_order_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Kundenauftragsnummer'
    )
    
    # System
    system = models.ForeignKey(
        'systems.System',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_items',
        verbose_name='System'
    )
    
    system_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Systemnummer'
    )
    
    # Projekt
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_items',
        verbose_name='Projekt'
    )
    
    project_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Projektnummer'
    )
    
    # Firmware Info
    firmware_version = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Firmware-Version'
    )
    
    firmware_notes = models.TextField(
        blank=True,
        verbose_name='Firmware-Notizen'
    )
    
    # Management Info (Legacy JSON field - zur Abwärtskompatibilität)
    management_info = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        verbose_name='Management Info (Legacy)',
        help_text='Projekt, System, Kunde, etc.'
    )
    
    # =====================
    # TAB 3: Ausstattung/Zubehör (kategorie-spezifisch)
    # =====================
    # Wird über separate Modelle/JSON gespeichert
    equipment_data = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        verbose_name='Ausstattungsdaten',
        help_text='Kategorie-spezifische Ausstattung/Zubehör'
    )
    
    # =====================
    # TAB 4: QM - Ausgangs- und Funktionschecks
    # =====================
    # Wird über separate Modelle/JSON gespeichert
    qm_data = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        verbose_name='QM-Daten',
        help_text='Kategorie-spezifische Qualitätsprüfungen'
    )
    
    # Allgemeine Ausgangschecks für alle Waren
    outgoing_checks = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        verbose_name='Ausgangschecks',
        help_text='Allgemeine Ausgangschecks für Warenausgang'
    )
    
    # =====================
    # Preis- und Statusinformationen
    # =====================
    
    # Einkaufsinformationen
    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Einkaufspreis pro Stück'
    )
    
    currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Währung'
    )
    
    # Verknüpfungen zu Original-Produkten
    trading_product = models.ForeignKey(
        'suppliers.TradingProduct',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Trading Product'
    )
    
    material_supply = models.ForeignKey(
        'suppliers.MaterialSupply',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Material Supply'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='AUF_LAGER',
        verbose_name='Status'
    )
    
    # Notizen
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    # Metadaten
    stored_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Eingelagert am'
    )
    
    stored_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='inventory_items_stored',
        verbose_name='Eingelagert von'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    
    class Meta:
        verbose_name = 'Lagerartikel'
        verbose_name_plural = 'Lagerartikel'
        ordering = ['-stored_at']
        indexes = [
            models.Index(fields=['inventory_number']),
            models.Index(fields=['article_number']),
            models.Index(fields=['visitron_part_number']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['status']),
            models.Index(fields=['item_function']),
            models.Index(fields=['item_category']),
        ]
    
    def __str__(self):
        if self.serial_number:
            return f"{self.inventory_number} - {self.name} (SN: {self.serial_number})"
        return f"{self.inventory_number} - {self.name} ({self.quantity} {self.unit})"
    
    def save(self, *args, **kwargs):
        # Generiere Inventarnummer beim ersten Speichern
        if not self.inventory_number:
            self.inventory_number = self._generate_inventory_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_inventory_number():
        """Generiert die nächste freie Inventarnummer: I-00001"""
        existing_numbers = InventoryItem.objects.filter(
            inventory_number__startswith='I-'
        ).values_list('inventory_number', flat=True)
        
        if not existing_numbers:
            return 'I-00001'
        
        # Extrahiere Nummern und finde Maximum
        numeric_numbers = []
        for num in existing_numbers:
            try:
                # Format: I-00001 -> 00001 -> 1
                numeric_part = num.split('-')[1]
                numeric_numbers.append(int(numeric_part))
            except (IndexError, ValueError):
                continue
        
        if not numeric_numbers:
            return 'I-00001'
        
        next_number = max(numeric_numbers) + 1
        return f"I-{str(next_number).zfill(5)}"
    
    @property
    def category_name(self):
        """Gibt den Kategorienamen zurück"""
        if self.product_category:
            return self.product_category.name
        return self.item_category
    
    @property
    def total_value(self):
        """Berechnet den Gesamtwert"""
        return self.quantity * self.purchase_price


# Kategorie-spezifische Equipment-Vorlagen
EQUIPMENT_TEMPLATES = {
    'KAMERA': {
        'fields': [
            {'name': 'sensor_type', 'label': 'Sensortyp', 'type': 'text'},
            {'name': 'resolution', 'label': 'Auflösung', 'type': 'text'},
            {'name': 'cooling_type', 'label': 'Kühlung', 'type': 'select', 'options': ['Keine', 'Peltier', 'Wasser']},
            {'name': 'interface', 'label': 'Schnittstelle', 'type': 'select', 'options': ['USB3', 'CameraLink', 'GigE', 'CoaXPress']},
            {'name': 'included_cables', 'label': 'Mitgeliefertes Kabel', 'type': 'text'},
            {'name': 'included_software', 'label': 'Mitgelieferte Software', 'type': 'text'},
        ]
    },
    'CONFOCAL': {
        'fields': [
            {'name': 'disk_type', 'label': 'Disk-Typ', 'type': 'text'},
            {'name': 'pinhole_sizes', 'label': 'Pinhole-Größen', 'type': 'text'},
            {'name': 'emission_filters', 'label': 'Emissionsfilter', 'type': 'text'},
            {'name': 'dichroic_mirrors', 'label': 'Dichromatische Spiegel', 'type': 'text'},
        ]
    },
    'MIKROSKOP': {
        'fields': [
            {'name': 'microscope_type', 'label': 'Mikroskop-Typ', 'type': 'select', 'options': ['Aufrecht', 'Invers', 'Stereo']},
            {'name': 'objectives', 'label': 'Objektive', 'type': 'text'},
            {'name': 'condenser', 'label': 'Kondensor', 'type': 'text'},
            {'name': 'stage_type', 'label': 'Tischtyp', 'type': 'text'},
        ]
    },
    'LED': {
        'fields': [
            {'name': 'wavelength', 'label': 'Wellenlänge (nm)', 'type': 'text'},
            {'name': 'power_output', 'label': 'Ausgangsleistung', 'type': 'text'},
            {'name': 'controller_included', 'label': 'Controller enthalten', 'type': 'boolean'},
        ]
    },
    'LASER': {
        'fields': [
            {'name': 'wavelength', 'label': 'Wellenlänge (nm)', 'type': 'text'},
            {'name': 'power_output', 'label': 'Ausgangsleistung (mW)', 'type': 'text'},
            {'name': 'laser_class', 'label': 'Laserklasse', 'type': 'select', 'options': ['1', '2', '3R', '3B', '4']},
            {'name': 'fiber_coupled', 'label': 'Fasergekoppelt', 'type': 'boolean'},
        ]
    },
    'INKUBATION': {
        'fields': [
            {'name': 'temperature_control', 'label': 'Temperaturregelung', 'type': 'boolean'},
            {'name': 'co2_control', 'label': 'CO2-Regelung', 'type': 'boolean'},
            {'name': 'humidity_control', 'label': 'Feuchtigkeitsregelung', 'type': 'boolean'},
            {'name': 'chamber_type', 'label': 'Kammertyp', 'type': 'text'},
        ]
    },
    'SCANNINGTISCH': {
        'fields': [
            {'name': 'travel_range_x', 'label': 'Verfahrweg X (mm)', 'type': 'text'},
            {'name': 'travel_range_y', 'label': 'Verfahrweg Y (mm)', 'type': 'text'},
            {'name': 'travel_range_z', 'label': 'Verfahrweg Z (mm)', 'type': 'text'},
            {'name': 'resolution', 'label': 'Auflösung (µm)', 'type': 'text'},
            {'name': 'controller_type', 'label': 'Controller-Typ', 'type': 'text'},
        ]
    },
    'FILTER': {
        'fields': [
            {'name': 'filter_type', 'label': 'Filtertyp', 'type': 'select', 'options': ['Excitation', 'Emission', 'Dichroic', 'ND', 'Bandpass']},
            {'name': 'wavelength_range', 'label': 'Wellenlängenbereich', 'type': 'text'},
            {'name': 'diameter', 'label': 'Durchmesser (mm)', 'type': 'text'},
        ]
    },
    'FILTERRAD': {
        'fields': [
            {'name': 'positions', 'label': 'Anzahl Positionen', 'type': 'number'},
            {'name': 'filter_size', 'label': 'Filtergröße (mm)', 'type': 'text'},
            {'name': 'speed', 'label': 'Geschwindigkeit (ms)', 'type': 'text'},
            {'name': 'installed_filters', 'label': 'Installierte Filter', 'type': 'text'},
        ]
    },
    'PC': {
        'fields': [
            {'name': 'cpu', 'label': 'Prozessor', 'type': 'text'},
            {'name': 'ram', 'label': 'RAM (GB)', 'type': 'text'},
            {'name': 'gpu', 'label': 'Grafikkarte', 'type': 'text'},
            {'name': 'storage', 'label': 'Speicher', 'type': 'text'},
            {'name': 'os', 'label': 'Betriebssystem', 'type': 'text'},
        ]
    },
    'VISIVIEW': {
        'fields': [
            {'name': 'license_type', 'label': 'Lizenztyp', 'type': 'select', 'options': ['Basic', 'Advanced', 'Professional']},
            {'name': 'version', 'label': 'Version', 'type': 'text'},
            {'name': 'dongle_id', 'label': 'Dongle-ID', 'type': 'text'},
            {'name': 'modules', 'label': 'Aktivierte Module', 'type': 'text'},
        ]
    },
}

# QM-Check-Vorlagen pro Kategorie
QM_TEMPLATES = {
    'KAMERA': {
        'checks': [
            {'name': 'visual_inspection', 'label': 'Sichtprüfung', 'type': 'pass_fail'},
            {'name': 'power_on_test', 'label': 'Einschalttest', 'type': 'pass_fail'},
            {'name': 'image_quality', 'label': 'Bildqualität', 'type': 'pass_fail'},
            {'name': 'cooling_test', 'label': 'Kühlungstest', 'type': 'pass_fail'},
            {'name': 'dark_current', 'label': 'Dunkelstrom', 'type': 'measurement'},
            {'name': 'read_noise', 'label': 'Ausleserauschen', 'type': 'measurement'},
        ]
    },
    'CONFOCAL': {
        'checks': [
            {'name': 'visual_inspection', 'label': 'Sichtprüfung', 'type': 'pass_fail'},
            {'name': 'alignment_check', 'label': 'Alignment-Prüfung', 'type': 'pass_fail'},
            {'name': 'disk_rotation', 'label': 'Disk-Rotation', 'type': 'pass_fail'},
            {'name': 'image_uniformity', 'label': 'Bildgleichmäßigkeit', 'type': 'pass_fail'},
        ]
    },
    'MIKROSKOP': {
        'checks': [
            {'name': 'visual_inspection', 'label': 'Sichtprüfung', 'type': 'pass_fail'},
            {'name': 'mechanical_check', 'label': 'Mechanik-Prüfung', 'type': 'pass_fail'},
            {'name': 'optics_check', 'label': 'Optik-Prüfung', 'type': 'pass_fail'},
            {'name': 'focus_mechanism', 'label': 'Fokussiermechanismus', 'type': 'pass_fail'},
        ]
    },
    'LED': {
        'checks': [
            {'name': 'visual_inspection', 'label': 'Sichtprüfung', 'type': 'pass_fail'},
            {'name': 'power_output', 'label': 'Ausgangsleistung', 'type': 'measurement'},
            {'name': 'wavelength_check', 'label': 'Wellenlängen-Check', 'type': 'pass_fail'},
        ]
    },
    'LASER': {
        'checks': [
            {'name': 'visual_inspection', 'label': 'Sichtprüfung', 'type': 'pass_fail'},
            {'name': 'safety_interlock', 'label': 'Sicherheitsverriegelung', 'type': 'pass_fail'},
            {'name': 'power_output', 'label': 'Ausgangsleistung', 'type': 'measurement'},
            {'name': 'beam_quality', 'label': 'Strahlqualität', 'type': 'pass_fail'},
        ]
    },
    'DEFAULT': {
        'checks': [
            {'name': 'visual_inspection', 'label': 'Sichtprüfung', 'type': 'pass_fail'},
            {'name': 'functional_test', 'label': 'Funktionstest', 'type': 'pass_fail'},
            {'name': 'completeness_check', 'label': 'Vollständigkeitsprüfung', 'type': 'pass_fail'},
        ]
    },
}
