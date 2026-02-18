from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from core.upload_paths import visiview_ticket_attachment_path

User = get_user_model()


# Import production order models to make them available via visiview app
from .production_orders import (
    VisiViewProductionOrder,
    VisiViewProductionOrderItem,
    VisiViewLicenseHistory
)


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
    
    # Händlerverknüpfung (Dealer)
    dealer = models.ForeignKey(
        'dealers.Dealer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_licenses',
        verbose_name='Händler'
    )
    
    # Distributor (Legacy - Text)
    distributor_legacy = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Distributor (Import)',
        help_text='Legacy: Importierter Distributor-Name als Text'
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


class VisiViewTicket(models.Model):
    """
    VisiView Tickets - Bug-/Fehlerreports und Feature Requests für VisiView
    Basiert auf dem Redmine Ticketsystem (issues.csv)
    """
    TRACKER_CHOICES = [
        ('bug', 'Bug/Fehler'),
        ('feature', 'Feature Request'),
    ]
    
    STATUS_CHOICES = [
        ('new', 'Neu'),
        ('assigned', 'Zugewiesen'),
        ('in_progress', 'Bearbeitet'),
        ('testing', 'Testen: Extern'),
        ('tested', 'Getestet'),
        ('resolved', 'Gelöst'),
        ('closed', 'Geschlossen'),
        ('rejected', 'Abgelehnt'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Niedrig'),
        ('normal', 'Normal'),
        ('high', 'Hoch'),
        ('urgent', 'Dringend'),
        ('immediate', 'Sofort'),
    ]
    
    CATEGORY_CHOICES = [
        ('application', 'Applikation'),
        ('data_analysis', 'Datenanalyse Allgemein'),
        ('data_management', 'Datenmanagement'),
        ('deconvolution', 'Deconvolution'),
        ('hardware_camera', 'Hardware: Kamera'),
        ('hardware_microscope', 'Hardware: Mikroskop'),
        ('hardware_orbital', 'Hardware: Orbital'),
        ('hardware_tirf_frap', 'Hardware: VisiTIRF/FRAP'),
        ('hardware_other', 'Hardware: Sonstiges'),
        ('other', 'Sonstiges'),
    ]
    
    # Ticket-Nummer (vierstellig, aus Redmine importiert)
    ticket_number = models.CharField(
        max_length=10,
        unique=True,
        verbose_name='Ticket-Nummer',
        help_text='Vierstellige Ticket-Nummer (z.B. 4874)'
    )
    
    # Tracker-Typ
    tracker = models.CharField(
        max_length=20,
        choices=TRACKER_CHOICES,
        default='bug',
        verbose_name='Tracker'
    )
    
    # Übergeordnetes Ticket (für Untertickets)
    parent_ticket = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_tickets',
        verbose_name='Übergeordnetes Ticket'
    )
    
    # Basis-Informationen
    title = models.CharField(max_length=500, verbose_name='Thema')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    # Status und Priorität
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        verbose_name='Status'
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='normal',
        verbose_name='Priorität'
    )
    
    # Kategorie
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        blank=True,
        verbose_name='Kategorie'
    )
    
    # Personen
    author = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Autor',
        help_text='Name des Ticket-Erstellers'
    )
    author_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_tickets_authored',
        verbose_name='Autor (User)'
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_tickets_assigned',
        verbose_name='Zugewiesen an'
    )
    assigned_to_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Zugewiesen an (Name)',
        help_text='Importierter Name falls kein User zugeordnet'
    )
    last_changed_by = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Zuletzt geändert von'
    )
    
    # Versionen
    target_version = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Zielversion',
        help_text='z.B. VV 7.0.0.10'
    )
    affected_version = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Betroffene Version'
    )
    visiview_id = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='VisiView ID',
        help_text='z.B. VV 2040'
    )

    # Verknüpfung zu einer VisiView Lizenz (Dongle Seriennummer)
    visiview_license = models.ForeignKey(
        'VisiViewLicense',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_tickets',
        verbose_name='VisiView Lizenz',
        help_text='Verknüpfte VisiView-Lizenz (Dongle-Seriennummer)'
    )
    
    # Verknüpfung zu einem System
    linked_system = models.ForeignKey(
        'systems.System',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_tickets',
        verbose_name='Verknüpftes System'
    )
    
    # Zeitplanung
    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Beginn'
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Abgabedatum'
    )
    
    # Aufwand
    estimated_hours = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Geschätzter Aufwand (h)'
    )
    total_estimated_hours = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Summe geschätzter Aufwand (h)'
    )
    spent_hours = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Aufgewendete Zeit (h)'
    )
    
    # Fortschritt
    percent_done = models.IntegerField(
        default=0,
        verbose_name='% erledigt'
    )
    
    # Kunden
    customers = models.TextField(
        blank=True,
        verbose_name='Kunden',
        help_text='Betroffene Kunden (kommasepariert)'
    )
    
    # Dateien (als Text für importierte Daten)
    attachment_notes = models.TextField(
        blank=True,
        verbose_name='Datei-Notizen',
        help_text='Notizen zu angehängten Dateien (Altsystem)'
    )
    
    # Zugehörige Tickets
    related_tickets = models.TextField(
        blank=True,
        verbose_name='Zugehörige Tickets',
        help_text='Verknüpfte Ticket-Nummern'
    )
    
    # Flags
    is_private = models.BooleanField(
        default=False,
        verbose_name='Privat'
    )
    add_to_worklist = models.BooleanField(
        default=False,
        verbose_name='Add to Worklist'
    )
    rank = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Rank'
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Angelegt'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert'
    )
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Geschlossen am'
    )
    
    # Redmine-Synchronisation
    redmine_id = models.IntegerField(
        null=True,
        blank=True,
        unique=True,
        verbose_name='Redmine Issue ID',
        help_text='ID des Tickets im Redmine-System'
    )
    redmine_updated_on = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Redmine Aktualisiert am',
        help_text='Letzter Aktualisierungszeitpunkt in Redmine'
    )
    
    # Import-Timestamps (für CSV-Import)
    imported_created_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Angelegt (Import)'
    )
    imported_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Aktualisiert (Import)'
    )
    
    # System-Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_tickets_created',
        verbose_name='Erstellt von'
    )
    
    # Beobachter
    watchers = models.ManyToManyField(
        User,
        blank=True,
        related_name='watched_visiview_tickets',
        verbose_name='Beobachter'
    )
    
    class Meta:
        verbose_name = 'VisiView Ticket'
        verbose_name_plural = 'VisiView Tickets'
        ordering = ['-ticket_number']
    
    def __str__(self):
        return f"#{self.ticket_number} - {self.title}"
    
    @property
    def is_open(self):
        """Gibt zurück ob das Ticket offen ist"""
        return self.status not in ['resolved', 'closed', 'rejected']
    
    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = self._generate_ticket_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_ticket_number():
        """Generiert die nächste freie vierstellige Ticket-Nummer"""
        existing_numbers = VisiViewTicket.objects.filter(
            ticket_number__isnull=False
        ).values_list('ticket_number', flat=True)
        
        if not existing_numbers:
            return '1001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_numbers.append(int(num))
            except (ValueError, TypeError):
                continue
        
        if not numeric_numbers:
            return '1001'
        
        next_number = max(numeric_numbers) + 1
        return str(next_number)


