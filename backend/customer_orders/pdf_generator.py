"""
PDF Generator für Kundenaufträge:
- Auftragsbestätigung (AB)
- Lieferschein
- Rechnung

Professionelles DIN A4 Layout mit:
- Header auf jeder Seite
- Einzeilige Firmenadresse über Kundenadresse
- Positionstabelle mit Beschreibung
- 4-Spalten Footer mit Firmeninfos auf jeder Seite
- Grußformel mit Unterschrift
"""
from io import BytesIO
from decimal import Decimal
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
from django.utils import timezone
import os


# =============================================================================
# Helper Functions for Customer Data
# =============================================================================

def get_customer_display_name(customer):
    """
    Returns the best available display name for a customer.
    Tries: first address's university/institute, then full name.
    """
    if not customer:
        return ''
    
    # Check if customer has addresses with university/institute
    if hasattr(customer, 'addresses'):
        primary_addr = customer.addresses.filter(is_active=True).first()
        if primary_addr:
            if primary_addr.university:
                return primary_addr.university
            if primary_addr.institute:
                return primary_addr.institute
    
    # Fallback to customer name
    parts = []
    if getattr(customer, 'title', None):
        parts.append(customer.title)
    if getattr(customer, 'first_name', None):
        parts.append(customer.first_name)
    if getattr(customer, 'last_name', None):
        parts.append(customer.last_name)
    return ' '.join(parts).strip()


def get_customer_address_lines(customer):
    """
    Returns a list of address lines for a customer.
    Uses the primary/first active address from CustomerAddress.
    """
    lines = []
    if not customer:
        return lines
    
    # Get primary address
    address = None
    if hasattr(customer, 'addresses'):
        address = customer.addresses.filter(is_active=True).first()
    
    if address:
        # Add university/institute/department if available
        if address.university:
            lines.append(address.university)
        if address.institute:
            lines.append(address.institute)
        if address.department:
            lines.append(address.department)
        
        # Add contact name
        contact_name = get_customer_contact_name(customer)
        if contact_name:
            lines.append(contact_name)
        
        # Add street address
        street_line = f"{address.street or ''} {address.house_number or ''}".strip()
        if street_line:
            lines.append(street_line)
        if address.address_supplement:
            lines.append(address.address_supplement)
        
        # Add city
        city_line = f"{address.postal_code or ''} {address.city or ''}".strip()
        if city_line:
            lines.append(city_line)
        
        # Add country if not Germany
        if address.country and address.country not in ('DE', 'Deutschland', 'Germany'):
            lines.append(address.country)
    else:
        # No address found, just use customer name
        name = get_customer_display_name(customer)
        if name:
            lines.append(name)
    
    return lines


def get_customer_contact_name(customer):
    """
    Returns the contact name for salutation purposes.
    """
    if not customer:
        return ''
    
    parts = []
    if getattr(customer, 'salutation', None):
        parts.append(customer.salutation)
    if getattr(customer, 'title', None):
        parts.append(customer.title)
    if getattr(customer, 'first_name', None):
        parts.append(customer.first_name)
    if getattr(customer, 'last_name', None):
        parts.append(customer.last_name)
    return ' '.join(parts).strip()


def get_customer_salutation(customer, language='DE'):
    """
    Returns an appropriate salutation for the customer.
    """
    if not customer:
        return 'Sehr geehrte Damen und Herren,'
    
    salutation = getattr(customer, 'salutation', '')
    last_name = getattr(customer, 'last_name', '')
    title = getattr(customer, 'title', '')
    
    if salutation in ('Herr', 'Mr.'):
        name_part = f"{title} {last_name}".strip() if title else last_name
        return f"Sehr geehrter Herr {name_part}," if language == 'DE' else f"Dear Mr. {name_part},"
    elif salutation in ('Frau', 'Mrs.', 'Ms.'):
        name_part = f"{title} {last_name}".strip() if title else last_name
        return f"Sehr geehrte Frau {name_part}," if language == 'DE' else f"Dear Ms. {name_part},"
    else:
        return 'Sehr geehrte Damen und Herren,' if language == 'DE' else 'Dear Sir or Madam,'


# =============================================================================
# Base Document Templates
# =============================================================================


