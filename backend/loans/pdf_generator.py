"""
PDF Generator für Rücklieferscheine (Leihungen)
Professionelles DIN A4 Layout
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, 
    Image, PageBreak, KeepTogether, Frame, PageTemplate, BaseDocTemplate
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.utils import ImageReader
from company.models import CompanySettings
from core.pdf_base import (
    VerpDocTemplate,
    build_address_and_doc_row,
    build_document_box,
    build_positions_table,
    get_company_styles,
)
import os


class ReturnNoteDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate für Rücklieferscheine.

    Briefkopf, Fusszeile, Rand und Schriftgroessen kommen aus
    core.pdf_base und entsprechen damit der Corporate-Design-Vorlage.
    """
    def __init__(self, filename, company=None, loan_return=None, **kwargs):
        self.loan_return = loan_return

        return_number = getattr(loan_return, 'return_number', None) or '---'
        kwargs.setdefault('title', 'Rücklieferschein')
        VerpDocTemplate.__init__(
            self, filename, company=company,
            continuation_text=f'Rücklieferschein {return_number}',
            **kwargs)


def generate_return_note_pdf(loan_return):
    """
    Generiert ein professionelles PDF für einen Rücklieferschein
    """
    buffer = BytesIO()
    
    company = CompanySettings.get_settings()
    loan = loan_return.loan
    
    doc = ReturnNoteDocTemplate(
        buffer, 
        pagesize=A4,
        company=company,
        loan_return=loan_return
    )
    
    elements = []
    vs = get_company_styles()
    style_normal = vs['VerpBody']
    style_small = vs['VerpSmall']
    style_heading = vs['VerpHeading']
    style_title = vs['VerpTitle']
    
    # === EMPFÄNGER (Rücksendeadresse) und Dokumentbox wie in der Vorlage ===
    address_lines = [
        l for l in loan.get_return_address_display().split('\n') if l.strip()
    ]
    
    doc_box_lines = [
        ('Rücklieferschein', True),
        (loan_return.return_number, False),
        (f'Leihung {loan.loan_number}', False),
    ]
    if loan.supplier_reference:
        doc_box_lines.append((f'Ihre Referenz {loan.supplier_reference}', False))
    if getattr(loan_return, 'rma_number', None):
        doc_box_lines.append((f'RMA-Nr. {loan_return.rma_number}', False))
    
    # Datum mit dem Kürzel des Dokumenterstellers, wie in Q-373Du
    # ("17.08.2026 / DuBB").
    date_text = loan_return.return_date.strftime('%d.%m.%Y')
    creator = (getattr(getattr(loan_return, 'created_by', None), 'username', '') or '')
    if creator:
        date_text += f' / {creator}'
    
    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=date_text,
    ))
    elements.append(Spacer(1, 0.4*cm))
    
    # === TITEL ===
    elements.append(Paragraph('Rücklieferschein', style_title))
    elements.append(Spacer(1, 0.2*cm))
    elements.append(Paragraph(
        f"Leihung {loan.loan_number} - {loan.supplier.company_name}", style_small))
    elements.append(Spacer(1, 0.5*cm))
    
    # === EINLEITUNG ===
    elements.append(Paragraph(
        "Hiermit senden wir folgende Leihwaren zurück:",
        style_normal
    ))
    elements.append(Spacer(1, 0.5*cm))
    
    # === POSITIONS-TABELLE ===
    headers = ['Pos.', 'Art.-Nr.', 'Beschreibung', 'Menge', 'Einh.', 'Zustand']
    
    rows = []
    for idx, item in enumerate(loan_return.items.all().select_related('loan_item'), 1):
        loan_item = item.loan_item
        desc = loan_item.product_name
        if loan_item.serial_number:
            desc += f"<br/>S/N: {loan_item.serial_number}"
        
        condition = item.condition_notes or 'OK'
        if len(condition) > 50:
            condition = condition[:47] + '...'
        
        rows.append([
            str(idx),
            Paragraph(loan_item.supplier_article_number or '—', style_small),
            Paragraph(desc, style_small),
            f"{item.quantity_returned:g}",
            loan_item.unit,
            Paragraph(condition, style_small),
        ])
    
    col_widths = [1.0*cm, 2.2*cm, 5.4*cm, 1.5*cm, 1.4*cm, 4.5*cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[]))
    elements.append(Spacer(1, 1*cm))
    
    # === VERSANDINFOS ===
    if loan_return.shipping_carrier or loan_return.tracking_number:
        elements.append(Paragraph("Versandinformationen", style_heading))
        elements.append(Spacer(1, 0.2*cm))
        if loan_return.shipping_carrier:
            elements.append(Paragraph(
                f"Versanddienstleister: {loan_return.shipping_carrier}", style_small))
        if loan_return.tracking_number:
            elements.append(Paragraph(
                f"Sendungsnummer: {loan_return.tracking_number}", style_small))
        elements.append(Spacer(1, 0.5*cm))
    
    # === NOTIZEN ===
    if loan_return.notes:
        elements.append(Paragraph("Bemerkungen", style_heading))
        elements.append(Spacer(1, 0.2*cm))
        elements.append(Paragraph(
            loan_return.notes.replace('\n', '<br/>'), style_small))
        elements.append(Spacer(1, 0.5*cm))
    
    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(
        "Wir bitten um Bestätigung des Wareneingangs.",
        style_normal
    ))
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph("Mit freundlichen Grüßen", style_normal))
    elements.append(Spacer(1, 1*cm))
    
    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))
    
    # PDF erstellen
    doc.build(elements)
    
    return buffer.getvalue()
