from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from core.upload_paths import quotation_upload_path, marketing_upload_path, sales_ticket_attachment_path

User = get_user_model()


# Wrapper für Migrations-Kompatibilität
def quotation_document_upload_path(instance, filename):
    """Generate upload path with quotation number prefix"""
    return quotation_upload_path(instance, filename)


class Quotation(models.Model):
    """
    Angebote für Kunden mit Waren und Assets
    """
    STATUS_CHOICES = [
        ('DRAFT', 'In Arbeit'),
        ('SENT', 'Verschickt'),
        ('ACTIVE', 'Aktiv'),
        ('EXPIRED', 'Abgelaufen'),
        ('ORDERED', 'Bestellt'),
    ]
    
    LANGUAGE_CHOICES = [
        ('DE', 'Deutsch'),
        ('EN', 'English'),
    ]
    
    # Grundinformationen
    quotation_number = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Angebotsnummer',
        help_text='Automatisch generiert'
    )
    
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='quotations',
        verbose_name='Kunde'
    )
    
    # Optional: Projekt und System (nur verwaltungstechnisch)
    project_reference = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Projekt-Referenz',
        help_text='Interne Projekt-Zuordnung (erscheint nicht im Angebot)'
    )
    
    system_reference = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='System-Referenz',
        help_text='Interne System-Zuordnung (erscheint nicht im Angebot)'
    )
    
    # Angebots-Details
    reference = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Angebotsreferenz',
        help_text='Erscheint im Angebot'
    )
    
    date = models.DateField(
        default=None,
        blank=True,
        null=True,
        verbose_name='Angebotsdatum'
    )
    
    valid_until = models.DateField(
        verbose_name='Gültig bis'
    )
    
    delivery_time_weeks = models.PositiveIntegerField(
        default=0,
        verbose_name='Lieferzeit (Wochen)'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        verbose_name='Status'
    )
    
    language = models.CharField(
        max_length=2,
        choices=LANGUAGE_CHOICES,
        default='DE',
        verbose_name='Sprache'
    )
    
    # Konditionen (wie bei Orders)
    payment_term = models.ForeignKey(
        'verp_settings.PaymentTerm',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotations',
        verbose_name='Zahlungsbedingung'
    )
    
    delivery_term = models.ForeignKey(
        'verp_settings.DeliveryTerm',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotations',
        verbose_name='Lieferbedingung (Incoterm)'
    )
    
    # AGB-Hinweis
    show_terms_conditions = models.BooleanField(
        default=True,
        verbose_name='AGB-Hinweis anzeigen'
    )
    
    # Gruppen-Artikel Preise anzeigen
    show_group_item_prices = models.BooleanField(
        default=False,
        verbose_name='Preise von Gruppen-Artikeln anzeigen',
        help_text='Wenn aktiviert, werden die Preise der einzelnen Artikel in Warensammlungen angezeigt'
    )
    
    # Empfängeradresse (editierbar, nicht zwingend Kundenadresse)
    recipient_salutation = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Empfänger Anrede',
        help_text='Anrede des Empfängers (z.B. Herr, Frau)'
    )
    recipient_title = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Empfänger Titel',
        help_text='Titel des Empfängers (z.B. Dr., Prof.)'
    )
    recipient_company = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Empfänger Firma'
    )
    recipient_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Empfänger Name'
    )
    recipient_street = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Straße'
    )
    recipient_postal_code = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='PLZ'
    )
    recipient_city = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Ort'
    )
    recipient_country = models.CharField(
        max_length=2,
        blank=True,
        default='DE',
        verbose_name='Land'
    )
    
    # Systempreis für Angebot
    system_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Systempreis',
        help_text='Systempreis für Positionen die auf Systempreis gesetzt sind'
    )
    
    # Lieferkosten
    delivery_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Lieferkosten',
        help_text='Lieferkosten werden zur Nettosumme addiert vor MwSt-Berechnung'
    )
    
    # Globale MwSt-Einstellung
    tax_enabled = models.BooleanField(
        default=True,
        verbose_name='MwSt aktiviert',
        help_text='MwSt auf alle Positionen anwenden'
    )
    
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=19,
        verbose_name='MwSt-Satz (%)',
        help_text='Globaler MwSt-Satz für das Angebot'
    )
    
    # Angebotsbeschreibung (erscheint über Positionen im PDF)
    description_text = models.TextField(
        blank=True,
        verbose_name='Angebotsbeschreibung',
        help_text='Einleitender Text der über den Positionen erscheint'
    )
    
    # Fußtext (erscheint unter den Konditionen im PDF)
    footer_text = models.TextField(
        blank=True,
        verbose_name='Fußtext',
        help_text='Text der unter den Konditionen im PDF erscheint'
    )
    
    # PDF Datei (nach Erstellung)
    pdf_file = models.FileField(
        upload_to=quotation_upload_path,
        blank=True,
        null=True,
        verbose_name='PDF Datei',
        help_text='Gespeichertes PDF des Angebots'
    )
    
    # Notizen (intern)
    notes = models.TextField(
        blank=True,
        verbose_name='Interne Notizen'
    )
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='quotations_created',
        verbose_name='Erstellt von'
    )
    
    commission_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotations_commission',
        verbose_name='Provisionsempfänger',
        help_text='Mitarbeiter der die Provision erhält'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Angebot'
        verbose_name_plural = 'Angebote'
        ordering = ['-date', '-quotation_number']
    
    def __str__(self):
        return f"{self.quotation_number} - {self.customer}"
    
    def save(self, *args, **kwargs):
        if not self.quotation_number:
            self.quotation_number = self._generate_quotation_number()
        # Auto-set date if not provided
        if not self.date:
            import datetime
            self.date = datetime.date.today()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_quotation_number():
        """Generiert die nächste Angebotsnummer im Format Q-YEAR-XXXX"""
        import datetime
        year = datetime.datetime.now().year
        
        # Finde die höchste Nummer für dieses Jahr
        prefix = f'Q-{year}-'
        existing_numbers = Quotation.objects.filter(
            quotation_number__startswith=prefix
        ).values_list('quotation_number', flat=True)
        
        if not existing_numbers:
            return f'{prefix}0001'
        
        # Extrahiere Nummern und finde Maximum
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[2])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return f'{prefix}0001'
        
        next_number = max(numeric_numbers) + 1
        return f'{prefix}{next_number:04d}'


