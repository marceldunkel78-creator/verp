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
from core.pdf_base import (
    FONT_BOLD,
    VerpDocTemplate,
    build_address_and_doc_row,
    build_document_box,
    get_company_styles,
)
from django.conf import settings
import os
from decimal import Decimal


class MaintenanceInvoiceDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate.

    Briefkopf, Fusszeile, Rand und Schriftgroessen kommen aus
    core.pdf_base und entsprechen damit der Corporate-Design-Vorlage.
    """
    def __init__(self, filename, company=None, license=None, **kwargs):
        self.license = license
        license_number = getattr(license, 'license_number', None) or '---'
        kwargs.setdefault('title', 'Maintenance-Abrechnung')
        VerpDocTemplate.__init__(
            self, filename, company=company,
            continuation_text=f'Maintenance-Abrechnung {license_number}',
            **kwargs)


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
        company=company,
        license=license
    )
    
    # Elements for PDF
    elements = []
    styles = getSampleStyleSheet()
    vs = get_company_styles()
    
    # Custom styles
    title_style = vs['VerpTitle']
    heading_style = vs['VerpHeading']
    normal_style = vs['VerpBody']
    
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
    
    # === DOKUMENTBOX (rechts) wie in der Vorlage ===
    doc_box_lines = [
        ('Maintenance-Abrechnung', True),
        (license.license_number, False),
    ]
    if license.serial_number:
        doc_box_lines.append((f"Seriennummer {license.serial_number}", False))
    if start_date and end_date:
        doc_box_lines.append((
            f"Zeitraum {start_date.strftime('%d.%m.%Y')} - "
            f"{end_date.strftime('%d.%m.%Y')}", False))
    
    elements.append(build_address_and_doc_row(
        customer_address, build_document_box(doc_box_lines), company,
        date_text=end_date.strftime('%d.%m.%Y') if end_date else '',
    ))
    elements.append(Spacer(1, 0.4*cm))
    
    # === Title ===
    elements.append(Paragraph('Maintenance-Abrechnung', title_style))
    elements.append(Spacer(1, 0.2*cm))
    elements.append(Paragraph(f"Lizenz {license.license_number}", vs['VerpSmall']))
    elements.append(Spacer(1, 0.5*cm))
    
    # === License details ===
    license_data = [
        ['Lizenznummer:', license.license_number],
        ['Seriennummer:', license.serial_number or '-'],
    ]
    if start_date and end_date:
        license_data.append(['Zeitraum:', f"{start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')}"])
    
    license_table = Table(license_data, colWidths=[4.5*cm, 11.5*cm])
    license_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -2), 0.375, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
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
