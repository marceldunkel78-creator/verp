from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from decimal import Decimal
import re

User = get_user_model()


def vsh_document_upload_path(instance, filename):
    """Upload-Pfad: /Manufacturing/VSH-XXXXX/documents/type/filename"""
    def _sanitize(name):
        if not name:
            return ''
        name = name.replace('/', '_').replace('\\', '_').replace(' ', '_')
        return re.sub(r'[^A-Za-z0-9_.-]', '_', name)
    
    part_number = _sanitize(instance.vs_hardware.part_number) if instance.vs_hardware else 'unknown'
    doc_type = _sanitize(instance.document_type) if instance.document_type else 'other'
    safe_filename = _sanitize(filename)
    
    return f"Manufacturing/{part_number}/documents/{doc_type}/{safe_filename}"


def vsh_manual_upload_path(instance, filename):
    """Upload-Pfad: /Manufacturing/VSH-XXXXX/manuals/filename"""
    def _sanitize(name):
        if not name:
            return ''
        name = name.replace('/', '_').replace('\\', '_').replace(' ', '_')
        return re.sub(r'[^A-Za-z0-9_.-]', '_', name)
    
    part_number = _sanitize(instance.part_number) if instance.part_number else 'unknown'
    safe_filename = _sanitize(filename)
    
    return f"Manufacturing/{part_number}/manuals/{safe_filename}"


class VSHardware(models.Model):
    """
    VS-Hardware Produkte - Eigenprodukte für Angebote
    Ähnlich wie TradingProducts, aber intern gefertigt
    """
    # Artikelnummer VSH-00001
    part_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Artikelnummer',
        help_text='Automatisch generiert im Format VSH-00001'
    )
    
    name = models.CharField(max_length=200, verbose_name='Produktname')
    model_designation = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Modellbezeichnung'
    )
    description = models.TextField(blank=True, verbose_name='Beschreibung')
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
        related_name='vshardware_products',
        verbose_name='Warenkategorie'
    )
    
    # Handbücher
    release_manual = models.FileField(
        upload_to=vsh_manual_upload_path,
        blank=True,
        null=True,
        verbose_name='Release-Manual',
        help_text='Freigegebenes Handbuch'
    )
    draft_manual = models.FileField(
        upload_to=vsh_manual_upload_path,
        blank=True,
        null=True,
        verbose_name='Draft-Manual',
        help_text='Entwurf des Handbuchs'
    )
    
    # Einheit und Status
    unit = models.CharField(max_length=50, default='Stück', verbose_name='Einheit')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='vshardware_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'VS-Hardware'
        verbose_name_plural = 'VS-Hardware'
        ordering = ['part_number']
    
    def __str__(self):
        return f"{self.part_number} - {self.name}" if self.part_number else self.name
    
    def save(self, *args, **kwargs):
        if not self.part_number:
            self.part_number = self._generate_part_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_part_number():
        """Generiert die nächste freie Artikelnummer im Format VSH-00001"""
        existing_numbers = VSHardware.objects.filter(
            part_number__isnull=False
        ).values_list('part_number', flat=True)
        
        if not existing_numbers:
            return 'VSH-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'VSH-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'VSH-{next_number:05d}'
    
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


class VSHardwarePrice(models.Model):
    """
    Preise für VS-Hardware mit Gültigkeitszeitraum
    """
    vs_hardware = models.ForeignKey(
        VSHardware,
        on_delete=models.CASCADE,
        related_name='prices',
        verbose_name='VS-Hardware'
    )
    
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Einkaufspreis (EUR)',
        help_text='Kalkulierter Einkaufspreis'
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
        related_name='vshardware_prices_created'
    )
    
    class Meta:
        verbose_name = 'VS-Hardware Preis'
        verbose_name_plural = 'VS-Hardware Preise'
        ordering = ['vs_hardware', '-valid_from']
    
    def __str__(self):
        return f"{self.vs_hardware.part_number}: {self.purchase_price}€ / {self.sales_price}€ ab {self.valid_from}"
    
    def clean(self):
        """Prüft auf überlappende Gültigkeitszeiträume"""
        overlapping = VSHardwarePrice.objects.filter(vs_hardware=self.vs_hardware)
        
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


