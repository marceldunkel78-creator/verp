from django.db import models
from django.contrib.auth import get_user_model
from core.upload_paths import dealer_upload_path

User = get_user_model()


def dealer_document_upload_path(instance, filename):
    """Generate upload path for dealer documents"""
    return dealer_upload_path(instance, filename)


class Dealer(models.Model):
    """
    Händlerstammdaten - Firmen die Angebote und Preislisten erhalten
    """
    STATUS_CHOICES = [
        ('active', 'Aktiv'),
        ('inactive', 'Inaktiv'),
    ]
    
    PAYMENT_TERMS_CHOICES = [
        ('prepayment', 'Vorkasse'),
        ('net_14', '14 Tage netto'),
        ('net_30', '30 Tage netto'),
        ('net_60', '60 Tage netto'),
        ('net_90', '90 Tage netto'),
    ]
    
    LANGUAGE_CHOICES = [
        ('DE', 'Deutsch'),
        ('EN', 'English'),
        ('FR', 'Français'),
        ('ES', 'Español'),
        ('IT', 'Italiano'),
    ]
    
    # Händlernummer im Format H-00001
    dealer_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Händlernummer',
        help_text='Automatisch generierte Händlernummer im Format H-00001'
    )
    
    # Firmeninformationen
    company_name = models.CharField(
        max_length=200,
        verbose_name='Firmenname'
    )
    
    # Adresse
    street = models.CharField(max_length=200, blank=True, verbose_name='Straße')
    house_number = models.CharField(max_length=20, blank=True, verbose_name='Hausnummer')
    address_supplement = models.CharField(max_length=200, blank=True, verbose_name='Adresszusatz')
    postal_code = models.CharField(max_length=20, blank=True, verbose_name='PLZ')
    city = models.CharField(max_length=100, blank=True, verbose_name='Stadt')
    state = models.CharField(max_length=100, blank=True, verbose_name='Bundesland/Region')
    country = models.CharField(max_length=2, default='DE', verbose_name='Land')
    
    # Status und Konditionen
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='Status'
    )
    
    dealer_discount = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Händlerrabatt (%)',
        help_text='Standard-Rabatt für diesen Händler in Prozent'
    )
    
    payment_terms = models.CharField(
        max_length=50,
        choices=PAYMENT_TERMS_CHOICES,
        default='net_30',
        verbose_name='Zahlungskonditionen'
    )
    
    # Notizen
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    # Sprache für Korrespondenz
    language = models.CharField(
        max_length=2,
        choices=LANGUAGE_CHOICES,
        default='DE',
        verbose_name='Sprache'
    )
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='dealers_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Händler'
        verbose_name_plural = 'Händler'
        ordering = ['company_name']
    
    def __str__(self):
        if self.dealer_number:
            return f"{self.dealer_number} - {self.company_name}"
        return self.company_name
    
    def save(self, *args, **kwargs):
        if not self.dealer_number:
            self.dealer_number = self._generate_dealer_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_dealer_number():
        """Generiert die nächste freie Händlernummer im Format H-XXXXX"""
        existing_numbers = Dealer.objects.filter(
            dealer_number__isnull=False
        ).values_list('dealer_number', flat=True)
        
        if not existing_numbers:
            return 'H-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'H-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'H-{next_number:05d}'


class DealerDocument(models.Model):
    """
    Dokumente für Händler (Verträge, etc.)
    """
    DOCUMENT_TYPE_CHOICES = [
        ('contract', 'Vertrag'),
        ('agreement', 'Vereinbarung'),
        ('certificate', 'Zertifikat'),
        ('other', 'Sonstiges'),
    ]
    
    dealer = models.ForeignKey(
        Dealer,
        on_delete=models.CASCADE,
        related_name='documents',
        verbose_name='Händler'
    )
    
    document_type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPE_CHOICES,
        default='other',
        verbose_name='Dokumenttyp'
    )
    
    title = models.CharField(max_length=200, verbose_name='Titel')
    file = models.FileField(
        upload_to=dealer_document_upload_path,
        verbose_name='Datei'
    )
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Hochgeladen von'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='Hochgeladen am')
    
    class Meta:
        verbose_name = 'Händler-Dokument'
        verbose_name_plural = 'Händler-Dokumente'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.dealer.company_name} - {self.title}"


