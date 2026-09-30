"""
Gemeinsame Basis fuer alle VERP-Geschaeftsdokumente (ReportLab).

Das Layout ist 1:1 aus den beiden Originalvorlagen abgeleitet:

    Datenvorlagen/Q-373Du-0826.pdf   (Angebot)
    Datenvorlagen/D276-1224.pdf       (Lieferschein)

Die Masse stammen aus der PDF-Analyse (Seitenkoordinaten in pt, A4 =
595,3 x 841,9 pt) und sind hier als Konstanten festgehalten, damit sie
sichtbar und pruefbar bleiben.

Warum eine eigene Basis? Vorher hatte jeder Generator (~10 Dateien) seine
eigene Kopie von Logo, Fusszeile und Layout - jeweils mit anderen
Akzentfarben (#ff0099, #cc0066, #0066cc) und anderen Tabellen. Das
Originaldokument ist dagegen durchgehend schwarz/weiss mit sehr feinen
Linien. Hier liegen die Masse an einer Stelle.
"""

import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, StyleSheet1
from reportlab.lib.units import cm, mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ===========================================================================
# Masse aus der Vorlage
# ===========================================================================

PAGE_W, PAGE_H = A4  # 595,3 x 841,9 pt

# --- Seitenraender -------------------------------------------------------
# Der Textblock der Vorlage beginnt bei x=70,9 pt (2,5 cm) und endet bei
# x=558,5 pt. Das sind exakt die Standardraender 2,5 cm links/rechts.
MARGIN_LEFT = 2.5 * cm
MARGIN_RIGHT = 2.5 * cm

# Oberkante des Textblocks: die Trennlinie unter dem Briefkopf liegt bei
# y=84,4 pt, der Empfaengerblock beginnt bei y=127,7 pt.
# Fuer Fliesstext wird darunter Platz gelassen.
MARGIN_TOP = 6.5 * cm
# Unterkante: die Fusszeile beginnt bei y=793 pt, der Text endet darueber.
MARGIN_BOTTOM = 3.2 * cm

CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT  # 453,5 pt = 16,0 cm

# --- Briefkopf ----------------------------------------------------------
# Logo in der Vorlage: x=388,9 .. 528,2 pt, y=33,0 .. 82,0 pt
LOGO_X = 388.9
LOGO_Y_TOP = 33.0
LOGO_W = 138.0        # bis 526,9 pt inkl. "GmbH"
LOGO_H = 49.0         # 33 .. 82 pt

# Unterzeile "Bildverarbeitung · Mikroskopie": x=424,7, y=89,1, 10 pt
TAGLINE_X = 424.7
TAGLINE_Y = 89.1
TAGLINE_SIZE = 10

# Trennlinie unter dem Briefkopf: x=70,9 .. 564,1, y=84,4, 1 pt
RULE_Y = 84.4
RULE_X0 = 70.9
RULE_X1 = 564.1

# --- Empfaengerblock ----------------------------------------------------
# Offener Rahmen: x=70,9 .. 303,4 pt, y=127,7 .. 258,1 pt
ADDR_BOX_X0 = 70.9
ADDR_BOX_X1 = 303.4
ADDR_BOX_Y0 = 127.7   # oben (PDF-Koordinaten von unten)
ADDR_BOX_H = 130.4

# Absenderzeile oben im Rahmen (7 pt, zentriert)
ADDR_SENDER_SIZE = 7

# Empfaengertext (10 pt)
ADDR_SIZE = 10
ADDR_LEADING = 11.4   # Abstand zwischen den Zeilen (157,1 -> 168,5 = 11,4)

# --- Dokumentbox --------------------------------------------------------
# Rechte Box: x=353,9 .. 559,6 pt, y=189,5 .. 263,4 pt
DOC_BOX_X0 = 353.9
DOC_BOX_W = 205.7
DOC_BOX_Y0 = 189.5
DOC_BOX_H = 73.9

DOC_TITLE_SIZE = 12   # "ANGEBOT" ist 12 pt fett
DOC_NUM_SIZE = 12

