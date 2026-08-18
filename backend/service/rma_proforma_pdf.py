"""
PDF Generator für Proforma-Invoice (Herstellerreparatur, Versand ins nicht-europäische Ausland)
Professionelles DIN A4 Layout - analog zu rma_manufacturer_pdf.py
Immer auf Englisch (für Zollzwecke).
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


PROFORMA_TRANSLATIONS = {
    'title': 'Proforma Invoice',
    'subtitle': 'For Customs Purposes Only / No Commercial Value',
    'invoice_number': 'Proforma Invoice No.',
    'rma_number': 'RMA Number',
    'manufacturer_rma': 'Manufacturer RMA',
    'date': 'Date',
    'seller': 'Seller',
    'consignee': 'Consignee',
    'pos': 'No.',
    'description': 'Description',
    'serial': 'Serial No.',
    'quantity': 'Qty',
    'weight': 'Weight (kg)',
    'hs_code': 'HS Code',
    'value': 'Value',
    'origin': 'Country of Origin',
    'total_weight': 'Total Weight',
    'total_value': 'Total Value',
    'comment': 'Comment',
    'regards': 'Best regards',
    'page': 'Page',
}


class ProformaInvoiceDocTemplate(BaseDocTemplate):
    """
    Custom DocTemplate für Proforma-Invoices mit Header und Footer
    """
    def __init__(self, filename, company=None, manufacturer_return=None, **kwargs):
        self.company = company
        self.manufacturer_return = manufacturer_return
        BaseDocTemplate.__init__(self, filename, **kwargs)
        # Eigener Attributname (nicht 'lang'), da reportlab 'lang' intern für PDF-Sprache nutzt
        self.translations = PROFORMA_TRANSLATIONS

        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id='normal'
        )

        template = PageTemplate(
            id='proforma_invoice',
            frames=frame,
            onPage=self._add_header_footer
        )
        self.addPageTemplates([template])

    def _add_header_footer(self, canvas, doc):
        """Fügt Header und Footer zu jeder Seite hinzu"""
        canvas.saveState()

        width, height = A4
        company = self.company
        manufacturer_return = self.manufacturer_return
        lang = self.translations

        # === HEADER ===
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
            header_text = f"{lang['page']} {page_num} - {lang['title']} {manufacturer_return.return_number}"
            canvas.drawString(2 * cm, height - 3.2 * cm, header_text)
            canvas.setStrokeColor(colors.grey)
            canvas.line(2 * cm, height - 3.4 * cm, width - 2 * cm, height - 3.4 * cm)

        # === FOOTER ===
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


def _get_proforma_recipient(manufacturer_return):
    """Ermittelt die Proforma-Invoice Empfängeradresse aus den gespeicherten Feldern"""
    lines = []
    if manufacturer_return.proforma_address_name:
        lines.append(manufacturer_return.proforma_address_name)
    street = manufacturer_return.proforma_address_street or ''
    if manufacturer_return.proforma_address_house_number:
        street += f" {manufacturer_return.proforma_address_house_number}"
    if street:
        lines.append(street)
    city_line = f"{manufacturer_return.proforma_address_postal_code} {manufacturer_return.proforma_address_city}".strip()
    if city_line:
        lines.append(city_line)
    if manufacturer_return.proforma_address_country:
        lines.append(manufacturer_return.proforma_address_country)
    return "\n".join([l for l in lines if l])


def generate_proforma_invoice_pdf(manufacturer_return):
    """
    Generiert ein professionelles PDF für eine Proforma-Invoice (immer Englisch)

    Args:
        manufacturer_return: RMAManufacturerReturn instance
    """
    t = PROFORMA_TRANSLATIONS
    buffer = BytesIO()

    company = CompanySettings.get_settings()
    rma_case = manufacturer_return.rma_case

    doc = ProformaInvoiceDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.5 * cm,
        bottomMargin=3.5 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        company=company,
        manufacturer_return=manufacturer_return
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

    style_normal = styles['Normal']
    style_small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8)

    # === ABSENDER (einzeilig) ===
    elements.append(Spacer(1, 0.5 * cm))
    if company:
        sender_line = f"{company.company_name} • {company.street} {company.house_number} • {company.postal_code} {company.city}"
        elements.append(Paragraph(sender_line, style_small))
        elements.append(Spacer(1, 0.3 * cm))

    # === EMPFÄNGER (Proforma-Adresse) ===
    recipient_address = _get_proforma_recipient(manufacturer_return).replace('\n', '<br/>')
    elements.append(Paragraph(f"<b>{recipient_address}</b>", style_normal))
    elements.append(Spacer(1, 1 * cm))

    # === DOKUMENT-METADATEN ===
    meta_text = f"""<para align=right>
    <b>{t['invoice_number']}:</b> {manufacturer_return.return_number}<br/>
    <b>{t['rma_number']}:</b> {rma_case.rma_number}<br/>
    """
    if rma_case.manufacturer_rma_number:
        meta_text += f"<b>{t['manufacturer_rma']}:</b> {rma_case.manufacturer_rma_number}<br/>"
    meta_text += f"""<b>{t['date']}:</b> {manufacturer_return.return_date.strftime('%d.%m.%Y')}<br/>
    </para>"""
    elements.append(Paragraph(meta_text, style_normal))
    elements.append(Spacer(1, 0.8 * cm))

    # === TITEL (editierbar) ===
    title_text = manufacturer_return.proforma_title or t['title']
    elements.append(Paragraph(f"<b>{sanitize_for_pdf(title_text)}</b>", style_title))
    elements.append(Paragraph(t['subtitle'], style_subtitle))

    # === POSITIONS-TABELLE ===
    table_data = [[
        t['pos'], t['description'], t['serial'], t['quantity'],
        t['weight'], t['hs_code'], t['value'], t['origin']
    ]]

    total_weight = 0
    total_value = 0

    for idx, item in enumerate(manufacturer_return.items.all().select_related('rma_item'), 1):
        rma_item = item.rma_item
        desc = item.proforma_description or rma_item.product_name
        serial = item.rma_item.serial_number or '—'
        weight = float(item.proforma_weight or 0)
        value = float(item.proforma_value or 0)
        total_weight += weight
        total_value += value

        table_data.append([
            str(idx),
            Paragraph(sanitize_for_pdf(desc), style_small),
            Paragraph(serial, style_small),
            f"{item.quantity_returned:g}",
            f"{weight:g}",
            Paragraph(item.proforma_hs_code or '—', style_small),
            f"{value:.2f}",
            Paragraph(item.proforma_origin_country or '—', style_small)
        ])

    table = Table(table_data, colWidths=[1 * cm, 4.5 * cm, 2.5 * cm, 1.5 * cm, 1.8 * cm, 2 * cm, 2 * cm, 2.2 * cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#cc0066')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),

        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
        ('ALIGN', (4, 1), (4, -1), 'RIGHT'),
        ('ALIGN', (6, 1), (6, -1), 'RIGHT'),
        ('VALIGN', (0, 1), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),

        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),

        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#cc0066')),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 0.5 * cm))

    # === SUMMEN ===
    summary_data = [
        [t['total_weight'], f"{total_weight:g} kg"],
        [t['total_value'], f"{total_value:.2f}"],
    ]
    summary_table = Table(summary_data, colWidths=[8 * cm, 8 * cm])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 0.8 * cm))

    # === KOMMENTAR (unterhalb der Positionen) ===
    if manufacturer_return.proforma_comment:
        elements.append(Paragraph(f"<b>{t['comment']}</b>", style_normal))
        elements.append(Paragraph(sanitize_for_pdf(manufacturer_return.proforma_comment).replace('\n', '<br/>'), style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))

    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))

    doc.build(elements)

    return buffer.getvalue()