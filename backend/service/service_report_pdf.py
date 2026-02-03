"""
PDF Generator für Serviceberichte

Professionelles DIN A4 Layout mit:
- Visitron Logo im Header
- Kundenadresse
- Betreff: Servicebericht zu Auftrag [Auftragsnummer]
- Notizen/Beschreibung
- Messtabellen
- Fotos
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, 
    Image, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.utils import ImageReader
from company.models import CompanySettings
from django.conf import settings
import os


def generate_service_report_pdf(report):
    """
    Generates a PDF for a service report.
    
    Args:
        report: TravelReport instance (with report_type='service')
        
    Returns:
        BytesIO object containing the PDF
    """
    buffer = BytesIO()
    
    # Get company info
    company = CompanySettings.objects.first()
    
    # Setup document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    # Setup styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=12,
        alignment=TA_LEFT
    )
    
    heading_style = ParagraphStyle(
        'Heading',
        parent=styles['Heading2'],
        fontSize=12,
        spaceBefore=12,
        spaceAfter=6
    )
    
    normal_style = ParagraphStyle(
        'Normal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )
    
    small_style = ParagraphStyle(
        'Small',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.gray
    )
    
    address_style = ParagraphStyle(
        'Address',
        parent=styles['Normal'],
        fontSize=10,
        leading=14
    )
    
    # Build document elements
    elements = []
    
    # === HEADER / LOGO ===
    if company and company.document_header:
        try:
            logo_path = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
            if os.path.exists(logo_path):
                logo = Image(logo_path, width=6*cm, height=2*cm)
                logo.hAlign = 'RIGHT'
                elements.append(logo)
                elements.append(Spacer(1, 0.5*cm))
        except Exception as e:
            print(f"Error loading logo: {e}")
    
    # === COMPANY SENDER LINE ===
    if company:
        sender_line = f"{company.company_name} · {company.street} {company.house_number} · {company.postal_code} {company.city}"
        elements.append(Paragraph(sender_line, small_style))
        elements.append(Spacer(1, 0.3*cm))
    
    # === CUSTOMER ADDRESS ===
    customer = report.customer
    if customer:
        address_lines = []
        
        # Get primary address
        if hasattr(customer, 'addresses'):
            address = customer.addresses.filter(is_active=True).first()
            if address:
                if address.university:
                    address_lines.append(address.university)
                if address.institute:
                    address_lines.append(address.institute)
                if address.department:
                    address_lines.append(address.department)
                
                # Contact name
                contact_parts = []
                if customer.salutation:
                    contact_parts.append(customer.salutation)
                if customer.title:
                    contact_parts.append(customer.title)
                if customer.first_name:
                    contact_parts.append(customer.first_name)
                if customer.last_name:
                    contact_parts.append(customer.last_name)
                if contact_parts:
                    address_lines.append(' '.join(contact_parts))
                
                # Street
                street_line = f"{address.street or ''} {address.house_number or ''}".strip()
                if street_line:
                    address_lines.append(street_line)
                if address.address_supplement:
                    address_lines.append(address.address_supplement)
                
                # City
                city_line = f"{address.postal_code or ''} {address.city or ''}".strip()
                if city_line:
                    address_lines.append(city_line)
                
                # Country (if not Germany)
                if address.country and address.country not in ('DE', 'Deutschland', 'Germany'):
                    address_lines.append(address.country)
        
        if not address_lines:
            # Fallback to company name
            if customer.company_name:
                address_lines.append(customer.company_name)
            elif customer.last_name:
                name = f"{customer.first_name or ''} {customer.last_name}".strip()
                address_lines.append(name)
        
        for line in address_lines:
            elements.append(Paragraph(line, address_style))
        
        elements.append(Spacer(1, 1*cm))
    
    # === DATE AND LOCATION (right aligned) ===
    date_text = report.date.strftime('%d.%m.%Y') if report.date else ''
    location_text = f"{report.location}, {date_text}" if report.location else date_text
    
    date_style = ParagraphStyle(
        'DateRight',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_RIGHT
    )
    elements.append(Paragraph(location_text, date_style))
    elements.append(Spacer(1, 0.5*cm))
    
    # === SUBJECT LINE ===
    order_number = ''
    if report.linked_order:
        order_number = report.linked_order.order_number
    
    subject = f"Servicebericht zu Auftrag {order_number}" if order_number else "Servicebericht"
    elements.append(Paragraph(f"<b>Betreff: {subject}</b>", title_style))
    elements.append(Spacer(1, 0.5*cm))
    
    # === SYSTEM INFO ===
    if report.linked_system:
        system_info = f"System: {report.linked_system.system_name}"
        elements.append(Paragraph(system_info, normal_style))
        elements.append(Spacer(1, 0.3*cm))
    
    # === NOTES / DESCRIPTION ===
    if report.notes:
        elements.append(Paragraph("<b>Beschreibung / Durchgeführte Arbeiten:</b>", heading_style))
        # Replace newlines with <br/> for proper rendering
        notes_text = report.notes.replace('\n', '<br/>')
        elements.append(Paragraph(notes_text, normal_style))
        elements.append(Spacer(1, 0.5*cm))
    
    # === MEASUREMENT TABLES ===
    measurements = report.measurements.all()
    if measurements.exists():
        elements.append(Paragraph("<b>Messwerte:</b>", heading_style))
        
        for measurement in measurements:
            if measurement.title:
                elements.append(Paragraph(f"<i>{measurement.title}</i>", normal_style))
            
            if measurement.data and isinstance(measurement.data, dict):
                headers = measurement.data.get('headers', [])
                rows = measurement.data.get('rows', [])
                
                if headers and rows:
                    # Build table data
                    table_data = [headers]
                    for row in rows:
                        table_data.append(row)
                    
                    # Create table
                    col_widths = [doc.width / len(headers)] * len(headers)
                    table = Table(table_data, colWidths=col_widths)
                    
                    table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E5E7EB')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#374151')),
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 9),
                        ('FONTSIZE', (0, 1), (-1, -1), 8),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                        ('TOPPADDING', (0, 0), (-1, 0), 8),
                        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
                        ('TOPPADDING', (0, 1), (-1, -1), 4),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
                    ]))
                    
                    elements.append(table)
                    elements.append(Spacer(1, 0.5*cm))
    
    # === PHOTOS ===
    photos = report.photos.all()
    if photos.exists():
        elements.append(PageBreak())
        elements.append(Paragraph("<b>Fotos:</b>", heading_style))
        elements.append(Spacer(1, 0.3*cm))
        
        # Create a 2-column layout for photos
        photo_pairs = []
        current_pair = []
        
        for photo in photos:
            try:
                photo_path = os.path.join(settings.MEDIA_ROOT, photo.photo.name)
                if os.path.exists(photo_path):
                    img = Image(photo_path, width=7*cm, height=5*cm)
                    
                    # Create a cell with image and optional caption
                    cell_content = [img]
                    if photo.caption:
                        cell_content.append(Spacer(1, 0.2*cm))
                        cell_content.append(Paragraph(photo.caption, small_style))
                    
                    current_pair.append(cell_content)
                    
                    if len(current_pair) == 2:
                        photo_pairs.append(current_pair)
                        current_pair = []
            except Exception as e:
                print(f"Error loading photo: {e}")
        
        # Add remaining photos
        if current_pair:
            while len(current_pair) < 2:
                current_pair.append([''])
            photo_pairs.append(current_pair)
        
        # Create table for photos
        for pair in photo_pairs:
            photo_table = Table([pair], colWidths=[8*cm, 8*cm])
            photo_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(photo_table)
    
    # === FOOTER / SIGNATURE LINE ===
    elements.append(Spacer(1, 1*cm))
    
    # Add company contact info
    if company:
        footer_text = f"{company.company_name}"
        if company.phone:
            footer_text += f" · Tel: {company.phone}"
        if company.email:
            footer_text += f" · {company.email}"
        elements.append(Paragraph(footer_text, small_style))
    
    # Build PDF
    doc.build(elements)
    
    buffer.seek(0)
    return buffer