# Datumszeile: "Datum:" 9 pt bei x=355,0, Wert 10 pt bei x=423,5
DATE_LABEL_X = 355.0
DATE_VALUE_X = 423.5
DATE_Y = 287.7
DATE_LABEL_SIZE = 9

# --- Positionstabelle ---------------------------------------------------
# Spaltenkanten aus der Vorlage (x-Werte der Trennlinien):
#   70,9 | 104,9 | 144,6 | 462,1 | 558,5
# Breiten:  34,0 |  39,7 | 317,5 |  96,4
TBL_X0 = 70.9
COL_POS = 34.0       # Pos.
COL_QTY = 39.7       # Menge
COL_DESC = 317.5     # Bezeichnung
COL_AMOUNT = 96.4    # Betrag
TBL_HEADER_Y = 365.8
TBL_HEADER_H = 22.7
TBL_HEADER_SIZE = 9

# --- Fusszeile ----------------------------------------------------------
# Vier Spalten, 7 pt, untere Zeile bei y=793,6 pt
FOOTER_Y0 = 793.6     # obenste Fusszeilenzeile (PDF-Koordinaten)
FOOTER_SIZE = 7
FOOTER_LEADING = 8.1

FOOTER_COL1_X = 71.4    # Firmenadresse
FOOTER_COL2_X = 184.8   # Kontakt (fett)
FOOTER_COL3_X = 286.8   # Register / Geschaeftsfuehrer
FOOTER_COL4_X = 434.4   # Bank

# ===========================================================================
# Typografie
# ===========================================================================

FONT_REGULAR = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'

# Die Vorlage nutzt eine Serifenlose (CIDFont F1/F2), Helvetica ist die
# eingebaute Helvetica und damit die naheliegendste Entsprechung.
SIZE_TITLE = 14      # "LIEFERSCHEIN" als Ueberschrift im Text
SIZE_BODY = 10
SIZE_SMALL = 9
SIZE_TINY = 7
SIZE_FOOTNOTE = 8


def get_company_styles():
    """
    Stile nach Vorlagen-Vorgabe: schwarz, keine Akzentfarben.
    """
    ss = StyleSheet1()

    ss.add(ParagraphStyle(
        name='VerpTitle',
        fontName=FONT_BOLD, fontSize=SIZE_TITLE, leading=16,
        spaceAfter=8 * mm, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpHeading',
        fontName=FONT_BOLD, fontSize=SIZE_BODY, leading=13,
        spaceBefore=4 * mm, spaceAfter=2 * mm, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpBody',
        fontName=FONT_REGULAR, fontSize=SIZE_BODY, leading=12,
        alignment=TA_LEFT, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpBodyBold',
        parent=ss['VerpBody'], fontName=FONT_BOLD,
    ))
    ss.add(ParagraphStyle(
        name='VerpJustified',
        parent=ss['VerpBody'], alignment=TA_JUSTIFY,
    ))
    ss.add(ParagraphStyle(
        name='VerpSmall',
        fontName=FONT_REGULAR, fontSize=SIZE_SMALL, leading=11,
        textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpTiny',
        fontName=FONT_REGULAR, fontSize=SIZE_TINY, leading=9,
        textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpFootnote',
        fontName=FONT_REGULAR, fontSize=SIZE_FOOTNOTE, leading=10,
        textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpTableHead',
        fontName=FONT_REGULAR, fontSize=SIZE_SMALL, leading=11,
        alignment=TA_CENTER, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpTableCell',
        fontName=FONT_REGULAR, fontSize=SIZE_BODY, leading=12,
        alignment=TA_LEFT, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpTableCellRight',
        parent=ss['VerpTableCell'], alignment=TA_RIGHT,
    ))
    ss.add(ParagraphStyle(
        name='VerpTotal',
        fontName=FONT_BOLD, fontSize=SIZE_BODY, leading=12,
        alignment=TA_RIGHT, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpClause',
        fontName=FONT_REGULAR, fontSize=SIZE_SMALL, leading=11,
        alignment=TA_JUSTIFY, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpAddress',
        fontName=FONT_REGULAR, fontSize=ADDR_SIZE, leading=ADDR_LEADING,
        textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpAddressSender',
        fontName=FONT_REGULAR, fontSize=ADDR_SENDER_SIZE, leading=9,
        alignment=TA_CENTER, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpDocTitle',
        fontName=FONT_BOLD, fontSize=DOC_TITLE_SIZE, leading=14,
        textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpDocInfo',
        fontName=FONT_REGULAR, fontSize=DOC_NUM_SIZE, leading=14,
        textColor=colors.black,
    ))
    return ss


