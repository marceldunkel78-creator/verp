from django.db import models
from django.core.validators import EmailValidator


class CompanySettings(models.Model):
    """
    Allgemeine Firmendaten - Singleton Pattern (nur ein Datensatz)
    """
    company_name = models.CharField(max_length=255, verbose_name='Firmenname')
    
    # E-Mail Adressen
    email_orders = models.EmailField(verbose_name='E-Mail für Kundenbestellungen', blank=True)
    email_general = models.EmailField(verbose_name='E-Mail für allgemeine Anfragen', blank=True)
    email_service = models.EmailField(verbose_name='E-Mail für Service', blank=True)
    email_sales = models.EmailField(verbose_name='E-Mail für Vertrieb', blank=True)
    
    # Telefon zentral
    phone_central = models.CharField(max_length=50, verbose_name='Zentrale Telefonnummer', blank=True)
    
    # Website
    website = models.URLField(max_length=500, verbose_name='Firmenwebsite', blank=True)
    
    # Registrierungen
    trade_register_number = models.CharField(
        max_length=100,
        verbose_name='Handelsregisternummer',
        blank=True
    )
    professional_association = models.CharField(
        max_length=200,
        verbose_name='Berufsgenossenschaft',
        blank=True
    )
    vat_id = models.CharField(
        max_length=50,
        verbose_name='Umsatzsteuer-ID',
        blank=True,
        help_text='z.B. DE123456789'
    )
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Firmeneinstellungen'
        verbose_name_plural = 'Firmeneinstellungen'
    
    def __str__(self):
        return self.company_name or 'Firmeneinstellungen'
    
    def save(self, *args, **kwargs):
        # Singleton Pattern: Nur ein Datensatz erlaubt
        self.pk = 1
        super().save(*args, **kwargs)
    
    @classmethod
    def load(cls):
        """Lade oder erstelle die Firmeneinstellungen"""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class CompanyAddress(models.Model):
    """
    Firmenadressen (z.B. Hauptsitz, Niederlassungen, etc.)
    """
    company_settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='addresses',
        verbose_name='Firmeneinstellungen'
    )
    address_type = models.CharField(
        max_length=50,
        verbose_name='Adresstyp',
        help_text='z.B. Hauptsitz, Niederlassung, Lager'
    )
    street = models.CharField(max_length=200, verbose_name='Straße')
    house_number = models.CharField(max_length=20, verbose_name='Hausnummer')
    address_supplement = models.CharField(
        max_length=200,
        verbose_name='Adresszusatz',
        blank=True
    )
    postal_code = models.CharField(max_length=20, verbose_name='Postleitzahl')
    city = models.CharField(max_length=100, verbose_name='Stadt')
    state = models.CharField(max_length=100, verbose_name='Bundesland/Staat', blank=True)
    country = models.CharField(max_length=2, default='DE', verbose_name='Land (ISO-Code)')
    
    is_primary = models.BooleanField(default=False, verbose_name='Hauptadresse')
    
    class Meta:
        verbose_name = 'Firmenadresse'
        verbose_name_plural = 'Firmenadressen'
        ordering = ['-is_primary', 'address_type']
    
    def __str__(self):
        return f"{self.address_type}: {self.street} {self.house_number}, {self.postal_code} {self.city}"


class CompanyManager(models.Model):
    """
    Geschäftsführer der Firma
    """
    company_settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='managers',
        verbose_name='Firmeneinstellungen'
    )
    first_name = models.CharField(max_length=100, verbose_name='Vorname')
    last_name = models.CharField(max_length=100, verbose_name='Nachname')
    title = models.CharField(
        max_length=50,
        verbose_name='Titel',
        blank=True,
        help_text='z.B. Dr., Prof.'
    )
    position = models.CharField(
        max_length=100,
        verbose_name='Position',
        default='Geschäftsführer'
    )
    email = models.EmailField(verbose_name='E-Mail', blank=True)
    phone = models.CharField(max_length=50, verbose_name='Telefon', blank=True)
    
    class Meta:
        verbose_name = 'Geschäftsführer'
        verbose_name_plural = 'Geschäftsführer'
        ordering = ['last_name', 'first_name']
    
    def __str__(self):
        name_parts = []
        if self.title:
            name_parts.append(self.title)
        name_parts.extend([self.first_name, self.last_name])
        return ' '.join(name_parts)


