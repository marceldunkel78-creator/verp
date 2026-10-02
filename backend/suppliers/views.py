from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import FileResponse
from django.db.models import Count, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
import mimetypes

from .models import (
    Supplier, SupplierContact, TradingProduct, TradingProductPrice,
    SupplierProduct, ProductGroup, PriceList, MaterialSupply, SupplierAttachment
)
from verp.pagination import InfinitePagination, TradingProductPagination
from .serializers import (
    SupplierSerializer, SupplierCreateUpdateSerializer, SupplierListSerializer,
    SupplierContactSerializer, SupplierProductSerializer,
    ProductGroupSerializer, PriceListSerializer, SupplierAttachmentSerializer
)
from .trading_serializers import (
    TradingProductListSerializer,
    TradingProductDetailSerializer,
    TradingProductCreateUpdateSerializer,
    TradingProductPriceSerializer
)
from .ms_serializers import (
    MaterialSupplyListSerializer,
    MaterialSupplyDetailSerializer,
    MaterialSupplyCreateUpdateSerializer
)
from .permissions import SupplierPermission
from .deletion import (
    delete_supplier, get_link_summary, get_blocking_links, find_duplicates,
)


class IsSuperUserOrReadOnly(BasePermission):
    """
    Lesen (Vorschau/Kennzahlen) fuer alle mit Lieferanten-Leserecht,
    Schreiben/Aktionen nur fuer Superuser.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_superuser)


class SupplierPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000


def supplier_relation_count(relation_name):
    """
    Liefert eine Annotation, die die Anzahl verknüpfter Objekte zählt.

    Als eigenständige Subquery, damit sich die Zähler nicht gegenseitig
    aufs Multiplizieren. Details zur Messung siehe `get_queryset`.
    """
    field = Supplier._meta.get_field(relation_name)
    model = field.related_model
    # Reverse-`related_name` -> tatsächlicher Feldname des Fremdschlüssels
    fk_name = field.field.name
    inner = (
        model.objects.filter(**{fk_name: OuterRef('pk')})
        .values(fk_name)
        .annotate(total=Count('*'))
        .values('total')[:1]
    )
    return Coalesce(Subquery(inner), Value(0), output_field=IntegerField())


class SupplierViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanten
    """
    queryset = Supplier.objects.all()
    permission_classes = [IsAuthenticated, SupplierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['company_name', 'email', 'phone', 'supplier_number']
    ordering_fields = ['company_name', 'created_at']
    ordering = ['company_name']
    pagination_class = SupplierPagination
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SupplierCreateUpdateSerializer
        if self.action == 'list':
            return SupplierListSerializer
        return SupplierSerializer

    def get_queryset(self):
        """
        Für die Liste die Verknüpfungszahlen per Annotation mitliefern.

        Ohne das würde die Kachel für jeden Lieferant Dutzende COUNT-Abfragen
        auslösen (bei 9 Kacheln also im Zweifel über 100 zusätzliche Queries).

        WICHTIG: Die Zählung läuft bewusst über fünf einzelne Subqueries und
        NICHT über `Count(rel, distinct=True)` in einem gemeinsamen JOIN.

        Grund: Ein gemeinsamer LEFT JOIN über mehrere Relationen bildet das
        Kreuzprodukt. Bei einem Lieferanten mit 995 Lagerartikeln und 3109
        Bestellungen sind das rund 3,1 Mio. Join-Zeilen, die COUNT(DISTINCT)
        alle zurückzählen muss. Gemessen auf Produktivdaten (123 Lieferanten):

            JOIN + Count(distinct)   ~5.900 ms  (Seite 1)  / ~33 s  (alle)
            Subqueries                  ~10 ms  (Seite 1)  /  ~22 ms  (alle)

        Das ist der Grund, warum das Lieferanten-Verzeichnis zuletzt so
        langebrauchte. Die Subqueries liefern dieselben Zahlen (gegen alle
        123 Lieferanten geprüft: 0 Abweichungen), sind aber unabhängig
        voneinander und skalieren deshalb linear.

        `Coalesce(..., 0)` sorgt dafür, dass Lieferanten ohne Verknüpfung
        eine echte 0 liefern und nicht `None` - das Frontend zeigt diese
        Werte direkt in den Kacheln an.
        """
        queryset = super().get_queryset()
        if self.action == 'list':
            annotations = {
                f'{rel}_count': supplier_relation_count(rel)
                for rel in ('inventory_items', 'orders', 'contacts',
                            'product_groups', 'price_lists')
            }
            queryset = queryset.annotate(**annotations).select_related('created_by')
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def add_contact(self, request, pk=None):
        """Fügt einen neuen Kontakt zu einem Lieferanten hinzu"""
        supplier = self.get_object()
        serializer = SupplierContactSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(supplier=supplier)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def link_product(self, request, pk=None):
        """Verknüpft ein Produkt mit einem Lieferanten"""
        supplier = self.get_object()
        serializer = SupplierProductSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(supplier=supplier)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Aufräumen: Dubletten-Lieferanten löschen bzw. umhängen
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated, SupplierPermission])
    def link_summary(self, request, pk=None):
        """
        Verknüpfungsübersicht eines Lieferanten.

        Liefert je Verknüpfung den Count, ob sie dem Lieferanten gehört (wird
        mitgelöscht) oder fremd ist, plus Beispiel-Einträge. Genau das, was man
        vor dem Löschen sehen muss - im Löschmodul stand bisher nur
        "Verknüpfungen vorhanden" ohne Namen.
        """
        supplier = self.get_object()
        blocked = {b['key'] for b in get_blocking_links(supplier)}
        summary = []
        for entry in get_link_summary(supplier):
            item = dict(entry)
            item['blocks_delete'] = item['key'] in blocked
            summary.append(item)
        return Response({
            'supplier': {
                'id': supplier.id,
                'supplier_number': supplier.supplier_number,
                'company_name': supplier.company_name,
            },
            'can_delete': not blocked,
            'links': summary,
            'duplicates': find_duplicates(supplier),
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsSuperUserOrReadOnly])
    def delete_with_reassign(self, request, pk=None):
        """
        Löscht einen Lieferanten - wahlweise mit Umhängen aller Verknüpfungen.

        Body (JSON):
            reassign_to : PK des Ziellieferanten, oder null / "" für reines Löschen
            renumber    : bool, visitron_part_number der umgehängten Waren neu vergeben
            dry_run     : bool, nur zählen und Konflikte melden
            confirm     : bool, muss true sein

        Ohne `reassign_to` wird nur gelöscht, was dem Lieferanten gehört
        (Kontakte, Warengruppen, ...). Externe Verknüpfungen blockieren dann
        mit einer verständlichen Meldung statt mit einem ProtectedError-Traceback.
        """
        supplier = self.get_object()

        raw_target = request.data.get('reassign_to')
        reassign_to = None
        if raw_target not in (None, '', 'null'):
            try:
                reassign_to = Supplier.objects.get(pk=int(raw_target))
            except (TypeError, ValueError):
                return Response(
                    {'error': f'ungültige Ziellieferanten-ID: {raw_target}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Supplier.DoesNotExist:
                return Response(
                    {'error': f'Ziellieferant {raw_target} nicht gefunden'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        result = delete_supplier(
            supplier,
            reassign_to=reassign_to,
            renumber=bool(request.data.get('renumber', False)),
            dry_run=bool(request.data.get('dry_run', False)),
            confirm=bool(request.data.get('confirm', False)),
        )

        if not result.get('ok'):
            payload = dict(result)
            payload.setdefault('error', 'Unbekannter Fehler')
            payload['links'] = get_link_summary(supplier)
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        moved = result.get('moved') or []
        return Response({
            **result,
            'message': (
                f'Lieferant "{supplier.company_name}" (Nr. {supplier.supplier_number or "-"}, '
                f'ID {supplier.id}) gelöscht.'
                + (
                    f' {sum(m["count"] for m in moved)} Verknüpfungen auf '
                    f'"{reassign_to.company_name}" (Nr. {reassign_to.supplier_number or "-"}) '
                    f'umgehängt.'
                    if reassign_to and moved else ''
                )
            ),
        })


class SupplierContactViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanten-Kontakte
    """
    queryset = SupplierContact.objects.all()
    serializer_class = SupplierContactSerializer
    permission_classes = [IsAuthenticated, SupplierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['supplier', 'contact_type', 'is_active']
    # Ohne search_fields liefert /contacts/?search=... nichts - die
    # Auswahl in den Verleihungen (Empfängerart "Lieferantenmitarbeiter")
    # braucht aber genau das, um nicht durch alle Kontakte zu scrollen.
    search_fields = ['contact_person', 'contact_function', 'email',
                     'phone', 'mobile', 'city', 'supplier__company_name']
    ordering_fields = ['contact_person', 'supplier__company_name', 'city']
    ordering = ['contact_person']


class TradingProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Handelswaren
    """
    # Pagination für Trading Products: 9 pro Seite
    pagination_class = TradingProductPagination
    queryset = TradingProduct.objects.select_related('supplier').all()
    permission_classes = [IsAuthenticated, SupplierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['supplier', 'category', 'is_active', 'list_price_currency']
    search_fields = ['name', 'visitron_part_number', 'supplier_part_number', 'description']
    ordering_fields = ['visitron_part_number', 'name', 'category', 'supplier__company_name', 'price_valid_from', 'price_valid_until', 'created_at']
    ordering = ['visitron_part_number']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TradingProductDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return TradingProductCreateUpdateSerializer
        return TradingProductListSerializer
    
    @action(detail=True, methods=['get'])
    def price_history(self, request, pk=None):
        """
        Gibt die Preishistorie für ein Produkt zurück
        """
        product = self.get_object()
        # Hier könnte man später eine Price History Tabelle abfragen
        return Response({
            'current_price': product.list_price,
            'currency': product.list_price_currency,
            'valid_from': product.price_valid_from,
            'valid_until': product.price_valid_until,
        })
    
    @action(detail=True, methods=['post'])
    def calculate_price(self, request, pk=None):
        """
        Berechnet den Preis mit einem spezifischen Wechselkurs
        """
        product = self.get_object()
        exchange_rate = float(request.data.get('exchange_rate', 1.0))
        
        final_price = product.calculate_final_price(exchange_rate)
        serializer = TradingProductDetailSerializer(product)
        
        return Response({
            'product': serializer.data,
            'exchange_rate': exchange_rate,
            'final_price_converted': round(final_price, 2)
        })


class SupplierProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanten-Produkt Verknüpfungen
    """
    queryset = SupplierProduct.objects.all()
    serializer_class = SupplierProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['supplier', 'product', 'is_preferred_supplier']


class ProductGroupViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Warengruppen
    """
    queryset = ProductGroup.objects.select_related('supplier').all()
    serializer_class = ProductGroupSerializer
    permission_classes = [IsAuthenticated, SupplierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['supplier', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'supplier__company_name', 'discount_percent', 'created_at']
    ordering = ['supplier', 'name']


class PriceListViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Preislisten
    """
    queryset = PriceList.objects.select_related('supplier').all()
    serializer_class = PriceListSerializer
    permission_classes = [IsAuthenticated, SupplierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['supplier', 'is_active']
    search_fields = ['name']
    ordering_fields = ['name', 'supplier__company_name', 'valid_from', 'valid_until', 'created_at']
    ordering = ['supplier', '-valid_from']


class SupplierAttachmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Lieferanten-Anhänge (Preislisten, Prospekte, etc.)
    """
    queryset = SupplierAttachment.objects.select_related('supplier', 'price_list', 'uploaded_by').all()
    serializer_class = SupplierAttachmentSerializer
    permission_classes = [IsAuthenticated, SupplierPermission]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['supplier', 'attachment_type', 'price_list']
    search_fields = ['name', 'filename', 'notes']
    ordering_fields = ['name', 'attachment_type', 'created_at', 'valid_from']
    ordering = ['-created_at']
    
    def perform_create(self, serializer):
        # MIME-Type ermitteln
        file_obj = self.request.FILES.get('file')
        mime_type = ''
        if file_obj:
            mime_type = mimetypes.guess_type(file_obj.name)[0] or ''
        serializer.save(uploaded_by=self.request.user, mime_type=mime_type)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download eines Attachments"""
        attachment = self.get_object()
        if attachment.file:
            response = FileResponse(
                attachment.file.open('rb'),
                as_attachment=True,
                filename=attachment.filename
            )
            return response
        return Response({'error': 'Keine Datei vorhanden'}, status=status.HTTP_404_NOT_FOUND)


class MaterialSupplyViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Material & Supplies (Roh-, Hilfs- und Betriebsstoffe)
    """
    queryset = MaterialSupply.objects.select_related('supplier').all()
    permission_classes = [IsAuthenticated, SupplierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['supplier', 'category', 'is_active', 'list_price_currency']
    search_fields = ['name', 'visitron_part_number', 'supplier_part_number', 'description']
    ordering_fields = ['visitron_part_number', 'name', 'supplier_part_number', 'category', 'supplier__company_name', 'is_active', 'price_valid_from', 'price_valid_until', 'created_at']
    ordering = ['visitron_part_number']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return MaterialSupplyDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return MaterialSupplyCreateUpdateSerializer
        return MaterialSupplyListSerializer


class TradingProductPriceViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Trading Product Preishistorie
    """
    queryset = TradingProductPrice.objects.select_related('product', 'created_by').all()
    serializer_class = TradingProductPriceSerializer
    permission_classes = [IsAuthenticated, SupplierPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['product']
    ordering_fields = ['valid_from', 'created_at']
    ordering = ['-valid_from']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
