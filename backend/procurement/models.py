from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from decimal import Decimal
from django.utils import timezone

User = get_user_model()


def product_collection_manual_upload_path(instance, filename):
    """
    Upload-Pfad für Warensammlungs-Manuale
    Format: ProductCollections/<WS-Nummer>/<filename>
    """
    import os
    collection_number = instance.collection_number or 'TEMP'
    return os.path.join('ProductCollections', collection_number, filename)


class ProductCollection(models.Model):
    """
    Warensammlungen - Vordefinierte Produktbündel für Angebote
    Artikelnummer im Format WS-00001
    """
    
    # Produktdatenbank-Typen
    PRODUCT_SOURCE_CHOICES = [
        ('TRADING_GOODS', 'Trading Goods'),
        ('VS_SERVICE', 'VS-Service Produkte'),
        ('VISIVIEW', 'VisiView-Produkte'),
        ('VS_HARDWARE', 'VS-Hardware'),
    ]
    
    # Artikelnummer WS-00001
    collection_number = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name='Warensammlungsnummer',
        help_text='Automatisch generiert im Format WS-00001'
    )
    
    # Titel (DE/EN)
    title = models.CharField(
        max_length=200,
        verbose_name='Titel (Deutsch)'
    )
    title_en = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Titel (Englisch)'
    )
    
    # Kurzbeschreibung (DE/EN)
    short_description = models.TextField(
        max_length=2000,
        blank=True,
        verbose_name='Kurzbeschreibung (Deutsch)'
    )
    short_description_en = models.TextField(
        max_length=2000,
        blank=True,
        verbose_name='Kurzbeschreibung (Englisch)'
    )
    
    # Langbeschreibung (DE/EN)
    description = models.TextField(
        max_length=20000,
        blank=True,
        verbose_name='Beschreibung (Deutsch)'
    )
    description_en = models.TextField(
        max_length=20000,
        blank=True,
        verbose_name='Beschreibung (Englisch)'
    )
    
    # Produktdatenbank-Quelle
    product_source = models.CharField(
        max_length=20,
        choices=PRODUCT_SOURCE_CHOICES,
        verbose_name='Produktdatenbank',
        help_text='Aus welcher Produktdatenbank stammen die Positionen'
    )
    
    # Lieferant (nur für Trading Goods erforderlich)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='product_collections',
        verbose_name='Lieferant',
        help_text='Erforderlich bei Trading Goods - nur ein Lieferant pro Sammlung'
    )
    
    # Warenkategorie
    product_category = models.ForeignKey(
        'verp_settings.ProductCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='product_collections',
        verbose_name='Warenkategorie'
    )
    
    # Ersteller
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='product_collections_created',
        verbose_name='Erstellt von'
    )
    
    # Berechnete Preise (werden bei Speichern aktualisiert)
    total_purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Gesamt-Einkaufspreis',
        help_text='Summe der Einzel-Einkaufspreise'
    )
    
    total_list_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Gesamt-Listenpreis',
        help_text='Summe der Visitron-Listenpreise'
    )
    
    # Preisgültigkeit (kürzestes Datum der Einzelpositionen)
    price_valid_until = models.DateField(
        null=True,
        blank=True,
        verbose_name='Preis gültig bis',
        help_text='Wird aus der kürzesten Gültigkeit der Positionen berechnet'
    )
    
    # Angebotstext (kombiniert, editierbar)
    quotation_text_short = models.TextField(
        blank=True,
        verbose_name='Angebotstext kurz (Deutsch)'
    )
    quotation_text_short_en = models.TextField(
        blank=True,
        verbose_name='Angebotstext kurz (Englisch)'
    )
    quotation_text_long = models.TextField(
        blank=True,
        verbose_name='Angebotstext lang (Deutsch)'
    )
    quotation_text_long_en = models.TextField(
        blank=True,
        verbose_name='Angebotstext lang (Englisch)'
    )
    
    # Manual Upload
    manual = models.FileField(
        upload_to=product_collection_manual_upload_path,
        blank=True,
        null=True,
        verbose_name='Manual',
        help_text='Handbuch/Dokumentation zur Warensammlung'
    )
    
    # Einheit und Status
    unit = models.CharField(
        max_length=50,
        default='Stück',
        verbose_name='Einheit'
    )
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='Aktiv'
    )
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')
    
    class Meta:
        verbose_name = 'Warensammlung'
        verbose_name_plural = 'Warensammlungen'
        ordering = ['collection_number']
    
    def __str__(self):
        return f"{self.collection_number} - {self.title}" if self.collection_number else self.title
    
    def save(self, *args, **kwargs):
        if not self.collection_number:
            self.collection_number = self._generate_collection_number()
        super().save(*args, **kwargs)
    
    @staticmethod
    def _generate_collection_number():
        """Generiert die nächste freie Warensammlungsnummer im Format WS-00001"""
        existing_numbers = ProductCollection.objects.filter(
            collection_number__isnull=False
        ).values_list('collection_number', flat=True)
        
        if not existing_numbers:
            return 'WS-00001'
        
        numeric_numbers = []
        for num in existing_numbers:
            try:
                numeric_part = int(num.split('-')[1])
                numeric_numbers.append(numeric_part)
            except (ValueError, IndexError):
                continue
        
        if not numeric_numbers:
            return 'WS-00001'
        
        next_number = max(numeric_numbers) + 1
        return f'WS-{next_number:05d}'
    
    def update_totals(self):
        """
        Aktualisiert Gesamtpreise und Preisgültigkeit basierend auf den Positionen
        """
        from django.db.models import Sum, Min
        
        items = self.items.all()
        
        # Summen berechnen
        total_purchase = items.aggregate(
            total=Sum('total_purchase_price')
        )['total'] or Decimal('0.00')
        
        total_list = items.aggregate(
            total=Sum('total_list_price')
        )['total'] or Decimal('0.00')
        
        # Kürzeste Preisgültigkeit finden
        min_valid_until = items.filter(
            price_valid_until__isnull=False
        ).aggregate(
            min_date=Min('price_valid_until')
        )['min_date']
        
        self.total_purchase_price = total_purchase
        self.total_list_price = total_list
        self.price_valid_until = min_valid_until
        self.save(update_fields=['total_purchase_price', 'total_list_price', 'price_valid_until'])
    
    def generate_quotation_text(self, language='DE', text_type='long'):
        """
        Generiert den Angebotstext aus Titel/Beschreibung und Positionsliste
        Enthält: Titel + Kurzbeschreibung (falls vorhanden) und eine Auflistung aller Positionen

        Wenn text_type == 'short', dann werden für die Positionsbeschreibungen NUR
        die Produkt-`short_description` Felder verwendet (falls vorhanden).
        Kein Fallback auf `description` wenn short_description fehlt.
        Für language='EN' ebenfalls kein Fallback auf deutsche Felder.
        """
        items = self.items.all().order_by('position')

        # Header: Titel und Kurzbeschreibung
        if language == 'EN':
            title = self.title_en or ''
            short_desc = self.short_description_en or ''
            header_label = 'Included items:'
        else:
            title = self.title or ''
            short_desc = self.short_description or ''
            header_label = 'Enthaltene Positionen:'

        lines = []
        if title:
            lines.append(title)
        if short_desc:
            lines.append(short_desc)
        lines.append('')
        lines.append(header_label)
        lines.append('')

        for item in items:
            # Name (DE/EN) - kein Fallback auf andere Sprache
            if language == 'EN':
                name = item.name_en or ''
            else:
                name = item.name or ''

            # Determine description based on requested type
            prod = getattr(item, 'product', None)
            desc = ''
            if text_type == 'short':
                # Für short: NUR short_description verwenden, KEIN Fallback
                if prod:
                    if language == 'EN':
                        desc = getattr(prod, 'short_description_en', None) or ''
                    else:
                        desc = getattr(prod, 'short_description', None) or ''
                # Kein Fallback auf item.description
            else:
                # Für long: description verwenden, KEIN Fallback auf andere Sprache
                if prod:
                    if language == 'EN':
                        desc = getattr(prod, 'description_en', None) or ''
                    else:
                        desc = getattr(prod, 'description', None) or ''
                else:
                    # Fallback auf gespeicherte Item-Beschreibung
                    if language == 'EN':
                        desc = item.description_en or ''
                    else:
                        desc = item.description or ''

            article = item.article_number or ''
            qty = item.quantity or 0

            # Positionzeile: Artikelnummer (Menge x) - Name
            lines.append(f"• {article} ({qty}x) - {name}")

            # Beschreibung (wenn vorhanden)
            if desc:
                snippet = desc[:200]
                lines.append(f"  {snippet}{'...' if len(desc) > 200 else ''}")

        return '\n'.join(lines)
    
    def get_usage_statistics(self):
        """
        Gibt Statistiken zur Verwendung in Angeboten und Aufträgen zurück
        """
        from sales.models import QuotationItem
        from customer_orders.models import CustomerOrderItem

        # QuotationItem kann entweder über GenericForeignKey (content_type/object_id)
        # oder über group_id referenziert werden (z.B. wenn die Warensammlung als Gruppe eingefügt wurde).
        quotation_ids_ct = set(QuotationItem.objects.filter(
            content_type__app_label='procurement',
            content_type__model='productcollection',
            object_id=self.id
        ).values_list('quotation', flat=True))

        quotation_ids_group = set(QuotationItem.objects.filter(
            group_id=f'pc-{self.id}'
        ).values_list('quotation', flat=True))

        quotation_ids = quotation_ids_ct.union(quotation_ids_group)
        quotation_count = len(quotation_ids)

        # CustomerOrderItem hat keine content_type-Felder; hier nur über group_id prüfen
        order_ids = set(CustomerOrderItem.objects.filter(
            group_id=f'pc-{self.id}'
        ).values_list('order', flat=True))
        order_count = len(order_ids)

        return {
            'quotation_count': quotation_count,
            'order_count': order_count,
            'total_usage': quotation_count + order_count
        }