class OrderDocumentTemplate(BaseDocTemplate):
    """
    Basis DocTemplate für alle Auftragsdokumente mit Header und Footer auf jeder Seite
    """
    def __init__(self, filename, company=None, document=None, document_type='order', **kwargs):
        self.company = company
        self.document = document
        self.document_type = document_type  # 'order', 'delivery_note', 'invoice'
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
            id='document',
            frames=frame,
            onPage=self._add_header_footer
        )
        self.addPageTemplates([template])
    
    def _add_header_footer(self, canvas, doc):
        """Fügt Header und Footer zu jeder Seite hinzu"""
        canvas.saveState()
        
        width, height = A4
        company = self.company
        document = self.document
        
        # === HEADER ===
        page_num = canvas.getPageNumber()
        
        # Logo (nur auf Seite 1, rechts oben)
        if page_num == 1 and company and company.document_header:
            try:
                logo_path = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
                if os.path.exists(logo_path):
                    # Logo rechts oben, kleinere Größe: 5cm breit, 1.5cm hoch
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
        
        # Seitenzahl und Dokumentnummer (ab Seite 2)
        if page_num > 1:
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.grey)
            
            # Dokumentspezifische Header-Zeile
            if self.document_type == 'order':
                doc_number = document.order_number or '---'
                doc_date = document.confirmation_date or document.order_date
                header_text = f"Seite {page_num}, Auftragsbestätigung {doc_number}"
            elif self.document_type == 'delivery_note':
                doc_number = document.delivery_note_number
                doc_date = document.delivery_date
                header_text = f"Seite {page_num}, Lieferschein {doc_number}"
            elif self.document_type == 'invoice':
                doc_number = document.invoice_number
                doc_date = document.invoice_date
                header_text = f"Seite {page_num}, Rechnung {doc_number}"
            else:
                doc_number = ''
                doc_date = timezone.now().date()
                header_text = f"Seite {page_num}"
            
            if doc_date:
                header_text += f" vom {doc_date.strftime('%d.%m.%Y')}"
            
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


# =============================================================================
# Style Definitions
# =============================================================================

def get_document_styles():
    """Gibt die Standard-Styles für Dokumente zurück"""
    styles = getSampleStyleSheet()
    
    return {
        'title': ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#ff0099'),
            spaceAfter=10,
            spaceBefore=10,
        ),
        'heading': ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=11,
            textColor=colors.HexColor('#b30066'),
            spaceAfter=8,
        ),
        'normal': ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
        ),
        'small': ParagraphStyle(
            'CustomSmall',
            parent=styles['Normal'],
            fontSize=8,
            leading=10,
        ),
        'tiny': ParagraphStyle(
            'CustomTiny',
            parent=styles['Normal'],
            fontSize=7,
            leading=9,
            textColor=colors.grey,
        ),
        'right': ParagraphStyle(
            'RightAlign',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            alignment=TA_RIGHT,
        ),
        'bold': ParagraphStyle(
            'BoldStyle',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            fontName='Helvetica-Bold',
        ),
        'table_header': ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontSize=8,
            fontName='Helvetica-Bold',
            textColor=colors.white,
        ),
        'table_cell': ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontSize=8,
            leading=10,
        ),
    }


