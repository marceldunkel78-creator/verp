"""
PDF Generator für RMA-Kalkulation (Dokumentation, keine Rechnung)
Professionelles DIN A4 Layout - analog zu rma_report_pdf.py
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    Frame, PageTemplate, BaseDocTemplate
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.utils import ImageReader
from company.models import CompanySettings
from django.conf import settings
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


class RMACalculationDocTemplate(BaseDocTemplate):
    """Custom DocTemplate für RMA-Kalkulation mit Header und Footer"""
    def __init__(self, filename, company=None, rma_case=None, language='de', **kwargs):
        self.company = company
        self.rma_case = rma_case
        BaseDocTemplate.__init__(self, filename, **kwargs)
        # Eigener Attributname (nicht 'lang'), da reportlab 'lang' intern für PDF-Sprache nutzt
        self.translations = CALC_TRANSLATIONS.get(language, CALC_TRANSLATIONS['de'])

        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id='normal'
        )
        template = PageTemplate(
            id='rma_calculation',
            frames=frame,
            onPage=self._add_header_footer
        )
        self.addPageTemplates([template])

    def _add_header_footer(self, canvas, doc):
        canvas.saveState()
        width, height = A4
        company = self.company
        rma_case = self.rma_case
        lang = self.translations

        page_num = canvas.getPageNumber()

        if page_num == 1 and company and company.document_header:
            try:
                logo_path = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
                if os.path.exists(logo_path):
                    logo_x = width - 7 * cm
                    logo_y = height - 2.5 * cm
                    try:
                        img = ImageReader(logo_path)
                        canvas.drawImage(img, logo_x, logo_y, width=5 * cm, height=1.5 * cm,
                                        preserveAspectRatio=True, anchor='nw', mask='auto')
                    except Exception:
                        canvas.drawImage(logo_path, logo_x, logo_y, width=5 * cm, height=1.5 * cm,
                                        preserveAspectRatio=True, anchor='nw')
            except Exception as e:
                print(f"Error loading header logo: {e}")

        if page_num > 1:
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.grey)
            header_text = f"{lang['page']} {page_num} - {lang['title']} {rma_case.rma_number}"
            canvas.drawString(2 * cm, height - 3.2 * cm, header_text)
            canvas.setStrokeColor(colors.grey)
            canvas.line(2 * cm, height - 3.4 * cm, width - 2 * cm, height - 3.4 * cm)

        footer_y = 1.2 * cm
        canvas.setStrokeColor(colors.grey)
        canvas.line(2 * cm, footer_y + 1.8 * cm, width - 2 * cm, footer_y + 1.8 * cm)
        canvas.setFont('Helvetica', 6.5)
        canvas.setFillColor(colors.HexColor('#333333'))

        if company:
            col1_x = 2 * cm
            canvas.drawString(col1_x, footer_y + 1.4 * cm, company.company_name or '')
            canvas.drawString(col1_x, footer_y + 0.9 * cm, f"{company.street or ''} {company.house_number or ''}")
            canvas.drawString(col1_x, footer_y + 0.4 * cm, f"D-{company.postal_code or ''} {company.city or ''}")

            col2_x = 6.5 * cm
            canvas.drawString(col2_x, footer_y + 1.4 * cm, f"Tel. {company.phone or ''}")
            canvas.drawString(col2_x, footer_y + 0.9 * cm, company.email or '')
            canvas.drawString(col2_x, footer_y + 0.4 * cm, (company.website or '').replace('https://', '').replace('http://', ''))

            col3_x = 10.5 * cm
            canvas.drawString(col3_x, footer_y + 1.4 * cm, f"{company.register_court or ''}, {company.commercial_register or ''}")
            canvas.drawString(col3_x, footer_y + 0.9 * cm, "Geschäftsführer:")
            canvas.drawString(col3_x, footer_y + 0.4 * cm, company.managing_director or '')

            col4_x = 15 * cm
            canvas.drawString(col4_x, footer_y + 1.4 * cm, company.bank_name or '')
            canvas.drawString(col4_x, footer_y + 0.9 * cm, f"BIC: {company.bic or ''}")
            canvas.drawString(col4_x, footer_y + 0.4 * cm, f"IBAN: {company.iban or ''}")

        canvas.restoreState()


def _fmt_eur(value):
    try:
        return f"{float(value):,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.')
    except (TypeError, ValueError):
        return '0,00 €'


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
        topMargin=3.5 * cm,
        bottomMargin=3.5 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        company=company,
        rma_case=rma_case,
        language=language
    )

    elements = []
    styles = getSampleStyleSheet()

    style_title = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#cc0066'),
        spaceAfter=6
    )
    style_subtitle = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#666666'),
        spaceAfter=20
    )
    style_heading = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#333333'),
        spaceBefore=15,
        spaceAfter=8
    )
    style_normal = styles['Normal']
    style_small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8)

    # === ABSENDER ===
    elements.append(Spacer(1, 0.5 * cm))
    if company:
        sender_line = f"{company.company_name} • {company.street} {company.house_number} • {company.postal_code} {company.city}"
        elements.append(Paragraph(sender_line, style_small))
        elements.append(Spacer(1, 0.3 * cm))

    # === METADATEN ===
    customer_display = str(rma_case.customer) if rma_case.customer else (rma_case.customer_name or '-')
    meta_text = f"""<para align=right>
    <b>{t['rma_number']}:</b> {rma_case.rma_number}<br/>
    <b>{t['customer']}:</b> {sanitize_for_pdf(customer_display)}<br/>
    <b>{t['product']}:</b> {sanitize_for_pdf(rma_case.product_name or '-')}<br/>
    <b>{t['serial']}:</b> {sanitize_for_pdf(rma_case.product_serial or '-')}<br/>
    </para>"""
    elements.append(Paragraph(meta_text, style_normal))
    elements.append(Spacer(1, 0.8 * cm))

    # === TITEL ===
    elements.append(Paragraph(f"<b>{t['title']} {rma_case.rma_number}</b>", style_title))
    elements.append(Paragraph(rma_case.title or '', style_subtitle))

    # === KOSTENPOSITIONEN ===
    cost_types = [
        ('material', t['material']),
        ('labor', t['labor']),
        ('shipping', t['shipping']),
    ]

    totals = {'material': 0, 'labor': 0, 'shipping': 0}

    for cost_type, heading in cost_types:
        lines = rma_case.cost_line_items.filter(cost_type=cost_type)
        elements.append(Paragraph(f"<b>{heading}</b>", style_heading))

        if not lines.exists():
            elements.append(Paragraph(t['no_items'], style_small))
            elements.append(Spacer(1, 0.3 * cm))
            continue

        table_data = [[t['description'], t['qty'], t['unit'], t['unit_price'], t['total']]]
        for line in lines:
            table_data.append([
                Paragraph(sanitize_for_pdf(line.description or '-'), style_small),
                f"{line.quantity:g}",
                line.unit or '-',
                _fmt_eur(line.unit_price),
                _fmt_eur(line.total_price)
            ])
            totals[cost_type] += float(line.total_price)

        table = Table(table_data, colWidths=[7 * cm, 2 * cm, 2 * cm, 2.5 * cm, 2.5 * cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#cc0066')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]))
        elements.append(table)
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

    elements.append(Paragraph(f"<b>{t['subtotal']}</b>", style_heading))
    summary_data = [
        [t['material'], _fmt_eur(totals['material'])],
        [t['labor'], _fmt_eur(totals['labor'])],
        [t['admin'], _fmt_eur(admin_fee)],
        [t['subtotal'], _fmt_eur(subtotal_without_shipping)],
        [t['margin'], f"{margin:g} %"],
        [t['end_price'], _fmt_eur(end_price)],
        [t['shipping_after_margin'], _fmt_eur(shipping)],
        [t['evaluation'], _fmt_eur(evaluation)],
        [t['total_cost'], _fmt_eur(total_cost)],
    ]
    summary_table = Table(summary_data, colWidths=[8 * cm, 8 * cm])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('BACKGROUND', (0, 8), (-1, 8), colors.HexColor('#cc0066')),
        ('TEXTCOLOR', (0, 8), (-1, 8), colors.white),
        ('FONTNAME', (0, 8), (-1, 8), 'Helvetica-Bold'),
    ]))
    elements.append(summary_table)

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))
    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))

    doc.build(elements)
    return buffer.getvalue()