class QuotationItem(models.Model):
    """
    Positionen eines Angebots (können TradingProducts oder Assets sein)
    Unterstützt Warensammlungen und Systempreise
    """
    DESCRIPTION_TYPE_CHOICES = [
        ('SHORT', 'Kurzbeschreibung'),
        ('LONG', 'Langbeschreibung'),
    ]
    
    quotation = models.ForeignKey(
        Quotation,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Angebot'
    )
    
    # Warensammlungen-Support
    group_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='Gruppen-ID',
        help_text='Für Warensammlungen - alle Items mit gleicher group_id gehören zusammen'
    )
    
    group_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Gruppenname',
        help_text='Name der Warensammlung (nur für Gruppen-Header)'
    )
    
    is_group_header = models.BooleanField(
        default=False,
        verbose_name='Ist Gruppen-Header',
        help_text='True wenn dies die Haupt-Position einer Warensammlung ist'
    )
    
    # Generic Foreign Key für TradingProduct, VisiView oder VS-Hardware (optional für Gruppen-Header)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        limit_choices_to=models.Q(app_label='suppliers', model='tradingproduct') | 
                         models.Q(app_label='visiview', model='visiviewproduct') |
                         models.Q(app_label='manufacturing', model='vshardware'),
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    item = GenericForeignKey('content_type', 'object_id')
    
    # Position und Beschreibungstyp
    position = models.PositiveIntegerField(
        default=1,
        verbose_name='Position'
    )
    
    description_type = models.CharField(
        max_length=10,
        choices=DESCRIPTION_TYPE_CHOICES,
        default='SHORT',
        verbose_name='Beschreibungstyp'
    )
    
    # Visitron Artikelnummer (für Warensammlungen automatisch generiert)
    item_article_number = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Visitron Artikelnummer',
        help_text='Automatisch generiert für Warensammlungen (Format: 100-WS00001)'
    )
    
    # Angebotsdaten
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
        verbose_name='Menge'
    )
    
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Einzelpreis (Verkauf)'
    )
    
    # Einkaufspreis für Marge-Berechnung
    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Einkaufspreis',
        help_text='Für Marge-Berechnung'
    )
    
    # Verkaufspreis (wird automatisch aus Listpreisen berechnet, kann manuell überschrieben werden)
    sale_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Verkaufspreis',
        help_text='Wird bei Gruppen aus Summe der Listenpreise berechnet, kann manuell angepasst werden'
    )
    
    # Verwendet diese Position den Systempreis vom Angebot?
    uses_system_price = models.BooleanField(
        default=False,
        verbose_name='Verwendet Systempreis',
        help_text='Wenn True, wird der Systempreis des Angebots verwendet statt dem Verkaufspreis'
    )
    
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Rabatt (%)'
    )
    
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=19,
        verbose_name='MwSt. (%)'
    )
    
    # Optional: Zusätzliche Position-Notizen
    notes = models.TextField(
        blank=True,
        verbose_name='Positions-Notizen'
    )
    
    # Benutzerdefinierter Beschreibungstext (kann bearbeitet werden)
    custom_description = models.TextField(
        blank=True,
        verbose_name='Beschreibungstext',
        help_text='Editierbare Beschreibung für das Angebot (wird aus Produktbeschreibung geladen)'
    )
    
    class Meta:
        verbose_name = 'Angebotsposition'
        verbose_name_plural = 'Angebotspositionen'
        ordering = ['quotation', 'position']
    
    def __str__(self):
        if self.is_group_header and self.group_name:
            return f"{self.quotation.quotation_number} - Pos. {self.position} - Gruppe: {self.group_name}"
        return f"{self.quotation.quotation_number} - Pos. {self.position}"
    
    @property
    def subtotal(self):
        """Zwischensumme ohne MwSt"""
        from decimal import Decimal
        
        # Wenn diese Position den Systempreis verwendet
        if self.uses_system_price and self.quotation.system_price:
            return self.quotation.system_price
        
        # Für Gruppen-Header mit manuellem Verkaufspreis
        if self.is_group_header and self.sale_price:
            return self.sale_price
        
        # Für normale Positionen: Menge * Preis mit Rabatt
        price_after_discount = self.unit_price * (Decimal('1') - self.discount_percent / Decimal('100'))
        return self.quantity * price_after_discount
    
    @property
    def tax_amount(self):
        """MwSt-Betrag - verwendet globalen Tax Rate vom Angebot"""
        from decimal import Decimal
        if not self.quotation.tax_enabled:
            return Decimal('0')
        return self.subtotal * (self.quotation.tax_rate / Decimal('100'))
    
    @property
    def total(self):
        """Gesamtsumme inkl. MwSt"""
        return self.subtotal + self.tax_amount
    
    @property
    def total_purchase_cost(self):
        """Gesamte Einkaufskosten"""
        from decimal import Decimal
        return self.quantity * self.purchase_price
    
    @property
    def margin_absolute(self):
        """Marge in Euro"""
        return self.subtotal - self.total_purchase_cost
    
    @property
    def margin_percent(self):
        """Marge in Prozent"""
        from decimal import Decimal
        if self.total_purchase_cost == 0:
            return Decimal('0')
        return (self.margin_absolute / self.total_purchase_cost) * Decimal('100')
    
    def get_group_total_purchase_cost(self):
        """Summe der Einkaufskosten für eine Gruppe"""
        from decimal import Decimal
        if not self.group_id:
            return self.total_purchase_cost
        
        # Summe aller Items in der Gruppe (inklusive dieser)
        group_items = QuotationItem.objects.filter(
            quotation=self.quotation,
            group_id=self.group_id
        )
        total = Decimal('0')
        for item in group_items:
            total += item.total_purchase_cost
        return total
    
    def save(self, *args, **kwargs):
        """Override save to generate WS article number for group headers"""
        if self.is_group_header and not self.item_article_number:
            self.item_article_number = self._generate_ws_article_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_ws_article_number():
        """Generiert die nächste WS-Artikelnummer im Format 100-WS00001"""
        # Lieferantennummer ist fest 100
        supplier_number = '100'
        prefix = f'{supplier_number}-WS'
        
        # Finde die höchste WS-Nummer
        existing_numbers = QuotationItem.objects.filter(
            item_article_number__startswith=prefix
        ).values_list('item_article_number', flat=True)
        
        if not existing_numbers:
            return f'{prefix}00001'
        
        # Extrahiere Nummern und finde Maximum
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[2][2:])  # Entferne 'WS' und konvertiere
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return f'{prefix}00001'
        
        next_number = max(numeric_numbers) + 1
        return f'{prefix}{next_number:05d}'
    
    def get_group_margin(self):
        """Marge für eine Gruppe (Verkaufspreis - Summe Einkaufspreise)"""
        from decimal import Decimal
        if not self.is_group_header or not self.sale_price:
            return {'absolute': Decimal('0'), 'percent': Decimal('0'), 'total_cost': Decimal('0')}
        
        total_cost = self.get_group_total_purchase_cost()
        margin_abs = self.sale_price - total_cost
        
        if total_cost == 0:
            margin_pct = Decimal('0')
        else:
            margin_pct = (margin_abs / total_cost) * Decimal('100')
        
        return {
            'absolute': margin_abs,
            'percent': margin_pct,
            'total_cost': total_cost
        }


