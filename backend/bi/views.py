from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, F, Q, DecimalField
from django.db.models.functions import TruncMonth, TruncYear
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal

from customer_orders.models import CustomerOrder, CustomerOrderItem
from sales.models import Quotation, QuotationItem
from projects.models import Project
from inventory.models import InventoryItem
from verp_settings.models import ProductCategory
from suppliers.models import Supplier, TradingProduct
from manufacturing.models import VSHardware
from visiview.models import VisiViewProduct


class SalesStatisticsView(APIView):
    """
    Hauptstatistik für Verkäufe - Gesamtumsatz nach Zeitraum
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        group_by = request.query_params.get('group_by', 'month')
        metric = request.query_params.get('metric', 'revenue')

        if start_date:
            start_date = date.fromisoformat(start_date)
        else:
            start_date = today - relativedelta(months=12)
        
        if end_date:
            end_date = date.fromisoformat(end_date)
        else:
            end_date = today

        # Filter auf abgeschlossene/bezahlte Aufträge
        orders = CustomerOrder.objects.filter(
            order_date__gte=start_date,
            order_date__lte=end_date,
            status__in=['berechnet', 'bezahlt', 'abgeschlossen']
        )

        # Gruppierung nach Monat oder Jahr
        if group_by == 'year':
            orders = orders.annotate(period=TruncYear('order_date'))
        else:
            orders = orders.annotate(period=TruncMonth('order_date'))

        # Aggregation
        if metric == 'count':
            data = list(orders.values('period').annotate(
                value=Count('id')
            ).order_by('period'))
            for entry in data:
                if entry['period']:
                    entry['period'] = entry['period'].strftime('%Y-%m') if group_by == 'month' else entry['period'].strftime('%Y')
        else:
            # Berechne Umsatz über Positionen
            data = []
            periods = orders.values('period').distinct().order_by('period')
            
            for period_entry in periods:
                period = period_entry['period']
                if not period:
                    continue
                period_orders = orders.filter(period=period)
                total_revenue = Decimal('0')
                
                for order in period_orders:
                    items_total = order.items.aggregate(
                        total=Sum(F('quantity') * F('final_price'))
                    )['total'] or Decimal('0')
                    total_revenue += items_total + (order.delivery_cost or Decimal('0'))
                
                data.append({
                    'period': period.strftime('%Y-%m') if group_by == 'month' else period.strftime('%Y'),
                    'value': float(total_revenue)
                })

        # Zusammenfassung
        summary = {
            'total_orders': orders.count(),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
        }

        # Berechne Gesamtumsatz
        total_revenue = Decimal('0')
        for order in CustomerOrder.objects.filter(
            order_date__gte=start_date,
            order_date__lte=end_date,
            status__in=['berechnet', 'bezahlt', 'abgeschlossen']
        ):
            items_total = order.items.aggregate(
                total=Sum(F('quantity') * F('final_price'))
            )['total'] or Decimal('0')
            total_revenue += items_total + (order.delivery_cost or Decimal('0'))
        summary['total_revenue'] = float(total_revenue)

        return Response({
            'data': data,
            'summary': summary,
            'filters': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'group_by': group_by,
                'metric': metric
            }
        })


class SalesByProductView(APIView):
    """
    Verkäufe nach Produkt (basierend auf article_number)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        article_number = request.query_params.get('article_number')
        group_by = request.query_params.get('group_by', 'month')

        if start_date:
            start_date = date.fromisoformat(start_date)
        else:
            start_date = today - relativedelta(months=12)
        
        if end_date:
            end_date = date.fromisoformat(end_date)
        else:
            end_date = today

        items = CustomerOrderItem.objects.filter(
            order__order_date__gte=start_date,
            order__order_date__lte=end_date,
            order__status__in=['berechnet', 'bezahlt', 'abgeschlossen']
        )

        if article_number:
            items = items.filter(article_number__icontains=article_number)

        # Gruppierung
        if group_by == 'year':
            items = items.annotate(period=TruncYear('order__order_date'))
        else:
            items = items.annotate(period=TruncMonth('order__order_date'))

        # Aggregation nach Zeitraum
        time_data = items.values('period').annotate(
            revenue=Sum(F('quantity') * F('final_price')),
            count=Sum('quantity')
        ).order_by('period')

        result = []
        for entry in time_data:
            if entry['period']:
                result.append({
                    'period': entry['period'].strftime('%Y-%m') if group_by == 'month' else entry['period'].strftime('%Y'),
                    'revenue': float(entry['revenue'] or 0),
                    'count': float(entry['count'] or 0)
                })

        # Top Produkte nach Artikelnummer
        top_products = items.values(
            'article_number', 'name'
        ).annotate(
            total_revenue=Sum(F('quantity') * F('final_price')),
            total_count=Sum('quantity')
        ).order_by('-total_revenue')[:10]

        return Response({
            'data': result,
            'top_products': list(top_products),
            'filters': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'group_by': group_by
            }
        })