class DealerEmployee(models.Model):
    """
    Mitarbeiter/Ansprechpartner eines Händlers
    """
    SALUTATION_CHOICES = [
        ('Herr', 'Herr'),
        ('Frau', 'Frau'),
        ('Mr.', 'Mr.'),
        ('Mrs.', 'Mrs.'),
        ('Ms.', 'Ms.'),
        ('Dr.', 'Dr.'),
        ('Prof.', 'Prof.'),
    ]
    
    LANGUAGE_CHOICES = [
        ('DE', 'Deutsch'),
        ('EN', 'English'),
        ('FR', 'Français'),
        ('ES', 'Español'),
        ('IT', 'Italiano'),
    ]
    
    dealer = models.ForeignKey(
        Dealer,
        on_delete=models.CASCADE,
        related_name='employees',
        verbose_name='Händler'
    )
    
    salutation = models.CharField(
        max_length=20,
        choices=SALUTATION_CHOICES,
        blank=True,
        verbose_name='Anrede'
    )
    title = models.CharField(max_length=50, blank=True, verbose_name='Titel')
    first_name = models.CharField(max_length=100, verbose_name='Vorname')
    last_name = models.CharField(max_length=100, verbose_name='Nachname')
    
    language = models.CharField(
        max_length=2,
        choices=LANGUAGE_CHOICES,
        default='DE',
        verbose_name='Sprache'
    )
    
    # Kontaktdaten
    phone = models.CharField(max_length=50, blank=True, verbose_name='Telefon')
    mobile = models.CharField(max_length=50, blank=True, verbose_name='Mobil')
    fax = models.CharField(max_length=50, blank=True, verbose_name='Fax')
    email = models.EmailField(blank=True, verbose_name='E-Mail')
    
    # Adresse (falls abweichend von Firma)
    street = models.CharField(max_length=200, blank=True, verbose_name='Straße')
    house_number = models.CharField(max_length=20, blank=True, verbose_name='Hausnummer')
    postal_code = models.CharField(max_length=20, blank=True, verbose_name='PLZ')
    city = models.CharField(max_length=100, blank=True, verbose_name='Stadt')
    country = models.CharField(max_length=2, blank=True, verbose_name='Land')
    
    is_primary = models.BooleanField(default=False, verbose_name='Hauptansprechpartner')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Händler-Mitarbeiter'
        verbose_name_plural = 'Händler-Mitarbeiter'
        ordering = ['-is_primary', 'last_name', 'first_name']
    
    def __str__(self):
        full_name = f"{self.title} {self.first_name} {self.last_name}".strip()
        return f"{full_name} ({self.dealer.company_name})"
    
    @property
    def full_name(self):
        return f"{self.title} {self.first_name} {self.last_name}".strip()


class DealerCustomerSystem(models.Model):
    """
    Systeme von Dealerkunden - Informationen über Endkunden des Händlers
    """
    dealer = models.ForeignKey(
        Dealer,
        on_delete=models.CASCADE,
        related_name='customer_systems',
        verbose_name='Händler'
    )
    
    # Endkunden-Informationen
    customer_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Kundenname',
        help_text='Name des Endkunden (falls bekannt)'
    )
    
    # Adresse des Endkunden
    customer_street = models.CharField(max_length=200, blank=True, verbose_name='Straße')
    customer_house_number = models.CharField(max_length=20, blank=True, verbose_name='Hausnummer')
    customer_postal_code = models.CharField(max_length=20, blank=True, verbose_name='PLZ')
    customer_city = models.CharField(max_length=100, blank=True, verbose_name='Stadt')
    customer_country = models.CharField(max_length=2, blank=True, default='DE', verbose_name='Land')
    
    # VisiView Lizenz
    visiview_license_id = models.CharField(
        max_length=10,
        blank=True,
        verbose_name='VisiView Lizenz-ID',
        help_text='Vierstellige VisiView Lizenz-ID (falls zutreffend)'
    )
    
    # Hardware-Beschreibung
    system_hardware = models.TextField(
        blank=True,
        verbose_name='Kundensystem-Hardware',
        help_text='Beschreibung der Hardware beim Endkunden'
    )
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Dealer-Kundensystem'
        verbose_name_plural = 'Dealer-Kundensysteme'
        ordering = ['-created_at']
    
    def __str__(self):
        if self.customer_name:
            return f"{self.dealer.company_name} - {self.customer_name}"
        return f"{self.dealer.company_name} - System #{self.id}"


