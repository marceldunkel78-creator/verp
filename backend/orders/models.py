from django.db import models
from django.contrib.auth import get_user_model
from suppliers.models import Supplier
from verp_settings.models import PaymentTerm, DeliveryTerm, DeliveryInstruction
from datetime import datetime
import os

User = get_user_model()


def order_document_upload_path(instance, filename):
    """
    Benutzerdefinierter Upload-Pfad für Bestelldokumente.
    Behält den Original-Dateinamen bei (überschreibt bei Duplikaten).

    Sicherheitsanpassungen: Ersetze in Order-Nummer und Dateiname alle Schrägstriche ("/") und
    nicht-datei-geeignete Zeichen durch Unterstriche, damit keine Pfad-Traversal- oder
    Verzeichnisunterteilung durch Sonderzeichen entsteht.
    """
    import re

    # Normalisiere Order-Nummer und Dateiname: ersetze '/' und sonstige ungültige Zeichen
    def _sanitize(name):
        if not name:
            return ''
        # Replace slashes and spaces with underscore
        name = name.replace('/', '_').replace(' ', '_')
        # Remove characters that are not alphanumeric, underscore, dot or hyphen
        return re.sub(r'[^A-Za-z0-9_.-]', '_', name)

    safe_filename = _sanitize(filename)
    safe_ordernum = _sanitize(instance.order_number) if getattr(instance, 'order_number', None) else ''

    if safe_ordernum:
        new_filename = f"{safe_ordernum}_{safe_filename}"
    else:
        new_filename = safe_filename

    return f"orders/documents/{datetime.now().strftime('%Y/%m')}/{new_filename}"


class Order(models.Model):
    """
    Bestellungen (Orders)
    """
    
    STATUS_CHOICES = [
        ('angelegt', 'Angelegt'),
        ('bestellt', 'Bestellt'),
        ('bestaetigt', 'Bestätigt'),
        ('geliefert', 'Geliefert'),
        ('bezahlt', 'Bezahlt'),
        ('zahlung_on_hold', 'Zahlung on hold'),
        ('storniert', 'Storniert'),
    ]
    
    # Bestellnummer: B-001-10/25 (B-<lfd.Nr>-<Monat>/<Jahr>)
    order_number = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Bestellnummer',
        help_text='Format: B-001-10/25'
    )
    
    # Bestelltyp: Unterscheidung zwischen Lieferantenbestellung und Kundenauftrag
    ORDER_TYPE_CHOICES = [
        ('online', 'Online-Bestellung'),
        ('direct', 'Direkte Bestellung'),
        ('customer_order', 'Kundenauftrag'),
    ]
    order_type = models.CharField(
        max_length=20,
        choices=ORDER_TYPE_CHOICES,
        default='online',
        verbose_name='Bestelltyp',
        help_text='Typ der Bestellung (z.B. Kundenauftrag)'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='angelegt',
        verbose_name='Status'
    )
    
    # Lieferant
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='orders',
        verbose_name='Lieferant'
    )
    
    # Wichtige Daten
    order_date = models.DateField(
        verbose_name='Bestelldatum',
        null=True,
        blank=True,
        help_text='Datum an dem bestellt wurde'
    )
    
    confirmation_date = models.DateField(
        verbose_name='Auftragsbestätigungsdatum',
        null=True,
        blank=True,
        help_text='Datum der Auftragsbestätigung durch den Lieferanten'
    )
    
    delivery_date = models.DateField(
        verbose_name='Lieferdatum',
        null=True,
        blank=True,
        help_text='Tatsächliches oder geplantes Lieferdatum'
    )
    
    payment_date = models.DateField(
        verbose_name='Zahlungsdatum',
        null=True,
        blank=True,
        help_text='Datum der Zahlung'
    )
    
    # Konditionen
    payment_term = models.ForeignKey(
        PaymentTerm,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='Zahlungsbedingungen'
    )
    
    delivery_term = models.ForeignKey(
        DeliveryTerm,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='Lieferbedingungen (Incoterm)'
    )
    
    delivery_instruction = models.ForeignKey(
        DeliveryInstruction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='Lieferanweisungen'
    )
    
    # Angebots- und Textfelder
    offer_reference = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Angebotsreferenz',
        help_text='Referenz zum zugehörigen Angebot'
    )
    
    custom_text = models.TextField(
        blank=True,
        verbose_name='Benutzerdefinierter Text',
        help_text='Text der im Bestelldokument erscheint'
    )
    
    # Notizen
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen',
        help_text='Interne Notizen zur Bestellung'
    )
    
    # Bestelldokument (für Online-Bestellungen)
    order_document = models.FileField(
        upload_to=order_document_upload_path,
        blank=True,
        null=True,
        verbose_name='Bestelldokument',
        help_text='Hochgeladenes Bestelldokument (z.B. PDF von Online-Bestellung)'
    )
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='orders_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')

    # Zusätzliche Felder: voraussichtliches Lieferdatum und Auftragsbestätigung vom Lieferanten
    expected_delivery_date = models.DateField(
        verbose_name='Voraussichtliches Lieferdatum',
        null=True,
        blank=True,
        help_text='Voraussichtliches Lieferdatum laut Auftragsbestätigung'
    )

    # Bestätigter Gesamtpreis der Bestellung (einmalig gesetzt bei Auftragsbestätigung)
    confirmed_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Bestätigter Bestellpreis',
        help_text='Die Gesamtsumme nach Auftragsbestätigung (fixiert)'
    )

    supplier_confirmation_document = models.FileField(
        upload_to=order_document_upload_path,
        blank=True,
        null=True,
        verbose_name='Auftragsbestätigung (Lieferant)',
        help_text='Hochladen der Auftragsbestätigung des Lieferanten (PDF)'
    )
    
    class Meta:
        verbose_name = 'Bestellung'
        verbose_name_plural = 'Bestellungen'
        ordering = ['-created_at']
    
    def __str__(self):
        if self.order_number:
            return f"{self.order_number} - {self.supplier.name}"
        return f"Bestellung #{self.id} - {self.supplier.name}"
    
    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self._generate_order_number()

        # Automatic status updates based on dates
        if self.status != 'storniert':  # Don't auto-update if cancelled
            if self.payment_date:
                self.status = 'bezahlt'
            elif self.delivery_date:
                self.status = 'geliefert'
            elif self.confirmation_date:
                self.status = 'bestaetigt'
            elif self.order_date:
                self.status = 'bestellt'

        super().save(*args, **kwargs)

    def _generate_order_number(self):
        """
        Generiert Bestellnummer.
        Für Kundenaufträge (order_type='customer_order') wird das Präfix 'O' verwendet,
        ansonsten 'B'. Die laufende Nummer ist pro Kalenderjahr (zunehmend).
        Format: O-001-01/25
        """
        now = datetime.now()
        month = now.strftime('%m')  # 01-12
        year = now.strftime('%y')   # 25 für 2025

        # Prefix: O for customer orders, B for supplier orders
        prefix = 'O' if getattr(self, 'order_type', '') == 'customer_order' else 'B'

        # Running number per calendar year for this prefix
        year_suffix = f"/{year}"
        existing_orders = Order.objects.filter(
            order_number__startswith=f"{prefix}-",
            order_number__endswith=year_suffix
        ).order_by('-order_number')

        if existing_orders.exists():
            last_order_number = existing_orders.first().order_number
            try:
                parts = last_order_number.split('-')
                if len(parts) >= 3:
                    running_number = int(parts[1]) + 1
                else:
                    running_number = 1
            except (ValueError, IndexError):
                running_number = 1
        else:
            running_number = 1

        return f"{prefix}-{running_number:03d}-{month}/{year}"