# ==================== Marketing Models ====================

# Note: upload path for marketing files is provided by core.upload_paths.marketing_upload_path

def marketing_item_upload_path(instance, filename):
    """Compatibility wrapper used by older migrations."""
    return marketing_upload_path(instance, filename)


class MarketingItem(models.Model):
    """
    Marketing-Materialien: Newsletter, AppNotes, TechNotes, Broschüren, Shows, Workshops
    """
    CATEGORY_CHOICES = [
        ('newsletter', 'Newsletter'),
        ('appnote', 'AppNote'),
        ('technote', 'TechNote'),
        ('brochure', 'Broschüre'),
        ('show', 'Show'),
        ('workshop', 'Workshop'),
    ]
    
    # Basisfelder
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        verbose_name='Kategorie'
    )
    title = models.CharField(max_length=300, verbose_name='Titel')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    # Zuständige Mitarbeiter (ManyToMany)
    responsible_employees = models.ManyToManyField(
        'users.Employee',
        blank=True,
        related_name='marketing_items',
        verbose_name='Zuständige Mitarbeiter'
    )
    
    # Veranstaltungsfelder (nur für Shows/Workshops)
    event_date = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Veranstaltungsdatum',
        help_text='Nur für Shows und Workshops'
    )
    event_location = models.CharField(
        max_length=300,
        blank=True,
        verbose_name='Veranstaltungsort',
        help_text='Nur für Shows und Workshops'
    )
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_marketing_items',
        verbose_name='Erstellt von'
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Marketing-Material'
        verbose_name_plural = 'Marketing-Materialien'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_category_display()}: {self.title}"
    
    @property
    def is_event(self):
        """Prüft ob es sich um ein Event (Show/Workshop) handelt"""
        return self.category in ['show', 'workshop']


