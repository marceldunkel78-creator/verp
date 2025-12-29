"""
PDF Generator für Angebote
Professionelles DIN A4 Layout mit:
- Header auf jeder Seite
- Einzeilige Firmenadresse über Kundenadresse
- Anrede mit Titel und Nachname
- Positionstabelle mit Beschreibung
- 4-Spalten Footer mit Firmeninfos auf jeder Seite
- Grußformel mit Unterschrift
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


class QuotationDocTemplate(BaseDocTemplate):
    """
    Custom DocTemplate für Angebote mit Header und Footer auf jeder Seite
    """
    def __init__(self, filename, company=None, quotation=None, **kwargs):
        self.company = company
        self.quotation = quotation
        BaseDocTemplate.__init__(self, filename, **kwargs)
        
        # Frame für den Hauptinhalt
        frame = Frame(
            self.leftMargin, 
            self.bottomMargin, 
            self.width, 
            self.height,
            id='normal'
        )
        
        # PageTemplate mit unseren Callbacks
        template = PageTemplate(
            id='quotation',
            frames=frame,
            onPage=self._add_header_footer
        )
        self.addPageTemplates([template])
    
    def _add_header_footer(self, canvas, doc):
        """Fügt Header und Footer zu jeder Seite hinzu"""
        canvas.saveState()
        
        width, height = A4
        company = self.company
        quotation = self.quotation
        
        # === HEADER ===
        # Logo (wenn vorhanden)
        if company and company.document_header:
            try:
                logo_path = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
                if os.path.exists(logo_path):
                    # Logo so breit wie die Tabelle (17cm)
                    # Use ImageReader and mask='auto' to preserve PNG transparency instead of turning alpha to black
                    try:
                        img = ImageReader(logo_path)
                        canvas.drawImage(img, 2*cm, height - 2.5*cm, width=17*cm, height=2*cm, preserveAspectRatio=True, anchor='nw', mask='auto')
                    except Exception:
                        # Fallback to direct path if ImageReader fails
                        canvas.drawImage(logo_path, 2*cm, height - 2.5*cm, width=17*cm, height=2*cm, preserveAspectRatio=True, anchor='nw')
            except Exception as e:
                print(f"Error loading header logo: {e}")
        
        # Seitenzahl und Angebotsnummer (ab Seite 2)
        page_num = canvas.getPageNumber()
        if page_num > 1:
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.grey)
            header_text = f"Seite {page_num}, Angebot {quotation.quotation_number} vom {quotation.date.strftime('%d.%m.%Y')}"
            canvas.drawString(2*cm, height - 3.2*cm, header_text)
            # Unterstrich
            canvas.setStrokeColor(colors.grey)
            canvas.line(2*cm, height - 3.4*cm, width - 2*cm, height - 3.4*cm)
        
        # === FOOTER ===
        footer_y = 1.2*cm
        
        # Trennlinie über dem Footer
        canvas.setStrokeColor(colors.grey)
        canvas.line(2*cm, footer_y + 1.8*cm, width - 2*cm, footer_y + 1.8*cm)
        
        canvas.setFont('Helvetica', 6.5)
        canvas.setFillColor(colors.HexColor('#333333'))
        
        if company:
            # Block 1: Firmenadresse
            col1_x = 2*cm
            canvas.drawString(col1_x, footer_y + 1.4*cm, company.company_name or 'Visitron Systems GmbH')
            canvas.drawString(col1_x, footer_y + 0.9*cm, f"{company.street or ''} {company.house_number or ''}")
            canvas.drawString(col1_x, footer_y + 0.4*cm, f"D-{company.postal_code or ''} {company.city or ''}")
            
            # Block 2: Kontakt
            col2_x = 6.5*cm
            canvas.drawString(col2_x, footer_y + 1.4*cm, f"Tel. {company.phone or ''}")
            canvas.drawString(col2_x, footer_y + 0.9*cm, company.email or '')
            canvas.drawString(col2_x, footer_y + 0.4*cm, (company.website or '').replace('https://', '').replace('http://', ''))
            
            # Block 3: Handelsregister
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


def generate_quotation_pdf(quotation):
    """
    Generiert ein professionelles PDF für ein Angebot
    """
    buffer = BytesIO()
    
    # Lade Firmendaten
    company = CompanySettings.get_settings()
    
    # Lade Mitarbeiter für Grußformel
    created_by_employee = None
    if quotation.created_by and hasattr(quotation.created_by, 'employee') and quotation.created_by.employee:
        created_by_employee = quotation.created_by.employee
    
    # Erstelle Dokument mit benutzerdefinierten Seiten-Callbacks
    doc = QuotationDocTemplate(
        buffer, 
        pagesize=A4,
        topMargin=3.5*cm,  # Platz für Header
        bottomMargin=3.5*cm,  # Platz für Footer
        leftMargin=2*cm, 
        rightMargin=2*cm,
        company=company,
        quotation=quotation
    )
    
    # Elemente für das PDF
    elements = []
    styles = getSampleStyleSheet()
    
    # Eigene Styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#ff0099'),
        spaceAfter=10,
        spaceBefore=10,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=11,
        textColor=colors.HexColor('#b30066'),
        spaceAfter=8,
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
    )
    
    small_style = ParagraphStyle(
        'CustomSmall',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
    )
    
    tiny_style = ParagraphStyle(
        'CustomTiny',
        parent=styles['Normal'],
        fontSize=7,
        leading=9,
        textColor=colors.grey,
    )
    
    # Sprachabhängige Labels
    lang = quotation.language
    labels = {
        'DE': {
            'quotation': 'ANGEBOT',
            'quotation_number': 'Angebotsnummer:',
            'date': 'Datum:',
            'valid_until': 'Gültig bis:',
            'reference': 'Referenz:',
            'delivery_time': 'Lieferzeit:',
            'dear': 'Sehr geehrte(r)',
            'conditions': 'Konditionen',
            'payment': 'Zahlungsbedingungen:',
            'delivery': 'Lieferbedingungen:',
            'validity': 'Gültigkeit:',
            'delivery_weeks': 'Lieferzeit:',
            'weeks': 'Wochen',
            'net_total': 'Nettosumme:',
            'vat': 'MwSt.:',
            'total': 'Gesamtsumme:',
            'terms_note': 'Es gelten die Allgemeinen Geschäftsbedingungen der Visitron Systems GmbH.',
        },
        'EN': {
            'quotation': 'QUOTATION',
            'quotation_number': 'Quotation No.:',
            'date': 'Date:',
            'valid_until': 'Valid until:',
            'reference': 'Reference:',
            'delivery_time': 'Delivery time:',
            'dear': 'Dear',
            'conditions': 'Terms and Conditions',
            'payment': 'Payment terms:',
            'delivery': 'Delivery terms:',
            'validity': 'Validity:',
            'delivery_weeks': 'Delivery time:',
            'weeks': 'weeks',
            'net_total': 'Net total:',
            'vat': 'VAT:',
            'total': 'Total:',
            'terms_note': 'The General Terms and Conditions of Visitron Systems GmbH apply.',
        }
    }
    L = labels[lang]
    
    # === EINZEILIGE FIRMENADRESSE (über Kundenadresse) ===
    company_line = f"{company.company_name} • {company.street} {company.house_number or ''} • {company.postal_code} {company.city}"
    elements.append(Paragraph(company_line, tiny_style))
    elements.append(Spacer(1, 0.1*cm))
    
    # Trennlinie
    line_table = Table([['_' * 80]], colWidths=[17*cm])
    line_table.setStyle(TableStyle([
        ('TEXTCOLOR', (0,0), (-1,-1), colors.grey),
        ('FONTSIZE', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3*cm))
    
    # === KUNDENADRESSE ===
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
    elements.append(Paragraph(recipient_text, normal_style))
    elements.append(Spacer(1, 0.8*cm))
    
    # === ANGEBOTS-METADATEN (rechts) + TITEL ===
    meta_info_lines = [
        f"<b>{L['quotation_number']}</b> {quotation.quotation_number}",
        f"<b>{L['date']}</b> {quotation.date.strftime('%d.%m.%Y')}",
    ]
    
    if quotation.reference:
        meta_info_lines.append(f"<b>{L['reference']}</b> {quotation.reference}")
    
    meta_info_text = '<br/>'.join(meta_info_lines)
    
    # Zwei-Spalten Layout: Titel links, Meta rechts
    title_para = Paragraph(f"<b>{L['quotation']}</b>", title_style)
    meta_para = Paragraph(meta_info_text, small_style)
    
    header_table = Table([[title_para, meta_para]], colWidths=[10*cm, 7*cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # === ANREDE ===
    salutation_text = ""
    if quotation.customer:
        customer = quotation.customer
        customer_salutation = getattr(customer, 'salutation', '') or ''
        customer_title = getattr(customer, 'title', '') or ''
        customer_lastname = getattr(customer, 'last_name', '') or ''
        
        parts = [L['dear']]
        if customer_salutation:
            parts.append(customer_salutation)
        if customer_title:
            parts.append(customer_title)
        if customer_lastname:
            parts.append(customer_lastname)
        
        salutation_text = ' '.join(parts) + ','
    
    if salutation_text:
        elements.append(Paragraph(salutation_text, normal_style))
        elements.append(Spacer(1, 0.3*cm))
    
    # === ANGEBOTSBESCHREIBUNG ===
    description_text = getattr(quotation, 'description_text', '') or ''
    if description_text:
        elements.append(Paragraph(description_text, normal_style))
        elements.append(Spacer(1, 0.5*cm))
    
    # === POSITIONEN TABELLE ===
    position_labels = {
        'DE': ['Pos.', 'Art.-Nr.', 'Artikel', 'Beschreibung', 'Menge', 'Einzelpreis', 'Rabatt', 'Gesamt'],
        'EN': ['Pos.', 'Art. No.', 'Article', 'Description', 'Quantity', 'Unit Price', 'Discount', 'Total']
    }
    
    table_data = [position_labels[lang]]
    
    # Positionen hinzufügen
    for item in quotation.items.all().order_by('position'):
        # Artikelnummer
        article_number = item.item_article_number or ''
        if not article_number and item.item:
            article_number = getattr(item.item, 'visitron_part_number', '') or getattr(item.item, 'supplier_part_number', '') or getattr(item.item, 'part_number', '') or getattr(item.item, 'article_number', '') or ''
        
        # Handle Gruppen-Header
        if item.is_group_header:
            position_str = str(item.position)
            item_name = f"📦 {item.group_name}"
            description = item.custom_description or "Warensammlung"
            quantity_str = "1.00"
            unit_price_str = f"€ {item.sale_price:,.2f}" if item.sale_price else "-"
            discount_str = "-"
            subtotal_str = f"€ {item.sale_price:,.2f}" if item.sale_price else "-"
        elif item.group_id:
            # Gruppenmitglied - keine Position, eingerückt
            position_str = ""
            prefix = "    "  # Eingerückt
            item_name = prefix + (item.item.name if item.item else '-')
            
            # Beschreibung - bevorzuge custom_description
            if item.custom_description:
                description = item.custom_description
            elif item.item:
                if item.description_type == 'SHORT':
                    description = getattr(item.item, 'short_description', '') or ''
                else:
                    description = getattr(item.item, 'description', '') or ''
            else:
                description = ''
            
            quantity_str = f"{item.quantity:.2f}"
            show_prices = quotation.show_group_item_prices
            
            if show_prices:
                unit_price_str = f"€ {item.unit_price:,.2f}"
                discount_str = f"{item.discount_percent:.1f}%" if item.discount_percent > 0 else '-'
                subtotal_str = f"€ {item.subtotal:,.2f}"
            else:
                unit_price_str = "-"
                discount_str = "-"
                subtotal_str = "-"
        else:
            # Einzelposition
            position_str = str(item.position)
            item_name = item.item.name if item.item else '-'
            
            # Beschreibung - bevorzuge custom_description
            if item.custom_description:
                description = item.custom_description
            elif item.item:
                if item.description_type == 'SHORT':
                    description = getattr(item.item, 'short_description', '') or ''
                else:
                    description = getattr(item.item, 'description', '') or ''
            else:
                description = ''
            
            quantity_str = f"{item.quantity:.2f}"
            
            if item.uses_system_price and quotation.system_price:
                unit_price_str = "Systempreis"
                discount_str = "-"
                subtotal_str = f"€ {quotation.system_price:,.2f}"
            else:
                unit_price_str = f"€ {item.unit_price:,.2f}"
                discount_str = f"{item.discount_percent:.1f}%" if item.discount_percent > 0 else '-'
                subtotal_str = f"€ {item.subtotal:,.2f}"
        
        table_data.append([
            position_str,
            article_number[:15] if article_number else '',  # Kürze Artikelnummer
            Paragraph(item_name, small_style),
            Paragraph(description[:150] if description else '', small_style),  # Kürze lange Beschreibungen
            quantity_str,
            unit_price_str,
            discount_str,
            subtotal_str
        ])
    
    # Tabelle erstellen
    col_widths = [1*cm, 2*cm, 3*cm, 4*cm, 1.5*cm, 2*cm, 1.5*cm, 2*cm]
    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#ff0099')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        
        # Daten
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('ALIGN', (0,1), (0,-1), 'CENTER'),
        ('ALIGN', (4,1), (4,-1), 'RIGHT'),
        ('ALIGN', (5,1), (5,-1), 'RIGHT'),
        ('ALIGN', (6,1), (6,-1), 'CENTER'),
        ('ALIGN', (7,1), (7,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        
        # Grid
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8f9fa')]),
        
        # Padding
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,1), (-1,-1), 3),
        ('BOTTOMPADDING', (0,1), (-1,-1), 3),
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
        if item.is_group_header or not item.group_id:
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
    
    sum_table = Table(sum_data, colWidths=[11*cm, 3.5*cm, 2.5*cm])
    sum_table.setStyle(TableStyle([
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('ALIGN', (2,0), (2,-1), 'RIGHT'),
        ('FONTNAME', (1,0), (2,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (1,0), (2,-1), 9),
        ('LINEABOVE', (1,-1), (2,-1), 2, colors.HexColor('#ff0099')),
        ('TOPPADDING', (0,-1), (-1,-1), 6),
    ]))
    
    elements.append(sum_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # === FUßTEXT DES ANGEBOTS ===
    footer_text = getattr(quotation, 'footer_text', '') or ''
    if footer_text:
        elements.append(Paragraph(footer_text, normal_style))
        elements.append(Spacer(1, 0.3*cm))
    
    # === KONDITIONEN ===
    elements.append(Paragraph(f"<b>{L['conditions']}</b>", heading_style))
    
    conditions_items = []
    
    # Gültig bis
    if quotation.valid_until:
        validity_text = f"{L['validity']} {quotation.valid_until.strftime('%d.%m.%Y')}"
        conditions_items.append(validity_text)
    
    # Lieferzeit
    if quotation.delivery_time_weeks:
        delivery_text = f"{L['delivery_weeks']} {quotation.delivery_time_weeks} {L['weeks']}"
        conditions_items.append(delivery_text)
    
    # Zahlungsbedingungen
    if quotation.payment_term:
        try:
            payment_text = f"{L['payment']} {quotation.payment_term.get_formatted_terms()}"
            conditions_items.append(payment_text)
        except:
            pass
    
    # Lieferbedingungen
    if quotation.delivery_term:
        try:
            delivery_term_text = f"{L['delivery']} {quotation.delivery_term.get_incoterm_display()}"
            conditions_items.append(delivery_term_text)
        except:
            pass
    
    if conditions_items:
        conditions_text = '<br/>'.join(conditions_items)
        elements.append(Paragraph(conditions_text, normal_style))
        elements.append(Spacer(1, 0.3*cm))
    
    # AGB-Hinweis
    if quotation.show_terms_conditions:
        elements.append(Paragraph(L['terms_note'], small_style))
        elements.append(Spacer(1, 0.5*cm))
    
    # === GRUßFORMEL MIT UNTERSCHRIFT ===
    if created_by_employee:
        greeting = created_by_employee.closing_greeting or ('Mit freundlichen Grüßen' if lang == 'DE' else 'Best regards')
        elements.append(Paragraph(greeting, normal_style))
        elements.append(Spacer(1, 0.3*cm))
        
        # Unterschriftsbild
        if created_by_employee.signature_image:
            try:
                sig_path = os.path.join(settings.MEDIA_ROOT, created_by_employee.signature_image.name)
                if os.path.exists(sig_path):
                    sig_img = Image(sig_path, width=4*cm, height=1.5*cm, kind='proportional')
                    sig_img.hAlign = 'LEFT'
                    elements.append(sig_img)
                    elements.append(Spacer(1, 0.2*cm))
            except Exception as e:
                print(f"Error loading signature: {e}")
        
        # Name und Position
        employee_name = f"{created_by_employee.first_name} {created_by_employee.last_name}"
        elements.append(Paragraph(employee_name, normal_style))
        if created_by_employee.job_title:
            elements.append(Paragraph(created_by_employee.job_title, small_style))
    else:
        # Fallback ohne Mitarbeiter
        greeting = 'Mit freundlichen Grüßen' if lang == 'DE' else 'Best regards'
        elements.append(Paragraph(greeting, normal_style))
        elements.append(Spacer(1, 0.5*cm))
        if quotation.created_by:
            elements.append(Paragraph(quotation.created_by.get_full_name() or quotation.created_by.username, normal_style))
    
    # PDF generieren
    doc.build(elements)
    buffer.seek(0)
    return buffer
