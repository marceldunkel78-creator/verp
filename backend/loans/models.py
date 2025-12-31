from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
import os
import shutil
from django.conf import settings

User = get_user_model()


def loan_upload_path(instance, filename):
    """Upload path für Leihungs-Dokumente"""
    if hasattr(instance, 'loan'):
        loan_number = instance.loan.loan_number
    else:
        loan_number = instance.loan_number
    return f'Procurement/Loans/{loan_number}/{filename}'


def loan_item_photo_path(instance, filename):
    """Upload path für Wareneingangs-Fotos"""
    loan_number = instance.loan_item.loan.loan_number
    return f'Procurement/Loans/{loan_number}/receipts/{filename}'


class Loan(models.Model):
    """
    Leihungen von Lieferanten
    Leihnummer im Format L-00001
    """
    
    STATUS_CHOICES = [
        ('angefragt', 'Angefragt'),
        ('entliehen', 'Entliehen'),
        ('abgeschlossen', 'Abgeschlossen'),
    ]
    
    # Leihnummer L-00001
    loan_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Leihnummer',
        help_text='Automatisch generiert im Format L-00001'
    )
    
    # Lieferant
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='loans',
        verbose_name='Lieferant'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='angefragt',
        verbose_name='Status'
    )
    
    # Datum der Anfrage
    request_date = models.DateField(
        verbose_name='Anfragedatum',
        help_text='Wann wurde die Leihung angefragt?'
    )
    
    # Rückgabetermin (optional)
    return_deadline = models.DateField(
        verbose_name='Rückgabetermin',
        help_text='Bis wann muss die Ware zurückgesendet werden?',
        null=True,
        blank=True
    )
    
    # Rücksendeadresse
    return_address_name = models.CharField(
        max_length=200,
        verbose_name='Empfänger',
        help_text='Name/Firma für Rücksendung'
    )
    return_address_street = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Straße'
    )
    return_address_house_number = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Hausnummer'
    )
    return_address_postal_code = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='PLZ'
    )
    return_address_city = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Stadt'
    )
    return_address_country = models.CharField(
        max_length=100,
        default='Deutschland',
        verbose_name='Land'
    )
    
    # Referenznummer des Lieferanten
    supplier_reference = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Lieferanten-Referenz',
        help_text='Referenznummer/Auftragsnummer des Lieferanten'
    )
    
    # Notizen
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='loans_created',
        verbose_name='Erstellt von'
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loans_updated',
        verbose_name='Aktualisiert von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Leihung'
        verbose_name_plural = 'Leihungen'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.loan_number} - {self.supplier.company_name}"
    
    def save(self, *args, **kwargs):
        if not self.loan_number:
            self.loan_number = self._generate_loan_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_loan_number():
        """Generiert die nächste freie Leihnummer im Format L-00001"""
        existing_numbers = Loan.objects.filter(
            loan_number__isnull=False
        ).values_list('loan_number', flat=True)
        
        if not existing_numbers:
            return 'L-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'L-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'L-{next_number:05d}'
    
    def get_return_address_display(self):
        """Formatierte Rücksendeadresse"""
        parts = [self.return_address_name]
        if self.return_address_street:
            street = self.return_address_street
            if self.return_address_house_number:
                street += f" {self.return_address_house_number}"
            parts.append(street)
        if self.return_address_postal_code or self.return_address_city:
            parts.append(f"{self.return_address_postal_code} {self.return_address_city}".strip())
        if self.return_address_country:
            parts.append(self.return_address_country)
        return "\n".join(parts)


# Remove media directory when a Loan is deleted
from django.db.models.signals import post_delete
from django.dispatch import receiver


@receiver(post_delete, sender=Loan)
def delete_loan_media_folder(sender, instance, **kwargs):
    """Delete the media folder for a loan when the Loan object is deleted.

    This removes Procurement/Loans/{loan_number}/ under MEDIA_ROOT if it exists.
    """
    try:
        if not instance.loan_number:
            return
        # Construct absolute path and ensure it's under MEDIA_ROOT
        media_dir = os.path.join(settings.MEDIA_ROOT, 'Procurement', 'Loans', instance.loan_number)
        # Normalize paths
        media_dir_norm = os.path.normpath(media_dir)
        media_root_norm = os.path.normpath(settings.MEDIA_ROOT)

        if media_dir_norm.startswith(media_root_norm) and os.path.isdir(media_dir_norm):
            shutil.rmtree(media_dir_norm)
    except Exception:
        # Avoid raising on delete; log could be added here
        pass


class LoanItem(models.Model):
    """
    Einzelne Position einer Leihung
    """
    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Leihung'
    )
    
    position = models.PositiveIntegerField(
        default=1,
        verbose_name='Position'
    )
    
    # Produktinformationen
    product_name = models.CharField(
        max_length=200,
        verbose_name='Warenname'
    )
    supplier_article_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Artikelnummer Lieferant'
    )
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
        verbose_name='Menge'
    )
    unit = models.CharField(
        max_length=20,
        default='Stück',
        verbose_name='Einheit'
    )
    
    # Seriennummer falls vorhanden
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Seriennummer'
    )
    
    # Notizen zur Position
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    class Meta:
        verbose_name = 'Leihposition'
        verbose_name_plural = 'Leihpositionen'
        ordering = ['loan', 'position']
    
    def __str__(self):
        return f"{self.loan.loan_number} Pos. {self.position}: {self.product_name}"


def loan_receipt_document_path(instance, filename):
    """Upload path für Wareneingangs-Dokumente (Lieferschein, Leihvereinbarung)"""
    loan_number = instance.loan.loan_number
    return f'Procurement/Loans/{loan_number}/documents/{filename}'


