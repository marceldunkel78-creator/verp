"""
Excel-/CSV-Parser fuer den Lagerabgleich (siehe sync_inventory_from_excel).

Dieses Modul enthaelt bewusst KEINE Django-Imports (ausser django.conf.settings
fuer Optionalitaet), damit Header-Erkennung und Zeilennormalisierung isoliert
testbar bleiben. Die Matching-/Schreiblogik liegt im Management-Command.
"""
import csv
import json
import os
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

# =====================
# Standard-Mapping
# =====================

DEFAULT_MAPPING = {
    'min_header_matches': 3,
    'header_aliases': {
        'category': ['kategorie', 'warengruppe', 'gruppe', 'category', 'artikelgruppe', 'bereich'],
        'lfd_nr': ['lfd nr', 'lfdno', 'lfd', 'laufende nummer', 'nr', 'pos', 'position'],
        'best_nr': ['bestnr', 'best nr', 'bestellnummer', 'best-nr', 'bestellnr', 'bnr',
                    'artikelnummer', 'artikel nr', 'artnr', 'artikelnr', 'herstellernummer'],
        'serial_number': ['sn', 's n', 's/n', 'seriennummer', 'seriennr', 'serial', 'serialnumber', 'geraetenummer'],
        'customer': ['kunde', 'kundenname', 'kunden', 'client', 'customer'],
        'order_number': ['auftrag', 'auftragsnummer', 'auftrag nr', 'auftragsnr', 'kundenauftrag', 'order', 'ordernumber'],
        'supplier': ['lieferant', 'lieferanten', 'hersteller', 'supplier', 'vendor'],
        'name': ['produkt', 'produktname', 'bezeichnung', 'artikel', 'artikelbezeichnung', 'item', 'name', 'geraet'],
        'delivery_date': ['ausgeliefert', 'auslieferdatum', 'auslieferung', 'lieferdatum', 'datum', 'delivery date', 'delivered'],
        'notes': ['infos', 'info', 'bemerkung', 'bemerkungen', 'notiz', 'notizen', 'kommentar', 'comment', 'anmerkung'],
    },
    'category_mapping': {
        'kamera': 'KAMERA', 'laser': 'LASER', 'scanningtisch': 'SCANNINGTISCH',
        'filterrad': 'FILTERRAD', 'piezo': 'PIEZO', 'shutter': 'SHUTTER',
        'led': 'LED', 'inkubation': 'INKUBATION', 'tirf': 'TIRF', 'frap': 'FRAP',
        'frap-tirf': 'FRAP_TIRF', 'confocal': 'CONFOCAL', 'visiview': 'VISIVIEW',
        'dualcam': 'DUALCAM_SPLITTER', 'splitter': 'DUALCAM_SPLITTER', 'filter': 'FILTER',
        'mikroskop': 'MIKROSKOP', 'pc': 'PC', 'kabel': 'KABEL', 'software': 'SOFTWARE',
        'lichtleiter': 'LICHTLEITER', 'mikroskopadapter': 'MIKROSKOPADAPTER',
        'hbo': 'HBO_XBO', 'xbo': 'HBO_XBO', 'orbital': 'ORBITAL', 'virtex': 'VIRTEX',
        'vs-lms': 'VS_LMS', 'sonstiges': 'SONSTIGES',
    },
    'optional_columns': {
        'quantity': ['menge', 'stuck', 'stueck', 'anzahl', 'quantity', 'qty', 'bestand', 'lagerbestand'],
        'unit': ['einheit', 'unit'],
        'firmware_version': ['firmware', 'firmware version', 'firmwareversion', 'fw version'],
        'firmware_notes': ['firmwarenotizen', 'firmware notizen', 'firmware notes'],
    },
    'skip_sheets': [],
    'only_sheets': [],
}

MAPPING_FILE = Path(__file__).resolve().parent / 'excel_mapping.json'


# =====================
# Fehlerklassen
# =====================

class SourceFileError(Exception):
    """Basisklasse fuer Probleme beim Lesen einer Quelldatei."""


class SourceFileLocked(SourceFileError):
    """Die Datei ist gesperrt, typischerweise weil sie in Excel offen ist.

    Das ist ein temporaerer Zustand: der Lauf sollte NICHT abbrechen, die
    Datei wird beim naechsten Lauf nachgeholt.
    """