class SalesBySupplierView(APIView):
    """
    Verkäufe nach Lieferant - kombiniertes Matching:
    1. Legacy (bis 2025): Über Seriennummer CustomerOrderItem ↔ InventoryItem → Supplier
    2. Neu (ab 2026): Über Artikelnummer CustomerOrderItem → TradingProduct → Supplier
    
    Unterstützt Zeitreihen-Daten für Charts und Filterung nach spezifischen Lieferanten
    """
    permission_classes = [IsAuthenticated]

    def _build_article_to_supplier_mapping(self):
        """Erstellt Mapping von Artikelnummer zu Lieferant aus TradingProducts"""
        mapping = {}
        for tp in TradingProduct.objects.select_related('supplier').exclude(visitron_part_number=''):
            mapping[tp.visitron_part_number] = tp.supplier
        return mapping

    def _build_serial_to_supplier_mapping(self):
        """Erstellt Mapping von Seriennummer zu Lieferant aus InventoryItems"""
        mapping = {}
        for inv in InventoryItem.objects.select_related('supplier').exclude(serial_number='').exclude(serial_number__isnull=True):
            if inv.supplier:
                mapping[inv.serial_number] = inv.supplier
        return mapping

    def get(self, request):
        today = date.today()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        group_by = request.query_params.get('group_by', 'month')
        limit = int(request.query_params.get('limit', 20))
        supplier_ids = request.query_params.get('supplier_ids', '')
        data_source = request.query_params.get('data_source', 'all')  # 'all', 'legacy', 'new'

        if start_date:
            start_date = date.fromisoformat(start_date)
        else:
            start_date = today - relativedelta(months=12)
        
        if end_date:
            end_date = date.fromisoformat(end_date)
        else:
            end_date = today

        selected_supplier_ids = []
        if supplier_ids:
            selected_supplier_ids = [int(x) for x in supplier_ids.split(',') if x.strip().isdigit()]

        # Build mappings
        article_to_supplier = self._build_article_to_supplier_mapping()
        serial_to_supplier = self._build_serial_to_supplier_mapping()

        # Cutoff date for legacy vs new
        legacy_cutoff = date(2026, 1, 1)

        # Query orders
        orders = CustomerOrder.objects.filter(
            order_date__gte=start_date,
            order_date__lte=end_date,
            status__in=['berechnet', 'bezahlt', 'abgeschlossen']
        ).prefetch_related('items')

        supplier_agg = {}
        time_series = {}
        unmatched_count = 0
        matched_by_article = 0
        matched_by_serial = 0

        for order in orders:
            is_legacy = order.order_date < legacy_cutoff
            
            # Skip based on data_source filter
            if data_source == 'legacy' and not is_legacy:
                continue
            if data_source == 'new' and is_legacy:
                continue

            period_str = order.order_date.strftime('%Y') if group_by == 'year' else order.order_date.strftime('%Y-%m')

            for item in order.items.all():
                supplier = None
                
                # Try article number matching first (works best for new data)
                if item.article_number and item.article_number in article_to_supplier:
                    supplier = article_to_supplier[item.article_number]
                    matched_by_article += 1
                # Fall back to serial number matching (for legacy data)
                elif item.serial_number and item.serial_number in serial_to_supplier:
                    supplier = serial_to_supplier[item.serial_number]
                    matched_by_serial += 1
                else:
                    unmatched_count += 1

                # Apply supplier filter
                if selected_supplier_ids:
                    if not supplier or supplier.id not in selected_supplier_ids:
                        continue

                supplier_name = supplier.company_name if supplier else 'Nicht zugeordnet'
                supplier_id = supplier.id if supplier else None
                revenue = float(item.quantity * item.final_price)
                count = int(item.quantity)

                # Aggregate
                if supplier_name not in supplier_agg:
                    supplier_agg[supplier_name] = {'revenue': 0, 'count': 0, 'supplier_id': supplier_id}
                supplier_agg[supplier_name]['revenue'] += revenue
                supplier_agg[supplier_name]['count'] += count

                # Time series
                key = (period_str, supplier_name)
                if key not in time_series:
                    time_series[key] = {'revenue': 0, 'count': 0}
                time_series[key]['revenue'] += revenue
                time_series[key]['count'] += count

        summary_data = sorted(
            [{'supplier': k, 'revenue': v['revenue'], 'count': v['count'], 'supplier_id': v['supplier_id']} 
             for k, v in supplier_agg.items()],
            key=lambda x: x['revenue'], reverse=True
        )[:limit]

        time_data = sorted([
            {'period': period, 'supplier': supplier, 'revenue': vals['revenue'], 'count': vals['count']}
            for (period, supplier), vals in time_series.items()
        ], key=lambda x: x['period'])

        return Response({
            'data': summary_data,
            'time_series': time_data,
            'matching_stats': {
                'matched_by_article': matched_by_article,
                'matched_by_serial': matched_by_serial,
                'unmatched': unmatched_count
            },
            'filters': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'group_by': group_by,
                'limit': limit,
                'supplier_ids': selected_supplier_ids,
                'data_source': data_source
            }
        })


