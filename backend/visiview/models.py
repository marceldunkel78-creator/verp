from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()


class VisiViewProduct(models.Model):
    """
    VisiView Produkte - Software-Produkte für Angebote und Aufträge
    Artikelnummer im Format VV-00001
    """
    # Artikelnummer VV-00001
    article_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Artikelnummer',
        help_text='Automatisch generiert im Format VV-00001'
    )
    
    name = models.CharField(max_length=200, verbose_name='Produktname')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    description_en = models.TextField(
        blank=True,
        verbose_name='Beschreibung (Englisch)',
        help_text='English description for international quotations'
    )
    
    # Warenkategorie - Vorauswahl VisiView
    product_category = models.ForeignKey(
        'verp_settings.ProductCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_products',
        verbose_name='Warenkategorie'
    )
    
    # Einheit und Status
    unit = models.CharField(max_length=50, default='Stück', verbose_name='Einheit')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='visiview_products_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'VisiView Produkt'
        verbose_name_plural = 'VisiView Produkte'
        ordering = ['article_number']
    
    def __str__(self):
        return f"{self.article_number} - {self.name}" if self.article_number else self.name
    
    def save(self, *args, **kwargs):
        if not self.article_number:
            self.article_number = self._generate_article_number()
        
        # Setze Standardkategorie "VisiView" wenn keine angegeben
        if not self.product_category_id:
            self._set_default_category()
        
        super().save(*args, **kwargs)
    
    def _set_default_category(self):
        """Setzt die Standardkategorie auf 'VisiView'"""
        from verp_settings.models import ProductCategory
        try:
            visiview_category = ProductCategory.objects.filter(
                name='VisiView',
                is_active=True
            ).first()
            if visiview_category:
                self.product_category = visiview_category
        except Exception:
            pass  # Kategorie wird nicht gesetzt wenn nicht vorhanden
    
    @staticmethod
    def _generate_article_number():
        """Generiert die nächste freie Artikelnummer im Format VV-00001"""
        existing_numbers = VisiViewProduct.objects.filter(
            article_number__isnull=False
        ).values_list('article_number', flat=True)
        
        if not existing_numbers:
            return 'VV-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'VV-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'VV-{next_number:05d}'
    
    def get_current_purchase_price(self):
        """Gibt den aktuell gültigen Einkaufspreis zurück"""
        from django.utils import timezone
        today = timezone.now().date()
        price = self.prices.filter(
            valid_from__lte=today
        ).filter(
            models.Q(valid_until__isnull=True) | models.Q(valid_until__gte=today)
        ).order_by('-valid_from').first()
        return price.purchase_price if price else None
    
    def get_current_sales_price(self):
        """Gibt den aktuell gültigen Verkaufspreis (Listenpreis) zurück"""
        from django.utils import timezone
        today = timezone.now().date()
        price = self.prices.filter(
            valid_from__lte=today
        ).filter(
            models.Q(valid_until__isnull=True) | models.Q(valid_until__gte=today)
        ).order_by('-valid_from').first()
        return price.list_price if price else None