class VSHardwareMaterialItem(models.Model):
    """
    Material-Position in der Materialliste einer VS-Hardware
    Referenziert M&S Produkte mit Mengenangabe
    """
    vs_hardware = models.ForeignKey(
        VSHardware,
        on_delete=models.CASCADE,
        related_name='material_items',
        verbose_name='VS-Hardware'
    )
    
    material_supply = models.ForeignKey(
        'suppliers.MaterialSupply',
        on_delete=models.PROTECT,
        related_name='vshardware_usages',
        verbose_name='Material & Supply'
    )
    
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=1,
        verbose_name='Menge'
    )
    
    position = models.PositiveIntegerField(default=0, verbose_name='Position')
    notes = models.CharField(max_length=200, blank=True, verbose_name='Notizen')
    
    class Meta:
        verbose_name = 'Material-Position'
        verbose_name_plural = 'Material-Positionen'
        ordering = ['position', 'id']
    
    def __str__(self):
        return f"{self.vs_hardware.part_number}: {self.quantity}x {self.material_supply.name}"
    
    def get_item_cost(self):
        """Berechnet die Kosten dieser Position"""
        if self.material_supply:
            # Nutze calculate_purchase_price falls vorhanden
            unit_price = getattr(self.material_supply, 'calculate_purchase_price', lambda: self.material_supply.list_price)()
            return self.quantity * unit_price
        return Decimal('0')


class VSHardwareCostCalculation(models.Model):
    """
    Kostenkalkulation für eine VS-Hardware
    Speichert die Kalkulationsparameter und ermöglicht Preisübernahme
    """
    vs_hardware = models.ForeignKey(
        VSHardware,
        on_delete=models.CASCADE,
        related_name='cost_calculations',
        verbose_name='VS-Hardware'
    )
    
    # Arbeitszeit-Kalkulation
    labor_hours = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0,
        verbose_name='Arbeitsstunden'
    )
    labor_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('65.00'),
        verbose_name='Stundensatz (EUR)'
    )
    
    # Entwicklungskosten
    development_cost_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Gesamtentwicklungskosten (EUR)'
    )
    expected_sales_volume = models.PositiveIntegerField(
        default=1,
        verbose_name='Erwarteter Absatz (Stück)'
    )
    
    # Berechnete Werte (werden bei Speichern aktualisiert)
    material_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Materialkosten (EUR)'
    )
    labor_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Arbeitskosten (EUR)'
    )
    development_cost_per_unit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Entwicklungskosten pro Stück (EUR)'
    )
    total_purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Gesamt-Einkaufspreis (EUR)'
    )
    
    # Marge und Verkaufspreis
    margin_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('30.00'),
        verbose_name='Marge (%)'
    )
    calculated_sales_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Kalkulierter Verkaufspreis (EUR)'
    )
    
    # Metadaten
    name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Kalkulationsname',
        help_text='z.B. "Version 2024-Q1"'
    )
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='cost_calculations_created'
    )
    
    class Meta:
        verbose_name = 'Kostenkalkulation'
        verbose_name_plural = 'Kostenkalkulationen'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.vs_hardware.part_number} - {self.name or 'Kalkulation'}"
    
    def calculate_costs(self):
        """Berechnet alle Kosten basierend auf aktuellen Daten"""
        # Materialkosten aus der Materialliste
        self.material_cost = sum(
            item.get_item_cost() for item in self.vs_hardware.material_items.all()
        )
        
        # Arbeitskosten
        self.labor_cost = self.labor_hours * self.labor_rate
        
        # Entwicklungskosten pro Stück
        if self.expected_sales_volume > 0:
            self.development_cost_per_unit = self.development_cost_total / Decimal(str(self.expected_sales_volume))
        else:
            self.development_cost_per_unit = Decimal('0')
        
        # Gesamt-Einkaufspreis
        self.total_purchase_price = self.material_cost + self.labor_cost + self.development_cost_per_unit
        
        # Verkaufspreis mit Marge: VKP = EK / (1 - Marge/100)
        if self.margin_percent < Decimal('100'):
            self.calculated_sales_price = self.total_purchase_price / (Decimal('1') - self.margin_percent / Decimal('100'))
        else:
            self.calculated_sales_price = self.total_purchase_price * Decimal('10')
        
        # Auf 2 Dezimalstellen runden
        self.calculated_sales_price = self.calculated_sales_price.quantize(Decimal('0.01'))
    
    def save(self, *args, **kwargs):
        self.calculate_costs()
        super().save(*args, **kwargs)
    
    def transfer_to_price(self, valid_from, valid_until=None, user=None):
        """Überträgt die berechneten Preise als neuen VSHardwarePrice"""
        price = VSHardwarePrice(
            vs_hardware=self.vs_hardware,
            purchase_price=self.total_purchase_price,
            sales_price=self.calculated_sales_price,
            valid_from=valid_from,
            valid_until=valid_until,
            notes=f"Übernommen aus Kalkulation: {self.name or 'ID ' + str(self.pk)}",
            created_by=user
        )
        price.full_clean()  # Validiert auf Überlappungen
        price.save()
        return price


