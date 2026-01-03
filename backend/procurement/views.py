from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q, Max

from .models import ProductCollection, ProductCollectionItem
from .serializers import (
    ProductCollectionSerializer,
    ProductCollectionListSerializer,
    ProductCollectionCreateSerializer,
    ProductCollectionUpdateSerializer,
    ProductCollectionItemSerializer,
    ProductCollectionItemWriteSerializer
)
from suppliers.models import TradingProduct
from service.models import VSService
from visiview.models import VisiViewProduct
from manufacturing.models import VSHardware


class ProductCollectionViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Warensammlungen
    
    list: Alle Warensammlungen auflisten
    retrieve: Einzelne Warensammlung abrufen
    create: Neue Warensammlung erstellen
    update: Warensammlung aktualisieren
    destroy: Warensammlung löschen
    """
    # Pagination für infinite scroll
    from verp.pagination import InfinitePagination
    pagination_class = InfinitePagination
    queryset = ProductCollection.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'product_source', 'supplier', 'product_category']
    search_fields = ['collection_number', 'title', 'title_en', 'short_description', 'description']
    ordering_fields = ['collection_number', 'title', 'total_list_price', 'created_at']
    ordering = ['collection_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ProductCollectionListSerializer
        elif self.action == 'create':
            return ProductCollectionCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ProductCollectionUpdateSerializer
        return ProductCollectionSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def refresh_prices(self, request, pk=None):
        """
        Aktualisiert alle Preise der Positionen mit den aktuellen Produktpreisen
        """
        collection = self.get_object()
        
        for item in collection.items.all():
            item.update_from_product()
            item.save()
        
        collection.update_totals()
        
        serializer = self.get_serializer(collection)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def generate_quotation_text(self, request, pk=None):
        """
        Generiert automatisch den Angebotstext
        """
        collection = self.get_object()
        language = request.data.get('language', 'DE')
        text_type = request.data.get('type', 'long')  # 'short' oder 'long'
        
        text = collection.generate_quotation_text(language=language, text_type=text_type)
        
        # Speichere den generierten Text
        if text_type == 'short':
            if language == 'EN':
                collection.quotation_text_short_en = text
            else:
                collection.quotation_text_short = text
        else:
            if language == 'EN':
                collection.quotation_text_long_en = text
            else:
                collection.quotation_text_long = text
        
        collection.save()
        
        return Response({
            'text': text,
            'language': language,
            'type': text_type
        })

    @action(detail=True, methods=['post'])
    def translate(self, request, pk=None):
        """Übersetzt Stammdaten-Felder (DE -> EN) mit konfigurierbarer Übersetzungs-API"""
        from django.conf import settings
        import requests

        collection = self.get_object()
        field = request.data.get('field')  # e.g. 'title' or 'short_description' or 'description' or 'quotation_text_short' or 'quotation_text_long'
        to_lang = request.data.get('to', 'EN')

        allowed_fields = ['title', 'short_description', 'description', 'quotation_text_short', 'quotation_text_long']
        if field not in allowed_fields:
            return Response({'error': 'Ungültiges Feld'}, status=status.HTTP_400_BAD_REQUEST)

        # Determiniere Quelltext (Deutsch)
        source_text = getattr(collection, field, None) or ''
        if not source_text:
            return Response({'error': 'Quelltext leer'}, status=status.HTTP_400_BAD_REQUEST)

        # Prüfe ob Übersetzungs-API konfiguriert ist
        api_url = getattr(settings, 'TRANSLATION_API_URL', None)
        api_key = getattr(settings, 'TRANSLATION_API_KEY', None)
        if not api_url:
            return Response({'error': 'Keine Übersetzungs-API konfiguriert'}, status=status.HTTP_501_NOT_IMPLEMENTED)

        # Beispiel: LibreTranslate kompatibler Request
        try:
            resp = requests.post(api_url, json={
                'q': source_text,
                'source': 'de',
                'target': to_lang.lower(),
                'format': 'text'
            }, headers={'Authorization': f'Bearer {api_key}'} if api_key else {})
            resp.raise_for_status()
            data = resp.json()
            translated = data.get('translatedText') or data.get('translation') or data.get('translated') or data

            # Fülle das entsprechende _en Feld im Modell
            en_field = f"{field}_en"
            setattr(collection, en_field, translated if isinstance(translated, str) else str(translated))
            collection.save(update_fields=[en_field])

            return Response({ 'translated': getattr(collection, en_field) })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)
    
    @action(detail=True, methods=['get'])
    def usage_statistics(self, request, pk=None):
        """
        Gibt detaillierte Verwendungsstatistiken zurück
        """
        collection = self.get_object()
        stats = collection.get_usage_statistics()
        
        return Response(stats)
    
    @action(detail=False, methods=['get'])
    def available_products(self, request):
        """
        Gibt verfügbare Produkte basierend auf product_source zurück
        """
        product_source = request.query_params.get('product_source')
        supplier_id = request.query_params.get('supplier')
        search = request.query_params.get('search', '')
        
        products = []
        
        if product_source == 'TRADING_GOODS':
            queryset = TradingProduct.objects.filter(is_active=True)
            if supplier_id:
                queryset = queryset.filter(supplier_id=supplier_id)
            if search:
                queryset = queryset.filter(
                    Q(visitron_part_number__icontains=search) |
                    Q(name__icontains=search) |
                    Q(supplier_part_number__icontains=search)
                )
            products = [{
                'id': p.id,
                'article_number': p.visitron_part_number,
                'name': p.name,
                'description': p.description or '',
                'unit': p.unit,
                'purchase_price': float(p.calculate_purchase_price() or 0),
                'list_price': float(p.calculate_visitron_list_price() or 0),
                'price_valid_until': p.price_valid_until.isoformat() if p.price_valid_until else None,
                'product_type': 'trading_product'
            } for p in queryset[:100]]
        
        elif product_source == 'VS_SERVICE':
            queryset = VSService.objects.filter(is_active=True)
            if search:
                queryset = queryset.filter(
                    Q(article_number__icontains=search) |
                    Q(name__icontains=search)
                )
            products = [{
                'id': p.id,
                'article_number': p.article_number,
                'name': p.name,
                'description': p.description or '',
                'unit': p.unit,
                'purchase_price': float(p.get_current_purchase_price() or 0),
                'list_price': float(p.get_current_sales_price() or 0),
                'price_valid_until': None,
                'product_type': 'vs_service'
            } for p in queryset[:100]]
        
        elif product_source == 'VISIVIEW':
            queryset = VisiViewProduct.objects.filter(is_active=True)
            if search:
                queryset = queryset.filter(
                    Q(product_number__icontains=search) |
                    Q(name__icontains=search)
                )
            products = [{
                'id': p.id,
                'article_number': p.product_number,
                'name': p.name,
                'description': p.description or '',
                'unit': p.unit if hasattr(p, 'unit') else 'Stück',
                'purchase_price': float(getattr(p, 'current_purchase_price', 0) or 0),
                'list_price': float(getattr(p, 'current_list_price', 0) or 0),
                'price_valid_until': None,
                'product_type': 'visiview'
            } for p in queryset[:100]]
        
        elif product_source == 'VS_HARDWARE':
            queryset = VSHardware.objects.filter(is_active=True)
            if search:
                queryset = queryset.filter(
                    Q(article_number__icontains=search) |
                    Q(name__icontains=search)
                )
            products = [{
                'id': p.id,
                'article_number': p.article_number,
                'name': p.name,
                'description': p.description or '',
                'unit': p.unit if hasattr(p, 'unit') else 'Stück',
                'purchase_price': float(p.get_current_purchase_price() or 0) if hasattr(p, 'get_current_purchase_price') else 0,
                'list_price': float(p.get_current_sales_price() or 0) if hasattr(p, 'get_current_sales_price') else 0,
                'price_valid_until': None,
                'product_type': 'vs_hardware'
            } for p in queryset[:100]]
        
        return Response(products)
    
    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """
        Fügt eine Position zur Warensammlung hinzu
        """
        collection = self.get_object()
        
        product_type = request.data.get('product_type')
        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity', 1)
        
        # Bestimme ContentType und hole Produkt
        product = None
        ct = None
        
        if product_type == 'trading_product':
            ct = ContentType.objects.get(app_label='suppliers', model='tradingproduct')
            product = TradingProduct.objects.filter(id=product_id).first()
        elif product_type == 'vs_service':
            ct = ContentType.objects.get(app_label='service', model='vsservice')
            product = VSService.objects.filter(id=product_id).first()
        elif product_type == 'visiview':
            ct = ContentType.objects.get(app_label='visiview', model='visiviewproduct')
            product = VisiViewProduct.objects.filter(id=product_id).first()
        elif product_type == 'vs_hardware':
            ct = ContentType.objects.get(app_label='manufacturing', model='vshardware')
            product = VSHardware.objects.filter(id=product_id).first()
        
        if not product:
            return Response(
                {'error': 'Produkt nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Nächste Position ermitteln
        max_position = collection.items.aggregate(
            max_pos=Max('position')
        )['max_pos'] or 0
        
        item = ProductCollectionItem(
            collection=collection,
            position=max_position + 1,
            content_type=ct,
            object_id=product_id,
            quantity=quantity
        )
        
        item.update_from_product()
        item.save()
        
        collection.update_totals()
        
        serializer = ProductCollectionItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='remove_item/(?P<item_id>[^/.]+)')
    def remove_item(self, request, pk=None, item_id=None):
        """
        Entfernt eine Position aus der Warensammlung
        """
        collection = self.get_object()
        
        try:
            item = collection.items.get(id=item_id)
            item.delete()
            
            # Positionen neu nummerieren
            for idx, item in enumerate(collection.items.all().order_by('position'), start=1):
                if item.position != idx:
                    item.position = idx
                    item.save(update_fields=['position'])
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProductCollectionItem.DoesNotExist:
            return Response(
                {'error': 'Position nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def copy(self, request, pk=None):
        """
        Erstellt eine Kopie der Warensammlung
        """
        original = self.get_object()
        
        # Kopiere Hauptdaten
        new_collection = ProductCollection.objects.create(
            title=f"{original.title} (Kopie)",
            title_en=original.title_en,
            short_description=original.short_description,
            short_description_en=original.short_description_en,
            description=original.description,
            description_en=original.description_en,
            product_source=original.product_source,
            supplier=original.supplier,
            product_category=original.product_category,
            created_by=request.user,
            quotation_text_short=original.quotation_text_short,
            quotation_text_short_en=original.quotation_text_short_en,
            quotation_text_long=original.quotation_text_long,
            quotation_text_long_en=original.quotation_text_long_en,
            unit=original.unit,
            is_active=True
        )
        
        # Kopiere Items
        for item in original.items.all():
            ProductCollectionItem.objects.create(
                collection=new_collection,
                position=item.position,
                content_type=item.content_type,
                object_id=item.object_id,
                article_number=item.article_number,
                name=item.name,
                name_en=item.name_en,
                description=item.description,
                description_en=item.description_en,
                quantity=item.quantity,
                unit=item.unit,
                unit_purchase_price=item.unit_purchase_price,
                unit_list_price=item.unit_list_price,
                price_valid_until=item.price_valid_until
            )
        
        new_collection.update_totals()
        
        serializer = self.get_serializer(new_collection)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProductCollectionItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Warensammlungs-Positionen
    """
    queryset = ProductCollectionItem.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['collection']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ProductCollectionItemWriteSerializer
        return ProductCollectionItemSerializer
    
    @action(detail=True, methods=['post'])
    def refresh_from_product(self, request, pk=None):
        """
        Aktualisiert die Position mit aktuellen Daten vom Produkt
        """
        item = self.get_object()
        item.update_from_product()
        item.save()
        
        serializer = self.get_serializer(item)
        return Response(serializer.data)
