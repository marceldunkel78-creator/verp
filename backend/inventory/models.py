from django.db import models
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()


class IncomingGoods(models.Model):
    """
    Wareneingang - Zwischenspeicherung gelieferter Waren vor der Einlagerung
    """
    
    ITEM_FUNCTION_CHOICES = [
        ('TRADING_GOOD', 'Handelsware'),
        ('ASSET', 'Asset'),
        ('MATERIAL', 'Material'),
    ]
    
    # Verknüpfung zur Bestellposition
    order_item = models.ForeignKey(
        'orders.OrderItem',
        on_delete=models.CASCADE,
        related_name='incoming_goods',
        verbose_name='Bestellposition'
    )
    
    # Artikel-Grundinformationen (aus OrderItem)
    article_number = models.CharField(
        max_length=100,
        verbose_name='Artikelnummer'
    )
    
    name = models.CharField(
        max_length=500,
        verbose_name='Produktname'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    
    # Lieferinformationen
    delivered_quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Gelieferte Menge'
    )
    
    unit = models.CharField(
        max_length=50,
        default='Stück',
        verbose_name='Einheit'
    )
    
    # Einkaufspreis pro Stück
    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Einkaufspreis pro Stück'
    )
    
    currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Währung'
    )
    
    # Warenfunktion (editierbar im Wareneingang)
    item_function = models.CharField(
        max_length=20,
        choices=ITEM_FUNCTION_CHOICES,
        default='TRADING_GOOD',
        verbose_name='Warenfunktion'
    )
    
    # Warenkategorie (editierbar im Wareneingang, abhängig von item_function)
    item_category = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Warenkategorie',
        help_text='Abhängig von Warenfunktion: z.B. Software, Mikroskope für Trading Good; Rohstoff, Hilfsstoff, Betriebsstoff für M&S'
    )
    
    # Seriennummer (nur für Handelsware und Asset, aber nicht für Material-Kategorien Rohstoff/Hilfsstoff/Betriebsstoff)
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Seriennummer',
        help_text='Für Handelsware und Asset erforderlich; nicht für Material-Kategorien'
    )
    
    # Verknüpfungen zu Original-Produkten
    trading_product = models.ForeignKey(
        'suppliers.TradingProduct',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Trading Product'
    )
    
    material_supply = models.ForeignKey(
        'suppliers.MaterialSupply',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Material Supply'
    )
    
    # Bestellinformationen (aus Order und OrderItem)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        verbose_name='Lieferant'
    )
    
    order_number = models.CharField(
        max_length=20,
        verbose_name='Bestellnummer'
    )
    
    customer_order_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Kundenauftragsnummer'
    )
    
    # Management Info (Project, Systems, etc.) - aus OrderItem
    management_info = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        verbose_name='Management Info',
        help_text='Projekt, System, etc.'
    )
    
    # Status
    is_transferred = models.BooleanField(
        default=False,
        verbose_name='Ins Lager überführt'
    )
    
    transferred_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Überführt am'
    )
    
    transferred_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transferred_incoming_goods',
        verbose_name='Überführt von'
    )
    
    # Metadaten
    received_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Empfangen am'
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='incoming_goods_created',
        verbose_name='Erstellt von'
    )
    
    class Meta:
        verbose_name = 'Wareneingang'
        verbose_name_plural = 'Wareneingänge'
        ordering = ['-received_at']
    
    def __str__(self):
        return f"{self.order_number} - {self.name} ({self.delivered_quantity} {self.unit})"


