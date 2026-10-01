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
# Der Textblock der Vorlage laeuft von x=71,0 bis x=558,6 pt. Links sind
# das die Standardraender 2,5 cm, rechts jedoch nur 1,3 cm - die Vorlage
# nutzt dort den vollen Satzspiegel aus.
#
# Wichtig: stimmen die Raender nicht mit der Vorlage ueberein, passt die
# Zeile aus Adressblock und Dokumentbox nicht mehr in den Satzspiegel.
# ReportLab staucht dann die Spalten (gemessen: auf 92,9 %), und alle
# x-Positionen verschieben sich um mehrere Punkt nach links.
MARGIN_LEFT = 2.5 * cm      # 71,0 pt
MARGIN_RIGHT = 1.3 * cm     # 36,9 pt
# Oberkante des Textblocks: die Absenderzeile beginnt bei y=131,4 pt,
# der Kontaktblock rechts bei y=122,6 pt.
MARGIN_TOP = 4.3 * cm       # 121,9 pt
MARGIN_BOTTOM = 3.2 * cm

CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT  # 487,6 pt = 17,2 cm

# --- Logo ---------------------------------------------------------------
# Q-373Du-0826.pdf: das Logo ist gesetzter Text, kein Bild. Es steht
# zweizeilig gestapelt von x=409,2 bis x=558,4 pt und y=36,7 bis 82,0 pt.
# Aus dieser Flaeche wurde backend/company/default_logo.png geschnitten,
# deshalb entspricht das Seitenverhaeltnis 3,14 dem Schnitt.
LOGO_X = 386.0
# Oberkante 31,0 pt, Unterkante 87,1 pt. Die Trennlinie liegt bei 88,5 pt,
# das Logo muss also hoeher stehen als seine eigene Unterkante vermuten
# laesst - in Q-373Du endet der Logosatz bei y=82,0, es bleiben 6,5 pt
# bis zur Linie. Deshalb wird der Wert so gesetzt, dass die Unterkante
# bei LOGO_BOTTOM sitzt, nicht die Oberkante bei LOGO_Y_TOP.
LOGO_BOTTOM = 82.0
LOGO_W = 176.0               # Schnittbreite 386..562 pt
LOGO_RATIO = 3.138           # 176,0 x 56,1 pt aus dem Schnitt
LOGO_H = LOGO_W / LOGO_RATIO
LOGO_Y_TOP = LOGO_BOTTOM - LOGO_H    # 25,9 pt

# Unterzeile "Bildverarbeitung · Mikroskopie": x=424,8, y=92,8, 10 pt.
# In der Vorlage endet sie bei x=558,8 pt - also buendig mit dem Logo.
TAGLINE_Y = 92.8
TAGLINE_SIZE = 10
TAGLINE_X_RIGHT = 558.8

# Trennlinie unter dem Briefkopf: x=71,0 .. 564,2 pt, y=88,5, 1 pt
RULE_Y = 88.5
RULE_X0 = 71.0
RULE_X1 = 564.2

# --- Empfaengerblock ----------------------------------------------------
# Q-373Du hat um den Empfaengerblock KEINEN Rahmen. Es gibt nur eine
# Trennlinie in der Breite des Adressfeldes, und zwar zwischen der
# Absenderzeile (oben) und dem Empfaenger (unten):
#
#   Visitron Systems GmbH              <- 7 pt, y=136,2
#   -------------------------------    <- Linie y=145,6, x 71,0..303,8
#   Frau                                 <- 10 pt, y=161,2
#   Dr. Ute Becherer
#   ...
#
# Die Linie traegt zugleich die Absenderzeile - wie in Q-373Du liegen
# Firmenname und Trennlinie unmittelbar uebereinander.
ADDR_BOX_X0 = 71.0
ADDR_BOX_X1 = 303.8          # rechte Kante der Trennlinie
ADDR_RULE_Y = 145.6          # Trennlinie zwischen Absender und Empfaenger
# Der Empfaengertext sitzt 7,4 pt rechts vom Satzspiegelrand, die
# Absenderzeile ist innerhalb des Feldes zentriert.
ADDR_TEXT_INDENT = 7.4

