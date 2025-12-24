from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone
from decimal import Decimal

from .models import IncomingGoods, InventoryItem
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
        
        # Filter nach Kategorie
        item_category = self.request.query_params.get('item_category', None)
        if item_category:
            queryset = queryset.filter(item_category=item_category)
        
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
        
        return queryset.select_related('supplier', 'order_item', 'trading_product', 'material_supply')
    
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
        
        # Prüfe ob Seriennummer erforderlich ist
        requires_serial = self._requires_serial_number(incoming)
        
        if requires_serial and not incoming.serial_number:
            return Response(
                {'error': 'Für diese Warenfunktion ist eine Seriennummer erforderlich.'},
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
            description=incoming.description,
            item_function=incoming.item_function,
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
        
        # Filter nach Kategorie
        item_category = self.request.query_params.get('item_category', None)
        if item_category:
            queryset = queryset.filter(item_category=item_category)
        
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
                Q(management_info__customer__icontains=search) |
                Q(management_info__project__icontains=search) |
                Q(management_info__system__icontains=search)
            )
        
        return queryset.select_related('supplier', 'trading_product', 'material_supply')
    
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