class MarketingItemFile(models.Model):
    """
    Dateianhänge für Marketing-Items
    """
    marketing_item = models.ForeignKey(
        MarketingItem,
        on_delete=models.CASCADE,
        related_name='files',
        verbose_name='Marketing-Material'
    )
    file = models.FileField(
        upload_to=marketing_upload_path,
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
        related_name='marketing_file_uploads',
        verbose_name='Hochgeladen von'
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Hochgeladen am'
    )
    
    class Meta:
        verbose_name = 'Marketing-Datei'
        verbose_name_plural = 'Marketing-Dateien'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.filename} ({self.marketing_item.title})"
    
    @property
    def is_image(self):
        """Prüft ob die Datei ein Bild ist"""
        if self.content_type:
            return self.content_type.startswith('image/')
        return self.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'))


# ==================== Sales Ticket Models ====================

class SalesTicket(models.Model):
    """
    Sales-Tickets für Dokumentation, Marketing-Material, Trainingsmaterial etc.
    """
    CATEGORY_CHOICES = [
        ('appnote', 'AppNote'),
        ('technote', 'TechNote'),
        ('usermanual', 'User Manual'),
        ('fieldservicemanual', 'Field Service Manual'),
        ('brochure', 'Broschüre'),
        ('newsletter', 'Newsletter'),
        ('trainingvideo', 'Training Video'),
        ('marketingvideo', 'Marketing Video'),
        ('helparticle', 'Helpeintrag'),
        ('marketresearch', 'Markterkundung'),
    ]
    
    STATUS_CHOICES = [
        ('new', 'Neu'),
        ('assigned', 'Zugewiesen'),
        ('in_progress', 'In Bearbeitung'),
        ('review', 'Review'),
        ('completed', 'Erledigt'),
        ('rejected', 'Abgelehnt'),
    ]
    
    # Ticket-Identifikation
    ticket_number = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        verbose_name='Ticketnummer'
    )
    
    # Kategorie und Status
    category = models.CharField(
        max_length=30,
        choices=CATEGORY_CHOICES,
        verbose_name='Kategorie'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        verbose_name='Status'
    )
    
    # Basisdaten
    title = models.CharField(max_length=300, verbose_name='Titel')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    # Zuweisungen
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sales_tickets_created',
        verbose_name='Erstellt von'
    )
    
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_tickets_assigned',
        verbose_name='Zugewiesen an'
    )
    
    # Beobachter
    watchers = models.ManyToManyField(
        User,
        blank=True,
        related_name='sales_tickets_watching',
        verbose_name='Beobachter'
    )
    
    # Daten
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Avisiertes Abgabedatum'
    )
    
    completed_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Abschlussdatum'
    )
    
    # Notizen und interne Kommentare
    notes = models.TextField(
        blank=True,
        verbose_name='Interne Notizen'
    )
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Sales-Ticket'
        verbose_name_plural = 'Sales-Tickets'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.ticket_number} - {self.title}"
    
    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = self._generate_ticket_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_ticket_number():
        """Generiert eine eindeutige Ticketnummer im Format ST-YYYY-NNNN"""
        from datetime import datetime
        year = datetime.now().year
        prefix = f'ST-{year}-'
        
        existing_tickets = SalesTicket.objects.filter(
            ticket_number__startswith=prefix
        ).order_by('-ticket_number')
        
        if existing_tickets.exists():
            last_number = existing_tickets.first().ticket_number
            try:
                number = int(last_number.split('-')[-1]) + 1
            except (ValueError, IndexError):
                number = 1
        else:
            number = 1
        
        return f'{prefix}{number:04d}'