def wrap_text(text, max_length=35):
    """Bricht Text auf max_length Zeichen um - wie in der Vorlage."""
    if not text:
        return ''
    words = str(text).split()
    lines = []
    current = ''
    for word in words:
        if not current:
            current = word
        elif len(current) + 1 + len(word) <= max_length:
            current += ' ' + word
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return '\n'.join(lines)


# ===========================================================================
# Bausteine
# ===========================================================================

def company_logo_path():
    """
    Pfad zum Logo.

    Bevorzugt das in den Firmeneinstellungen gepflegte Bild. Fehlt es,
    greift das mitgelieferte Standard-Logo, das aus der Vorlage
    geschnitten wurde (backend/company/default_logo.png).
    """
    from django.conf import settings

    try:
        from company.models import CompanySettings

        company = CompanySettings.get_settings()
        if company and company.document_header:
            path = company.document_header.path
            if path and os.path.exists(path):
                return path
            fallback = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
            if os.path.exists(fallback):
                return fallback
    except Exception:
        pass

    default = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           '..', 'company', 'default_logo.png')
    default = os.path.abspath(default)
    return default if os.path.exists(default) else None


def build_address_box(company, address_lines):
    """
    Empfaengerblock inkl. Absenderzeile und offenem Rahmen,
    exakt wie in der Vorlage (Rahmen nur oben, links, unten - rechts offen).
    """
    styles = get_company_styles()
    addr_w = ADDR_BOX_X1 - ADDR_BOX_X0

    sender = []
    if company:
        sender.append(company.company_name or 'Visitron Systems GmbH')
        sender.append(f"{company.street or ''}, D-{company.postal_code or ''} {company.city or ''}")

    sender_text = '<br/>'.join(sender)
    addr_text = '<br/>'.join(address_lines or [''])

    inner = [
        Paragraph(sender_text, styles['VerpAddressSender']),
        Spacer(1, 2 * mm),
        Paragraph(addr_text, styles['VerpAddress']),
    ]

    # Offener Rahmen: in der Vorlage sind oben, links und unten eine
    # 0,1 pt Linie, rechts offen.
    box = Table([[inner]], colWidths=[addr_w])
    box.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 0.1, colors.black),
        ('LINEBELOW', (0, 0), (-1, 0), 0.1, colors.black),
        ('LINEBEFORE', (0, 0), (0, -1), 0.1, colors.black),
        # rechts bewusst offen
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return box


def doc_box_width():
    """
    Tatsaechlich verfuegbare Breite der Dokumentbox.

    Die Vorlage nutzt rechts einen kleineren Rand (1,3 cm) als links
    (2,5 cm), die Box misst dort 205,7 pt. Da alle Dokumente aber auf
    CONTENT_W aufbauen, wird die Box auf den tatsaechlich freien Platz
    begrenzt, damit sie nicht ueber den Seitenrand hinausragt.
    """
    available = PAGE_W - MARGIN_RIGHT - DOC_BOX_X0
    return min(DOC_BOX_W, available)


def build_document_box(lines):
    """
    Rechter Kasten mit Dokumenttyp, Nummer und Zusatzinfos.
    Die Vorlage nutzt 12 pt, Titel fett, restlich normal.

    Lange Titel wie "AUFTRAGSBESTAETIGUNG" brechen dabei um - das ist
    unproblematisch, weil der Kasten von unten ausgerichtet wird.
    """
    styles = get_company_styles()
    width = doc_box_width()
    content = []
    for i, (text, bold) in enumerate(lines):
        if i == 0:
            content.append(Paragraph(text, styles['VerpDocTitle']))
        else:
            content.append(Paragraph(text, styles['VerpDocInfo']))

    inner = Table([[content]], colWidths=[width - 10])
    inner.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    box = Table([[inner]], colWidths=[width])
    box.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.7, colors.black),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return box