class SalesByInventoryCategoryView(APIView):
    """
    Umsatz gruppiert nach Produktkategorie - kombiniertes Matching:
    1. Legacy (bis 2025): Über Seriennummer CustomerOrderItem ↔ InventoryItem → ProductCategory
    2. Neu (ab 2026): Über Artikelnummer CustomerOrderItem → Produkttabellen → Category
    
    Kategorien kommen aus verschiedenen Quellen:
    - TradingProduct.category
    - VSHardware.product_category
    - VisiViewProduct.product_category
    - InventoryItem.product_category (für Legacy)
    """
    permission_classes = [IsAuthenticated]

    def _build_article_to_category_mapping(self):
        """Erstellt Mapping von Artikelnummer zu Kategorie-Info aus allen Produkttabellen"""
        mapping = {}  # article_number -> {'name': str, 'id': int or None}
        
        # TradingProducts - category ist ein Textfeld, kein FK
        for tp in TradingProduct.objects.exclude(visitron_part_number=''):
            if tp.category:
                mapping[tp.visitron_part_number] = {'name': tp.category, 'id': None}
        
        # VSHardware - product_category ist ein FK
        for vh in VSHardware.objects.select_related('product_category').exclude(part_number=''):
            if vh.product_category:
                mapping[vh.part_number] = {'name': vh.product_category.name, 'id': vh.product_category.id}
        
        # VisiViewProduct - product_category ist ein FK
        for vv in VisiViewProduct.objects.select_related('product_category').exclude(article_number=''):
            if vv.product_category:
                mapping[vv.article_number] = {'name': vv.product_category.name, 'id': vv.product_category.id}
        
        return mapping

    def _build_serial_to_category_mapping(self):
        """Erstellt Mapping von Seriennummer zu Kategorie-Info aus InventoryItems"""
        mapping = {}  # serial_number -> {'name': str, 'id': int}
        for inv in InventoryItem.objects.select_related('product_category').exclude(serial_number='').exclude(serial_number__isnull=True):
            if inv.product_category:
                mapping[inv.serial_number] = {'name': inv.product_category.name, 'id': inv.product_category.id}
        return mapping

    def get(self, request):
        today = date.today()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        group_by = request.query_params.get('group_by', 'month')
        category_ids = request.query_params.get('category_ids', '')
        data_source = request.query_params.get('data_source', 'all')  # 'all', 'legacy', 'new'

        if start_date:
            start_date = date.fromisoformat(start_date)
        else:
            start_date = today - relativedelta(months=12)
        
        if end_date:
            end_date = date.fromisoformat(end_date)
        else:
            end_date = today

        selected_category_ids = []
        if category_ids:
            selected_category_ids = [int(x) for x in category_ids.split(',') if x.strip().isdigit()]

        # Build mappings
        article_to_category = self._build_article_to_category_mapping()
        serial_to_category = self._build_serial_to_category_mapping()

        # Cutoff date
        legacy_cutoff = date(2026, 1, 1)

        orders = CustomerOrder.objects.filter(
            order_date__gte=start_date,
            order_date__lte=end_date,
            status__in=['berechnet', 'bezahlt', 'abgeschlossen']
        ).prefetch_related('items')

        category_agg = {}
        time_series = {}
        unmatched_count = 0
        matched_by_article = 0
        matched_by_serial = 0

        for order in orders:
            is_legacy = order.order_date < legacy_cutoff
            
            if data_source == 'legacy' and not is_legacy:
                continue
            if data_source == 'new' and is_legacy:
                continue

            period_str = order.order_date.strftime('%Y') if group_by == 'year' else order.order_date.strftime('%Y-%m')

            for item in order.items.all():
                category_info = None
                
                # Try article number matching first
                if item.article_number and item.article_number in article_to_category:
                    category_info = article_to_category[item.article_number]
                    matched_by_article += 1
                # Fall back to serial number matching
                elif item.serial_number and item.serial_number in serial_to_category:
                    category_info = serial_to_category[item.serial_number]
                    matched_by_serial += 1
                else:
                    unmatched_count += 1

                # Apply category filter (only if category has an id)
                if selected_category_ids:
                    if not category_info or category_info.get('id') not in selected_category_ids:
                        continue

                cat_name = category_info['name'] if category_info else 'Nicht zugeordnet'
                category_id = category_info.get('id') if category_info else None
                revenue = float(item.quantity * item.final_price)
                count = int(item.quantity)

                # Aggregate
                if cat_name not in category_agg:
                    category_agg[cat_name] = {'revenue': 0, 'count': 0, 'category_id': category_id}
                category_agg[cat_name]['revenue'] += revenue
                category_agg[cat_name]['count'] += count

                # Time series
                key = (period_str, cat_name)
                if key not in time_series:
                    time_series[key] = {'revenue': 0, 'count': 0}
                time_series[key]['revenue'] += revenue
                time_series[key]['count'] += count

        summary_data = sorted(
            [{'category': k, 'revenue': v['revenue'], 'count': v['count'], 'category_id': v['category_id']} 
             for k, v in category_agg.items()],
            key=lambda x: x['revenue'], reverse=True
        )

        time_data = sorted([
            {'period': period, 'category': category, 'revenue': vals['revenue'], 'count': vals['count']}
            for (period, category), vals in time_series.items()
        ], key=lambda x: x['period'])

        return Response({
            'data': summary_data,
            'time_series': time_data,
            'matching_stats': {
                'matched_by_article': matched_by_article,
                'matched_by_serial': matched_by_serial,
                'unmatched': unmatched_count
            },
            'filters': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'group_by': group_by,
                'category_ids': selected_category_ids,
                'data_source': data_source
            }
        })