class VisiViewTicketComment(models.Model):
    """
    Kommentare zu VisiView-Tickets
    """
    ticket = models.ForeignKey(
        VisiViewTicket,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Ticket'
    )
    comment = models.TextField(verbose_name='Kommentar')
    
    # Import-Feld für letzte Kommentare aus CSV
    is_imported = models.BooleanField(
        default=False,
        verbose_name='Importiert'
    )
    
    # Redmine-Synchronisation
    redmine_journal_id = models.IntegerField(
        null=True,
        blank=True,
        unique=True,
        verbose_name='Redmine Journal ID',
        help_text='ID des Journals/Kommentars im Redmine-System'
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_ticket_comments',
        verbose_name='Erstellt von'
    )
    created_by_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Erstellt von (Name)',
        help_text='Importierter Name falls kein User zugeordnet'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    
    class Meta:
        verbose_name = 'VisiView Ticket Kommentar'
        verbose_name_plural = 'VisiView Ticket Kommentare'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Kommentar zu #{self.ticket.ticket_number} von {self.created_by_name or self.created_by}"


class VisiViewTicketChangeLog(models.Model):
    """
    Änderungsprotokoll für VisiView-Tickets
    """
    ticket = models.ForeignKey(
        VisiViewTicket,
        on_delete=models.CASCADE,
        related_name='change_logs',
        verbose_name='Ticket'
    )
    field_name = models.CharField(max_length=100, verbose_name='Feld')
    old_value = models.TextField(blank=True, verbose_name='Alter Wert')
    new_value = models.TextField(blank=True, verbose_name='Neuer Wert')
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_ticket_changes',
        verbose_name='Geändert von'
    )
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name='Geändert am')
    
    class Meta:
        verbose_name = 'VisiView Ticket Änderung'
        verbose_name_plural = 'VisiView Ticket Änderungen'
        ordering = ['-changed_at']
    
    def __str__(self):
        return f"Änderung an #{self.ticket.ticket_number}: {self.field_name}"


