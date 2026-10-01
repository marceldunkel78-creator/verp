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
from core.pdf_base import (
    CONTENT_W,
    FONT_BOLD,
    VerpDocTemplate,
    build_address_and_doc_row,
    build_document_box,
    build_positions_table,
    build_totals_table,
    format_amount,
    get_company_styles,
)
from django.conf import settings
from django.utils import timezone
import os


# =============================================================================
# Helper Functions for Customer Data
# =============================================================================

def _escape(text):
    """
    Maskiert Sonderzeichen fuer ReportLabs Mini-XML.

    Artikelbeschreibungen kommen aus dem Produktstamm und enthalten
    haeufig &, < oder >. Ohne Maskierung bricht der Absatz.
    """
    if not text:
        return ''
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;'))


def _clip(text, max_chars):
    """Kuerzt einen Text auf max_chars und haengt ein Auslassungszeichen an."""
    if not text:
        return ''
    text = str(text)
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + '...'


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


def _wrap_text(text, max_length=35):
    """
    Wrap text at word boundaries to fit within max_length characters.
    Used for address fields to prevent overly long lines.
    """
    if not text or len(text) <= max_length:
        return [text]
    
    words = text.split()
    lines = []
    current_line = ""
    
    for word in words:
        # If adding this word would exceed max_length
        if len(current_line) + len(word) + 1 > max_length:  # +1 for space
            if current_line:
                lines.append(current_line.rstrip())
                current_line = word
            else:
                # Word itself is longer than max_length, force break
                lines.append(word[:max_length])
                current_line = word[max_length:]
        else:
            if current_line:
                current_line += " " + word
            else:
                current_line = word
    
    if current_line:
        lines.append(current_line.rstrip())
    
    return lines


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


class OrderDocumentTemplate(VerpDocTemplate):
    """
    Basis DocTemplate für alle Auftragsdokumente.

    Briefkopf, Fusszeile, Rand und Schriftgroessen kommen aus
    core.pdf_base und entsprechen damit der Corporate-Design-Vorlage.
    Nur die Dokumentart bestimmt den Fortsetzungstext auf Folgeseiten.
    """
    DOCUMENT_LABELS = {
        'order': ('Auftragsbestätigung', 'order_number', 'confirmation_date'),
        'delivery_note': ('Lieferschein', 'delivery_note_number', 'delivery_date'),
        'invoice': ('Rechnung', 'invoice_number', 'invoice_date'),
    }

    def __init__(self, filename, company=None, document=None,
                 document_type='order', **kwargs):
        self.document = document
        self.document_type = document_type

        label, number_field, date_field = self.DOCUMENT_LABELS.get(
            document_type, ('Dokument', 'id', None))
        doc_number = getattr(document, number_field, None) or '---'
        doc_date = getattr(document, date_field, None) if date_field else None
        continuation = f'{label} {doc_number}'
        if doc_date:
            continuation += f' vom {doc_date.strftime("%d.%m.%Y")}'

        kwargs.setdefault('title', label)
        VerpDocTemplate.__init__(
            self, filename, company=company,
            continuation_text=continuation, **kwargs)


# =============================================================================
# Style Definitions
# =============================================================================

