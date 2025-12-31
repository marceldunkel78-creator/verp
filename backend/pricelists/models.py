from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
import os

User = get_user_model()


def pricelist_upload_path(instance, filename):
    """Upload path für Preislisten-PDFs"""
    return f'Sales/Pricelist/{filename}'


class SalesPriceList(models.Model):
    """
    Verkaufs-Preislisten für verschiedene Produktkategorien
    Pro Typ und Gültigkeitszeitraum (Monat/Jahr) darf es nur eine Preisliste geben
    """
    
    PRICELIST_TYPE_CHOICES = [
        ('vs_hardware', 'VS-Hardware'),
        ('visiview', 'VisiView'),
        ('trading', 'Trading Products'),
        ('vs_service', 'VS-Service'),
        ('combined', 'Combined Price List'),
    ]
    
    # Typ der Preisliste
    pricelist_type = models.CharField(
        max_length=20,
        choices=PRICELIST_TYPE_CHOICES,
        verbose_name='Preislistentyp'
    )
    
    # Bei Trading Products: optionaler Filter nach Lieferant
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_pricelists',
        verbose_name='Lieferant',
        help_text='Nur bei Trading Products: Filter nach Lieferant'
    )
    
    # Bei Combined: welche Typen enthalten sind
    include_vs_hardware = models.BooleanField(
        default=False,
        verbose_name='VS-Hardware einschließen'
    )
    include_visiview = models.BooleanField(
        default=False,
        verbose_name='VisiView einschließen'
    )
    include_trading = models.BooleanField(
        default=False,
        verbose_name='Trading Products einschließen'
    )
    include_vs_service = models.BooleanField(
        default=False,
        verbose_name='VS-Service einschließen'
    )
    
    # Trading Products Supplier Filter für combined
    trading_supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='combined_pricelists',
        verbose_name='Trading Products Lieferant',
        help_text='Lieferant für Trading Products im Combined-Modus'
    )
    
    # Gültigkeitszeitraum (nur Monat und Jahr)
    valid_from_month = models.PositiveSmallIntegerField(
        verbose_name='Gültig ab Monat',
        help_text='Monat (1-12)'
    )
    valid_from_year = models.PositiveSmallIntegerField(
        verbose_name='Gültig ab Jahr'
    )
    valid_until_month = models.PositiveSmallIntegerField(
        verbose_name='Gültig bis Monat',
        help_text='Monat (1-12)'
    )
    valid_until_year = models.PositiveSmallIntegerField(
        verbose_name='Gültig bis Jahr'
    )
    
    # Optionaler Untertitel
    subtitle = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Untertitel',
        help_text='Optionaler Untertitel für die Preisliste'
    )
    
    # Generiertes PDF
    pdf_file = models.FileField(
        upload_to=pricelist_upload_path,
        null=True,
        blank=True,
        verbose_name='PDF-Datei'
    )
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='pricelists_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Verkaufs-Preisliste'
        verbose_name_plural = 'Verkaufs-Preislisten'
        ordering = ['-valid_from_year', '-valid_from_month', 'pricelist_type']
        # Unique constraint: Pro Typ und Gültigkeitszeitraum nur eine Preisliste
        constraints = [
            models.CheckConstraint(
                check=models.Q(valid_from_month__gte=1, valid_from_month__lte=12),
                name='valid_from_month_range'
            ),
            models.CheckConstraint(
                check=models.Q(valid_until_month__gte=1, valid_until_month__lte=12),
                name='valid_until_month_range'
            ),
        ]
    
    def __str__(self):
        type_display = self.get_pricelist_type_display()
        if self.pricelist_type == 'trading' and self.supplier:
            type_display = f"Trading Products ({self.supplier.company_name})"
        elif self.pricelist_type == 'combined':
            parts = []
            if self.include_vs_hardware:
                parts.append('VS-Hardware')
            if self.include_visiview:
                parts.append('VisiView')
            if self.include_trading:
                parts.append('Trading')
            if self.include_vs_service:
                parts.append('Service')
            type_display = f"Combined ({', '.join(parts)})"
        
        return f"{type_display} {self.valid_from_month:02d}/{self.valid_from_year} - {self.valid_until_month:02d}/{self.valid_until_year}"
    
    def clean(self):
        """Validierung"""
        from django.core.exceptions import ValidationError
        
        # Prüfe ob valid_from vor valid_until liegt
        from_date = self.valid_from_year * 100 + self.valid_from_month
        until_date = self.valid_until_year * 100 + self.valid_until_month
        
        if from_date > until_date:
            raise ValidationError({
                'valid_until_month': 'Das Enddatum muss nach dem Startdatum liegen.'
            })
        
        # Prüfe Monate auf Gültigkeit
        if not (1 <= self.valid_from_month <= 12):
            raise ValidationError({
                'valid_from_month': 'Monat muss zwischen 1 und 12 liegen.'
            })
        if not (1 <= self.valid_until_month <= 12):
            raise ValidationError({
                'valid_until_month': 'Monat muss zwischen 1 und 12 liegen.'
            })
        
        # Bei Combined: mindestens ein Typ muss ausgewählt sein
        if self.pricelist_type == 'combined':
            if not any([self.include_vs_hardware, self.include_visiview, 
                       self.include_trading, self.include_vs_service]):
                raise ValidationError(
                    'Bei Combined-Preislisten muss mindestens ein Produkttyp ausgewählt sein.'
                )
        
        # Prüfe auf Duplikate
        existing = SalesPriceList.objects.filter(
            pricelist_type=self.pricelist_type,
            valid_from_month=self.valid_from_month,
            valid_from_year=self.valid_from_year,
            valid_until_month=self.valid_until_month,
            valid_until_year=self.valid_until_year,
        )
        
        # Bei Trading Products: Lieferant mit einbeziehen
        if self.pricelist_type == 'trading':
            existing = existing.filter(supplier=self.supplier)
        
        # Bei Combined: Konfiguration vergleichen
        if self.pricelist_type == 'combined':
            existing = existing.filter(
                include_vs_hardware=self.include_vs_hardware,
                include_visiview=self.include_visiview,
                include_trading=self.include_trading,
                include_vs_service=self.include_vs_service,
                trading_supplier=self.trading_supplier
            )
        
        if self.pk:
            existing = existing.exclude(pk=self.pk)
        
        if existing.exists():
            raise ValidationError(
                'Es existiert bereits eine Preisliste dieses Typs für diesen Zeitraum.'
            )
    
    def get_filename(self):
        """Generiert den Dateinamen für das PDF"""
        type_slug = self.pricelist_type
        if self.pricelist_type == 'trading' and self.supplier:
            type_slug = f"trading_{self.supplier.supplier_number}"
        elif self.pricelist_type == 'combined':
            parts = []
            if self.include_vs_hardware:
                parts.append('hw')
            if self.include_visiview:
                parts.append('vv')
            if self.include_trading:
                parts.append('tr')
            if self.include_vs_service:
                parts.append('sv')
            type_slug = f"combined_{'_'.join(parts)}"
        
        return f"Visitron_Pricelist_{type_slug}_{self.valid_from_month:02d}-{self.valid_from_year}_to_{self.valid_until_month:02d}-{self.valid_until_year}.pdf"
    
    def get_subtitle(self):
        """Generiert den Untertitel für das PDF"""
        if self.subtitle:
            return self.subtitle
        
        if self.pricelist_type == 'vs_hardware':
            return "VS-Hardware Products"
        elif self.pricelist_type == 'visiview':
            return "VisiView Software Products"
        elif self.pricelist_type == 'trading':
            if self.supplier:
                return f"Trading Products - {self.supplier.company_name}"
            return "Trading Products"
        elif self.pricelist_type == 'vs_service':
            return "VS-Service Products"
        elif self.pricelist_type == 'combined':
            parts = []
            if self.include_vs_hardware:
                parts.append('VS-Hardware')
            if self.include_visiview:
                parts.append('VisiView')
            if self.include_trading:
                parts.append('Trading Products')
            if self.include_vs_service:
                parts.append('VS-Service')
            return ' | '.join(parts)
        
        return ""
    
    def get_validity_string(self):
        """Gibt den Gültigkeitszeitraum als String zurück"""
        months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December']
        
        from_str = f"{months[self.valid_from_month]} {self.valid_from_year}"
        until_str = f"{months[self.valid_until_month]} {self.valid_until_year}"
        
        return f"Valid from {from_str} to {until_str}"
