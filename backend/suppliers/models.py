from django.db import models
from django.contrib.auth import get_user_model

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


class ProductCategory(models.Model):
    """
    Produktkategorien für bessere Organisation
    """
    name = models.CharField(max_length=100, unique=True, verbose_name='Name')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    class Meta:
        verbose_name = 'Produktkategorie'
        verbose_name_plural = 'Produktkategorien'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class TradingProduct(models.Model):
    """
    Vertriebswaren die mit Lieferanten verknüpft werden können
    """
    name = models.CharField(max_length=200, verbose_name='Produktname')
    article_number = models.CharField(max_length=100, unique=True, verbose_name='Artikelnummer')
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        verbose_name='Kategorie'
    )
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    
    # Lieferantenverknüpfung
    suppliers = models.ManyToManyField(
        Supplier,
        through='SupplierProduct',
        related_name='trading_products',
        verbose_name='Lieferanten'
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
        verbose_name = 'Vertriebsware'
        verbose_name_plural = 'Vertriebswaren'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.article_number} - {self.name}"


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
