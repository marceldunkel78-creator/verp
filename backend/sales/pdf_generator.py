"""
PDF Generator für Angebote

Layout folgt 1:1 der Vorlage Datenvorlagen/Q-373Du-0826.pdf:
- Briefkopf mit Logo und Unterzeile, Trennlinie darunter
- Empfängerblock links, Dokumentbox rechts (unten ausgerichtet)
- Datum darunter rechts
- Positionstabelle in vier-spaltiger Aufteilung, schwarz/weiß
- Fußzeile mit vier Spalten (Firma, Kontakt, Register, Bank) auf jeder Seite
- Grußformel mit Unterschrift

Briefkopf, Empfängerblock und Fußzeile kommen aus core.pdf_base.
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
    FONT_REGULAR,
    VerpDocTemplate,
    build_address_and_doc_row,
    build_document_box,
    build_totals_table,
    get_company_styles,
)
from django.conf import settings
import os


def _split_description(text, max_chars=260):
    """
    Teilt eine Beschreibung an Wortgrenzen in Blöcke von hoechstens
    max_chars Zeichen.

    Noetig, weil eine einzelne Tabellenzelle nicht hoeher als der Rahmen
    werden darf - sonst schlaegt der Seitenumbruch fehl. Die Blöcke
    werden hintereinander in der Bezeichnungsspalte ausgegeben, sehen
    also wie ein fortlaufender Text aus.
    """
    if not text:
        return []
    words = text.split()
    chunks = []
    current = ''
    for word in words:
        candidate = f'{current} {word}'.strip()
        if len(candidate) > max_chars and current:
            chunks.append(current)
            current = word
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def _product_display_name(product, lang='DE'):
    """Return a sensible display name for various product-like objects.
    Supports objects with `name`, `name_en`, `title`, `title_en`, or falls
    back to str(product).
    """
    if not product:
        return '-'

    # Prefer `name` fields
    name = getattr(product, 'name', None)
    name_en = getattr(product, 'name_en', None)
    if lang == 'EN' and name_en:
        return name_en
    if name:
        return name

    # Fallback to `title` (ProductCollection uses `title`)
    title = getattr(product, 'title', None)
    title_en = getattr(product, 'title_en', None)
    if lang == 'EN' and title_en:
        return title_en
    if title:
        return title

    # Last resort
    try:
        return str(product)
    except Exception:
        return '-'


def _product_description_snippet(product, lang='DE', length=150):
    if not product:
        return ''
    if lang == 'EN':
        desc = getattr(product, 'short_description_en', None) or getattr(product, 'description_en', None) or getattr(product, 'short_description', None) or getattr(product, 'description', None) or ''
    else:
        desc = getattr(product, 'short_description', None) or getattr(product, 'description', None) or ''
    return (desc[:length] + ('...' if len(desc) > length else '')) if desc else ''


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


class QuotationDocTemplate(VerpDocTemplate):
    """
    Angebot im Visitron-Standard-Layout.

    Briefkopf, Empfängerblock und Fußzeile kommen aus core.pdf_base;
    hier wird nur die Kopfzeile auf Folgeseiten festgelegt.
    """
    def __init__(self, filename, company=None, quotation=None, **kwargs):
        self.quotation = quotation
        continuation = ''
        if quotation is not None:
            try:
                d = quotation.date.strftime('%d.%m.%Y')
                continuation = f'Angebot {quotation.quotation_number} vom {d}'
            except Exception:
                continuation = ''
        kwargs.setdefault('continuation_text', continuation)
        super().__init__(filename, company=company, **kwargs)


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
        company=company,
        quotation=quotation,
        title=f"Angebot {quotation.quotation_number}",
        author=company.company_name if company else 'Visitron Systems GmbH',
    )
    
    # Elemente für das PDF
    elements = []
    styles = getSampleStyleSheet()
    
    # Eigene Styles
    # Styles aus dem Vorlagen-Layout (core.pdf_base)
    vs = get_company_styles()
    normal_style = vs['VerpBody']
    small_style = vs['VerpSmall']
    tiny_style = vs['VerpTiny']
    heading_style = vs['VerpHeading']
    
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
    
    # === KUNDENADRESSE ===
    recipient_lines = []
    if quotation.recipient_company:
        # Wrap long company names to prevent overly wide address lines
        company_lines = _wrap_text(quotation.recipient_company, max_length=35)
        recipient_lines.extend(company_lines)
    
    # Name mit Anrede und Titel
    name_parts = []
    if quotation.recipient_salutation:
        name_parts.append(quotation.recipient_salutation)
    if quotation.recipient_title:
        name_parts.append(quotation.recipient_title)
    if quotation.recipient_name:
        name_parts.append(quotation.recipient_name)
    
    if name_parts:
        recipient_lines.append(' '.join(name_parts))
    
    if quotation.recipient_street:
        recipient_lines.append(quotation.recipient_street)
    if quotation.recipient_postal_code or quotation.recipient_city:
        city_line = f"{quotation.recipient_postal_code} {quotation.recipient_city}".strip()
        recipient_lines.append(city_line)
    if quotation.recipient_country and quotation.recipient_country != 'DE':
        recipient_lines.append(quotation.recipient_country)
    
    # === DOKUMENTBOX (rechts) wie in der Vorlage ===
    # Das Datum steht NICHT in der Box, sondern in der Datumzeile darunter -
    # sonst stuende es doppelt.
    doc_box_lines = [
        (L['quotation'], True),
        (quotation.quotation_number, False),
    ]
    if quotation.reference:
        doc_box_lines.append((f"{L['reference']} {quotation.reference}", False))
    if quotation.valid_until:
        doc_box_lines.append(
            (f"{L['valid_until']} {quotation.valid_until.strftime('%d.%m.%Y')}", False))
    
    date_value = quotation.date.strftime('%d.%m.%Y')
    author_suffix = ''
    if quotation.created_by:
        author_suffix = ' / ' + (quotation.created_by.username or '')
    
    elements.append(build_address_and_doc_row(
        recipient_lines, build_document_box(doc_box_lines), company,
        date_text=date_value + author_suffix,
    ))
    elements.append(Spacer(1, 0.5 * cm))
    
    # === TITEL ===
    elements.append(Paragraph(f"<b>{L['quotation']}</b>", vs['VerpTitle']))
    
    # === ANREDE ===
    salutation_text = ""
    # Verwende die Empfängeradresse für die Anrede
    recipient_salutation = getattr(quotation, 'recipient_salutation', '') or ''
    recipient_title = getattr(quotation, 'recipient_title', '') or ''
    recipient_name = getattr(quotation, 'recipient_name', '') or ''
    
    parts = [L['dear']]
    if recipient_salutation:
        parts.append(recipient_salutation)
    if recipient_title:
        parts.append(recipient_title)
    if recipient_name:
        parts.append(recipient_name)
    
    if len(parts) > 1:  # Nur wenn mehr als nur "Sehr geehrte(r)" vorhanden ist
        salutation_text = ' '.join(parts) + ','
    else:
        # Fallback wenn keine Empfängeradresse vorhanden ist
        salutation_text = L['dear'] + ' Damen und Herren,'
    
    if salutation_text:
        elements.append(Paragraph(salutation_text, normal_style))
        elements.append(Spacer(1, 0.3*cm))
    
    # === ANGEBOTSBESCHREIBUNG ===
    description_text = getattr(quotation, 'description_text', '') or ''
    if description_text:
        elements.append(Paragraph(description_text, normal_style))
        elements.append(Spacer(1, 0.5*cm))
    
    # === POSITIONEN TABELLE ===
    # Zwei-Zeilen-Layout: Zeile 1 = Position-Daten, Zeile 2 = Beschreibung (volle Breite)
    position_labels = {
        'DE': ['Pos.', 'Art.-Nr.', 'Artikel', 'Menge', 'Einzelpreis', 'Rabatt', 'Gesamt'],
        'EN': ['Pos.', 'Art. No.', 'Article', 'Qty', 'Unit Price', 'Discount', 'Total']
    }
    
    table_data = [position_labels[lang]]
    description_rows = []  # Track which rows are description rows for styling
    row_index = 1  # Start after header
    
    # Positionen hinzufügen
    for item in quotation.items.all().order_by('position'):
        # Artikelnummer
        article_number = item.item_article_number or ''
        if not article_number and item.item:
            # Include collection_number for ProductCollection objects
            article_number = (
                getattr(item.item, 'visitron_part_number', '')
                or getattr(item.item, 'supplier_part_number', '')
                or getattr(item.item, 'part_number', '')
                or getattr(item.item, 'article_number', '')
                or getattr(item.item, 'collection_number', '')
                or ''
            )
        
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
            item_name = prefix + (_product_display_name(item.item, lang) if item.item else '-')

            # Beschreibung - bevorzuge custom_description
            if item.custom_description:
                description = item.custom_description
            elif item.item:
                description = _product_description_snippet(item.item, lang, length=500)
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
            item_name = _product_display_name(item.item, lang) if item.item else '-'

            # Beschreibung - bevorzuge custom_description
            if item.custom_description:
                description = item.custom_description
            elif item.item:
                description = _product_description_snippet(item.item, lang, length=500)
            else:
                description = ''

            quantity_str = f"{item.quantity:.2f}"

            if item.uses_system_price and quotation.system_price:
                unit_price_str = "Systempreis"
                discount_str = "-"
                subtotal_str = "Systempreis"
            else:
                unit_price_str = f"€ {item.unit_price:,.2f}"
                discount_str = f"{item.discount_percent:.1f}%" if item.discount_percent > 0 else '-'
                subtotal_str = f"€ {item.subtotal:,.2f}"
        
        # Bezeichnung: Name fett, Beschreibung darunter eingerückt.
        # In der Vorlage stehen die Details als Aufzaehlung unter der
        # Bezeichnung in derselben Spalte.
        name_cell = Paragraph(f"<b>{item_name}</b>", normal_style)
        
        table_data.append([
            position_str,
            article_number[:20] if article_number else '',
            name_cell,
            quantity_str,
            unit_price_str,
            discount_str,
            subtotal_str
        ])
        row_index += 1
        
        # Lange Beschreibungen auf mehrere Zeilen aufteilen.
        # Eine einzelne Zelle darf nicht hoger als der Rahmen werden,
        # sonst bricht der Seitenumbruch ("too large on page") ab.
        if description:
            for chunk in _split_description(description, max_chars=260):
                table_data.append([
                    '', '', Paragraph(chunk, small_style), '', '', '', ''
                ])
                description_rows.append(row_index)
                row_index += 1
    
    # Tabelle erstellen - 7 Spalten ohne Beschreibungsspalte.
    # Spaltenbreiten summieren sich auf die Inhaltsbreite (17,4 cm).
    col_widths = [1.0 * cm, 2.0 * cm, 5.5 * cm, 1.4 * cm, 2.2 * cm, 1.4 * cm, 2.5 * cm]
    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    # Basis-Style im Vorlagen-Look: schwarz/weiß, feine Linien,
    # keine Akzentfarbe, keine Zebrastreifen.
    table_style = [
        # Kopfzeile: weiss, 9 pt, zentriert, feine Linie darunter
        ('BACKGROUND', (0, 0), (-1, 0), colors.white),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), FONT_REGULAR),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('LEADING', (0, 0), (-1, 0), 11),
        ('VALIGN', (0, 0), (-1, 0), 'BOTTOM'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
        ('TOPPADDING', (0, 0), (-1, 0), 4),
        ('LINEBELOW', (0, 0), (-1, 0), 0.375, colors.black),
        ('LINEABOVE', (0, 0), (-1, 0), 0.375, colors.black),
        
        # Daten
        ('FONTNAME', (0, 1), (-1, -1), FONT_REGULAR),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (3, 1), (4, -1), 'RIGHT'),
        ('ALIGN', (5, 1), (5, -1), 'CENTER'),
        ('ALIGN', (6, 1), (6, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEADING', (0, 1), (-1, -1), 11.5),
        
        # Nur senkrechte Spaltenlinien, wie in der Vorlage
        ('LINEBEFORE', (0, 0), (-1, -1), 0.375, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 0.375, colors.black),
        
        # Padding
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ]
    
    # Beschreibungszeilen: nur die Bezeichnungsspalte nutzen
    for desc_row in description_rows:
        table_style.append(('SPAN', (2, desc_row), (2, desc_row)))
        table_style.append(('LEFTPADDING', (2, desc_row), (2, desc_row), 8))
        table_style.append(('TOPPADDING', (2, desc_row), (2, desc_row), 1))
        table_style.append(('BOTTOMPADDING', (2, desc_row), (2, desc_row), 1))
    
    items_table.setStyle(TableStyle(table_style))
    
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

    # Consider only visible items (group headers and items without group_id)
    visible_items = [it for it in quotation.items.all() if (it.is_group_header or not it.group_id)]

    # Gesamt-EK
    total_purchase = sum((it.total_purchase_cost or Decimal('0.00')) for it in visible_items)

    # Detect if any visible item uses the system price
    uses_system = any(getattr(it, 'uses_system_price', False) and quotation.system_price for it in visible_items)
    system_price_value = (quotation.system_price or Decimal('0.00')) if uses_system else Decimal('0.00')

    # Sum VKs of items NOT using system price
    other_total_vk = sum((it.subtotal for it in visible_items if not (getattr(it, 'uses_system_price', False) and quotation.system_price)), Decimal('0.00'))

    # Gesamt-VK netto = other_total_vk + system_price_value
    total_net = other_total_vk + system_price_value

    # Margenberechnung
    margin_absolute = total_net - total_purchase
    margin_percent = (margin_absolute / total_purchase * Decimal('100')) if total_purchase != 0 else Decimal('0.00')

    # Lieferkosten
    delivery_cost = quotation.delivery_cost or Decimal('0.00')

    # Zwischensumme vor MwSt
    subtotal_before_tax = total_net + delivery_cost

    # MwSt
    total_tax = (subtotal_before_tax * (quotation.tax_rate / Decimal('100'))) if quotation.tax_enabled else Decimal('0.00')

    # Gesamtsumme brutto
    total_gross = subtotal_before_tax + total_tax

    sum_labels = {
        'DE': ['Gesamt-EK:', 'Systempreis:', 'Summe übrige Pos.', 'Zwischensumme (netto):', 'Marge (abs):', 'Marge (%):', 'Lieferkosten:', 'Gesamtsumme (netto):', 'MwSt:', 'Gesamtsumme (brutto):'],
        'EN': ['Total purchase cost:', 'System price:', 'Sum of other items', 'Subtotal (net):', 'Margin (abs):', 'Margin (%):', 'Delivery cost:', 'Total (net):', 'VAT:', 'Total (gross):']
    }

    # Summenblock im Vorlagen-Look (schwarz, feine Abschlusslinie)
    sum_rows = []
    if uses_system:
        sum_rows.append((sum_labels[lang][1], f"€ {system_price_value:,.2f}"))
    sum_rows.append((sum_labels[lang][2], f"€ {other_total_vk:,.2f}"))
    sum_rows.append((sum_labels[lang][3], f"€ {total_net:,.2f}"))
    sum_rows.append((sum_labels[lang][6], f"€ {delivery_cost:,.2f}"))
    sum_rows.append((sum_labels[lang][7], f"€ {subtotal_before_tax:,.2f}"))
    sum_rows.append((sum_labels[lang][8], f"€ {total_tax:,.2f}"))
    sum_rows.append((sum_labels[lang][9], f"€ {total_gross:,.2f}"))

    sum_table = build_totals_table(sum_rows)
    sum_table.setStyle(TableStyle([
        # Abschlusslinie über der Gesamtsumme, wie in der Vorlage
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
        ('FONTNAME', (0, -1), (-1, -1), FONT_BOLD),
        ('TOPPADDING', (0, -1), (-1, -1), 5),
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
