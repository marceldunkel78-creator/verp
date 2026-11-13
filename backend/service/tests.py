from django.test import SimpleTestCase

from .service_report_pdf import _split_blocks_with_style


class ServiceReportPdfListTests(SimpleTestCase):
    def test_nested_bullet_is_rendered_at_indented_depth(self):
        html = (
            '<ul>'
            '<li><p>Erster Punkt</p></li>'
            '<li><p>Zweiter Punkt</p><ul><li><p>Eingerueckter Punkt</p></li></ul></li>'
            '</ul>'
        )

        blocks = _split_blocks_with_style(html)

        self.assertEqual(
            blocks,
            [
                ('&bull;&nbsp; Erster Punkt', 'li-bullet-0'),
                ('&bull;&nbsp; Zweiter Punkt', 'li-bullet-0'),
                ('&bull;&nbsp; Eingerueckter Punkt', 'li-bullet-1'),
            ],
        )


from unittest.mock import Mock

from .models import RMACase
from .views import RMACaseViewSet


class RMACaseSearchTests(SimpleTestCase):
    def test_search_fields_resolve_to_actual_rma_model_fields(self):
        for search_field in RMACaseViewSet.search_fields:
            model = RMACase
            for field_name in search_field.split('__'):
                field = model._meta.get_field(field_name)
                if field.is_relation:
                    model = field.related_model
        self.assertIn('product_serial', RMACaseViewSet.search_fields)
        self.assertIn('customer__first_name', RMACaseViewSet.search_fields)
        self.assertIn('customer__last_name', RMACaseViewSet.search_fields)
        self.assertIn('customer__customer_number', RMACaseViewSet.search_fields)
        self.assertNotIn('serial_number', RMACaseViewSet.search_fields)

    def test_rma_list_filters_submitted_search_by_serial(self):
        view = RMACaseViewSet()
        view.request = Mock(query_params={'search': 'CAM-42'})
        queryset = view.get_queryset()
        filtered = view.filter_queryset(queryset)

        self.assertIn('product_serial', str(filtered.query))
        self.assertNotIn('serial_number', str(filtered.query))
