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
    Leihungen von Lieferanten oder Kunden
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

    # Wer die Leihware herausgegeben hat. Bis jetzt war das
    # ausschliesslich ein Lieferant; inzwischen kann die Gegenpartei
    # auch ein Kunde sein (durchgereichte Ware, Leihgerät vom
    # Kunden). Das Feld 'lender_type' sagt, welches der beiden FK
    # gesetzt ist - ein Kunde kann auch Lieferant sein, dann ist die
    # Unterscheidung nicht am Namen erkennbar.
    LENDER_TYPE_CHOICES = [
        ('supplier', 'Lieferant'),
        ('customer', 'Kunde'),
        ('distributor_employee', 'Distributormitarbeiter'),
    ]

    lender_type = models.CharField(
        max_length=24,
        choices=LENDER_TYPE_CHOICES,
        default='supplier',
        verbose_name='Gegenpartei',
        help_text='Von wem wird geliehen? Lieferant, Kunde oder Distributormitarbeiter'
    )

    # Lieferant
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='loans',
        null=True,
        blank=True,
        verbose_name='Lieferant'
    )

    # Kunde als Gegenpartei. Nur gesetzt, wenn lender_type='customer'.
    # on_delete=PROTECT wie beim Lieferanten: eine Leihung ist ein
    # dokumentierter Vorgang, der nicht durch das Loeschen eines
    # Datensatzes verschwinden darf.
    lender_customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='procurement_loans_as_lender',
        null=True,
        blank=True,
        verbose_name='Kunde als Gegenpartei',
        help_text='Nur wenn als Gegenpartei "Kunde" gewählt ist'
    )

    # Distributormitarbeiter als Gegenpartei. Nur gesetzt, wenn
    # lender_type='distributor_employee'. Bei den Verleihungen ist
    # dasselbe Muster ueber dealers.DealerEmployee bereits belegt
    # (customer_loans.distributor_employee), hier Gegenpartei der
    # Beschaffung statt Empfaenger der Verleihung.
    lender_distributor_employee = models.ForeignKey(
        'dealers.DealerEmployee',
        on_delete=models.PROTECT,
        related_name='procurement_loans_as_lender',
        null=True,
        blank=True,
        verbose_name='Distributormitarbeiter als Gegenpartei',
        help_text='Nur wenn als Gegenpartei "Distributormitarbeiter" gewählt ist'
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
    
    # Zuständiger Mitarbeiter
    responsible_employee = models.ForeignKey(
        'users.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responsible_loans',
        verbose_name='Zuständiger Mitarbeiter'
    )
    
    # Beobachter (mehrere VERP-Benutzer)
    # Bewusst FK auf User statt Employee: Beobachter werden per Notification
    # direkt adressiert. Über Employee müsste man 0..n User auflösen, und
    # Legacy-Mitarbeiter ohne Login wären nicht benachrichtigbar.
    observers = models.ManyToManyField(
        User,
        blank=True,
        related_name='observed_loans',
        verbose_name='Beobachter'
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
        # Anzeige muss auch ohne Lieferant funktionieren - bei einer
        # Kunden-Leihung ist supplier None, der Zugriff darauf wuerde
        # sonst in einem AttributeError enden (z. B. in __str__ einer
        # RelatedManager-Liste, im Admin oder in einem PDF-Kopf).
        return f"{self.loan_number} - {self.lender_name or 'unbekannt'}"

    @property
    def lender_name(self):
        """
        Name der Gegenpartei, egal ob Lieferant, Kunde oder
        Distributormitarbeiter.

        Mehrere Stellen (Listenansicht, PDF-Kopfzeile, Benachrichtigung)
        brauchen diesen Namen. Ohne diese Property wuerde dort
        loan.supplier.company_name stehen und bei einer Kunden-Leihung
        mit einem AttributeError abbrechen, weil supplier leer ist.
        """
        if self.lender_type == 'customer':
            if not self.lender_customer:
                return ''
            # Customer hat keine full_name-Modelleigenschaft - die gibt
            # es nur als Serializer-Methode. Deshalb hier zusammensetzen.
            return ' '.join(filter(None, [
                self.lender_customer.title,
                self.lender_customer.first_name,
                self.lender_customer.last_name,
            ])).strip()
        if self.lender_type == 'distributor_employee':
            if not self.lender_distributor_employee:
                return ''
            return self.lender_distributor_employee.full_name
        return self.supplier.company_name if self.supplier else ''

    def clean(self):
        """
        Konsistenz der Gegenpartei sichern.

        Es darf immer genau eine Gegenpartei gesetzt sein. Ohne diese
        Pruefung koennte ein Datensatz entstehen, bei dem weder
        Lieferant noch Kunde gesetzt ist - der fuehrt in __str__ und
        in den PDF-Generatoren zu AttributeError.
        """
        # Die beiden anderen Gegenparteien duerfen nie gesetzt sein,
        # egal welcher Typ gewaehlt wurde. Sonst waere beim erneuten
        # Bearbeiten nicht mehr erkennbar, welche gesetzt war.
        if self.supplier and self.lender_type != 'supplier':
            raise ValidationError(
                'Bei dieser Gegenpartei darf kein Lieferant gesetzt sein.')
        if self.lender_customer and self.lender_type != 'customer':
            raise ValidationError(
                'Bei dieser Gegenpartei darf kein Kunde gesetzt sein.')
        if (self.lender_distributor_employee
                and self.lender_type != 'distributor_employee'):
            raise ValidationError(
                'Bei dieser Gegenpartei darf kein Distributormitarbeiter '
                'gesetzt sein.')

        if self.lender_type == 'customer':
            if not self.lender_customer:
                raise ValidationError(
                    'Bei Gegenpartei "Kunde" muss ein Kunde gewählt sein.')
        elif self.lender_type == 'distributor_employee':
            if not self.lender_distributor_employee:
                raise ValidationError(
                    'Bei Gegenpartei "Distributormitarbeiter" muss ein '
                    'Distributormitarbeiter gewählt sein.')
        else:
            if not self.supplier:
                raise ValidationError(
                    'Bei Gegenpartei "Lieferant" muss ein Lieferant '
                    'gewählt sein.')
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

    # Sprache des gespeicherten PDFs. Ohne dieses Feld ist nicht
    # unterscheidbar, ob die hinterlegte Datei deutsch oder englisch
    # ist - ein Download mit language=EN wuerde dann nicht merken,
    # dass es das falsche Dokument ist, und es einfach ausliefern.
    pdf_language = models.CharField(
        max_length=2,
        choices=[('DE', 'Deutsch'), ('EN', 'Englisch')],
        default='DE',
        blank=True,
        verbose_name='Sprache des Rücklieferscheins'
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
        # lender_name statt loan.supplier.company_name: bei einer Kunden-
        # oder Distributor-Leihung ist supplier None, der Zugriff
        # wuerde mit einem AttributeError abbrechen.
        lender = (self.loan.lender_name or 'unbekannt')
        # Nicht-Dateinamen-Zeichen ersetzen, sonst laesst sich der
        # Ruecklieferschein unter Windows nicht speichern.
        lender = ''.join(
            ch if (ch.isalnum() or ch in ' -_.') else '_'
            for ch in lender
        ).replace(' ', '_')[:30]
        return f"Ruecklieferschein_{self.return_number}_{lender}.pdf"


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
