from types import SimpleNamespace
from unittest.mock import Mock

from django.test import SimpleTestCase

from core.pdf_base import VerpDocTemplate


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
