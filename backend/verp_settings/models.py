from django.db import models
from django.core.validators import EmailValidator


class CompanySettings(models.Model):
    """
    Allgemeine Firmendaten - Singleton Pattern (nur ein Datensatz)
    """
    company_name = models.CharField(max_length=255, verbose_name='Firmenname')
    
    # E-Mail Adressen
    email_orders = models.EmailField(verbose_name='E-Mail für Kundenbestellungen', blank=True)
    email_general = models.EmailField(verbose_name='E-Mail für allgemeine Anfragen', blank=True)
    email_service = models.EmailField(verbose_name='E-Mail für Service', blank=True)
    email_sales = models.EmailField(verbose_name='E-Mail für Vertrieb', blank=True)
    
    # Telefon zentral
    phone_central = models.CharField(max_length=50, verbose_name='Zentrale Telefonnummer', blank=True)
    
    # Website
    website = models.URLField(max_length=500, verbose_name='Firmenwebsite', blank=True)
    
    # Registrierungen
    trade_register_number = models.CharField(
        max_length=100,
        verbose_name='Handelsregisternummer',
        blank=True
    )
    professional_association = models.CharField(
        max_length=200,
        verbose_name='Berufsgenossenschaft',
        blank=True
    )
    vat_id = models.CharField(
        max_length=50,
        verbose_name='Umsatzsteuer-ID',
        blank=True,
        help_text='z.B. DE123456789'
    )
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Firmeneinstellungen'
        verbose_name_plural = 'Firmeneinstellungen'
    
    def __str__(self):
        return self.company_name or 'Firmeneinstellungen'
    
    def save(self, *args, **kwargs):
        # Singleton Pattern: Nur ein Datensatz erlaubt
        self.pk = 1
        super().save(*args, **kwargs)
    
    @classmethod
    def load(cls):
        """Lade oder erstelle die Firmeneinstellungen"""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class CompanyAddress(models.Model):
    """
    Firmenadressen (z.B. Hauptsitz, Niederlassungen, etc.)
    """
    company_settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='addresses',
        verbose_name='Firmeneinstellungen'
    )
    address_type = models.CharField(
        max_length=50,
        verbose_name='Adresstyp',
        help_text='z.B. Hauptsitz, Niederlassung, Lager'
    )
    street = models.CharField(max_length=200, verbose_name='Straße')
    house_number = models.CharField(max_length=20, verbose_name='Hausnummer')
    address_supplement = models.CharField(
        max_length=200,
        verbose_name='Adresszusatz',
        blank=True
    )
    postal_code = models.CharField(max_length=20, verbose_name='Postleitzahl')
    city = models.CharField(max_length=100, verbose_name='Stadt')
    state = models.CharField(max_length=100, verbose_name='Bundesland/Staat', blank=True)
    country = models.CharField(max_length=2, default='DE', verbose_name='Land (ISO-Code)')
    
    is_primary = models.BooleanField(default=False, verbose_name='Hauptadresse')
    
    class Meta:
        verbose_name = 'Firmenadresse'
        verbose_name_plural = 'Firmenadressen'
        ordering = ['-is_primary', 'address_type']
    
    def __str__(self):
        return f"{self.address_type}: {self.street} {self.house_number}, {self.postal_code} {self.city}"


class CompanyManager(models.Model):
    """
    Geschäftsführer der Firma
    """
    company_settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='managers',
        verbose_name='Firmeneinstellungen'
    )
    first_name = models.CharField(max_length=100, verbose_name='Vorname')
    last_name = models.CharField(max_length=100, verbose_name='Nachname')
    title = models.CharField(
        max_length=50,
        verbose_name='Titel',
        blank=True,
        help_text='z.B. Dr., Prof.'
    )
    position = models.CharField(
        max_length=100,
        verbose_name='Position',
        default='Geschäftsführer'
    )
    email = models.EmailField(verbose_name='E-Mail', blank=True)
    phone = models.CharField(max_length=50, verbose_name='Telefon', blank=True)
    
    class Meta:
        verbose_name = 'Geschäftsführer'
        verbose_name_plural = 'Geschäftsführer'
        ordering = ['last_name', 'first_name']
    
    def __str__(self):
        name_parts = []
        if self.title:
            name_parts.append(self.title)
        name_parts.extend([self.first_name, self.last_name])
        return ' '.join(name_parts)


class CompanyBankAccount(models.Model):
    """
    Bankverbindungen der Firma
    """
    company_settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='bank_accounts',
        verbose_name='Firmeneinstellungen'
    )
    bank_name = models.CharField(max_length=200, verbose_name='Bankname')
    account_holder = models.CharField(
        max_length=200,
        verbose_name='Kontoinhaber',
        blank=True
    )
    iban = models.CharField(max_length=34, verbose_name='IBAN')
    bic = models.CharField(max_length=11, verbose_name='BIC/SWIFT', blank=True)
    currency = models.CharField(
        max_length=3,
        default='EUR',
        verbose_name='Währung'
    )
    is_primary = models.BooleanField(default=False, verbose_name='Hauptkonto')
    notes = models.TextField(verbose_name='Notizen', blank=True)
    
    class Meta:
        verbose_name = 'Bankverbindung'
        verbose_name_plural = 'Bankverbindungen'
        ordering = ['-is_primary', 'bank_name']
    
    def __str__(self):
        return f"{self.bank_name} - {self.iban}"


class ExchangeRate(models.Model):
    """
    Wechselkurse für verschiedene Währungen
    """
    currency = models.CharField(
        max_length=3,
        unique=True,
        verbose_name='Währung',
        help_text='ISO Währungscode (USD, CHF, GBP, etc.)'
    )
    rate_to_eur = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        verbose_name='Kurs zu EUR',
        help_text='1 Einheit dieser Währung = X EUR'
    )
    last_updated = models.DateTimeField(
        auto_now=True,
        verbose_name='Zuletzt aktualisiert'
    )
    
    class Meta:
        verbose_name = 'Wechselkurs'
        verbose_name_plural = 'Wechselkurse'
        ordering = ['currency']
    
    def __str__(self):
        return f"{self.currency}: {self.rate_to_eur} EUR"
