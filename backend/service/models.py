from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from customers.models import Customer
from django.utils import timezone
from core.upload_paths import service_ticket_attachment_path, troubleshooting_attachment_path
import re
import json

User = get_user_model()


class VSService(models.Model):
    """
    VS-Service Produkte - Dienstleistungen und Service-Produkte für Angebote
    Artikelnummer im Format VSS-00001
    """
    # Artikelnummer VSS-00001
    article_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Artikelnummer',
        help_text='Automatisch generiert im Format VSS-00001'
    )
    
    name = models.CharField(max_length=200, verbose_name='Produktname')
    
    # Kurzbeschreibungen
    short_description = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Kurzbeschreibung (Deutsch)'
    )
    short_description_en = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Kurzbeschreibung (Englisch)'
    )
    
    # Langbeschreibungen
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung (Deutsch)'
    )
    description_en = models.TextField(
        blank=True,
        verbose_name='Beschreibung (Englisch)',
        help_text='English description for international quotations'
    )
    
    # Warenkategorie
    product_category = models.ForeignKey(
        'verp_settings.ProductCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vsservice_products',
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
        related_name='vsservice_products_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'VS-Service Produkt'
        verbose_name_plural = 'VS-Service Produkte'
        ordering = ['article_number']
    
    def __str__(self):
        return f"{self.article_number} - {self.name}" if self.article_number else self.name
    
    def save(self, *args, **kwargs):
        if not self.article_number:
            self.article_number = self._generate_article_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_article_number():
        """Generiert die nächste freie Artikelnummer im Format VSS-00001"""
        existing_numbers = VSService.objects.filter(
            article_number__isnull=False
        ).values_list('article_number', flat=True)
        
        if not existing_numbers:
            return 'VSS-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'VSS-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'VSS-{next_number:05d}'
    
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
        """Gibt den aktuell gültigen Verkaufspreis zurück"""
        from django.utils import timezone
        today = timezone.now().date()
        price = self.prices.filter(
            valid_from__lte=today
        ).filter(
            models.Q(valid_until__isnull=True) | models.Q(valid_until__gte=today)
        ).order_by('-valid_from').first()
        return price.sales_price if price else None


class VSServicePrice(models.Model):
    """
    Preise für VS-Service Produkte mit Gültigkeitszeitraum
    """
    vs_service = models.ForeignKey(
        VSService,
        on_delete=models.CASCADE,
        related_name='prices',
        verbose_name='VS-Service'
    )
    
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Einkaufspreis (EUR)',
        help_text='Kalkulierter Einkaufspreis/Kosten'
    )
    sales_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Verkaufspreis (EUR)',
        help_text='Listenpreis für Angebote'
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
        related_name='vsservice_prices_created'
    )
    
    class Meta:
        verbose_name = 'VS-Service Preis'
        verbose_name_plural = 'VS-Service Preise'
        ordering = ['vs_service', '-valid_from']
    
    def __str__(self):
        return f"{self.vs_service.article_number}: {self.purchase_price}€ / {self.sales_price}€ ab {self.valid_from}"
    
    def clean(self):
        """Prüft auf überlappende Gültigkeitszeiträume"""
        overlapping = VSServicePrice.objects.filter(vs_service=self.vs_service)
        
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


