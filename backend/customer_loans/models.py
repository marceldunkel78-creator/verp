from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings
import os

User = get_user_model()


def customer_loan_upload_path(instance, filename):
    """Upload path for customer loan documents"""
    if hasattr(instance, 'customer_loan'):
        loan_number = instance.customer_loan.loan_number
    else:
        loan_number = instance.loan_number
    return f'Inventory/CustomerLoans/{loan_number}/{filename}'


class CustomerLoan(models.Model):
    """
    Verleihungen an Kunden
    Verleih-Nummer im Format VL-00001
    """

    STATUS_CHOICES = [
        ('offen', 'Offen'),
        ('verliehen', 'Verliehen'),
        ('teilrueckgabe', 'Teilrückgabe'),
        ('abgeschlossen', 'Abgeschlossen'),
    ]

    loan_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Verleihnummer',
        help_text='Automatisch generiert im Format VL-00001'
    )

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='customer_loans',
        verbose_name='Kunde'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='offen',
        verbose_name='Status'
    )

    loan_date = models.DateField(verbose_name='Verleihdatum')
    return_deadline = models.DateField(
        null=True, blank=True,
        verbose_name='Rückgabefrist'
    )

    # Delivery address (from customer, editable)
    delivery_address_name = models.CharField(max_length=200, verbose_name='Empfänger', blank=True)
    delivery_address_street = models.CharField(max_length=200, blank=True, verbose_name='Straße')
    delivery_address_house_number = models.CharField(max_length=20, blank=True, verbose_name='Hausnummer')
    delivery_address_postal_code = models.CharField(max_length=20, blank=True, verbose_name='PLZ')
    delivery_address_city = models.CharField(max_length=100, blank=True, verbose_name='Stadt')
    delivery_address_country = models.CharField(max_length=100, default='Deutschland', verbose_name='Land')

    # Standard clause (editable per loan)
    standard_clause = models.TextField(
        default='Schäden und Verlust an der Leihware gehen zu Ihren Lasten. Verlängerung der Leihung nur nach Absprache.',
        verbose_name='Standardklausel',
        help_text='Wird auf dem Leihlieferschein abgedruckt'
    )

    notes = models.TextField(blank=True, verbose_name='Notizen')

    # PDF
    pdf_file = models.FileField(
        upload_to=customer_loan_upload_path,
        null=True, blank=True,
        verbose_name='Leihlieferschein PDF'
    )

    # Team assignment
    responsible_employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='responsible_customer_loans',
        verbose_name='Zuständiger Mitarbeiter'
    )

    # Audit fields
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name='customer_loans_created',
        verbose_name='Erstellt von'
    )
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='customer_loans_updated',
        verbose_name='Aktualisiert von'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Verleihung'
        verbose_name_plural = 'Verleihungen'

    def __str__(self):
        return f'{self.loan_number} - {self.customer}'

    def save(self, *args, **kwargs):
        if not self.loan_number:
            self.loan_number = self._generate_loan_number()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_loan_number():
        existing = CustomerLoan.objects.filter(
            loan_number__isnull=False
        ).values_list('loan_number', flat=True)

        if not existing:
            return 'VL-00001'

        numeric_numbers = []
        for num in existing:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue

        next_number = max(numeric_numbers) + 1 if numeric_numbers else 1
        return f'VL-{next_number:05d}'

    def get_delivery_address_display(self):
        parts = [self.delivery_address_name]
        street = f'{self.delivery_address_street} {self.delivery_address_house_number}'.strip()
        if street:
            parts.append(street)
        plz_city = f'{self.delivery_address_postal_code} {self.delivery_address_city}'.strip()
        if plz_city:
            parts.append(plz_city)
        if self.delivery_address_country and self.delivery_address_country != 'Deutschland':
            parts.append(self.delivery_address_country)
        return '\n'.join(parts)


class CustomerLoanItem(models.Model):
    """Positionen einer Verleihung"""

    customer_loan = models.ForeignKey(
        CustomerLoan, on_delete=models.CASCADE,
        related_name='items', verbose_name='Verleihung'
    )
    position = models.PositiveIntegerField(default=1)
    product_name = models.CharField(max_length=200, verbose_name='Produktname')
    article_number = models.CharField(max_length=100, blank=True, verbose_name='Artikelnummer')
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1, verbose_name='Menge')
    unit = models.CharField(max_length=20, default='Stück', verbose_name='Einheit')
    serial_number = models.CharField(max_length=100, blank=True, verbose_name='Seriennummer')
    notes = models.TextField(blank=True, verbose_name='Notizen')

    # Link to inventory item (optional)
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='customer_loan_items',
        verbose_name='Lagerartikel'
    )

    # Return tracking per position
    is_returned = models.BooleanField(default=False, verbose_name='Zurückgegeben')
    is_returned_complete = models.BooleanField(default=False, verbose_name='Vollständig zurückgegeben')
    is_returned_intact = models.BooleanField(default=False, verbose_name='Intakt zurückgegeben')
    is_purchased = models.BooleanField(default=False, verbose_name='Vom Kunden gekauft')
    return_date = models.DateField(null=True, blank=True, verbose_name='Rückgabedatum')
    return_notes = models.TextField(blank=True, verbose_name='Rückgabe-Notizen')

    class Meta:
        ordering = ['position']
        verbose_name = 'Verleihungsposition'
        verbose_name_plural = 'Verleihungspositionen'

    def __str__(self):
        return f'{self.position}. {self.product_name}'