class LoanReceipt(models.Model):
    """
    Wareneingang einer Leihung
    """
    loan = models.OneToOneField(
        Loan,
        on_delete=models.CASCADE,
        related_name='receipt',
        verbose_name='Leihung'
    )
    
    # Datum des Wareneingangs
    receipt_date = models.DateField(
        verbose_name='Wareneingangsdatum'
    )
    
    # Wer hat entgegengenommen
    received_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loan_receipts_received',
        verbose_name='Entgegengenommen von'
    )
    
    # Lieferschein des Lieferanten
    delivery_note = models.FileField(
        upload_to=loan_receipt_document_path,
        blank=True,
        null=True,
        verbose_name='Lieferschein',
        help_text='Lieferschein des Lieferanten als PDF/Bild'
    )
    
    # Leihvereinbarung
    loan_agreement = models.FileField(
        upload_to=loan_receipt_document_path,
        blank=True,
        null=True,
        verbose_name='Leihvereinbarung',
        help_text='Unterschriebene Leihvereinbarung als PDF/Bild'
    )
    
    # Allgemeine Notizen zum Wareneingang
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen zum Wareneingang'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Wareneingang'
        verbose_name_plural = 'Wareneingänge'
    
    def __str__(self):
        return f"Wareneingang {self.loan.loan_number} vom {self.receipt_date}"


class LoanItemReceipt(models.Model):
    """
    Wareneingangs-Checkliste pro Leihposition
    """
    loan_item = models.OneToOneField(
        LoanItem,
        on_delete=models.CASCADE,
        related_name='receipt_check',
        verbose_name='Leihposition'
    )
    
    # Checkliste
    is_complete = models.BooleanField(
        default=False,
        verbose_name='Vollständig',
        help_text='Alle Teile/Zubehör vorhanden?'
    )
    is_intact = models.BooleanField(
        default=False,
        verbose_name='Intakt',
        help_text='Keine Beschädigungen?'
    )
    
    # Notizen zu dieser Position
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Positions-Checkliste'
        verbose_name_plural = 'Positions-Checklisten'
    
    def __str__(self):
        return f"Checkliste {self.loan_item}"


class LoanItemPhoto(models.Model):
    """
    Fotos zum Wareneingang einer Position
    """
    loan_item = models.ForeignKey(
        LoanItem,
        on_delete=models.CASCADE,
        related_name='photos',
        verbose_name='Leihposition'
    )
    
    photo = models.ImageField(
        upload_to=loan_item_photo_path,
        verbose_name='Foto'
    )
    
    description = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Beschreibung'
    )
    
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='loan_photos_uploaded'
    )
    
    class Meta:
        verbose_name = 'Foto'
        verbose_name_plural = 'Fotos'
        ordering = ['loan_item', '-uploaded_at']
    
    def __str__(self):
        return f"Foto {self.loan_item} - {self.uploaded_at}"


class LoanReturn(models.Model):
    """
    Rücksendung von Leihwaren
    Ein Rücklieferschein kann mehrere Positionen enthalten
    """
    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name='returns',
        verbose_name='Leihung'
    )
    
    # Rücklieferscheinnummer
    return_number = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Rücklieferschein-Nr.',
        help_text='Automatisch generiert'
    )
    
    # Datum der Rücksendung
    return_date = models.DateField(
        verbose_name='Rücksendedatum'
    )
    
    # Versandinformationen
    shipping_carrier = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Versanddienstleister'
    )
    tracking_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Sendungsnummer'
    )
    
    # PDF des Rücklieferscheins
    pdf_file = models.FileField(
        upload_to=loan_upload_path,
        null=True,
        blank=True,
        verbose_name='Rücklieferschein PDF'
    )
    
    # Notizen
    notes = models.TextField(
        blank=True,
        verbose_name='Notizen'
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='loan_returns_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Rücksendung'
        verbose_name_plural = 'Rücksendungen'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Rücksendung {self.return_number} für {self.loan.loan_number}"
    
    def save(self, *args, **kwargs):
        if not self.return_number:
            self.return_number = self._generate_return_number()
        super().save(*args, **kwargs)
    
    def _generate_return_number(self):
        """Generiert Rücklieferscheinnummer basierend auf Leihnummer"""
        # Format: L-00001-R1, L-00001-R2, etc.
        existing = LoanReturn.objects.filter(loan=self.loan).count()
        return f"{self.loan.loan_number}-R{existing + 1}"
    
    def get_filename(self):
        """Generiert Dateinamen für das PDF"""
        supplier_name = self.loan.supplier.company_name.replace(' ', '_')[:30]
        return f"Ruecklieferschein_{self.return_number}_{supplier_name}.pdf"


class LoanReturnItem(models.Model):
    """
    Einzelne Position einer Rücksendung
    """
    loan_return = models.ForeignKey(
        LoanReturn,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Rücksendung'
    )
    
    loan_item = models.ForeignKey(
        LoanItem,
        on_delete=models.CASCADE,
        related_name='return_items',
        verbose_name='Leihposition'
    )
    
    # Rückgesendete Menge
    quantity_returned = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Rückgesendete Menge'
    )
    
    # Zustand bei Rücksendung
    condition_notes = models.TextField(
        blank=True,
        verbose_name='Zustand bei Rücksendung'
    )
    
    class Meta:
        verbose_name = 'Rücksendungsposition'
        verbose_name_plural = 'Rücksendungspositionen'
    
    def __str__(self):
        return f"{self.loan_return.return_number} - {self.loan_item.product_name}"