class VisiViewProductPrice(models.Model):
    """
    Preise für VisiView Produkte mit Gültigkeitszeitraum
    EK = Einkaufspreis, LP = Listenpreis (Verkaufspreis)
    """
    product = models.ForeignKey(
        VisiViewProduct,
        on_delete=models.CASCADE,
        related_name='prices',
        verbose_name='VisiView Produkt'
    )
    
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Einkaufspreis (EK)',
        help_text='Einkaufspreis in EUR'
    )
    list_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Listenpreis (LP)',
        help_text='Listenpreis für Angebote in EUR'
    )
    
    valid_from = models.DateField(verbose_name='Gültig von')
    valid_until = models.DateField(
        null=True,
        blank=True,
        verbose_name='Gültig bis',
        help_text='Leer = unbegrenzt gültig'
    )
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='visiview_prices_created'
    )
    
    class Meta:
        verbose_name = 'VisiView Preis'
        verbose_name_plural = 'VisiView Preise'
        ordering = ['product', '-valid_from']
    
    def __str__(self):
        return f"{self.product.article_number}: EK {self.purchase_price}€ / LP {self.list_price}€ ab {self.valid_from}"
    
    def clean(self):
        """Prüft auf überlappende Gültigkeitszeiträume"""
        overlapping = VisiViewProductPrice.objects.filter(product=self.product)
        
        if self.pk:
            overlapping = overlapping.exclude(pk=self.pk)
        
        for price in overlapping:
            # Beide ohne Enddatum
            if not self.valid_until and not price.valid_until:
                if self.valid_from <= price.valid_from or price.valid_from <= self.valid_from:
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    )
            # Neuer Preis ohne Enddatum
            elif not self.valid_until:
                if price.valid_until and price.valid_until >= self.valid_from:
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                    )
                if not price.valid_until and price.valid_from <= self.valid_from:
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    )
            # Bestehender Preis ohne Enddatum
            elif not price.valid_until:
                if price.valid_from <= self.valid_until:
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    )
            # Beide mit Enddatum - prüfe Überlappung
            else:
                if not (self.valid_until < price.valid_from or self.valid_from > price.valid_until):
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                    )


class VisiViewOption(models.Model):
    """
    VisiView Optionen - verfügbare Software-Optionen für Lizenzen
    Basiert auf Options.txt
    """
    bit_position = models.IntegerField(
        unique=True,
        verbose_name='Bit-Position',
        help_text='Position im Options-Bitfeld (0-63)'
    )
    name = models.CharField(max_length=100, verbose_name='Optionsname')
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Listenpreis (EUR)'
    )
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    
    class Meta:
        verbose_name = 'VisiView Option'
        verbose_name_plural = 'VisiView Optionen'
        ordering = ['bit_position']
    
    def __str__(self):
        return f"{self.bit_position}: {self.name}"