# Absenderzeile ueber der Linie (7 pt)
ADDR_SENDER_SIZE = 7

# Empfaengertext (10 pt), Zeilenabstand 11,4 pt
ADDR_SIZE = 10
ADDR_LEADING = 11.4
# --- Adressblock: vertikale-Rhythmen aus Q-373Du -----------------------
# Von oben nach unten, alle y-Werte aus der Vorlage:
#   136,2  "Visitron Systems GmbH"           7 pt
#   145,6  Trennlinie                         0,1 pt
#   147,4  "Gutenbergstr. 3, D-82178 Puch."  7 pt
#   161,2  "Frau ..."                         10 pt
#
# Die Linie verlaufen ZWISCHEN DEN BEIDEN ABSENDERZEILEN, also mitten
# im Absenderabsatz. Ein Absatz aus zwei Zeilen liefert das nicht -
# die Linie kaeme dann unter dem ganzen Absender zu liegen. Deshalb
# sind es vier Zeilen: Firmenname, Linie, Absenderadresse, Empfaenger.

# Zeilenhoehe eines einzeiligen 7-pt-Absatzes. Der sichtbare Zeilen-
# abstand der Vorlage betraegt 147,4 - 136,2 = 11,2 pt; die Differenz
# von 2,1 pt zur Absatzhoehe traegt ein TOPPADDING der Folgezeile.
ADDR_SENDER_LEADING = 9
ADDR_SENDER_PITCH = 0.6

# Hoehe der Trennlinien-Zeile: die Linie sitzt an deren Unterkante und
# markiert damit exakt den Abstand Absenderzeile -> Linie.
ADDR_RULE_ROW = 1.6

# Luft zwischen Linie und erster Empfaengerzeile (145,6 -> 161,2 =
# 15,6 pt sichtbar). Der 10-pt-Absatz setzt seinen Text nochmals
# rund 7 pt unter die Zellkante, der Wert ist deshalb groesser.
ADDR_GAP = 5.0

# Der Adressblock beginnt in der Vorlage 13,6 pt unter dem Kontaktblock
# rechts. Beide stehen in derselben Zeile, sind aber nicht buendig -
# deshalb ein fester Versatz statt BOTTOM-Ausrichtung.
ADDR_TOP_OFFSET = 14.9

# --- Dokumentbox -------------------------------------------------------
# Q-373Du: Rechte Box x=411,5 .. 559,1 pt, y=193,7 .. 267,6 pt.
# D276 (Lieferschein) liegt mit x=353,9 .. 559,6, y=189,5 .. 264,3
# weiter links. Q-373Du ist die Referenz, D276 zeigt nur die Variante
# mit breiterem Kasten fuer laengere Nummern - der Rahmen bleibt gleich.
#
# Wichtig: Die Box endet bei y=267,6, das Adressfeld bei y=254,8.
# Die Box ragt also 12,8 pt UNTER das Adressfeld hinaus und sitzt
# damit nicht auf halber Hoehe, sondern tiefer.
DOC_BOX_X0 = 411.5
DOC_BOX_X1 = 559.1
DOC_BOX_W = DOC_BOX_X1 - DOC_BOX_X0          # 147,6 pt
DOC_BOX_Y0 = 193.7
DOC_BOX_H = 74.0
# Innenabstand des Textes vom Rahmen. Q-373Du: Oberkante 193,7,
# erste Textzeile 200,8 -> 7,1 pt; Unterkante 267,7, letzte Zeile
# endet 261,2 -> 6,5 pt. Mit 6 pt sitzt der Text bei mehreren Zeilen
# sonst unten auf, weil die Zeilenzahl die Box nicht mitwachsen liess.
DOC_BOX_PAD = 7
# Innenabstand des Textes von der Kastenkante seitlich.
DOC_BOX_SIDE_PAD = 6

DOC_TITLE_SIZE = 12   # "ANGEBOT" ist 12 pt fett
DOC_NUM_SIZE = 12     # die Folgezeilen in der Box ebenfalls 12 pt

