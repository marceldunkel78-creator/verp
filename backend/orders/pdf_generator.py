from django.http import HttpResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from company.models import CompanySettings
from datetime import date
import io


def generate_order_pdf(order):
    """Generiere PDF für eine Bestellung"""
    
    # Hole Firmeneinstellungen
    company = CompanySettings.get_settings()
    
    # Berechne Gesamtsumme
    total_amount = sum(item.total_price for item in order.items.all())
    
    # PDF Buffer erstellen
    buffer = io.BytesIO()
    
    # PDF erstellen
    doc = SimpleDocTemplate(buffer, pagesize=A4, 
                           topMargin=2*cm, bottomMargin=3*cm,
                           leftMargin=2*cm, rightMargin=2*cm)
    
    # Container für Elemente
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    style_heading = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=colors.HexColor('#0066cc'),
        spaceAfter=12
    )
    style_normal = styles['Normal']
    style_small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8)
    
    # Header mit Logo
    if company.document_header:
        try:
            img = Image(company.document_header.path, width=15*cm, height=3*cm, kind='proportional')
            img.hAlign = 'CENTER'
            elements.append(img)
            elements.append(Spacer(1, 0.5*cm))
        except:
            # Falls Bild nicht geladen werden kann
            elements.append(Paragraph(f"<b>{company.company_name}</b>", style_heading))
    else:
        elements.append(Paragraph(f"<b>{company.company_name}</b>", style_heading))
    
    # Absender (klein)
    sender_line = f"{company.company_name} • {company.street} {company.house_number} • {company.postal_code} {company.city}"
    elements.append(Paragraph(sender_line, style_small))
    elements.append(Spacer(1, 0.3*cm))
    
    # Empfänger (Lieferant)
    supplier_address = f"""<b>{order.supplier.company_name}</b><br/>
    {order.supplier.street} {order.supplier.house_number}<br/>
    {order.supplier.postal_code} {order.supplier.city}<br/>
    {order.supplier.country}"""
    elements.append(Paragraph(supplier_address, style_normal))
    elements.append(Spacer(1, 1*cm))
    
    # Meta-Informationen (rechts)
    meta_text = f"""<para align=right>
    <b>Bestellnummer:</b> {order.order_number}<br/>
    <b>Bestelldatum:</b> {order.order_date.strftime('%d.%m.%Y') if order.order_date else '—'}<br/>
    """
    if order.offer_reference:
        meta_text += f"<b>Ihre Angebots-Nr.:</b> {order.offer_reference}<br/>"
    if order.supplier.customer_number:
        meta_text += f"<b>Unsere Kundennr.:</b> {order.supplier.customer_number}<br/>"
    meta_text += "</para>"
    elements.append(Paragraph(meta_text, style_normal))
    elements.append(Spacer(1, 0.8*cm))
    
    # Betreff
    elements.append(Paragraph(f"<b>Bestellung {order.order_number}</b>", style_heading))
    elements.append(Spacer(1, 0.3*cm))
    
    # Anrede
    elements.append(Paragraph("Sehr geehrte Damen und Herren,", style_normal))
    elements.append(Paragraph("hiermit bestellen wir verbindlich folgende Positionen:", style_normal))
    elements.append(Spacer(1, 0.5*cm))
    
    # Custom Text
    if order.custom_text:
        custom_style = ParagraphStyle('Custom', parent=style_normal, 
                                     backColor=colors.HexColor('#f9f9f9'),
                                     borderPadding=10, leftIndent=10)
        elements.append(Paragraph(order.custom_text.replace('\n', '<br/>'), custom_style))
        elements.append(Spacer(1, 0.5*cm))
    
    # Bestelltabelle
    table_data = [['Pos.', 'Art.-Nr.', 'Beschreibung', 'Menge', 'Einh.', 'EP', 'Rabatt', 'Gesamt']]
    
    for item in order.items.all().order_by('position'):
        desc = item.name
        if item.description:
            desc += f"\n{item.description}"
        if item.customer_order_number:
            desc += f"\nKA: {item.customer_order_number}"
        
        table_data.append([
            str(item.position),
            item.article_number or '—',
            desc,
            f"{item.quantity}",
            item.unit or 'Stk.',
            f"{item.list_price:.2f} {item.currency}",
            f"{item.discount_percent:.2f}%",
            f"{item.total_price:.2f} {item.currency}"
        ])
    
    # Total Row
    table_data.append(['', '', '', '', '', '', 'Gesamt:', f"{total_amount:.2f} EUR"])
    
    # Table Style
    table = Table(table_data, colWidths=[1.2*cm, 2.5*cm, 6*cm, 1.5*cm, 1.2*cm, 2*cm, 1.5*cm, 2.5*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0066cc')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -2), colors.white),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),  # Menge
        ('ALIGN', (5, 1), (-1, -1), 'RIGHT'),  # Preise
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -2), 0.5, colors.grey),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0f0f0')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.black),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 0.8*cm))
    
    # Konditionen
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
    
    # Abschluss
    closing = """Wir bitten um Auftragsbestätigung mit Angabe des voraussichtlichen Liefertermins.<br/><br/>
    Mit freundlichen Grüßen<br/>""" + company.company_name
    elements.append(Paragraph(closing, style_normal))
    
    # Footer (wird auf jeder Seite angezeigt)
    def add_footer(canvas, doc):
        canvas.saveState()
        footer_style = ParagraphStyle('Footer', fontSize=7, textColor=colors.grey)
        
        footer_text = f"""
        <b>{company.company_name}</b><br/>
        {company.street} {company.house_number}, {company.postal_code} {company.city}<br/>
        {"Tel: " + company.phone if company.phone else ""} {company.email if company.email else ""}<br/><br/>
        
        <b>Bankverbindung:</b> {company.bank_name}, IBAN: {company.iban}, BIC: {company.bic}<br/>
        <b>Geschäftsführer:</b> {company.managing_director}<br/>
        {company.register_court} {company.commercial_register}
        {"<br/>USt-IdNr.: " + company.vat_id if company.vat_id else ""}
        """
        
        p = Paragraph(footer_text, footer_style)
        w, h = p.wrap(doc.width, doc.bottomMargin)
        p.drawOn(canvas, doc.leftMargin, 2*cm - h)
        
        canvas.restoreState()
    
    # PDF erstellen
    doc.build(elements, onFirstPage=add_footer, onLaterPages=add_footer)
    
    # Response
    pdf = buffer.getvalue()
    buffer.close()
    
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Bestellung_{order.order_number}.pdf"'
    
    return response
