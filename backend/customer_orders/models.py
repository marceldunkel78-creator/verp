from django.db import models
from django.contrib.auth import get_user_model
from customers.models import Customer
from core.upload_paths import customer_order_upload_path
from datetime import datetime
from decimal import Decimal
from django.conf import settings
import os
from company.models import CompanySettings
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()


def customer_order_document_upload_path(instance, filename):
    """
    Wrapper für die zentrale customer_order_upload_path Funktion.
    Wird für Migrations-Kompatibilität beibehalten.
    """
    return customer_order_upload_path(instance, filename)


def order_confirmation_upload_path(instance, filename):
    """Upload path for order confirmation PDFs: customer_orders/YYYY/order_number/"""
    year = datetime.now().year
    order_num = instance.order_number or f'draft_{instance.id}'
    return f'customer_orders/{year}/{order_num}/{filename}'


def delivery_note_upload_path(instance, filename):
    """Upload path for delivery note PDFs"""
    year = datetime.now().year
    order_num = instance.order.order_number or f'draft_{instance.order.id}'
    return f'customer_orders/{year}/{order_num}/{filename}'


def invoice_upload_path(instance, filename):
    """Upload path for invoice PDFs"""
    year = datetime.now().year
    order_num = instance.order.order_number or f'draft_{instance.order.id}'
    return f'customer_orders/{year}/{order_num}/{filename}'


