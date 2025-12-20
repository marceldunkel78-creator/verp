"""
PDF Generator für Angebote
Verwendet ReportLab für professionelle PDF-Generierung im DIN A4 Format
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from company.models import CompanySettings
from django.conf import settings
import os


def generate_quotation_pdf(quotation):
    """
    Generiert ein professionelles PDF für ein Angebot
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, 
                          topMargin=2*cm, bottomMargin=2*cm,
                          leftMargin=2*cm, rightMargin=2*cm)
    
    # Elemente für das PDF
    elements = []
    styles = getSampleStyleSheet()
    
    # Company Settings laden
    company = CompanySettings.get_settings()
    
    # Eigene Styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#2563eb'),
        spaceAfter=20,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=10,
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
    )
    
    small_style = ParagraphStyle(
        'CustomSmall',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
    )
    
    # === HEADER MIT LOGO ===
    if company and company.document_header:
        try:
            logo_path = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
            if os.path.exists(logo_path):
                img = Image(logo_path, width=6*cm, height=2*cm, kind='proportional')
                elements.append(img)
                elements.append(Spacer(1, 0.5*cm))
        except Exception as e:
            print(f"Error loading logo: {e}")
    
    # === TITEL ===
    title_text = "ANGEBOT" if quotation.language == 'DE' else "QUOTATION"
    elements.append(Paragraph(title_text, title_style))
    elements.append(Spacer(1, 0.3*cm))
    
    # === META-INFORMATIONEN (2-Spalten Layout) ===
    meta_data = []
    
    # Linke Spalte: Empfänger
    recipient_lines = []
    if quotation.recipient_company:
        recipient_lines.append(quotation.recipient_company)
    if quotation.recipient_name:
        recipient_lines.append(quotation.recipient_name)
    if quotation.recipient_street:
        recipient_lines.append(quotation.recipient_street)
    if quotation.recipient_postal_code or quotation.recipient_city:
        city_line = f"{quotation.recipient_postal_code} {quotation.recipient_city}".strip()
        recipient_lines.append(city_line)
    if quotation.recipient_country and quotation.recipient_country != 'DE':
        recipient_lines.append(quotation.recipient_country)
    
    recipient_text = '<br/>'.join(recipient_lines) if recipient_lines else '-'
    
    # Rechte Spalte: Angebots-Details
    labels = {
        'DE': {
            'number': 'Angebotsnummer:',
            'date': 'Datum:',
            'valid_until': 'Gültig bis:',
            'reference': 'Referenz:',
            'delivery_time': 'Lieferzeit:',
        },
        'EN': {
            'number': 'Quotation No.:',
            'date': 'Date:',
            'valid_until': 'Valid until:',
            'reference': 'Reference:',
            'delivery_time': 'Delivery time:',
        }
    }
    lang = quotation.language
    
    meta_info_lines = [
        f"<b>{labels[lang]['number']}</b> {quotation.quotation_number}",
        f"<b>{labels[lang]['date']}</b> {quotation.date.strftime('%d.%m.%Y')}",
        f"<b>{labels[lang]['valid_until']}</b> {quotation.valid_until.strftime('%d.%m.%Y')}",
    ]
    
    if quotation.reference:
        meta_info_lines.append(f"<b>{labels[lang]['reference']}</b> {quotation.reference}")
    
    if quotation.delivery_time_weeks:
        weeks_text = "Wochen" if lang == 'DE' else "weeks"
        meta_info_lines.append(f"<b>{labels[lang]['delivery_time']}</b> {quotation.delivery_time_weeks} {weeks_text}")
    
    meta_info_text = '<br/>'.join(meta_info_lines)
    
    meta_table_data = [[
        Paragraph(recipient_text, normal_style),
        Paragraph(meta_info_text, normal_style)
    ]]
    
    meta_table = Table(meta_table_data, colWidths=[9*cm, 8*cm])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 1*cm))
    
    # === POSITIONEN TABELLE ===
    position_labels = {
        'DE': ['Pos.', 'Artikelname', 'Beschreibung', 'Menge', 'Einzelpreis', 'Rabatt', 'Gesamt'],
        'EN': ['Pos.', 'Article', 'Description', 'Quantity', 'Unit Price', 'Discount', 'Total']
    }
    
    table_data = [position_labels[lang]]
    
    # Positionen hinzufügen
    for item in quotation.items.all().order_by('position'):
        # Handle Gruppen-Header
        if item.is_group_header:
            item_name = f"📦 {item.group_name}"
            description = "Warensammlung"
            quantity_str = "-"
            unit_price_str = "-"
            discount_str = "-"
            # Verkaufspreis der Gruppe
            subtotal_str = f"€ {item.sale_price:,.2f}" if item.sale_price else "-"
        else:
            # Gruppenmitglied einrücken
            prefix = "  ↳ " if item.group_id else ""
            item_name = prefix + (item.item.name if item.item else '-')
            
            # Beschreibung basierend auf description_type
            if item.item:
                if item.description_type == 'SHORT':
                    description = item.item.short_description or ''
                else:
                    description = item.item.description or ''
            else:
                description = ''
            
            # Formatierung
            quantity_str = f"{item.quantity:.2f}"
            
            # Wenn Position Systempreis verwendet
            if item.uses_system_price and quotation.system_price:
                unit_price_str = "Systempreis"
                discount_str = "-"
                subtotal_str = f"€ {quotation.system_price:,.2f}"
            else:
                unit_price_str = f"€ {item.unit_price:,.2f}"
                discount_str = f"{item.discount_percent:.1f}%" if item.discount_percent > 0 else '-'
                subtotal_str = f"€ {item.subtotal:,.2f}"
        
        table_data.append([
            str(item.position),
            Paragraph(item_name, small_style),
            Paragraph(description[:100], small_style),  # Kürze lange Beschreibungen
            quantity_str,
            unit_price_str,
            discount_str,
            subtotal_str
        ])
    
    # Tabelle erstellen
    col_widths = [1*cm, 3.5*cm, 5*cm, 1.5*cm, 2*cm, 1.5*cm, 2.5*cm]
    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2563eb')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('TOPPADDING', (0,0), (-1,0), 8),
        
        # Daten
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('ALIGN', (0,1), (0,-1), 'CENTER'),  # Pos
        ('ALIGN', (3,1), (3,-1), 'RIGHT'),   # Menge
        ('ALIGN', (4,1), (4,-1), 'RIGHT'),   # Einzelpreis
        ('ALIGN', (5,1), (5,-1), 'CENTER'),  # Rabatt
        ('ALIGN', (6,1), (6,-1), 'RIGHT'),   # Gesamt
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        
        # Grid
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f3f4f6')]),
        
        # Padding
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,1), (-1,-1), 4),
        ('BOTTOMPADDING', (0,1), (-1,-1), 4),
    ]))
    
    elements.append(items_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # === SYSTEMPREIS-HINWEIS ===
    if quotation.system_price:
        system_price_note = {
            'DE': f'<b>Hinweis:</b> Für Positionen die als "Systempreis" markiert sind, gilt ein Gesamtpreis von € {quotation.system_price:,.2f}',
            'EN': f'<b>Note:</b> For items marked as "System Price", a total price of € {quotation.system_price:,.2f} applies'
        }
        elements.append(Paragraph(system_price_note[lang], small_style))
        elements.append(Spacer(1, 0.3*cm))
    
    # === MwSt-HINWEIS ===
    if not quotation.tax_enabled:
        tax_note = {
            'DE': '<b>Hinweis:</b> Alle Preise verstehen sich ohne Mehrwertsteuer.',
            'EN': '<b>Note:</b> All prices are excluding VAT.'
        }
        elements.append(Paragraph(tax_note[lang], small_style))
        elements.append(Spacer(1, 0.3*cm))
    elif quotation.tax_rate != 19:
        tax_note = {
            'DE': f'<b>Hinweis:</b> Es wird ein MwSt-Satz von {quotation.tax_rate}% angewendet.',
            'EN': f'<b>Note:</b> A VAT rate of {quotation.tax_rate}% is applied.'
        }
        elements.append(Paragraph(tax_note[lang], small_style))
        elements.append(Spacer(1, 0.3*cm))
    
    # === SUMMEN ===
    from decimal import Decimal
    total_net = Decimal('0.00')
    total_tax = Decimal('0.00')
    total_gross = Decimal('0.00')
    
    for item in quotation.items.all():
        total_net += item.subtotal
        total_tax += item.tax_amount
        total_gross += item.total
    
    sum_labels = {
        'DE': ['Nettosumme:', 'MwSt:', 'Gesamtsumme:'],
        'EN': ['Net total:', 'VAT:', 'Total:']
    }
    
    sum_data = [
        ['', sum_labels[lang][0], f"€ {total_net:,.2f}"],
        ['', sum_labels[lang][1], f"€ {total_tax:,.2f}"],
        ['', sum_labels[lang][2], f"€ {total_gross:,.2f}"],
    ]
    
    sum_table = Table(sum_data, colWidths=[11.5*cm, 3*cm, 2.5*cm])
    sum_table.setStyle(TableStyle([
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('ALIGN', (2,0), (2,-1), 'RIGHT'),
        ('FONTNAME', (1,0), (2,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (1,0), (2,-1), 10),
        ('LINEABOVE', (1,-1), (2,-1), 2, colors.HexColor('#2563eb')),
        ('TOPPADDING', (0,-1), (-1,-1), 8),
    ]))
    
    elements.append(sum_table)
    elements.append(Spacer(1, 1*cm))
    
    # === KONDITIONEN ===
    if quotation.payment_term or quotation.delivery_term:
        condition_labels = {
            'DE': 'Konditionen',
            'EN': 'Terms and Conditions'
        }
        elements.append(Paragraph(condition_labels[lang], heading_style))
        
        conditions = []
        if quotation.payment_term:
            try:
                payment_text = quotation.payment_term.get_formatted_terms()
                conditions.append(f"<b>Zahlung:</b> {payment_text}")
            except:
                pass
        
        if quotation.delivery_term:
            try:
                delivery_text = quotation.delivery_term.get_incoterm_display()
                conditions.append(f"<b>Lieferung:</b> {delivery_text}")
            except:
                pass
        
        if conditions:
            conditions_text = '<br/>'.join(conditions)
            elements.append(Paragraph(conditions_text, normal_style))
            elements.append(Spacer(1, 0.5*cm))
    
    # === AGB-HINWEIS ===
    if quotation.show_terms_conditions:
        terms_text = {
            'DE': 'Es gelten die Allgemeinen Geschäftsbedingungen der Visitron Systems GmbH.',
            'EN': 'The General Terms and Conditions of Visitron Systems GmbH apply.'
        }
        elements.append(Paragraph(terms_text[lang], small_style))
        elements.append(Spacer(1, 0.5*cm))
    
    # === FOOTER MIT FIRMENDATEN ===
    if company:
        footer_data = []
        
        # Firmenname und Anschrift
        col1 = []
        if company.company_name:
            col1.append(f"<b>{company.company_name}</b>")
        if company.street:
            col1.append(company.street)
        if company.postal_code or company.city:
            col1.append(f"{company.postal_code} {company.city}")
        
        # Kontakt
        col2 = []
        if company.phone:
            col2.append(f"Tel: {company.phone}")
        if company.email:
            col2.append(f"E-Mail: {company.email}")
        if company.website:
            col2.append(f"Web: {company.website}")
        
        # Bank und Steuern
        col3 = []
        if company.tax_number:
            col3.append(f"Steuernr.: {company.tax_number}")
        if company.vat_id:
            col3.append(f"USt-IdNr.: {company.vat_id}")
        
        footer_data.append([
            Paragraph('<br/>'.join(col1), small_style),
            Paragraph('<br/>'.join(col2), small_style),
            Paragraph('<br/>'.join(col3), small_style),
        ])
        
        footer_table = Table(footer_data, colWidths=[5.5*cm, 5.5*cm, 5.5*cm])
        footer_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('LINEABOVE', (0,0), (-1,0), 0.5, colors.grey),
        ]))
        
        elements.append(Spacer(1, 1*cm))
        elements.append(footer_table)
    
    # PDF generieren
    doc.build(elements)
    buffer.seek(0)
    return buffer
