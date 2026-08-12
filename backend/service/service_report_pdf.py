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
from .notizen_utils import sanitize_for_pdf, html_to_plain_text, html_to_pdf_blocks
import os


TRANSLATIONS = {
    'de': {
        'subject_prefix': 'Betreff',
        'service_report_order': 'Servicebericht zu Auftrag',
        'service_report': 'Servicebericht',
        'system': 'System',
        'executing_employee': 'Ausführender Mitarbeiter',
        'description_heading': 'Beschreibung / Durchgeführte Arbeiten:',
        'measurements_heading': 'Messwerte:',
        'photos_heading': 'Fotos:',
        'effort_heading': 'Zeitaufwand:',
        'work_effort_hours': 'Arbeitszeitaufwand',
        'travel_effort_hours': 'Zeitaufwand An-/Abfahrt',
        'work_start_time': 'Beginn der Arbeiten',
        'work_end_time': 'Ende der Arbeiten',
        'hours_short': 'Std.',
    },
    'en': {
        'subject_prefix': 'Subject',
        'service_report_order': 'Service Report for Order',
        'service_report': 'Service Report',
        'system': 'System',
        'executing_employee': 'Executing employee',
        'description_heading': 'Description / Work Performed:',
        'measurements_heading': 'Measurements:',
        'photos_heading': 'Photos:',
        'effort_heading': 'Effort:',
        'work_effort_hours': 'Work effort',
        'travel_effort_hours': 'Travel effort (to/from site)',
        'work_start_time': 'Work start',
        'work_end_time': 'Work end',
        'hours_short': 'h',
    },
}