class OrderItem(models.Model):
    """
    Bestellpositionen
    Kann verknüpft sein mit TradingProduct, Asset, MaterialSupply oder frei konfigurierbar
    """
    
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Bestellung'
    )
    
    # Produkt-Verknüpfungen (optional, eines davon oder keines für freie Positionen)
    trading_product = models.ForeignKey(
        'suppliers.TradingProduct',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Trading Product'
    )
    
    asset = models.ForeignKey(
        'suppliers.Asset',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Asset'
    )
    
    material_supply = models.ForeignKey(
        'suppliers.MaterialSupply',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Material Supply'
    )
    
    # Kundenauftragsnummer
    customer_order_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Kundenauftragsnummer',
        help_text='Referenz zum Kundenauftrag'
    )
    
    # Editierbare Felder (übernommen oder manuell eingegeben)
    article_number = models.CharField(
        max_length=100,
        verbose_name='Artikelnummer',
        help_text='Artikelnummer des Lieferanten'
    )
    
    name = models.CharField(
        max_length=500,
        verbose_name='Produktname'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )

    # Verwaltungsdaten (flexibel als JSON gespeichert)
    management_info = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        verbose_name='Management Info',
        help_text='Warenfunktion, Auftrags-/Projekt-/Systemzuordnungen etc.'
    )
    
    # Preise und Mengen
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
        verbose_name='Menge'
    )
    
    unit = models.CharField(
        max_length=50,
        default='Stück',
        verbose_name='Einheit'
    )
    
    list_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Listenpreis',
        help_text='Preis pro Einheit'
    )
    
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Rabatt %'
    )
    
    final_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Endpreis',
        help_text='Preis pro Einheit nach Rabatt'
    )

    # Bestätigter Positionspreis (wird bei Auftragsbestätigung separat gespeichert)
    confirmed_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Bestätigter Positionspreis',
        help_text='Vom Lieferanten bestätigter Preis pro Einheit (bleibt erhalten)'
    )

    # Controlling - Checkbox, die angibt, ob die Position vom Controlling geprüft wurde
    controlling_checked = models.BooleanField(
        default=False,
        verbose_name='Controlling geprüft',
        help_text='Markiert, ob Controlling die Position geprüft/abgenommen hat'
    )
    
    currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Währung'
    )
    
    # Position in der Bestellung
    position = models.PositiveIntegerField(
        default=0,
        verbose_name='Position',
        help_text='Reihenfolge in der Bestellung'
    )
    
    class Meta:
        verbose_name = 'Bestellposition'
        verbose_name_plural = 'Bestellpositionen'
        ordering = ['order', 'position']
    
    def __str__(self):
        return f"{self.order.order_number} - Pos. {self.position}: {self.name}"
    
    @property
    def total_price(self):
        """Gesamtpreis dieser Position"""
        return self.final_price * self.quantity