class CustomerOrder(models.Model):
    STATUS_CHOICES = [
        ('angelegt', 'Angelegt'),
        ('bestaetigt', 'Bestätigt'),
        ('in_produktion', 'In Produktion'),
        ('geliefert', 'Geliefert'),
        ('berechnet', 'Berechnet'),
        ('bezahlt', 'Bezahlt'),
        ('abgeschlossen', 'Abgeschlossen'),
        ('storniert', 'Storniert'),
    ]

    # Auftragsnummer wird erst bei Bestätigung generiert
    order_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='angelegt')
    
    # Verknüpfungen
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='customer_orders')
    quotation = models.ForeignKey(
        'sales.Quotation', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='customer_orders',
        verbose_name='Angebot'
    )
    
    # Referenzen
    project_reference = models.CharField(max_length=200, blank=True, verbose_name='Projekt-Referenz')
    system_reference = models.CharField(max_length=200, blank=True, verbose_name='System-Referenz')

    # Datumsfelder
    order_date = models.DateField(null=True, blank=True, verbose_name='Auftragsdatum')
    delivery_date = models.DateField(null=True, blank=True, verbose_name='Lieferdatum')
    confirmation_date = models.DateField(null=True, blank=True, verbose_name='Bestätigungsdatum')

    # Bestelldokument des Kunden (PDF Upload)
    customer_document = models.FileField(
        upload_to=customer_order_document_upload_path, 
        blank=True, 
        null=True,
        verbose_name='Kunden-Bestelldokument'
    )
    
    # Generierte Auftragsbestätigung PDF
    confirmation_pdf = models.FileField(
        upload_to=order_confirmation_upload_path,
        blank=True,
        null=True,
        verbose_name='Auftragsbestätigung PDF'
    )

    # Bestellinformationen vom Kunden
    customer_order_number = models.CharField(max_length=100, blank=True, verbose_name='Kunden-Bestellnummer')
    customer_contact_name = models.CharField(max_length=200, blank=True, verbose_name='Besteller Name')
    customer_vat_id = models.CharField(max_length=50, blank=True, verbose_name='USt-ID des Kunden')
    
    # Adressen als JSON
    confirmation_address = models.JSONField(blank=True, null=True, verbose_name='Bestätigungsadresse')
    shipping_address = models.JSONField(blank=True, null=True, verbose_name='Lieferadresse') 
    billing_address = models.JSONField(blank=True, null=True, verbose_name='Rechnungsadresse')
    
    # E-Mail-Adressen
    confirmation_email = models.EmailField(blank=True, verbose_name='Bestätigungs-E-Mail')
    billing_email = models.EmailField(blank=True, verbose_name='Rechnungs-E-Mail')
    
    # Konditionen (aus Angebot geladen, editierbar)
    delivery_time_weeks = models.PositiveIntegerField(default=0, verbose_name='Lieferzeit (Wochen)')
    payment_term = models.ForeignKey(
        'verp_settings.PaymentTerm',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_orders',
        verbose_name='Zahlungsbedingung'
    )
    delivery_term = models.ForeignKey(
        'verp_settings.DeliveryTerm',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_orders',
        verbose_name='Lieferbedingung'
    )
    warranty_term = models.ForeignKey(
        'verp_settings.WarrantyTerm',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_orders',
        verbose_name='Garantiebedingung'
    )
    
    # MwSt Einstellungen
    tax_enabled = models.BooleanField(default=True, verbose_name='MwSt aktiviert')
    # Gibt an, ob die Positionspreise bereits die MwSt enthalten
    tax_included = models.BooleanField(default=False, verbose_name='MwSt in Preisen enthalten')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=19, verbose_name='MwSt-Satz (%)')
    
    # Lieferkosten
    delivery_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Lieferkosten')
    
    # Bemerkungen
    notes = models.TextField(blank=True, verbose_name='Interne Bemerkungen')
    order_notes = models.TextField(blank=True, verbose_name='Bemerkungen für Kunden')
    production_notes = models.TextField(blank=True, verbose_name='Produktions-Hinweise')
    delivery_notes_text = models.TextField(blank=True, verbose_name='Lieferhinweise')

    # Metadaten
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='customer_orders_created')
    confirmed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='customer_orders_confirmed')
    # Sachbearbeiter/Ansprechpartner für Auftragsbestätigung (erscheint auf PDF mit Unterschrift)
    sales_person = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='customer_orders_sales', verbose_name='Sachbearbeiter')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Kundenauftrag'
        verbose_name_plural = 'Kundenaufträge'
        ordering = ['-created_at']

    def __str__(self):
        if self.order_number:
            return f'Auftrag {self.order_number}'
        return f'Auftrag (Entwurf #{self.id})'

    def save(self, *args, **kwargs):
        """Override save to generate order number on confirmation"""
        # Save first (commission calculation now handled in serializer)
        super().save(*args, **kwargs)

    def _calculate_commissions(self):
        """Calculate and save commissions for this order"""
        from users.models import Employee
        
        # Get company settings for fiscal year
        company_settings = CompanySettings.get_settings()
        fiscal_year = company_settings.get_current_fiscal_year()
        
        # Get order net total
        order_net_total = self.total_net
        
        # Get commission recipients
        recipients = self.commission_recipients.all()
        
        if not recipients.exists():
            # No recipients defined, skip commission calculation
            return
        
        for recipient in recipients:
            # Calculate commission amount
            commission_amount = (order_net_total * recipient.commission_percentage / 100) * (recipient.employee.commission_rate / 100)
            
            # Create commission record
            EmployeeCommission.objects.create(
                employee=recipient.employee,
                customer_order=self,
                fiscal_year=fiscal_year,
                commission_amount=commission_amount,
                order_net_total=order_net_total,
                commission_rate=recipient.employee.commission_rate,
                commission_percentage=recipient.commission_percentage,
            )

    def generate_order_number(self):
        """
        Generiert Auftragsnummer im Format O-XXX-MM-YY
        Wird erst bei Bestätigung aufgerufen.
        """
        if self.order_number:
            return self.order_number
            
        now = datetime.now()
        month = now.strftime('%m')
        year = now.strftime('%y')
        prefix = 'O'
        
        # Format: O-XXX-MM-YY
        year_pattern = f"-{year}"
        existing = CustomerOrder.objects.filter(
            order_number__startswith=f"{prefix}-",
            order_number__endswith=year_pattern
        ).exclude(order_number__isnull=True).order_by('-order_number')
        
        if existing.exists():
            last = existing.first().order_number
            try:
                # O-101-10-25 -> parts = ['O', '101', '10', '25']
                parts = last.split('-')
                running = int(parts[1]) + 1
            except Exception:
                running = 100
        else:
            running = 100  # Startet bei 100
        
        self.order_number = f"{prefix}-{running:03d}-{month}-{year}"
        return self.order_number

    @property
    def total_net(self):
        """Netto-Gesamtsumme"""
        total = sum(item.line_total for item in self.items.all())
        return total + self.delivery_cost

    @property
    def total_tax(self):
        """MwSt-Betrag"""
        if not self.tax_enabled:
            return 0
        return self.total_net * (self.tax_rate / 100)

    @property
    def total_gross(self):
        """Brutto-Gesamtsumme"""
        return self.total_net + self.total_tax

    def calculate_total(self):
        """Backward-compatible helper used by serializers/views.

        Returns the net total (positions + delivery_cost) as Decimal.
        """
        return self.total_net


