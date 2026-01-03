from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from .models import ProductCollection, ProductCollectionItem
from suppliers.models import TradingProduct, Supplier
from service.models import VSService
from visiview.models import VisiViewProduct
from manufacturing.models import VSHardware


class ProductCollectionItemSerializer(serializers.ModelSerializer):
    """Serializer für Warensammlungs-Positionen"""
    
    # Read-only Felder für Frontend
    product_display = serializers.SerializerMethodField()
    content_type_data = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductCollectionItem
        fields = [
            'id', 'collection', 'position', 'content_type', 'object_id',
            'article_number', 'name', 'name_en', 'description', 'description_en',
            'quantity', 'unit', 'unit_purchase_price', 'unit_list_price',
            'total_purchase_price', 'total_list_price', 'price_valid_until',
            'product_display', 'content_type_data', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_purchase_price', 'total_list_price', 
                           'product_display', 'content_type_data', 'created_at', 'updated_at']
    
    def get_product_display(self, obj):
        """Gibt eine Anzeige-String für das Produkt zurück"""
        if obj.product:
            return f"{obj.article_number} - {obj.name}"
        return f"{obj.article_number} - {obj.name}"
    
    def get_content_type_data(self, obj):
        """Gibt ContentType-Informationen zurück"""
        if obj.content_type:
            return {
                'id': obj.content_type.id,
                'app_label': obj.content_type.app_label,
                'model': obj.content_type.model
            }
        return None


class ProductCollectionItemWriteSerializer(serializers.ModelSerializer):
    """Serializer für das Erstellen/Bearbeiten von Warensammlungs-Positionen"""
    
    product_type = serializers.ChoiceField(
        choices=['trading_product', 'vs_service', 'visiview', 'vs_hardware'],
        write_only=True
    )
    product_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = ProductCollectionItem
        fields = [
            'id', 'position', 'product_type', 'product_id', 'quantity', 'unit',
            'unit_purchase_price', 'unit_list_price', 'price_valid_until'
        ]
    
    def validate(self, data):
        """Validiert und setzt content_type und object_id"""
        product_type = data.pop('product_type', None)
        product_id = data.pop('product_id', None)
        
        if product_type and product_id:
            # Bestimme ContentType basierend auf product_type
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
            else:
                raise serializers.ValidationError({'product_type': 'Ungültiger Produkttyp'})
            
            if not product:
                raise serializers.ValidationError({'product_id': 'Produkt nicht gefunden'})
            
            data['content_type'] = ct
            data['object_id'] = product_id
        
        return data