def macro_file_upload_path(instance, filename):
    """Upload-Pfad für Macro-Dateien: VERP-Media/VisiView/Macros/{macro_id}/"""
    return f'VisiView/Macros/{instance.macro.macro_id}/{filename}'


def macro_example_upload_path(instance, filename):
    """Upload-Pfad für Macro-Beispieldaten: VERP-Media/VisiView/Macros/{macro_id}/examples/"""
    return f'VisiView/Macros/{instance.macro_id}/examples/{filename}'


class VisiViewMacro(models.Model):
    """
    VisiView Macros - Python-Code Makros für VisiView Software
    Macro-ID im Format M-00001
    """
    STATUS_CHOICES = [
        ('new', 'Neu'),
        ('released', 'Freigegeben'),
        ('deprecated', 'Veraltet'),
    ]
    
    # Macro-ID M-00001
    macro_id = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Macro-ID',
        help_text='Automatisch generiert im Format M-00001'
    )
    
    # Titel
    title = models.CharField(
        max_length=200,
        verbose_name='Titel',
        help_text='Titel des Macros'
    )
    
    # Autor
    author = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Autor'
    )
    author_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_macros_authored',
        verbose_name='Autor (User)'
    )
    
    # VisiView Version
    visiview_version = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='VisiView Version',
        help_text='z.B. VV 7.0.0.10'
    )
    
    # Beschreibung des Zwecks
    purpose = models.TextField(
        blank=True,
        verbose_name='Zweck',
        help_text='Beschreibung wofür das Macro gut ist'
    )
    
    # Anwendungsbeschreibung
    usage = models.TextField(
        blank=True,
        verbose_name='Anwendung',
        help_text='Beschreibung wie das Macro anzuwenden ist (Schritt für Schritt)'
    )
    
    # Macro Code
    code = models.TextField(
        blank=True,
        verbose_name='Macro Code',
        help_text='Python-Code des Macros'
    )
    
    # Keywords für Filterung
    keywords = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Keywords',
        help_text='Kommaseparierte Schlüsselwörter für die Suche'
    )
    
    # Kategorie/Ordner (aus Import)
    category = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Kategorie',
        help_text='Kategorie oder Ordner des Macros'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        verbose_name='Status'
    )
    
    # Abhängigkeiten zu anderen Macros
    dependencies = models.ManyToManyField(
        'self',
        blank=True,
        symmetrical=False,
        related_name='dependent_macros',
        verbose_name='Abhängigkeiten',
        help_text='Andere Macros, die für dieses Macro benötigt werden'
    )
    
    # Changelog
    changelog = models.TextField(
        blank=True,
        verbose_name='Changelog',
        help_text='Änderungshistorie des Macros'
    )
    
    # Original Dateiname (für Import)
    original_filename = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Original Dateiname'
    )
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_macros_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    
    class Meta:
        verbose_name = 'VisiView Macro'
        verbose_name_plural = 'VisiView Macros'
        ordering = ['-macro_id']
    
    def __str__(self):
        return f"{self.macro_id} - {self.title}" if self.macro_id else self.title
    
    @property
    def filename(self):
        """Generiert den Dateinamen: Macro-ID + Titel + .txt"""
        safe_title = "".join(c for c in self.title if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title.replace(' ', '_')
        return f"{self.macro_id}_{safe_title}.txt"
    
    def save(self, *args, **kwargs):
        if not self.macro_id:
            self.macro_id = self._generate_macro_id()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_macro_id():
        """Generiert die nächste freie Macro-ID im Format M-00001"""
        existing_ids = VisiViewMacro.objects.filter(
            macro_id__isnull=False
        ).values_list('macro_id', flat=True)
        
        if not existing_ids:
            return 'M-00001'
        
        numeric_ids = []
        for mid in existing_ids:
            try:
                numeric_part = int(mid.split('-')[1])
                numeric_ids.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_ids:
            return 'M-00001'
        
        next_id = max(numeric_ids) + 1
        return f'M-{next_id:05d}'
    
    def generate_download_content(self):
        """Generiert den Inhalt für den Download mit Header-Kommentaren"""
        lines = [
            "# VisiView Macro - Extension to VisiView Software package",
            "#",
            f"# Macro ID: {self.macro_id}",
            f"# Macro Name: {self.title}",
            "#",
        ]
        
        if self.purpose:
            lines.append("# Purpose:")
            for line in self.purpose.split('\n'):
                lines.append(f"#   {line}")
            lines.append("#")
        
        if self.usage:
            lines.append("# Usage:")
            for line in self.usage.split('\n'):
                lines.append(f"#   {line}")
            lines.append("#")
        
        if self.author:
            lines.append(f"# Author: {self.author}")
        
        if self.visiview_version:
            lines.append(f"# VisiView Version: {self.visiview_version}")
        
        if self.keywords:
            lines.append(f"# Keywords: {self.keywords}")
        
        if self.dependencies.exists():
            dep_ids = ', '.join([d.macro_id for d in self.dependencies.all()])
            lines.append(f"# Dependencies: {dep_ids}")
        
        lines.extend([
            "#",
            f"# Created: {self.created_at.strftime('%Y-%m-%d') if self.created_at else ''}",
            f"# Last Updated: {self.updated_at.strftime('%Y-%m-%d') if self.updated_at else ''}",
            "#",
            "# Copyright (C) Visitron Systems GmbH",
            "# All rights reserved",
            "# ------------------------------------------------------",
            "",
        ])
        
        lines.append(self.code or "")
        
        return '\n'.join(lines)


class VisiViewMacroExampleImage(models.Model):
    """
    Beispielbilder für VisiView Macros
    """
    macro = models.ForeignKey(
        VisiViewMacro,
        on_delete=models.CASCADE,
        related_name='example_images',
        verbose_name='Macro'
    )
    image = models.ImageField(
        upload_to=macro_example_upload_path,
        verbose_name='Bild'
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Beschreibung'
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Hochgeladen am'
    )
    
    class Meta:
        verbose_name = 'Macro Beispielbild'
        verbose_name_plural = 'Macro Beispielbilder'
        ordering = ['uploaded_at']
    
    def __str__(self):
        return f"Beispielbild für {self.macro.macro_id}"


class VisiViewMacroChangeLog(models.Model):
    """
    Änderungsprotokoll für VisiView-Macros
    """
    macro = models.ForeignKey(
        VisiViewMacro,
        on_delete=models.CASCADE,
        related_name='change_logs',
        verbose_name='Macro'
    )
    version = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Version'
    )
    description = models.TextField(
        verbose_name='Änderungsbeschreibung'
    )
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_macro_changes',
        verbose_name='Geändert von'
    )
    changed_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Geändert am'
    )
    
    class Meta:
        verbose_name = 'Macro Änderung'
        verbose_name_plural = 'Macro Änderungen'
        ordering = ['-changed_at']
    
    def __str__(self):
        return f"Änderung an {self.macro.macro_id}: {self.version}"