class ServiceTicket(models.Model):
    """
    Service Tickets - Für Serviceanfragen von Kunden und Dealern
    """
    STATUS_CHOICES = [
        ('new', 'Neu'),
        ('assigned', 'Zugewiesen'),
        ('waiting_customer', 'Warten Kunde'),
        ('waiting_thirdparty', 'Warten Third-Party'),
        ('no_solution', 'Keine Lösung'),
        ('resolved', 'Gelöst'),
    ]
    
    BILLING_CHOICES = [
        ('invoice', 'Rechnung'),
        ('warranty', 'Garantie'),
        ('maintenance', 'Maintenance'),
    ]
    
    ticket_number = models.CharField(
        max_length=15,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Ticket-Nummer'
    )
    
    title = models.CharField(max_length=200, verbose_name='Thema/Titel')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='service_tickets',
        verbose_name='Kunde/Dealer'
    )
    
    contact_email = models.EmailField(
        blank=True,
        verbose_name='E-Mail',
        help_text='Kontakt-E-Mail für dieses Ticket'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        verbose_name='Status'
    )
    
    billing = models.CharField(
        max_length=20,
        choices=BILLING_CHOICES,
        blank=True,
        verbose_name='Abrechnung'
    )
    
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tickets',
        verbose_name='Zugewiesen an'
    )
    
    # Verknüpfungen zu RMA und VisiView
    linked_rma = models.ForeignKey(
        'RMACase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_tickets',
        verbose_name='Verknüpfte RMA'
    )
    
    linked_system = models.ForeignKey(
        'systems.System',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_system_tickets',
        verbose_name='Verknüpftes System'
    )
    
    linked_visiview_ticket = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='VisiView Ticket',
        help_text='Verknüpftes VisiView-Ticket'
    )
    
    # Beobachter (ManyToMany für Checkboxen)
    watchers = models.ManyToManyField(
        User,
        blank=True,
        related_name='watched_tickets',
        verbose_name='Beobachter'
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_tickets',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Service Ticket'
        verbose_name_plural = 'Service Tickets'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.ticket_number} - {self.title}" if self.ticket_number else self.title
    
    @property
    def is_open(self):
        """Gibt zurück ob das Ticket offen ist"""
        return self.status not in ['no_solution', 'resolved']
    
    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = self._generate_ticket_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_ticket_number():
        """Generiert die nächste freie Ticket-Nummer im Format TKT-00001"""
        existing_numbers = ServiceTicket.objects.filter(
            ticket_number__isnull=False
        ).values_list('ticket_number', flat=True)
        
        if not existing_numbers:
            return 'TKT-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'TKT-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'TKT-{next_number:05d}'


class TicketComment(models.Model):
    """
    Kommentare zu Service-Tickets
    """
    ticket = models.ForeignKey(
        ServiceTicket,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Ticket'
    )
    comment = models.TextField(verbose_name='Kommentar')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='ticket_comments',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    
    class Meta:
        verbose_name = 'Ticket Kommentar'
        verbose_name_plural = 'Ticket Kommentare'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Kommentar von {self.created_by} am {self.created_at}"


class TicketChangeLog(models.Model):
    """
    Änderungsprotokoll für Service-Tickets
    """
    ticket = models.ForeignKey(
        ServiceTicket,
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
        related_name='ticket_changes',
        verbose_name='Geändert von'
    )
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name='Geändert am')
    
    class Meta:
        verbose_name = 'Ticket Änderung'
        verbose_name_plural = 'Ticket Änderungen'
        ordering = ['-changed_at']
    
    def __str__(self):
        return f"{self.field_name} geändert von {self.changed_by} am {self.changed_at}"


class ServiceTicketTimeEntry(models.Model):
    """
    Zeiterfassung für Service-Tickets
    """
    ticket = models.ForeignKey(
        ServiceTicket,
        on_delete=models.CASCADE,
        related_name='time_entries',
        verbose_name='Ticket'
    )
    date = models.DateField(
        verbose_name='Datum',
        help_text='Datum der Arbeitsleistung'
    )
    time = models.TimeField(
        verbose_name='Uhrzeit',
        help_text='Uhrzeit der Arbeitsleistung'
    )
    employee = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='service_time_entries',
        verbose_name='Mitarbeiter'
    )
    hours_spent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name='Aufgewendete Zeit (Stunden)',
        help_text='Aufgewendete Zeit in Stunden (z.B. 2.5 für 2,5 Stunden)'
    )
    description = models.TextField(
        verbose_name='Beschreibung',
        help_text='Kurze Beschreibung der durchgeführten Arbeiten'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_time_entries',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Zeiteintrag'
        verbose_name_plural = 'Zeiteinträge'
        ordering = ['-date', '-time']
    
    def __str__(self):
        return f"{self.date} {self.time} - {self.hours_spent}h ({self.ticket.ticket_number})"


class ServiceTicketAttachment(models.Model):
    """
    Dateianhänge für Service-Tickets
    """
    ticket = models.ForeignKey(
        ServiceTicket,
        on_delete=models.CASCADE,
        related_name='ticket_attachments',
        verbose_name='Ticket'
    )
    file = models.FileField(
        upload_to=service_ticket_attachment_path,
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
        related_name='service_ticket_uploads',
        verbose_name='Hochgeladen von'
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Hochgeladen am'
    )
    
    class Meta:
        verbose_name = 'Service-Ticket Anhang'
        verbose_name_plural = 'Service-Ticket Anhänge'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.filename} ({self.ticket.ticket_number})"
    
    @property
    def is_image(self):
        """Prüft ob die Datei ein Bild ist"""
        if self.content_type:
            return self.content_type.startswith('image/')
        return self.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'))



