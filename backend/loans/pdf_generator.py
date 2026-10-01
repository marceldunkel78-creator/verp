"""
PDF-Generator für Rücklieferscheine (Procurement-Leihungen).
Professionelles DIN A4 Layout, unterstützt Deutsch und Englisch.
"""

from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Spacer
from xml.sax.saxutils import escape

from company.models import CompanySettings
from core.pdf_base import (
    VerpDocTemplate,
    build_address_and_doc_row,
    build_document_box,
    build_positions_table,
    get_company_styles,
)

# Texte des Rücklieferscheins. Es gibt bewusst KEINEN Fallback auf
# deutsche Werte: wenn eine Sprache fehlt, soll der Fehler auffallen
# und nicht stillschweigend ein deutsches Dokument erscheinen.
RETURN_NOTE_TEXTS = {
    'de': {
        'title': 'Rücklieferschein',
        'doc_title': 'Rücklieferschein',
        'loan_of': 'Leihung',
        'your_ref': 'Ihre Referenz',
        'rma': 'RMA-Nr.',
        'intro': 'Hiermit senden wir folgende Leihwaren zurück:',
        'headers': ['Pos.', 'Art.-Nr.', 'Beschreibung', 'Menge', 'Einh.',
                    'Zustand'],
        'shipping': 'Versandinformationen',
        'carrier': 'Versanddienstleister',
        'tracking': 'Sendungsnummer',
        'notes': 'Bemerkungen',
        'closing': 'Wir bitten um Bestätigung des Wareneingangs.',
        'regards': 'Mit freundlichen Grüßen',
        'piece': 'Stk',
    },
    'en': {
        'title': 'Return Delivery Note',
        'doc_title': 'Return Delivery Note',
        'loan_of': 'Loan',
        'your_ref': 'Your reference',
        'rma': 'RMA no.',
        'intro': 'We hereby return the following items on loan:',
        'headers': ['Pos.', 'Art. No.', 'Description', 'Qty', 'Unit',
                    'Condition'],
        'shipping': 'Shipping information',
        'carrier': 'Shipping carrier',
        'tracking': 'Tracking number',
        'notes': 'Remarks',
        'closing': 'Please acknowledge receipt of goods.',
        'regards': 'Kind regards',
        'piece': 'pc',
    },
}


class ReturnNoteDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate für Rücklieferscheine.

    Briefkopf, Fusszeile, Rand und Schriftgroessen kommen aus
    core.pdf_base und entsprechen damit der Corporate-Design-Vorlage.
    """

    def __init__(self, filename, company=None, loan_return=None,
                 language='de', **kwargs):
        self.loan_return = loan_return

        t = RETURN_NOTE_TEXTS.get(language, RETURN_NOTE_TEXTS['de'])
        return_number = getattr(loan_return, 'return_number', None) or '---'

        kwargs.setdefault('title', t['title'])
        # 'language' MUSS an die Basis durchgereicht werden - sie
        # steuert die Briefkopf-Unterzeile ("Imaging · Microscopy"
        # statt "Bildverarbeitung · Mikroskopie") und das Label
        # "Datum:"/"Date:". Ohne Weitergabe bleibt dort 'de' stehen.
        VerpDocTemplate.__init__(
            self, filename, company=company, language=language,
            continuation_text=f'{t["title"]} {return_number}',
            **kwargs)


def generate_return_note_pdf(loan_return, language='de'):
    """
    Generiert ein professionelles PDF für einen Rücklieferschein.

    language: 'de' oder 'en'
    """
    buffer = BytesIO()

    company = CompanySettings.get_settings()
    loan = loan_return.loan

    t = RETURN_NOTE_TEXTS.get(language, RETURN_NOTE_TEXTS['de'])

    doc = ReturnNoteDocTemplate(
        buffer,
        pagesize=A4,
        company=company,
        loan_return=loan_return,
        language=language,
    )

    elements = []
    vs = get_company_styles()
    style_normal = vs['VerpBody']
    style_small = vs['VerpSmall']
    style_heading = vs['VerpHeading']
    style_title = vs['VerpTitle']

    # === EMPFÄNGER (Rücksendeadresse) und Dokumentbox wie in der Vorlage ===
    address_lines = [
        l for l in loan.get_return_address_display().split('\n') if l.strip()
    ]

    doc_box_lines = [
        (t['doc_title'], True),
        (loan_return.return_number, False),
        (f"{t['loan_of']} {loan.loan_number}", False),
    ]
    if loan.supplier_reference:
        doc_box_lines.append(
            (f"{t['your_ref']} {loan.supplier_reference}", False))
    if getattr(loan_return, 'rma_number', None):
        doc_box_lines.append((f"{t['rma']} {loan_return.rma_number}", False))

    # Datum mit dem Kürzel des Dokumenterstellers, wie in Q-373Du
    # ("17.08.2026 / DuBB").
    date_text = loan_return.return_date.strftime('%d.%m.%Y')
    creator = (getattr(getattr(loan_return, 'created_by', None), 'username', '')
               or '')
    if creator:
        date_text += f' / {creator}'

    elements.append(build_address_and_doc_row(
        address_lines, build_document_box(doc_box_lines), company,
        date_text=date_text,
        language=language,
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # === TITEL ===
    elements.append(Paragraph(t['title'], style_title))
    elements.append(Spacer(1, 0.2 * cm))
    elements.append(Paragraph(
        f"{t['loan_of']} {loan.loan_number} - {loan.lender_name}",
        style_small))
    elements.append(Spacer(1, 0.5 * cm))

    # === EINLEITUNG ===
    elements.append(Paragraph(t['intro'], style_normal))
    elements.append(Spacer(1, 0.5 * cm))

    # === POSITIONS-TABELLE ===
    headers = t['headers']

    rows = []
    for idx, item in enumerate(
            loan_return.items.all().select_related('loan_item'), 1):
        loan_item = item.loan_item
        # escape() erst auf die einzelnen Teile, dann mit <br/>
        # zusammenbauen. Umgekehrt kaeme "<br/>" als sichtbarer Text
        # im PDF statt als Zeilenumbruch.
        desc = escape(loan_item.product_name or '')
        if loan_item.serial_number:
            desc += f"<br/>S/N: {escape(loan_item.serial_number)}"

        condition = item.condition_notes or 'OK'
        if len(condition) > 50:
            condition = condition[:47] + '...'

        rows.append([
            str(idx),
            Paragraph(escape(loan_item.supplier_article_number or '—'),
                      style_small),
            Paragraph(desc, style_small),
            f"{item.quantity_returned:g}",
            loan_item.unit or t['piece'],
            Paragraph(escape(condition), style_small),
        ])

    # Summe 16,0 cm - build_positions_table streckt zentral auf die
    # Satzspiegelbreite (CONTENT_W = 17,2 cm).
    col_widths = [1.0 * cm, 2.2 * cm, 5.4 * cm, 1.5 * cm, 1.4 * cm, 4.5 * cm]
    elements.extend(build_positions_table(
        headers, rows, col_widths=col_widths, align_right=[]))
    elements.append(Spacer(1, 1 * cm))

    # === VERSANDINFOS ===
    if loan_return.shipping_carrier or loan_return.tracking_number:
        elements.append(Paragraph(t['shipping'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        if loan_return.shipping_carrier:
            elements.append(Paragraph(
                f"{t['carrier']}: "
                f"{escape(loan_return.shipping_carrier)}", style_small))
        if loan_return.tracking_number:
            elements.append(Paragraph(
                f"{t['tracking']}: "
                f"{escape(loan_return.tracking_number)}", style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === NOTIZEN ===
    if loan_return.notes:
        elements.append(Paragraph(t['notes'], style_heading))
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(
            escape(loan_return.notes).replace('\n', '<br/>'), style_small))
        elements.append(Spacer(1, 0.5 * cm))

    # === SCHLUSSTEXT ===
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(t['closing'], style_normal))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(t['regards'], style_normal))
    elements.append(Spacer(1, 1 * cm))

    if company:
        elements.append(Paragraph(
            company.company_name or '', style_normal))

    # PDF erstellen
    doc.build(elements)

    return buffer.getvalue()
