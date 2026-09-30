"""
PDF Generator für RMA-Kalkulation (Dokumentation, keine Rechnung)
Professionelles DIN A4 Layout - analog zu rma_report_pdf.py
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    Table, TableStyle, Paragraph, Spacer,
)
from company.models import CompanySettings
from core.pdf_base import (
    VerpDocTemplate,
    build_document_box,
    build_address_and_doc_row,
    build_positions_table,
    build_totals_table,
    format_amount,
    get_company_styles,
)
import os

from .notizen_utils import sanitize_for_pdf


CALC_TRANSLATIONS = {
    'de': {
        'title': 'RMA-Kalkulation',
        'rma_number': 'RMA-Nummer',
        'customer': 'Kunde',
        'product': 'Produkt',
        'serial': 'Seriennummer',
        'material': 'Materialkosten',
        'labor': 'Arbeitskosten',
        'shipping': 'Versandkosten',
        'admin': 'Verwaltungskostenpauschale',
        'description': 'Beschreibung',
        'qty': 'Menge',
        'unit': 'Einh.',
        'unit_price': 'Einzelpreis',
        'total': 'Summe',
        'subtotal': 'Zwischensumme',
        'evaluation': 'Evaluierungskosten',
        'margin': 'Marge (%)',
        'end_price': 'Endpreis nach Marge',
        'shipping_after_margin': 'Versandkosten (nach Marge)',
        'total_cost': 'Gesamtkosten / Endpreis',
        'hourly_rate': 'Stundensatz',
        'regards': 'Mit freundlichen Grüßen',
        'page': 'Seite',
        'no_items': 'Keine Positionen',
    },
    'en': {
        'title': 'RMA Calculation',
        'rma_number': 'RMA Number',
        'customer': 'Customer',
        'product': 'Product',
        'serial': 'Serial Number',
        'material': 'Material Costs',
        'labor': 'Labor Costs',
        'shipping': 'Shipping Costs',
        'admin': 'Administration Fee',
        'description': 'Description',
        'qty': 'Qty',
        'unit': 'Unit',
        'unit_price': 'Unit Price',
        'total': 'Total',
        'subtotal': 'Subtotal',
        'evaluation': 'Evaluation Costs',
        'margin': 'Margin (%)',
        'end_price': 'End Price after Margin',
        'shipping_after_margin': 'Shipping Costs (after Margin)',
        'total_cost': 'Total Cost / Final Price',
        'hourly_rate': 'Hourly Rate',
        'regards': 'Best regards',
        'page': 'Page',
        'no_items': 'No items',
    },
}


class RMACalculationDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate für RMA-Kalkulation.

    Briefkopf, Fusszeile, Rand und Schriftgroessen kommen aus
    core.pdf_base und entsprechen damit der Corporate-Design-Vorlage.
    """
    def __init__(self, filename, company=None, rma_case=None, language='de', **kwargs):
        self.rma_case = rma_case
        # Eigener Attributname (nicht 'lang'), da reportlab 'lang' intern für PDF-Sprache nutzt
        self.translations = CALC_TRANSLATIONS.get(language, CALC_TRANSLATIONS['de'])

        t = self.translations
        rma_number = getattr(rma_case, 'rma_number', None) or '---'
        kwargs.setdefault('title', t['title'])
        VerpDocTemplate.__init__(
            self, filename, company=company,
            continuation_text=f"{t['title']} {rma_number}",
            **kwargs)


def _fmt_eur(value):
    return format_amount(value)


def _fmt_date(d):
    if not d:
        return '-'
    return d.strftime('%d.%m.%Y')


