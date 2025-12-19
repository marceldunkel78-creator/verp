from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Customer(models.Model):
    """
    Kundenstammdaten
    """
    LANGUAGE_CHOICES = [
        ('DE', 'Deutsch'),
        ('EN', 'English'),
        ('FR', 'Français'),
        ('ES', 'Español'),
        ('IT', 'Italiano'),
    ]
    
    customer_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Kundennummer',
        help_text='Automatisch generierte Kundennummer'
    )
    
    # Persönliche Daten
    title = models.CharField(max_length=50, blank=True, verbose_name='Titel')
    first_name = models.CharField(max_length=100, verbose_name='Vorname')
    last_name = models.CharField(max_length=100, verbose_name='Nachname')
    language = models.CharField(
        max_length=2,
        choices=LANGUAGE_CHOICES,
        default='DE',
        verbose_name='Sprache'
    )
    
    # Metadaten
    notes = models.TextField(blank=True, verbose_name='Notizen')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='customers_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Kunde'
        verbose_name_plural = 'Kunden'
        ordering = ['last_name', 'first_name']
    
    def __str__(self):
        full_name = f"{self.title} {self.first_name} {self.last_name}".strip()
        if self.customer_number:
            return f"{self.customer_number} - {full_name}"
        return full_name
    
    def save(self, *args, **kwargs):
        if not self.customer_number:
            self.customer_number = self._generate_customer_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_customer_number():
        """Generiert die nächste freie Kundennummer im Format K-XXXXX"""
        existing_numbers = Customer.objects.filter(
            customer_number__isnull=False
        ).values_list('customer_number', flat=True)
        
        if not existing_numbers:
            return 'K-00001'
        
        # Extrahiere Nummern und finde Maximum
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'K-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'K-{next_number:05d}'


class CustomerAddress(models.Model):
    """
    Kundenadressen mit akademischen Feldern
    """
    ADDRESS_TYPE_CHOICES = [
        ('Office', 'Büro'),
        ('Labor', 'Labor'),
        ('Post', 'Postanschrift'),
        ('Lieferung', 'Lieferadresse'),
        ('Rechnung', 'Rechnungsadresse'),
    ]
    
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='addresses',
        verbose_name='Kunde'
    )
    
    # Adresstyp und Status
    address_type = models.CharField(
        max_length=20,
        choices=ADDRESS_TYPE_CHOICES,
        default='Office',
        verbose_name='Adresstyp'
    )
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    
    # Akademische Felder
    university = models.CharField(max_length=200, blank=True, verbose_name='Universität')
    institute = models.CharField(max_length=200, blank=True, verbose_name='Institut')
    department = models.CharField(max_length=200, blank=True, verbose_name='Lehrstuhl/Abteilung')
    
    # Standard-Adressfelder
    street = models.CharField(max_length=200, verbose_name='Straße')
    house_number = models.CharField(max_length=20, verbose_name='Hausnummer')
    address_supplement = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Adresszusatz'
    )
    postal_code = models.CharField(max_length=20, verbose_name='PLZ')
    city = models.CharField(max_length=100, verbose_name='Stadt')
    state = models.CharField(max_length=100, blank=True, verbose_name='Bundesland/Region')
    country = models.CharField(
        max_length=2,
        default='DE',
        verbose_name='Land',
        help_text='ISO 3166-1 Alpha-2 Code'
    )
    
    # Navigation und Lage
    directions = models.TextField(blank=True, verbose_name='Anfahrtsbeschreibung')
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name='Breitengrad'
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name='Längengrad'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Kundenadresse'
        verbose_name_plural = 'Kundenadressen'
        ordering = ['-is_active', 'address_type']
    
    def __str__(self):
        return f"{self.customer} - {self.get_address_type_display()}"


class CustomerPhone(models.Model):
    """
    Telefonnummern des Kunden
    """
    PHONE_TYPE_CHOICES = [
        ('Büro', 'Büro'),
        ('Mobil', 'Mobil'),
        ('Lab', 'Labor'),
    ]
    
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='phones',
        verbose_name='Kunde'
    )
    
    phone_type = models.CharField(
        max_length=20,
        choices=PHONE_TYPE_CHOICES,
        default='Büro',
        verbose_name='Typ'
    )
    phone_number = models.CharField(max_length=50, verbose_name='Telefonnummer')
    is_primary = models.BooleanField(default=False, verbose_name='Primär')
    
    class Meta:
        verbose_name = 'Telefonnummer'
        verbose_name_plural = 'Telefonnummern'
        ordering = ['-is_primary', 'phone_type']
    
    def __str__(self):
        return f"{self.customer} - {self.phone_type}: {self.phone_number}"


class CustomerEmail(models.Model):
    """
    E-Mail-Adressen des Kunden
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='emails',
        verbose_name='Kunde'
    )
    
    email = models.EmailField(verbose_name='E-Mail')
    is_primary = models.BooleanField(default=False, verbose_name='Primär')
    newsletter_consent = models.BooleanField(
        default=False,
        verbose_name='Newsletter erlaubt'
    )
    marketing_consent = models.BooleanField(
        default=False,
        verbose_name='Werbung erlaubt'
    )
    
    class Meta:
        verbose_name = 'E-Mail-Adresse'
        verbose_name_plural = 'E-Mail-Adressen'
        ordering = ['-is_primary', 'email']
    
    def __str__(self):
        return f"{self.customer} - {self.email}"