class VisiViewTicketAttachment(models.Model):
    """
    Dateianhänge für VisiView-Tickets
    """
    ticket = models.ForeignKey(
        'VisiViewTicket',
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Ticket'
    )
    file = models.FileField(
        upload_to=visiview_ticket_attachment_path,
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
        related_name='visiview_ticket_uploads',
        verbose_name='Hochgeladen von'
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Hochgeladen am'
    )
    
    class Meta:
        verbose_name = 'VisiView-Ticket Anhang'
        verbose_name_plural = 'VisiView-Ticket Anhänge'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.filename} ({self.ticket.ticket_number})"
    
    @property
    def is_image(self):
        """Prüft ob die Datei ein Bild ist"""
        if self.content_type:
            return self.content_type.startswith('image/')
        return self.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'))


class VisiViewTicketTimeEntry(models.Model):
    """
    Zeiterfassung für VisiView-Tickets
    """
    ticket = models.ForeignKey(
        'VisiViewTicket',
        on_delete=models.CASCADE,
        related_name='time_entries',
        verbose_name='Ticket'
    )
    date = models.DateField(
        verbose_name='Datum'
    )
    time = models.TimeField(
        verbose_name='Uhrzeit'
    )
    employee = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='visiview_time_entries',
        verbose_name='Mitarbeiter'
    )
    hours_spent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name='Aufgewendete Stunden'
    )
    description = models.TextField(
        verbose_name='Beschreibung'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='visiview_time_entries_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    
    class Meta:
        verbose_name = 'VisiView-Ticket Zeiteintrag'
        verbose_name_plural = 'VisiView-Ticket Zeiteinträge'
        ordering = ['-date', '-time']
    
    def __str__(self):
        return f"{self.ticket.ticket_number} - {self.date} {self.time} ({self.hours_spent}h)"


class MaintenanceTimeCredit(models.Model):
    """
    Zeitgutschriften für VisiView-Lizenzen
    Zeitgutschriften haben ein Gültigkeitszeitraum und verfallen nach dem Enddatum.
    Die Restzeitgutschrift wird sequentiell durch Zeitaufwendungen reduziert.
    """
    license = models.ForeignKey(
        'VisiViewLicense',
        on_delete=models.CASCADE,
        related_name='time_credits',
        verbose_name='Lizenz'
    )
    start_date = models.DateField(
        verbose_name='Beginn-Datum'
    )
    end_date = models.DateField(
        verbose_name='Ende-Datum'
    )
    credit_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        verbose_name='Zeitgutschrift (h)'
    )
    remaining_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        verbose_name='Rest-Zeitgutschrift (h)'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='maintenance_credits_assigned',
        verbose_name='Mitarbeiter'
    )
    # Redmine-Synchronisation
    redmine_id = models.IntegerField(
        null=True,
        blank=True,
        unique=True,
        verbose_name='Redmine Issue ID',
        help_text='ID des Zeitgutschrift-Tickets im Redmine-System'
    )
    redmine_updated_on = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Redmine Aktualisiert am'
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='maintenance_credits_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    
    class Meta:
        verbose_name = 'Wartungs-Zeitgutschrift'
        verbose_name_plural = 'Wartungs-Zeitgutschriften'
        ordering = ['start_date', 'end_date']
    
    def __str__(self):
        return f"{self.license.license_number} - {self.credit_hours}h bis {self.end_date}"
    
    def save(self, *args, **kwargs):
        # Bei Erstellung: remaining_hours = credit_hours
        if not self.pk and not self.remaining_hours:
            self.remaining_hours = self.credit_hours
        super().save(*args, **kwargs)
    
    @property
    def is_active(self):
        """Prüft ob die Zeitgutschrift noch aktiv ist (nicht abgelaufen)"""
        from datetime import date
        return self.end_date >= date.today() and self.remaining_hours > 0
    
    @property
    def is_expired(self):
        """Prüft ob die Zeitgutschrift abgelaufen ist"""
        from datetime import date
        return self.end_date < date.today()


