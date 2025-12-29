from django.db import models
from django.contrib.auth import get_user_model
from decimal import Decimal, ROUND_UP

User = get_user_model()


class Supplier(models.Model):
    """
    Lieferanten Hauptmodell
    """
    supplier_number = models.CharField(
        max_length=3, 
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Lieferantennummer',
        help_text='Automatisch generierte 3-stellige Nummer'
    )
    company_name = models.CharField(max_length=200, verbose_name='Firmenname')
    
    # Adresse Felder
    street = models.CharField(max_length=200, blank=True, verbose_name='Straße')
    house_number = models.CharField(max_length=20, blank=True, verbose_name='Hausnummer')
    address_supplement = models.CharField(max_length=200, blank=True, verbose_name='Adresszusatz')
    postal_code = models.CharField(max_length=20, blank=True, verbose_name='PLZ')
    city = models.CharField(max_length=100, blank=True, verbose_name='Ort')
    state = models.CharField(max_length=100, blank=True, verbose_name='Bundesland/Provinz')
    country = models.CharField(max_length=2, blank=True, default='DE', verbose_name='Land', help_text='ISO 3166-1 Alpha-2 Code')
    
    # Legacy field - wird durch neue Felder ersetzt
    address = models.TextField(blank=True, verbose_name='Adresse (veraltet)', help_text='Wird durch neue Adressfelder ersetzt')
    
    email = models.EmailField(blank=True, verbose_name='E-Mail')
    phone = models.CharField(max_length=50, blank=True, verbose_name='Telefonnummer')
    website = models.URLField(max_length=500, blank=True, verbose_name='Website')
    
    # Bestellrelevante Felder
    customer_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Unsere Kundennummer',
        help_text='Unsere Kundennummer beim Lieferanten'
    )
    
    payment_term = models.ForeignKey(
        'verp_settings.PaymentTerm',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='suppliers',
        verbose_name='Zahlungsbedingung'
    )
    
    delivery_term = models.ForeignKey(
        'verp_settings.DeliveryTerm',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='suppliers',
        verbose_name='Lieferbedingung (Incoterm)'
    )
    
    delivery_instruction = models.ForeignKey(
        'verp_settings.DeliveryInstruction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='suppliers',
        verbose_name='Lieferanweisung'
    )
    
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
        return f"{self.supplier_number} - {self.company_name}" if self.supplier_number else self.company_name
    
    def save(self, *args, **kwargs):
        # Generiere supplier_number beim ersten Speichern
        if not self.supplier_number:
            self.supplier_number = self._generate_supplier_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_supplier_number():
        """Generiert die nächste freie 3-stellige Lieferantennummer"""
        # Finde die höchste existierende Nummer
        existing_numbers = Supplier.objects.filter(
            supplier_number__isnull=False
        ).values_list('supplier_number', flat=True)
        
        if not existing_numbers:
            return '100'  # Starte bei 100
        
        # Konvertiere zu Integers und finde Maximum
        numeric_numbers = [int(num) for num in existing_numbers if num.isdigit()]
        if not numeric_numbers:
            return '100'
        
        next_number = max(numeric_numbers) + 1
        return str(next_number).zfill(3)  # Mit Nullen auf 3 Stellen auffüllen