class CompanyBankAccount(models.Model):
    """
    Bankverbindungen der Firma
    """
    company_settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='bank_accounts',
        verbose_name='Firmeneinstellungen'
    )
    bank_name = models.CharField(max_length=200, verbose_name='Bankname')
    account_holder = models.CharField(
        max_length=200,
        verbose_name='Kontoinhaber',
        blank=True
    )
    iban = models.CharField(max_length=34, verbose_name='IBAN')
    bic = models.CharField(max_length=11, verbose_name='BIC/SWIFT', blank=True)
    currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Währung'
    )
    is_primary = models.BooleanField(default=False, verbose_name='Hauptkonto')
    notes = models.TextField(verbose_name='Notizen', blank=True)
    
    class Meta:
        verbose_name = 'Bankverbindung'
        verbose_name_plural = 'Bankverbindungen'
        ordering = ['-is_primary', 'bank_name']
    
    def __str__(self):
        return f"{self.bank_name} - {self.iban}"


class ExchangeRate(models.Model):
    """
    Wechselkurse für verschiedene Währungen
    """
    currency = models.CharField(
        max_length=3,
        unique=True,
        verbose_name='Währung',
        help_text='ISO Währungscode (USD, CHF, GBP, etc.)'
    )
    rate_to_eur = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        verbose_name='Kurs zu EUR',
        help_text='1 Einheit dieser Währung = X EUR'
    )
    last_updated = models.DateTimeField(
        auto_now=True,
        verbose_name='Zuletzt aktualisiert'
    )
    
    class Meta:
        verbose_name = 'Wechselkurs'
        verbose_name_plural = 'Wechselkurse'
        ordering = ['currency']
    
    def __str__(self):
        return f"{self.currency}: {self.rate_to_eur} EUR"