class MaintenanceTimeExpenditure(models.Model):
    """
    Zeitaufwendungen für VisiView-Lizenzen Wartung
    Wird sequentiell von der ältesten gültigen Zeitgutschrift abgezogen.
    """
    ACTIVITY_CHOICES = [
        ('email_support', 'Email Support'),
        ('remote_support', 'Remote Support'),
        ('phone_support', 'Telefon Support'),
    ]
    
    TASK_TYPE_CHOICES = [
        ('training', 'Schulung'),
        ('testing', 'Test'),
        ('bugs', 'Bugs'),
        ('other', 'Sonstiges'),
    ]
    
    license = models.ForeignKey(
        'VisiViewLicense',
        on_delete=models.CASCADE,
        related_name='time_expenditures',
        verbose_name='Lizenz'
    )
    date = models.DateField(
        verbose_name='Datum'
    )
    time = models.TimeField(
        null=True,
        blank=True,
        verbose_name='Uhrzeit'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='maintenance_expenditures_assigned',
        verbose_name='Mitarbeiter'
    )
    activity = models.CharField(
        max_length=20,
        choices=ACTIVITY_CHOICES,
        verbose_name='Aktivität'
    )
    task_type = models.CharField(
        max_length=20,
        choices=TASK_TYPE_CHOICES,
        verbose_name='Tätigkeit'
    )
    hours_spent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name='Aufgewendete Zeit (h)'
    )
    comment = models.TextField(
        blank=True,
        verbose_name='Kommentar'
    )
    is_goodwill = models.BooleanField(
        default=False,
        verbose_name='Kulanz'
    )
    # Zeitschuld wenn keine Gutschrift verfügbar war
    created_debt = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Erzeugte Zeitschuld (h)'
    )
    # Redmine-Synchronisation
    redmine_time_entry_id = models.IntegerField(
        null=True,
        blank=True,
        unique=True,
        verbose_name='Redmine Time Entry ID',
        help_text='ID des Zeiteintrags im Redmine-System'
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='maintenance_expenditures_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    
    class Meta:
        verbose_name = 'Wartungs-Zeitaufwendung'
        verbose_name_plural = 'Wartungs-Zeitaufwendungen'
        ordering = ['-date', '-time']
    
    def __str__(self):
        return f"{self.license.license_number} - {self.date} ({self.hours_spent}h)"


class MaintenanceTimeCreditDeduction(models.Model):
    """
    Dokumentiert wie viel einer Zeitaufwendung von welcher Zeitgutschrift abgezogen wurde.
    Wird verwendet, damit beim Löschen einer Gutschrift die entsprechende Zeitschuld
    präzise den betroffenen Aufwendungen zugewiesen werden kann.
    """
    credit = models.ForeignKey(
        'MaintenanceTimeCredit',
        on_delete=models.CASCADE,
        related_name='deductions',
        verbose_name='Zeitgutschrift'
    )
    expenditure = models.ForeignKey(
        'MaintenanceTimeExpenditure',
        on_delete=models.CASCADE,
        related_name='deductions',
        verbose_name='Zeitaufwendung'
    )
    hours_deducted = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        verbose_name='Abgezogene Stunden (h)'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')

    class Meta:
        verbose_name = 'Gutschrift-Abzug'
        verbose_name_plural = 'Gutschrift-Abzüge'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.credit.license.license_number} - {self.hours_deducted}h von Gutschrift {self.credit.id} für Aufwendung {self.expenditure.id}"


