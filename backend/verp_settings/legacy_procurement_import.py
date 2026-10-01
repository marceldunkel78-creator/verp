"""Import legacy procurement orders from Datenvorlagen/bestlist.csv."""
import csv
import json
import logging
import os
import re
import unicodedata
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.db import transaction
from django.contrib.auth import get_user_model

from orders.models import Order, OrderItem
from suppliers.models import Supplier

logger = logging.getLogger(__name__)
User = get_user_model()

CSV_NAME = 'bestlist.csv'
MAPPING_NAME = 'legacy_supplier_mapping.json'
DOCUMENT_RE = re.compile(r'^B(?P<year>\d{2})_(?P<number>[0-9A-Za-z]+)(?P<suffix>[a-z])?\.(?P<extension>pdf|docx)$', re.IGNORECASE)

# Lieferant, der verwendet wird, wenn in der CSV kein zuordenbarer Lieferant steht.
DUMMY_SUPPLIER_NAME = 'Unbekannt (Legacy-Import)'
# Vorgabe: Werte in der CSV-Spalte "Lieferant", die keine echte Bestellung sind.
DEFAULT_IGNORED_SUPPLIER_VALUES = ('nicht verwendet',)


def _data_dir():
    configured_path = os.environ.get('LEGACY_PROCUREMENT_DATA_DIR')
    if configured_path:
        return Path(configured_path)

    candidates = [
        Path(settings.BASE_DIR).parent / 'Datenvorlagen',
        Path(settings.BASE_DIR) / 'Datenvorlagen',
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def _mapping_candidates():
    """Orte, an denen die Zuordnungsdatei liegen kann - Reihenfolge = Prioritaet.

    Normalfall: neben bestlist.csv (Datenvorlagen ist per .gitignore ausgeschlossen).
    Fallback: die eingecheckte Vorlage im Backend-Ordner. Die kommt auf dem
    Server mit, auch wenn niemand die Datei manuell dorthin kopiert hat.
    """
    return [
        _data_dir() / MAPPING_NAME,
        Path(settings.BASE_DIR) / MAPPING_NAME,
    ]


def _mapping_path():
    """Pfad zum Schreiben (neben der CSV) bzw. der erste existierende."""
    for candidate in _mapping_candidates():
        if candidate.exists():
            return candidate
    return _mapping_candidates()[0]


def _mapping_source():
    for candidate in _mapping_candidates():
        if candidate.exists():
            return candidate
    return None


def load_supplier_mapping():
    """Laedt die editierbare Lieferanten-Zuordnung aus der JSON-Datei.

    Die Datei liegt neben bestlist.csv und wird bei jedem Lauf neu gelesen,
    damit Aenderungen ohne Neustart des Backends wirksam werden.

    Format:
        {
            "ignore": ["nicht verwendet"],
            "supplier_map": {
                "DI": "Excelitas-PCO",
                "Syncron": 153,
                "PI": {"supplier": "Excelitas-PCO", "note": "Kuerzel"}
            }
        }
    """
    path = _mapping_source()
    data = {'ignore': list(DEFAULT_IGNORED_SUPPLIER_VALUES), 'supplier_map': {}}
    if not path:
        return data
    try:
        raw = json.loads(path.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning('Lieferanten-Mapping %s nicht lesbar (%s), wird ignoriert', path, exc)
        return data
    if not isinstance(raw, dict):
        return data
    if isinstance(raw.get('ignore'), list):
        data['ignore'] = [str(value).strip() for value in raw['ignore'] if str(value).strip()]
    if isinstance(raw.get('supplier_map'), dict):
        data['supplier_map'] = {str(k).strip(): v for k, v in raw['supplier_map'].items() if str(k).strip()}
    return data


def _mapped_value(entry):
    """Liefert (ziel, note) aus einem Mapping-Eintrag."""
    if isinstance(entry, dict):
        target = entry.get('supplier', entry.get('company_name', entry.get('supplier_number')))
        return target, str(entry.get('note', '') or '')
    return entry, ''


def _resolve_mapping(name, suppliers, mapping):
    """Versucht den CSV-Lieferantennamen ueber die Mapping-Datei aufzuloesen."""
    key = str(name or '').strip()
    if not key:
        return None, 'empty', ''
    ignore_values = {_normalize(value) for value in mapping.get('ignore', [])}
    if _normalize(key) in ignore_values:
        return None, 'ignored', ''
    entry = None
    for candidate, value in mapping.get('supplier_map', {}).items():
        if candidate.casefold() == key.casefold():
            entry = value
            break
    if entry is None:
        return None, '', ''
    target, note = _mapped_value(entry)
    if target is None:
        return None, 'ignored', note
    needle = str(target).strip()
    if not needle:
        # Leerer Zielwert = noch nicht geklaert. WICHTIG: kein Leerstring-
        # Vergleich, denn '' ist Teil jedes Firmennamens und wuerde sonst
        # stillschweigend den ersten Lieferanten treffen.
        return None, '', note
    if needle.isdigit():
        match = next((s for s in suppliers if str(s.supplier_number or '') == needle.zfill(3)), None)
        if match:
            return match, 'mapped_number', note
        return None, 'mapping_missing', needle
    needle_norm = _normalize(needle)
    for supplier in suppliers:
        if _normalize(supplier.company_name) == needle_norm:
            return supplier, 'mapped_name', note
    for supplier in suppliers:
        if needle_norm in _normalize(supplier.company_name):
            return supplier, 'mapped_name', note
    return None, 'mapping_missing', needle


def get_or_create_dummy_supplier():
    """Lieferant als Auffangnetz, damit Bestellungen ohne echten Lieferanten
    trotzdem angelegt werden koennen. Wird nur einmal erzeugt."""
    supplier, _ = Supplier.objects.get_or_create(
        company_name=DUMMY_SUPPLIER_NAME,
        defaults={'notes': 'Automatisch beim Legacy-Procurement-Import erzeugt. '
                           'Bestellungen mit nicht zuordenbarem Lieferanten aus bestlist.csv.',
                  'is_active': False},
    )
    return supplier


def _parse_date(value):
    value = str(value or '').strip()
    for fmt in ('%d.%m.%Y', '%d.%m.%y', '%Y-%m-%d'):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    return None


def _parse_money(value):
    raw = str(value or '').strip()
    if not raw or raw in {'?', '-', '...'}:
        return None, ''
    currency = 'EUR'
    if '$' in raw:
        currency = 'USD'
    elif 'DM' in raw.upper():
        currency = 'DEM'
    elif 'FF' in raw.upper():
        currency = 'FRF'
    cleaned = re.sub(r'[^0-9,.-]', '', raw)
    if not cleaned:
        return None, currency
    if ',' in cleaned:
        cleaned = cleaned.replace('.', '').replace(',', '.')
    try:
        return Decimal(cleaned), currency
    except (InvalidOperation, ValueError):
        return None, currency


def _clean_number(value):
    raw = str(value or '').strip()
    match = re.search(r'\d+[A-Za-z]?', raw)
    return match.group(0) if match else ''


def _normalize(value):
    text = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()


def _supplier_match(name, suppliers, mapping=None):
    needle = _normalize(name)
    if not needle:
        return None, 'empty'
    if mapping is not None:
        supplier, match_type, _ = _resolve_mapping(name, suppliers, mapping)
        if match_type:
            return supplier, match_type
    exact = [s for s in suppliers if _normalize(s.company_name) == needle]
    if len(exact) == 1:
        return exact[0], 'exact'
    contains = [s for s in suppliers if needle in _normalize(s.company_name) or _normalize(s.company_name) in needle]
    if len(contains) == 1:
        return contains[0], 'part'
    needle_tokens = set(needle.split())
    scored = []
    for supplier in suppliers:
        tokens = set(_normalize(supplier.company_name).split())
        score = len(needle_tokens & tokens)
        if score:
            scored.append((score, supplier))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    if scored and (len(scored) == 1 or scored[0][0] > scored[1][0]):
        return scored[0][1], 'tokens'
    return None, 'ambiguous' if scored else 'unmatched'


def _initials_match(value, user):
    initials = ''.join(re.findall(r'[A-Za-z]', str(value or '').upper()))
    if len(initials) < 2:
        return False
    name = ''.join([user.first_name[:1], user.last_name[:1]]).upper()
    return initials.endswith(name)


def _find_creator(value, fallback):
    users = User.objects.select_related('employee').all()
    matches = [user for user in users if _initials_match(value, user)]
    return matches[0] if len(matches) == 1 else fallback


def _read_csv():
    path = _data_dir() / CSV_NAME
    if not path.exists():
        raise FileNotFoundError(str(path))
    for encoding in ('cp1252', 'latin-1', 'utf-8-sig'):
        try:
            with path.open('r', encoding=encoding, newline='') as handle:
                rows = list(csv.DictReader(handle, delimiter=';'))
                relevant = ('B-Nr.', 'Lieferant', 'bestellt am', 'Warenbezeichnung f Kunde,Name, Ort, Land oder f Visitron eintragen')
                return [row for row in rows if any(str(row.get(key) or '').strip() for key in relevant)]
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError('bestlist.csv', b'', 0, 1, 'unsupported encoding')


def _document_map():
    result = {}
    for path in _data_dir().iterdir():
        match = DOCUMENT_RE.match(path.name)
        if match:
            key = f"{match.group('year')}-{match.group('number').zfill(3)}{match.group('suffix') or ''}".lower()
            result.setdefault(key, []).append(path)
    return result


def _extract_docx(path):
    try:
        from docx import Document
        document = Document(str(path))
        items = []
        for table in document.tables:
            for row in table.rows[1:]:
                cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
                if len(cells) < 5 or not re.search(r'\d', cells[0] or ''):
                    continue
                price, currency = _parse_money(cells[-1])
                quantity_match = re.search(r'\d+(?:[,.]\d+)?', cells[1] or '')
                if price is None or not quantity_match:
                    continue
                quantity = Decimal(quantity_match.group(0).replace(',', '.'))
                items.append({'article_number': cells[2], 'name': cells[3] or f'Position {cells[0]}', 'quantity': quantity, 'price': price, 'currency': currency})
        return items
    except Exception as exc:
        logger.warning('DOCX %s konnte nicht gelesen werden: %s', path.name, exc)
        return []


def _extract_pdf(path):
    try:
        import pdfplumber
        with pdfplumber.open(str(path)) as pdf:
            text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
        if not text.strip():
            return []
        items = []
        for line in text.splitlines():
            match = re.match(r'^\s*(\d{1,3})\s+(\S+)\s+(.+?)\s+(\d+(?:[,.]\d+)?)\s+(?:ST|STK|MTR|PCK|Stück)?\s+([\d.,]+)\s+([\d.,]+)\s*€?\s*$', line, re.IGNORECASE)
            if not match:
                continue
            quantity = Decimal(match.group(4).replace('.', '').replace(',', '.'))
            price = Decimal(match.group(6).replace('.', '').replace(',', '.'))
            items.append({'article_number': match.group(2), 'name': match.group(3).strip(), 'quantity': quantity, 'price': price, 'currency': 'EUR'})
        return items
    except Exception as exc:
        logger.warning('PDF %s konnte nicht gelesen werden: %s', path.name, exc)
        return []


def _extract_items(documents):
    for path in documents:
        items = _extract_docx(path) if path.suffix.lower() == '.docx' else _extract_pdf(path)
        if items:
            return items, path.name
    return [], None


def _row_preview(row, suppliers, documents, extract_items=True, supplier_cache=None, mapping=None, dummy_supplier=None):
    legacy_number = _clean_number(row.get('B-Nr.'))
    order_date = _parse_date(row.get('bestellt am'))
    confirmation = _parse_date(row.get('Auftragsbestätigung'))
    delivery = _parse_date(row.get('Est. Ship Date')) or _parse_date(row.get('Lieferdatum'))
    supplier_name = str(row.get('Lieferant') or '').strip()
    cache_key = supplier_name.casefold()
    if supplier_cache is not None and cache_key in supplier_cache:
        supplier, match_type = supplier_cache[cache_key]
    else:
        supplier, match_type = _supplier_match(supplier_name, suppliers, mapping)
        if supplier_cache is not None:
            supplier_cache[cache_key] = (supplier, match_type)
    used_dummy = False
    if supplier is None and match_type != 'ignored':
        # Kein zuordenbarer Lieferant: Bestellung wird auf den Dummy-Lieferanten
        # gehaengt, damit sie trotzdem angelegt wird. Beim Dry-Run existiert das
        # Objekt noch nicht - die Aktion wird trotzdem schon als 'import_dummy'
        # gemeldet, damit die Vorschau die vollstaendige Menge zeigt.
        used_dummy = True
        if dummy_supplier is not None:
            supplier = dummy_supplier
    total, currency = _parse_money(row.get('Rechnungspreis'))
    if total is None:
        total, currency = _parse_money(row.get('Summe NETTO'))
    document_key = f"{str(order_date.year)[-2:]}-{legacy_number.zfill(3)}".lower() if legacy_number and order_date else ''
    docs = documents.get(document_key, [])
    items, source = _extract_items(docs) if extract_items else ([], None)
    order_number = f"B-{legacy_number.zfill(3)}-{order_date.month:02d}/{str(order_date.year)[-2:]}" if legacy_number and order_date else ''
    if not order_number:
        action = 'skip'
    elif match_type == 'ignored':
        action = 'skip'
    elif Order.objects.filter(order_number=order_number).exists():
        action = 'exists'
    elif used_dummy:
        action = 'import_dummy'
    elif supplier is None:
        action = 'skip'
    else:
        action = 'import'
    return {
        'legacy_number': legacy_number,
        'order_number': order_number,
        'order_date': order_date.isoformat() if order_date else '',
        'confirmation_date': confirmation.isoformat() if confirmation else '',
        'delivery_date': delivery.isoformat() if delivery else '',
        'supplier_name': supplier_name,
        'supplier_id': supplier.id if supplier else None,
        'supplier_match': match_type,
        'dummy_supplier': used_dummy,
        'description': str(row.get('Warenbezeichnung f Kunde,Name, Ort, Land oder f Visitron eintragen') or '').strip(),
        'total': str(total) if total is not None else '',
        'currency': currency,
        'document_names': [path.name for path in docs],
        'extracted_document': source,
        'item_count': len(items),
        'action': action,
    }


def preview_legacy_procurement_import():
    suppliers = list(Supplier.objects.all())
    documents = _document_map()
    supplier_cache = {}
    mapping = load_supplier_mapping()
    dummy_supplier = Supplier.objects.filter(company_name=DUMMY_SUPPLIER_NAME).first()
    source_rows = _read_csv()
    rows = [_row_preview(row, suppliers, documents, extract_items=False, supplier_cache=supplier_cache, mapping=mapping, dummy_supplier=dummy_supplier) for row in source_rows]
    document_indices = [index for index, row in enumerate(rows) if row['document_names']]
    other_indices = [index for index, row in enumerate(rows) if not row['document_names']]
    visible_indices = (document_indices + other_indices[:500])[:500]
    visible_rows = [rows[index] for index in visible_indices]
    return {
        'success': True,
        'total': len(rows),
        'would_import': sum(row['action'] in {'import', 'import_dummy'} for row in rows),
        'would_import_dummy': sum(row['action'] == 'import_dummy' for row in rows),
        'would_import_exists': sum(row['action'] == 'exists' for row in rows),
        'skipped': sum(row['action'] == 'skip' for row in rows),
        'ignored': sum(row['action'] == 'skip' and row['supplier_match'] == 'ignored' for row in rows),
        'rows': visible_rows,
        'rows_truncated': len(rows) > 500,
    }


def _copy_document(order, source, field_name):
    if not source.exists():
        return
    target_name = source.name
    with source.open('rb') as handle:
        getattr(order, field_name).save(target_name, File(handle), save=False)


def _relink_order_documents(order, documents):
    if not documents or not order.order_number:
        return 0
    ordered_docs = sorted(documents, key=lambda path: (path.suffix.lower() != '.pdf', path.name.lower()))
    _copy_document(order, ordered_docs[0], 'order_document')
    if len(ordered_docs) > 1:
        _copy_document(order, ordered_docs[1], 'offer_document')
    order.save(update_fields=['order_document', 'offer_document', 'updated_at'])
    return min(len(ordered_docs), 2)


def import_legacy_procurement_orders(created_by_user, dry_run=True):
    suppliers = list(Supplier.objects.all())
    documents = _document_map()
    rows = _read_csv()
    mapping = load_supplier_mapping()
    dummy_supplier = None if dry_run else get_or_create_dummy_supplier()
    stats = {'total': len(rows), 'imported': 0, 'imported_dummy': 0, 'exists': 0, 'ignored_rows': 0, 'skipped_invalid': 0, 'skipped_supplier': 0, 'items_created': 0, 'documents_linked': 0, 'unreadable_documents': 0, 'errors': []}
    for row in rows:
        try:
            preview = _row_preview(row, suppliers, documents, mapping=mapping, dummy_supplier=dummy_supplier)
            if not preview['order_number']:
                stats['skipped_invalid'] += 1
                continue
            if preview['supplier_match'] == 'ignored':
                stats['ignored_rows'] += 1
                continue
            if preview['action'] == 'skip':
                # Kein Bestellnummer/Datum oder als 'ignore' markiert.
                if preview['order_number']:
                    stats['skipped_supplier'] += 1
                continue
            if Order.objects.filter(order_number=preview['order_number']).exists():
                stats['exists'] += 1
                if not dry_run:
                    document_key = f"{preview['order_date'][2:4]}-{preview['legacy_number'].zfill(3)}".lower()
                    existing_order = Order.objects.get(order_number=preview['order_number'])
                    stats['documents_linked'] += _relink_order_documents(existing_order, documents.get(document_key, []))
                continue
            if dry_run:
                stats['imported'] += 1
                stats['imported_dummy'] += 1 if preview['dummy_supplier'] else 0
                stats['items_created'] += max(preview['item_count'], 1)
                continue
            order_date = _parse_date(row.get('bestellt am'))
            confirmation_date = _parse_date(row.get('Auftragsbestätigung'))
            delivery_date = _parse_date(row.get('Est. Ship Date')) or _parse_date(row.get('Lieferdatum'))
            total, currency = _parse_money(row.get('Rechnungspreis'))
            if total is None:
                total, currency = _parse_money(row.get('Summe NETTO'))
            description = str(row.get('Warenbezeichnung f Kunde,Name, Ort, Land oder f Visitron eintragen') or '').strip()
            comment = str(row.get('zusätzliche Infos') or '').strip()
            confirmation_raw = str(row.get('Auftragsbestätigung') or '').strip()
            related_order = str(row.get('dazugehöriger Auftrag (Order)') or '').strip()
            legacy_supplier_name = str(row.get('Lieferant') or '').strip()
            notes_parts = [f'Legacy Lieferant: {legacy_supplier_name}' if legacy_supplier_name else '',
                           f'Legacy Summe: {row.get("Summe NETTO", "")}',
                           f'Kommentar: {description}',
                           f'Zusätzliche Infos: {comment}',
                           f'Zugehöriger Auftrag: {related_order}',
                           f'Bestätigungswert: {confirmation_raw}']
            if preview['dummy_supplier']:
                notes_parts.insert(1, 'Hinweis: Lieferant aus CSV konnte nicht zugeordnet werden. '
                                      'Der Lieferant in der VERP-Bestellung ist ein Dummy-Eintrag. '
                                      'Korrektur in legacy_supplier_mapping.json moeglich.')
            notes = '\n'.join(part for part in notes_parts if part and not part.endswith(': '))
            creator = _find_creator(confirmation_raw, created_by_user)
            document_key = f"{preview['order_date'][2:4]}-{preview['legacy_number'].zfill(3)}".lower()
            parsed_items, _ = _extract_items(documents.get(document_key, []))
            supplier = dummy_supplier if preview['dummy_supplier'] else _supplier_match(legacy_supplier_name, suppliers, mapping)[0]
            with transaction.atomic():
                order = Order.objects.create(order_number=preview['order_number'], order_type='online', status='angelegt', supplier=supplier, order_date=order_date, confirmation_date=confirmation_date, delivery_date=delivery_date, notes=notes, created_by=creator, confirmed_total=total)
                if not parsed_items:
                    parsed_items = [{'article_number': '', 'name': description or f'Legacy Bestellung {preview["legacy_number"]}', 'quantity': Decimal('1'), 'price': total or Decimal('0'), 'currency': currency or 'EUR'}]
                    stats['unreadable_documents'] += 1 if documents.get(document_key) else 0
                for position, item in enumerate(parsed_items, 1):
                    price = item['price'] or Decimal('0')
                    OrderItem.objects.create(order=order, position=position, article_number=item['article_number'][:100], name=item['name'][:500], description=description, quantity=item['quantity'], unit='Stk', list_price=price, final_price=price, currency=item['currency'] or 'EUR')
                    stats['items_created'] += 1
                doc_paths = documents.get(document_key, [])
                if doc_paths:
                    stats['documents_linked'] += _relink_order_documents(order, doc_paths)
                stats['imported'] += 1
                stats['imported_dummy'] += 1 if preview['dummy_supplier'] else 0
        except Exception as exc:
            logger.exception('Legacy Procurement Order konnte nicht importiert werden')
            stats['errors'].append(f'{row.get("B-Nr.")}: {exc}')
    return {'success': not stats['errors'], 'dry_run': dry_run, 'stats': stats}
