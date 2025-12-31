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
from django.conf import settings
import os


class ReturnNoteDocTemplate(BaseDocTemplate):
    """
    Custom DocTemplate für Rücklieferscheine mit Header und Footer
    """
    def __init__(self, filename, company=None, loan_return=None, **kwargs):
        self.company = company
        self.loan_return = loan_return
        BaseDocTemplate.__init__(self, filename, **kwargs)
        
        frame = Frame(
            self.leftMargin, 
            self.bottomMargin, 
            self.width, 
            self.height,
            id='normal'
        )
        
        template = PageTemplate(
            id='return_note',
            frames=frame,
            onPage=self._add_header_footer
        )
        self.addPageTemplates([template])
    
    def _add_header_footer(self, canvas, doc):
        """Fügt Header und Footer zu jeder Seite hinzu"""
        canvas.saveState()
        
        width, height = A4
        company = self.company
        loan_return = self.loan_return
        
        # === HEADER ===
        if company and company.document_header:
            try:
                logo_path = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
                if os.path.exists(logo_path):
                    try:
                        img = ImageReader(logo_path)
                        canvas.drawImage(img, 2*cm, height - 2.5*cm, width=17*cm, height=2*cm, 
                                        preserveAspectRatio=True, anchor='nw', mask='auto')
                    except Exception:
                        canvas.drawImage(logo_path, 2*cm, height - 2.5*cm, width=17*cm, height=2*cm, 
                                        preserveAspectRatio=True, anchor='nw')
            except Exception as e:
                print(f"Error loading header logo: {e}")
        
        # Seitenzahl (ab Seite 2)
        page_num = canvas.getPageNumber()
        if page_num > 1:
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.grey)
            header_text = f"Seite {page_num} - Rücklieferschein {loan_return.return_number}"
            canvas.drawString(2*cm, height - 3.2*cm, header_text)
            canvas.setStrokeColor(colors.grey)
            canvas.line(2*cm, height - 3.4*cm, width - 2*cm, height - 3.4*cm)
        
        # === FOOTER ===
        footer_y = 1.2*cm
        
        canvas.setStrokeColor(colors.grey)
        canvas.line(2*cm, footer_y + 1.8*cm, width - 2*cm, footer_y + 1.8*cm)
        
        canvas.setFont('Helvetica', 6.5)
        canvas.setFillColor(colors.HexColor('#333333'))
        
        if company:
            col1_x = 2*cm
            canvas.drawString(col1_x, footer_y + 1.4*cm, company.company_name or '')
            canvas.drawString(col1_x, footer_y + 0.9*cm, f"{company.street or ''} {company.house_number or ''}")
            canvas.drawString(col1_x, footer_y + 0.4*cm, f"D-{company.postal_code or ''} {company.city or ''}")
            
            col2_x = 6.5*cm
            canvas.drawString(col2_x, footer_y + 1.4*cm, f"Tel. {company.phone or ''}")
            canvas.drawString(col2_x, footer_y + 0.9*cm, company.email or '')
            canvas.drawString(col2_x, footer_y + 0.4*cm, (company.website or '').replace('https://', '').replace('http://', ''))
            
            col3_x = 10.5*cm
            canvas.drawString(col3_x, footer_y + 1.4*cm, f"{company.register_court or ''}, {company.commercial_register or ''}")
            canvas.drawString(col3_x, footer_y + 0.9*cm, "Geschäftsführer:")
            canvas.drawString(col3_x, footer_y + 0.4*cm, company.managing_director or '')
            
            col4_x = 15*cm
            canvas.drawString(col4_x, footer_y + 1.4*cm, company.bank_name or '')
            canvas.drawString(col4_x, footer_y + 0.9*cm, f"BIC: {company.bic or ''}")
            canvas.drawString(col4_x, footer_y + 0.4*cm, f"IBAN: {company.iban or ''}")
        
        canvas.restoreState()


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
        topMargin=3.5*cm,
        bottomMargin=3.5*cm,
        leftMargin=2*cm, 
        rightMargin=2*cm,
        company=company,
        loan_return=loan_return
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Styles
    style_title = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#0066cc'),
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
    elements.append(Spacer(1, 0.5*cm))
    if company:
        sender_line = f"{company.company_name} • {company.street} {company.house_number} • {company.postal_code} {company.city}"
        elements.append(Paragraph(sender_line, style_small))
        elements.append(Spacer(1, 0.3*cm))
    
    # === EMPFÄNGER (Rücksendeadresse) ===
    return_address = loan.get_return_address_display().replace('\n', '<br/>')
    elements.append(Paragraph(f"<b>{return_address}</b>", style_normal))
    elements.append(Spacer(1, 1*cm))
    
    # === DOKUMENT-METADATEN ===
    meta_text = f"""<para align=right>
    <b>Rücklieferschein-Nr.:</b> {loan_return.return_number}<br/>
    <b>Leihnummer:</b> {loan.loan_number}<br/>
    <b>Rücksendedatum:</b> {loan_return.return_date.strftime('%d.%m.%Y')}<br/>
    """
    if loan.supplier_reference:
        meta_text += f"<b>Ihre Referenz:</b> {loan.supplier_reference}<br/>"
    meta_text += "</para>"
    elements.append(Paragraph(meta_text, style_normal))
    elements.append(Spacer(1, 0.8*cm))
    
    # === TITEL ===
    elements.append(Paragraph(f"<b>Rücklieferschein {loan_return.return_number}</b>", style_title))
    elements.append(Paragraph(f"Leihung {loan.loan_number} - {loan.supplier.company_name}", style_subtitle))
    
    # === EINLEITUNG ===
    elements.append(Paragraph(
        "Hiermit senden wir folgende Leihwaren zurück:",
        style_normal
    ))
    elements.append(Spacer(1, 0.5*cm))
    
    # === POSITIONS-TABELLE ===
    table_data = [['Pos.', 'Art.-Nr.', 'Beschreibung', 'Menge', 'Einh.', 'Zustand']]
    
    for idx, item in enumerate(loan_return.items.all().select_related('loan_item'), 1):
        loan_item = item.loan_item
        desc = loan_item.product_name
        if loan_item.serial_number:
            desc += f"\nS/N: {loan_item.serial_number}"
        
        condition = item.condition_notes or 'OK'
        if len(condition) > 50:
            condition = condition[:47] + '...'
        
        table_data.append([
            str(idx),
            loan_item.supplier_article_number or '—',
            Paragraph(desc, style_small),
            f"{item.quantity_returned:g}",
            loan_item.unit,
            condition
        ])
    
    table = Table(table_data, colWidths=[1.2*cm, 2.5*cm, 6*cm, 1.5*cm, 1.5*cm, 4*cm])
    table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0066cc')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        
        # Datenzeilen
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
        ('VALIGN', (0, 1), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        
        # Zebra-Streifen
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#0066cc')),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 1*cm))
    
    # === VERSANDINFOS ===
    if loan_return.shipping_carrier or loan_return.tracking_number:
        elements.append(Paragraph("<b>Versandinformationen:</b>", style_normal))
        if loan_return.shipping_carrier:
            elements.append(Paragraph(f"Versanddienstleister: {loan_return.shipping_carrier}", style_small))
        if loan_return.tracking_number:
            elements.append(Paragraph(f"Sendungsnummer: {loan_return.tracking_number}", style_small))
        elements.append(Spacer(1, 0.5*cm))
    
    # === NOTIZEN ===
    if loan_return.notes:
        elements.append(Paragraph("<b>Bemerkungen:</b>", style_normal))
        elements.append(Paragraph(loan_return.notes.replace('\n', '<br/>'), style_small))
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