def get_document_styles():
    """
    Styles im Corporate Design.

    Thin wrapper um core.pdf_base, damit die Aufrufer in diesem Modul
    weiterhin ueber get_document_styles() arbeiten koennen.
    """
    vs = get_company_styles()
    return {
        'title': vs['VerpTitle'],
        'heading': vs['VerpHeading'],
        'normal': vs['VerpBody'],
        'small': vs['VerpSmall'],
        'tiny': vs['VerpTiny'],
        'right': vs['VerpTableCellRight'],
        'bold': vs['VerpBodyBold'],
        'justified': vs['VerpJustified'],
        'clause': vs['VerpClause'],
        'table_header': vs['VerpTableHead'],
        'table_cell': vs['VerpTableCell'],
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
        company=company,
        document=order,
        document_type='order'
    )
    
    elements = []
    customer = order.customer
    address_lines = get_customer_address_lines(customer)
    
    # === DOKUMENTBOX (rechts) wie in der Vorlage ===
    doc_box_lines = [
        (L['order_confirmation'], True),
        (order.order_number or '---', False),
    ]
    if order.quotation:
        ref = getattr(order.quotation, 'quotation_number', None) or str(order.quotation.id)
        doc_box_lines.append((
            f"{'Angebot' if language == 'DE' else 'Quotation'} {ref}", False))
    if order.customer_document:
        doc_box_lines.append((
            f"{'Bestellnummer' if language == 'DE' else 'PO'} {order.customer_document}",
            False))
    if order.customer_order_number:
        doc_box_lines.append((f"{L['customer_order']} {order.customer_order_number}", False))
    if order.delivery_date:
        doc_box_lines.append((
            f"{L['delivery_date']} {order.delivery_date.strftime('%d.%m.%Y')}", False))
    
    conf_date = (order.confirmation_date or order.order_date
                 or timezone.now().date())
    
    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=conf_date.strftime('%d.%m.%Y'),
        language=language,
    ))
    elements.append(Spacer(1, 0.4*cm))
    
    elements.append(Paragraph(L['order_confirmation'], styles['title']))
    elements.append(Spacer(1, 0.3*cm))
    
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
    headers = [
        L['position'], L['article'], L['description'],
        L['quantity'], L['unit_price'], L['total'],
    ]
    
    rows = []
    for item in order.items.all().order_by('position'):
        name = item.name or ''
        total = (item.final_price or item.list_price or 0) * (item.quantity or 1)
        rows.append([
            Paragraph(str(item.position), styles['table_cell']),
            Paragraph(item.article_number or '', styles['table_cell']),
            Paragraph(_escape(name), styles['table_cell']),
            Paragraph(f"{item.quantity or 1} {item.unit or 'Stk'}", styles['table_cell']),
            Paragraph(format_amount(item.final_price or item.list_price), styles['table_cell']),
            Paragraph(format_amount(total), styles['table_cell']),
        ])
        # Beschreibung als eigene Zeile unter der Bezeichnung
        if item.description:
            rows.append([
                '', '',
                Paragraph(_escape(_clip(item.description, 400)), styles['small']),
                '', '', '',
            ])
    
    col_widths = [1.0*cm, 2.2*cm, 5.4*cm, 1.5*cm, 2.4*cm, 2.5*cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[4, 5]))
    elements.append(Spacer(1, 0.5*cm))
    
    # === SUMMEN ===
    net_total = order.calculate_total()
    tax_rate = order.tax_rate or Decimal('19.00')
    tax_amount = net_total * tax_rate / Decimal('100')
    gross_total = net_total + tax_amount
    
    elements.append(build_totals_table([
        (L['net_total'], format_amount(net_total)),
        (L['vat'], format_amount(tax_amount)),
        (L['gross_total'], format_amount(gross_total)),
    ]))
    elements.append(Spacer(1, 1*cm))
    
    # === KONDITIONEN ===
    elements.append(Paragraph(L['conditions'], styles['heading']))
    elements.append(Spacer(1, 0.2*cm))
    
    cond_data = []
    if order.payment_term:
        cond_data.append([L['payment_terms'], order.payment_term.name])
    if order.delivery_term:
        cond_data.append([L['delivery_terms'], order.delivery_term.incoterm])
    if order.warranty_term:
        cond_data.append([L['warranty'], order.warranty_term.name])
    
    if cond_data:
        cond_table = Table(cond_data, colWidths=[4*cm, 10*cm])
        cond_table.setStyle(TableStyle([
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('FONTNAME', (0,0), (0,-1), FONT_BOLD),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ]))
        elements.append(cond_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # === NOTIZEN ===
    if order.order_notes:
        elements.append(Paragraph(
            "Hinweise:" if language == 'DE' else "Notes:", styles['heading']))
        elements.append(Spacer(1, 0.2*cm))
        elements.append(Paragraph(
            _escape(order.order_notes).replace('\n', '<br/>'), styles['small']))
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
        company=company,
        document=delivery_note,
        document_type='delivery_note'
    )
    
    elements = []
    order = delivery_note.order
    
    # === LIEFERADRESSE ===
    # Verwende Lieferadresse des Lieferscheins oder des Auftrags
    shipping_addr = delivery_note.shipping_address or order.shipping_address
    if shipping_addr:
        address_lines = [l for l in shipping_addr.split('\n') if l.strip()]
    else:
        address_lines = get_customer_address_lines(order.customer)
    
    # === DOKUMENTBOX (rechts) wie in der Vorlage ===
    doc_box_lines = [
        (L['delivery_note'], True),
        (delivery_note.delivery_note_number, False),
        (f"{L['order_number']} {order.order_number or '---'}", False),
    ]
    if order.quotation:
        ref = getattr(order.quotation, 'quotation_number', None) or str(order.quotation.id)
        doc_box_lines.append((
            f"{'Angebot' if language == 'DE' else 'Quotation'} {ref}", False))
    if order.customer_document:
        doc_box_lines.append((
            f"{'Bestellnummer' if language == 'DE' else 'PO'} {order.customer_document}",
            False))
    sd = getattr(delivery_note, 'shipping_date', None)
    if sd:
        doc_box_lines.append((f"{L['shipping_date']} {sd.strftime('%d.%m.%Y')}", False))
    if getattr(delivery_note, 'tracking_number', None):
        doc_box_lines.append((f"{L['tracking']} {delivery_note.tracking_number}", False))
    pkg = getattr(delivery_note, 'package_count', None)
    if pkg:
        doc_box_lines.append((f"{L['packages']} {pkg}", False))
    
    dn_date = getattr(delivery_note, 'delivery_date', None)
    
    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=dn_date.strftime('%d.%m.%Y') if dn_date else '',
        language=language,
    ))
    elements.append(Spacer(1, 0.4*cm))
    
    elements.append(Paragraph(L['delivery_note'], styles['title']))
    elements.append(Spacer(1, 0.3*cm))
    
    # === POSITIONSTABELLE ===
    from .models import CustomerOrderItem
    
    # Hole Positionen für diesen Lieferschein (verwende sequence_number, da
    # `CustomerOrderItem.delivery_note_number` ein Integer-Feld ist)
    items = CustomerOrderItem.objects.filter(
        order=order,
        delivery_note_number=delivery_note.sequence_number
    ).order_by('position')
    
    headers = [
        L['position'], L['article'], L['description'],
        L['quantity'], L['serial'],
    ]
    
    rows = []
    for item in items:
        rows.append([
            Paragraph(str(item.position), styles['table_cell']),
            Paragraph(item.article_number or '', styles['table_cell']),
            Paragraph(_escape(item.name or ''), styles['table_cell']),
            Paragraph(f"{item.quantity or 1} {item.unit or 'Stk'}", styles['table_cell']),
            Paragraph(item.serial_number or '-', styles['table_cell']),
        ])
        if item.description:
            rows.append([
                '', '',
                Paragraph(_escape(_clip(item.description, 300)), styles['small']),
                '', '',
            ])
    
    col_widths = [1.0*cm, 2.2*cm, 6.4*cm, 1.8*cm, 4.6*cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[]))
    elements.append(Spacer(1, 1*cm))
    
    # === NOTIZEN ===
    if delivery_note.notes:
        elements.append(Paragraph(
            "Hinweise:" if language == 'DE' else "Notes:", styles['heading']))
        elements.append(Spacer(1, 0.2*cm))
        elements.append(Paragraph(
            _escape(delivery_note.notes).replace('\n', '<br/>'), styles['small']))
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
        company=company,
        document=invoice,
        document_type='invoice'
    )
    
    elements = []
    order = invoice.order
    
    # === RECHNUNGSADRESSE ===
    billing_addr = invoice.billing_address or order.billing_address
    if billing_addr:
        address_lines = [l for l in billing_addr.split('\n') if l.strip()]
    else:
        address_lines = get_customer_address_lines(order.customer)
    
    # === DOKUMENTBOX (rechts) wie in der Vorlage ===
    doc_box_lines = [
        (L['invoice'], True),
        (invoice.invoice_number, False),
        (f"{L['order_number']} {order.order_number or '---'}", False),
    ]
    if order.quotation:
        ref = getattr(order.quotation, 'quotation_number', None) or str(order.quotation.id)
        doc_box_lines.append((
            f"{'Angebot' if language == 'DE' else 'Quotation'} {ref}", False))
    if order.customer_document:
        doc_box_lines.append((
            f"{'Bestellnummer' if language == 'DE' else 'PO'} {order.customer_document}",
            False))
    if invoice.due_date:
        doc_box_lines.append(
            (f"{L['due_date']} {invoice.due_date.strftime('%d.%m.%Y')}", False))
    if getattr(order, 'customer_vat_id', None):
        doc_box_lines.append((f"{L['vat_id']} {order.customer_vat_id}", False))
    
    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=invoice.invoice_date.strftime('%d.%m.%Y') if invoice.invoice_date else '',
        language=language,
    ))
    elements.append(Spacer(1, 0.4*cm))
    
    elements.append(Paragraph(L['invoice'], styles['title']))
    elements.append(Spacer(1, 0.3*cm))
    
    # === POSITIONSTABELLE ===
    from .models import CustomerOrderItem
    
    # Hole Positionen für diese Rechnung (verwende sequence_number, da
    # `CustomerOrderItem.invoice_number` ein Integer-Feld ist)
    items = CustomerOrderItem.objects.filter(
        order=order,
        invoice_number=invoice.sequence_number
    ).order_by('position')
    
    headers = [
        L['position'], L['article'], L['description'],
        L['quantity'], L['unit_price'], L['total'],
    ]
    
    rows = []
    for item in items:
        total = (item.final_price or item.list_price or 0) * (item.quantity or 1)
        rows.append([
            Paragraph(str(item.position), styles['table_cell']),
            Paragraph(item.article_number or '', styles['table_cell']),
            Paragraph(_escape(item.name or ''), styles['table_cell']),
            Paragraph(f"{item.quantity or 1} {item.unit or 'Stk'}", styles['table_cell']),
            Paragraph(format_amount(item.final_price or item.list_price), styles['table_cell']),
            Paragraph(format_amount(total), styles['table_cell']),
        ])
        if item.description:
            rows.append([
                '', '',
                Paragraph(_escape(_clip(item.description, 300)), styles['small']),
                '', '', '',
            ])
    
    col_widths = [1.0*cm, 2.2*cm, 5.4*cm, 1.5*cm, 2.4*cm, 2.5*cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[4, 5]))
    elements.append(Spacer(1, 0.5*cm))
    
    # === SUMMEN ===
    net = invoice.net_amount or Decimal('0')
    tax = invoice.tax_amount or Decimal('0')
    gross = invoice.gross_amount or (net + tax)
    
    elements.append(build_totals_table([
        (L['net_total'], format_amount(net)),
        (L['vat'], format_amount(tax)),
        (L['gross_total'], format_amount(gross)),
    ]))
    elements.append(Spacer(1, 1*cm))
    
    # === ZAHLUNGSHINWEIS ===
    elements.append(Paragraph(L['invoice_thanks'], styles['normal']))
    elements.append(Spacer(1, 0.3*cm))
    
    # Bankdaten
    if company:
        bank_info = f"<b>{'Bank' if language == 'DE' else 'Bank'}:</b> {company.bank_name or ''}<br/>"
        bank_info += f"<b>IBAN:</b> {company.iban or ''}<br/>"
        bank_info += f"<b>BIC:</b> {company.bic or ''}<br/>"
        bank_info += (f"<b>{'Verwendungszweck' if language == 'DE' else 'Reference'}:</b> "
                      f"{invoice.invoice_number}")
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
