from django.db import models
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()


class Supplier(models.Model):
    """
    Lieferanten Hauptmodell
    """
    company_name = models.CharField(max_length=200, verbose_name='Firmenname')
    address = models.TextField(blank=True, verbose_name='Adresse')
    email = models.EmailField(blank=True, verbose_name='E-Mail')
    phone = models.CharField(max_length=50, blank=True, verbose_name='Telefonnummer')
    
    # Metadaten
    notes = models.TextField(blank=True, verbose_name='Notizen')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='suppliers_created')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Lieferant'
        verbose_name_plural = 'Lieferanten'
        ordering = ['company_name']
    
    def __str__(self):
        return self.company_name


class SupplierContact(models.Model):
    """
    Kontaktinformationen für verschiedene Bereiche eines Lieferanten
    """
    CONTACT_TYPE_CHOICES = [
        ('service', 'Service'),
        ('sales', 'Vertrieb'),
        ('orders', 'Bestellungen'),
    ]
    
    supplier = models.ForeignKey(
        Supplier, 
        on_delete=models.CASCADE, 
        related_name='contacts',
        verbose_name='Lieferant'
    )
    contact_type = models.CharField(
        max_length=20, 
        choices=CONTACT_TYPE_CHOICES,
        verbose_name='Kontakttyp'
    )
    
    # Kontaktperson
    contact_person = models.CharField(max_length=200, blank=True, verbose_name='Ansprechpartner')
    contact_function = models.CharField(max_length=100, blank=True, verbose_name='Funktion')
    
    # Kontaktdaten
    address = models.TextField(blank=True, verbose_name='Adresse')
    email = models.EmailField(blank=True, verbose_name='E-Mail')
    phone = models.CharField(max_length=50, blank=True, verbose_name='Telefonnummer')
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Lieferanten-Kontakt'
        verbose_name_plural = 'Lieferanten-Kontakte'
        ordering = ['contact_type', 'contact_person']
    
    def __str__(self):
        return f"{self.supplier.company_name} - {self.get_contact_type_display()}: {self.contact_person}"