class MaintenanceInvoice(models.Model):
    """
    Maintenance-Abrechnungen (PDFs) für VisiView-Lizenzen
    """
    license = models.ForeignKey(
        'VisiViewLicense',
        on_delete=models.CASCADE,
        related_name='maintenance_invoices',
        verbose_name='Lizenz'
    )
    invoice_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Rechnungsnummer',
        help_text='Optional: Interne Referenznummer'
    )
    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Zeitraum von'
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Zeitraum bis'
    )
    pdf_file = models.FileField(
        upload_to='VisiView/Lizenzen/',  # Will be enhanced with serial_number
        verbose_name='PDF-Datei'
    )
    total_credits = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=0,
        verbose_name='Zeitgutschriften (h)'
    )
    total_expenditures = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=0,
        verbose_name='Zeitaufwendungen (h)'
    )
    balance = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=0,
        verbose_name='Saldo (h)'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='maintenance_invoices_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    
    class Meta:
        verbose_name = 'Maintenance-Abrechnung'
        verbose_name_plural = 'Maintenance-Abrechnungen'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Abrechnung {self.license.license_number} ({self.created_at.strftime('%d.%m.%Y')})"


class SupportedHardware(models.Model):
    """
    Model for VisiView compatible hardware devices.
    Stores compatibility information for cameras, microscopes, light sources, and peripherals.
    """
    
    CATEGORY_CHOICES = [
        ('Camera', 'Camera'),
        ('Microscope', 'Microscope'),
        ('Hardware Autofocus', 'Hardware Autofocus'),
        ('Light source', 'Light source'),
        ('Controller', 'Controller'),
        ('Filterwheel', 'Filterwheel'),
        ('Component', 'Component'),
        ('Computer hardware', 'Computer hardware'),
        ('Accessory', 'Accessory'),
        ('Illumination', 'Illumination'),
        ('Image Splitter', 'Image Splitter'),
        ('Shutter', 'Shutter'),
        ('Spinning Disk', 'Spinning Disk'),
        ('xy-stage', 'XY-Stage'),
        ('z-drive', 'Z-Drive'),
        ('Peripherals', 'Peripherals'),
    ]
    
    SUPPORT_LEVEL_CHOICES = [
        ('Official Support', 'Official Support'),
        ('Tested by Visitron', 'Tested by Visitron'),
        ('Untested, driver provided by manufacturer', 'Untested, driver provided by manufacturer'),
        ('Basic Support', 'Basic Support'),
        ('Experimental', 'Experimental'),
        ('Third-party driver', 'Third-party driver'),
        ('Discontinued', 'Discontinued'),
    ]
    
    DATA_QUALITY_CHOICES = [
        ('Complete', 'Complete'),
        ('Verified', 'Verified'),
        ('Incomplete', 'Incomplete'),
        ('Needs review', 'Needs review'),
    ]
    
    # Common fields for all hardware types
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        verbose_name='Kategorie'
    )
    manufacturer = models.CharField(
        max_length=100,
        verbose_name='Hersteller'
    )
    device = models.CharField(
        max_length=200,
        verbose_name='Gerät'
    )
    driver_name = models.CharField(
        max_length=200,
        blank=True,
        default='',
        verbose_name='Treiber Name'
    )
    driver_version = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Treiber Version'
    )
    visiview_version = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='VisiView Version'
    )
    limitations = models.TextField(
        blank=True,
        default='',
        verbose_name='Einschränkungen'
    )
    comment = models.TextField(
        blank=True,
        default='',
        verbose_name='Kommentar'
    )
    required_visiview_option = models.CharField(
        max_length=200,
        blank=True,
        default='',
        verbose_name='Benötigte VisiView Option'
    )
    support_level = models.CharField(
        max_length=100,
        choices=SUPPORT_LEVEL_CHOICES,
        blank=True,
        default='',
        verbose_name='Support Level'
    )
    service_status = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Service Status (Hersteller)'
    )
    data_quality = models.CharField(
        max_length=50,
        choices=DATA_QUALITY_CHOICES,
        blank=True,
        default='',
        verbose_name='Datenqualität'
    )
    author = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Autor'
    )
    actualization_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Aktualisierungsdatum'
    )
    
    # Camera-specific fields
    dual_cam = models.BooleanField(
        default=False,
        verbose_name='Dual Cam'
    )
    device_streaming = models.BooleanField(
        default=False,
        verbose_name='Device Streaming'
    )
    virtex = models.BooleanField(
        default=False,
        verbose_name='Virtex'
    )
    splitview = models.BooleanField(
        default=False,
        verbose_name='Splitview'
    )
    
    # Microscope-specific fields
    xy_support = models.BooleanField(
        default=False,
        verbose_name='XY Support'
    )
    z_support = models.BooleanField(
        default=False,
        verbose_name='Z Support'
    )
    objective_support = models.BooleanField(
        default=False,
        verbose_name='Objective Support'
    )
    beam_path_support = models.BooleanField(
        default=False,
        verbose_name='Beam path Support'
    )
    light_support = models.BooleanField(
        default=False,
        verbose_name='Light Support'
    )
    
    # Light source-specific fields
    ttl_shutter = models.BooleanField(
        default=False,
        verbose_name='TTL Shutter'
    )
    sw_shutter = models.BooleanField(
        default=False,
        verbose_name='SW Shutter'
    )
    analog_intensity = models.BooleanField(
        default=False,
        verbose_name='Analog Intensity'
    )
    sw_intensity = models.BooleanField(
        default=False,
        verbose_name='SW Intensity'
    )
    
    # Audit fields
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supported_hardware_created',
        verbose_name='Erstellt von'
    )
    
    class Meta:
        verbose_name = 'Unterstützte Hardware'
        verbose_name_plural = 'Unterstützte Hardware'
        ordering = ['category', 'manufacturer', 'device']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['manufacturer']),
            models.Index(fields=['support_level']),
        ]
    
    def __str__(self):
        return f"{self.manufacturer} {self.device} ({self.category})"