class VSHardwareDocument(models.Model):
    """
    Fertigungsdokumente für VS-Hardware
    """
    DOCUMENT_TYPE_CHOICES = [
        ('drawing', 'Zeichnung (CAD)'),
        ('assembly', 'Aufbauanleitung'),
        ('adjustment', 'Justageanleitung'),
        ('photo', 'Foto'),
        ('test_report', 'Testbericht'),
        ('other', 'Sonstiges'),
    ]
    
    vs_hardware = models.ForeignKey(
        VSHardware,
        on_delete=models.CASCADE,
        related_name='documents',
        verbose_name='VS-Hardware'
    )
    
    document_type = models.CharField(
        max_length=20,
        choices=DOCUMENT_TYPE_CHOICES,
        verbose_name='Dokumenttyp'
    )
    
    title = models.CharField(max_length=200, verbose_name='Titel')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    file = models.FileField(
        upload_to=vsh_document_upload_path,
        verbose_name='Datei'
    )
    
    version = models.CharField(max_length=50, blank=True, verbose_name='Version')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='vshardware_documents_uploaded'
    )
    
    class Meta:
        verbose_name = 'Fertigungsdokument'
        verbose_name_plural = 'Fertigungsdokumente'
        ordering = ['document_type', 'title']
    
    def __str__(self):
        return f"{self.vs_hardware.part_number} - {self.get_document_type_display()}: {self.title}"


# ============================================
# FERTIGUNGSAUFTRÄGE (Production Orders)
# ============================================