class SourceFileUnreadable(SourceFileError):
    """Die Datei ist dauerhaft nicht lesbar (Defekt, fehlende Bibliothek)."""

# =====================
# Hilfsfunktionen
# =====================


def load_mapping(mapping_path=None):
    """Laedt das Mapping aus JSON; faellt auf DEFAULT_MAPPING zurueck."""
    candidates = []
    if mapping_path:
        candidates.append(Path(mapping_path))
    env_path = os.environ.get('INVENTORY_EXCEL_MAPPING')
    if env_path:
        candidates.append(Path(env_path))
    candidates.append(MAPPING_FILE)

    for candidate in candidates:
        try:
            if candidate and candidate.exists():
                with open(candidate, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                merged = dict(DEFAULT_MAPPING)
                merged.update({k: v for k, v in data.items() if not k.startswith('_')})
                return merged
        except (OSError, ValueError):
            continue
    return dict(DEFAULT_MAPPING)


def _normalize_header(value):
    """Kleinschreibung, Unicode-Normalisierung, Sonderzeichen und Leerzeichen vereinheitlichen."""
    if value is None:
        return ''
    text = unicodedata.normalize('NFKD', str(value))
    text = text.replace('ß', 'ss').replace('ä', 'a').replace('ö', 'o').replace('ü', 'u')
    text = text.replace('Ä', 'a').replace('Ö', 'o').replace('Ü', 'u')
    text = text.lower()
    text = re.sub(r'[^a-z0-9/]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _build_alias_lookup(aliases):
    """Mapping normalisierter Alias -> logischer Feldname."""
    lookup = {}
    for field, alias_list in (aliases or {}).items():
        for alias in alias_list:
            key = _normalize_header(alias)
            if key:
                lookup.setdefault(key, field)
    return lookup


# Spalten, deren Name mit einem bekannten Alias BEGINNT und hinten noch
# eine Geraete-/Zusatzbezeichnung tragen. In den Lagerlisten sehr haeufig:
#     "S/N Controller", "S/N AOTF", "S/N Laser Head", "Grade, S/N Controller",
#     "Lichtleiter S/N", "Firmware Version", "Board Version", "Best. Nr. Katalog"
# Ohne diese Regel bleiben die Zeilen ohne Seriennummer - der Match laeuft
# dann nur noch ueber Produktname, was massig zu "mehrdeutig" fuehrt.
#
# Reihenfolge = Prioritaet. "Lichtleiter S/N" wird bewusst VOR "s/n"
# geprueft, damit die Zusatzbezeichnung erhalten bleibt.
FIELD_PREFIX_PATTERNS = [
    ('serial_number', r'^(?:grade\s*,?\s*)?(?:lichtleiter\s+)?s\s*/?\s*n\b'),
    ('serial_number', r'^(?:lichtleiter\s+)?s\s*n\s'),
    ('firmware_version', r'^firmware(?:\s+version)?\b'),
    ('best_nr', r'^(?:bst|best)\.?\s*nr\b'),
    ('delivery_date', r'^ausgeliefert\s+am\b'),
    ('quantity', r'^vorh\.?\s*menge\b'),
    ('notes', r'^info(?:generation)?\b'),
    ('notes', r'^zusatzinfos?\b'),
]

# Diese Felder werden bevorzugt als serial_number gemappt, wenn ein Header
# auf mehrere Muster passt.
_SERIAL_FIELD = 'serial_number'


def _match_by_prefix(normalized_header):
    """Versucht den Header ueber Praefix-Muster einem Feld zuzuordnen.

    Rueckgabe: (field, rest_text) oder (None, None). rest_text ist der
    Teil nach dem Alias und dient als Zusatzinformation.
    """
    if not normalized_header:
        return None, None
    for field, pattern in FIELD_PREFIX_PATTERNS:
        match = re.match(pattern, normalized_header)
        if not match:
            continue
        rest = normalized_header[match.end():].strip(' ,;:.-')
        # Sehr kurze Reste sind meistens Muell ("s n x"), dann ignorieren
        if field != _SERIAL_FIELD and len(rest) > 40:
            continue
        return field, rest
    return None, None


def normalize_cell(value):
    """Zelle in sauberen String umwandeln (None/NaN/Whitespace)."""
    if value is None:
        return ''
    if isinstance(value, float) and value != value:  # NaN
        return ''
    if isinstance(value, datetime):
        return value.strftime('%d.%m.%Y')
    if isinstance(value, date):
        return value.strftime('%d.%m.%Y')
    if isinstance(value, Decimal):
        return format(value, 'f')
    return str(value).replace(' ', ' ').strip()


def parse_decimal(value, default=None):
    """Deutsches Dezimalkomma und Tausendertrennzeichen tolerieren."""
    raw = normalize_cell(value)
    if not raw:
        return default
    raw = raw.replace(' ', '').replace('\xa0', '')
    if ',' in raw and '.' in raw:
        # Deutsche Schreibweise: '.' = Tausender, ',' = Dezimal
        raw = raw.replace('.', '').replace(',', '.')
    elif ',' in raw:
        # Dezimalkomma; '1.234' bleibt als Tausender interpretiert -> Punkt weg
        raw = raw.replace(',', '.')
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError):
        return default


# Werte, die in den Lagerlisten als "leer" notiert werden, aber nicht leer
# sind: sie duerfen NICHT als Seriennummer gelten, sonst wuerde der Abgleich
# massenhaft Schein-Dubletten erzeugen bzw. identische Artikel anlegen.
PLACEHOLDER_VALUES = {
    '-', '--', '---', '.', '..', '...', 'n/a', 'na', 'k.a.', 'keine',
    'kein', 'ohne', 'leer', 'null', 'nil', 'tbd', 'x', 'xx',
    '\u2026',  # …
    '\u00b7',  # ·
    '\u2022',  # •
    '\ufffd',
}


def is_placeholder(value):
    """True, wenn der Wert nur ein Platzhalter ist (z.B. '...' oder '–')."""
    raw = normalize_cell(value)
    if not raw:
        return True
    if raw.strip().lower() in PLACEHOLDER_VALUES:
        return True
    # Zeichensalat ohne alphanumerischen Inhalt (z.B. '……', '??')
    return not any(ch.isalnum() for ch in raw)


# Texte, die in der SPALTE "Kunde" der Lagerlisten stehen, aber KEIN Kunde
# sind - sondern Status-/Ortsangaben aus Listenzeilen ohne Produktnamen.
# Gemessen 2026-10-06 ueber alle Listen: 'im Haus' (240x), 'verliehen'
# (227x), 'defekt' (136x), 'zur Reparatur' (114x), 'S/N fehlt' (94x) ...
# Solche Werte duerfen das Leerkriterium des Lager-Abgleichs und des
# cleanup_empty_inventory_items NICHT blockieren - sonst ueberleben genau
# die Alt-Muellartikel, die bereinigt werden sollen. Echte Kundentexte
# (z.B. 'Gelman, Basel') bleiben unangetastet und schuetzen den Artikel.
CUSTOMER_STATUS_VALUES = {
    'im haus', 'in usa', 'in deutschland', 'verliehen', 'ausgeliehen',
    'verliehen / ausgeliehen', 'defekt', 'beschädigt', 'beschadiigt',
    'zur reparatur', 'zur reperatur', 'zur reparatur in usa',
    'zur reperatur in usa', 'reparatur', 's/n fehlt', 'sn fehlt',
    'seriennummer fehlt', 'bestellt', 'beim lieferanten bestellt',
    'bestellung wurde storniert', 'storno', 'storniert',
    'auf w1 abruf gewechselt', 'abruf', 'demo', 'demo gerät', 'demo geraet',
    'vs-demo lms', 'vs-entwicklung', 'entwicklung', 'tech.instr. demo',
    'technical inst./demo', 'inventur', 'dust protection installed',
    'unbekannt', 'ohne kundenangabe',
}

# Zusatz-Tokens fuer Schreibvarianten (z.B. 'zur Reperatur in USA').
CUSTOMER_STATUS_TOKENS = (
    'reparatur', 'reperatur', 'verleih', 'defekt', 'storno', 'im haus',
    'fehlt', 'bestellt', 'abruf',
)


def is_customer_placeholder(value):
    """True, wenn der "Kunde"-Wert gar kein Kunde ist.

    Deckt ab: leer, Platzhalter ('-', 'k.a.', ...) und Status-/Ortstexte,
    mit denen die Lagerlisten die Kundenspalte fuellen.
    """
    raw = normalize_cell(value)
    if not raw or is_placeholder(raw):
        return True
    key = raw.strip().lower()
    if key in CUSTOMER_STATUS_VALUES:
        return True
    return any(token in key for token in CUSTOMER_STATUS_TOKENS)


def clean_serial_number(value):
    """Seriennummer bereinigen.

    Aus .xls kommen Zahlen als float, dann entstehen Artefakte wie
    '10056340.0' oder bei Ganzzahlen '113.0'. Solche Werte sind in Wahrheit
    Seriennummern und keine Mengenangaben, deshalb wird die '.0'-Endung
    entfernt. Echte Dezimalangaben (unseriell fuer eine S/N) sind davon
    nicht betroffen.
    """
    raw = normalize_cell(value)
    if not raw:
        return ''
    text = raw.strip()
    if re.fullmatch(r'\d+\.0+', text):
        text = text.split('.', 1)[0]
    return text.replace(' ', '').strip()


def build_serial_key(serial_number):
    """Normalisierter Schluessel fuer den Seriennummern-Vergleich.

    Entfernt Trennzeichen und Sonderzeichen, damit 'AB-123', 'AB 123' und
    'AB123' als dieselbe Seriennummer erkannt werden. Nur fuer den Vergleich,
    nie zum Speichern.
    """
    if not serial_number:
        return ''
    text = unicodedata.normalize('NFKD', str(serial_number))
    text = re.sub(r'[^a-zA-Z0-9]', '', text)
    return text.upper()


def parse_date(value):
    """Datum in verschiedenen deutschen/ISO-Formaten; None wenn unparsbar."""
    raw = normalize_cell(value)
    if not raw:
        return None
    # Excel-Serienzahl abfangen (z.B. 45000)
    if re.fullmatch(r'\d{5}(\.\d+)?', raw):
        try:
            from openpyxl.utils.datetime import from_excel
            return from_excel(float(raw)).date()
        except Exception:
            return None
    for fmt in ('%d.%m.%Y', '%d.%m.%y', '%Y-%m-%d', '%d/%m/%Y', '%d.%m.%Y %H:%M'):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


# =====================
# Header-Erkennung / Mapping
# =====================


def map_columns(header, mapping):
    """Ordnet eine Kopfzeile den logischen Feldern zu.

    Dreistufig:
    1. Exakter Alias-Treffer
    2. Praefix-Treffer ("S/N Controller" -> serial_number + Rest "Controller")
    3. bleibt unzugeteilt -> kommt in `extra_columns` fuer das Beschreibungsfeld

    Returns: (field->index dict, unknown_headers list, extra_columns list)
        extra_columns: [{'name': Originalheader, 'index': int, 'suffix': str}]
    """
    lookup = _build_alias_lookup(mapping.get('header_aliases'))
    result = {}
    unknown = []
    extra_columns = []
    for index, raw_header in enumerate(header):
        key = _normalize_header(raw_header)
        if not key:
            continue
        original = normalize_cell(raw_header)

        field = lookup.get(key)
        if field:
            # Erster Treffer gewinnt, damit eine doppelte Alias-Spalte
            # (z.B. zweimal 'Bemerkung') nicht die erste belegte ueberschreibt.
            if field in result:
                # zweite S/N-Spalte (z.B. 'S/N' und 'S/N Controller') ->
                # nicht verlieren, sondern als Zusatzinfo fuehren
                extra_columns.append({
                    'name': original,
                    'index': index,
                    'suffix': _match_by_prefix(key)[1] or '',
                })
                continue
            result[field] = index
            continue

        field, suffix = _match_by_prefix(key)
        if field:
            if field in result:
                extra_columns.append({
                    'name': original, 'index': index, 'suffix': suffix or '',
                })
            else:
                result[field] = index
            continue

        # Mehrdeutige Praefix-Faelle: 'Lichtleiter S/N' und 'S/N' in derselben
        # Liste. Die zweite S/N-Spalte wandert in die Zusatzinfo.
        if 's n' in key or key.startswith('s n'):
            if 'serial_number' in result:
                extra_columns.append({
                    'name': original, 'index': index, 'suffix': '',
                })
                continue

        unknown.append(original)
        # Unbekannte Spalten werden NICHT verworfen, sondern als
        # Zusatzinformation weitergegeben - ihr Inhalt landet im
        # Beschreibungsfeld des Lagerartikels (z.B. "Board Version").
        extra_columns.append({
            'name': original, 'index': index, 'suffix': '',
        })
    return result, unknown, extra_columns


def detect_header(rows, mapping):
    """Findet die Kopfzeile in den ersten Zeilen.

    Returns: (header_index, columns, unknown, extra_columns) oder None.
    """
    min_matches = mapping.get('min_header_matches', 3)
    limit = min(len(rows), 20)
    best = None
    for index in range(limit):
        candidate = rows[index]
        columns, unknown, extra = map_columns(candidate, mapping)
        if len(columns) >= min_matches:
            # Frueheste qualifizierende Zeile gewinnt; bei Gleichstand
            # die mit den meisten Treffern.
            if best is None or len(columns) > len(best[1]):
                best = (index, columns, unknown, extra)
            break
    if best is None:
        return None
    return best


# =====================
# Datei-Lesen
# =====================


def _read_csv_rows(path, encodings=None):
    """CSV mit ';'-Trenner und mehreren moeglichen Encodings lesen."""
    if encodings is None:
        # utf-8-sig zuerst: damit wird ein BOM entfernt. Ohne diese
        # Reihenfolge wuerde cp1252 das BOM als Muellzeichen in die
        # erste Kopfzelle schreiben und die Spalte unerkannt lassen.
        encodings = ['utf-8-sig', 'cp1252', 'latin-1', 'iso-8859-1']
    content = None
    for encoding in encodings:
        try:
            with open(path, 'r', encoding=encoding, newline='') as f:
                content = f.read()
            break
        except (UnicodeDecodeError, UnicodeError):
            continue
    if content is None:
        # Letzter Versuch: Fehlerwerfen-frei dekodieren
        with open(path, 'rb') as f:
            content = f.read().decode('cp1252', errors='replace')
    return list(csv.reader(content.splitlines(), delimiter=';'))


def _read_xlsx_rows(path):
    """Alle Blaetter einer .xlsx-Datei als Zeilenlisten lesen."""
    try:
        from openpyxl import load_workbook
    except ImportError:
        raise SourceFileUnreadable(
            'openpyxl ist nicht installiert (pip install openpyxl) - .xlsx kann nicht gelesen werden'
        )

    # WICHTIG: Eine in Excel geoeffnete Datei ist exklusiv gesperrt. openpyxl
    # liefert dann eine PermissionError. Wir behandeln das als "temporaer
    # gesperrt" und brechen den Lauf NICHT ab - die Datei wird beim
    # naechsten Lauf nachgeholt.
    try:
        workbook = load_workbook(path, read_only=True, data_only=True)
    except PermissionError as exc:
        raise SourceFileLocked(
            f'Datei ist gesperrt ( vermutlich in Excel geoeffnet): {exc.strerror or exc}'
        )
    except Exception as exc:  # korrupte/unerwartete xlsx-Struktur
        raise SourceFileUnreadable(f'Datei nicht lesbar: {exc}')

    sheets = []
    try:
        for sheet in workbook.worksheets:
            rows = []
            for row in sheet.iter_rows(values_only=True):
                rows.append(list(row))
            # Leere Sheets / komplett leere Zeilen am Ende entfernen
            while rows and not any(normalize_cell(v) for v in rows[-1]):
                rows.pop()
            sheets.append((sheet.title, rows))
    except PermissionError as exc:
        raise SourceFileLocked(
            f'Datei wurde waehrend des Lesens gesperrt: {exc.strerror or exc}'
        )
    finally:
        workbook.close()
    return sheets


def _read_xls_rows(path):
    """Alle Blaetter einer .xls-Datei (altes Excel-Format) als Zeilenlisten lesen.

    openpyxl kann .xls NICHT lesen - dafuer wird xlrd gebraucht (>= 2.0
    unterstuetzt bewusst nur noch .xls, nicht mehr .xlsx).
    """
    try:
        import xlrd
    except ImportError:
        raise SourceFileUnreadable(
            'xlrd ist nicht installiert (pip install xlrd) - .xls kann nicht gelesen werden'
        )
    try:
        book = xlrd.open_workbook(str(path))
    except PermissionError as exc:
        raise SourceFileLocked(
            f'Datei ist gesperrt (vermutlich in Excel geoeffnet): {exc.strerror or exc}'
        )
    except Exception as exc:
        raise SourceFileUnreadable(f'Datei nicht lesbar: {exc}')

    sheets = []
    try:
        for sheet in book.sheets():
            rows = []
            for r in range(sheet.nrows):
                rows.append([sheet.cell_value(r, c) for c in range(sheet.ncols)])
            while rows and not any(normalize_cell(v) for v in rows[-1]):
                rows.pop()
            sheets.append((sheet.name, rows))
    except PermissionError as exc:
        raise SourceFileLocked(
            f'Datei wurde waehrend des Lesens gesperrt: {exc.strerror or exc}'
        )
    return sheets


def _sheet_excluded(title, mapping, path=None):
    """True, wenn ein Blatt laut Mapping nicht importiert werden soll."""
    normalized = _normalize_header(title)
    only = mapping.get('only_sheets') or []
    if only:
        return normalized not in {_normalize_header(s) for s in only}
    skip = mapping.get('skip_sheets') or []
    if normalized in {_normalize_header(s) for s in skip}:
        return True
    # Dateibezogene Ausschlussliste: "Datei.xls::Blattname"
    if path is not None:
        file_key = _normalize_header(Path(path).name)
        for entry in skip:
            if '::' in str(entry):
                entry_file, _, entry_sheet = str(entry).partition('::')
                if (_normalize_header(entry_file) == file_key
                        and _normalize_header(entry_sheet) == normalized):
                    return True
    return False


def read_source_file(path, mapping, encodings=None):
    """Liest eine Datei und liefert eine Liste von Sheets.

    Jeder Sheet-Eintrag: {
        'sheet': str,           # Blattname (bei CSV: Dateiname)
        'header_index': int|None,
        'columns': {field: index},
        'unknown_headers': [...],
        'rows': [(row_number, [cells])],   # 1-basiert, wie in Excel
        'locked': bool,         # True = Datei war in Excel geoeffnet
        'error': str|None,
    }

    Wirft SourceFileLocked / SourceFileUnreadable, damit der Command
    gesperrte Dateien ueberspringen kann, statt den Lauf abzubrechen.
    """
    path = Path(path)
    result = []

    if path.suffix.lower() in ('.xlsx', '.xlsm'):
        sheets = _read_xlsx_rows(path)
    elif path.suffix.lower() == '.xls':
        sheets = _read_xls_rows(path)
    else:
        # CSV (und alles, was als Text lesbar ist)
        try:
            rows = _read_csv_rows(path, encodings=encodings)
        except PermissionError as exc:
            raise SourceFileLocked(
                f'Datei ist gesperrt (vermutlich in Excel geoeffnet): {exc.strerror or exc}'
            )
        sheets = [(path.name, rows)]

    for title, rows in sheets:
        # Blatt-Filter: manche Arbeitsblaetter sind keine Lagerartikel,
        # sondern Stuecklisten/Zubehoerbaugruppen. Sie wuerden sonst
        # fälschlich als Lagerartikel angelegt (kein S/N, kein Produktname).
        if _sheet_excluded(title, mapping, path):
            result.append({
                'sheet': title,
                'header_index': None,
                'columns': {},
                'unknown_headers': [],
                'extra_columns': [],
                'rows': [],
                'locked': False,
                'skipped': True,
                'error': None,
            })
            continue

        detected = detect_header(rows, mapping) if rows else None
        if detected is None:
            result.append({
                'sheet': title,
                'header_index': None,
                'columns': {},
                'unknown_headers': [],
                'extra_columns': [],
                'rows': [],
                'locked': False,
                'error': 'Keine Kopfzeile erkannt (zu wenige bekannte Spalten)',
            })
            continue
        header_index, columns, unknown, extra_columns = detected
        data_rows = []
        for offset, row in enumerate(rows[header_index + 1:], start=header_index + 2):
            if not any(normalize_cell(v) for v in row):
                continue
            data_rows.append((offset, row))
        result.append({
            'sheet': title,
            'header_index': header_index,
            'columns': columns,
            'unknown_headers': unknown,
            'extra_columns': extra_columns,
            'rows': data_rows,
            'locked': False,
            'error': None,
        })

    return result


def extract_record(sheet, row, file_label, row_number):
    """Extrahiert ein genormtes Record-Dict aus einer Zeile."""
    columns = sheet['columns']

    def cell(field):
        index = columns.get(field)
        if index is None or index >= len(row):
            return ''
        value = normalize_cell(row[index])
        # Platzhalter ('-', 'k.a.', ...) zaehlen als LEER - nicht nur bei der
        # Seriennummer (2026-10-06). Sonst wandern '-'-Werte als echte Inhalte
        # in customer_name/external_ref und blockieren spaeter das Leerkriterium
        # des cleanup_empty_inventory_items.
        return '' if is_placeholder(value) else value

    record = {
        'source_file': file_label,
        'source_sheet': sheet['sheet'],
        'source_row': row_number,
        'category': cell('category'),
        'lfd_nr': cell('lfd_nr'),
        'best_nr': cell('best_nr'),
        'serial_number': cell('serial_number'),
        'customer': cell('customer'),
        'order_number': cell('order_number'),
        'supplier': cell('supplier'),
        'name': cell('name'),
        'delivery_date_raw': cell('delivery_date'),
        'notes': cell('notes'),
        'quantity': cell('quantity'),
        'unit': cell('unit'),
        'firmware_version': cell('firmware_version'),
        'firmware_notes': cell('firmware_notes'),
    }

    # Seriennummern: nur Leerzeichen entfernen. Fuer den Match wird zusaetzlich
    # ein normalisierter Schluessel gebildet (siehe serial_key), damit z.B.
    # "AB-123" und "AB123" nicht kollidieren.
    # Platzhalter wie "..." oder "……" gelten als LEER - sonst wuerden
    # Schein-Seriennummern im Bestand landen.
    raw_serial = clean_serial_number(record['serial_number'])
    serial = '' if is_placeholder(raw_serial) else raw_serial
    record['serial_number'] = serial
    record['serial_key'] = build_serial_key(serial)

    # Mindestdaten pruefen
    record['is_empty'] = not any([
        record['name'], record['serial_number'], record['best_nr'],
        record['customer'], record['notes'],
    ])

    record['delivery_date'] = parse_date(record['delivery_date_raw'])
    record['quantity_value'] = parse_decimal(record['quantity'], default=Decimal('1'))

    # Rohwerte je logischem Feld (fuer die Erkennung wiederholter Kopfzeilen
    # mitten im Blatt). Nicht in den Report schreiben - nur intern verwenden.
    record['_cells_by_field'] = {
        field: normalize_cell(row[index])
        for field, index in columns.items()
        if index < len(row)
    }

    # Zusaetzliche, nicht gemappte Spalten (z.B. "Board Version",
    # "Firmware", "Bst. Nr. Katalog"). Der Inhalt geht nicht verloren,
    # sondern landet im Beschreibungsfeld des Lagerartikels.
    extras = {}
    already_used = set(columns.values())
    for extra in (sheet.get('extra_columns') or []):
        index = extra['index']
        if index >= len(row):
            continue
        value = normalize_cell(row[index])
        if not value:
            continue
        # Schon ueber ein logisches Feld erfasst? Dann ueberspringen,
        # sonst stuende derselbe Inhalt doppelt im Beschreibungstext.
        if index in already_used:
            continue
        label = extra['name']
        suffix = extra.get('suffix')
        if suffix and suffix.lower() not in label.lower():
            label = f"{label} ({suffix})"
        extras[label] = value
    record['extra_info'] = extras
    return record
