from django.db import models
from django.contrib.auth import get_user_model
from customers.models import Customer
from datetime import datetime
import os

User = get_user_model()


def customer_order_document_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1]
    if instance.order_number:
        new_filename = f"{instance.order_number}_{filename}"
    else:
        new_filename = filename
    return f"customer_orders/documents/{datetime.now().strftime('%Y/%m')}/{new_filename}"


class CustomerOrder(models.Model):
    STATUS_CHOICES = [
        ('angelegt', 'Angelegt'),
        ('bestaetigt', 'Bestätigt'),
        ('in_produkt', 'In Produktion'),
        ('geliefert', 'Geliefert'),
        ('abgeschlossen', 'Abgeschlossen'),
        ('storniert', 'Storniert'),
    ]

    order_number = models.CharField(max_length=20, unique=True, null=True, blank=True, editable=False)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='angelegt')
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='customer_orders')
    project_reference = models.CharField(max_length=200, blank=True)
    system_reference = models.CharField(max_length=200, blank=True)

    order_date = models.DateField(null=True, blank=True)
    delivery_date = models.DateField(null=True, blank=True)

    customer_document = models.FileField(upload_to=customer_order_document_upload_path, blank=True, null=True)

    # Neue Felder für Bestellinformationen
    customer_order_number = models.CharField(max_length=100, blank=True, verbose_name='Kundenbestellnummer')
    customer_name = models.CharField(max_length=200, blank=True, verbose_name='Name des Bestellers')
    
    # Adressen als JSON gespeichert
    confirmation_address = models.JSONField(blank=True, null=True, verbose_name='Bestätigungsadresse')
    shipping_address = models.JSONField(blank=True, null=True, verbose_name='Versandadresse') 
    billing_address = models.JSONField(blank=True, null=True, verbose_name='Rechnungsadresse')
    
    # E-Mail-Adressen
    confirmation_email = models.EmailField(blank=True, verbose_name='Bestätigungs-E-Mail')
    billing_email = models.EmailField(blank=True, verbose_name='Rechnungs-E-Mail')
    
    # Bemerkungen
    notes = models.TextField(blank=True, verbose_name='Bemerkungen')
    
    # Umsatzsteuer-ID
    vat_id = models.CharField(max_length=50, blank=True, verbose_name='Umsatzsteuer-ID')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='customer_orders_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Kundenauftrag'
        verbose_name_plural = 'Kundenaufträge'
        ordering = ['-created_at']

    def __str__(self):
        return self.order_number or f'Kundenauftrag #{self.id}'

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self._generate_order_number()
        super().save(*args, **kwargs)

    def _generate_order_number(self):
        """
        Generate number O-001-01/25: O-<running 3 digits>-<month>/<yy>, running per calendar year
        """
        now = datetime.now()
        month = now.strftime('%m')
        year = now.strftime('%y')
        prefix = 'O'

        year_suffix = f"/{year}"
        existing = CustomerOrder.objects.filter(order_number__startswith=f"{prefix}-", order_number__endswith=year_suffix).order_by('-order_number')
        if existing.exists():
            last = existing.first().order_number
            try:
                parts = last.split('-')
                running = int(parts[1]) + 1
            except Exception:
                running = 1
        else:
            running = 1

        return f"{prefix}-{running:03d}-{month}/{year}"


class CustomerOrderItem(models.Model):
    order = models.ForeignKey(CustomerOrder, on_delete=models.CASCADE, related_name='items')
    article_number = models.CharField(max_length=100, blank=True)
    name = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit = models.CharField(max_length=50, default='Stück')
    list_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    final_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='EUR')
    position = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Kundenauftragsposition'
        verbose_name_plural = 'Kundenauftragspositionen'
        ordering = ['order', 'position']

    def __str__(self):
        return f"{self.order.order_number} - Pos {self.position}: {self.name}"
