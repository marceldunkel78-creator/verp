from django.db import models
from core.upload_paths import company_upload_path
from datetime import date, datetime
from django.core.validators import MinValueValidator, MaxValueValidator


class CompanySettings(models.Model):
    """Firmeneinstellungen für Visitron System"""
    
    # Firmeninformationen
    company_name = models.CharField(
        max_length=200,
        default='Visitron System',
        verbose_name='Firmenname'
    )
    
    # Adresse
    street = models.CharField(max_length=100, verbose_name='Straße')
    house_number = models.CharField(max_length=10, verbose_name='Hausnummer')
    postal_code = models.CharField(max_length=10, verbose_name='PLZ')
    city = models.CharField(max_length=100, verbose_name='Stadt')
    country = models.CharField(
        max_length=100,
        default='Deutschland',
        verbose_name='Land'
    )
    
    # Kontaktdaten
    phone = models.CharField(max_length=50, blank=True, verbose_name='Telefon')
    fax = models.CharField(max_length=50, blank=True, verbose_name='Fax')
    email = models.EmailField(blank=True, verbose_name='E-Mail')
    website = models.URLField(blank=True, null=True, verbose_name='Website')
    
    # Bankverbindung
    bank_name = models.CharField(max_length=200, blank=True, verbose_name='Bank')
    iban = models.CharField(max_length=34, blank=True, verbose_name='IBAN')
    bic = models.CharField(max_length=11, blank=True, verbose_name='BIC')
    
    # Rechtliche Informationen
    managing_director = models.TextField(
        blank=True,
        verbose_name='Geschäftsführer',
        help_text='Mehrere Geschäftsführer mit Komma trennen'
    )
    commercial_register = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Handelsregister',
        help_text='z.B. HRB 123456'
    )
    register_court = models.CharField(
        max_length=100,
        default='Amtsgericht München',
        verbose_name='Registergericht'
    )
    tax_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Steuernummer'
    )
    vat_id = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='USt-IdNr.'
    )
    
    # Dokument-Header Logo
    document_header = models.ImageField(
        upload_to=company_upload_path,
        blank=True,
        null=True,
        verbose_name='Dokument-Header',
        help_text='Logo/Header für Bestelldokumente (empfohlen: PNG, ca. 800x150px)'
    )
    
    # Geschäftsjahr Einstellungen
    fiscal_year_start_month = models.PositiveIntegerField(
        default=4,
        choices=[(i, f'{i:02d}') for i in range(1, 13)],
        verbose_name='Geschäftsjahr Startmonat',
        help_text='Monat, in dem das Geschäftsjahr beginnt (1-12)'
    )
    fiscal_year_start_day = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        verbose_name='Geschäftsjahr Starttag',
        help_text='Tag, an dem das Geschäftsjahr beginnt (1-31)'
    )
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Firmeneinstellung'
        verbose_name_plural = 'Firmeneinstellungen'
    
    def __str__(self):
        return self.company_name
    
    def get_current_fiscal_year(self):
        """Berechne das aktuelle Geschäftsjahr basierend auf den Einstellungen"""
        today = date.today()
        fiscal_start = date(today.year, self.fiscal_year_start_month, self.fiscal_year_start_day)
        
        if today >= fiscal_start:
            return today.year
        else:
            return today.year - 1
    
    def get_fiscal_year_for_date(self, target_date):
        """Berechne das Geschäftsjahr für ein bestimmtes Datum"""
        if isinstance(target_date, datetime):
            target_date = target_date.date()
        
        fiscal_start = date(target_date.year, self.fiscal_year_start_month, self.fiscal_year_start_day)
        
        if target_date >= fiscal_start:
            return target_date.year
        else:
            return target_date.year - 1
    
    @classmethod
    def get_settings(cls):
        """Hole oder erstelle Firmeneinstellungen (Singleton)"""
        settings, created = cls.objects.get_or_create(
            id=1,
            defaults={
                'company_name': 'Visitron System',
                'street': 'Musterstraße',
                'house_number': '1',
                'postal_code': '80000',
                'city': 'München',
                'country': 'Deutschland',
                'bank_name': 'Bank',
                'iban': 'DE00 0000 0000 0000 0000 00',
                'bic': 'BANKDEFF',
                'managing_director': 'Max Mustermann',
                'commercial_register': 'HRB 000000',
                'register_court': 'Amtsgericht München',
            }
        )
        return settings
