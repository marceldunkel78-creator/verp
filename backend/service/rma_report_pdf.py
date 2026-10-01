"""
PDF Generator für RMA-Reparaturberichte
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
    FONT_BOLD,
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


REPORT_TRANSLATIONS = {
    'de': {
        'repair_report': 'Reparaturbericht',
        'rma_number': 'RMA-Nummer',
        'repair_date': 'Reparaturdatum',
        'repaired_by': 'Repariert von',
        'product_info': 'Produktinformationen',
        'product_name': 'Produktbezeichnung',
        'serial_number': 'Seriennummer',
        'purchase_date': 'Kaufdatum',
        'warranty_status': 'Garantiestatus',
        'fault_description': 'Fehlerbeschreibung (vom Kunden)',
        'diagnosis': 'Diagnose / Fehleranalyse',
        'repair_actions': 'Durchgeführte Maßnahmen',
        'parts_used': 'Verwendete Ersatzteile',
        'test_results': 'Testergebnisse',
        'final_notes': 'Abschlussnotizen',
        'regards': 'Mit freundlichen Grüßen',
        'page': 'Seite',
    },
    'en': {
        'repair_report': 'Repair Report',
        'rma_number': 'RMA Number',
        'repair_date': 'Repair Date',
        'repaired_by': 'Repaired by',
        'product_info': 'Product Information',
        'product_name': 'Product Name',
        'serial_number': 'Serial Number',
        'purchase_date': 'Purchase Date',
        'warranty_status': 'Warranty Status',
        'fault_description': 'Fault Description (from customer)',
        'diagnosis': 'Diagnosis / Fault Analysis',
        'repair_actions': 'Work Performed',
        'parts_used': 'Parts Used',
        'test_results': 'Test Results',
        'final_notes': 'Final Notes',
        'regards': 'Best regards',
        'page': 'Page',
    },
}


class RMARepairReportDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate. Briefkopf, Fusszeile, Rand und
    Schriftgroessen kommen aus core.pdf_base und entsprechen damit
    der Corporate-Design-Vorlage.
    """
    def __init__(self, filename, company=None, rma_case=None, language='de', **kwargs):
        self.rma_case = rma_case
        self.translations = REPORT_TRANSLATIONS.get(language, REPORT_TRANSLATIONS['de'])
        VerpDocTemplate.__init__(
            self, filename, company=company, language=language,
            **kwargs)



def _fmt_date(d):
    if not d:
        return '-'
    return d.strftime('%d.%m.%Y')


def _get_recipient_address(rma_case):
    """Ermittelt die Empfängeradresse aus den RMA-Adressfeldern"""
    lines = []
    if rma_case.address_name:
        lines.append(rma_case.address_name)
    if rma_case.address_street:
        street = rma_case.address_street
        if rma_case.address_house_number:
            street += f" {rma_case.address_house_number}"
        lines.append(street)
    if rma_case.address_postal_code or rma_case.address_city:
        lines.append(f"{rma_case.address_postal_code} {rma_case.address_city}".strip())
    if rma_case.address_country:
        lines.append(rma_case.address_country)
    return "\n".join([l for l in lines if l])


def generate_rma_repair_report_pdf(rma_case, language='de'):
    """
    Generiert ein professionelles PDF für einen RMA-Reparaturbericht

    Args:
        rma_case: RMACase instance
        language: 'de' (German) or 'en' (English)
    """
    t = REPORT_TRANSLATIONS.get(language, REPORT_TRANSLATIONS['de'])
    buffer = BytesIO()

    company = CompanySettings.get_settings()

    doc = RMARepairReportDocTemplate(
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
    address_lines = [
        l for l in _get_recipient_address(rma_case).split('\n') if l.strip()
    ]

    doc_box_lines = [
        (t['repair_report'], True),
        (rma_case.rma_number, False),
        (f"{t['repair_date']} {_fmt_date(rma_case.repair_date)}", False),
        (f"{t['repaired_by']} {rma_case.repaired_by or '-'}", False),
    ]

    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=_fmt_date(rma_case.repair_date),
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # === TITEL ===
    elements.append(Paragraph(t['repair_report'], style_title))
    if rma_case.title:
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(rma_case.title, style_small))
    elements.append(Spacer(1, 0.5 * cm))

    # === PRODUKTINFO ===
    elements.append(Paragraph(t['product_info'], style_heading))
    elements.append(Spacer(1, 0.2 * cm))
    product_data = [
        [t['product_name'], rma_case.product_name or '-'],
        [t['serial_number'], rma_case.product_serial or '-'],
        [t['purchase_date'], _fmt_date(rma_case.product_purchase_date)],
        [t['warranty_status'], rma_case.get_warranty_status_display() if rma_case.warranty_status else '-'],
    ]
    product_table = Table(product_data, colWidths=[5 * cm, 11 * cm])
    product_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LINEBELOW', (0, 0), (-1, -2), 0.375, colors.black),
        ('LINEABOVE', (0, 0), (-1, 0), 0.375, colors.black),
        ('LINEBELOW', (0, -1), (-1, -1), 0.375, colors.black),
        ('LINEBEFORE', (0, 0), (0, -1), 0.375, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 0.375, colors.black),
    ]))
    elements.append(product_table)
    elements.append(Spacer(1, 0.4 * cm))

    # === FEHLERBESCHREIBUNG ===
    if rma_case.fault_description:
        elements.append(Paragraph(t['fault_description'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.fault_description).replace('\n', '<br/>'), style_normal))

    # === DIAGNOSE ===
    if rma_case.diagnosis:
        elements.append(Paragraph(t['diagnosis'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.diagnosis).replace('\n', '<br/>'), style_normal))

    # === DURCHGEFÜHRTE MASSNAHMEN ===
    if rma_case.repair_actions:
        elements.append(Paragraph(t['repair_actions'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.repair_actions).replace('\n', '<br/>'), style_normal))

    # === VERWENDETE ERSATZTEILE ===
    if rma_case.parts_used:
        elements.append(Paragraph(t['parts_used'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.parts_used).replace('\n', '<br/>'), style_normal))

    # === TESTERGEBNISSE ===
    if rma_case.test_results:
        elements.append(Paragraph(t['test_results'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.test_results).replace('\n', '<br/>'), style_normal))

    # === ABSCHLUSSNOTIZEN ===
    if rma_case.final_notes:
        elements.append(Paragraph(t['final_notes'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.final_notes).replace('\n', '<br/>'), style_normal))

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))

    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))

    doc.build(elements)

    return buffer.getvalue()