class ProductionOrderInbox(models.Model):
    """
    Fertigungsauftragseingang - empfängt VS-Hardware aus Kundenaufträgen
    """
    STATUS_CHOICES = [
        ('pending', 'Ausstehend'),
        ('accepted', 'Angenommen'),
        ('rejected', 'Abgelehnt'),
    ]
    
    # Referenz zum Kundenauftrag
    customer_order = models.ForeignKey(
        'customer_orders.CustomerOrder',
        on_delete=models.CASCADE,
        related_name='production_inbox_items',
        verbose_name='Kundenauftrag'
    )
    customer_order_item = models.ForeignKey(
        'customer_orders.CustomerOrderItem',
        on_delete=models.CASCADE,
        related_name='production_inbox_entries',
        verbose_name='Auftragsposition',
        null=True,
        blank=True
    )
    
    # VS-Hardware die gefertigt werden soll
    vs_hardware = models.ForeignKey(
        VSHardware,
        on_delete=models.PROTECT,
        related_name='production_inbox_entries',
        verbose_name='VS-Hardware'
    )
    
    quantity = models.PositiveIntegerField(default=1, verbose_name='Menge')
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='Status'
    )
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    # Metadaten
    received_at = models.DateTimeField(auto_now_add=True, verbose_name='Eingegangen am')
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name='Bearbeitet am')
    processed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_inbox_processed',
        verbose_name='Bearbeitet von'
    )
    
    class Meta:
        verbose_name = 'Fertigungsauftragseingang'
        verbose_name_plural = 'Fertigungsauftragseingänge'
        ordering = ['-received_at']
    
    def __str__(self):
        return f"Eingang {self.id}: {self.quantity}x {self.vs_hardware.part_number} aus {self.customer_order}"
    
    def accept(self, user=None):
        """Nimmt den Eingang an und erstellt einen Fertigungsauftrag"""
        from django.utils import timezone
        
        if self.status != 'pending':
            raise ValidationError('Nur ausstehende Eingänge können angenommen werden')
        
        # Erstelle Fertigungsauftrag
        order = ProductionOrder.objects.create(
            inbox_item=self,
            vs_hardware=self.vs_hardware,
            customer_order=self.customer_order,
            quantity=self.quantity,
            created_by=user
        )
        
        self.status = 'accepted'
        self.processed_at = timezone.now()
        self.processed_by = user
        self.save()
        
        return order
    
    def reject(self, user=None, reason=''):
        """Lehnt den Eingang ab"""
        from django.utils import timezone
        
        if self.status != 'pending':
            raise ValidationError('Nur ausstehende Eingänge können abgelehnt werden')
        
        self.status = 'rejected'
        self.processed_at = timezone.now()
        self.processed_by = user
        if reason:
            self.notes = f"{self.notes}\n\nAblehnungsgrund: {reason}".strip()
        self.save()


class ProductionOrder(models.Model):
    """
    Fertigungsauftrag - wird aus angenommenem Inbox-Eintrag erstellt
    """
    STATUS_CHOICES = [
        ('created', 'Erstellt'),
        ('in_progress', 'In Bearbeitung'),
        ('completed', 'Abgeschlossen'),
        ('cancelled', 'Storniert'),
    ]
    
    # Automatische Auftragsnummer
    order_number = models.CharField(
        max_length=15,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Fertigungsauftragsnummer',
        help_text='Automatisch generiert im Format FA-XXXXX'
    )
    
    # Referenzen
    inbox_item = models.OneToOneField(
        ProductionOrderInbox,
        on_delete=models.PROTECT,
        related_name='production_order',
        verbose_name='Eingangs-Eintrag',
        null=True,
        blank=True
    )
    vs_hardware = models.ForeignKey(
        VSHardware,
        on_delete=models.PROTECT,
        related_name='production_orders',
        verbose_name='VS-Hardware'
    )
    customer_order = models.ForeignKey(
        'customer_orders.CustomerOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_orders',
        verbose_name='Kundenauftrag'
    )
    
    quantity = models.PositiveIntegerField(default=1, verbose_name='Menge')
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='created',
        verbose_name='Status'
    )
    
    # Planung
    planned_start = models.DateField(null=True, blank=True, verbose_name='Geplanter Start')
    planned_end = models.DateField(null=True, blank=True, verbose_name='Geplantes Ende')
    actual_start = models.DateField(null=True, blank=True, verbose_name='Tatsächlicher Start')
    actual_end = models.DateField(null=True, blank=True, verbose_name='Tatsächliches Ende')
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='production_orders_created'
    )
    
    class Meta:
        verbose_name = 'Fertigungsauftrag'
        verbose_name_plural = 'Fertigungsaufträge'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.order_number}: {self.quantity}x {self.vs_hardware.part_number}"
    
    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self._generate_order_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_order_number():
        """Generiert die nächste freie Fertigungsauftragsnummer"""
        existing_numbers = ProductionOrder.objects.filter(
            order_number__isnull=False
        ).values_list('order_number', flat=True)
        
        if not existing_numbers:
            return 'FA-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'FA-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'FA-{next_number:05d}'
