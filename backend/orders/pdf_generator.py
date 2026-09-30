from django.http import HttpResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from company.models import CompanySettings
from core.pdf_base import (
    FONT_BOLD,
    FONT_REGULAR,
    VerpDocTemplate,
    build_address_and_doc_row,
    build_document_box,
    build_positions_table,
    build_totals_table,
    format_amount,
    get_company_styles,
)
from datetime import date
import io


def render_order_pdf_bytes(order):
    """Render the order PDF and return raw bytes (no HttpResponse)."""
    company = CompanySettings.get_settings()
    total_amount = sum(item.total_price for item in order.items.all())
    buffer = io.BytesIO()

    order_number = order.order_number or '---'
    doc = VerpDocTemplate(
        buffer, pagesize=A4, company=company,
        title='Bestellung',
        continuation_text=(
            f"Bestellung {order_number} vom "
            f"{order.order_date.strftime('%d.%m.%Y')}"
            if order.order_date else f"Bestellung {order_number}"),
    )
    elements = []
    vs = get_company_styles()
    style_heading = vs['VerpTitle']
    style_normal = vs['VerpBody']
    style_small = vs['VerpSmall']

    # === EMPFÄNGER (Lieferant) und Dokumentbox wie in der Vorlage ===
    supplier_address_lines = [
        order.supplier.company_name,
        f"{order.supplier.street} {order.supplier.house_number or ''}".strip(),
        f"{order.supplier.postal_code} {order.supplier.city}",
    ]
    supplier_address_lines += [
        l for l in [order.supplier.country] if l
    ]

    doc_box_lines = [
        ('Bestellung', True),
        (order_number, False),
    ]
    if order.order_date:
        doc_box_lines.append(
            (f"Bestelldatum {order.order_date.strftime('%d.%m.%Y')}", False))
    if order.offer_reference:
        doc_box_lines.append((f"Ihre Angebots-Nr. {order.offer_reference}", False))
    if order.supplier.customer_number:
        doc_box_lines.append(
            (f"Unsere Kundennr. {order.supplier.customer_number}", False))

    elements.append(build_address_and_doc_row(
        supplier_address_lines, build_document_box(doc_box_lines), company,
        date_text=order.order_date.strftime('%d.%m.%Y') if order.order_date else '',
    ))
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph('Bestellung', style_heading))
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("Sehr geehrte Damen und Herren,", style_normal))
    elements.append(Paragraph("hiermit bestellen wir verbindlich folgende Positionen:", style_normal))
    elements.append(Spacer(1, 0.5*cm))

    if order.custom_text:
        custom_style = ParagraphStyle('Custom', parent=style_normal,
                                     backColor=colors.HexColor('#f9f9f9'),
                                     borderPadding=10, leftIndent=10)
        elements.append(Paragraph(order.custom_text.replace('\n', '<br/>'), custom_style))
        elements.append(Spacer(1, 0.5*cm))

    headers = ['Pos.', 'Art.-Nr.', 'Beschreibung', 'Menge', 'Einh.',
               'EP', 'Rabatt', 'Gesamt']

    rows = []
    for item in order.items.all().order_by('position'):
        name = item.name
        if item.description:
            name += f"<br/>{item.description}"
        if item.customer_order_number:
            name += f"<br/>KA: {item.customer_order_number}"
        rows.append([
            str(item.position),
            item.article_number or '—',
            Paragraph(name, style_small),
            f"{item.quantity}",
            item.unit or 'Stk.',
            format_amount(item.list_price, item.currency),
            f"{item.discount_percent:.2f}%",
            format_amount(item.total_price, item.currency),
        ])

    col_widths = [0.9*cm, 2.0*cm, 4.3*cm, 1.2*cm, 1.1*cm, 1.9*cm, 1.4*cm, 2.2*cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[5, 6, 7]))
    elements.append(Spacer(1, 0.5*cm))

    elements.append(build_totals_table([
        ('Gesamt', format_amount(total_amount, 'EUR')),
    ]))
    elements.append(Spacer(1, 0.8*cm))

    conditions = "<b>Liefer- und Zahlungsbedingungen:</b><br/>"
    if order.delivery_term:
        try:
            conditions += f"Lieferbedingung: {order.delivery_term.incoterm_display}<br/>"
        except:
            conditions += f"Lieferbedingung: {order.delivery_term}<br/>"
    if order.payment_term:
        try:
            conditions += f"Zahlungsbedingung: {order.payment_term.formatted_terms}<br/>"
        except:
            conditions += f"Zahlungsbedingung: {order.payment_term}<br/>"
    if order.delivery_instruction:
        try:
            conditions += f"Lieferanweisung: {order.delivery_instruction.name}<br/>"
        except:
            conditions += f"Lieferanweisung: {order.delivery_instruction}<br/>"
    if order.delivery_date:
        conditions += f"Gewünschter Liefertermin: {order.delivery_date.strftime('%d.%m.%Y')}<br/>"
    elements.append(Paragraph(conditions, style_normal))
    elements.append(Spacer(1, 0.8*cm))

    closing = """Wir bitten um Auftragsbestätigung mit Angabe des voraussichtlichen Liefertermins.<br/><br/>
    Mit freundlichen Grüßen<br/>""" + company.company_name
    elements.append(Paragraph(closing, style_normal))

    doc.build(elements)

    pdf = buffer.getvalue()
    buffer.close()
    return pdf


def generate_order_pdf(order):
    """Generiere PDF für eine Bestellung und liefere als HttpResponse zurück"""
    pdf = render_order_pdf_bytes(order)
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Bestellung_{order.order_number}.pdf"'
    return response