class SalesByCategoryView(APIView):
    """
    Verkäufe nach Warenkategorie (basierend auf Artikelnummer-Prefixen)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if start_date:
            start_date = date.fromisoformat(start_date)
        else:
            start_date = today - relativedelta(months=12)
        
        if end_date:
            end_date = date.fromisoformat(end_date)
        else:
            end_date = today

        items = CustomerOrderItem.objects.filter(
            order__order_date__gte=start_date,
            order__order_date__lte=end_date,
            order__status__in=['berechnet', 'bezahlt', 'abgeschlossen']
        )

        # Kategorisierung basierend auf Artikelnummer und Name
        categories = {
            'VS-Hardware': {'revenue': Decimal('0'), 'count': 0},
            'VisiView': {'revenue': Decimal('0'), 'count': 0},
            'Zeiss': {'revenue': Decimal('0'), 'count': 0},
            'Leica': {'revenue': Decimal('0'), 'count': 0},
            'Nikon': {'revenue': Decimal('0'), 'count': 0},
            'Sonstige': {'revenue': Decimal('0'), 'count': 0},
        }

        for item in items:
            article = (item.article_number or '').upper()
            name = (item.name or '').upper()
            # Keep monetary values as Decimal to avoid mixing with float
            line_total = (item.quantity * item.final_price) or Decimal('0')
            count = int(item.quantity or 0)

            if article.startswith('VS-') or 'VISITRON' in name:
                categories['VS-Hardware']['revenue'] += line_total
                categories['VS-Hardware']['count'] += count
            elif 'VISIVIEW' in article or 'VISIVIEW' in name:
                categories['VisiView']['revenue'] += line_total
                categories['VisiView']['count'] += count
            elif 'ZEISS' in article or 'ZEISS' in name:
                categories['Zeiss']['revenue'] += line_total
                categories['Zeiss']['count'] += count
            elif 'LEICA' in article or 'LEICA' in name:
                categories['Leica']['revenue'] += line_total
                categories['Leica']['count'] += count
            elif 'NIKON' in article or 'NIKON' in name:
                categories['Nikon']['revenue'] += line_total
                categories['Nikon']['count'] += count
            else:
                categories['Sonstige']['revenue'] += line_total
                categories['Sonstige']['count'] += count

        sorted_categories = sorted(
            [{'category': k, 'revenue': float(v['revenue']), 'count': v['count']} 
             for k, v in categories.items() if v['count'] > 0],
            key=lambda x: x['revenue'],
            reverse=True
        )

        return Response({
            'data': sorted_categories,
            'filters': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            }
        })


class SalesByCustomerView(APIView):
    """
    Verkäufe nach Kunde - Top Kunden
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        customer_id = request.query_params.get('customer_id')
        limit = int(request.query_params.get('limit', 20))

        if start_date:
            start_date = date.fromisoformat(start_date)
        else:
            start_date = today - relativedelta(months=12)
        
        if end_date:
            end_date = date.fromisoformat(end_date)
        else:
            end_date = today

        orders = CustomerOrder.objects.filter(
            order_date__gte=start_date,
            order_date__lte=end_date,
            status__in=['berechnet', 'bezahlt', 'abgeschlossen']
        )

        if customer_id:
            orders = orders.filter(customer_id=customer_id)

        # Berechne Umsatz pro Kunde
        customers_data = []
        customer_orders = orders.values(
            'customer_id', 
            'customer__first_name', 
            'customer__last_name',
            'customer__customer_number'
        ).annotate(
            order_count=Count('id')
        )

        for entry in customer_orders:
            cust_orders = orders.filter(customer_id=entry['customer_id'])
            total_revenue = Decimal('0')
            
            for order in cust_orders:
                items_total = order.items.aggregate(
                    total=Sum(F('quantity') * F('final_price'))
                )['total'] or Decimal('0')
                total_revenue += items_total + (order.delivery_cost or Decimal('0'))
            
            # Kundenname zusammensetzen
            customer_name = f"{entry['customer__first_name'] or ''} {entry['customer__last_name'] or ''}".strip()
            if not customer_name:
                customer_name = entry['customer__customer_number'] or f"Kunde #{entry['customer_id']}"
            
            customers_data.append({
                'customer_id': entry['customer_id'],
                'customer_name': customer_name,
                'customer_number': entry['customer__customer_number'],
                'order_count': entry['order_count'],
                'total_revenue': float(total_revenue)
            })

        customers_data.sort(key=lambda x: x['total_revenue'], reverse=True)
        customers_data = customers_data[:limit]

        return Response({
            'data': customers_data,
            'filters': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'customer_id': customer_id,
                'limit': limit
            }
        })


