"""
PDF Generator für RMA-Lieferscheine (Warenausgang)
Professionelles DIN A4 Layout - analog zu loans/pdf_generator.py
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


DELIVERY_NOTE_TRANSLATIONS = {
    'de': {
        'delivery_note': 'Lieferschein',
        'rma_number': 'Visitron RMA-Nummer',
        'return_date': 'Versanddatum',
        'delivery_note_number': 'Lieferschein-Nr.',
        'intro': 'Hiermit senden wir folgende Ware zurück:',
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
        'return_date': 'Shipment Date',
        'delivery_note_number': 'Delivery Note No.',
        'intro': 'We are returning the following goods:',
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


class RMADeliveryNoteDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate. Briefkopf, Fusszeile, Rand und
    Schriftgroessen kommen aus core.pdf_base und entsprechen damit
    der Corporate-Design-Vorlage.
    """
    def __init__(self, filename, company=None, rma_return=None, language='de', **kwargs):
        self.rma_return = rma_return
        self.translations = DELIVERY_NOTE_TRANSLATIONS.get(language, DELIVERY_NOTE_TRANSLATIONS['de'])
        VerpDocTemplate.__init__(
            self, filename, company=company, language=language,
            continuation_text=f"{self.translations['delivery_note']} {rma_return.return_number}",
            **kwargs)



def _get_recipient_address(rma_case):
    """Ermittelt die Empfängeradresse für den Lieferschein aus dem RMA-Fall"""
    lines = []

    # Die im Warenausgang-Tab eingetragene Adresse ist die maßgebliche
    # Versandadresse. Zuvor wurde sie ignoriert und immer die erste aktive
    # Kundenadresse verwendet.
    if any([
        rma_case.address_name,
        rma_case.address_street,
        rma_case.address_house_number,
        rma_case.address_postal_code,
        rma_case.address_city,
        rma_case.address_country,
    ]):
        if rma_case.address_name:
            lines.append(rma_case.address_name)
        street = rma_case.address_street or ''
        if rma_case.address_house_number:
            street += f" {rma_case.address_house_number}"
        if street:
            lines.append(street)
        city_line = f"{rma_case.address_postal_code or ''} {rma_case.address_city or ''}".strip()
        if city_line:
            lines.append(city_line)
        if rma_case.address_country and rma_case.address_country != 'DE':
            lines.append(rma_case.address_country)
    elif rma_case.customer:
        customer = rma_case.customer
        full_name = f"{customer.title} {customer.first_name} {customer.last_name}".strip()
        lines.append(rma_case.customer_name or full_name)
        address = customer.addresses.filter(is_active=True).first()
        if address:
            street = address.street
            if address.house_number:
                street += f" {address.house_number}"
            lines.append(street)
            lines.append(f"{address.postal_code} {address.city}".strip())
            if address.country and address.country != 'DE':
                lines.append(address.country)
    else:
        lines.append(rma_case.customer_name or '')

    if rma_case.customer_contact:
        lines.append(f"z.Hd. {rma_case.customer_contact}")

    return "\n".join([l for l in lines if l])


def generate_rma_delivery_note_pdf(rma_return, language='de'):
    """
    Generiert ein professionelles PDF für einen RMA-Lieferschein (Warenausgang)

    Args:
        rma_return: RMAReturn instance
        language: 'de' (German) or 'en' (English)
    """
    t = DELIVERY_NOTE_TRANSLATIONS.get(language, DELIVERY_NOTE_TRANSLATIONS['de'])
    buffer = BytesIO()

    company = CompanySettings.get_settings()
    rma_case = rma_return.rma_case

    doc = RMADeliveryNoteDocTemplate(
        buffer,
        pagesize=A4,
        company=company,
        rma_return=rma_return,
        language=language
    )

    elements = []
    vs = get_company_styles()
    style_title = vs['VerpTitle']
    style_normal = vs['VerpBody']
    style_small = vs['VerpSmall']
    style_heading = vs['VerpHeading']

    # === EMPFÄNGER und Dokumentbox wie in der Vorlage ===
    address_lines = [
        l for l in escape(_get_recipient_address(rma_case)).split('\n') if l.strip()
    ]

    doc_box_lines = [
        (t['delivery_note'], True),
        (rma_return.return_number, False),
        (f"{t['rma_number']} {rma_case.rma_number}", False),
    ]

    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=rma_return.return_date.strftime('%d.%m.%Y'),
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # === TITEL ===
    elements.append(Paragraph(t['delivery_note'], style_title))
    elements.append(Spacer(1, 0.2 * cm))
    elements.append(Paragraph(
        f"{t['rma_number']}: {rma_case.rma_number}", style_small))
    elements.append(Spacer(1, 0.5 * cm))

    # === EINLEITUNG ===
    elements.append(Paragraph(t['intro'], style_normal))
    elements.append(Spacer(1, 0.5 * cm))

    # === POSITIONS-TABELLE ===
    headers = [t['pos'], t['article_number'], t['description'],
               t['quantity'], t['unit'], t['condition']]

    rows = []
    for idx, item in enumerate(rma_return.items.all().select_related('rma_item'), 1):
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
            Paragraph(article_number or '—', style_small),
            Paragraph(desc, style_small),
            f"{item.quantity_returned:g}",
            unit,
            Paragraph(condition, style_small),
        ])

    col_widths = [1.0 * cm, 2.2 * cm, 5.4 * cm, 1.5 * cm, 1.4 * cm, 4.5 * cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[]))
    elements.append(Spacer(1, 1 * cm))

    # === VERSANDINFOS ===
    if rma_return.shipping_carrier or rma_return.tracking_number:
        elements.append(Paragraph(t['shipping_info'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        if rma_return.shipping_carrier:
            elements.append(Paragraph(
                f"{t['carrier']}: {rma_return.shipping_carrier}", style_small))
        if rma_return.tracking_number:
            elements.append(Paragraph(
                f"{t['tracking']}: {rma_return.tracking_number}", style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === NOTIZEN ===
    if rma_return.notes:
        elements.append(Paragraph(t['notes'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(
            sanitize_for_pdf(rma_return.notes).replace('\n', '<br/>'), style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))

    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))

    doc.build(elements)

    return buffer.getvalue()