class SupplierContact(models.Model):
    """
    Kontaktinformationen für verschiedene Bereiche eines Lieferanten
    """
    CONTACT_TYPE_CHOICES = [
        ('service', 'Service'),
        ('sales', 'Vertrieb'),
        ('orders', 'Bestellungen'),
        ('order_processing', 'Auftragsabwicklung'),
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
    
    # Adresse Felder
    street = models.CharField(max_length=200, blank=True, verbose_name='Straße')
    house_number = models.CharField(max_length=20, blank=True, verbose_name='Hausnummer')
    address_supplement = models.CharField(max_length=200, blank=True, verbose_name='Adresszusatz')
    postal_code = models.CharField(max_length=20, blank=True, verbose_name='PLZ')
    city = models.CharField(max_length=100, blank=True, verbose_name='Ort')
    state = models.CharField(max_length=100, blank=True, verbose_name='Bundesland/Provinz')
    country = models.CharField(max_length=2, blank=True, default='DE', verbose_name='Land', help_text='ISO 3166-1 Alpha-2 Code')
    
    # Legacy field
    address = models.TextField(blank=True, verbose_name='Adresse (veraltet)', help_text='Wird durch neue Adressfelder ersetzt')
    
    email = models.EmailField(blank=True, verbose_name='E-Mail')
    phone = models.CharField(max_length=50, blank=True, verbose_name='Telefonnummer')
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Lieferanten-Kontakt'
        verbose_name_plural = 'Lieferanten-Kontakte'
        ordering = ['contact_type', 'contact_person']
        constraints = [
            models.UniqueConstraint(
                fields=['supplier', 'contact_type'],
                condition=models.Q(contact_type='orders'),
                name='unique_orders_contact_per_supplier'
            )
        ]
    
    def __str__(self):
        return f"{self.supplier.company_name} - {self.get_contact_type_display()}: {self.contact_person}"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        # Prüfe ob bereits ein Bestellungen-Kontakt existiert
        if self.contact_type == 'orders':
            existing = SupplierContact.objects.filter(
                supplier=self.supplier,
                contact_type='orders'
            ).exclude(pk=self.pk if self.pk else None)
            
            if existing.exists():
                raise ValidationError({
                    'contact_type': 'Es kann nur ein Bestellungen-Kontakt pro Lieferant existieren.'
                })


class ProductGroup(models.Model):
    """
    Warengruppen eines Lieferanten mit zugewiesenen Rabatten
    """
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='product_groups',
        verbose_name='Lieferant'
    )
    name = models.CharField(max_length=200, verbose_name='Warengruppe')
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Rabatt (%)'
    )
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Warengruppe'
        verbose_name_plural = 'Warengruppen'
        ordering = ['supplier', 'name']
        unique_together = ['supplier', 'name']
    
    def __str__(self):
        return f"{self.supplier.company_name} - {self.name} ({self.discount_percent}%)"