def generate_rma_calculation_pdf(rma_case, language='de'):
    """Generiert ein PDF zur Dokumentation der RMA-Kalkulation (keine Rechnung)."""
    t = CALC_TRANSLATIONS.get(language, CALC_TRANSLATIONS['de'])
    buffer = BytesIO()

    company = CompanySettings.get_settings()

    doc = RMACalculationDocTemplate(
        buffer,
        pagesize=A4,
        company=company,
        rma_case=rma_case,
        language=language
    )

    elements = []
    vs = get_company_styles()
    style_title = vs['VerpTitle']
    style_normal = vs['VerpBody']
    style_small = vs['VerpSmall']
    style_heading = vs['VerpHeading']

    # === EMPFÄNGER und Dokumentbox wie in der Vorlage ===
    customer_display = str(rma_case.customer) if rma_case.customer else (rma_case.customer_name or '-')
    address_lines = [sanitize_for_pdf(customer_display)]

    doc_box_lines = [
        (t['title'], True),
        (rma_case.rma_number, False),
        (f"{t['product']} {sanitize_for_pdf(rma_case.product_name or '-')}", False),
        (f"{t['serial']} {sanitize_for_pdf(rma_case.product_serial or '-')}", False),
    ]

    created = getattr(rma_case, 'created_at', None) or getattr(rma_case, 'rma_date', None)
    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=_fmt_date(created),
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # === TITEL ===
    elements.append(Paragraph(t['title'], style_title))
    if rma_case.title:
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(rma_case.title, style_small))
    elements.append(Spacer(1, 0.5 * cm))

    # === KOSTENPOSITIONEN ===
    cost_types = [
        ('material', t['material']),
        ('labor', t['labor']),
        ('shipping', t['shipping']),
    ]

    totals = {'material': 0, 'labor': 0, 'shipping': 0}

    for cost_type, heading in cost_types:
        lines = list(rma_case.cost_line_items.filter(cost_type=cost_type))
        elements.append(Paragraph(heading, style_heading))
        elements.append(Spacer(1, 0.2 * cm))

        if not lines:
            elements.append(Paragraph(t['no_items'], style_small))
            elements.append(Spacer(1, 0.3 * cm))
            continue

        headers = [t['description'], t['qty'], t['unit'], t['unit_price'], t['total']]
        rows = []
        for line in lines:
            rows.append([
                Paragraph(sanitize_for_pdf(line.description or '-'), style_small),
                f"{line.quantity:g}",
                line.unit or '-',
                format_amount(line.unit_price),
                format_amount(line.total_price),
            ])
            totals[cost_type] += float(line.total_price)

        col_widths = [6.5 * cm, 1.8 * cm, 1.8 * cm, 2.5 * cm, 2.5 * cm]
        elements.extend(build_positions_table(
            headers, rows, col_widths=col_widths, align_right=[3, 4]))
        elements.append(Spacer(1, 0.4 * cm))

    # === ZUSAMMENFASSUNG ===
    admin_fee = float(rma_case.admin_fee or 0)
    # Versandkosten werden erst NACH der Marge aufgerechnet:
    # Zwischensumme (ohne Versand) -> Marge -> + Versandkosten
    subtotal_without_shipping = totals['material'] + totals['labor'] + admin_fee
    margin = float(rma_case.margin_percent or 0)
    end_price = (subtotal_without_shipping / (100 - margin) * 100) if subtotal_without_shipping > 0 and (100 - margin) > 0 else subtotal_without_shipping
    shipping = totals['shipping']
    total_with_shipping = end_price + shipping
    evaluation = float(rma_case.evaluation_cost or 0)
    total_cost = max(total_with_shipping, evaluation)

    elements.append(Paragraph(t['subtotal'], style_heading))
    elements.append(Spacer(1, 0.2 * cm))
    elements.append(build_totals_table([
        (t['material'], format_amount(totals['material'])),
        (t['labor'], format_amount(totals['labor'])),
        (t['admin'], format_amount(admin_fee)),
        (t['subtotal'], format_amount(subtotal_without_shipping)),
        (t['margin'], f"{margin:g} %"),
        (t['end_price'], format_amount(end_price)),
        (t['shipping_after_margin'], format_amount(shipping)),
        (t['evaluation'], format_amount(evaluation)),
        (t['total_cost'], format_amount(total_cost)),
    ]))

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))
    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))

    doc.build(elements)
    return buffer.getvalue()