class ProductCollectionItem(models.Model):
    """
    Positionen einer Warensammlung
    Verknüpft mit verschiedenen Produkttypen über GenericForeignKey
    """
    
    collection = models.ForeignKey(
        ProductCollection,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Warensammlung'
    )
    
    # Position in der Sammlung
    position = models.PositiveIntegerField(
        default=1,
        verbose_name='Position'
    )
    
    # GenericForeignKey für flexible Produktverknüpfung
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        limit_choices_to={
            'model__in': ['tradingproduct', 'vsservice', 'visiviewproduct', 'vshardware']
        },
        verbose_name='Produkttyp'
    )
    object_id = models.PositiveIntegerField(verbose_name='Produkt-ID')
    product = GenericForeignKey('content_type', 'object_id')
    
    # Kopierte Produktdaten (für Archivierung/Performance)
    article_number = models.CharField(
        max_length=100,
        verbose_name='Artikelnummer'
    )
    name = models.CharField(
        max_length=200,
        verbose_name='Produktname'
    )
    name_en = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Produktname (Englisch)'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    description_en = models.TextField(
        blank=True,
        verbose_name='Beschreibung (Englisch)'
    )
    
    # Menge und Einheit
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('1.00'),
        verbose_name='Menge'
    )
    unit = models.CharField(
        max_length=50,
        default='Stück',
        verbose_name='Einheit'
    )
    
    # Preise (Einzelpreise)
    unit_purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Einkaufspreis pro Einheit'
    )
    unit_list_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Listenpreis pro Einheit'
    )
    
    # Berechnete Gesamtpreise
    total_purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Gesamt-Einkaufspreis'
    )
    total_list_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Gesamt-Listenpreis'
    )
    
    # Preisgültigkeit
    price_valid_until = models.DateField(
        null=True,
        blank=True,
        verbose_name='Preis gültig bis'
    )
    
    # Metadaten
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Warensammlungs-Position'
        verbose_name_plural = 'Warensammlungs-Positionen'
        ordering = ['collection', 'position']
        unique_together = ['collection', 'position']
    
    def __str__(self):
        return f"{self.collection.collection_number} - Pos. {self.position}: {self.name}"
    
    def save(self, *args, **kwargs):
        # Berechne Gesamtpreise
        self.total_purchase_price = self.unit_purchase_price * self.quantity
        self.total_list_price = self.unit_list_price * self.quantity
        
        super().save(*args, **kwargs)
        
        # Aktualisiere Sammlung-Gesamtwerte
        if self.collection_id:
            self.collection.update_totals()
    
    def delete(self, *args, **kwargs):
        collection = self.collection
        super().delete(*args, **kwargs)
        # Aktualisiere Sammlung-Gesamtwerte nach Löschen
        if collection:
            collection.update_totals()
    
    def update_from_product(self):
        """
        Aktualisiert die Position mit aktuellen Daten vom verlinkten Produkt
        """
        if not self.product:
            return

        product = self.product

        # Artikelnummer und Name
        if hasattr(product, 'visitron_part_number') and product.visitron_part_number:
            self.article_number = product.visitron_part_number
        elif hasattr(product, 'article_number') and product.article_number:
            self.article_number = product.article_number
        elif hasattr(product, 'product_number') and product.product_number:
            self.article_number = product.product_number
        else:
            # Fallback-Artikelnummer
            self.article_number = getattr(product, 'id', '') or ''

        # Name
        self.name = getattr(product, 'name', '') or str(product)
        # Englischer Name
        self.name_en = getattr(product, 'name_en', '') or ''

        # Beschreibungen
        self.description = getattr(product, 'description', '') or ''
        self.description_en = getattr(product, 'description_en', '') or ''

        # Einheit
        self.unit = getattr(product, 'unit', 'Stück') or 'Stück'

        # Einkaufspreis
        if hasattr(product, 'calculate_purchase_price'):
            self.unit_purchase_price = product.calculate_purchase_price() or Decimal('0.00')
        elif hasattr(product, 'get_current_purchase_price'):
            self.unit_purchase_price = product.get_current_purchase_price() or Decimal('0.00')
        elif hasattr(product, 'purchase_price_eur'):
            self.unit_purchase_price = product.purchase_price_eur or Decimal('0.00')
        else:
            self.unit_purchase_price = Decimal('0.00')

        # Listen-/VK-Preis: Bevorzuge Visitron-Berechnung, dann Preis-History, dann Fallback
        if hasattr(product, 'calculate_visitron_list_price'):
            self.unit_list_price = product.calculate_visitron_list_price() or Decimal('0.00')
        elif hasattr(product, 'visitron_list_price'):
            self.unit_list_price = product.visitron_list_price or Decimal('0.00')
        elif hasattr(product, 'get_current_sales_price'):
            self.unit_list_price = product.get_current_sales_price() or Decimal('0.00')
        elif hasattr(product, 'current_list_price'):
            self.unit_list_price = product.current_list_price or Decimal('0.00')
        else:
            # Wenn kein Listenpreis verfügbar ist, behalten wir den Einkaufspreis (aber ohne Rundung)
            self.unit_list_price = self.unit_purchase_price

        # Preisgültigkeit
        if hasattr(product, 'price_valid_until'):
            self.price_valid_until = product.price_valid_until

        # Recalculate totals for this item
        try:
            self.total_purchase_price = (self.unit_purchase_price * self.quantity).quantize(Decimal('0.01'))
            self.total_list_price = (self.unit_list_price * self.quantity).quantize(Decimal('0.01'))
        except Exception:
            # Fall back to simple multiplication if quantize isn't available
            self.total_purchase_price = self.unit_purchase_price * self.quantity
            self.total_list_price = self.unit_list_price * self.quantity
