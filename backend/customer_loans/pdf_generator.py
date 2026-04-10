"""
PDF Generator für Leihlieferscheine (Verleihungen an Kunden)
Professionelles DIN A4 Layout
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


class LoanDeliveryNoteDocTemplate(BaseDocTemplate):
    """
    Custom DocTemplate für Leihlieferscheine mit Header und Footer
    """
    def __init__(self, filename, company=None, customer_loan=None, language='de', **kwargs):
        self.company = company
        self.customer_loan = customer_loan
        self.language = language
        BaseDocTemplate.__init__(self, filename, **kwargs)

        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id='normal'
        )

        template = PageTemplate(
            id='loan_delivery_note',
            frames=frame,
            onPage=self._add_header_footer
        )
        self.addPageTemplates([template])

    def _add_header_footer(self, canvas, doc):
        """Fügt Header und Footer zu jeder Seite hinzu"""
        canvas.saveState()

        width, height = A4
        company = self.company
        customer_loan = self.customer_loan

        # === HEADER ===
        page_num = canvas.getPageNumber()

        # Logo (nur auf Seite 1, rechts oben)
        if page_num == 1 and company and company.document_header:
            try:
                logo_path = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
                if os.path.exists(logo_path):
                    logo_x = width - 7 * cm
                    logo_y = height - 2.5 * cm
                    try:
                        img = ImageReader(logo_path)
                        canvas.drawImage(img, logo_x, logo_y, width=5 * cm, height=1.5 * cm,
                                         preserveAspectRatio=True, anchor='nw', mask='auto')
                    except Exception:
                        canvas.drawImage(logo_path, logo_x, logo_y, width=5 * cm, height=1.5 * cm,
                                         preserveAspectRatio=True, anchor='nw')
            except Exception as e:
                print(f"Error loading header logo: {e}")

        # Seitenzahl (ab Seite 2)
        if page_num > 1:
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.grey)
            label = 'Loan Delivery Note' if self.language == 'en' else 'Leihlieferschein'
            header_text = f"Seite {page_num} - {label} {customer_loan.loan_number}" if self.language == 'de' else f"Page {page_num} - {label} {customer_loan.loan_number}"
            canvas.drawString(2 * cm, height - 3.2 * cm, header_text)
            canvas.setStrokeColor(colors.grey)
            canvas.line(2 * cm, height - 3.4 * cm, width - 2 * cm, height - 3.4 * cm)

        # === FOOTER ===
        footer_y = 1.2 * cm

        canvas.setStrokeColor(colors.grey)
        canvas.line(2 * cm, footer_y + 1.8 * cm, width - 2 * cm, footer_y + 1.8 * cm)

        canvas.setFont('Helvetica', 6.5)
        canvas.setFillColor(colors.HexColor('#333333'))

        if company:
            col1_x = 2 * cm
            canvas.drawString(col1_x, footer_y + 1.4 * cm, company.company_name or '')
            canvas.drawString(col1_x, footer_y + 0.9 * cm,
                              f"{company.street or ''} {company.house_number or ''}")
            canvas.drawString(col1_x, footer_y + 0.4 * cm,
                              f"D-{company.postal_code or ''} {company.city or ''}")

            col2_x = 6.5 * cm
            canvas.drawString(col2_x, footer_y + 1.4 * cm, f"Tel. {company.phone or ''}")
            canvas.drawString(col2_x, footer_y + 0.9 * cm, company.email or '')
            canvas.drawString(col2_x, footer_y + 0.4 * cm,
                              (company.website or '').replace('https://', '').replace('http://', ''))

            col3_x = 10.5 * cm
            canvas.drawString(col3_x, footer_y + 1.4 * cm,
                              f"{company.register_court or ''}, {company.commercial_register or ''}")
            canvas.drawString(col3_x, footer_y + 0.9 * cm, "Geschäftsführer:")
            canvas.drawString(col3_x, footer_y + 0.4 * cm, company.managing_director or '')

            col4_x = 15 * cm
            canvas.drawString(col4_x, footer_y + 1.4 * cm, company.bank_name or '')
            canvas.drawString(col4_x, footer_y + 0.9 * cm, f"BIC: {company.bic or ''}")
            canvas.drawString(col4_x, footer_y + 0.4 * cm, f"IBAN: {company.iban or ''}")

        canvas.restoreState()


def generate_loan_delivery_note_pdf(customer_loan, language='de'):
    """
    Generiert ein professionelles PDF für einen Leihlieferschein
    language: 'de' or 'en'
    """
    buffer = BytesIO()

    company = CompanySettings.get_settings()

    doc = LoanDeliveryNoteDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.5 * cm,
        bottomMargin=3.5 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        company=company,
        customer_loan=customer_loan,
        language=language
    )

    elements = []
    styles = getSampleStyleSheet()

    # Styles
    style_title = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#cc0066'),
        spaceAfter=6
    )

    style_subtitle = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#666666'),
        spaceAfter=20
    )

    style_heading = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#333333'),
        spaceBefore=15,
        spaceAfter=8
    )

    style_normal = styles['Normal']
    style_small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8)

    style_clause = ParagraphStyle(
        'Clause',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#333333'),
        spaceBefore=10,
        spaceAfter=10,
        borderWidth=1,
        borderColor=colors.HexColor('#cc0066'),
        borderPadding=8,
        backColor=colors.HexColor('#fff5f8')
    )

    # === ABSENDER (einzeilig) ===
    elements.append(Spacer(1, 0.5 * cm))
    if company:
        sender_line = f"{company.company_name} • {company.street} {company.house_number} • {company.postal_code} {company.city}"
        elements.append(Paragraph(sender_line, style_small))
        elements.append(Spacer(1, 0.3 * cm))

    # === EMPFÄNGER (Kundenadresse) ===
    delivery_address = customer_loan.get_delivery_address_display().replace('\n', '<br/>')
    elements.append(Paragraph(f"<b>{delivery_address}</b>", style_normal))
    elements.append(Spacer(1, 1 * cm))

    # === DOKUMENT-METADATEN ===
    if language == 'en':
        meta_text = f"""<para align=right>
    <b>Loan Delivery Note No.:</b> {customer_loan.loan_number}<br/>
    <b>Loan Date:</b> {customer_loan.loan_date.strftime('%d.%m.%Y')}<br/>
    """
        if customer_loan.return_deadline:
            meta_text += f"<b>Return Deadline:</b> {customer_loan.return_deadline.strftime('%d.%m.%Y')}<br/>"
    else:
        meta_text = f"""<para align=right>
    <b>Leihlieferschein-Nr.:</b> {customer_loan.loan_number}<br/>
    <b>Verleihdatum:</b> {customer_loan.loan_date.strftime('%d.%m.%Y')}<br/>
    """
        if customer_loan.return_deadline:
            meta_text += f"<b>Rückgabefrist:</b> {customer_loan.return_deadline.strftime('%d.%m.%Y')}<br/>"
    meta_text += "</para>"
    elements.append(Paragraph(meta_text, style_normal))
    elements.append(Spacer(1, 0.8 * cm))

    # === TITEL ===
    doc_title = f"Loan Delivery Note {customer_loan.loan_number}" if language == 'en' else f"Leihlieferschein {customer_loan.loan_number}"
    elements.append(Paragraph(f"<b>{doc_title}</b>", style_title))
    customer = customer_loan.customer
    customer_display = f"{customer.title} {customer.first_name} {customer.last_name}".strip()
    elements.append(Paragraph(
        f"Verleihung an {customer_display}" if language == 'de' else f"Loan to {customer_display}",
        style_subtitle
    ))

    # === EINLEITUNG ===
    intro_text = "We hereby hand over the following items on loan:" if language == 'en' else "Hiermit übergeben wir Ihnen folgende Waren leihweise:"
    elements.append(Paragraph(intro_text, style_normal))
    elements.append(Spacer(1, 0.5 * cm))

    # === POSITIONS-TABELLE ===
    if language == 'en':
        table_data = [['Pos.', 'Art. No.', 'Description', 'Qty', 'Unit']]
    else:
        table_data = [['Pos.', 'Art.-Nr.', 'Beschreibung', 'Menge', 'Einh.']]

    for item in customer_loan.items.all():
        desc = item.product_name
        if item.serial_number:
            desc += f"\nS/N: {item.serial_number}"

        table_data.append([
            str(item.position),
            Paragraph(item.article_number or '—', style_small),
            Paragraph(desc, style_small),
            f"{item.quantity:g}",
            item.unit
        ])

    table = Table(table_data, colWidths=[1.2 * cm, 2.5 * cm, 8 * cm, 1.8 * cm, 1.8 * cm])
    table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#cc0066')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),

        # Datenzeilen
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
        ('VALIGN', (0, 1), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),

        # Zebra-Streifen
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),

        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#cc0066')),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 0.8 * cm))

    # === RÜCKGABEFRIST ===
    if customer_loan.return_deadline:
        deadline_label = 'Return deadline:' if language == 'en' else 'Rückgabefrist:'
        elements.append(Paragraph(
            f"<b>{deadline_label}</b> {customer_loan.return_deadline.strftime('%d.%m.%Y')}",
            style_heading
        ))
        elements.append(Spacer(1, 0.3 * cm))

    # === STANDARDKLAUSEL ===
    if customer_loan.standard_clause:
        clause_label = 'Loan conditions:' if language == 'en' else 'Leihbedingungen:'
        elements.append(Paragraph(
            f"<b>{clause_label}</b><br/>{customer_loan.standard_clause}",
            style_clause
        ))
        elements.append(Spacer(1, 0.5 * cm))

    # === NOTIZEN ===
    if customer_loan.notes:
        notes_label = 'Remarks:' if language == 'en' else 'Bemerkungen:'
        elements.append(Paragraph(f"<b>{notes_label}</b>", style_normal))
        elements.append(Paragraph(customer_loan.notes.replace('\n', '<br/>'), style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === UNTERSCHRIFT ===
    elements.append(Spacer(1, 1.5 * cm))

    if language == 'en':
        sig_data = [
            ['Handed over:', '', 'Received:'],
            ['', '', ''],
            ['___________________________', '', '___________________________'],
            ['Date, Signature', '', 'Date, Signature Customer'],
        ]
    else:
        sig_data = [
            ['Übergeben:', '', 'Empfangen:'],
            ['', '', ''],
            ['___________________________', '', '___________________________'],
            ['Datum, Unterschrift', '', 'Datum, Unterschrift Kunde'],
        ]
    sig_table = Table(sig_data, colWidths=[6 * cm, 3 * cm, 6 * cm])
    sig_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TEXTCOLOR', (0, 3), (-1, 3), colors.grey),
        ('FONTSIZE', (0, 3), (-1, 3), 7),
    ]))
    elements.append(sig_table)

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    closing = 'With kind regards' if language == 'en' else 'Mit freundlichen Grüßen'
    elements.append(Paragraph(closing, style_normal))
    elements.append(Spacer(1, 0.5 * cm))

    if company:
        elements.append(Paragraph(company.company_name or '', style_normal))

    # PDF erstellen
    doc.build(elements)

    return buffer.getvalue()