class RMACase(models.Model):
    """
    RMA-Fälle (Return Merchandise Authorization)
    Verwaltung von Rücksendungen und Reparaturen
    """
    STATUS_CHOICES = [
        ('open', 'Offen'),
        ('in_progress', 'In Bearbeitung'),
        ('waiting_parts', 'Warte auf Teile'),
        ('repaired', 'Repariert'),
        ('not_repairable', 'Nicht reparierbar'),
        ('returned', 'Zurückgesendet'),
        ('closed', 'Abgeschlossen'),
    ]
    
    WARRANTY_CHOICES = [
        ('unknown', 'Unbekannt'),
        ('in_warranty', 'In Garantie'),
        ('out_of_warranty', 'Außerhalb Garantie'),
        ('extended_warranty', 'Erweiterte Garantie'),
    ]
    
    CONDITION_CHOICES = [
        ('', '-- Auswählen --'),
        ('good', 'Gut / Unbeschädigt'),
        ('minor_damage', 'Leichte Beschädigungen'),
        ('major_damage', 'Starke Beschädigungen'),
        ('incomplete', 'Unvollständig'),
    ]
    
    rma_number = models.CharField(
        max_length=15,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='RMA-Nummer'
    )
    
    # =====================
    # Tab 1: Basisinfos
    # =====================
    title = models.CharField(max_length=200, verbose_name='Titel/Betreff')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='open',
        verbose_name='Status'
    )
    
    # Kundendaten
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rma_cases',
        verbose_name='Kunde'
    )
    customer_name = models.CharField(max_length=200, blank=True, verbose_name='Kundenname')
    customer_contact = models.CharField(max_length=200, blank=True, verbose_name='Ansprechpartner')
    customer_email = models.EmailField(blank=True, verbose_name='E-Mail')
    customer_phone = models.CharField(max_length=50, blank=True, verbose_name='Telefon')
    
    # Verknüpfungen
    linked_system = models.ForeignKey(
        'systems.System',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rma_cases',
        verbose_name='Verknüpftes System'
    )
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rma_cases',
        verbose_name='Warenlager-Artikel'
    )
    
    # Produktdaten
    product_name = models.CharField(max_length=200, blank=True, verbose_name='Produktbezeichnung')
    product_serial = models.CharField(max_length=100, blank=True, verbose_name='Seriennummer')
    product_purchase_date = models.DateField(null=True, blank=True, verbose_name='Kaufdatum')
    warranty_status = models.CharField(
        max_length=20,
        choices=WARRANTY_CHOICES,
        default='unknown',
        verbose_name='Garantiestatus'
    )
    fault_description = models.TextField(blank=True, verbose_name='Fehlerbeschreibung vom Kunden')
    
    # =====================
    # Tab 2: Wareneingang/-ausgang
    # =====================
    # Wareneingang
    received_date = models.DateField(null=True, blank=True, verbose_name='Eingangsdatum')
    received_by = models.CharField(max_length=200, blank=True, verbose_name='Angenommen von')
    received_condition = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Zustand bei Eingang'
    )
    tracking_inbound = models.CharField(max_length=100, blank=True, verbose_name='Sendungsverfolgung Eingang')
    
    # Warenausgang
    shipped_date = models.DateField(null=True, blank=True, verbose_name='Versanddatum')
    shipped_by = models.CharField(max_length=200, blank=True, verbose_name='Versandt von')
    tracking_outbound = models.CharField(max_length=100, blank=True, verbose_name='Sendungsverfolgung Ausgang')
    shipping_notes = models.TextField(blank=True, verbose_name='Versandnotizen')
    
    # =====================
    # Tab 3: RMA-Kalkulation
    # =====================
    estimated_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name='Geschätzte Kosten'
    )
    actual_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name='Tatsächliche Gesamtkosten'
    )
    parts_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name='Materialkosten'
    )
    labor_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name='Arbeitskosten'
    )
    shipping_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name='Versandkosten'
    )
    total_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name='Gesamtkosten (berechnet)'
    )
    quote_sent = models.BooleanField(default=False, verbose_name='KV gesendet')
    quote_accepted = models.BooleanField(default=False, verbose_name='KV akzeptiert')
    
    # =====================
    # Tab 4: Reparaturbericht
    # =====================
    diagnosis = models.TextField(blank=True, verbose_name='Diagnose / Fehleranalyse')
    repair_actions = models.TextField(blank=True, verbose_name='Durchgeführte Maßnahmen')
    parts_used = models.TextField(blank=True, verbose_name='Verwendete Ersatzteile')
    repair_date = models.DateField(null=True, blank=True, verbose_name='Reparaturdatum')
    repaired_by = models.CharField(max_length=200, blank=True, verbose_name='Repariert von')
    test_results = models.TextField(blank=True, verbose_name='Testergebnisse')
    final_notes = models.TextField(blank=True, verbose_name='Abschlussnotizen')
    
    # =====================
    # Metadaten
    # =====================
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_rma_cases',
        verbose_name='Zugewiesen an'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_rma_cases',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'RMA-Fall'
        verbose_name_plural = 'RMA-Fälle'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.rma_number} - {self.title}" if self.rma_number else self.title
    
    def save(self, *args, **kwargs):
        if not self.rma_number:
            self.rma_number = self._generate_rma_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_rma_number():
        """Generiert die nächste freie RMA-Nummer im Format RMA-00001"""
        existing_numbers = RMACase.objects.filter(
            rma_number__isnull=False
        ).values_list('rma_number', flat=True)
        
        if not existing_numbers:
            return 'RMA-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'RMA-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'RMA-{next_number:05d}'


