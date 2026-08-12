"""
Hilfsfunktionen zum Bereinigen und Konvertieren von Rich-Text-Notizen.

Sicherheit: Benutzer-eingegebenes HTML wird vor dem Speichern UND vor der
PDF-Ausgabe bereinigt. Für Servicebericht-PDFs ist nur eine ReportLab-kompatible
HTML-Subset erlaubt (b, i, u, br, p, ul/ol/li, h1-h3, strong, em).
"""
import bleach
import re
from bleach.css_sanitizer import CSSSanitizer
from html import unescape


# Tags, die der Editor liefern darf (Tiptap-Output subset)
ALLOWED_EDITOR_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3',
    'span', 'div',
]

# Tags, die im PDF (ReportLab) gerendert werden können.
# ReportLab-Paragraph unterstützt nur eine begrenzte HTML-Subset.
ALLOWED_PDF_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3',
    'span',
]

# Erlaubte Inline-Styles für PDF (nur Schrift-Eigenschaften)
_PDF_CSS_SANITIZER = CSSSanitizer(
    allowed_css_properties=[
        'font-size', 'font-family', 'font-weight', 'font-style',
        'text-decoration', 'color',
    ]
)


def sanitize_editor_html(raw_html):
    """Bereinigt vom Frontend (Tiptap) gesendetes HTML."""
    if not raw_html:
        return ''
    cleaned = bleach.clean(
        raw_html or '',
        tags=ALLOWED_EDITOR_TAGS,
        attributes={},
        strip=True,
        strip_comments=True,
    )
    return cleaned.strip()


