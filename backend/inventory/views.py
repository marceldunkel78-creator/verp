from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone
from decimal import Decimal

from .models import IncomingGoods, InventoryItem, EQUIPMENT_TEMPLATES, QM_TEMPLATES
from .serializers import (
    IncomingGoodsSerializer,
    IncomingGoodsDetailSerializer,
    InventoryItemSerializer,
    InventoryItemDetailSerializer,
    TransferToInventorySerializer
)


class IncomingGoodsViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Wareneingang
    """
    queryset = IncomingGoods.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return IncomingGoodsDetailSerializer
        return IncomingGoodsSerializer
    
    def get_queryset(self):
        queryset = IncomingGoods.objects.filter(is_transferred=False)
        
        # Filter nach Lieferant
        supplier = self.request.query_params.get('supplier', None)
        if supplier:
            queryset = queryset.filter(supplier_id=supplier)
        
        # Filter nach Warenfunktion
        item_function = self.request.query_params.get('item_function', None)
        if item_function:
            queryset = queryset.filter(item_function=item_function)
        
        # Filter nach Kategorie (product_category)
        product_category = self.request.query_params.get('product_category', None)
        if product_category:
            queryset = queryset.filter(product_category_id=product_category)
        
        # Filter nach Legacy-Kategorie
        item_category = self.request.query_params.get('item_category', None)
        if item_category:
            queryset = queryset.filter(
                Q(item_category=item_category) | Q(product_category__code=item_category)
            )
        
        # Suche
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(article_number__icontains=search) |
                Q(order_number__icontains=search) |
                Q(customer_order_number__icontains=search) |
                Q(serial_number__icontains=search)
            )
        
        return queryset.select_related('supplier', 'product_category')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def transfer_to_inventory(self, request, pk=None):
        """
        Überführt eine Wareneingangsposition ins Lager
        """
        incoming = self.get_object()
        
        if incoming.is_transferred:
            return Response(
                {'error': 'Diese Position wurde bereits ins Lager überführt.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prüfe ob Warenkategorie gesetzt ist
        if not incoming.product_category:
            return Response(
                {'error': 'Warenkategorie muss eingetragen sein, bevor die Ware ins Lager überführt werden kann.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prüfe ob Seriennummer erforderlich ist
        requires_serial = self._requires_serial_number(incoming)
        
        if requires_serial and not incoming.serial_number:
            return Response(
                {'error': 'Seriennummer muss eingetragen sein, bevor die Ware ins Lager überführt werden kann.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Wenn Seriennummer vorhanden: Neue Instanz erstellen
            if incoming.serial_number:
                inventory_item = self._create_inventory_item(incoming, request.user)
                message = f"Artikel {inventory_item.inventory_number} wurde ins Lager aufgenommen."
            else:
                # Ohne Seriennummer: Prüfe ob bereits vorhanden
                existing = self._find_existing_inventory_item(incoming)
                
                if existing:
                    # Addiere Menge
                    existing.quantity += incoming.delivered_quantity
                    existing.save()
                    inventory_item = existing
                    message = f"Menge wurde zu {inventory_item.inventory_number} hinzugefügt. Neue Menge: {inventory_item.quantity} {inventory_item.unit}"
                else:
                    # Neue Instanz erstellen
                    inventory_item = self._create_inventory_item(incoming, request.user)
                    message = f"Artikel {inventory_item.inventory_number} wurde ins Lager aufgenommen."
            
            # Markiere Wareneingang als überführt
            incoming.is_transferred = True
            incoming.transferred_at = timezone.now()
            incoming.transferred_by = request.user
            incoming.save()
            
            return Response({
                'message': message,
                'inventory_item': InventoryItemSerializer(inventory_item).data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': f'Fehler bei der Überführung: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _requires_serial_number(self, incoming):
        """
        Prüft ob für diese Ware eine Seriennummer erforderlich ist
        """
        # Wenn ProductCategory gesetzt ist, verwende deren Einstellung
        if incoming.product_category:
            return incoming.product_category.requires_serial_number
        
        # Handelsware und Asset benötigen immer Seriennummer
        if incoming.item_function in ['TRADING_GOOD', 'ASSET']:
            return True

        # Material: bestimmte Kategorien benötigen keine Seriennummer
        if incoming.item_function == 'MATERIAL':
            if incoming.item_category in ['ROHSTOFF', 'HILFSSTOFF', 'BETRIEBSSTOFF']:
                return False
            return True

        return False
    
    def _find_existing_inventory_item(self, incoming):
        """
        Sucht nach einem existierenden Lagerartikel ohne Seriennummer
        """
        return InventoryItem.objects.filter(
            article_number=incoming.article_number,
            visitron_part_number=incoming.trading_product.visitron_part_number if incoming.trading_product else (
                incoming.material_supply.visitron_part_number if incoming.material_supply else ''
            ),
            item_function=incoming.item_function,
            item_category=incoming.item_category,
            serial_number='',  # Nur Artikel ohne Seriennummer
            supplier=incoming.supplier,
            status='AUF_LAGER'
        ).first()
    
    def _create_inventory_item(self, incoming, user):
        """
        Erstellt einen neuen Lagerartikel aus einer Wareneingangsposition
        """
        return InventoryItem.objects.create(
            article_number=incoming.article_number,
            visitron_part_number=incoming.trading_product.visitron_part_number if incoming.trading_product else (
                incoming.material_supply.visitron_part_number if incoming.material_supply else ''
            ),
            name=incoming.name,
            model_designation=incoming.model_designation,
            description=incoming.description,
            item_function=incoming.item_function,
            product_category=incoming.product_category,
            item_category=incoming.item_category,
            serial_number=incoming.serial_number,
            quantity=incoming.delivered_quantity if not incoming.serial_number else Decimal('1'),
            unit=incoming.unit,
            purchase_price=incoming.purchase_price,
            currency=incoming.currency,
            supplier=incoming.supplier,
            trading_product=incoming.trading_product,
            material_supply=incoming.material_supply,
            order_number=incoming.order_number,
            customer_order_number=incoming.customer_order_number,
            management_info=incoming.management_info,
            status='AUF_LAGER',
            stored_by=user
        )


class InventoryItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Warenlager
    """
    queryset = InventoryItem.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return InventoryItemDetailSerializer
        return InventoryItemSerializer
    
    def get_queryset(self):
        queryset = InventoryItem.objects.all()
        
        # Filter nach Status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter nach Lieferant
        supplier = self.request.query_params.get('supplier', None)
        if supplier:
            queryset = queryset.filter(supplier_id=supplier)
        
        # Filter nach Warenfunktion
        item_function = self.request.query_params.get('item_function', None)
        if item_function:
            queryset = queryset.filter(item_function=item_function)
        
        # Filter nach Kategorie (product_category)
        product_category = self.request.query_params.get('product_category', None)
        if product_category:
            queryset = queryset.filter(product_category_id=product_category)
        
        # Filter nach Legacy-Kategorie oder category code
        item_category = self.request.query_params.get('item_category', None)
        if item_category:
            queryset = queryset.filter(
                Q(item_category=item_category) | Q(product_category__code=item_category)
            )
        
        # Filter nach Kunde
        customer = self.request.query_params.get('customer', None)
        if customer:
            queryset = queryset.filter(customer_id=customer)
        
        # Filter nach Projekt
        project = self.request.query_params.get('project', None)
        if project:
            queryset = queryset.filter(project_id=project)
        
        # Filter nach System
        system = self.request.query_params.get('system', None)
        if system:
            queryset = queryset.filter(system_id=system)
        
        # Suche
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(article_number__icontains=search) |
                Q(visitron_part_number__icontains=search) |
                Q(inventory_number__icontains=search) |
                Q(serial_number__icontains=search) |
                Q(order_number__icontains=search) |
                Q(customer_order_number__icontains=search) |
                Q(customer_name__icontains=search) |
                Q(system_number__icontains=search) |
                Q(project_number__icontains=search) |
                # Suche nach Kundennummer und Kundenname über Relation
                Q(customer__customer_number__icontains=search) |
                Q(customer__first_name__icontains=search) |
                Q(customer__last_name__icontains=search)
            )
        
        return queryset.select_related('supplier', 'product_category', 'customer', 'project', 'system')
    
    def perform_create(self, serializer):
        serializer.save(stored_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Liefert Statistiken zum Warenlager
        """
        queryset = self.get_queryset()
        
        stats = {
            'total_items': queryset.count(),
            'by_status': {
                'auf_lager': queryset.filter(status='AUF_LAGER').count(),
                'rma': queryset.filter(status='RMA').count(),
                'bei_kunde': queryset.filter(status='BEI_KUNDE').count(),
            },
            'by_function': {
                'trading_good': queryset.filter(item_function='TRADING_GOOD').count(),
                    'asset': queryset.filter(item_function='ASSET').count(),
                    'material': queryset.filter(item_function='MATERIAL').count(),
            }
        }
        
        return Response(stats)
    
    @action(detail=True, methods=['get'])
    def equipment_template(self, request, pk=None):
        """
        Gibt das Ausstattungs-Template für diesen Artikel zurück
        """
        item = self.get_object()
        category_code = item.product_category.code if item.product_category else item.item_category
        template = EQUIPMENT_TEMPLATES.get(category_code, {})
        return Response(template)
    
    @action(detail=True, methods=['get'])
    def qm_template(self, request, pk=None):
        """
        Gibt das QM-Template für diesen Artikel zurück
        """
        item = self.get_object()
        category_code = item.product_category.code if item.product_category else item.item_category
        template = QM_TEMPLATES.get(category_code, QM_TEMPLATES.get('DEFAULT', {}))
        return Response(template)
    
    @action(detail=True, methods=['patch'])
    def update_equipment(self, request, pk=None):
        """
        Aktualisiert die Ausstattungsdaten
        """
        item = self.get_object()
        item.equipment_data = request.data.get('equipment_data', {})
        item.save()
        return Response({'status': 'success', 'equipment_data': item.equipment_data})
    
    @action(detail=True, methods=['patch'])
    def update_qm(self, request, pk=None):
        """
        Aktualisiert die QM-Daten
        """
        item = self.get_object()
        item.qm_data = request.data.get('qm_data', {})
        item.save()
        return Response({'status': 'success', 'qm_data': item.qm_data})
    
    @action(detail=False, methods=['get'])
    def search_by_article(self, request):
        """
        Sucht nach verfügbaren Warenlager-Artikeln für Lieferscheine
        basierend auf VS-Artikelnummer. Nur freie oder reservierte Artikel.
        """
        article_number = request.query_params.get('article_number', '')
        
        if not article_number:
            return Response({'results': []})
        
        # Suche nach artikel_number oder visitron_part_number
        queryset = InventoryItem.objects.filter(
            Q(article_number__iexact=article_number) |
            Q(visitron_part_number__iexact=article_number)
        ).filter(
            # Nur freie oder reservierte Artikel
            Q(status='FREI') | Q(status='RESERVIERT') | Q(status='AUF_LAGER')
        ).select_related(
            'supplier', 'product_category', 'customer'
        ).order_by('-stored_date')[:20]  # Neueste zuerst, max 20
        
        serializer = InventoryItemSerializer(queryset, many=True)
        return Response({'results': serializer.data})
