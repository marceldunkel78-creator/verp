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
    Table, TableStyle, Paragraph, Spacer,
)
from company.models import CompanySettings
from core.pdf_base import (
    VerpDocTemplate,
    build_address_and_doc_row,
    build_document_box,
    build_positions_table,
    build_totals_table,
    format_amount,
    get_company_styles,
)
import os
from xml.sax.saxutils import escape

from .notizen_utils import sanitize_for_pdf


MANUFACTURER_DELIVERY_NOTE_TRANSLATIONS = {
    'de': {
        'delivery_note': 'Lieferschein',
        'rma_number': 'Visitron RMA-Nummer',
        'manufacturer_rma_number': 'Hersteller-RMA-Nummer',
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
        'rma_number': 'Visitron RMA Number',
        'manufacturer_rma_number': 'Manufacturer RMA Number',
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


class RMAManufacturerDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate. Briefkopf, Fusszeile, Rand und
    Schriftgroessen kommen aus core.pdf_base und entsprechen damit
    der Corporate-Design-Vorlage.
    """
    def __init__(self, filename, company=None, manufacturer_return=None, language='de', **kwargs):
        self.manufacturer_return = manufacturer_return
        self.translations = MANUFACTURER_TRANSLATIONS.get(language, MANUFACTURER_TRANSLATIONS['de'])
        VerpDocTemplate.__init__(
            self, filename, company=company,
            **kwargs)



def _get_manufacturer_address(rma_case):
    """Ermittelt die Herstelleradresse für den Lieferschein aus dem RMA-Fall"""
    lines = []
    if any([
        rma_case.manufacturer_address_name,
        rma_case.manufacturer_address_street,
        rma_case.manufacturer_address_house_number,
        rma_case.manufacturer_address_postal_code,
        rma_case.manufacturer_address_city,
        rma_case.manufacturer_address_country,
    ]):
        if rma_case.manufacturer_address_name:
            lines.append(rma_case.manufacturer_address_name)
        street = rma_case.manufacturer_address_street or ''
        if rma_case.manufacturer_address_house_number:
            street += f" {rma_case.manufacturer_address_house_number}"
        if street:
            lines.append(street)
        city_line = f"{rma_case.manufacturer_address_postal_code or ''} {rma_case.manufacturer_address_city or ''}".strip()
        if city_line:
            lines.append(city_line)
        if rma_case.manufacturer_address_country and rma_case.manufacturer_address_country != 'DE':
            lines.append(rma_case.manufacturer_address_country)
        return "\n".join([l for l in lines if l])

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
        # Niemals die Hersteller-RMA-Nummer als Adresse ausgeben. Wenn kein
        # verknüpft ist, darf keine RMA-Nummer als Adresse erscheinen.
        return ''

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
        company=company,
        manufacturer_return=manufacturer_return,
        language=language
    )

    elements = []
    vs = get_company_styles()
    style_title = vs['VerpTitle']
    style_normal = vs['VerpBody']
    style_small = vs['VerpSmall']
    style_heading = vs['VerpHeading']

    def pdf_text(value):
        """Escape dynamic values before inserting them into ReportLab markup."""
        return escape(str(value or ''))

    # === EMPFÄNGER (Hersteller) und Dokumentbox wie in der Vorlage ===
    address_lines = [
        l for l in escape(_get_manufacturer_address(rma_case)).split('\n')
        if l.strip()
    ]

    doc_box_lines = [
        (t['delivery_note'], True),
        (pdf_text(manufacturer_return.return_number), False),
        (f"{t['rma_number']} {pdf_text(rma_case.rma_number)}", False),
    ]
    if rma_case.manufacturer_rma_number:
        doc_box_lines.append((
            f"{t['manufacturer_rma_number']} "
            f"{pdf_text(rma_case.manufacturer_rma_number)}", False))

    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=manufacturer_return.return_date.strftime('%d.%m.%Y'),
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # === TITEL ===
    elements.append(Paragraph(t['delivery_note'], style_title))
    elements.append(Spacer(1, 0.2 * cm))
    your_rma_label = 'your RMA-Number' if language == 'en' else 'Ihre RMA-Nummer'
    your_rma_number = rma_case.manufacturer_rma_number or rma_case.rma_number
    elements.append(Paragraph(
        f"{your_rma_label}: {pdf_text(your_rma_number)}", style_small))
    elements.append(Spacer(1, 0.5 * cm))

    # === EINLEITUNG ===
    elements.append(Paragraph(t['intro'], style_normal))
    elements.append(Spacer(1, 0.5 * cm))

    # === POSITIONS-TABELLE ===
    headers = [t['pos'], t['article_number'], t['description'],
               t['quantity'], t['unit'], t['condition']]

    rows = []
    for idx, item in enumerate(manufacturer_return.items.all().select_related('rma_item'), 1):
        rma_item = item.rma_item
        product_name = item.custom_product_name or (rma_item.product_name if rma_item else 'Eigene Position')
        article_number = item.custom_article_number or (rma_item.article_number if rma_item else '')
        serial_number = item.custom_serial_number or (rma_item.serial_number if rma_item else '')
        unit = item.custom_unit or (rma_item.unit if rma_item else 'Stk')
        desc = product_name
        if serial_number:
            desc += f"<br/>S/N: {serial_number}"

        condition = item.condition_notes or 'OK'
        if len(condition) > 50:
            condition = condition[:47] + '...'

        rows.append([
            str(idx),
            Paragraph(escape(article_number or '—'), style_small),
            Paragraph(escape(desc), style_small),
            f"{item.quantity_returned:g}",
            unit,
            Paragraph(escape(condition), style_small),
        ])

    col_widths = [1.0 * cm, 2.2 * cm, 5.4 * cm, 1.5 * cm, 1.4 * cm, 4.5 * cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[]))
    elements.append(Spacer(1, 1 * cm))

    # === VERSANDINFOS ===
    if manufacturer_return.shipping_carrier or manufacturer_return.tracking_number:
        elements.append(Paragraph(t['shipping_info'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        if manufacturer_return.shipping_carrier:
            elements.append(Paragraph(
                f"{t['carrier']}: {pdf_text(manufacturer_return.shipping_carrier)}", style_small))
        if manufacturer_return.tracking_number:
            elements.append(Paragraph(
                f"{t['tracking']}: {pdf_text(manufacturer_return.tracking_number)}", style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === NOTIZEN ===
    if manufacturer_return.notes:
        elements.append(Paragraph(t['notes'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(
            sanitize_for_pdf(manufacturer_return.notes).replace('\n', '<br/>'), style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))

    if company:
        elements.append(Paragraph(pdf_text(company.company_name), style_normal))

    doc.build(elements)

    return buffer.getvalue()