class CustomerOrderItem(models.Model):
    """
    Position eines Kundenauftrags
    """
    order = models.ForeignKey(CustomerOrder, on_delete=models.CASCADE, related_name='items')
    
    # Position aus Angebot
    quotation_position = models.PositiveIntegerField(default=0, verbose_name='Angebotsposition')
    position = models.PositiveIntegerField(default=1, verbose_name='Position')
    # Positionsanzeige als String für Unterpositionen (z.B. "5.01", "5.02" für Warensammlungen)
    position_display = models.CharField(max_length=20, blank=True, verbose_name='Positionsanzeige')
    
    # Warensammlungs-Support
    is_group_header = models.BooleanField(default=False, verbose_name='Ist Gruppen-Header')
    group_id = models.CharField(max_length=50, blank=True, verbose_name='Gruppen-ID')
    
    # Artikelinformationen
    article_number = models.CharField(max_length=100, blank=True, verbose_name='VS-Artikelnummer')
    name = models.CharField(max_length=500, verbose_name='Artikelname')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    # Preise
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='EK-Preis')
    list_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Listenpreis (VK)')
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='Rabatt %')
    final_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Endpreis')
    
    # Menge
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1, verbose_name='Menge')
    unit = models.CharField(max_length=50, default='Stück', verbose_name='Einheit')
    currency = models.CharField(max_length=3, default='EUR', verbose_name='Währung')
    
    # Zuordnung zu Lieferschein/Rechnung (für Teillieferungen/Teilrechnungen)
    delivery_note_number = models.PositiveIntegerField(default=1, verbose_name='Lieferschein-Nr.')
    invoice_number = models.PositiveIntegerField(default=1, verbose_name='Rechnung-Nr.')
    
    # Seriennummer
    serial_number = models.CharField(max_length=200, blank=True, verbose_name='Seriennummer')
    
    # Status der Position
    is_delivered = models.BooleanField(default=False, verbose_name='Geliefert')
    is_invoiced = models.BooleanField(default=False, verbose_name='Berechnet')
    
    # Beschaffungs-Status (für Tab "Beschaffung")
    procurement_status = models.CharField(
        max_length=30,
        choices=[
            ('pending', 'Ausstehend'),
            ('ordered', 'Bestellt'),
            ('in_production', 'In Fertigung'),
            ('completed', 'Abgeschlossen'),
        ],
        default='pending',
        verbose_name='Beschaffungsstatus'
    )
    
    # Lieferanten-Referenz (aus Produktstamm oder manuell)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_order_items',
        verbose_name='Lieferant'
    )
    
    # Verknüpfungen zu erstellten Aufträgen
    supplier_order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_order_items',
        verbose_name='Lieferantenbestellung'
    )
    visiview_production_order = models.ForeignKey(
        'visiview.VisiViewProductionOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_order_items',
        verbose_name='VisiView Fertigungsauftrag'
    )
    hardware_production_order = models.ForeignKey(
        'manufacturing.ProductionOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_order_items',
        verbose_name='Hardware Fertigungsauftrag'
    )

    class Meta:
        verbose_name = 'Auftragsposition'
        verbose_name_plural = 'Auftragspositionen'
        ordering = ['order', 'position']

    def __str__(self):
        order_ref = self.order.order_number or f'#{self.order.id}'
        return f"{order_ref} - Pos {self.position}: {self.name}"

    @property
    def line_total(self):
        """Zeilensumme (Menge * Endpreis)"""
        return self.quantity * self.final_price

    def get_total_price(self):
        """Backward-compatible helper for serializers returning the line total."""
        return self.line_total