# Kontaktblock Visitron ueber der Box (Q-373Du x=445,3 .. 558,8, y=122,6..184,6)
# 10 pt, ohne Rahmen - nur die Dokumentbox ist gerahmt.
CONTACT_X = 445.8
CONTACT_SIZE = 10
# Zeilenabstand des Kontaktblocks. Q-373Du: 122,6 / 136,0 / 148,0 /
# 160,0 / 172,0 - nach der ersten Zeile also 12,0 pt. Mit 13,4 pt
# rutscht die letzte Zeile um 5,3 pt zu tief und drueckt die
# Dokumentbox nach unten.
CONTACT_LEADING = 12.0

# Datumszeile: "Datum:" 9 pt bei x=412,4, Wert 10 pt ab x=450,8, y=285,7.
# Das Label ist 0,9 pt gegenueber der Boxkante eingerueckt, der Wert
# beginnt 39,3 pt nach der Boxkante. Die Spaltenbreite richtet sich
# deshalb nach der Boxkante, nicht nach der Labelposition - sonst
# ruecken Label und Wert um je 0,9 pt nach links.
DATE_LABEL_X = 412.4
DATE_VALUE_X = 450.8
DATE_Y = 285.7
DATE_LABEL_SIZE = 9
DATE_LABEL_INSET = DATE_LABEL_X - DOC_BOX_X0      # 0,9 pt
DATE_VALUE_INSET = DATE_VALUE_X - DOC_BOX_X0     # 39,3 pt

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
        fontName=FONT_REGULAR, fontSize=ADDR_SENDER_SIZE,
        leading=ADDR_SENDER_LEADING,
        alignment=TA_CENTER, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        name='VerpContact',
        fontName=FONT_REGULAR, fontSize=CONTACT_SIZE, leading=CONTACT_LEADING,
        textColor=colors.black,
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

    Das in den Firmeneinstellungen gepflegte Bild hat Vorrang. Ist das
    Feld leer (es ist optional), greift das mitgelieferte Standard-Logo,
    das exakt aus Q-373Du-0826.pdf geschnitten wurde
    (backend/company/default_logo.png).

    So kann im Admin ein eigenes Logo gepflegt werden, ohne dass ein
    leeres Feld zu einem Logo-freien Briefkopf fuehrt.
    """
    from django.conf import settings

    try:
        from company.models import CompanySettings

        company = CompanySettings.get_settings()
        if company and company.document_header:
            try:
                path = company.document_header.path
                if path and os.path.exists(path):
                    return path
            except (ValueError, NotImplementedError):
                # Leeres oder nicht gespeichertes Feld
                pass
            name = getattr(company.document_header, 'name', '') or ''
            if name:
                fallback = os.path.join(settings.MEDIA_ROOT, name)
                if os.path.exists(fallback):
                    return fallback
    except Exception:
        pass

    default = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           '..', 'company', 'default_logo.png')
    default = os.path.abspath(default)
    return default if os.path.exists(default) else None


def format_phone(value):
    """
    Telefonnummer wie in der Vorlage: "089 / 890 245 0".

    Gespeichert ist "0898902450". Die Vorlage gruppiert von rechts in
    Blöcke von 3, 3, 3 und den Rest - daraus wird "089 / 890 245 0".
    Ist die Nummer bereits formatiert (enthält Leerzeichen, Schrägstriche
    oder Bindestriche), wird sie unverändert übernommen.
    """
    if not value:
        return ''
    raw = str(value).strip()
    if not raw.isdigit():
        return raw

    if len(raw) <= 3:
        return raw

    # Q-373Du: "089 / 890 245 0" - Vorwahl, dann von vorn in Dreiergruppen.
    # 0898902450 -> 089 + 890 + 245 + 0
    prefix, rest = raw[:3], raw[3:]
    groups = []
    while rest:
        groups.append(rest[:3])
        rest = rest[3:]

    return f"{prefix} / {' '.join(groups)}"


def tagline_for(company, language='de'):
    """
    Unterzeile unter dem Logo, sprachabhaengig.

    Standard sind "Bildverarbeitung · Mikroskopie" (de) und
    "Imaging · Microscopy" (en). Beide Werte sind auf CompanySettings
    pflegbar; ein bewusst abweichender deutscher Text gilt dann fuer
    beide Sprachen, weil er als Festlegung gemeint ist.
    """
    if not company:
        return 'Bildverarbeitung · Mikroskopie'

    is_en = str(language or '').lower().startswith('en')
    if is_en:
        return (getattr(company, 'tagline_english', '') or '').strip() \
            or 'Imaging · Microscopy'

    return (getattr(company, 'tagline', '') or '').strip() \
        or 'Bildverarbeitung · Mikroskopie'


def build_address_box(company, address_lines):
    """
    Empfaengerblock wie in Q-373Du: KEIN Rahmen.

    Aufbau von oben nach unten (Vorlage Q-373Du):
        "Visitron Systems GmbH"              7 pt
        ------------------------------------  Trennlinie
        "Gutenbergstr. 3, D-82178 Puchheim"   7 pt
        (Luft)
        "Frau ..."                            10 pt

    Die Linie verlauft in der Vorlage ZWISCHEN DEN BEIDEN ABSENDERZEILEN,
    also mitten im Absenderabsatz. Ein Absenderabsatz aus zwei Zeilen
    liefert das nicht - die Linie kaeme dann unter dem ganzen Absender
    zu liegen. Deshalb sind es hier vier Zeilen: Firmenname, Linie,
    Absenderadresse, Empfaenger.

    Wichtig: je EIN Element pro Zeile. Mit einer einzigen Zelle zeichnet
    LINEBELOW die Linie unter allem - also unter dem Empfaenger statt
    zwischen den Absenderzeilen. Gegenueber der Vorlage lag sie dadurch
    rund 70 pt zu tief.
    """
    styles = get_company_styles()
    addr_w = ADDR_BOX_X1 - ADDR_BOX_X0

    company_name = company.company_name if company else ''
    if not company_name:
        company_name = 'Visitron Systems GmbH' if company is None else ''

    street = (company.street or '').strip() if company else ''
    hnr = (company.house_number or '').strip() if company else ''
    if street and hnr:
        street = f"{street} {hnr}"
    city = f"D-{company.postal_code or ''} {company.city or ''}".strip() \
        if company else ''
    # Q-373Du: "GutenbergstraÃŸe 3, D-82178 Puchheim" in EINER Zeile
    sender_addr = ', '.join(p for p in (street, city) if p)

    name_cell = Paragraph(company_name, styles['VerpAddressSender'])
    sender_cell = Paragraph(sender_addr, styles['VerpAddressSender'])
    address_cell = Paragraph('<br/>'.join(address_lines or ['']),
                             styles['VerpAddress'])

    # Trennlinien-Zeile: die Linie sitzt an der Unterkante, ihre Hoehe
    # ist damit genau der Abstand Absenderzeile -> Linie.
    rule_cell = Table([['']], colWidths=[addr_w],
                      rowHeights=[ADDR_RULE_ROW])
    rule_cell.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 0.1, colors.black),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    box = Table([[name_cell], [rule_cell], [sender_cell], [address_cell]],
                colWidths=[addr_w])
    box.setStyle(TableStyle([
        # Die Box selbst hat keinen Einzug - die Trennlinie soll laut
        # Vorlage exakt beim Satzspiegelrand (71,0 pt) beginnen. Der
        # Einzug sitzt deshalb nur auf den Textzellen, die Linie
        # laeuft ohne Einzug ueber die volle Feldbreite.
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (0, 0), ADDR_TEXT_INDENT),
        ('LEFTPADDING', (0, 2), (0, 2), ADDR_TEXT_INDENT),
        ('LEFTPADDING', (0, 3), (0, 3), ADDR_TEXT_INDENT),
        # Achtung: Die Koordinaten lauten (SPALTE, ZEILE). Die Box hat
        # EINE Spalte und vier Zeilen - Firmenname (0), Linie (1),
        # Absenderadresse (2), Empfaenger (3). Ein (2, 0) waere Spalte 2
        # und liegt ausserhalb der Tabelle; ReportLab verwirft solche
        # Angaben stillschweigend, der Abstand waere wirkungslos.
        # Zeilenabstand des Absenders auf 11,2 pt bringen (Vorlage).
        ('TOPPADDING', (0, 2), (0, 2), ADDR_SENDER_PITCH),
        # Luft zwischen Linie und erster Empfaengerzeile.
        ('TOPPADDING', (0, 3), (0, 3), ADDR_GAP),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return box


def build_contact_block(company, language='de'):
    """
    Kontaktangaben der Firma rechts oben, ueber der Dokumentbox.

    In Q-373Du ohne Rahmen: Adresse, Telefon, Telefax, E-Mail - jeweils
    10 pt, Zeilenabstand 13,4 pt. Steht linksbuendig bei x=445,8 pt.
    """
    if not company:
        return None

    styles = get_company_styles()
    lines = []

    street = (company.street or '').strip()
    hnr = (company.house_number or '').strip()
    if street and hnr:
        lines.append(f"{street} {hnr}")
    elif street:
        lines.append(street)

    lines.append(f"D-{company.postal_code or ''} {company.city or ''}".strip())
    lines.append(f"Telefon: {format_phone(company.phone)}")

    if company.fax:
        lines.append(f"Telefax: {format_phone(company.fax)}")

    if company.email:
        lines.append(f"Email:    {company.email}")

    if not lines:
        return None

    return Paragraph('<br/>'.join(lines), styles['VerpContact'])


def build_document_box(lines):
    """
    Rechter Kasten mit Dokumenttyp, Nummer und Zusatzinfos.

    Der Rahmen ist vollstaendig geschlossen (in Q-373Du eine 0,1 pt
    Linie an allen vier Seiten), Titel 12 pt fett, Rest 12 pt.

    Die Hoehe ist NICHT fest: Q-373Du hat zwei Zeilen ("ANGEBOT" /
    "Q-373Du-08/26") und damit 74 pt. Ein Leihlieferschein bringt es
    auf vier bis fuenf Zeilen (Verleihdatum, Rueckgabefrist). Mit
    festen 74 pt ragte die letzte Zeile dann rund 4 pt aus dem Rahmen
    heraus. Deshalb wird die tatsaechliche Texthoehe gemessen und die
    Box auf diesen Wert plus Innenabstand gesetzt. Die Oberkante bleibt
    bei DOC_BOX_Y0, weil die Box dort verankert wird.
    """
    styles = get_company_styles()
    avail = DOC_BOX_W - 2 * DOC_BOX_SIDE_PAD

    def passend(text, style, fontname, size):
        """
        Verkleinert die Schrift, bis der Text in EINER Zeile passt.

        Die Kastenbreite ist mit 147,6 pt fest vorgegeben. Ein langer
        Dokumenttyp wie "AUFTRAGSBESTAETIGUNG" braucht bei 12 pt Bold
        aber 154 pt und wuerde sonst mitten im Wort umbrechen
        ("AUFTRAGSBESTAETIG / UNG"). Das sieht nach einem Fehler aus,
        deshalb wird die Groesse hier so weit reduziert, dass ein
        Wortsschwund nicht mehr auftritt. Ab 9 pt wird nicht weiter
        verkleinert - dann ist eine Silbentrennung vorzuziehen.
        """
        from reportlab.pdfbase.pdfmetrics import stringWidth
        breite = stringWidth(text, fontname, size)
        if breite <= avail or size <= 9:
            return size
        return max(9, size * avail / breite)

    content = []
    for i, (text, bold) in enumerate(lines):
        basis = styles['VerpDocTitle'] if i == 0 else styles['VerpDocInfo']
        groesse = passend(text, basis,
                          FONT_BOLD if i == 0 else FONT_REGULAR,
                          DOC_TITLE_SIZE if i == 0 else DOC_NUM_SIZE)
        # Wichtig: basis klonen. get_company_styles() baut die Format-
        # vorlagen bei jedem Aufruf neu auf, aber der Basis-Style selbst
        # waere sonst ein gemeinsames Objekt - eine Aenderung an
        # p.style.fontSize wuerde stillschweigend auch die uebrigen
        # Zeilen treffen.
        st = ParagraphStyle(
            name=f'docbox{i}', parent=basis,
            fontSize=groesse, leading=groesse + 2,
        )
        content.append(Paragraph(text, st))

    inner = Table([[content]], colWidths=[DOC_BOX_W - 2 * DOC_BOX_SIDE_PAD])
    inner.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    # Q-373Du: Rahmenoberkante 193,7, erste Textzeile 200,8 -> 7,1 pt
    # Innenabstand oben. Unten bleiben 267,7 - 261,2 = 6,5 pt. Beide
    # Seiten sollen gleich sein, sonst klebt der Text unten an.
    box_h = max(DOC_BOX_H, inner.wrap(DOC_BOX_W, 0)[1]
                + 2 * DOC_BOX_PAD)

    box = Table([[inner]], colWidths=[DOC_BOX_W], rowHeights=[box_h])
    box.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.1, colors.black),
        ('LEFTPADDING', (0, 0), (-1, -1), DOC_BOX_SIDE_PAD),
        ('RIGHTPADDING', (0, 0), (-1, -1), DOC_BOX_SIDE_PAD),
        ('TOPPADDING', (0, 0), (-1, -1), DOC_BOX_PAD),
        ('BOTTOMPADDING', (0, 0), (-1, -1), DOC_BOX_PAD),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return box


def build_address_and_doc_row(address_lines, doc_box, company, date_text='',
                              language='de'):
    """
    Zeile mit Empfaengerblock links und Kontakt + Dokumentbox rechts,
    darunter die Datumszeile - so wie in Q-373Du.

    Aufbau von oben nach unten rechts:
        Kontaktangaben der Firma (ohne Rahmen)
        Dokumentbox (mit Rahmen)
        Datum: <Datum> / <Kuerzel>

    Das Adressfeld links laeuft in Q-373Du von y=136,2 bis y=254,8,
    die Dokumentbox von y=193,7 bis y=267,6. Die Box ragt also unter das
    Adressfeld hinaus. Beide Bloecke werden deshalb BOTTOM ausgerichtet -
    die Zeile waechst nach unten, nicht nach oben.

    Wichtig: "Datum:" und der Wert stehen in GLEICHER Schriftgroesse
    (10 pt). In Q-373Du ist das Label 9 pt, der Wert 10 pt; die
    Vorlage selbst ist hierin inkonsistent. Der Wert wird wie das
    Label gesetzt, damit die Zeile nicht hopt.
    """
    left_w = ADDR_BOX_X1 - ADDR_BOX_X0
    gap = DOC_BOX_X0 - ADDR_BOX_X1
    right_w = DOC_BOX_X1 - DOC_BOX_X0

    styles = get_company_styles()

    # Rechte Spalte: Kontaktblock, Dokumentbox, Datum
    right = []
    contact = build_contact_block(company, language)
    if contact is not None:
        # Der Kontaktblock ist gegenueber der Dokumentbox nach rechts
        # eingerueckt (Q-373Du: 445,8 statt 411,5 pt). Er belegt deshalb
        # die volle Satzspiegelbreite und richtet seinen Text nur innen
        # aus - sonst muesste die Spalte schrumpfen und der Text bricht.
        inset = CONTACT_X - DOC_BOX_X0
        contact_box = Table([[contact]], colWidths=[right_w])
        contact_box.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), inset),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        # Q-373Du: erste Kontaktzeile y=122,6, letzte y=172,0, Boxoberkante
    # y=193,7. Die fuenf Kontaktzeilen belegen 5 x 13,4 = 67,0 pt, der
    # Text beginnt 1,5 pt unter der Zeilenkante. Zwischen letzter Zeile
    # und Box bleiben 21,7 - 13,4 = 8,3 pt.
    right.append(contact_box)
    # Q-373Du: letzte Kontaktzeile endet 172,0 + 13,4 = 185,4 (Text
    # selbst bis ca. 178,6), Boxoberkante 193,7. Zwischen dem letzten
    # sichtbaren Kontaktzeichen und der Box bleiben knapp 15 pt. Der
    # Absatz setzt die letzte Zeile nochmals 3,5 pt unter die
    # Zeilenkante, das kommt hiervon ab.
    right.append(Spacer(1, 11.8))
    right.append(doc_box)
    # Q-373Du: Boxunterkante 267,7, Datumstext 285,6 -> 17,9 pt Luft.
    # Der Spacer sitzt direkt unter der Box und ist deshalb unabhaengig
    # von deren Zeilenzahl - die Box waechst nach oben hin, nicht nach
    # unten. 0,8 pt der Angabe frisst der Absatz der Datumszelle.
    right.append(Spacer(1, 18.7))

    # Datum: Label und Wert in derselben Groesse, wie in D276.
    # Leerzeichen am Anfang des Werts werden geschuetzt - ohne das
    # kollabiert ReportLab sie im Absatz ("21.01.2026/Marcel").
    date_label = 'Date:' if language == 'en' else 'Datum:'
    date_cell = Table(
        [[Paragraph(date_label, styles['VerpBody']),
          Paragraph((date_text or '').replace(' ', '&nbsp;'),
                    styles['VerpBody'])]],
        colWidths=[DATE_VALUE_INSET, right_w - DATE_VALUE_INSET],
    )
    date_cell.setStyle(TableStyle([
        # Label 0,9 pt einruecken wie in der Vorlage.
        ('LEFTPADDING', (0, 0), (0, 0), DATE_LABEL_INSET),
        ('LEFTPADDING', (1, 0), (1, 0), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    right.append(date_cell)

    row = Table(
        [[build_address_box(company, address_lines), right]],
        colWidths=[left_w + gap, right_w],
    )
    row.setStyle(TableStyle([
        # TOP statt BOTTOM: der Adressblock beginnt in der Vorlage 13,6 pt
        # unter dem Kontaktblock. Bei BOTTOM wuerde die hoehere rechte
        # Spalte den Adressblock nach oben in den Briefkopf schieben.
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (0, 0), ADDR_TOP_OFFSET),
        ('TOPPADDING', (1, 0), (1, 0), 0),
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

    # Die Tabelle soll in Q-373Du die komplette Satzspiegelbreite
    # umspannen. Die Generatoren geben ihre Spaltenbreiten in Zentimeter
    # an und addieren auf 14,0 bis 16,0 cm, der Satzspiegel ist aber
    # CONTENT_W = 17,2 cm breit. Statt jede Datei einzeln umzubauen,
    # werden die Breiten hier proportional auf CONTENT_W gestreckt -
    # das Seitenverhaeltnis der Spalten bleibt erhalten.
    total_w = sum(col_widths)
    if abs(total_w - CONTENT_W) > 0.5:
        col_widths = [w * CONTENT_W / total_w for w in col_widths]

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
        # Die Vorlage hat eine Linie UEBER der Kopfzeile und eine darunter.
        ('LINEBEFORE', (0, 0), (-1, -1), 0.375, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 0.375, colors.black),
        ('LINEABOVE', (0, 0), (-1, 0), 0.375, colors.black),
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
                 language='de', **kwargs):
        if company is None:
            try:
                from company.models import CompanySettings
                company = CompanySettings.get_settings()
            except Exception:
                company = None

        self.company = company
        self.continuation_text = continuation_text or ''
        self.language = language or 'de'

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
        Logo und Unterzeile - exakt wie in Q-373Du.
        """
        path = company_logo_path()
        if path:
            try:
                img = ImageReader(path)
                iw, ih = img.getSize()
                # Seitenverhaeltnis aus dem Schnitt der Vorlage (3,138).
                # Ist das geladene Logo flacher, wird es hoeher gesetzt,
                # damit es nicht ueber die Trennlinie in den Text ragt.
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

        tagline = tagline_for(self.company, self.language)
        canvas.setFont(FONT_REGULAR, TAGLINE_SIZE)
        canvas.setFillColor(colors.black)
        # In Q-373Du endet die Unterzeile bei x=558,8 pt, also buendig
        # mit der rechten Kante der Dokumentbox.
        canvas.drawRightString(TAGLINE_X_RIGHT, PAGE_H - TAGLINE_Y - TAGLINE_SIZE,
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