class InventoryItem(models.Model):
    """
    Warenlager - Alle im Lager befindlichen Waren
    """
    
    STATUS_CHOICES = [
        ('AUF_LAGER', 'Auf Lager'),
        ('RMA', 'RMA'),
        ('BEI_KUNDE', 'Bei Kunde'),
    ]
    
    ITEM_FUNCTION_CHOICES = [
        ('TRADING_GOOD', 'Handelsware'),
        ('ASSET', 'Asset'),
        ('MATERIAL', 'Material'),
    ]
    
    # Inventarnummer (automatisch generiert: I-00001)
    inventory_number = models.CharField(
        max_length=10,
        unique=True,
        editable=False,
        verbose_name='Inventarnummer',
        help_text='Format: I-00001'
    )
    
    # Artikel-Grundinformationen
    article_number = models.CharField(
        max_length=100,
        verbose_name='Lieferanten-Artikelnummer'
    )
    
    visitron_part_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Visitron-Artikelnummer'
    )
    
    name = models.CharField(
        max_length=500,
        verbose_name='Produktname'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    
    # Warenfunktion und Kategorie
    item_function = models.CharField(
        max_length=20,
        choices=ITEM_FUNCTION_CHOICES,
        verbose_name='Warenfunktion'
    )
    
    item_category = models.CharField(
        max_length=50,
        verbose_name='Warenkategorie'
    )
    
    # Seriennummer (nur bei einzelnen Instanzen)
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Seriennummer',
        help_text='Für einzelne Instanzen (Handelsware, Asset)'
    )
    
    # Menge (nur bei Waren ohne Seriennummer)
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
        verbose_name='Stückzahl',
        help_text='Anzahl für Waren ohne Seriennummer'
    )
    
    unit = models.CharField(
        max_length=50,
        default='Stück',
        verbose_name='Einheit'
    )
    
    # Einkaufsinformationen
    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Einkaufspreis pro Stück'
    )
    
    currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Währung'
    )
    
    # Lieferant
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='inventory_items',
        verbose_name='Lieferant'
    )
    
    # Verknüpfungen zu Original-Produkten
    trading_product = models.ForeignKey(
        'suppliers.TradingProduct',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Trading Product'
    )
    
    material_supply = models.ForeignKey(
        'suppliers.MaterialSupply',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Material Supply'
    )
    
    # Bestellinformationen
    order_number = models.CharField(
        max_length=20,
        verbose_name='Bestellnummer'
    )
    
    customer_order_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Kundenauftragsnummer'
    )
    
    # Management Info (Project, Systems, Kunde, etc.)
    management_info = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        verbose_name='Management Info',
        help_text='Projekt, System, Kunde, etc.'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='AUF_LAGER',
        verbose_name='Status'
    )
    
    # Metadaten
    stored_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Eingelagert am'
    )
    
    stored_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='inventory_items_stored',
        verbose_name='Eingelagert von'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    
    class Meta:
        verbose_name = 'Lagerartikel'
        verbose_name_plural = 'Lagerartikel'
        ordering = ['-stored_at']
        indexes = [
            models.Index(fields=['inventory_number']),
            models.Index(fields=['article_number']),
            models.Index(fields=['visitron_part_number']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['status']),
            models.Index(fields=['item_function']),
            models.Index(fields=['item_category']),
        ]
    
    def __str__(self):
        if self.serial_number:
            return f"{self.inventory_number} - {self.name} (SN: {self.serial_number})"
        return f"{self.inventory_number} - {self.name} ({self.quantity} {self.unit})"
    
    def save(self, *args, **kwargs):
        # Generiere Inventarnummer beim ersten Speichern
        if not self.inventory_number:
            self.inventory_number = self._generate_inventory_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_inventory_number():
        """Generiert die nächste freie Inventarnummer: I-00001"""
        existing_numbers = InventoryItem.objects.filter(
            inventory_number__startswith='I-'
        ).values_list('inventory_number', flat=True)
        
        if not existing_numbers:
            return 'I-00001'
        
        # Extrahiere Nummern und finde Maximum
        numeric_numbers = []
        for num in existing_numbers:
            try:
                # Format: I-00001 -> 00001 -> 1
                numeric_part = num.split('-')[1]
                numeric_numbers.append(int(numeric_part))
            except (IndexError, ValueError):
                continue
        
        if not numeric_numbers:
            return 'I-00001'
        
        next_number = max(numeric_numbers) + 1
        return f"I-{str(next_number).zfill(5)}"
