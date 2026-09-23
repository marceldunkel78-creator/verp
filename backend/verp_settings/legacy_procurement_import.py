"""Import legacy procurement orders from Datenvorlagen/bestlist.csv."""
import csv
import logging
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
DOCUMENT_RE = re.compile(r'^B(?P<year>\d{2})_(?P<number>[0-9A-Za-z]+)(?P<suffix>[a-z])?\.(?P<extension>pdf|docx)$', re.IGNORECASE)


def _data_dir():
    return Path(settings.BASE_DIR).parent / 'Datenvorlagen'


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


def _supplier_match(name, suppliers):
    needle = _normalize(name)
    if not needle:
        return None, 'empty'
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


def _row_preview(row, suppliers, documents):
    legacy_number = _clean_number(row.get('B-Nr.'))
    order_date = _parse_date(row.get('bestellt am'))
    confirmation = _parse_date(row.get('Auftragsbestätigung'))
    delivery = _parse_date(row.get('Est. Ship Date')) or _parse_date(row.get('Lieferdatum'))
    supplier, match_type = _supplier_match(row.get('Lieferant'), suppliers)
    total, currency = _parse_money(row.get('Rechnungspreis'))
    if total is None:
        total, currency = _parse_money(row.get('Summe NETTO'))
    document_key = f"{str(order_date.year)[-2:]}-{legacy_number.zfill(3)}".lower() if legacy_number and order_date else ''
    docs = documents.get(document_key, [])
    items, source = _extract_items(docs)
    order_number = f"B-{legacy_number.zfill(3)}-{order_date.month:02d}/{str(order_date.year)[-2:]}" if legacy_number and order_date else ''
    return {
        'legacy_number': legacy_number,
        'order_number': order_number,
        'order_date': order_date.isoformat() if order_date else '',
        'confirmation_date': confirmation.isoformat() if confirmation else '',
        'delivery_date': delivery.isoformat() if delivery else '',
        'supplier_name': str(row.get('Lieferant') or '').strip(),
        'supplier_id': supplier.id if supplier else None,
        'supplier_match': match_type,
        'description': str(row.get('Warenbezeichnung f Kunde,Name, Ort, Land oder f Visitron eintragen') or '').strip(),
        'total': str(total) if total is not None else '',
        'currency': currency,
        'document_names': [path.name for path in docs],
        'extracted_document': source,
        'item_count': len(items),
        'action': 'import' if supplier and order_number else 'skip',
    }


def preview_legacy_procurement_import():
    suppliers = list(Supplier.objects.all())
    documents = _document_map()
    rows = [_row_preview(row, suppliers, documents) for row in _read_csv()]
    document_rows = [row for row in rows if row['document_names']]
    visible_rows = document_rows + [row for row in rows if not row['document_names']][:500]
    visible_rows = visible_rows[:500]
    return {
        'success': True,
        'total': len(rows),
        'would_import': sum(row['action'] == 'import' for row in rows),
        'skipped': sum(row['action'] != 'import' for row in rows),
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
    stats = {'total': len(rows), 'imported': 0, 'exists': 0, 'skipped_supplier': 0, 'skipped_invalid': 0, 'items_created': 0, 'documents_linked': 0, 'unreadable_documents': 0, 'errors': []}
    for row in rows:
        try:
            preview = _row_preview(row, suppliers, documents)
            if not preview['order_number']:
                stats['skipped_invalid'] += 1
                continue
            supplier, _ = _supplier_match(row.get('Lieferant'), suppliers)
            if not supplier:
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
            notes = '\n'.join(part for part in [f'Legacy Lieferant: {row.get("Lieferant", "")}', f'Legacy Summe: {row.get("Summe NETTO", "")}', f'Kommentar: {description}', f'Zusätzliche Infos: {comment}', f'Zugehöriger Auftrag: {related_order}', f'Bestätigungswert: {confirmation_raw}'] if part and not part.endswith(': '))
            creator = _find_creator(confirmation_raw, created_by_user)
            document_key = f"{preview['order_date'][2:4]}-{preview['legacy_number'].zfill(3)}".lower()
            parsed_items, _ = _extract_items(documents.get(document_key, []))
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
        except Exception as exc:
            logger.exception('Legacy Procurement Order konnte nicht importiert werden')
            stats['errors'].append(f'{row.get("B-Nr.")}: {exc}')
    return {'success': not stats['errors'], 'dry_run': dry_run, 'stats': stats}