class TroubleshootingTicket(models.Model):
    """
    Troubleshooting Tickets - Wissensdatenbank für häufige Probleme und Lösungen
    """
    STATUS_CHOICES = [
        ('new', 'Neu'),
        ('in_progress', 'In Bearbeitung'),
        ('resolved', 'Gelöst'),
        ('closed', 'Geschlossen'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Niedrig'),
        ('normal', 'Normal'),
        ('high', 'Hoch'),
        ('urgent', 'Dringend'),
    ]
    
    CATEGORY_CHOICES = [
        ('hardware', 'Hardware'),
        ('software', 'Software'),
        ('application', 'Applikation'),
        ('other', 'Sonstiges'),
    ]
    
    ticket_number = models.CharField(
        max_length=15,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Ticket-Nummer'
    )
    
    # Basisfelder
    title = models.CharField(max_length=300, verbose_name='Thema/Titel')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
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
    
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='other',
        verbose_name='Kategorie'
    )
    
    # Zuweisungs- und Trackingfelder
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_troubleshooting',
        verbose_name='Zugewiesen an'
    )
    
    # Troubleshooting-spezifische Felder
    affected_version = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Betroffene Version'
    )
    
    root_cause = models.TextField(
        blank=True,
        verbose_name='Root Cause',
        help_text='Ursache des Problems'
    )
    
    corrective_action = models.TextField(
        blank=True,
        verbose_name='Corrective Action',
        help_text='Korrekturmaßnahme / Lösung'
    )
    
    # Verknüpfungen
    related_tickets = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Zugehörige Tickets',
        help_text='Kommagetrennte Ticketnummern oder IDs'
    )
    
    # Dateianhänge als Text (Dateinamen)
    files = models.TextField(
        blank=True,
        verbose_name='Dateien',
        help_text='Dateinamen oder Links'
    )
    
    # Kommentare als Textfeld (für Import)
    last_comments = models.TextField(
        blank=True,
        verbose_name='Letzte Kommentare'
    )
    
    # Import-Felder (Original-IDs aus altem System)
    legacy_id = models.IntegerField(
        null=True,
        blank=True,
        unique=True,
        verbose_name='Legacy ID',
        help_text='Original-Ticket-Nummer aus dem alten System'
    )
    
    # Metadaten
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='authored_troubleshooting',
        verbose_name='Autor'
    )
    last_changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='last_changed_troubleshooting',
        verbose_name='Zuletzt geändert von'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name='Geschlossen am')
    
    class Meta:
        verbose_name = 'Troubleshooting Ticket'
        verbose_name_plural = 'Troubleshooting Tickets'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.ticket_number} - {self.title}" if self.ticket_number else self.title
    
    @property
    def is_open(self):
        """Gibt zurück ob das Ticket offen ist"""
        return self.status not in ['resolved', 'closed']
    
    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = self._generate_ticket_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_ticket_number():
        """Generiert die nächste freie Ticket-Nummer im Format TS-00001"""
        existing_numbers = TroubleshootingTicket.objects.filter(
            ticket_number__isnull=False
        ).values_list('ticket_number', flat=True)
        
        if not existing_numbers:
            return 'TS-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'TS-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'TS-{next_number:05d}'


