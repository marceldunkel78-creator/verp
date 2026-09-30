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


class ProformaInvoiceDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate. Briefkopf, Fusszeile, Rand und
    Schriftgroessen kommen aus core.pdf_base und entsprechen damit
    der Corporate-Design-Vorlage.
    """
    def __init__(self, filename, company=None, manufacturer_return=None, **kwargs):
        self.manufacturer_return = manufacturer_return
        self.translations = None
        VerpDocTemplate.__init__(
            self, filename, company=company,
            **kwargs)



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


def generate_proforma_invoice_pdf(document):
    """
    Generiert ein professionelles PDF für eine Proforma-Invoice (immer Englisch)

    Args:
        document: RMAManufacturerReturn or RMAReturn instance
    """
    t = PROFORMA_TRANSLATIONS
    buffer = BytesIO()

    company = CompanySettings.get_settings()
    rma_case = document.rma_case

    doc = ProformaInvoiceDocTemplate(
        buffer,
        pagesize=A4,
        company=company,
        manufacturer_return=document
    )

    elements = []
    vs = get_company_styles()
    style_title = vs['VerpTitle']
    style_normal = vs['VerpBody']
    style_small = vs['VerpSmall']
    style_heading = vs['VerpHeading']

    # === EMPFÄNGER (Proforma-Adresse) und Dokumentbox wie in der Vorlage ===
    address_lines = [
        l for l in _get_proforma_recipient(document).split('\n') if l.strip()
    ]

    doc_box_lines = [
        (document.proforma_title or t['title'], True),
        (document.return_number, False),
        (f"{t['rma_number']} {rma_case.rma_number}", False),
    ]
    if getattr(rma_case, 'manufacturer_rma_number', None):
        doc_box_lines.append(
            (f"{t['manufacturer_rma']} {rma_case.manufacturer_rma_number}", False))

    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=document.return_date.strftime('%d.%m.%Y'),
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # === TITEL (editierbar) ===
    title_text = document.proforma_title or t['title']
    elements.append(Paragraph(sanitize_for_pdf(title_text), style_title))
    subtitle = getattr(document, 'proforma_subtitle', '') or t['subtitle']
    elements.append(Spacer(1, 0.2 * cm))
    elements.append(Paragraph(sanitize_for_pdf(subtitle), style_small))
    elements.append(Spacer(1, 0.5 * cm))

    # === POSITIONS-TABELLE ===
    headers = [
        t['pos'], t['description'], t['serial'], t['quantity'],
        t['weight'], t['hs_code'], t['value'], t['origin']
    ]

    total_weight = 0
    total_value = 0

    rows = []
    for idx, item in enumerate(document.items.all().select_related('rma_item'), 1):
        rma_item = item.rma_item
        desc = item.proforma_description or (rma_item.product_name if rma_item else item.custom_product_name or 'Eigene Position')
        serial = (rma_item.serial_number if rma_item else getattr(item, 'custom_serial_number', '')) or '—'
        weight = float(item.proforma_weight or 0)
        value = float(item.proforma_value or 0)
        total_weight += weight
        total_value += value

        rows.append([
            str(idx),
            Paragraph(sanitize_for_pdf(desc), style_small),
            Paragraph(serial, style_small),
            f"{item.quantity_returned:g}",
            f"{weight:g}",
            Paragraph(item.proforma_hs_code or '—', style_small),
            f"{value:.2f}",
            Paragraph(item.proforma_origin_country or '—', style_small),
        ])

    col_widths = [0.9 * cm, 4.0 * cm, 2.3 * cm, 1.4 * cm, 1.6 * cm, 1.8 * cm, 1.8 * cm, 2.0 * cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[4, 6]))
    elements.append(Spacer(1, 0.5 * cm))

    # === SUMMEN ===
    elements.append(build_totals_table([
        (t['total_weight'], f"{total_weight:g} kg"),
        (t['total_value'], f"{total_value:.2f}"),
    ]))
    elements.append(Spacer(1, 0.8 * cm))

    # === KOMMENTAR (unterhalb der Positionen) ===
    if document.proforma_comment:
        elements.append(Paragraph(t['comment'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(
            sanitize_for_pdf(document.proforma_comment).replace('\n', '<br/>'),
            style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))

    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))

    doc.build(elements)

    return buffer.getvalue()