class VisiViewLicense(models.Model):
    """
    VisiView Lizenzen - Dongle-basierte Software-Lizenzen
    """
    LICENSE_STATUS_CHOICES = [
        ('active', 'Aktiv'),
        ('demo', 'Demo'),
        ('loaner', 'Leihgerät'),
        ('returned', 'Zurückgegeben'),
        ('cancelled', 'Storniert'),
        ('defect', 'Defekt'),
        ('lost', 'Verloren'),
    ]
    
    # Identifikation
    license_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Lizenznummer',
        help_text='Automatisch generiert: L-00001'
    )
    serial_number = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Seriennummer (Dongle)',
        help_text='Dongle-Seriennummer'
    )
    internal_serial = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Interne Seriennummer',
        help_text='Interne Dongle-ID (z.B. 0x7)'
    )
    
    # Kundenverknüpfung
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_licenses',
        verbose_name='Kunde'
    )
    customer_name_legacy = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Kundenname (Import)',
        help_text='Importierter Kundenname vor Verknüpfung'
    )
    customer_address_legacy = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Kundenadresse (Import)',
        help_text='Importierte Adresse vor Verknüpfung'
    )
    
    # Distributor
    distributor = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Distributor'
    )
    
    # Software-Version
    version = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Version'
    )
    
    # Optionen als Bitfeld (64-bit)
    options_bitmask = models.BigIntegerField(
        default=0,
        verbose_name='Optionen (Bitmaske)',
        help_text='Bitfeld für freigeschaltete Optionen'
    )
    options_upper_32bit = models.IntegerField(
        default=0,
        verbose_name='Optionen (Upper 32-bit)',
        help_text='Obere 32-bit für Optionen 32-63'
    )
    
    # Daten
    delivery_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Lieferdatum'
    )
    expire_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Ablaufdatum'
    )
    maintenance_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Wartung bis'
    )
    
    # Bestellung
    purchase_order = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Bestellnummer'
    )
    
    # Status-Flags
    status = models.CharField(
        max_length=20,
        choices=LICENSE_STATUS_CHOICES,
        default='active',
        verbose_name='Status'
    )
    is_demo = models.BooleanField(default=False, verbose_name='Demo')
    is_loaner = models.BooleanField(default=False, verbose_name='Leihgerät')
    is_defect = models.BooleanField(default=False, verbose_name='Defekt')
    is_returned = models.BooleanField(default=False, verbose_name='Zurückgegeben')
    is_cancelled = models.BooleanField(default=False, verbose_name='Storniert')
    is_lost = models.BooleanField(default=False, verbose_name='Verloren')
    is_outdated = models.BooleanField(default=False, verbose_name='Veraltet')
    
    return_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Rückgabedatum'
    )
    
    # Demo-Optionen
    demo_options = models.BigIntegerField(
        default=0,
        verbose_name='Demo-Optionen'
    )
    demo_options_expire_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Demo-Optionen Ablauf'
    )
    
    # Dongle-Info
    dongle_batch_id = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Dongle Batch ID'
    )
    dongle_version = models.IntegerField(
        default=1,
        verbose_name='Dongle Version'
    )
    dongle_mod_count = models.IntegerField(
        default=0,
        verbose_name='Dongle Änderungszähler'
    )
    
    # Support
    support_end = models.DateField(
        null=True,
        blank=True,
        verbose_name='Support Ende'
    )
    support_warning = models.BooleanField(
        default=False,
        verbose_name='Support-Warnung'
    )
    
    # Notizen
    info = models.TextField(blank=True, verbose_name='Info/Notizen')
    todo = models.TextField(blank=True, verbose_name='To-Do')
    
    # Legacy-Import-ID
    legacy_id = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Legacy ID',
        help_text='Original-ID aus CSV-Import'
    )
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_licenses_created',
        verbose_name='Erstellt von'
    )
    
    class Meta:
        verbose_name = 'VisiView Lizenz'
        verbose_name_plural = 'VisiView Lizenzen'
        ordering = ['-serial_number']
    
    def __str__(self):
        if self.customer:
            return f"{self.license_number} ({self.serial_number}) - {self.customer}"
        return f"{self.license_number} ({self.serial_number}) - {self.customer_name_legacy}"
    
    def save(self, *args, **kwargs):
        if not self.license_number:
            self.license_number = self._generate_license_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_license_number():
        """Generiert die nächste freie Lizenznummer im Format L-00001"""
        existing_numbers = VisiViewLicense.objects.filter(
            license_number__isnull=False
        ).values_list('license_number', flat=True)
        
        if not existing_numbers:
            return 'L-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'L-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'L-{next_number:05d}'
    
    def get_active_options(self):
        """Gibt eine Liste der aktiven Optionen zurück"""
        options = []
        # Lower 32-bit
        for i in range(32):
            if self.options_bitmask & (1 << i):
                try:
                    option = VisiViewOption.objects.get(bit_position=i)
                    options.append(option)
                except VisiViewOption.DoesNotExist:
                    pass
        # Upper 32-bit
        for i in range(32):
            if self.options_upper_32bit & (1 << i):
                try:
                    option = VisiViewOption.objects.get(bit_position=i + 32)
                    options.append(option)
                except VisiViewOption.DoesNotExist:
                    pass
        return options
    
    def has_option(self, bit_position):
        """Prüft ob eine bestimmte Option aktiv ist"""
        if bit_position < 32:
            return bool(self.options_bitmask & (1 << bit_position))
        else:
            return bool(self.options_upper_32bit & (1 << (bit_position - 32)))
    
    def set_option(self, bit_position, enabled=True):
        """Aktiviert oder deaktiviert eine Option"""
        if bit_position < 32:
            if enabled:
                self.options_bitmask |= (1 << bit_position)
            else:
                self.options_bitmask &= ~(1 << bit_position)
        else:
            if enabled:
                self.options_upper_32bit |= (1 << (bit_position - 32))
            else:
                self.options_upper_32bit &= ~(1 << (bit_position - 32))