def generate_service_report_pdf(report, language='de'):
    """
    Generates a PDF for a service report.
    
    Args:
        report: TravelReport instance (with report_type='service')
        language: 'de' for German (default) or 'en' for English
        
    Returns:
        BytesIO object containing the PDF
    """
    t = TRANSLATIONS.get(language, TRANSLATIONS['de'])
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

    h1_style = ParagraphStyle(
        'NotesH1',
        parent=styles['Heading1'],
        fontSize=18,
        spaceBefore=10,
        spaceAfter=6,
        textColor=colors.HexColor('#1F2937'),
    )

    h2_style = ParagraphStyle(
        'NotesH2',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=8,
        spaceAfter=4,
        textColor=colors.HexColor('#1F2937'),
    )

    h3_style = ParagraphStyle(
        'NotesH3',
        parent=styles['Heading3'],
        fontSize=12,
        spaceBefore=6,
        spaceAfter=4,
        textColor=colors.HexColor('#374151'),
    )

    list_style = ParagraphStyle(
        'NotesListItem',
        parent=styles['Normal'],
        fontSize=10,
        leftIndent=14,
        bulletIndent=2,
        spaceAfter=3,
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
            # Fallback to customer name
            name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
            if name:
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
    
    subject = f"{t['service_report_order']} {order_number}" if order_number else t['service_report']
    elements.append(Paragraph(f"<b>{t['subject_prefix']}: {subject}</b>", title_style))
    elements.append(Spacer(1, 0.5*cm))
    
    # === SYSTEM INFO ===
    if report.linked_system:
        system_info = f"{t['system']}: {report.linked_system.system_name}"
        elements.append(Paragraph(system_info, normal_style))
        elements.append(Spacer(1, 0.3*cm))

    if report.executing_employee:
        employee_name = f"{report.executing_employee.first_name} {report.executing_employee.last_name}".strip()
        if report.executing_employee.employee_id:
            employee_name = f"{employee_name} ({report.executing_employee.employee_id})"
        elements.append(Paragraph(f"{t['executing_employee']}: {employee_name}", normal_style))
        elements.append(Spacer(1, 0.3*cm))
    
    # === NOTES / DESCRIPTION ===
    # Bevorzugt notes_html (Rich-Text), faellt auf notes (Plain-Text) zurueck.
    # Das HTML wird in einzelne Bloecke (p, h1-3, ul/ol-items) zerlegt, damit
    # jeder Block einen eigenen ReportLab-Paragraph bekommt -> echte Abstaende.
    notes_html = (getattr(report, 'notes_html', '') or '').strip()
    notes_plain = (report.notes or '').strip()

    if notes_html or notes_plain:
        elements.append(Paragraph(f"<b>{t['description_heading']}</b>", heading_style))

        if notes_html:
            blocks = html_to_pdf_blocks(notes_html)
            # Wir muessen wissen, welche Bloecke zu welchem Style gehoeren.
            # Da html_to_pdf_blocks die Original-Tags verloren hat (alles zu
            # Paragraph-Text), nutzen wir erneut einen vereinfachten Pass, um
            # den Stil pro Block zu waehlen.
            styled_blocks = _split_blocks_with_style(notes_html)
            if styled_blocks:
                for block_html, block_tag in styled_blocks:
                    style = normal_style
                    if block_tag == 'h1':
                        style = h1_style
                    elif block_tag == 'h2':
                        style = h2_style
                    elif block_tag == 'h3':
                        style = h3_style
                    elif block_tag in ('li-bullet', 'li-number'):
                        style = list_style
                    elements.append(Paragraph(block_html, style))
            elif blocks:
                # Fallback: alle Bloecke in normal_style
                for block_html in blocks:
                    elements.append(Paragraph(block_html, normal_style))
        elif notes_plain:
            # Legacy Plain-Text: Newlines -> <br/>
            legacy_text = notes_plain.replace('\n', '<br/>')
            elements.append(Paragraph(legacy_text, normal_style))

        elements.append(Spacer(1, 0.5*cm))

    # === EFFORT / TIME DETAILS ===
    has_effort_data = any([
        report.work_effort_hours is not None,
        report.travel_effort_hours is not None,
        report.work_start_time is not None,
        report.work_end_time is not None,
    ])
    if has_effort_data:
        elements.append(Paragraph(f"<b>{t['effort_heading']}</b>", heading_style))
        effort_lines = []

        if report.work_effort_hours is not None:
            effort_lines.append(
                f"{t['work_effort_hours']}: {report.work_effort_hours:g} {t['hours_short']}"
            )

        if report.travel_effort_hours is not None:
            effort_lines.append(
                f"{t['travel_effort_hours']}: {report.travel_effort_hours:g} {t['hours_short']}"
            )

        if report.work_start_time is not None:
            effort_lines.append(
                f"{t['work_start_time']}: {report.work_start_time.strftime('%H:%M')}"
            )

        if report.work_end_time is not None:
            effort_lines.append(
                f"{t['work_end_time']}: {report.work_end_time.strftime('%H:%M')}"
            )

        elements.append(Paragraph('<br/>'.join(effort_lines), normal_style))
        elements.append(Spacer(1, 0.5*cm))
    
    # === MEASUREMENT TABLES ===
    measurements = report.measurements.all()
    if measurements.exists():
        elements.append(Paragraph(f"<b>{t['measurements_heading']}</b>", heading_style))
        
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
        elements.append(Paragraph(f"<b>{t['photos_heading']}</b>", heading_style))
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
                # Keep placeholder cell as an empty flowable list (no raw strings).
                current_pair.append([])
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


# ---------------------------------------------------------------------------
# HTML -> (html, tag)-Paare pro Block. Wird fuer den PDF-Build benutzt,
# um pro Block (p, h1-3, li-bullet, li-number) den richtigen ParagraphStyle
# zu waehlen.
# ---------------------------------------------------------------------------

import re as _re

_PDF_BLOCK_RE = _re.compile(
    r'<(p|h[1-3]|ul|ol)(\s[^>]*)?>(.*?)</\1>',
    _re.IGNORECASE | _re.DOTALL,
)
_PDF_LI_RE = _re.compile(r'<li(\s[^>]*)?>(.*?)</li>', _re.IGNORECASE | _re.DOTALL)
_PDF_TAG_RE = _re.compile(r'<[^>]+>')


def _split_blocks_with_style(raw_html):
    """
    Zerlegt das HTML in eine Liste von (html-fragment, tag)-Tupeln, die pro
    Block den passenden ParagraphStyle ermoeglichen. Innerhalb der Bloecke
    bleiben Inline-Tags (<b>, <i>, <u>, <br/>, <span style="...">) erhalten.
    """
    if not raw_html:
        return []

    from .notizen_utils import sanitize_for_pdf
    safe = sanitize_for_pdf(raw_html)
    if not safe:
        return []

    result = []
    last_end = 0
    text = safe

    for match in _PDF_BLOCK_RE.finditer(text):
        prefix = text[last_end:match.start()].strip()
        if prefix:
            plain = _PDF_TAG_RE.sub('', prefix).strip()
            if plain:
                result.append((_re.sub(r'<br\s*/?>', '<br/>', plain), 'p'))

        tag = match.group(1).lower()
        inner = match.group(3)

        if tag in ('h1', 'h2', 'h3'):
            inner_clean = _convert_inline_styles_to_rl(_strip_outer_p(inner).strip())
            if inner_clean:
                result.append((inner_clean, tag))
        elif tag == 'ul':
            for li in _PDF_LI_RE.finditer(inner):
                li_inner = _convert_inline_styles_to_rl(_strip_outer_p(li.group(2)).strip())
                if li_inner:
                    result.append((f'&bull;&nbsp; {li_inner}', 'li-bullet'))
        elif tag == 'ol':
            for idx, li in enumerate(_PDF_LI_RE.finditer(inner), start=1):
                li_inner = _convert_inline_styles_to_rl(_strip_outer_p(li.group(2)).strip())
                if li_inner:
                    result.append((f'{idx}.&nbsp; {li_inner}', 'li-number'))
        else:  # p
            inner_clean = _convert_inline_styles_to_rl(_strip_outer_p(inner).strip())
            if inner_clean:
                result.append((inner_clean, 'p'))

        last_end = match.end()

    suffix = text[last_end:].strip()
    if suffix:
        plain = _PDF_TAG_RE.sub('', suffix).strip()
        if plain:
            result.append((_re.sub(r'<br\s*/?>', '<br/>', plain), 'p'))

    return result


def _strip_outer_p(html_fragment):
    """Entfernt ein einzelnes umschliessendes <p>...</p>."""
    s = html_fragment.strip()
    m = _re.match(r'^<p(?:\s[^>]*)?>(.*)</p>$', s, _re.IGNORECASE | _re.DOTALL)
    if m:
        return m.group(1)
    return s


def _convert_inline_styles_to_rl(html_fragment):
    """Re-Export der Konvertierungsfunktion aus notizen_utils, damit das
    PDF-Modul Bloecke direkt vor dem Rendern aufbereiten kann."""
    from .notizen_utils import _convert_inline_styles_to_rl as _convert
    return _convert(html_fragment)
