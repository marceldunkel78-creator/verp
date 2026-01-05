"""
Maintenance Invoice PDF Generator
Generates professional invoices for VisiView License maintenance time credits and expenditures.

NEUE LOGIK - Zwischenabrechnungen:
1. Pro Zeitgutschrift gibt es eine Zwischenabrechnung (sortiert nach start_date)
2. Haben-Seite: Die jeweilige Zeitgutschrift + Übertrag (wenn negativ)
3. Soll-Seite: Alle Zeitaufwendungen mit Datum <= Ende-Datum dieser Gutschrift
4. Saldo: Negativ → Übertrag zur nächsten Abrechnung; Positiv → verfällt (Übertrag = 0)
5. Letzte Abrechnung = Endabrechnung mit aktuellem Zeitguthaben
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
from decimal import Decimal


class MaintenanceInvoiceDocTemplate(BaseDocTemplate):
    """
    Custom DocTemplate with header and footer on each page
    """
    def __init__(self, filename, company=None, license=None, **kwargs):
        self.company = company
        self.license = license
        BaseDocTemplate.__init__(self, filename, **kwargs)
        
        # Frame for main content
        frame = Frame(
            self.leftMargin, 
            self.bottomMargin, 
            self.width, 
            self.height,
            id='normal'
        )
        
        # PageTemplate with callbacks
        template = PageTemplate(
            id='invoice',
            frames=frame,
            onPage=self._add_header_footer
        )
        self.addPageTemplates([template])
    
    def _add_header_footer(self, canvas, doc):
        """Add header and footer to each page"""
        canvas.saveState()
        
        width, height = A4
        company = self.company
        license_obj = self.license
        
        # === HEADER ===
        page_num = canvas.getPageNumber()
        
        # Logo (only on page 1, top right)
        if page_num == 1 and company and company.document_header:
            try:
                logo_path = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
                if os.path.exists(logo_path):
                    logo_x = width - 7*cm
                    logo_y = height - 2.5*cm
                    try:
                        img = ImageReader(logo_path)
                        canvas.drawImage(img, logo_x, logo_y, width=5*cm, height=1.5*cm, 
                                       preserveAspectRatio=True, anchor='nw', mask='auto')
                    except Exception:
                        canvas.drawImage(logo_path, logo_x, logo_y, width=5*cm, height=1.5*cm, 
                                       preserveAspectRatio=True, anchor='nw')
            except Exception as e:
                print(f"Error loading header logo: {e}")
        
        # Page number and invoice number (from page 2 onwards)
        if page_num > 1:
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.grey)
            header_text = f"Seite {page_num}, Maintenance-Abrechnung {license_obj.license_number}"
            canvas.drawString(2*cm, height - 3.2*cm, header_text)
            # Underline
            canvas.setStrokeColor(colors.grey)
            canvas.line(2*cm, height - 3.4*cm, width - 2*cm, height - 3.4*cm)
        
        # === FOOTER ===
        footer_y = 1.2*cm
        
        # Separator line above footer
        canvas.setStrokeColor(colors.grey)
        canvas.line(2*cm, footer_y + 1.8*cm, width - 2*cm, footer_y + 1.8*cm)
        
        canvas.setFont('Helvetica', 6.5)
        canvas.setFillColor(colors.HexColor('#333333'))
        
        if company:
            # Block 1: Company address
            col1_x = 2*cm
            canvas.drawString(col1_x, footer_y + 1.4*cm, company.company_name or 'Visitron Systems GmbH')
            canvas.drawString(col1_x, footer_y + 0.9*cm, f"{company.street or ''} {company.house_number or ''}")
            canvas.drawString(col1_x, footer_y + 0.4*cm, f"D-{company.postal_code or ''} {company.city or ''}")
            
            # Block 2: Contact
            col2_x = 6.5*cm
            canvas.drawString(col2_x, footer_y + 1.4*cm, f"Tel. {company.phone or ''}")
            canvas.drawString(col2_x, footer_y + 0.9*cm, company.email or '')
            canvas.drawString(col2_x, footer_y + 0.4*cm, (company.website or '').replace('https://', '').replace('http://', ''))
            
            # Block 3: Register
            col3_x = 10.5*cm
            canvas.drawString(col3_x, footer_y + 1.4*cm, f"{company.register_court or 'Amtsgericht München'}, {company.commercial_register or ''}")
            canvas.drawString(col3_x, footer_y + 0.9*cm, "Geschäftsführer:")
            canvas.drawString(col3_x, footer_y + 0.4*cm, company.managing_director or '')
            
            # Block 4: Bank
            col4_x = 15*cm
            canvas.drawString(col4_x, footer_y + 1.4*cm, company.bank_name or '')
            canvas.drawString(col4_x, footer_y + 0.9*cm, f"BIC: {company.bic or ''}")
            canvas.drawString(col4_x, footer_y + 0.4*cm, f"IBAN: {company.iban or ''}")
        
        canvas.restoreState()


def generate_maintenance_invoice_pdf(license, start_date=None, end_date=None):
    """
    Generate a professional PDF for maintenance invoice
    
    Args:
        license: VisiViewLicense instance
        start_date: Optional start date filter (date object)
        end_date: Optional end date filter (date object)
    
    Returns:
        BytesIO buffer with PDF content
    """
    buffer = BytesIO()
    
    # Load company data
    company = CompanySettings.get_settings()
    
    # Create document with custom page callbacks
    doc = MaintenanceInvoiceDocTemplate(
        buffer, 
        pagesize=A4,
        topMargin=3.5*cm,
        bottomMargin=3.5*cm,
        leftMargin=2*cm, 
        rightMargin=2*cm,
        company=company,
        license=license
    )
    
    # Elements for PDF
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=12,
        alignment=TA_LEFT
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#333333'),
        spaceAfter=8,
        spaceBefore=12
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        leading=14
    )
    
    # === Company address (single line) ===
    if company:
        company_line = f"{company.company_name or 'Visitron Systems GmbH'} • {company.street or ''} {company.house_number or ''} • D-{company.postal_code or ''} {company.city or ''}"
        company_para = Paragraph(company_line, ParagraphStyle(
            'CompanyLine',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey
        ))
        elements.append(company_para)
        elements.append(Spacer(1, 0.3*cm))
    
    # === Customer address ===
    customer_address = []
    if license.customer:
        # Prefer company_name if present, otherwise use person's full name
        company_name = getattr(license.customer, 'company_name', None)
        if company_name:
            customer_address.append(company_name)
        else:
            full_name_parts = []
            if getattr(license.customer, 'title', None):
                full_name_parts.append(license.customer.title)
            if getattr(license.customer, 'first_name', None):
                full_name_parts.append(license.customer.first_name)
            if getattr(license.customer, 'last_name', None):
                full_name_parts.append(license.customer.last_name)
            if full_name_parts:
                customer_address.append(' '.join(full_name_parts))

        # Try to find a billing address on the customer (preferred), otherwise use first available address
        addr = None
        if hasattr(license.customer, 'addresses'):
            try:
                addr = license.customer.addresses.filter(address_type='Rechnung').order_by('-is_active').first()
                if not addr:
                    addr = license.customer.addresses.order_by('-is_active').first()
            except Exception:
                addr = None

        if addr:
            street = getattr(addr, 'street', None)
            house = getattr(addr, 'house_number', None)
            if street:
                customer_address.append(f"{street} {house or ''}".strip())
            postal = getattr(addr, 'postal_code', None)
            city = getattr(addr, 'city', None)
            if postal or city:
                customer_address.append(f"{postal or ''} {city or ''}".strip())
    elif license.customer_name_legacy:
        customer_address.append(license.customer_name_legacy)
        if license.customer_address_legacy:
            customer_address.append(license.customer_address_legacy)
    
    if customer_address:
        for line in customer_address:
            elements.append(Paragraph(line, normal_style))
        elements.append(Spacer(1, 1*cm))
    
    # === Title ===
    elements.append(Paragraph(f"Maintenance-Abrechnung<br/>Lizenz {license.license_number}", title_style))
    elements.append(Spacer(1, 0.5*cm))
    
    # === License details ===
    license_data = [
        ['Lizenznummer:', license.license_number],
        ['Seriennummer:', license.serial_number or '-'],
    ]
    if start_date and end_date:
        license_data.append(['Zeitraum:', f"{start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')}"])
    
    license_table = Table(license_data, colWidths=[4.5*cm, 12*cm])
    license_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(license_table)
    elements.append(Spacer(1, 0.8*cm))
    
    # === Fetch maintenance data with NEW interim settlement logic ===
    from visiview.models import MaintenanceTimeCredit, MaintenanceTimeExpenditure
    from visiview.serializers import calculate_interim_settlements
    
    # Get interim settlements
    settlements = calculate_interim_settlements(license.id)
    
    # Calculate overall totals
    total_credits = sum(s['credit_amount'] for s in settlements)
    total_expenditures = sum(s['expenditure_total'] for s in settlements)
    final_balance = settlements[-1]['balance'] if settlements else Decimal('0')
    
    # === Overall Summary section ===
    elements.append(Paragraph("Gesamtübersicht", heading_style))
    
    summary_data = [
        ['', 'Stunden'],
        ['Zeitgutschriften (gesamt)', f"{total_credits:.2f} h"],
        ['Zeitaufwendungen (gesamt)', f"{total_expenditures:.2f} h"],
        ['Aktuelles Zeitguthaben', f"{final_balance:+.2f} h"],
    ]
    
    summary_table = Table(summary_data, colWidths=[13*cm, 4*cm])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.grey),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f4f8') if final_balance >= 0 else colors.HexColor('#fef2f2')),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 1*cm))
    
    # === Zwischenabrechnungen (Interim Settlements) ===
    if settlements:
        elements.append(Paragraph("Zwischenabrechnungen", heading_style))
        elements.append(Spacer(1, 0.3*cm))
        
        # Settlement subheading style
        settlement_heading_style = ParagraphStyle(
            'SettlementHeading',
            parent=styles['Heading3'],
            fontSize=11,
            textColor=colors.HexColor('#2563eb'),
            spaceAfter=6,
            spaceBefore=10
        )
        
        small_style = ParagraphStyle(
            'SmallText',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey
        )
        
        for i, settlement in enumerate(settlements, 1):
            credit = settlement['credit']
            is_final = settlement['is_final']
            
            # Settlement header
            if credit:
                title = f"Abrechnung {i}: Gutschrift {credit.start_date.strftime('%d.%m.%Y')} - {credit.end_date.strftime('%d.%m.%Y')}"
            else:
                title = f"Abrechnung {i}: Ohne Gutschrift (Zeitschuld)"
            
            if is_final:
                title += " [ENDABRECHNUNG]"
            
            elements.append(Paragraph(title, settlement_heading_style))
            
            # Settlement summary table (Haben / Soll)
            settlement_summary = [
                ['HABEN', '', 'SOLL', ''],
            ]
            
            # Haben side
            haben_rows = []
            if settlement['carry_over_in'] < 0:
                haben_rows.append(f"Übertrag: {settlement['carry_over_in']:.2f} h")
            if credit:
                haben_rows.append(f"Gutschrift: {settlement['credit_amount']:.2f} h")
            
            # Soll side
            soll_rows = []
            soll_rows.append(f"Aufwendungen: {settlement['expenditure_total']:.2f} h")
            
            haben_text = '<br/>'.join(haben_rows) if haben_rows else '-'
            soll_text = '<br/>'.join(soll_rows)
            
            settlement_summary.append([
                Paragraph(haben_text, normal_style), '',
                Paragraph(soll_text, normal_style), ''
            ])
            
            # Saldo row
            balance = settlement['balance']
            balance_color = colors.HexColor('#059669') if balance >= 0 else colors.HexColor('#dc2626')
            balance_text = f"Saldo: {balance:+.2f} h"
            
            # Übertrag info
            carry_over_out = settlement['carry_over_out']
            if balance > 0 and not is_final:
                carry_info = "(Restguthaben verfällt, Übertrag: 0 h)"
            elif carry_over_out < 0:
                carry_info = f"(Übertrag zur nächsten Abrechnung: {carry_over_out:.2f} h)"
            else:
                carry_info = ""
            
            settlement_summary.append([
                Paragraph(f"<b>{balance_text}</b>", ParagraphStyle('BalanceStyle', parent=normal_style, textColor=balance_color)),
                '', 
                Paragraph(carry_info, small_style) if carry_info else '',
                ''
            ])
            
            settlement_table = Table(settlement_summary, colWidths=[6*cm, 2*cm, 6*cm, 3*cm])
            settlement_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('LINEABOVE', (0, 0), (-1, 0), 1, colors.grey),
                ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(settlement_table)
            
            # Expenditure details for this settlement
            if settlement['expenditures']:
                exp_data = [['Datum', 'Aktivität', 'Tätigkeit', 'Stunden']]
                for exp in settlement['expenditures']:
                    activity = exp.get_activity_display() if hasattr(exp, 'get_activity_display') else exp.activity
                    task_type = exp.get_task_type_display() if hasattr(exp, 'get_task_type_display') else exp.task_type
                    
                    exp_data.append([
                        exp.date.strftime('%d.%m.%Y') if exp.date else '-',
                        activity,
                        task_type,
                        f"{exp.hours_spent:.2f} h"
                    ])
                
                exp_table = Table(exp_data, colWidths=[3*cm, 5*cm, 5*cm, 3*cm])
                exp_table.setStyle(TableStyle([
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
                    ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.grey),
                    ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                ]))
                elements.append(exp_table)
            
            elements.append(Spacer(1, 0.5*cm))
    
    elements.append(Spacer(1, 0.5*cm))
    
    # === Final Balance Highlight ===
    final_box_color = colors.HexColor('#dcfce7') if final_balance >= 0 else colors.HexColor('#fee2e2')
    final_text_color = colors.HexColor('#166534') if final_balance >= 0 else colors.HexColor('#991b1b')
    status = "Guthaben" if final_balance >= 0 else "Zeitschuld"
    
    final_data = [[f"Aktuelles Zeitguthaben: {final_balance:+.2f} h ({status})"]]
    final_table = Table(final_data, colWidths=[17*cm])
    final_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, 0), (-1, -1), final_box_color),
        ('TEXTCOLOR', (0, 0), (-1, -1), final_text_color),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOX', (0, 0), (-1, -1), 1, final_text_color),
    ]))
    elements.append(final_table)
    elements.append(Spacer(1, 1*cm))
    
    # === Closing ===
    if company and company.managing_director:
        closing_text = f"Mit freundlichen Grüßen<br/><br/>{company.managing_director}<br/>Geschäftsführung"
        elements.append(Paragraph(closing_text, normal_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