class PaymentTerm(models.Model):
    """
    Zahlungsbedingungen für Lieferanten
    """
    name = models.CharField(
        max_length=200,
        unique=True,
        verbose_name='Bezeichnung',
        help_text='z.B. "30 Tage netto", "Vorkasse", "Anzahlung 30% + Rest bei Lieferung"'
    )
    
    # Standard-Zahlungsfrist
    is_prepayment = models.BooleanField(
        default=False,
        verbose_name='Vorkasse',
        help_text='Zahlung vor Lieferung'
    )
    
    payment_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Zahlungsfrist in Tagen',
        help_text='Tage ab Rechnungsdatum'
    )
    
    # Skonto-Optionen
    discount_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Skonto-Frist in Tagen',
        help_text='Zahlungsfrist für Skonto'
    )
    
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Skonto %',
        help_text='z.B. 2.00 für 2% Skonto'
    )
    
    # Custom Zahlungsziele (bis zu 3 Teile)
    has_custom_terms = models.BooleanField(
        default=False,
        verbose_name='Custom Zahlungsziele',
        help_text='Aktiviert benutzerdefinierte Zahlungsziele'
    )
    
    # Teil 1: Anzahlung
    down_payment_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Anzahlung %',
        help_text='z.B. 30.00 für 30% Anzahlung'
    )
    
    down_payment_description = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Anzahlung Beschreibung',
        help_text='z.B. "Bei Auftragserteilung"'
    )
    
    # Teil 2: Zahlung bei Lieferung
    delivery_payment_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Zahlung bei Lieferung %',
        help_text='z.B. 50.00 für 50% bei Lieferung'
    )
    
    delivery_payment_description = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Lieferung Beschreibung',
        help_text='z.B. "Bei Lieferung"'
    )
    
    # Teil 3: Zahlung bei Abnahme
    acceptance_payment_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Zahlung bei Abnahme %',
        help_text='z.B. 20.00 für 20% bei Abnahme'
    )
    
    acceptance_payment_description = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Abnahme Beschreibung',
        help_text='z.B. "30 Tage nach Abnahme"'
    )
    
    # Freitextfeld für zusätzliche Informationen
    notes = models.TextField(
        blank=True,
        verbose_name='Zusätzliche Informationen'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Zahlungsbedingung'
        verbose_name_plural = 'Zahlungsbedingungen'
        ordering = ['name']
    
    def __str__(self):
        return self.name
    
    def get_formatted_terms(self):
        """Formatiert die Zahlungsbedingungen als Text"""
        parts = []
        
        if self.is_prepayment:
            parts.append("Vorkasse")
        
        if self.has_custom_terms:
            if self.down_payment_percent:
                parts.append(f"{self.down_payment_percent}% {self.down_payment_description or 'Anzahlung'}")
            if self.delivery_payment_percent:
                parts.append(f"{self.delivery_payment_percent}% {self.delivery_payment_description or 'bei Lieferung'}")
            if self.acceptance_payment_percent:
                parts.append(f"{self.acceptance_payment_percent}% {self.acceptance_payment_description or 'bei Abnahme'}")
        else:
            if self.payment_days:
                parts.append(f"{self.payment_days} Tage netto")
            if self.discount_days and self.discount_percent:
                parts.append(f"{self.discount_days} Tage {self.discount_percent}% Skonto")
        
        return " | ".join(parts) if parts else self.name


class DeliveryTerm(models.Model):
    """
    Lieferbedingungen (Incoterms 2020)
    """
    INCOTERM_CHOICES = [
        ('EXW', 'EXW - Ex Works (ab Werk)'),
        ('FCA', 'FCA - Free Carrier (frei Frachtführer)'),
        ('CPT', 'CPT - Carriage Paid To (frachtfrei)'),
        ('CIP', 'CIP - Carriage and Insurance Paid To (frachtfrei versichert)'),
        ('DAP', 'DAP - Delivered at Place (geliefert benannter Ort)'),
        ('DPU', 'DPU - Delivered at Place Unloaded (geliefert entladen)'),
        ('DDP', 'DDP - Delivered Duty Paid (geliefert verzollt)'),
        ('FAS', 'FAS - Free Alongside Ship (frei Längsseite Schiff)'),
        ('FOB', 'FOB - Free On Board (frei an Bord)'),
        ('CFR', 'CFR - Cost and Freight (Kosten und Fracht)'),
        ('CIF', 'CIF - Cost, Insurance and Freight (Kosten, Versicherung und Fracht)'),
    ]
    
    incoterm = models.CharField(
        max_length=3,
        choices=INCOTERM_CHOICES,
        unique=True,
        verbose_name='Incoterm 2020'
    )
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='Aktiviert',
        help_text='Für Lieferantenauswahl verfügbar'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung',
        help_text='Zusätzliche Erklärung oder Hinweise'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Lieferbedingung (Incoterm)'
        verbose_name_plural = 'Lieferbedingungen (Incoterms)'
        ordering = ['incoterm']
    
    def __str__(self):
        return self.get_incoterm_display()


class DeliveryInstruction(models.Model):
    """
    Lieferanweisungen (freie Texte)
    """
    name = models.CharField(
        max_length=200,
        unique=True,
        verbose_name='Bezeichnung',
        help_text='z.B. "Standard Lieferung", "Express", "Nur Mo-Fr 8-16 Uhr"'
    )
    
    instruction_text = models.TextField(
        verbose_name='Anweisungstext',
        help_text='Detaillierte Lieferanweisungen für den Lieferanten'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Lieferanweisung'
        verbose_name_plural = 'Lieferanweisungen'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class ProductCategory(models.Model):
    """
    Globale Warenkategorien für alle Produkttypen
    (Trading Goods, M&S, VS-Hardware, VS-Software, VS-Service)
    """
    PRODUCT_CATEGORY_CHOICES = [
        ('KAMERA', 'Kamera'),
        ('CONFOCAL', 'Confocal'),
        ('VIRTEX', 'ViRTEx'),
        ('FRAP', 'FRAP'),
        ('ORBITAL', 'Orbital'),
        ('VS_LMS', 'VS-LMS'),
        ('INKUBATION', 'Inkubation'),
        ('SCANNINGTISCH', 'Scanningtisch'),
        ('LED', 'LED'),
        ('LASER', 'Laser'),
        ('VISIVIEW', 'VisiView'),
        ('DUALCAM_SPLITTER', 'DualCam/Splitter'),
        ('FILTER', 'Filter'),
        ('FILTERRAD', 'Filterrad'),
        ('MIKROSKOP', 'Mikroskop'),
        ('PC', 'PC'),
        ('KABEL', 'Kabel'),
        ('ROHSTOFF', 'Rohstoff'),
        ('HILFSSTOFF', 'Hilfsstoff'),
        ('BETRIEBSSTOFF', 'Betriebsstoff'),
        ('SOFTWARE', 'Software'),
        ('SERVICE', 'Service'),
        ('DIENSTLEISTUNG', 'Dienstleistung'),
        ('SONSTIGES', 'Sonstiges'),
    ]
    
    code = models.CharField(
        max_length=30,
        unique=True,
        choices=PRODUCT_CATEGORY_CHOICES,
        verbose_name='Kategorie-Code'
    )
    
    name = models.CharField(
        max_length=100,
        verbose_name='Kategoriename'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    
    # Für welche Produkttypen gilt diese Kategorie?
    applies_to_trading_goods = models.BooleanField(
        default=True,
        verbose_name='Für Handelswaren'
    )
    
    applies_to_material_supplies = models.BooleanField(
        default=True,
        verbose_name='Für M&S'
    )
    
    applies_to_vs_hardware = models.BooleanField(
        default=True,
        verbose_name='Für VS-Hardware'
    )
    
    applies_to_vs_software = models.BooleanField(
        default=False,
        verbose_name='Für VS-Software'
    )
    
    applies_to_vs_service = models.BooleanField(
        default=False,
        verbose_name='Für VS-Service'
    )
    
    # Ob diese Kategorie Seriennummern benötigt
    requires_serial_number = models.BooleanField(
        default=True,
        verbose_name='Seriennummer erforderlich',
        help_text='Ob Waren dieser Kategorie eine Seriennummer benötigen'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    sort_order = models.PositiveIntegerField(default=0, verbose_name='Sortierung')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Warenkategorie'
        verbose_name_plural = 'Warenkategorien'
        ordering = ['sort_order', 'name']
    
    def __str__(self):
        return self.name
    
    @classmethod
    def get_trading_goods_categories(cls):
        """Gibt alle für Handelswaren gültigen Kategorien zurück"""
        return cls.objects.filter(applies_to_trading_goods=True, is_active=True)
    
    @classmethod
    def get_material_supplies_categories(cls):
        """Gibt alle für M&S gültigen Kategorien zurück"""
        return cls.objects.filter(applies_to_material_supplies=True, is_active=True)
    
    @classmethod
    def get_vs_hardware_categories(cls):
        """Gibt alle für VS-Hardware gültigen Kategorien zurück"""
        return cls.objects.filter(applies_to_vs_hardware=True, is_active=True)
    
    @classmethod
    def initialize_defaults(cls):
        """Erstellt alle Standard-Kategorien"""
        defaults = [
            # Hardware-Kategorien
            ('KAMERA', 'Kamera', True, True, True, False, False, True),
            ('CONFOCAL', 'Confocal', True, True, True, False, False, True),
            ('VIRTEX', 'ViRTEx', True, True, True, False, False, True),
            ('FRAP', 'FRAP', True, True, True, False, False, True),
            ('ORBITAL', 'Orbital', True, True, True, False, False, True),
            ('VS_LMS', 'VS-LMS', True, True, True, False, False, True),
            ('INKUBATION', 'Inkubation', True, True, True, False, False, True),
            ('SCANNINGTISCH', 'Scanningtisch', True, True, True, False, False, True),
            ('LED', 'LED', True, True, True, False, False, True),
            ('LASER', 'Laser', True, True, True, False, False, True),
            ('VISIVIEW', 'VisiView', True, True, True, False, False, True),
            ('DUALCAM_SPLITTER', 'DualCam/Splitter', True, True, True, False, False, True),
            ('FILTER', 'Filter', True, True, True, False, False, False),
            ('FILTERRAD', 'Filterrad', True, True, True, False, False, True),
            ('MIKROSKOP', 'Mikroskop', True, True, True, False, False, True),
            ('PC', 'PC', True, True, True, False, False, True),
            ('KABEL', 'Kabel', True, True, True, False, False, False),
            # Material-Kategorien (keine Seriennummer)
            ('ROHSTOFF', 'Rohstoff', False, True, False, False, False, False),
            ('HILFSSTOFF', 'Hilfsstoff', False, True, False, False, False, False),
            ('BETRIEBSSTOFF', 'Betriebsstoff', False, True, False, False, False, False),
            # Software & Service
            ('SOFTWARE', 'Software', False, False, False, True, False, False),
            ('SERVICE', 'Service', False, False, False, False, True, False),
            ('SONSTIGES', 'Sonstiges', True, True, True, True, True, False),
        ]
        
        created = 0
        for i, (code, name, trading, ms, hw, sw, svc, serial) in enumerate(defaults):
            obj, was_created = cls.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'applies_to_trading_goods': trading,
                    'applies_to_material_supplies': ms,
                    'applies_to_vs_hardware': hw,
                    'applies_to_vs_software': sw,
                    'applies_to_vs_service': svc,
                    'requires_serial_number': serial,
                    'sort_order': i * 10,
                    'is_active': True
                }
            )
            if was_created:
                created += 1
        
        return created


class WarrantyTerm(models.Model):
    """
    Garantiebedingungen für Kundenaufträge
    """
    name = models.CharField(
        max_length=200,
        unique=True,
        verbose_name='Bezeichnung',
        help_text='z.B. "12 Monate Garantie", "24 Monate auf Teile"'
    )
    
    name_en = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Bezeichnung (EN)',
        help_text='Englische Bezeichnung für internationale Dokumente'
    )
    
    duration_months = models.PositiveIntegerField(
        default=12,
        verbose_name='Garantiedauer (Monate)'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung',
        help_text='Detaillierte Garantiebedingungen'
    )
    
    description_en = models.TextField(
        blank=True,
        verbose_name='Beschreibung (EN)',
        help_text='Englische Beschreibung'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    is_default = models.BooleanField(default=False, verbose_name='Standard')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Garantiebedingung'
        verbose_name_plural = 'Garantiebedingungen'
        ordering = ['duration_months', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.duration_months} Monate)"
    
    def save(self, *args, **kwargs):
        # Wenn als Standard markiert, alle anderen zurücksetzen
        if self.is_default:
            WarrantyTerm.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