class PriceList(models.Model):
    """
    Preislisten eines Lieferanten mit Gültigkeitszeitraum
    """
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='price_lists',
        verbose_name='Lieferant'
    )
    name = models.CharField(max_length=200, verbose_name='Preisliste')
    valid_from = models.DateField(verbose_name='Gültig von')
    valid_until = models.DateField(null=True, blank=True, verbose_name='Gültig bis')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Preisliste'
        verbose_name_plural = 'Preislisten'
        ordering = ['supplier', '-valid_from']
    
    def __str__(self):
        valid_until_str = self.valid_until.strftime('%d.%m.%Y') if self.valid_until else 'unbeschränkt'
        return f"{self.supplier.company_name} - {self.name} ({self.valid_from.strftime('%d.%m.%Y')} - {valid_until_str})"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        from django.db.models import Q
        
        # Prüfe ob es überlappende Preislisten gibt
        overlapping = PriceList.objects.filter(supplier=self.supplier, is_active=True)
        
        if self.pk:
            overlapping = overlapping.exclude(pk=self.pk)
        
        for pl in overlapping:
            # Fall 1: Neue Liste hat kein Enddatum
            if not self.valid_until:
                if not pl.valid_until or pl.valid_until >= self.valid_from:
                    raise ValidationError(
                        f'Es gibt bereits eine gültige Preisliste "{pl.name}" für diesen Zeitraum.'
                    )
            # Fall 2: Neue Liste hat Enddatum
            else:
                # Andere Liste hat kein Enddatum und beginnt vor oder am Ende der neuen Liste
                if not pl.valid_until and pl.valid_from <= self.valid_until:
                    raise ValidationError(
                        f'Es gibt bereits eine gültige Preisliste "{pl.name}" für diesen Zeitraum.'
                    )
                # Beide Listen haben Enddatum - prüfe auf Überlappung
                if pl.valid_until and not (
                    self.valid_until < pl.valid_from or self.valid_from > pl.valid_until
                ):
                    raise ValidationError(
                        f'Es gibt bereits eine gültige Preisliste "{pl.name}" für diesen Zeitraum.'
                    )


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
        ('DIENSTLEISTUNG', 'Dienstleistung'),
        ('LICHTQUELLEN', 'Lichtquellen'),
        ('SCANNING_BELEUCHTUNG', 'Scanning- und Beleuchtungsmodule'),
        ('PERIPHERALS', 'Peripherals'),
    ]
    
    # Grundinformationen
    name = models.CharField(max_length=200, verbose_name='Produktname')
    visitron_part_number = models.CharField(
        max_length=100, 
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Visitron Partnummer',
        help_text='Automatisch generiert: Lieferantennummer-laufende Nummer (z.B. 100-00001)'
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
    description_en = models.TextField(
        blank=True,
        verbose_name='Beschreibung (Englisch)',
        help_text='English description for international quotations'
    )
    short_description = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Kurzbeschreibung',
        help_text='Kurze Beschreibung für Bestellungen'
    )
    short_description_en = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Kurzbeschreibung (Englisch)',
        help_text='Short English description for orders'
    )
    
    # Lieferant
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='trading_products',
        verbose_name='Lieferant'
    )
    
    # Warengruppe
    product_group = models.ForeignKey(
        ProductGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        verbose_name='Warengruppe'
    )
    
    # Preisliste
    price_list = models.ForeignKey(
        PriceList,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        verbose_name='Preisliste'
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
    margin_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Marge %',
        help_text='Marge in % für Visitron-Listenpreis (VLP = EK / (1 - Marge/100))'
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
    
    # Release-Manual Upload
    release_manual = models.FileField(
        upload_to='TradingProducts/manuals/',
        blank=True,
        null=True,
        verbose_name='Release-Manual',
        help_text='Freigegebenes Handbuch zum Produkt'
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
    
    def save(self, *args, **kwargs):
        # Generiere visitron_part_number beim ersten Speichern
        if not self.visitron_part_number and self.supplier:
            self.visitron_part_number = self._generate_visitron_part_number()
        super().save(*args, **kwargs)
    
    def _generate_visitron_part_number(self):
        """Generiert die nächste Visitron-Partnummer für diesen Lieferanten"""
        if not self.supplier or not self.supplier.supplier_number:
            raise ValueError("Lieferant muss eine supplier_number haben")
        
        # Finde alle existierenden Partnummern für diesen Lieferanten
        prefix = self.supplier.supplier_number
        existing_numbers = TradingProduct.objects.filter(
            visitron_part_number__startswith=f"{prefix}-"
        ).values_list('visitron_part_number', flat=True)
        
        # Extrahiere die 4-stelligen Nummern
        suffix_numbers = []
        for number in existing_numbers:
            parts = number.split('-')
            if len(parts) == 2 and parts[1].isdigit():
                suffix_numbers.append(int(parts[1]))
        
        # Finde die nächste freie Nummer
        if not suffix_numbers:
            next_suffix = 1
        else:
            next_suffix = max(suffix_numbers) + 1
        
        # Format: XXX-YYYYY (3-stellig-5-stellig)
        return f"{prefix}-{str(next_suffix).zfill(5)}"
    
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
        Berechnet den Visitron-Listenpreis basierend auf Marge
        Formel: VLP = EK / (1 - Marge/100)
        Wird auf volle Euros gerundet
        """
        from decimal import Decimal, ROUND_UP
        
        # Einkaufspreis berechnen
        purchase_price = self.calculate_purchase_price()
        
        # Marge anwenden: VLP = EK / (1 - Marge/100)
        if self.margin_percent >= Decimal('100'):
            # Bei Marge >= 100% würde Division durch 0 auftreten
            # In diesem Fall setzen wir einen sehr hohen Preis
            visitron_price = purchase_price * Decimal('10')  # 10x Einkaufspreis als Obergrenze
        else:
            margin_divisor = Decimal('1') - (self.margin_percent / Decimal('100'))
            visitron_price = purchase_price / margin_divisor
        
        # Auf volle Euros aufrunden
        return visitron_price.quantize(Decimal('1'), rounding=ROUND_UP)
    
    def get_current_price(self):
        """Gibt den aktuell gültigen Preis-Eintrag zurück"""
        from django.utils import timezone
        today = timezone.now().date()
        return self.price_history.filter(
            valid_from__lte=today
        ).filter(
            models.Q(valid_until__isnull=True) | models.Q(valid_until__gte=today)
        ).order_by('-valid_from').first()


class TradingProductPrice(models.Model):
    """
    Preishistorie für Trading Products mit Gültigkeitszeitraum
    EK = Einkaufspreis (berechnet), LP/VK = Listenpreis/Verkaufspreis
    """
    product = models.ForeignKey(
        TradingProduct,
        on_delete=models.CASCADE,
        related_name='price_history',
        verbose_name='Trading Product'
    )
    
    # Lieferanten-Listenpreis (Basis für Berechnung)
    supplier_list_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Lieferanten-Listenpreis',
        help_text='Original-Listenpreis des Lieferanten'
    )
    supplier_currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Listenpreis-Währung'
    )
    exchange_rate = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        default=Decimal('1.0'),
        verbose_name='Wechselkurs zu EUR'
    )
    
    # Rabatte und Kosten
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Rabatt (%)'
    )
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Versandkosten')
    shipping_cost_is_percent = models.BooleanField(default=False, verbose_name='Versandkosten in %')
    import_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Importkosten')
    import_cost_is_percent = models.BooleanField(default=False, verbose_name='Importkosten in %')
    handling_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Handlingkosten')
    handling_cost_is_percent = models.BooleanField(default=False, verbose_name='Handlingkosten in %')
    storage_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Lagerkosten')
    storage_cost_is_percent = models.BooleanField(default=False, verbose_name='Lagerkosten in %')
    
    # Marge für VLP-Berechnung
    margin_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Marge (%)',
        help_text='Marge für Visitron-Listenpreis'
    )
    
    # Berechnete Preise (zum Zeitpunkt der Erstellung gespeichert)
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Einkaufspreis (EK)',
        help_text='Berechneter Einkaufspreis in EUR'
    )
    list_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Visitron-Listenpreis (LP/VK)',
        help_text='Berechneter Verkaufspreis für Angebote in EUR'
    )
    
    # Gültigkeit
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
        related_name='trading_product_prices_created'
    )
    
    class Meta:
        verbose_name = 'Trading Product Preis'
        verbose_name_plural = 'Trading Product Preise'
        ordering = ['product', '-valid_from']
    
    def __str__(self):
        return f"{self.product.visitron_part_number}: EK {self.purchase_price}€ / LP {self.list_price}€ ab {self.valid_from}"
    
    def calculate_prices(self):
        """Berechnet EK und VLP basierend auf den eingegebenen Werten"""
        # Basispreis nach Rabatt
        base_price = self.supplier_list_price * (Decimal('1') - self.discount_percent / Decimal('100'))
        
        # Zusätzliche Kosten berechnen
        shipping = self.shipping_cost if not self.shipping_cost_is_percent else base_price * (self.shipping_cost / Decimal('100'))
        import_c = self.import_cost if not self.import_cost_is_percent else base_price * (self.import_cost / Decimal('100'))
        handling = self.handling_cost if not self.handling_cost_is_percent else base_price * (self.handling_cost / Decimal('100'))
        storage = self.storage_cost if not self.storage_cost_is_percent else base_price * (self.storage_cost / Decimal('100'))
        
        # Einkaufspreis (mit Wechselkurs)
        self.purchase_price = (base_price + shipping + import_c + handling + storage) * self.exchange_rate
        
        # Visitron-Listenpreis mit Marge
        if self.margin_percent >= Decimal('100'):
            self.list_price = self.purchase_price * Decimal('10')
        else:
            margin_divisor = Decimal('1') - (self.margin_percent / Decimal('100'))
            self.list_price = (self.purchase_price / margin_divisor).quantize(Decimal('1'), rounding=ROUND_UP)
    
    def save(self, *args, **kwargs):
        # Preise berechnen vor dem Speichern
        self.calculate_prices()
        super().save(*args, **kwargs)


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


# Asset model removed — Assets no longer part of the domain. The model and its methods were deleted as part of the removal.


class MaterialSupply(models.Model):
    """
    Material & Supplies - Roh-, Hilfs- und Betriebsstoffe
    Ähnlich wie TradingProduct, aber ohne Verkaufspreise
    """
    CATEGORY_CHOICES = [
        ('ROHSTOFF', 'Rohstoff'),
        ('HILFSSTOFF', 'Hilfsstoff'),
        ('BETRIEBSSTOFF', 'Betriebsstoff'),
    ]
    
    name = models.CharField(max_length=200, verbose_name='Name')
    visitron_part_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        verbose_name='Visitron Partnummer',
        help_text='Automatisch generiert: Lieferantennummer-M-laufende Nummer (z.B. 100-M00001)'
    )
    supplier_part_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Lieferanten-Partnummer'
    )
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        blank=True,
        null=True,
        verbose_name='Kategorie'
    )
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    short_description = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Kurzbeschreibung',
        help_text='Kurze Beschreibung für Bestellungen'
    )
    
    # Lieferant
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='material_supplies',
        verbose_name='Lieferant'
    )
    
    # Warengruppe
    product_group = models.ForeignKey(
        ProductGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='material_supplies',
        verbose_name='Warengruppe'
    )
    
    # Preisliste
    price_list = models.ForeignKey(
        PriceList,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='material_supplies',
        verbose_name='Preisliste'
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
    
    # Standardwährung für Kosten
    costs_currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Kostenwährung',
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
        verbose_name = 'Material & Supplies'
        verbose_name_plural = 'Material & Supplies'
        ordering = ['visitron_part_number']
    
    def __str__(self):
        return f"{self.visitron_part_number} - {self.name}"
    
    def save(self, *args, **kwargs):
        # Generiere visitron_part_number beim ersten Speichern
        if not self.visitron_part_number and self.supplier:
            self.visitron_part_number = self._generate_visitron_part_number()
        super().save(*args, **kwargs)
    
    def _generate_visitron_part_number(self):
        """Generiert die nächste Visitron-Partnummer für M&S dieses Lieferanten"""
        if not self.supplier or not self.supplier.supplier_number:
            raise ValueError("Lieferant muss eine supplier_number haben")
        
        # Finde alle existierenden M&S-Partnummern für diesen Lieferanten
        # Format: XXX-MYYY (M für Material & Supplies)
        prefix = f"{self.supplier.supplier_number}-M"
        existing_numbers = MaterialSupply.objects.filter(
            visitron_part_number__startswith=prefix
        ).values_list('visitron_part_number', flat=True)
        
        # Extrahiere die Nummern nach dem "M"
        suffix_numbers = []
        for number in existing_numbers:
            parts = number.split('-M')
            if len(parts) == 2 and parts[1].isdigit():
                suffix_numbers.append(int(parts[1]))
        
        # Finde die nächste freie Nummer
        if not suffix_numbers:
            next_suffix = 1
        else:
            next_suffix = max(suffix_numbers) + 1
        
        # Format: XXX-MYYYYY (3-stellig-M-5-stellig)
        return f"{self.supplier.supplier_number}-M{str(next_suffix).zfill(5)}"
    
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