class DealerCustomerSystemTicket(models.Model):
    """
    Verknüpfung von Service-Tickets mit Dealer-Kundensystemen
    """
    TICKET_TYPE_CHOICES = [
        ('service', 'Service-Ticket'),
        ('visiview', 'VisiView-Ticket'),
    ]
    
    dealer_customer_system = models.ForeignKey(
        DealerCustomerSystem,
        on_delete=models.CASCADE,
        related_name='tickets',
        verbose_name='Dealer-Kundensystem'
    )
    
    ticket_type = models.CharField(
        max_length=20,
        choices=TICKET_TYPE_CHOICES,
        default='service',
        verbose_name='Ticket-Typ'
    )
    
    # Referenz auf das echte Ticket (optional)
    service_ticket = models.ForeignKey(
        'service.ServiceTicket',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dealer_customer_system_links',
        verbose_name='Service-Ticket'
    )
    
    # Alternativ: Manuelle Ticket-Referenz
    ticket_reference = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Ticket-Referenz',
        help_text='Manuelle Ticket-Nummer falls nicht im System'
    )
    
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    
    class Meta:
        verbose_name = 'Dealer-Kundensystem-Ticket'
        verbose_name_plural = 'Dealer-Kundensystem-Tickets'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_ticket_type_display()} - {self.dealer_customer_system}"


class DealerPriceListLog(models.Model):
    """
    Protokollierung welche Preislisten an den Händler gesendet wurden
    """
    PRICELIST_TYPE_CHOICES = [
        ('vs_hardware', 'VS-Hardware Preisliste'),
        ('visiview', 'VisiView Produkte Preisliste'),
        ('combined', 'Kombinierte Preisliste'),
        ('custom', 'Individuelle Preisliste'),
    ]
    
    dealer = models.ForeignKey(
        Dealer,
        on_delete=models.CASCADE,
        related_name='pricelist_logs',
        verbose_name='Händler'
    )
    
    pricelist_type = models.CharField(
        max_length=50,
        choices=PRICELIST_TYPE_CHOICES,
        verbose_name='Preislisten-Typ'
    )
    
    sent_date = models.DateField(verbose_name='Versanddatum')
    valid_until = models.DateField(null=True, blank=True, verbose_name='Gültig bis')
    
    file = models.FileField(
        upload_to=dealer_document_upload_path,
        blank=True,
        null=True,
        verbose_name='Preislisten-Datei'
    )
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    sent_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Gesendet von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    
    class Meta:
        verbose_name = 'Preislisten-Protokoll'
        verbose_name_plural = 'Preislisten-Protokolle'
        ordering = ['-sent_date']
    
    def __str__(self):
        return f"{self.dealer.company_name} - {self.get_pricelist_type_display()} ({self.sent_date})"


class DealerQuotationLog(models.Model):
    """
    Protokollierung welche Angebote an den Händler gesendet wurden
    """
    dealer = models.ForeignKey(
        Dealer,
        on_delete=models.CASCADE,
        related_name='quotation_logs',
        verbose_name='Händler'
    )
    
    # Verknüpfung mit Angebot (optional)
    quotation = models.ForeignKey(
        'sales.Quotation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dealer_logs',
        verbose_name='Angebot'
    )
    
    quotation_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Angebotsnummer',
        help_text='Wird automatisch vom Angebot übernommen oder manuell eingegeben'
    )
    
    sent_date = models.DateField(verbose_name='Versanddatum')
    subject = models.CharField(max_length=300, blank=True, verbose_name='Betreff')
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    sent_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Gesendet von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    
    class Meta:
        verbose_name = 'Angebots-Protokoll'
        verbose_name_plural = 'Angebots-Protokolle'
        ordering = ['-sent_date']
    
    def __str__(self):
        qnum = self.quotation_number or (self.quotation.quotation_number if self.quotation else 'N/A')
        return f"{self.dealer.company_name} - Angebot {qnum} ({self.sent_date})"
    
    def save(self, *args, **kwargs):
        # Übernehme Angebotsnummer vom verknüpften Angebot
        if self.quotation and not self.quotation_number:
            self.quotation_number = self.quotation.quotation_number
        super().save(*args, **kwargs)