def build_address_and_doc_row(address_lines, doc_box, company, date_text=''):
    """
    Zeile mit Empfaengerblock links und Dokumentbox rechts,
    plus die Datumszeile darunter - so wie in den Vorlagen.

    In der Vorlage sind beide Bloecke unten ausgerichtet: der
    Empfaengerrahmen laeuft von y=127,7 bis 264,4 pt, die Dokumentbox von
    y=189,5 bis 263,4 pt. Beide enden also auf derselben Höhe, die
    Dokumentbox beginnt einfach tiefer. Deshalb VALIGN= BOTTOM.
    """
    left_w = ADDR_BOX_X1 - ADDR_BOX_X0
    gap = DOC_BOX_X0 - ADDR_BOX_X1
    right_w = PAGE_W - MARGIN_RIGHT - DOC_BOX_X0

    styles = get_company_styles()
    date_row = Table(
        [[
            Paragraph('Datum:', styles['VerpTiny']),
            Paragraph(date_text or '', styles['VerpBody']),
        ]],
        colWidths=[(DATE_VALUE_X - DATE_LABEL_X), right_w - (DATE_VALUE_X - DATE_LABEL_X)],
    )
    date_row.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))

    right = [doc_box, Spacer(1, 3 * mm), date_row]

    row = Table(
        [[build_address_box(company, address_lines), right]],
        colWidths=[left_w + gap, right_w],
    )
    row.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    return row


def build_letterhead_table(date_text, doc_number):
    """
    Kopfzeile der Folgeseiten: Dokumenttyp und Nummer links,
    Datum rechts. In den Vorlagen steht auf Seite 2+ nichts, deshalb
    bewusst zurueckhaltend.
    """
    styles = get_company_styles()
    t = Table(
        [[
            Paragraph(f'{doc_number}', styles['VerpTiny']),
            Paragraph(date_text, styles['VerpTiny']),
        ]],
        colWidths=[CONTENT_W * 0.6, CONTENT_W * 0.4],
    )
    t.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, 0), 0.4, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    return t


def build_positions_table(headers, rows, col_widths=None, align_right=None,
                         totals=None):
    """
    Positionstabelle im Vorlagen-Stil.

    Schlicht: 0,375 pt Linien, weisse Kopfzeile mit 9 pt, keine
    Zebrastreifen, keine Akzentfarbe. In der Vorlage sind nur die
    Spaltenlinien und eine Linie unter der Kopfzeile gezeichnet.
    """
    if col_widths is None:
        col_widths = [COL_POS, COL_QTY, COL_DESC, COL_AMOUNT]
    if align_right is None:
        align_right = [len(headers) - 1]

    data = [list(headers)]
    for row in rows:
        data.append(list(row))

    style = [
        # Kopfzeile: In der Vorlage weiss mit Text 9 pt, darueber und
        # darunter je eine feine Linie.
        ('FONTSIZE', (0, 0), (-1, 0), TBL_HEADER_SIZE),
        ('FONTNAME', (0, 0), (-1, 0), FONT_REGULAR),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('LEADING', (0, 0), (-1, 0), 11),
        ('VALIGN', (0, 0), (-1, 0), 'BOTTOM'),
        ('TOPPADDING', (0, 0), (-1, 0), 4),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
        # Datenzeilen
        ('FONTSIZE', (0, 1), (-1, -1), SIZE_BODY),
        ('LEADING', (0, 1), (-1, -1), 11.5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        # Nur senkrechte Spaltenlinien, wie in der Vorlage (kein Gitter).
        ('LINEBEFORE', (0, 0), (-1, -1), 0.375, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 0.375, colors.black),
        ('LINEBELOW', (0, 0), (-1, 0), 0.375, colors.black),
        # Position und Menge zentriert, Betrag rechts
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),
    ]
    for col in align_right:
        style.append(('ALIGN', (col, 1), (col, -1), 'RIGHT'))

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle(style))

    result = [t]

    if totals:
        result.append(build_totals_table(totals))

    return result