def sanitize_for_pdf(raw_html):
    """
    Bereinigt HTML speziell fuer die ReportLab-PDF-Ausgabe.
    Erlaubt nur inline-styles wie font-size und font-family.
    Konvertiert <br> in <br/> damit ReportLab es akzeptiert.
    """
    if not raw_html:
        return ''
    cleaned = bleach.clean(
        raw_html or '',
        tags=ALLOWED_PDF_TAGS,
        attributes={'*': ['style'], 'span': ['style'], 'p': ['style']},
        css_sanitizer=_PDF_CSS_SANITIZER,
        strip=True,
        strip_comments=True,
    )
    # ReportLab verlangt <br/> statt <br>
    cleaned = re.sub(r'<br\s*/?>', '<br/>', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def html_to_plain_text(raw_html):
    """Konvertiert HTML in reinen Text (fuer Listenansicht / Fallback)."""
    if not raw_html:
        return ''
    cleaned = bleach.clean(
        raw_html,
        tags=ALLOWED_EDITOR_TAGS,
        attributes={},
        strip=True,
    )
    for tag in ('</p>', '</li>', '</h1>', '</h2>', '</h3>', '<br>', '<br/>', '<br />'):
        cleaned = cleaned.replace(tag, '\n')
    cleaned = bleach.clean(cleaned, tags=[], attributes={}, strip=True)
    text = unescape(cleaned)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return '\n'.join(lines)


def plain_text_to_html(text):
    """Konvertiert Legacy-Plain-Text in sicheres HTML fuer den Editor."""
    if not text:
        return ''
    escaped = (
        text.replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('\n', '<br/>')
    )
    return f'<p>{escaped}</p>'


# ---------------------------------------------------------------------------
# PDF-spezifische Konvertierung: HTML in einzelne ReportLab-Paragraphen zerlegen
# ---------------------------------------------------------------------------

# Sehr einfacher Blockparser: findet Top-Level <p>, <h1-3>, <ul>, <ol> Bloecke
_BLOCK_SPLIT_RE = re.compile(
    r'<(p|h[1-3]|ul|ol)(\s[^>]*)?>(.*?)</\1>',
    re.IGNORECASE | re.DOTALL,
)
_LI_SPLIT_RE = re.compile(r'<li(\s[^>]*)?>(.*?)</li>', re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r'<[^>]+>')

# Schriftgroesse (CSS px) -> ReportLab <font size="..."> Werte.
# ReportLab kennt die relativen Sizes: 8 = klein, 10 = normal, 12 = gross, etc.
_CSS_PX_TO_REPORTLAB_SIZE = {
    '10px': 8,
    '12px': 9,
    '14px': 11,
    '16px': 12,
    '18px': 14,
    '22px': 17,
    '28px': 22,
}

# Inline-Style -> ReportLab-Tag Konvertierung (innerhalb von Bloecken)
_SPAN_STYLE_RE = re.compile(
    r'<span\s+style="([^"]*)">(.*?)</span>',
    re.IGNORECASE | re.DOTALL,
)
_FONT_SIZE_RE = re.compile(r'font-size\s*:\s*([^;]+)', re.IGNORECASE)
_FONT_FAMILY_RE = re.compile(r'font-family\s*:\s*([^;]+)', re.IGNORECASE)
_FONT_WEIGHT_RE = re.compile(r'font-weight\s*:\s*(bold|bolder|700|800|900)', re.IGNORECASE)
_FONT_STYLE_RE = re.compile(r'font-style\s*:\s*(italic|oblique)', re.IGNORECASE)
_TEXT_DECO_RE = re.compile(r'text-decoration\s*:\s*([^;]+)', re.IGNORECASE)
_COLOR_RE = re.compile(r'color\s*:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|\w+)', re.IGNORECASE)


def _convert_inline_styles_to_rl(html_fragment):
    """
    Wandelt <span style="font-size:..; font-family:..">...</span> in
    ReportLab-konforme <font size=".." face="..">...</font> Tags um.

    ReportLab versteht nativ: <b>, <i>, <u>, <strike>, <br/>, <font>,
    <super>, <sub>, <para>, aber KEINE inline-styles.
    """
    def replace_span(match):
        style = match.group(1)
        inner = match.group(2)

        attrs = []
        size_match = _FONT_SIZE_RE.search(style)
        if size_match:
            px = size_match.group(1).strip().lower()
            rl_size = _CSS_PX_TO_REPORTLAB_SIZE.get(px)
            if rl_size:
                attrs.append(f'size="{rl_size}"')

        family_match = _FONT_FAMILY_RE.search(style)
        if family_match:
            # Nur den ersten Schriftnamen nehmen
            family = family_match.group(1).split(',')[0].strip().strip('"').strip("'")
            # Interne Schriftfamilie nur, wenn ReportLab sie kennt
            rl_fonts = {'Helvetica', 'Times-Roman', 'Times-Bold', 'Courier', 'Symbol'}
            # Sonst generischer Name
            if family not in rl_fonts:
                # Wir versuchen, einen aehnlichen ReportLab-Namen zu finden
                family_map = {
                    'Arial': 'Helvetica',
                    'Helvetica': 'Helvetica',
                    'Times New Roman': 'Times-Roman',
                    'Courier New': 'Courier',
                    'Georgia': 'Times-Roman',
                }
                family = family_map.get(family, 'Helvetica')
            attrs.append(f'face="{family}"')

        color_match = _COLOR_RE.search(style)
        if color_match:
            color = color_match.group(1).strip()
            # Hex-Farbe in ReportLab-Format (#RRGGBB)
            if color.startswith('#'):
                attrs.append(f'color="{color}"')

        if not attrs:
            # Keine verwertbaren Styles -> inner behalten, aber span entfernen
            return inner

        # Wenn bereits <b>/<i> im inner ist, koexistieren sie mit <font>
        return f'<font {" ".join(attrs)}>{inner}</font>'

    # Mehrfach durchlaufen, da span verschachtelt sein kann
    prev = None
    cur = html_fragment
    for _ in range(5):
        if prev == cur:
            break
        prev = cur
        cur = _SPAN_STYLE_RE.sub(replace_span, cur)
    return cur


def html_to_pdf_blocks(raw_html):
    """
    Zerlegt ein (bereits bereinigtes) HTML in eine Liste von Strings,
    die jeweils ein einzelner ReportLab-Paragraph werden koennen.

    Jeder <p>-Block wird zu einem Eintrag, jeder <h1>/<h2>/<h3> auch.
    <ul>/<ol> werden zu mehreren Eintraegen (bullet/number Praefix pro <li>).

    Innerhalb der Bloecke bleiben Inline-Tags (<b>, <i>, <u>, <br/>,
    <span style="font-size:..">) erhalten, weil ReportLab.Paragraph sie
    versteht.
    """
    if not raw_html:
        return []

    safe = sanitize_for_pdf(raw_html)
    if not safe:
        return []

    blocks = []
    last_end = 0
    text = safe

    for match in _BLOCK_SPLIT_RE.finditer(text):
        # Text vor dem Block (z. B. reine Zeichen) als Paragraph
        prefix = text[last_end:match.start()].strip()
        if prefix:
            plain = _TAG_RE.sub('', prefix).strip()
            if plain:
                blocks.append(_escape_br(plain))

        tag = match.group(1).lower()
        inner = match.group(3)

        if tag in ('h1', 'h2', 'h3'):
            inner_clean = _convert_inline_styles_to_rl(_strip_outer_p(inner).strip())
            if inner_clean:
                blocks.append(inner_clean)
        elif tag == 'ul':
            for li in _LI_SPLIT_RE.finditer(inner):
                bullet_inner = _convert_inline_styles_to_rl(_strip_outer_p(li.group(2)).strip())
                if bullet_inner:
                    blocks.append(f'&bull;&nbsp; {bullet_inner}')
        elif tag == 'ol':
            for idx, li in enumerate(_LI_SPLIT_RE.finditer(inner), start=1):
                li_inner = _convert_inline_styles_to_rl(_strip_outer_p(li.group(2)).strip())
                if li_inner:
                    blocks.append(f'{idx}.&nbsp; {li_inner}')
        else:  # p
            inner_clean = _convert_inline_styles_to_rl(_strip_outer_p(inner).strip())
            if inner_clean:
                blocks.append(inner_clean)

        last_end = match.end()

    # Text nach dem letzten Block
    suffix = text[last_end:].strip()
    if suffix:
        plain = _TAG_RE.sub('', suffix).strip()
        if plain:
            blocks.append(_escape_br(plain))

    return [b for b in blocks if b]


def _strip_outer_p(html_fragment):
    """Entfernt ein einzelnes umschliessendes <p>...</p>, behält aber
    den Inhalt inkl. Inline-Tags und <br/>."""
    s = html_fragment.strip()
    m = re.match(r'^<p(?:\s[^>]*)?>(.*)</p>$', s, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1)
    return s


def _escape_br(html_fragment):
    """Ersetzt uebrig gebliebene <br>-Tags durch ReportLab-kompatible <br/>."""
    return re.sub(r'<br\s*/?>', '<br/>', html_fragment, flags=re.IGNORECASE)