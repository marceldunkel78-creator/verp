from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate

import core.views
from core.pdf_base import VerpDocTemplate


class SearchResults(list):
    def distinct(self):
        return self


class GlobalSearchProcurementOrderTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = SimpleNamespace(
            is_authenticated=True,
            is_staff=False,
            is_superuser=False,
            can_read_procurement_orders=False,
            can_write_procurement_orders=False,
        )

    def test_procurement_orders_are_included_for_users_with_read_permission(self):
        self.user.can_read_procurement_orders = True
        order = SimpleNamespace(
            pk=42,
            order_number='B-123-11/26',
            supplier=SimpleNamespace(company_name='Lieferant'),
            get_status_display=lambda: 'Bestellt',
        )
        request = self.factory.get('/api/core/global-search/', {'q': 'B-123'})
        force_authenticate(request, user=self.user)
        order_query = Mock()
        order_query.select_related.return_value = order_query
        order_query.distinct.return_value = [order]
        with ExitStack() as patches:
            for model in (core.views.Customer, core.views.InventoryItem, core.views.VisiViewLicense):
                patches.enter_context(patch.object(model.objects, 'filter', return_value=[]))
            patches.enter_context(patch.object(core.views.CustomerOrder.objects, 'filter', return_value=SearchResults()))
            patches.enter_context(patch.object(core.views.System.objects, 'filter', return_value=SearchResults()))
            patches.enter_context(patch.object(core.views.Order.objects, 'filter', return_value=order_query))
            response = core.views.global_search(request)

        match = next(result for result in response.data['results'] if result['type'] == 'procurement-order')
        self.assertEqual(match['title'], 'B-123-11/26')
        self.assertEqual(match['url'], '/procurement/orders/42')

    def test_procurement_orders_are_not_returned_without_permission(self):
        request = self.factory.get('/api/core/global-search/', {'q': 'B-123'})
        force_authenticate(request, user=self.user)
        with ExitStack() as patches:
            for model in (core.views.Customer, core.views.InventoryItem, core.views.VisiViewLicense,
                          core.views.Order):
                patches.enter_context(patch.object(model.objects, 'filter', return_value=[]))
            patches.enter_context(patch.object(core.views.System.objects, 'filter', return_value=SearchResults()))
            patches.enter_context(patch.object(core.views.CustomerOrder.objects, 'filter', return_value=SearchResults()))
            response = core.views.global_search(request)

        self.assertFalse(any(result['type'] == 'procurement-order' for result in response.data['results']))


class FooterAddressTests(SimpleTestCase):
    def test_footer_uses_company_house_number(self):
        template = VerpDocTemplate.__new__(VerpDocTemplate)
        template.company = SimpleNamespace(
            company_name='Visitron Systems GmbH', street='Gutenbergstraße', house_number='3', bank_name='', iban='', bic='',
            postal_code='82178', city='Puchheim', phone='', email='', website='',
            register_court='', commercial_register='', managing_director='',
        )
        canvas = Mock()
        template._draw_footer(canvas)

        drawn_text = [call.args[2] for call in canvas.drawString.call_args_list]
        self.assertIn('Gutenbergstraße 3', drawn_text)
