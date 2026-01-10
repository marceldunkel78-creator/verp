from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, F, Q, DecimalField, Value
from django.db.models.functions import TruncMonth, TruncYear, Coalesce, Concat
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal

from customer_orders.models import CustomerOrder, CustomerOrderItem
from sales.models import Quotation, QuotationItem
from projects.models import Project
from inventory.models import InventoryItem
from verp_settings.models import ProductCategory


class SalesStatisticsView(APIView):
    """
    Hauptstatistik für Verkäufe - Gesamtumsatz nach Zeitraum
    
    Query-Parameter:
    - start_date: Startdatum (YYYY-MM-DD)
    - end_date: Enddatum (YYYY-MM-DD)
    - group_by: 'month' oder 'year'
    - metric: 'revenue' oder 'count'
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Defaults: Letzte 12 Monate
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
            # Format period
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
                    # Summiere Positionen
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
    
    Query-Parameter:
    - start_date, end_date
    - product_type: 'trading', 'vshardware', 'visiview', 'all' (basierend auf Artikelnummer-Prefix)
    - article_number: Spezifischer Artikel
    - group_by: 'month' oder 'year'
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        product_type = request.query_params.get('product_type', 'all')
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

        # Basis-Filter
        items = CustomerOrderItem.objects.filter(
            order__order_date__gte=start_date,
            order__order_date__lte=end_date,
            order__status__in=['berechnet', 'bezahlt', 'abgeschlossen']
        )

        # Filter nach Produkttyp basierend auf Artikelnummer-Prefix
        if product_type == 'trading':
            # Trading products often start with manufacturer prefix
            items = items.exclude(article_number__startswith='VS-')
        elif product_type == 'vshardware':
            items = items.filter(article_number__startswith='VS-')
        elif product_type == 'visiview':
            items = items.filter(
                Q(article_number__icontains='VisiView') |
                Q(name__icontains='VisiView')
            )

        # Filter nach spezifischem Artikel
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

        # Formatiere Ergebnisse
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
                'product_type': product_type,
                'group_by': group_by
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

        # Basis-Filter
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
            'Olympus': {'revenue': Decimal('0'), 'count': 0},
            'Sonstige': {'revenue': Decimal('0'), 'count': 0},
        }

        for item in items:
            article = (item.article_number or '').upper()
            name = (item.name or '').upper()
            line_total = float(item.quantity * item.final_price)
            count = float(item.quantity)

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
            elif 'OLYMPUS' in article or 'EVIDENT' in name:
                categories['Olympus']['revenue'] += line_total
                categories['Olympus']['count'] += count
            else:
                categories['Sonstige']['revenue'] += line_total
                categories['Sonstige']['count'] += count

        # Konvertiere zu Liste und sortiere
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

        # Sortiere nach Umsatz und limitiere
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


class SalesByDealerView(APIView):
    """
    Verkäufe nach Händler/Dealer
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        dealer_id = request.query_params.get('dealer_id')

        if start_date:
            start_date = date.fromisoformat(start_date)
        else:
            start_date = today - relativedelta(months=12)
        
        if end_date:
            end_date = date.fromisoformat(end_date)
        else:
            end_date = today

        # Hinweis: Dealer-Verknüpfung muss ggf. über Customer oder direkt implementiert werden
        return Response({
            'data': [],
            'message': 'Dealer-Verknüpfung muss noch implementiert werden',
            'filters': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'dealer_id': dealer_id
            }
        })