class SupportedHardwareUseCase(models.Model):
    """
    Use Case für unterstützte Hardware.
    Dokumentiert reale Einsatzfälle von Hardware bei Kunden.
    """
    hardware = models.ForeignKey(
        SupportedHardware,
        on_delete=models.CASCADE,
        related_name='use_cases',
        verbose_name='Hardware'
    )
    date = models.DateField(
        verbose_name='Datum'
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hardware_use_cases',
        verbose_name='Kunde'
    )
    license = models.ForeignKey(
        VisiViewLicense,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hardware_use_cases',
        verbose_name='VisiView Lizenz'
    )
    visiview_version = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='VisiView Version'
    )
    driver_version = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Treiber Version'
    )
    device_firmware = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Geräte Firmware'
    )
    system = models.ForeignKey(
        'systems.System',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hardware_use_cases',
        verbose_name='System'
    )
    comment = models.TextField(
        blank=True,
        default='',
        verbose_name='Kommentar'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='hardware_use_cases_created',
        verbose_name='Eingetragen von'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    
    class Meta:
        verbose_name = 'Hardware Use Case'
        verbose_name_plural = 'Hardware Use Cases'
        ordering = ['-date', '-created_at']
    
    def __str__(self):
        customer_name = self.customer.name if self.customer else 'Unbekannt'
        return f"{self.hardware} - {customer_name} ({self.date})"