class ProjectForecastView(APIView):
    """
    Forecast aus aktiven Projekten
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        months_ahead = int(request.query_params.get('months_ahead', 12))
        min_probability = int(request.query_params.get('min_probability', 0))

        end_date = today + relativedelta(months=months_ahead)

        projects = Project.objects.filter(
            status__in=['NEU', 'IN_BEARBEITUNG', 'ANGEBOT_ERSTELLT', 'DEMO_GEPLANT', 
                       'AUSSCHREIBUNG', 'AUFTRAG_ERTEILT', 'IN_FERTIGUNG'],
            forecast_date__isnull=False,
            forecast_date__gte=today,
            forecast_date__lte=end_date,
            forecast_revenue__isnull=False,
            forecast_probability__gte=min_probability
        )

        projects_annotated = projects.annotate(period=TruncMonth('forecast_date'))

        data = projects_annotated.values('period').annotate(
            total_revenue=Sum('forecast_revenue'),
            project_count=Count('id'),
            avg_probability=Sum('forecast_probability') / Count('id')
        ).order_by('period')

        result = []
        for entry in data:
            if entry['period']:
                result.append({
                    'period': entry['period'].strftime('%Y-%m'),
                    'total_revenue': float(entry['total_revenue'] or 0),
                    'project_count': entry['project_count'],
                    'avg_probability': float(entry['avg_probability'] or 0)
                })

        summary = projects.aggregate(
            total=Sum('forecast_revenue'),
            count=Count('id')
        )

        project_details = []
        for p in projects.select_related('customer').order_by('forecast_date'):
            customer_name = None
            if p.customer:
                customer_name = f"{p.customer.first_name or ''} {p.customer.last_name or ''}".strip()
            project_details.append({
                'id': p.id,
                'project_number': p.project_number,
                'name': p.name,
                'customer_name': customer_name,
                'forecast_date': p.forecast_date.isoformat() if p.forecast_date else None,
                'forecast_revenue': float(p.forecast_revenue) if p.forecast_revenue else 0,
                'forecast_probability': p.forecast_probability,
                'status': p.status
            })

        return Response({
            'data': result,
            'summary': {
                'total_forecast': float(summary['total'] or 0),
                'project_count': summary['count'] or 0
            },
            'projects': project_details,
            'filters': {
                'months_ahead': months_ahead,
                'min_probability': min_probability
            }
        })


class QuotationForecastView(APIView):
    """
    Forecast aus gültigen Angeboten
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        months_ahead = int(request.query_params.get('months_ahead', 6))

        quotations = Quotation.objects.filter(
            status__in=['SENT', 'ACTIVE'],
            valid_until__gte=today
        )

        quotation_data = []
        total_value = Decimal('0')

        for quote in quotations.select_related('customer'):
            # Calculate total value correctly using subtotal logic
            quote_value = Decimal('0')
            for item in quote.items.all():
                if item.uses_system_price and quote.system_price:
                    # Item uses system price
                    quote_value += quote.system_price
                elif item.is_group_header and item.sale_price:
                    # Group header with manual sale price
                    quote_value += item.sale_price
                else:
                    # Normal item: quantity * unit_price * (1 - discount_percent/100)
                    price_after_discount = item.unit_price * (Decimal('1') - item.discount_percent / Decimal('100'))
                    quote_value += item.quantity * price_after_discount
            
            # Add delivery cost
            quote_value += (quote.delivery_cost or Decimal('0'))
            total_value += quote_value

            customer_name = None
            if quote.customer:
                customer_name = f"{quote.customer.first_name or ''} {quote.customer.last_name or ''}".strip()

            quotation_data.append({
                'id': quote.id,
                'quotation_number': quote.quotation_number,
                'customer_name': customer_name,
                'quote_date': quote.date.isoformat() if quote.date else None,
                'valid_until': quote.valid_until.isoformat() if quote.valid_until else None,
                'value': float(quote_value),
                'status': quote.status
            })

        quotations_annotated = quotations.annotate(period=TruncMonth('valid_until'))
        
        monthly_data = quotations_annotated.values('period').annotate(
            count=Count('id')
        ).order_by('period')

        result = []
        for entry in monthly_data:
            period = entry['period']
            if not period:
                continue
            period_str = period.strftime('%Y-%m')
            period_quotes = [q for q in quotation_data 
                           if q['valid_until'] and q['valid_until'].startswith(period_str)]
            period_value = sum(q['value'] for q in period_quotes)
            
            result.append({
                'period': period_str,
                'value': period_value,
                'count': entry['count']
            })

        return Response({
            'data': result,
            'summary': {
                'total_value': float(total_value),
                'quotation_count': len(quotation_data)
            },
            'quotations': quotation_data,
            'filters': {
                'months_ahead': months_ahead
            }
        })