class SalesTicketAttachment(models.Model):
    """
    Dateianhänge für Sales-Tickets
    """
    ticket = models.ForeignKey(
        SalesTicket,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Ticket'
    )
    file = models.FileField(
        upload_to=sales_ticket_attachment_path,
        verbose_name='Datei'
    )
    filename = models.CharField(
        max_length=255,
        verbose_name='Dateiname'
    )
    file_size = models.IntegerField(
        default=0,
        verbose_name='Dateigröße (Bytes)'
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
        verbose_name='Hochgeladen von'
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Hochgeladen am'
    )
    
    class Meta:
        verbose_name = 'Sales-Ticket Anhang'
        verbose_name_plural = 'Sales-Ticket Anhänge'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.filename} ({self.ticket.ticket_number})"
    
    @property
    def is_image(self):
        """Prüft ob die Datei ein Bild ist"""
        if self.content_type:
            return self.content_type.startswith('image/')
        return self.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'))


class SalesTicketComment(models.Model):
    """
    Kommentare zu Sales-Tickets
    """
    ticket = models.ForeignKey(
        SalesTicket,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Ticket'
    )
    comment = models.TextField(verbose_name='Kommentar')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    
    class Meta:
        verbose_name = 'Sales-Ticket Kommentar'
        verbose_name_plural = 'Sales-Ticket Kommentare'
        ordering = ['created_at']
    
    def __str__(self):
        return f"Kommentar zu {self.ticket.ticket_number} von {self.created_by}"


class SalesTicketChangeLog(models.Model):
    """
    Änderungsprotokoll für Sales-Tickets
    """
    ticket = models.ForeignKey(
        SalesTicket,
        on_delete=models.CASCADE,
        related_name='change_logs',
        verbose_name='Ticket'
    )
    field_name = models.CharField(max_length=100, verbose_name='Geändertes Feld')
    old_value = models.TextField(blank=True, verbose_name='Alter Wert')
    new_value = models.TextField(blank=True, verbose_name='Neuer Wert')
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sales_ticket_changes',
        verbose_name='Geändert von'
    )
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name='Geändert am')
    
    class Meta:
        verbose_name = 'Sales-Ticket Änderung'
        verbose_name_plural = 'Sales-Ticket Änderungen'
        ordering = ['-changed_at']
    
    def __str__(self):
        return f"{self.field_name} geändert von {self.changed_by} am {self.changed_at}"