def get_labels(language='DE'):
    """Sprachabhängige Labels"""
    labels = {
        'DE': {
            # Auftragsbestätigung
            'order_confirmation': 'AUFTRAGSBESTÄTIGUNG',
            'order_number': 'Auftragsnummer:',
            'date': 'Datum:',
            'your_reference': 'Ihre Referenz:',
            'our_reference': 'Unsere Referenz:',
            'customer_order': 'Ihre Bestellung:',
            'delivery_date': 'Liefertermin:',
            'dear': 'Sehr geehrte(r)',
            
            # Lieferschein
            'delivery_note': 'LIEFERSCHEIN',
            'delivery_note_number': 'Lieferscheinnummer:',
            'shipping_date': 'Versanddatum:',
            'tracking': 'Tracking-Nummer:',
            'packages': 'Pakete:',
            
            # Rechnung
            'invoice': 'RECHNUNG',
            'invoice_number': 'Rechnungsnummer:',
            'invoice_date': 'Rechnungsdatum:',
            'due_date': 'Fällig am:',
            'vat_id': 'USt-IdNr.:',
            
            # Positionen
            'position': 'Pos.',
            'article': 'Artikel-Nr.',
            'description': 'Beschreibung',
            'quantity': 'Menge',
            'unit': 'Einheit',
            'unit_price': 'Einzelpreis',
            'total': 'Gesamtpreis',
            'serial': 'Serien-Nr.',
            
            # Summen
            'net_total': 'Nettosumme:',
            'vat': 'MwSt. (19%):',
            'gross_total': 'Gesamtsumme:',
            
            # Konditionen
            'conditions': 'Konditionen',
            'payment_terms': 'Zahlungsbedingungen:',
            'delivery_terms': 'Lieferbedingungen:',
            'warranty': 'Garantie:',
            
            # Fußtexte
            'order_thanks': 'Wir bedanken uns für Ihren Auftrag und freuen uns auf die weitere Zusammenarbeit.',
            'delivery_thanks': 'Bitte prüfen Sie die Lieferung sofort nach Erhalt auf Vollständigkeit und Beschädigung.',
            'invoice_thanks': 'Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer auf unser Konto.',
            'terms_note': 'Es gelten die Allgemeinen Geschäftsbedingungen der Visitron Systems GmbH.',
            'regards': 'Mit freundlichen Grüßen',
        },
        'EN': {
            # Order Confirmation
            'order_confirmation': 'ORDER CONFIRMATION',
            'order_number': 'Order No.:',
            'date': 'Date:',
            'your_reference': 'Your Reference:',
            'our_reference': 'Our Reference:',
            'customer_order': 'Your Order:',
            'delivery_date': 'Delivery date:',
            'dear': 'Dear',
            
            # Delivery Note
            'delivery_note': 'DELIVERY NOTE',
            'delivery_note_number': 'Delivery Note No.:',
            'shipping_date': 'Shipping Date:',
            'tracking': 'Tracking No.:',
            'packages': 'Packages:',
            
            # Invoice
            'invoice': 'INVOICE',
            'invoice_number': 'Invoice No.:',
            'invoice_date': 'Invoice Date:',
            'due_date': 'Due Date:',
            'vat_id': 'VAT ID:',
            
            # Positions
            'position': 'Pos.',
            'article': 'Article No.',
            'description': 'Description',
            'quantity': 'Qty',
            'unit': 'Unit',
            'unit_price': 'Unit Price',
            'total': 'Total',
            'serial': 'Serial No.',
            
            # Totals
            'net_total': 'Net total:',
            'vat': 'VAT (19%):',
            'gross_total': 'Total:',
            
            # Conditions
            'conditions': 'Terms and Conditions',
            'payment_terms': 'Payment terms:',
            'delivery_terms': 'Delivery terms:',
            'warranty': 'Warranty:',
            
            # Footer texts
            'order_thanks': 'Thank you for your order. We look forward to further cooperation.',
            'delivery_thanks': 'Please check the delivery immediately upon receipt for completeness and damage.',
            'invoice_thanks': 'Please transfer the amount to our account, stating the invoice number.',
            'terms_note': 'The General Terms and Conditions of Visitron Systems GmbH apply.',
            'regards': 'Best regards',
        }
    }
    return labels.get(language, labels['DE'])


# =============================================================================
# Auftragsbestätigung (AB) PDF
# =============================================================================