class CombinedForecastView(APIView):
    """
    Kombinierter Forecast aus Projekten und Angeboten
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        months_ahead = int(request.query_params.get('months_ahead', 12))
        min_probability = int(request.query_params.get('min_probability', 0))

        months = []
        for i in range(months_ahead):
            month_date = today + relativedelta(months=i)
            months.append(month_date.strftime('%Y-%m'))

        projects = Project.objects.filter(
            status__in=['NEU', 'IN_BEARBEITUNG', 'ANGEBOT_ERSTELLT', 'DEMO_GEPLANT', 
                       'AUSSCHREIBUNG', 'AUFTRAG_ERTEILT', 'IN_FERTIGUNG'],
            forecast_date__isnull=False,
            forecast_revenue__isnull=False,
            forecast_probability__gte=min_probability
        )

        project_by_month = {}
        for p in projects:
            period = p.forecast_date.strftime('%Y-%m') if p.forecast_date else None
            if period:
                if period not in project_by_month:
                    project_by_month[period] = {'total': 0}
                project_by_month[period]['total'] += float(p.forecast_revenue or 0)

        quotations = Quotation.objects.filter(
            status__in=['SENT', 'ACTIVE'],
            valid_until__gte=today
        )

        quotation_by_month = {}
        for quote in quotations:
            period = quote.valid_until.strftime('%Y-%m') if quote.valid_until else None
            if period:
                # Calculate total value correctly using subtotal logic
                quote_value = Decimal('0')
                for item in quote.items.all():
                    if item.uses_system_price and quote.system_price:
                        # Item uses system price
                        quote_value += quote.system_price
                    elif item.is_group_header and item.sale_price:
                        # Group header with manual sale price
                        quote_value += item.sale_price
                    else:
                        # Normal item: quantity * unit_price * (1 - discount_percent/100)
                        price_after_discount = item.unit_price * (Decimal('1') - item.discount_percent / Decimal('100'))
                        quote_value += item.quantity * price_after_discount
                
                # Add delivery cost
                quote_value += (quote.delivery_cost or Decimal('0'))
                quote_value = float(quote_value)
                
                if period not in quotation_by_month:
                    quotation_by_month[period] = 0
                quotation_by_month[period] += quote_value

        result = []
        for month in months:
            project_data = project_by_month.get(month, {'total': 0})
            quotation_value = quotation_by_month.get(month, 0)
            
            result.append({
                'period': month,
                'project_forecast': project_data['total'],
                'quotation_forecast': quotation_value,
                'combined': project_data['total'] + quotation_value
            })

        total_project = sum(m['project_forecast'] for m in result)
        total_quotation = sum(m['quotation_forecast'] for m in result)

        return Response({
            'data': result,
            'summary': {
                'total_project_forecast': total_project,
                'total_quotation_forecast': total_quotation,
                'total_combined': total_project + total_quotation
            },
            'filters': {
                'months_ahead': months_ahead,
                'min_probability': min_probability
            }
        })


class ExpectedPaymentsView(APIView):
    """
    Erwartete Zahlungseingänge
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        months_ahead = int(request.query_params.get('months_ahead', 6))

        orders = CustomerOrder.objects.filter(
            status='berechnet'
        ).select_related('customer')

        payments = []
        for order in orders:
            invoice_date = order.confirmation_date or order.order_date
            if invoice_date:
                payment_terms_days = 30
                expected_date = invoice_date + timedelta(days=payment_terms_days)
                
                items_total = order.items.aggregate(
                    total=Sum(F('quantity') * F('final_price'))
                )['total'] or Decimal('0')
                order_value = items_total + (order.delivery_cost or Decimal('0'))
                
                customer_name = None
                if order.customer:
                    customer_name = f"{order.customer.first_name or ''} {order.customer.last_name or ''}".strip()
                
                payments.append({
                    'order_id': order.id,
                    'order_number': order.order_number,
                    'customer_name': customer_name,
                    'invoice_date': invoice_date.isoformat(),
                    'expected_payment_date': expected_date.isoformat(),
                    'amount': float(order_value),
                    'days_overdue': (today - expected_date).days if expected_date < today else 0
                })

        payments.sort(key=lambda x: x['expected_payment_date'])

        months = []
        for i in range(months_ahead + 1):
            month_date = today + relativedelta(months=i)
            months.append(month_date.strftime('%Y-%m'))

        monthly_data = {m: {'amount': 0, 'count': 0} for m in months}
        monthly_data['overdue'] = {'amount': 0, 'count': 0}

        for payment in payments:
            expected = date.fromisoformat(payment['expected_payment_date'])
            if expected < today:
                monthly_data['overdue']['amount'] += payment['amount']
                monthly_data['overdue']['count'] += 1
            else:
                period = expected.strftime('%Y-%m')
                if period in monthly_data:
                    monthly_data[period]['amount'] += payment['amount']
                    monthly_data[period]['count'] += 1

        result = []
        
        if monthly_data['overdue']['count'] > 0:
            result.append({
                'period': 'Überfällig',
                'amount': monthly_data['overdue']['amount'],
                'count': monthly_data['overdue']['count'],
                'is_overdue': True
            })

        for month in months:
            result.append({
                'period': month,
                'amount': monthly_data[month]['amount'],
                'count': monthly_data[month]['count'],
                'is_overdue': False
            })

        return Response({
            'data': result,
            'payments': payments,
            'summary': {
                'total_expected': sum(p['amount'] for p in payments),
                'total_overdue': monthly_data['overdue']['amount'],
                'overdue_count': monthly_data['overdue']['count'],
                'total_count': len(payments)
            },
            'filters': {
                'months_ahead': months_ahead
            }
        })


