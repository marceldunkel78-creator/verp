from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()


class VisiViewProduct(models.Model):
    """
    VisiView Produkte - Software-Produkte für Angebote und Aufträge
    Artikelnummer im Format VV-00001
    """
    # Artikelnummer VV-00001
    article_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Artikelnummer',
        help_text='Automatisch generiert im Format VV-00001'
    )
    
    name = models.CharField(max_length=200, verbose_name='Produktname')
    description = models.TextField(blank=True, verbose_name='Beschreibung')
    description_en = models.TextField(
        blank=True,
        verbose_name='Beschreibung (Englisch)',
        help_text='English description for international quotations'
    )
    
    # Warenkategorie - Vorauswahl VisiView
    product_category = models.ForeignKey(
        'verp_settings.ProductCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_products',
        verbose_name='Warenkategorie'
    )
    
    # Einheit und Status
    unit = models.CharField(max_length=50, default='Stück', verbose_name='Einheit')
    is_active = models.BooleanField(default=True, verbose_name='Aktiv')
    
    # Metadaten
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='visiview_products_created',
        verbose_name='Erstellt von'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'VisiView Produkt'
        verbose_name_plural = 'VisiView Produkte'
        ordering = ['article_number']
    
    def __str__(self):
        return f"{self.article_number} - {self.name}" if self.article_number else self.name
    
    def save(self, *args, **kwargs):
        if not self.article_number:
            self.article_number = self._generate_article_number()
        
        # Setze Standardkategorie "VisiView" wenn keine angegeben
        if not self.product_category_id:
            self._set_default_category()
        
        super().save(*args, **kwargs)
    
    def _set_default_category(self):
        """Setzt die Standardkategorie auf 'VisiView'"""
        from verp_settings.models import ProductCategory
        try:
            visiview_category = ProductCategory.objects.filter(
                name='VisiView',
                is_active=True
            ).first()
            if visiview_category:
                self.product_category = visiview_category
        except Exception:
            pass  # Kategorie wird nicht gesetzt wenn nicht vorhanden
    
    @staticmethod
    def _generate_article_number():
        """Generiert die nächste freie Artikelnummer im Format VV-00001"""
        existing_numbers = VisiViewProduct.objects.filter(
            article_number__isnull=False
        ).values_list('article_number', flat=True)
        
        if not existing_numbers:
            return 'VV-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'VV-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'VV-{next_number:05d}'
    
    def get_current_purchase_price(self):
        """Gibt den aktuell gültigen Einkaufspreis zurück"""
        from django.utils import timezone
        today = timezone.now().date()
        price = self.prices.filter(
            valid_from__lte=today
        ).filter(
            models.Q(valid_until__isnull=True) | models.Q(valid_until__gte=today)
        ).order_by('-valid_from').first()
        return price.purchase_price if price else None
    
    def get_current_sales_price(self):
        """Gibt den aktuell gültigen Verkaufspreis (Listenpreis) zurück"""
        from django.utils import timezone
        today = timezone.now().date()
        price = self.prices.filter(
            valid_from__lte=today
        ).filter(
            models.Q(valid_until__isnull=True) | models.Q(valid_until__gte=today)
        ).order_by('-valid_from').first()
        return price.list_price if price else None


class VisiViewProductPrice(models.Model):
    """
    Preise für VisiView Produkte mit Gültigkeitszeitraum
    EK = Einkaufspreis, LP = Listenpreis (Verkaufspreis)
    """
    product = models.ForeignKey(
        VisiViewProduct,
        on_delete=models.CASCADE,
        related_name='prices',
        verbose_name='VisiView Produkt'
    )
    
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Einkaufspreis (EK)',
        help_text='Einkaufspreis in EUR'
    )
    list_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Listenpreis (LP)',
        help_text='Listenpreis für Angebote in EUR'
    )
    
    valid_from = models.DateField(verbose_name='Gültig von')
    valid_until = models.DateField(
        null=True,
        blank=True,
        verbose_name='Gültig bis',
        help_text='Leer = unbegrenzt gültig'
    )
    
    notes = models.TextField(blank=True, verbose_name='Notizen')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='visiview_prices_created'
    )
    
    class Meta:
        verbose_name = 'VisiView Preis'
        verbose_name_plural = 'VisiView Preise'
        ordering = ['product', '-valid_from']
    
    def __str__(self):
        return f"{self.product.article_number}: EK {self.purchase_price}€ / LP {self.list_price}€ ab {self.valid_from}"
    
    def clean(self):
        """Prüft auf überlappende Gültigkeitszeiträume"""
        overlapping = VisiViewProductPrice.objects.filter(product=self.product)
        
        if self.pk:
            overlapping = overlapping.exclude(pk=self.pk)
        
        for price in overlapping:
            # Beide ohne Enddatum
            if not self.valid_until and not price.valid_until:
                if self.valid_from <= price.valid_from or price.valid_from <= self.valid_from:
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    )
            # Neuer Preis ohne Enddatum
            elif not self.valid_until:
                if price.valid_until and price.valid_until >= self.valid_from:
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                    )
                if not price.valid_until and price.valid_from <= self.valid_from:
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    )
            # Bestehender Preis ohne Enddatum
            elif not price.valid_until:
                if price.valid_from <= self.valid_until:
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    )
            # Beide mit Enddatum - prüfe Überlappung
            else:
                if not (self.valid_until < price.valid_from or self.valid_from > price.valid_until):
                    raise ValidationError(
                        f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                    )