class ProjectForecastView(APIView):
    """
    Forecast aus aktiven Projekten
    
    Gruppiert nach forecast_date (Monat)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        months_ahead = int(request.query_params.get('months_ahead', 12))
        include_weighted = request.query_params.get('weighted', 'true') == 'true'

        end_date = today + relativedelta(months=months_ahead)

        # Aktive Projekte mit Forecast
        projects = Project.objects.filter(
            status__in=['NEU', 'IN_BEARBEITUNG', 'ANGEBOT_ERSTELLT', 'DEMO_GEPLANT', 
                       'AUSSCHREIBUNG', 'AUFTRAG_ERTEILT', 'IN_FERTIGUNG'],
            forecast_date__isnull=False,
            forecast_date__gte=today,
            forecast_date__lte=end_date,
            forecast_revenue__isnull=False
        )

        # Gruppierung nach Monat
        projects_annotated = projects.annotate(period=TruncMonth('forecast_date'))

        data = projects_annotated.values('period').annotate(
            total_revenue=Sum('forecast_revenue'),
            weighted_revenue=Sum(
                F('forecast_revenue') * F('forecast_probability') / 100,
                output_field=DecimalField()
            ),
            project_count=Count('id'),
            avg_probability=Sum('forecast_probability') / Count('id')
        ).order_by('period')

        result = []
        for entry in data:
            if entry['period']:
                result.append({
                    'period': entry['period'].strftime('%Y-%m'),
                    'total_revenue': float(entry['total_revenue'] or 0),
                    'weighted_revenue': float(entry['weighted_revenue'] or 0),
                    'project_count': entry['project_count'],
                    'avg_probability': float(entry['avg_probability'] or 0)
                })

        # Zusammenfassung
        summary = projects.aggregate(
            total=Sum('forecast_revenue'),
            weighted=Sum(
                F('forecast_revenue') * F('forecast_probability') / 100,
                output_field=DecimalField()
            ),
            count=Count('id')
        )

        # Projekt-Details
        project_details = []
        for p in projects.select_related('customer').order_by('forecast_date'):
            customer_name = f"{p.customer.first_name or ''} {p.customer.last_name or ''}".strip() if p.customer else None
            project_details.append({
                'id': p.id,
                'project_number': p.project_number,
                'name': p.name,
                'customer__name': customer_name,
                'forecast_date': p.forecast_date.isoformat() if p.forecast_date else None,
                'forecast_revenue': float(p.forecast_revenue) if p.forecast_revenue else 0,
                'forecast_probability': p.forecast_probability,
                'status': p.status
            })

        return Response({
            'data': result,
            'summary': {
                'total_forecast': float(summary['total'] or 0),
                'weighted_forecast': float(summary['weighted'] or 0),
                'project_count': summary['count'] or 0
            },
            'projects': project_details,
            'filters': {
                'months_ahead': months_ahead,
                'weighted': include_weighted
            }
        })


class QuotationForecastView(APIView):
    """
    Forecast aus gültigen Angeboten
    
    Angebote die status=SENT oder ACTIVE und valid_until >= heute
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        months_ahead = int(request.query_params.get('months_ahead', 6))

        # Gültige verschickte Angebote
        quotations = Quotation.objects.filter(
            status__in=['SENT', 'ACTIVE'],
            valid_until__gte=today
        )

        # Berechne Wert pro Angebot
        quotation_data = []
        total_value = Decimal('0')

        for quote in quotations.select_related('customer'):
            # Summiere Positionen
            items_total = quote.items.aggregate(
                total=Sum(F('quantity') * F('sale_price'))
            )['total'] or Decimal('0')
            
            quote_value = items_total + (quote.shipping_cost or Decimal('0')) + (quote.system_price or Decimal('0'))
            total_value += quote_value

            customer_name = None
            if quote.customer:
                customer_name = f"{quote.customer.first_name or ''} {quote.customer.last_name or ''}".strip()

            quotation_data.append({
                'id': quote.id,
                'quotation_number': quote.quotation_number,
                'customer_name': customer_name,
                'quote_date': quote.quote_date.isoformat() if quote.quote_date else None,
                'valid_until': quote.valid_until.isoformat() if quote.valid_until else None,
                'value': float(quote_value),
                'status': quote.status
            })

        # Gruppiere nach Monat (valid_until)
        quotations_annotated = quotations.annotate(period=TruncMonth('valid_until'))
        
        monthly_data = quotations_annotated.values('period').annotate(
            count=Count('id')
        ).order_by('period')

        # Berechne Wert pro Monat
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

        # Generiere Monate
        months = []
        for i in range(months_ahead):
            month_date = today + relativedelta(months=i)
            months.append(month_date.strftime('%Y-%m'))

        # Projekt-Forecast (weighted)
        projects = Project.objects.filter(
            status__in=['NEU', 'IN_BEARBEITUNG', 'ANGEBOT_ERSTELLT', 'DEMO_GEPLANT', 
                       'AUSSCHREIBUNG', 'AUFTRAG_ERTEILT', 'IN_FERTIGUNG'],
            forecast_date__isnull=False,
            forecast_revenue__isnull=False
        )

        project_by_month = {}
        for p in projects:
            period = p.forecast_date.strftime('%Y-%m') if p.forecast_date else None
            if period:
                if period not in project_by_month:
                    project_by_month[period] = {'total': 0, 'weighted': 0}
                project_by_month[period]['total'] += float(p.forecast_revenue or 0)
                project_by_month[period]['weighted'] += float((p.forecast_revenue or 0) * (p.forecast_probability or 0) / 100)

        # Angebots-Forecast
        quotations = Quotation.objects.filter(
            status__in=['SENT', 'ACTIVE'],
            valid_until__gte=today
        )

        quotation_by_month = {}
        for quote in quotations:
            period = quote.valid_until.strftime('%Y-%m') if quote.valid_until else None
            if period:
                items_total = quote.items.aggregate(
                    total=Sum(F('quantity') * F('sale_price'))
                )['total'] or Decimal('0')
                quote_value = float(items_total + (quote.shipping_cost or Decimal('0')) + (quote.system_price or Decimal('0')))
                
                if period not in quotation_by_month:
                    quotation_by_month[period] = 0
                quotation_by_month[period] += quote_value

        # Kombiniere Daten
        result = []
        for month in months:
            project_data = project_by_month.get(month, {'total': 0, 'weighted': 0})
            quotation_value = quotation_by_month.get(month, 0)
            
            result.append({
                'period': month,
                'project_forecast': project_data['total'],
                'project_weighted': project_data['weighted'],
                'quotation_forecast': quotation_value,
                'combined': project_data['weighted'] + quotation_value
            })

        # Summen
        total_project = sum(m['project_forecast'] for m in result)
        total_weighted = sum(m['project_weighted'] for m in result)
        total_quotation = sum(m['quotation_forecast'] for m in result)

        return Response({
            'data': result,
            'summary': {
                'total_project_forecast': total_project,
                'total_project_weighted': total_weighted,
                'total_quotation_forecast': total_quotation,
                'total_combined': total_weighted + total_quotation
            },
            'filters': {
                'months_ahead': months_ahead
            }
        })