class TroubleshootingComment(models.Model):
    """
    Kommentare zu Troubleshooting-Tickets
    """
    ticket = models.ForeignKey(
        TroubleshootingTicket,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Ticket'
    )
    comment = models.TextField(verbose_name='Kommentar')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='troubleshooting_comments',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    
    class Meta:
        verbose_name = 'Troubleshooting Kommentar'
        verbose_name_plural = 'Troubleshooting Kommentare'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Kommentar von {self.created_by} am {self.created_at}"


class TroubleshootingAttachment(models.Model):
    """
    Dateianhänge für Troubleshooting-Tickets
    """
    ticket = models.ForeignKey(
        TroubleshootingTicket,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Ticket'
    )
    file = models.FileField(
        upload_to=troubleshooting_attachment_path,
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
        related_name='troubleshooting_uploads',
        verbose_name='Hochgeladen von'
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Hochgeladen am'
    )
    
    class Meta:
        verbose_name = 'Troubleshooting Anhang'
        verbose_name_plural = 'Troubleshooting Anhänge'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.filename} ({self.ticket.ticket_number})"
    
    @property
    def is_image(self):
        """Prüft ob die Datei ein Bild ist"""
        if self.content_type:
            return self.content_type.startswith('image/')
        return self.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'))


class RMACaseTimeEntry(models.Model):
    """
    Zeiterfassung für RMA-Fälle
    """
    rma_case = models.ForeignKey(
        RMACase,
        on_delete=models.CASCADE,
        related_name='time_entries',
        verbose_name='RMA-Fall'
    )
    date = models.DateField(
        verbose_name='Datum',
        help_text='Datum der Arbeitsleistung'
    )
    time = models.TimeField(
        verbose_name='Uhrzeit',
        help_text='Uhrzeit der Arbeitsleistung'
    )
    employee = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='rma_time_entries',
        verbose_name='Mitarbeiter'
    )
    hours_spent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name='Aufgewendete Zeit (Stunden)',
        help_text='Aufgewendete Zeit in Stunden (z.B. 2.5 für 2,5 Stunden)'
    )
    description = models.TextField(
        verbose_name='Beschreibung',
        help_text='Kurze Beschreibung der durchgeführten Arbeiten'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='rma_time_entries_created',
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
        verbose_name = 'RMA Zeiteintrag'
        verbose_name_plural = 'RMA Zeiteinträge'
        ordering = ['-date', '-time']
    
    def __str__(self):
        return f"{self.rma_case.rma_number} - {self.date} {self.time} ({self.hours_spent}h)"