class CategoryListView(APIView):
    """
    Liste aller Produktkategorien für Filter
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories = ProductCategory.objects.all().values('id', 'name', 'description')
        return Response(list(categories))


class SupplierListView(APIView):
    """
    Liste aller Lieferanten für Filter im BI-Modul
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = request.query_params.get('search', '')
        
        suppliers = Supplier.objects.all().order_by('company_name')
        
        if search:
            suppliers = suppliers.filter(company_name__icontains=search)
        
        # Nur Lieferanten mit TradingProducts zurückgeben (relevant für Verkaufsanalyse)
        # Achtung: reverse relation ist 'trading_products' (Plural mit underscore)
        suppliers_with_products = suppliers.filter(trading_products__isnull=False).distinct()
        
        return Response([
            {'id': s.id, 'name': s.company_name}
            for s in suppliers_with_products
        ])


class ProductCategoryListView(APIView):
    """
    Liste aller Produktkategorien für Filter im BI-Modul
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = request.query_params.get('search', '')
        
        categories = ProductCategory.objects.all().order_by('name')
        
        if search:
            categories = categories.filter(name__icontains=search)
        
        return Response([
            {'id': c.id, 'name': c.name}
            for c in categories
        ])


class ProductListView(APIView):
    """
    Liste aller Produkte für Filter
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        product_type = request.query_params.get('type', 'all')
        search = request.query_params.get('search', '')

        products = []

        from inventory.models import TradingProduct, VSHardware
        from visiview.models import VisiViewProduct

        if product_type in ['all', 'trading']:
            trading = TradingProduct.objects.all()
            if search:
                trading = trading.filter(
                    Q(article_number__icontains=search) | Q(name__icontains=search)
                )
            for p in trading[:50]:
                products.append({
                    'id': p.id,
                    'type': 'trading',
                    'article_number': p.article_number,
                    'name': p.name
                })

        if product_type in ['all', 'vshardware']:
            hardware = VSHardware.objects.all()
            if search:
                hardware = hardware.filter(
                    Q(article_number__icontains=search) | Q(name__icontains=search)
                )
            for p in hardware[:50]:
                products.append({
                    'id': p.id,
                    'type': 'vshardware',
                    'article_number': p.article_number,
                    'name': p.name
                })

        if product_type in ['all', 'visiview']:
            visiview = VisiViewProduct.objects.all()
            if search:
                visiview = visiview.filter(
                    Q(article_number__icontains=search) | Q(name__icontains=search)
                )
            for p in visiview[:50]:
                products.append({
                    'id': p.id,
                    'type': 'visiview',
                    'article_number': p.article_number,
                    'name': p.name
                })

        return Response(products)