class TradingProduct(models.Model):
    """
    Handelswaren die von Lieferanten bezogen werden
    """
    
    # Kategorie Choices
    CATEGORY_CHOICES = [
        ('SOFTWARE', 'Software'),
        ('MIKROSKOPE', 'Mikroskope'),
        ('BELEUCHTUNG', 'Beleuchtung'),
        ('KAMERAS', 'Kameras'),
        ('CONFOCALS', 'Confocals'),
        ('PERIPHERALS', 'Peripherals'),
    ]
    
    # Grundinformationen
    name = models.CharField(max_length=200, verbose_name='Produktname')
    visitron_part_number = models.CharField(
        max_length=100, 
        unique=True, 
        verbose_name='Visitron Partnummer'
    )
    supplier_part_number = models.CharField(
        max_length=100, 
        blank=True,
        verbose_name='Händler-Partnummer'
    )
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        blank=True,
        null=True,
        verbose_name='Kategorie'
    )
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    # Lieferant
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='trading_products',
        verbose_name='Lieferant'
    )
    
    # Preisinformationen
    list_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Lieferanten-Listenpreis'
    )
    list_price_currency = models.CharField(
        max_length=3, 
        default='EUR', 
        verbose_name='Listenpreis Währung',
        help_text='EUR, USD, CHF, etc.'
    )
    
    # Wechselkurs für Listenpreis nach EUR
    exchange_rate = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        default=Decimal('1.0'),
        verbose_name='Wechselkurs zu EUR',
        help_text='Wechselkurs von Listenpreis-Währung zu EUR'
    )
    
    # Visitron-Listenpreis Berechnung
    markup_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Aufschlag %',
        help_text='Aufschlag auf Einkaufspreis für Visitron-Listenpreis'
    )
    
    # Standardwährung für Kosten und interne Preise
    costs_currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Kostenw ährung',
        help_text='Währung für Versand-, Import-, Handling- und Lagerkosten'
    )
    
    # Preisgültigkeit
    price_valid_from = models.DateField(verbose_name='Preis gültig von')
    price_valid_until = models.DateField(
        null=True, 
        blank=True, 
        verbose_name='Preis gültig bis'
    )
    
    # Rabatt
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Rabatt (%)',
        help_text='Rabatt in Prozent'
    )
    
    # Zusätzliche Kosten
    shipping_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Versandkosten'
    )
    shipping_cost_is_percent = models.BooleanField(
        default=False,
        verbose_name='Versandkosten in %'
    )
    
    import_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Importkosten'
    )
    import_cost_is_percent = models.BooleanField(
        default=False,
        verbose_name='Importkosten in %'
    )
    
    handling_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Handlingkosten'
    )
    handling_cost_is_percent = models.BooleanField(
        default=False,
        verbose_name='Handlingkosten in %'
    )
    
    storage_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Lagerkosten'
    )
    storage_cost_is_percent = models.BooleanField(
        default=False,
        verbose_name='Lagerkosten in %'
    )
    
    # Weitere Produktinformationen
    unit = models.CharField(max_length=50, default='Stück', verbose_name='Einheit')
    minimum_stock = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        verbose_name='Mindestbestand'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Handelsware'
        verbose_name_plural = 'Handelswaren'
        ordering = ['visitron_part_number']
    
    def __str__(self):
        return f"{self.visitron_part_number} - {self.name}"
    
    def calculate_purchase_price(self):
        """
        Berechnet den Einkaufspreis mit allen Kosten und Rabatten
        Verwendet exchange_rate Feld des Modells für die Umrechnung
        """
        from decimal import Decimal
        
        # Basispreis nach Rabatt
        base_price = self.list_price * (Decimal('1') - self.discount_percent / Decimal('100'))
        
        # Zusätzliche Kosten berechnen
        shipping = self.shipping_cost if not self.shipping_cost_is_percent else base_price * (self.shipping_cost / Decimal('100'))
        import_c = self.import_cost if not self.import_cost_is_percent else base_price * (self.import_cost / Decimal('100'))
        handling = self.handling_cost if not self.handling_cost_is_percent else base_price * (self.handling_cost / Decimal('100'))
        storage = self.storage_cost if not self.storage_cost_is_percent else base_price * (self.storage_cost / Decimal('100'))
        
        # Gesamtpreis (Einkaufspreis)
        total = base_price + shipping + import_c + handling + storage
        
        # Wechselkurs anwenden
        return total * self.exchange_rate
    
    def calculate_visitron_list_price(self):
        """
        Berechnet den Visitron-Listenpreis basierend auf Einkaufspreis + Aufschlag
        Wird auf volle Euros gerundet
        """
        from decimal import Decimal, ROUND_UP
        
        # Einkaufspreis berechnen
        purchase_price = self.calculate_purchase_price()
        
        # Aufschlag anwenden
        markup_factor = Decimal('1') + (self.markup_percent / Decimal('100'))
        visitron_price = purchase_price * markup_factor
        
        # Auf volle Euros aufrunden
        return visitron_price.quantize(Decimal('1'), rounding=ROUND_UP)


class SupplierProduct(models.Model):
    """
    Verknüpfungstabelle zwischen Lieferanten und Produkten mit zusätzlichen Informationen
    """
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='supplier_products',
        verbose_name='Lieferant'
    )
    product = models.ForeignKey(
        TradingProduct,
        on_delete=models.CASCADE,
        related_name='supplier_products',
        verbose_name='Produkt'
    )
    
    # Lieferantenspezifische Produktinformationen
    supplier_article_number = models.CharField(
        max_length=100, 
        blank=True,
        verbose_name='Lieferanten-Artikelnummer'
    )
    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Einkaufspreis'
    )
    currency = models.CharField(max_length=3, default='EUR', verbose_name='Währung')
    delivery_time_days = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Lieferzeit (Tage)'
    )
    minimum_order_quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
        verbose_name='Mindestbestellmenge'
    )
    
    is_preferred_supplier = models.BooleanField(
        default=False,
        verbose_name='Bevorzugter Lieferant'
    )
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Lieferanten-Produkt'
        verbose_name_plural = 'Lieferanten-Produkte'
        unique_together = ['supplier', 'product']
        ordering = ['-is_preferred_supplier', 'supplier__company_name']
    
    def __str__(self):
        return f"{self.supplier.company_name} - {self.product.name}"
