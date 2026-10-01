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
from core.pdf_base import (
    FONT_REGULAR,
    VerpDocTemplate,
    build_address_and_doc_row,
    build_document_box,
    build_positions_table,
    get_company_styles,
)
import os


class LoanDeliveryNoteDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate für Leihlieferscheine.

    Briefkopf, Fusszeile, Rand und Schriftgroessen kommen aus
    core.pdf_base und entsprechen damit der Corporate-Design-Vorlage.
    """
    def __init__(self, filename, company=None, customer_loan=None,
                 language='de', **kwargs):
        self.customer_loan = customer_loan

        label = 'Loan Delivery Note' if language == 'en' else 'Leihlieferschein'
        loan_number = getattr(customer_loan, 'loan_number', None) or '---'
        kwargs.setdefault('title', label)
        # 'language' MUSS an die Basis durchgereicht werden - sie
        # steuert die Briefkopf-Unterzeile ("Imaging · Microscopy" statt
        # "Bildverarbeitung · Mikroskopie"). Wird sie hier nur lokal
        # gesetzt, bleibt in der Basis die Vorgabe 'de' stehen.
        VerpDocTemplate.__init__(
            self, filename, company=company, language=language,
            continuation_text=f'{label} {loan_number}',
            **kwargs)


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
        company=company,
        customer_loan=customer_loan,
        language=language
    )

    elements = []
    vs = get_company_styles()
    style_title = vs['VerpTitle']
    style_normal = vs['VerpBody']
    style_small = vs['VerpSmall']
    style_heading = vs['VerpHeading']
    style_clause = vs['VerpClause']

    is_en = language == 'en'

    # === EMPFÄNGER (Kundenadresse) und Dokumentbox wie in der Vorlage ===
    address_lines = [
        l for l in customer_loan.get_delivery_address_display().split('\n')
        if l.strip()
    ]

    doc_box_lines = [
        ('Loan Delivery Note' if is_en else 'Leihlieferschein', True),
        (customer_loan.loan_number, False),
        (
            f"{'Loan date' if is_en else 'Verleihdatum'} "
            f"{customer_loan.loan_date.strftime('%d.%m.%Y')}",
            False,
        ),
    ]
    if customer_loan.return_deadline:
        doc_box_lines.append((
            f"{'Return deadline' if is_en else 'Rückgabefrist'} "
            f"{customer_loan.return_deadline.strftime('%d.%m.%Y')}",
            False,
        ))

    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=customer_loan.loan_date.strftime('%d.%m.%Y'),
        language=language,
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # === TITEL ===
    elements.append(Paragraph(
        'Loan Delivery Note' if is_en else 'Leihlieferschein', style_title))
    elements.append(Spacer(1, 0.2 * cm))
    customer_display = customer_loan.get_recipient_display()
    elements.append(Paragraph(
        f"Loan to {customer_display}" if is_en
        else f"Verleihung an {customer_display}",
        style_small,
    ))
    elements.append(Spacer(1, 0.5 * cm))

    # === EINLEITUNG ===
    intro_text = "We hereby hand over the following items on loan:" if is_en else "Hiermit übergeben wir Ihnen folgende Waren leihweise:"
    elements.append(Paragraph(intro_text, style_normal))
    elements.append(Spacer(1, 0.5 * cm))

    # === POSITIONS-TABELLE ===
    headers = (['Pos.', 'Art. No.', 'Description', 'Qty', 'Unit'] if is_en
               else ['Pos.', 'Art.-Nr.', 'Beschreibung', 'Menge', 'Einh.'])

    rows = []
    for item in customer_loan.items.all():
        desc = item.product_name
        if item.serial_number:
            desc += f"<br/>S/N: {item.serial_number}"

        rows.append([
            str(item.position),
            Paragraph(item.article_number or '—', style_small),
            Paragraph(desc, style_small),
            f"{item.quantity:g}",
            item.unit,
        ])

    col_widths = [1.0 * cm, 2.2 * cm, 7.0 * cm, 1.8 * cm, 2.0 * cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[]))
    elements.append(Spacer(1, 0.8 * cm))

    # === RÜCKGABEFRIST ===
    if customer_loan.return_deadline:
        deadline_label = 'Return deadline' if is_en else 'Rückgabefrist'
        elements.append(Paragraph(
            f"{deadline_label}: {customer_loan.return_deadline.strftime('%d.%m.%Y')}",
            style_normal,
        ))
        elements.append(Spacer(1, 0.3 * cm))

    # === STANDARDKLAUSEL ===
    if customer_loan.standard_clause:
        clause_label = 'Loan conditions' if is_en else 'Leihbedingungen'
        elements.append(Paragraph(
            f"<b>{clause_label}</b><br/>{customer_loan.standard_clause}",
            style_clause
        ))
        elements.append(Spacer(1, 0.5 * cm))

    # === NOTIZEN ===
    if customer_loan.notes:
        notes_label = 'Remarks' if is_en else 'Bemerkungen'
        elements.append(Paragraph(f"<b>{notes_label}</b>", style_normal))
        elements.append(Paragraph(
            customer_loan.notes.replace('\n', '<br/>'), style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === UNTERSCHRIFT ===
    elements.append(Spacer(1, 1.5 * cm))

    if is_en:
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
    sig_table = Table(sig_data, colWidths=[6 * cm, 2 * cm, 6 * cm])
    sig_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), FONT_REGULAR),
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