class DeliveryNote(models.Model):
    """
    Lieferschein - kann Teillieferung sein
    """
    order = models.ForeignKey(CustomerOrder, on_delete=models.CASCADE, related_name='delivery_notes')
    delivery_note_number = models.CharField(max_length=20, unique=True, verbose_name='Lieferschein-Nr.')
    
    # Nummer innerhalb des Auftrags (1, 2, 3...)
    sequence_number = models.PositiveIntegerField(default=1, verbose_name='Laufende Nr.')
    
    # Lieferadresse (kann pro Lieferschein unterschiedlich sein)
    shipping_address = models.JSONField(blank=True, null=True, verbose_name='Lieferadresse')
    
    # Daten
    delivery_date = models.DateField(null=True, blank=True, verbose_name='Lieferdatum')
    shipping_date = models.DateField(null=True, blank=True, verbose_name='Versanddatum')
    
    # PDF
    pdf_file = models.FileField(upload_to=delivery_note_upload_path, blank=True, null=True, verbose_name='PDF')
    
    # Versandinfos
    tracking_number = models.CharField(max_length=100, blank=True, verbose_name='Tracking-Nr.')
    carrier = models.CharField(max_length=100, blank=True, verbose_name='Versanddienstleister')
    
    notes = models.TextField(blank=True, verbose_name='Bemerkungen')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Lieferschein'
        verbose_name_plural = 'Lieferscheine'
        ordering = ['order', 'sequence_number']

    def __str__(self):
        return f'Lieferschein {self.delivery_note_number}'

    def generate_number(self):
        """Generiert Lieferschein-Nr. im Format D-XXX-MM-YY"""
        if self.delivery_note_number:
            return self.delivery_note_number
            
        # Verwende gleiche Nummer wie Auftrag, nur mit D-Prefix
        if self.order.order_number:
            base = self.order.order_number.replace('O-', 'D-')
            if self.sequence_number > 1:
                self.delivery_note_number = f"{base}-{self.sequence_number}"
            else:
                self.delivery_note_number = base
        return self.delivery_note_number

    @property
    def items(self):
        """Positionen die zu diesem Lieferschein gehören"""
        return self.order.items.filter(delivery_note_number=self.sequence_number)


class Invoice(models.Model):
    """
    Rechnung - kann Teilrechnung sein
    """
    STATUS_CHOICES = [
        ('draft', 'Entwurf'),
        ('sent', 'Versendet'),
        ('paid', 'Bezahlt'),
        ('overdue', 'Überfällig'),
        ('cancelled', 'Storniert'),
    ]
    
    order = models.ForeignKey(CustomerOrder, on_delete=models.CASCADE, related_name='invoices')
    invoice_number = models.CharField(max_length=20, unique=True, verbose_name='Rechnungs-Nr.')
    
    # Nummer innerhalb des Auftrags (1, 2, 3...)
    sequence_number = models.PositiveIntegerField(default=1, verbose_name='Laufende Nr.')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Rechnungsadresse
    billing_address = models.JSONField(blank=True, null=True, verbose_name='Rechnungsadresse')
    
    # Daten
    invoice_date = models.DateField(null=True, blank=True, verbose_name='Rechnungsdatum')
    due_date = models.DateField(null=True, blank=True, verbose_name='Fälligkeitsdatum')
    
    # Beträge
    net_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Netto')
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='MwSt')
    gross_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Brutto')
    
    # PDF
    pdf_file = models.FileField(upload_to=invoice_upload_path, blank=True, null=True, verbose_name='PDF')
    
    # XRechnung (elektronische Rechnung nach EN 16931)
    xrechnung_file = models.FileField(upload_to=invoice_upload_path, blank=True, null=True, verbose_name='XRechnung XML')
    
    notes = models.TextField(blank=True, verbose_name='Bemerkungen')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Rechnung'
        verbose_name_plural = 'Rechnungen'
        ordering = ['order', 'sequence_number']

    def __str__(self):
        return f'Rechnung {self.invoice_number}'

    def generate_number(self):
        """Generiert Rechnungs-Nr. im Format I-XXX-MM-YY"""
        if self.invoice_number:
            return self.invoice_number
            
        # Verwende gleiche Nummer wie Auftrag, nur mit I-Prefix
        if self.order.order_number:
            base = self.order.order_number.replace('O-', 'I-')
            if self.sequence_number > 1:
                self.invoice_number = f"{base}-{self.sequence_number}"
            else:
                self.invoice_number = base
        return self.invoice_number

    @property
    def items(self):
        """Positionen die zu dieser Rechnung gehören"""
        return self.order.items.filter(invoice_number=self.sequence_number)

    def get_paid_amount(self):
        """Gibt die Summe aller Zahlungen für diese Rechnung zurück (Decimal)."""
        total = Decimal('0.00')
        for p in self.payments.all():
            try:
                amt = p.amount or Decimal('0.00')
            except Exception:
                amt = Decimal(str(p.amount)) if p.amount is not None else Decimal('0.00')
            total += Decimal(amt)
        return total

    def get_open_amount(self):
        """Offener Betrag = Bruttobetrag - gezahlte Beträge."""
        gross = self.gross_amount or Decimal('0.00')
        return gross - self.get_paid_amount()

    def is_fully_paid(self):
        """True, wenn bereits mindestens der Bruttobetrag bezahlt wurde."""
        return self.get_paid_amount() >= (self.gross_amount or Decimal('0.00'))