def build_totals_table(totals):
    """
    Summenblock wie in den Vorlagen: Label linksbuendig,
    Betrag rechtsbuendig, Abschlusslinie darueber.

    Aufbau wie in der Vorlage: eine einzige Zeile je Summenposten,
    das Label links, der Betrag rechtsbuendig. Eine leere Trennspalte
    haelt den Betrag vom Label fern.
    """
    styles = get_company_styles()
    value_w = CONTENT_W * 0.30
    label_w = CONTENT_W - value_w

    rows = []
    for label, value in totals:
        rows.append([
            Paragraph(label, styles['VerpBody']),
            Paragraph(str(value), styles['VerpTotal']),
        ])

    t = Table(rows, colWidths=[label_w, value_w])
    t.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    return t


def format_amount(value, currency='€'):
    """Betrag im Format 13.362,00 € wie in der Vorlage."""
    from decimal import Decimal

    if value is None:
        value = 0
    try:
        q = Decimal(str(value)).quantize(Decimal('0.01'))
    except Exception:
        return str(value)
    s = f'{q:,.2f}'
    # Deutsche Schreibweise erzwingen
    s = s.replace(',', '\x00').replace('.', ',').replace('\x00', '.')
    return f'{s} {currency}'


# ===========================================================================
# Document Template
# ===========================================================================