def generate_order_confirmation_pdf(order, language='DE'):
    """
    Generiert ein professionelles PDF für eine Auftragsbestätigung
    
    Args:
        order: CustomerOrder Objekt
        language: 'DE' oder 'EN'
    
    Returns:
        Relativer Pfad zur PDF-Datei
    """
    from django.core.files.base import ContentFile
    
    buffer = BytesIO()
    company = CompanySettings.get_settings()
    styles = get_document_styles()
    L = get_labels(language)
    
    # Dokument erstellen
    doc = OrderDocumentTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.5*cm,
        bottomMargin=3.5*cm,
        leftMargin=2*cm,
        rightMargin=2*cm,
        company=company,
        document=order,
        document_type='order'
    )
    
    elements = []
    
    # === EINZEILIGE FIRMENADRESSE ===
    company_line = f"{company.company_name} • {company.street} {company.house_number or ''} • {company.postal_code} {company.city}"
    elements.append(Paragraph(company_line, styles['tiny']))
    elements.append(Spacer(1, 0.1*cm))
    
    # Trennlinie
    line_table = Table([['_' * 80]], colWidths=[17*cm])
    line_table.setStyle(TableStyle([
        ('TEXTCOLOR', (0,0), (-1,-1), colors.grey),
        ('FONTSIZE', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3*cm))
    
    # === KUNDENADRESSE ===
    customer = order.customer
    address_lines = get_customer_address_lines(customer)
    
    for line in address_lines:
        if line:
            elements.append(Paragraph(line, styles['normal']))
    elements.append(Spacer(1, 1*cm))
    
    # === DOKUMENTTITEL UND METADATEN ===
    # 2-spaltige Tabelle: Links Titel, rechts Metadaten
    meta_data = []
    meta_data.append([L['order_number'], order.order_number or '---'])
    meta_data.append([L['date'], (order.confirmation_date or order.order_date or timezone.now().date()).strftime('%d.%m.%Y')])
    if order.customer_order_number:
        meta_data.append([L['customer_order'], order.customer_order_number])
    if order.project_reference:
        meta_data.append([L['your_reference'], order.project_reference])
    if order.delivery_date:
        meta_data.append([L['delivery_date'], order.delivery_date.strftime('%d.%m.%Y')])
    
    # Titel links
    title = Paragraph(L['order_confirmation'], styles['title'])
    
    # Meta-Tabelle rechts
    meta_table = Table(meta_data, colWidths=[4*cm, 4*cm])
    meta_table.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('ALIGN', (1,0), (1,-1), 'LEFT'),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    
    header_table = Table([[title, meta_table]], colWidths=[9*cm, 8*cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # === ANSCHREIBEN ===
    contact_name = ''
    if customer:
        if hasattr(customer, 'contact_title') and customer.contact_title:
            contact_name = f"{customer.contact_title} "
        if hasattr(customer, 'contact_last_name') and customer.contact_last_name:
            contact_name += customer.contact_last_name
        elif hasattr(customer, 'contact_name') and customer.contact_name:
            contact_name = customer.contact_name
    
    if contact_name:
        elements.append(Paragraph(f"{L['dear']} {contact_name},", styles['normal']))
    else:
        elements.append(Paragraph(f"{L['dear']} Damen und Herren,", styles['normal']))
    elements.append(Spacer(1, 0.3*cm))
    
    intro_text = "wir bestätigen Ihren Auftrag und danken für Ihr Vertrauen." if language == 'DE' else \
                 "we confirm your order and thank you for your trust."
    elements.append(Paragraph(intro_text, styles['normal']))
    elements.append(Spacer(1, 0.5*cm))
    
    # === POSITIONSTABELLE ===
    elements.append(Paragraph("Positionen", styles['heading']))
    
    # Header
    table_header = [
        Paragraph(L['position'], styles['table_header']),
        Paragraph(L['article'], styles['table_header']),
        Paragraph(L['description'], styles['table_header']),
        Paragraph(L['quantity'], styles['table_header']),
        Paragraph(L['unit_price'], styles['table_header']),
        Paragraph(L['total'], styles['table_header']),
    ]
    
    table_data = [table_header]
    
    # Positionen
    items = order.items.all().order_by('position')
    for item in items:
        # Beschreibung mit Name
        desc = item.name or ''
        if item.description:
            desc += f"<br/><font size='7' color='grey'>{item.description[:100]}{'...' if len(item.description) > 100 else ''}</font>"
        
        total = (item.final_price or item.list_price or 0) * (item.quantity or 1)
        
        table_data.append([
            Paragraph(str(item.position), styles['table_cell']),
            Paragraph(item.article_number or '', styles['table_cell']),
            Paragraph(desc, styles['table_cell']),
            Paragraph(f"{item.quantity or 1} {item.unit or 'Stk'}", styles['table_cell']),
            Paragraph(f"{item.final_price or item.list_price or 0:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.'), styles['table_cell']),
            Paragraph(f"{total:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.'), styles['table_cell']),
        ])
    
    # Tabelle erstellen
    pos_table = Table(table_data, colWidths=[1*cm, 2.5*cm, 7*cm, 2*cm, 2.25*cm, 2.25*cm])
    pos_table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#ff0099')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        
        # Body
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('ALIGN', (0,1), (0,-1), 'CENTER'),
        ('ALIGN', (3,1), (3,-1), 'CENTER'),
        ('ALIGN', (4,1), (5,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        
        # Grid
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f5f5f5')]),
        
        # Padding
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(pos_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # === SUMMEN ===
    net_total = order.calculate_total()
    tax_rate = order.tax_rate or Decimal('19.00')
    tax_amount = net_total * tax_rate / Decimal('100')
    gross_total = net_total + tax_amount
    
    sum_data = [
        ['', L['net_total'], f"{net_total:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.')],
        ['', f"{L['vat']} ({tax_rate}%):", f"{tax_amount:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.')],
        ['', L['gross_total'], f"{gross_total:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.')],
    ]
    
    sum_table = Table(sum_data, colWidths=[11*cm, 3*cm, 3*cm])
    sum_table.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('ALIGN', (2,0), (2,-1), 'RIGHT'),
        ('FONTNAME', (1,-1), (-1,-1), 'Helvetica-Bold'),
        ('LINEABOVE', (1,-1), (-1,-1), 1, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(sum_table)
    elements.append(Spacer(1, 1*cm))
    
    # === KONDITIONEN ===
    elements.append(Paragraph(L['conditions'], styles['heading']))
    
    cond_data = []
    if order.payment_term:
        cond_data.append([L['payment_terms'], order.payment_term.name])
    if order.delivery_term:
        cond_data.append([L['delivery_terms'], order.delivery_term.incoterm])
    if order.warranty_term:
        cond_data.append([L['warranty'], order.warranty_term.name])
    
    if cond_data:
        cond_table = Table(cond_data, colWidths=[4*cm, 13*cm])
        cond_table.setStyle(TableStyle([
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ]))
        elements.append(cond_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # === NOTIZEN ===
    if order.order_notes:
        elements.append(Paragraph("Hinweise:", styles['heading']))
        elements.append(Paragraph(order.order_notes.replace('\n', '<br/>'), styles['small']))
        elements.append(Spacer(1, 0.5*cm))
    
    # === GRUßFORMEL ===
    elements.append(Paragraph(L['order_thanks'], styles['normal']))
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph(L['regards'], styles['normal']))
    elements.append(Spacer(1, 1*cm))
    
    # Unterschrift: bevorzugt `sales_person`, sonst `confirmed_by`'s employee
    emp = None
    if getattr(order, 'sales_person', None) and hasattr(order.sales_person, 'employee') and order.sales_person.employee:
        emp = order.sales_person.employee
    elif order.confirmed_by and hasattr(order.confirmed_by, 'employee') and order.confirmed_by.employee:
        emp = order.confirmed_by.employee

    if emp:
        signature_name = f"{emp.first_name} {emp.last_name}"
        elements.append(Paragraph(signature_name, styles['bold']))
        if hasattr(emp, 'position') and emp.position:
            elements.append(Paragraph(emp.position, styles['small']))
        # If a signature image exists, include it
        try:
            if getattr(emp, 'signature_image', None):
                sig_path = os.path.join(settings.MEDIA_ROOT, emp.signature_image.name)
                if os.path.exists(sig_path):
                    img = Image(sig_path, width=6*cm, height=2*cm)
                    elements.append(img)
        except Exception:
            pass
    
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph(L['terms_note'], styles['tiny']))
    
    # PDF generieren
    doc.build(elements)
    
    # Speichern
    pdf_content = buffer.getvalue()
    buffer.close()
    
    # Determine storage path inside the order's folder so all docs are together
    from django.core.files.storage import default_storage
    year = timezone.now().year
    order_num = order.order_number or f'draft_{order.id}'
    filename = f"AB_{order.order_number or order_num}.pdf"
    filepath = f"customer_orders/{year}/{order_num}/{filename}"

    # Remove existing file to ensure overwrite behavior
    try:
        if default_storage.exists(filepath):
            default_storage.delete(filepath)
    except Exception:
        pass

    saved_path = default_storage.save(filepath, ContentFile(pdf_content))
    return saved_path


# =============================================================================
# Lieferschein PDF
# =============================================================================

def generate_delivery_note_pdf(delivery_note, language='DE'):
    """
    Generiert ein professionelles PDF für einen Lieferschein
    
    Args:
        delivery_note: DeliveryNote Objekt
        language: 'DE' oder 'EN'
    
    Returns:
        Relativer Pfad zur PDF-Datei
    """
    from django.core.files.base import ContentFile
    
    buffer = BytesIO()
    company = CompanySettings.get_settings()
    styles = get_document_styles()
    L = get_labels(language)
    order = delivery_note.order
    
    # Dokument erstellen
    doc = OrderDocumentTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.5*cm,
        bottomMargin=3.5*cm,
        leftMargin=2*cm,
        rightMargin=2*cm,
        company=company,
        document=delivery_note,
        document_type='delivery_note'
    )
    
    elements = []
    
    # === EINZEILIGE FIRMENADRESSE ===
    company_line = f"{company.company_name} • {company.street} {company.house_number or ''} • {company.postal_code} {company.city}"
    elements.append(Paragraph(company_line, styles['tiny']))
    elements.append(Spacer(1, 0.1*cm))
    
    # Trennlinie
    line_table = Table([['_' * 80]], colWidths=[17*cm])
    line_table.setStyle(TableStyle([
        ('TEXTCOLOR', (0,0), (-1,-1), colors.grey),
        ('FONTSIZE', (0,0), (-1,-1), 6),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3*cm))
    
    # === LIEFERADRESSE ===
    # Verwende Lieferadresse des Lieferscheins oder des Auftrags
    shipping_addr = delivery_note.shipping_address or order.shipping_address
    if shipping_addr:
        for line in shipping_addr.split('\n'):
            elements.append(Paragraph(line, styles['normal']))
    elif order.customer:
        customer = order.customer
        for line in get_customer_address_lines(customer):
            elements.append(Paragraph(line, styles['normal']))
    elements.append(Spacer(1, 1*cm))
    
    # === DOKUMENTTITEL UND METADATEN ===
    meta_data = []
    meta_data.append([L['delivery_note_number'], delivery_note.delivery_note_number])
    meta_data.append([L['order_number'], order.order_number or '---'])
    meta_data.append([L['date'], delivery_note.delivery_date.strftime('%d.%m.%Y') if getattr(delivery_note, 'delivery_date', None) else '---'])
    sd = getattr(delivery_note, 'shipping_date', None)
    if sd:
        meta_data.append([L['shipping_date'], sd.strftime('%d.%m.%Y')])
    if getattr(delivery_note, 'tracking_number', None):
        meta_data.append([L['tracking'], delivery_note.tracking_number])
    pkg = getattr(delivery_note, 'package_count', None)
    if pkg:
        meta_data.append([L['packages'], str(pkg)])
    
    title = Paragraph(L['delivery_note'], styles['title'])
    
    meta_table = Table(meta_data, colWidths=[4.5*cm, 3.5*cm])
    meta_table.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('ALIGN', (1,0), (1,-1), 'LEFT'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    
    header_table = Table([[title, meta_table]], colWidths=[9*cm, 8*cm])
    header_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(header_table)
    elements.append(Spacer(1, 1*cm))
    
    # === POSITIONSTABELLE ===
    from .models import CustomerOrderItem
    
    # Hole Positionen für diesen Lieferschein (verwende sequence_number, da
    # `CustomerOrderItem.delivery_note_number` ein Integer-Feld ist)
    items = CustomerOrderItem.objects.filter(
        order=order,
        delivery_note_number=delivery_note.sequence_number
    ).order_by('position')
    
    table_header = [
        Paragraph(L['position'], styles['table_header']),
        Paragraph(L['article'], styles['table_header']),
        Paragraph(L['description'], styles['table_header']),
        Paragraph(L['quantity'], styles['table_header']),
        Paragraph(L['serial'], styles['table_header']),
    ]
    
    table_data = [table_header]
    
    for item in items:
        desc = item.name or ''
        if item.description:
            desc += f"<br/><font size='7' color='grey'>{item.description[:80]}{'...' if len(item.description) > 80 else ''}</font>"
        
        table_data.append([
            Paragraph(str(item.position), styles['table_cell']),
            Paragraph(item.article_number or '', styles['table_cell']),
            Paragraph(desc, styles['table_cell']),
            Paragraph(f"{item.quantity or 1} {item.unit or 'Stk'}", styles['table_cell']),
            Paragraph(item.serial_number or '-', styles['table_cell']),
        ])
    
    pos_table = Table(table_data, colWidths=[1*cm, 2.5*cm, 8*cm, 2.5*cm, 3*cm])
    pos_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#ff0099')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('ALIGN', (0,1), (0,-1), 'CENTER'),
        ('ALIGN', (3,1), (3,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(pos_table)
    elements.append(Spacer(1, 1*cm))
    
    # === NOTIZEN ===
    if delivery_note.notes:
        elements.append(Paragraph("Hinweise:", styles['heading']))
        elements.append(Paragraph(delivery_note.notes.replace('\n', '<br/>'), styles['small']))
        elements.append(Spacer(1, 0.5*cm))
    
    # === HINWEIS ===
    elements.append(Paragraph(L['delivery_thanks'], styles['normal']))
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(L['regards'], styles['normal']))
    
    # PDF generieren
    doc.build(elements)
    
    pdf_content = buffer.getvalue()
    buffer.close()
    
    # Speichere im Auftragsordner mit fester Dateiname (überschreibt bei erneutem Generieren)
    order_num = order.order_number or f'draft_{order.id}'
    year = timezone.now().year
    filename = f"LS_{delivery_note.delivery_note_number}.pdf"
    filepath = f"customer_orders/{year}/{order_num}/{filename}"
    
    from django.core.files.storage import default_storage
    # Lösche existierende Datei falls vorhanden
    if default_storage.exists(filepath):
        default_storage.delete(filepath)
    saved_path = default_storage.save(filepath, ContentFile(pdf_content))
    
    return saved_path


# =============================================================================
# Rechnung PDF
# =============================================================================

def generate_invoice_pdf(invoice, language='DE'):
    """
    Generiert ein professionelles PDF für eine Rechnung
    
    Args:
        invoice: Invoice Objekt
        language: 'DE' oder 'EN'
    
    Returns:
        Relativer Pfad zur PDF-Datei
    """
    from django.core.files.base import ContentFile
    
    buffer = BytesIO()
    company = CompanySettings.get_settings()
    styles = get_document_styles()
    L = get_labels(language)
    order = invoice.order
    
    # Dokument erstellen
    doc = OrderDocumentTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.5*cm,
        bottomMargin=3.5*cm,
        leftMargin=2*cm,
        rightMargin=2*cm,
        company=company,
        document=invoice,
        document_type='invoice'
    )
    
    elements = []
    
    # === EINZEILIGE FIRMENADRESSE ===
    company_line = f"{company.company_name} • {company.street} {company.house_number or ''} • {company.postal_code} {company.city}"
    elements.append(Paragraph(company_line, styles['tiny']))
    elements.append(Spacer(1, 0.1*cm))
    
    # Trennlinie
    line_table = Table([['_' * 80]], colWidths=[17*cm])
    line_table.setStyle(TableStyle([
        ('TEXTCOLOR', (0,0), (-1,-1), colors.grey),
        ('FONTSIZE', (0,0), (-1,-1), 6),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3*cm))
    
    # === RECHNUNGSADRESSE ===
    billing_addr = invoice.billing_address or order.billing_address
    if billing_addr:
        for line in billing_addr.split('\n'):
            elements.append(Paragraph(line, styles['normal']))
    elif order.customer:
        customer = order.customer
        for line in get_customer_address_lines(customer):
            elements.append(Paragraph(line, styles['normal']))
    elements.append(Spacer(1, 1*cm))
    
    # === DOKUMENTTITEL UND METADATEN ===
    meta_data = []
    meta_data.append([L['invoice_number'], invoice.invoice_number])
    meta_data.append([L['order_number'], order.order_number or '---'])
    meta_data.append([L['invoice_date'], invoice.invoice_date.strftime('%d.%m.%Y') if invoice.invoice_date else '---'])
    meta_data.append([L['due_date'], invoice.due_date.strftime('%d.%m.%Y') if invoice.due_date else '---'])
    if getattr(order, 'customer_vat_id', None):
        meta_data.append([L['vat_id'], order.customer_vat_id])
    
    title = Paragraph(L['invoice'], styles['title'])
    
    meta_table = Table(meta_data, colWidths=[4*cm, 4*cm])
    meta_table.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('ALIGN', (1,0), (1,-1), 'LEFT'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    
    header_table = Table([[title, meta_table]], colWidths=[9*cm, 8*cm])
    header_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(header_table)
    elements.append(Spacer(1, 1*cm))
    
    # === POSITIONSTABELLE ===
    from .models import CustomerOrderItem
    
    # Hole Positionen für diese Rechnung (verwende sequence_number, da
    # `CustomerOrderItem.invoice_number` ein Integer-Feld ist)
    items = CustomerOrderItem.objects.filter(
        order=order,
        invoice_number=invoice.sequence_number
    ).order_by('position')
    
    table_header = [
        Paragraph(L['position'], styles['table_header']),
        Paragraph(L['article'], styles['table_header']),
        Paragraph(L['description'], styles['table_header']),
        Paragraph(L['quantity'], styles['table_header']),
        Paragraph(L['unit_price'], styles['table_header']),
        Paragraph(L['total'], styles['table_header']),
    ]
    
    table_data = [table_header]
    
    for item in items:
        desc = item.name or ''
        if item.description:
            desc += f"<br/><font size='7' color='grey'>{item.description[:80]}{'...' if len(item.description) > 80 else ''}</font>"
        
        total = (item.final_price or item.list_price or 0) * (item.quantity or 1)
        
        table_data.append([
            Paragraph(str(item.position), styles['table_cell']),
            Paragraph(item.article_number or '', styles['table_cell']),
            Paragraph(desc, styles['table_cell']),
            Paragraph(f"{item.quantity or 1} {item.unit or 'Stk'}", styles['table_cell']),
            Paragraph(f"{item.final_price or item.list_price or 0:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.'), styles['table_cell']),
            Paragraph(f"{total:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.'), styles['table_cell']),
        ])
    
    pos_table = Table(table_data, colWidths=[1*cm, 2.5*cm, 7*cm, 2*cm, 2.25*cm, 2.25*cm])
    pos_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#ff0099')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('ALIGN', (0,1), (0,-1), 'CENTER'),
        ('ALIGN', (3,1), (3,-1), 'CENTER'),
        ('ALIGN', (4,1), (5,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(pos_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # === SUMMEN ===
    net = invoice.net_amount or Decimal('0')
    tax = invoice.tax_amount or Decimal('0')
    gross = invoice.gross_amount or (net + tax)
    
    sum_data = [
        ['', L['net_total'], f"{net:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.')],
        ['', L['vat'], f"{tax:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.')],
        ['', L['gross_total'], f"{gross:,.2f} €".replace(',', 'X').replace('.', ',').replace('X', '.')],
    ]
    
    sum_table = Table(sum_data, colWidths=[11*cm, 3*cm, 3*cm])
    sum_table.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('ALIGN', (2,0), (2,-1), 'RIGHT'),
        ('FONTNAME', (1,-1), (-1,-1), 'Helvetica-Bold'),
        ('LINEABOVE', (1,-1), (-1,-1), 1, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(sum_table)
    elements.append(Spacer(1, 1*cm))
    
    # === ZAHLUNGSHINWEIS ===
    elements.append(Paragraph(L['invoice_thanks'], styles['normal']))
    elements.append(Spacer(1, 0.3*cm))
    
    # Bankdaten
    if company:
        bank_info = f"<b>Bank:</b> {company.bank_name or ''}<br/>"
        bank_info += f"<b>IBAN:</b> {company.iban or ''}<br/>"
        bank_info += f"<b>BIC:</b> {company.bic or ''}<br/>"
        bank_info += f"<b>Verwendungszweck:</b> {invoice.invoice_number}"
        elements.append(Paragraph(bank_info, styles['small']))
    
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(L['regards'], styles['normal']))
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph(L['terms_note'], styles['tiny']))
    
    # PDF generieren
    doc.build(elements)
    
    pdf_content = buffer.getvalue()
    buffer.close()
    
    # Speichere im Auftragsordner mit fester Dateiname (überschreibt bei erneutem Generieren)
    order_num = order.order_number or f'draft_{order.id}'
    year = timezone.now().year
    filename = f"RE_{invoice.invoice_number}.pdf"
    filepath = f"customer_orders/{year}/{order_num}/{filename}"
    
    from django.core.files.storage import default_storage
    # Lösche existierende Datei falls vorhanden
    if default_storage.exists(filepath):
        default_storage.delete(filepath)
    saved_path = default_storage.save(filepath, ContentFile(pdf_content))
    
    return saved_path
