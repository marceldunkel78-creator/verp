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