class ProductCollectionSerializer(serializers.ModelSerializer):
    """Serializer für Warensammlungen"""
    
    items = ProductCollectionItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    category_name = serializers.CharField(source='product_category.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    usage_statistics = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductCollection
        fields = [
            'id', 'collection_number', 'title', 'title_en',
            'short_description', 'short_description_en',
            'description', 'description_en',
            'product_source', 'supplier', 'supplier_name',
            'product_category', 'category_name',
            'created_by', 'created_by_name',
            'total_purchase_price', 'total_list_price', 'price_valid_until',
            'quotation_text_short', 'quotation_text_short_en',
            'quotation_text_long', 'quotation_text_long_en',
            'manual', 'unit', 'is_active',
            'items', 'usage_statistics',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'collection_number', 'total_purchase_price', 'total_list_price',
            'price_valid_until', 'usage_statistics', 'created_at', 'updated_at'
        ]
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_usage_statistics(self, obj):
        return obj.get_usage_statistics()
    
    def validate(self, data):
        """Validiert Warensammlungsdaten"""
        product_source = data.get('product_source', getattr(self.instance, 'product_source', None))
        supplier = data.get('supplier', getattr(self.instance, 'supplier', None))
        
        # Bei Trading Goods muss ein Lieferant angegeben werden
        if product_source == 'TRADING_GOODS' and not supplier:
            raise serializers.ValidationError({
                'supplier': 'Bei Trading Goods muss ein Lieferant ausgewählt werden.'
            })
        
        # Bei anderen Quellen darf kein Lieferant angegeben werden
        if product_source and product_source != 'TRADING_GOODS':
            data['supplier'] = None
        
        return data


class ProductCollectionListSerializer(serializers.ModelSerializer):
    """Kompakter Serializer für Listen-Ansichten"""
    
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    category_name = serializers.CharField(source='product_category.name', read_only=True)
    item_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductCollection
        fields = [
            'id', 'collection_number', 'title', 'title_en',
            'short_description', 'product_source', 'supplier_name',
            'category_name', 'total_purchase_price', 'total_list_price',
            'price_valid_until', 'is_active', 'item_count', 'created_at'
        ]
    
    def get_item_count(self, obj):
        return obj.items.count()


class ProductCollectionCreateSerializer(serializers.ModelSerializer):
    """Serializer für das Erstellen von Warensammlungen"""
    
    items_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        default=[]
    )
    
    class Meta:
        model = ProductCollection
        fields = [
            'title', 'title_en', 'short_description', 'short_description_en',
            'description', 'description_en', 'product_source', 'supplier',
            'product_category', 'quotation_text_short', 'quotation_text_short_en',
            'quotation_text_long', 'quotation_text_long_en', 'manual', 'unit',
            'is_active', 'items_data'
        ]
    
    def validate(self, data):
        """Validiert die Daten"""
        product_source = data.get('product_source')
        supplier = data.get('supplier')
        
        if product_source == 'TRADING_GOODS' and not supplier:
            raise serializers.ValidationError({
                'supplier': 'Bei Trading Goods muss ein Lieferant ausgewählt werden.'
            })
        
        if product_source and product_source != 'TRADING_GOODS':
            data['supplier'] = None
        
        return data
    
    def create(self, validated_data):
        items_data = validated_data.pop('items_data', [])
        request = self.context.get('request')
        
        if request and request.user:
            validated_data['created_by'] = request.user
        
        collection = ProductCollection.objects.create(**validated_data)
        
        # Erstelle Items
        for idx, item_data in enumerate(items_data, start=1):
            self._create_item(collection, item_data, idx)
        
        # Aktualisiere Gesamtwerte
        collection.update_totals()
        
        return collection
    
    def _create_item(self, collection, item_data, position):
        """Erstellt eine Warensammlungs-Position"""
        product_type = item_data.get('product_type')
        product_id = item_data.get('product_id')
        quantity = item_data.get('quantity', 1)
        
        # Bestimme ContentType und hole Produkt
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
        else:
            return None
        
        if not product:
            return None
        
        item = ProductCollectionItem(
            collection=collection,
            position=position,
            content_type=ct,
            object_id=product_id,
            quantity=quantity
        )
        
        # Fülle Daten vom Produkt
        item.update_from_product()
        item.save()
        
        return item


class ProductCollectionUpdateSerializer(serializers.ModelSerializer):
    """Serializer für das Aktualisieren von Warensammlungen"""
    
    items_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = ProductCollection
        fields = [
            'title', 'title_en', 'short_description', 'short_description_en',
            'description', 'description_en', 'product_source', 'supplier',
            'product_category', 'quotation_text_short', 'quotation_text_short_en',
            'quotation_text_long', 'quotation_text_long_en', 'manual', 'unit',
            'is_active', 'items_data'
        ]
    
    def validate(self, data):
        product_source = data.get('product_source', self.instance.product_source if self.instance else None)
        supplier = data.get('supplier', self.instance.supplier if self.instance else None)
        
        if product_source == 'TRADING_GOODS' and not supplier:
            raise serializers.ValidationError({
                'supplier': 'Bei Trading Goods muss ein Lieferant ausgewählt werden.'
            })
        
        if product_source and product_source != 'TRADING_GOODS':
            data['supplier'] = None
        
        return data
    
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items_data', None)
        
        # Update Hauptdaten
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update Items wenn vorhanden
        if items_data is not None:
            # Lösche alte Items
            instance.items.all().delete()
            
            # Erstelle neue Items
            for idx, item_data in enumerate(items_data, start=1):
                self._create_item(instance, item_data, idx)
        
        # Aktualisiere Gesamtwerte
        instance.update_totals()
        
        return instance
    
    def _create_item(self, collection, item_data, position):
        """Erstellt eine Warensammlungs-Position"""
        product_type = item_data.get('product_type')
        product_id = item_data.get('product_id')
        quantity = item_data.get('quantity', 1)
        
        # Bestimme ContentType und hole Produkt
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
        else:
            return None
        
        if not product:
            return None
        
        item = ProductCollectionItem(
            collection=collection,
            position=position,
            content_type=ct,
            object_id=product_id,
            quantity=quantity
        )
        
        # Fülle Daten vom Produkt
        item.update_from_product()
        item.save()
        
        return item