class Payment(models.Model):
    """
    Zahlungseingänge für Rechnungen
    """
    PAYMENT_METHOD_CHOICES = [
        ('bank_transfer', 'Überweisung'),
        ('credit_card', 'Kreditkarte'),
        ('paypal', 'PayPal'),
        ('cash', 'Bar'),
        ('other', 'Sonstige'),
    ]
    
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Betrag')
    payment_date = models.DateField(verbose_name='Zahlungsdatum')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='bank_transfer')
    
    reference = models.CharField(max_length=200, blank=True, verbose_name='Referenz/Verwendungszweck')
    notes = models.TextField(blank=True, verbose_name='Bemerkungen')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Zahlungseingang'
        verbose_name_plural = 'Zahlungseingänge'
        ordering = ['-payment_date']

    def __str__(self):
        return f'Zahlung {self.amount}€ für {self.invoice}'


class CustomerOrderCommissionRecipient(models.Model):
    """
    Provisionsempfänger für Kundenaufträge mit prozentualer Aufteilung
    """
    customer_order = models.ForeignKey(
        CustomerOrder,
        on_delete=models.CASCADE,
        related_name='commission_recipients',
        verbose_name='Kundenauftrag'
    )
    
    employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.CASCADE,
        related_name='commission_assignments',
        verbose_name='Provisionsempfänger'
    )
    
    # Prozentuale Aufteilung (0.00 - 100.00)
    commission_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name='Provisionsanteil (%)',
        help_text='Prozentualer Anteil an der Gesamtprovision (0-100%)'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Provisionsempfänger'
        verbose_name_plural = 'Provisionsempfänger'
        unique_together = ['customer_order', 'employee']
        ordering = ['-created_at']
    
    def __str__(self):
        return f'{self.employee} - {self.commission_percentage}% für {self.customer_order}'


class EmployeeCommission(models.Model):
    """
    Erzielte Provisionen von Mitarbeitern nach Geschäftsjahr
    """
    employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.CASCADE,
        related_name='commissions',
        verbose_name='Mitarbeiter'
    )
    
    customer_order = models.ForeignKey(
        CustomerOrder,
        on_delete=models.CASCADE,
        related_name='commissions',
        verbose_name='Kundenauftrag'
    )
    
    # Geschäftsjahr (z.B. 2025 für 1.4.2025 - 31.3.2026)
    fiscal_year = models.PositiveIntegerField(verbose_name='Geschäftsjahr')
    
    # Provisionsbetrag
    commission_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Provisionsbetrag',
        help_text='Berechneter Provisionsbetrag in €'
    )
    
    # Berechnungsgrundlage
    order_net_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Auftrags-Netto-Gesamt',
        help_text='Netto-Gesamtbetrag des Auftrags als Berechnungsgrundlage'
    )
    
    # Provisionssatz zum Zeitpunkt der Berechnung
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name='Provisionssatz (%)',
        help_text='Provisionssatz des Mitarbeiters zum Zeitpunkt der Berechnung'
    )
    
    # Provisionsanteil bei mehreren Empfängern
    commission_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name='Provisionsanteil (%)',
        help_text='Prozentualer Anteil des Mitarbeiters an diesem Auftrag'
    )
    
    # Berechnungsdatum
    calculated_at = models.DateTimeField(auto_now_add=True, verbose_name='Berechnet am')
    
    class Meta:
        verbose_name = 'Mitarbeiterprovision'
        verbose_name_plural = 'Mitarbeiterprovisionen'
        unique_together = ['employee', 'customer_order']
        ordering = ['-fiscal_year', '-calculated_at']
    
    def __str__(self):
        return f'{self.employee} - {self.commission_amount}€ ({self.fiscal_year})'
