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
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    Frame, PageTemplate, BaseDocTemplate
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.utils import ImageReader
from company.models import CompanySettings
from django.conf import settings
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


class RMARepairReportDocTemplate(BaseDocTemplate):
    """
    Custom DocTemplate für RMA-Reparaturberichte mit Header und Footer
    """
    def __init__(self, filename, company=None, rma_case=None, language='de', **kwargs):
        self.company = company
        self.rma_case = rma_case
        BaseDocTemplate.__init__(self, filename, **kwargs)
        # Eigener Attributname (nicht 'lang'), da reportlab 'lang' intern für PDF-Sprache nutzt
        self.translations = REPORT_TRANSLATIONS.get(language, REPORT_TRANSLATIONS['de'])

        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id='normal'
        )

        template = PageTemplate(
            id='rma_repair_report',
            frames=frame,
            onPage=self._add_header_footer
        )
        self.addPageTemplates([template])

    def _add_header_footer(self, canvas, doc):
        """Fügt Header und Footer zu jeder Seite hinzu"""
        canvas.saveState()

        width, height = A4
        company = self.company
        rma_case = self.rma_case
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
            header_text = f"{lang['page']} {page_num} - {lang['repair_report']} {rma_case.rma_number}"
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


def _fmt_date(d):
    if not d:
        return '-'
    return d.strftime('%d.%m.%Y')


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

    # === ABSENDER (einzeilig) ===
    elements.append(Spacer(1, 0.5 * cm))
    if company:
        sender_line = f"{company.company_name} • {company.street} {company.house_number} • {company.postal_code} {company.city}"
        elements.append(Paragraph(sender_line, style_small))
        elements.append(Spacer(1, 0.3 * cm))

    # === EMPFÄNGER ===
    recipient_address = _get_recipient_address(rma_case).replace('\n', '<br/>')
    elements.append(Paragraph(f"<b>{recipient_address}</b>", style_normal))
    elements.append(Spacer(1, 1 * cm))

    # === DOKUMENT-METADATEN ===
    meta_text = f"""<para align=right>
    <b>{t['rma_number']}:</b> {rma_case.rma_number}<br/>
    <b>{t['repair_date']}:</b> {_fmt_date(rma_case.repair_date)}<br/>
    <b>{t['repaired_by']}:</b> {rma_case.repaired_by or '-'}<br/>
    """
    meta_text += "</para>"
    elements.append(Paragraph(meta_text, style_normal))
    elements.append(Spacer(1, 0.8 * cm))

    # === TITEL ===
    elements.append(Paragraph(f"<b>{t['repair_report']} {rma_case.rma_number}</b>", style_title))
    elements.append(Paragraph(rma_case.title or '', style_subtitle))

    # === PRODUKTINFO ===
    elements.append(Paragraph(f"<b>{t['product_info']}</b>", style_heading))
    product_data = [
        [t['product_name'], rma_case.product_name or '-'],
        [t['serial_number'], rma_case.product_serial or '-'],
        [t['purchase_date'], _fmt_date(rma_case.product_purchase_date)],
        [t['warranty_status'], rma_case.get_warranty_status_display() if rma_case.warranty_status else '-'],
    ]
    product_table = Table(product_data, colWidths=[5 * cm, 11 * cm])
    product_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
    ]))
    elements.append(product_table)

    # === FEHLERBESCHREIBUNG ===
    if rma_case.fault_description:
        elements.append(Paragraph(f"<b>{t['fault_description']}</b>", style_heading))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.fault_description).replace('\n', '<br/>'), style_normal))

    # === DIAGNOSE ===
    if rma_case.diagnosis:
        elements.append(Paragraph(f"<b>{t['diagnosis']}</b>", style_heading))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.diagnosis).replace('\n', '<br/>'), style_normal))

    # === DURCHGEFÜHRTE MASSNAHMEN ===
    if rma_case.repair_actions:
        elements.append(Paragraph(f"<b>{t['repair_actions']}</b>", style_heading))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.repair_actions).replace('\n', '<br/>'), style_normal))

    # === VERWENDETE ERSATZTEILE ===
    if rma_case.parts_used:
        elements.append(Paragraph(f"<b>{t['parts_used']}</b>", style_heading))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.parts_used).replace('\n', '<br/>'), style_normal))

    # === TESTERGEBNISSE ===
    if rma_case.test_results:
        elements.append(Paragraph(f"<b>{t['test_results']}</b>", style_heading))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.test_results).replace('\n', '<br/>'), style_normal))

    # === ABSCHLUSSNOTIZEN ===
    if rma_case.final_notes:
        elements.append(Paragraph(f"<b>{t['final_notes']}</b>", style_heading))
        elements.append(Paragraph(sanitize_for_pdf(rma_case.final_notes).replace('\n', '<br/>'), style_normal))

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))

    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))

    doc.build(elements)

    return buffer.getvalue()
