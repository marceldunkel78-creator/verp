"""
PDF Generator für Herstellerreparatur-Lieferscheine (Versand an den Hersteller)
Professionelles DIN A4 Layout - analog zu rma_pdf_generator.py
Unterstützt Deutsch (de) und Englisch (en).
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


MANUFACTURER_DELIVERY_NOTE_TRANSLATIONS = {
    'de': {
        'delivery_note': 'Lieferschein',
        'rma_number': 'RMA-Nummer',
        'return_date': 'Versanddatum',
        'delivery_note_number': 'Lieferschein-Nr.',
        'intro': 'Hiermit senden wir folgende Ware zur Reparatur an den Hersteller:',
        'pos': 'Pos.',
        'article_number': 'Art.-Nr.',
        'description': 'Beschreibung',
        'quantity': 'Menge',
        'unit': 'Einh.',
        'condition': 'Zustand',
        'shipping_info': 'Versandinformationen:',
        'carrier': 'Versanddienstleister',
        'tracking': 'Sendungsnummer',
        'notes': 'Bemerkungen:',
        'regards': 'Mit freundlichen Grüßen',
        'page': 'Seite',
    },
    'en': {
        'delivery_note': 'Delivery Note',
        'rma_number': 'RMA Number',
        'return_date': 'Shipment Date',
        'delivery_note_number': 'Delivery Note No.',
        'intro': 'We are sending the following goods to the manufacturer for repair:',
        'pos': 'No.',
        'article_number': 'Art. No.',
        'description': 'Description',
        'quantity': 'Qty',
        'unit': 'Unit',
        'condition': 'Condition',
        'shipping_info': 'Shipping Information:',
        'carrier': 'Carrier',
        'tracking': 'Tracking Number',
        'notes': 'Notes:',
        'regards': 'Best regards',
        'page': 'Page',
    },
}


class RMAManufacturerDocTemplate(BaseDocTemplate):
    """
    Custom DocTemplate für Herstellerreparatur-Lieferscheine mit Header und Footer
    """
    def __init__(self, filename, company=None, manufacturer_return=None, language='de', **kwargs):
        self.company = company
        self.manufacturer_return = manufacturer_return
        BaseDocTemplate.__init__(self, filename, **kwargs)
        # Eigener Attributname (nicht 'lang'), da reportlab 'lang' intern für PDF-Sprache nutzt
        self.translations = MANUFACTURER_DELIVERY_NOTE_TRANSLATIONS.get(language, MANUFACTURER_DELIVERY_NOTE_TRANSLATIONS['de'])

        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id='normal'
        )

        template = PageTemplate(
            id='rma_manufacturer_delivery_note',
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
            header_text = f"{lang['page']} {page_num} - {lang['delivery_note']} {manufacturer_return.return_number}"
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


def _get_manufacturer_address(rma_case):
    """Ermittelt die Herstelleradresse für den Lieferschein aus dem RMA-Fall"""
    lines = []
    manufacturer = rma_case.manufacturer
    if manufacturer:
        lines.append(manufacturer.company_name or '')
        street = manufacturer.street or ''
        if manufacturer.house_number:
            street += f" {manufacturer.house_number}"
        if street:
            lines.append(street)
        if manufacturer.address_supplement:
            lines.append(manufacturer.address_supplement)
        city_line = f"{manufacturer.postal_code} {manufacturer.city}".strip()
        if city_line:
            lines.append(city_line)
        if manufacturer.country and manufacturer.country != 'DE':
            lines.append(manufacturer.country)
    else:
        lines.append(rma_case.manufacturer_rma_number or '')

    return "\n".join([l for l in lines if l])


def generate_rma_manufacturer_delivery_note_pdf(manufacturer_return, language='de'):
    """
    Generiert ein professionelles PDF für einen Herstellerreparatur-Lieferschein

    Args:
        manufacturer_return: RMAManufacturerReturn instance
        language: 'de' (German) or 'en' (English)
    """
    t = MANUFACTURER_DELIVERY_NOTE_TRANSLATIONS.get(language, MANUFACTURER_DELIVERY_NOTE_TRANSLATIONS['de'])
    buffer = BytesIO()

    company = CompanySettings.get_settings()
    rma_case = manufacturer_return.rma_case

    doc = RMAManufacturerDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.5 * cm,
        bottomMargin=3.5 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        company=company,
        manufacturer_return=manufacturer_return,
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

    style_normal = styles['Normal']
    style_small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8)

    # === ABSENDER (einzeilig) ===
    elements.append(Spacer(1, 0.5 * cm))
    if company:
        sender_line = f"{company.company_name} • {company.street} {company.house_number} • {company.postal_code} {company.city}"
        elements.append(Paragraph(sender_line, style_small))
        elements.append(Spacer(1, 0.3 * cm))

    # === EMPFÄNGER (Hersteller) ===
    recipient_address = _get_manufacturer_address(rma_case).replace('\n', '<br/>')
    elements.append(Paragraph(f"<b>{recipient_address}</b>", style_normal))
    elements.append(Spacer(1, 1 * cm))

    # === DOKUMENT-METADATEN ===
    meta_text = f"""<para align=right>
    <b>{t['delivery_note_number']}:</b> {manufacturer_return.return_number}<br/>
    <b>{t['rma_number']}:</b> {rma_case.rma_number}<br/>
    <b>{t['return_date']}:</b> {manufacturer_return.return_date.strftime('%d.%m.%Y')}<br/>
    """
    if rma_case.manufacturer_rma_number:
        meta_text += f"<b>{t['rma_number']} (Hersteller):</b> {rma_case.manufacturer_rma_number}<br/>"
    meta_text += "</para>"
    elements.append(Paragraph(meta_text, style_normal))
    elements.append(Spacer(1, 0.8 * cm))

    # === TITEL ===
    elements.append(Paragraph(f"<b>{t['delivery_note']} {manufacturer_return.return_number}</b>", style_title))
    elements.append(Paragraph(f"RMA {rma_case.rma_number} - {rma_case.title}", style_subtitle))

    # === EINLEITUNG ===
    elements.append(Paragraph(
        t['intro'],
        style_normal
    ))
    elements.append(Spacer(1, 0.5 * cm))

    # === POSITIONS-TABELLE ===
    table_data = [[t['pos'], t['article_number'], t['description'], t['quantity'], t['unit'], t['condition']]]

    for idx, item in enumerate(manufacturer_return.items.all().select_related('rma_item'), 1):
        rma_item = item.rma_item
        desc = rma_item.product_name
        if rma_item.serial_number:
            desc += f"\nS/N: {rma_item.serial_number}"

        condition = item.condition_notes or 'OK'
        if len(condition) > 50:
            condition = condition[:47] + '...'

        table_data.append([
            str(idx),
            Paragraph(rma_item.article_number or '—', style_small),
            Paragraph(desc, style_small),
            f"{item.quantity_returned:g}",
            rma_item.unit,
            Paragraph(condition, style_small)
        ])

    table = Table(table_data, colWidths=[1.2 * cm, 2.5 * cm, 6 * cm, 1.5 * cm, 1.5 * cm, 4 * cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#cc0066')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),

        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
        ('VALIGN', (0, 1), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),

        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),

        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#cc0066')),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 1 * cm))

    # === VERSANDINFOS ===
    if manufacturer_return.shipping_carrier or manufacturer_return.tracking_number:
        elements.append(Paragraph(f"<b>{t['shipping_info']}</b>", style_normal))
        if manufacturer_return.shipping_carrier:
            elements.append(Paragraph(f"{t['carrier']}: {manufacturer_return.shipping_carrier}", style_small))
        if manufacturer_return.tracking_number:
            elements.append(Paragraph(f"{t['tracking']}: {manufacturer_return.tracking_number}", style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === NOTIZEN ===
    if manufacturer_return.notes:
        elements.append(Paragraph(f"<b>{t['notes']}</b>", style_normal))
        elements.append(Paragraph(sanitize_for_pdf(manufacturer_return.notes).replace('\n', '<br/>'), style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))

    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))

    doc.build(elements)

    return buffer.getvalue()