class ExpectedPaymentsView(APIView):
    """
    Erwartete Zahlungseingänge
    
    Basiert auf:
    - Offene Aufträge (status: berechnet aber nicht bezahlt)
    - Zahlungsbedingungen
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        months_ahead = int(request.query_params.get('months_ahead', 6))

        # Offene Rechnungen (berechnet aber nicht bezahlt)
        orders = CustomerOrder.objects.filter(
            status='berechnet'
        ).select_related('customer')

        payments = []
        for order in orders:
            # Berechne erwartetes Zahlungsdatum basierend auf Zahlungsbedingungen
            # Default: 30 Tage nach Rechnungsdatum
            invoice_date = order.confirmation_date or order.order_date
            if invoice_date:
                payment_terms_days = 30  # TODO: Aus Kundendaten oder Auftrag lesen
                expected_date = invoice_date + timedelta(days=payment_terms_days)
                
                # Berechne Auftragswert
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

        # Sortiere nach erwartetem Zahlungsdatum
        payments.sort(key=lambda x: x['expected_payment_date'])

        # Gruppiere nach Monat
        months = []
        for i in range(months_ahead + 1):  # +1 für aktuellen Monat
            month_date = today + relativedelta(months=i)
            months.append(month_date.strftime('%Y-%m'))

        monthly_data = {m: {'amount': 0, 'count': 0} for m in months}
        monthly_data['overdue'] = {'amount': 0, 'count': 0}  # Überfällig

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

        # Formatiere Ergebnis
        result = []
        
        # Überfällig zuerst
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


class ProductListView(APIView):
    """
    Liste aller Produkte für Filter (mit Typ-Unterscheidung)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        product_type = request.query_params.get('type', 'all')
        search = request.query_params.get('search', '')

        products = []

        # Lazy imports to avoid circular imports
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