class VerpDocTemplate(BaseDocTemplate):
    """
    Basis fuer alle Geschaeftsdokumente im Visitron-Layout.

    Verwendet CompanySettings automatisch; uebergibt company=None,
    um sie explizit zu setzen (z.B. in Tests).
    """

    def __init__(self, filename, company=None, continuation_text=None,
                 **kwargs):
        if company is None:
            try:
                from company.models import CompanySettings
                company = CompanySettings.get_settings()
            except Exception:
                company = None

        self.company = company
        self.continuation_text = continuation_text or ''

        kwargs.setdefault('pagesize', A4)
        kwargs.setdefault('leftMargin', MARGIN_LEFT)
        kwargs.setdefault('rightMargin', MARGIN_RIGHT)
        kwargs.setdefault('topMargin', MARGIN_TOP)
        kwargs.setdefault('bottomMargin', MARGIN_BOTTOM)
        kwargs.setdefault('allowSplitting', 1)

        super().__init__(filename, **kwargs)

        frame = Frame(
            self.leftMargin, self.bottomMargin,
            self.width, self.height,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        )
        self.addPageTemplates([
            PageTemplate(id='document', frames=frame, onPage=self._draw_page),
        ])

    # -- Briefkopf ---------------------------------------------------------
    def _draw_letterhead(self, canvas):
        """
        Logo und Unterzeile - exakt wie in der Vorlage.
        """
        path = company_logo_path()
        if path:
            try:
                img = ImageReader(path)
                iw, ih = img.getSize()
                # Seitenverhaeltnis des Logos aus der Vorlage: 192 x 57 pt
                ratio = LOGO_W / LOGO_H
                w = LOGO_W
                h = w / ratio
                if h > LOGO_H:
                    h = LOGO_H
                    w = h * ratio
                canvas.drawImage(
                    img, LOGO_X, PAGE_H - LOGO_Y_TOP - h,
                    width=w, height=h,
                    preserveAspectRatio=True, anchor='nw', mask='auto',
                )
            except Exception:
                pass

        company = self.company
        if company:
            tagline = getattr(company, 'tagline', '') or 'Bildverarbeitung · Mikroskopie'
            canvas.setFont(FONT_REGULAR, TAGLINE_SIZE)
            canvas.setFillColor(colors.black)
            # In der Vorlage endet die Unterzeile bei x=558,7 pt und ist
            # damit nicht buendig mit dem Linienende (564,1) deckungsgleich.
            canvas.drawRightString(558.7, PAGE_H - TAGLINE_Y - TAGLINE_SIZE,
                                   tagline)

    # -- Fusszeile ---------------------------------------------------------
    def _draw_footer(self, canvas):
        """
        Vier Spalten Fusszeile, 7 pt, exakt nach Vorlage.
        """
        company = self.company
        if not company:
            return

        canvas.setFont(FONT_REGULAR, FOOTER_SIZE)
        canvas.setFillColor(colors.black)

        def line(x, y, text, bold=False, size=FOOTER_SIZE):
            if not text:
                return
            canvas.setFont(FONT_BOLD if bold else FONT_REGULAR, size)
            canvas.drawString(x, PAGE_H - y, str(text))

        # Spalte 1: Firmenadresse
        x = FOOTER_COL1_X
        line(x, FOOTER_Y0, company.company_name or 'Visitron Systems GmbH')
        line(x, FOOTER_Y0 + FOOTER_LEADING, company.street or '')
        line(x, FOOTER_Y0 + 2 * FOOTER_LEADING,
             f"D-{company.postal_code or ''} {company.city or ''}".strip())

        # Spalte 2: Kontakt, fett
        x = FOOTER_COL2_X
        line(x, FOOTER_Y0, f"Tel. {company.phone or ''}", bold=True)
        line(x, FOOTER_Y0 + FOOTER_LEADING, company.email or '', bold=True)
        website = (company.website or '').replace('https://', '').replace('http://', '')
        line(x, FOOTER_Y0 + 2 * FOOTER_LEADING, website, bold=True)

        # Spalte 3: Register und Geschaeftsfuehrer
        x = FOOTER_COL3_X
        line(x, FOOTER_Y0,
             f"{company.register_court or 'Amtsgericht München'}, "
             f"{company.commercial_register or ''}".rstrip(', '))
        line(x, FOOTER_Y0 + FOOTER_LEADING, 'Geschäftsführer:')
        line(x, FOOTER_Y0 + 2 * FOOTER_LEADING, company.managing_director or '')

        # Spalte 4: Bank
        x = FOOTER_COL4_X
        line(x, FOOTER_Y0, company.bank_name or '')
        line(x, FOOTER_Y0 + FOOTER_LEADING, f"BIC Code: {company.bic or ''}"
             if company.bic else '')
        line(x, FOOTER_Y0 + 2 * FOOTER_LEADING, company.iban or '')

    # -- Seitenaufbau ------------------------------------------------------
    def _draw_page(self, canvas, doc):
        canvas.saveState()
        canvas.setTitle(getattr(doc, 'verp_title', '') or '')

        page_num = canvas.getPageNumber()

        if page_num == 1:
            self._draw_letterhead(canvas)
            # Trennlinie unter dem Briefkopf
            canvas.setStrokeColor(colors.black)
            canvas.setLineWidth(1)
            canvas.line(RULE_X0, PAGE_H - RULE_Y, RULE_X1, PAGE_H - RULE_Y)
        elif self.continuation_text:
            # Kopfzeile auf Folgeseiten
            canvas.setFont(FONT_REGULAR, SIZE_TINY)
            canvas.setFillColor(colors.black)
            canvas.drawString(MARGIN_LEFT, PAGE_H - 1.6 * cm,
                              self.continuation_text)
            canvas.setStrokeColor(colors.black)
            canvas.setLineWidth(0.4)
            canvas.line(MARGIN_LEFT, PAGE_H - 1.75 * cm,
                        PAGE_W - MARGIN_RIGHT, PAGE_H - 1.75 * cm)

        self._draw_footer(canvas)
        canvas.restoreState()


# ===========================================================================
# Abwaertskompatibilitaet
# ===========================================================================

# Frueher gingen die Seitenraender ueber den Konstruktor, einige Module
# setzen topMargin selbst. Hier zentral definieren, damit alle
# Generatoren dieselben Werte verwenden.
DOC_MARGINS = {
    'left': MARGIN_LEFT,
    'right': MARGIN_RIGHT,
    'top': MARGIN_TOP,
    'bottom': MARGIN_BOTTOM,
}
