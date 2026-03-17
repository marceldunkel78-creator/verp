"""
API Views für den VisiView-Lizenz-Import aus CSV-Dateien.
Ermöglicht Upload über die VERP Settings-Oberfläche mit Vorschau (Dry-Run) und Import (Live).
"""
import os
import csv
import re
import logging
import unicodedata
from datetime import datetime

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status

from visiview.models import VisiViewLicense
from customers.models import Customer

logger = logging.getLogger(__name__)

# --- Helper functions (aus import_visiview_licenses.py) ---

LEGAL_SUFFIXES = {
    'gmbh', 'ag', 'kg', 'ohg', 'gbr', 'eg', 'ev', 'e.v', 'gmbh&co',
    'gmbh&co. kg', 'gmbh&co kg', 'gmbh & co', 'gmbh & co. kg',
    'inc', 'llc', 'ltd', 'limited', 'corp', 'company', 'co', 'sarl', 'sa'
}


def _normalize_text(value):
    if not value:
        return ''
    value = value.strip()
    value = value.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    value = value.replace('Ä', 'Ae').replace('Ö', 'Oe').replace('Ü', 'Ue')
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^a-zA-Z0-9\s]+', ' ', value)
    value = re.sub(r'\s+', ' ', value)
    return value.strip().lower()


def _strip_legal_suffixes(value):
    if not value:
        return ''
    tokens = [t for t in value.split() if t]
    filtered = [t for t in tokens if t not in LEGAL_SUFFIXES]
    return ' '.join(filtered)


def _parse_address_parts(address):
    if not address:
        return None, None, None
    normalized = _normalize_text(address)
    postal_match = re.search(r'\b\d{4,5}\b', normalized)
    postal = postal_match.group(0) if postal_match else None
    parts = [p.strip() for p in re.split(r'[,/]+', address) if p.strip()]
    city = None
    street = None
    if parts:
        city = parts[-1]
        street = parts[0] if len(parts) > 1 else None
    return postal, city, street


def parse_date(date_str):
    if not date_str or date_str.strip() == '':
        return None
    formats = ['%d.%m.%Y', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y']
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None


def parse_options_bitmask(options_str):
    if not options_str or options_str.strip() == '':
        return 0, 0
    try:
        options_value = int(options_str.strip())
        lower_32 = options_value & 0xFFFFFFFF
        upper_32 = (options_value >> 32) & 0xFFFFFFFF
        return lower_32, upper_32
    except ValueError:
        try:
            bits = [int(b.strip()) for b in options_str.split(',') if b.strip()]
            lower_32 = 0
            upper_32 = 0
            for bit in bits:
                if bit < 32:
                    lower_32 |= (1 << bit)
                else:
                    upper_32 |= (1 << (bit - 32))
            return lower_32, upper_32
        except Exception:
            return 0, 0


def find_customer(customer_name, customer_address):
    """Try to find a customer by name and address with basic normalization."""
    if not customer_name and not customer_address:
        return None, None

    from django.db.models import Value
    from django.db.models.functions import Concat

    raw_name = customer_name.strip() if customer_name else ''
    normalized_name = _strip_legal_suffixes(_normalize_text(raw_name))

    if normalized_name:
        customer = Customer.objects.filter(last_name__iexact=raw_name).first()
        if customer:
            return customer, 'name_exact'

        customer = Customer.objects.filter(last_name__icontains=raw_name).first()
        if customer:
            return customer, 'name_last_contains'

        customer = Customer.objects.filter(last_name__icontains=normalized_name).first()
        if customer:
            return customer, 'name_last_normalized'

        customer = Customer.objects.annotate(
            full_name=Concat('first_name', Value(' '), 'last_name')
        ).filter(full_name__icontains=raw_name).first()
        if customer:
            return customer, 'name_full_contains'

        customer = Customer.objects.annotate(
            full_name_rev=Concat('last_name', Value(' '), 'first_name')
        ).filter(full_name_rev__icontains=raw_name).first()
        if customer:
            return customer, 'name_full_rev_contains'

    postal, city, street = _parse_address_parts(customer_address)
    address_queryset = Customer.objects.all()
    if postal:
        address_queryset = address_queryset.filter(addresses__postal_code__icontains=postal)
    if city:
        address_queryset = address_queryset.filter(addresses__city__icontains=city)
    if street:
        address_queryset = address_queryset.filter(addresses__street__icontains=street)

    customer = address_queryset.distinct().first()
    if customer:
        return customer, 'address_match'

    return None, None


def _read_csv_rows(file_path):
    """Read CSV file with auto-detected encoding and delimiter."""
    encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
    encoding = 'utf-8'

    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                f.readline()
            encoding = enc
            break
        except UnicodeDecodeError:
            continue

    with open(file_path, 'r', encoding=encoding) as f:
        sample = f.read(2048)
        f.seek(0)
        delimiter = ';' if sample.count(';') >= sample.count(',') else ','
        reader = csv.DictReader(f, delimiter=delimiter)
        columns = reader.fieldnames or []
        rows = list(reader)

    return rows, columns


def _process_row(row, row_num, dry_run=True, relink=False):
    """Process a single CSV row. Returns a dict with results."""
    serial_number = row.get('Serialnum', row.get('SerialNum', row.get('serial_number', ''))).strip()
    internal_serial = row.get('InternalSN', row.get('internal_sn', '')).strip() or None
    customer_name = row.get('CustomerName', row.get('customer_name', '')).strip()
    customer_address = row.get('CustomerAddress', row.get('customer_address', '')).strip()
    options_str = row.get('Options', row.get('options', ''))
    hardware = row.get('Hardware', row.get('hardware', '')).strip()
    version = row.get('Version', row.get('version', '')).strip() or None
    delivery_date_str = row.get('DeliveryDate', row.get('delivery_date', ''))
    expire_date_str = row.get('ExpireDate', row.get('expire_date', ''))
    maintenance_str = row.get('Maintenance', row.get('maintenance', ''))

    if not serial_number:
        return {'status': 'skipped', 'reason': 'no_serial', 'row': row_num}

    delivery_date = parse_date(delivery_date_str)
    expire_date = parse_date(expire_date_str)
    maintenance_date = parse_date(maintenance_str)
    lower_32, upper_32 = parse_options_bitmask(options_str)

    existing_license = VisiViewLicense.objects.select_related('customer').filter(
        serial_number=serial_number
    ).first()
    existing_customer = existing_license.customer if existing_license and existing_license.customer_id else None

    customer, match_method = find_customer(customer_name, customer_address)

    if dry_run:
        action = 'none'
        if existing_customer and not customer:
            action = 'keep_existing'
        elif existing_customer and customer and existing_customer.id != customer.id:
            action = 'relink' if relink else 'keep_existing'
        elif customer:
            action = 'link'

        return {
            'status': 'update' if existing_license else 'create',
            'row': row_num,
            'serial_number': serial_number,
            'customer_name': customer_name,
            'version': version or '',
            'delivery_date': str(delivery_date) if delivery_date else '',
            'existing_customer': (
                f"{existing_customer.first_name} {existing_customer.last_name}".strip()
                if existing_customer else None
            ),
            'matched_customer': (
                f"{customer.first_name} {customer.last_name}".strip()
                if customer else None
            ),
            'match_method': match_method,
            'action': action,
        }
    else:
        # Live import
        customer_to_use = customer
        preserved = False
        was_relinked = False
        if existing_customer:
            if not customer:
                customer_to_use = existing_customer
                preserved = True
            elif existing_customer.id != customer.id and not relink:
                customer_to_use = existing_customer
                preserved = True
            elif existing_customer.id != customer.id and relink:
                was_relinked = True

        license_obj, was_created = VisiViewLicense.objects.update_or_create(
            serial_number=serial_number,
            defaults={
                'internal_serial': internal_serial[:50] if internal_serial else '',
                'customer': customer_to_use,
                'customer_name_legacy': customer_name[:200] if customer_name else '',
                'customer_address_legacy': customer_address[:500] if customer_address else '',
                'options_bitmask': lower_32,
                'options_upper_32bit': upper_32,
                'version': version[:20] if version else '',
                'delivery_date': delivery_date,
                'expire_date': expire_date,
                'maintenance_date': maintenance_date,
                'status': 'active',
            }
        )

        return {
            'status': 'created' if was_created else 'updated',
            'row': row_num,
            'serial_number': serial_number,
            'customer_name': customer_name,
            'customer_matched': customer_to_use is not None,
            'match_method': match_method,
            'preserved': preserved,
            'relinked': was_relinked,
        }


def _save_uploaded_csv(uploaded_file):
    """Save uploaded CSV to MEDIA_ROOT/Settings/ and return the path."""
    upload_dir = os.path.join(settings.MEDIA_ROOT, 'Settings')
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, 'Licenses.csv')
    with open(file_path, 'wb') as f:
        for chunk in uploaded_file.chunks():
            f.write(chunk)
    return file_path


class VisiViewLicenseImportPreviewView(APIView):
    """
    POST: Uploads CSV and returns a dry-run preview of the import.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response(
                {'error': 'Keine Datei hochgeladen.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not uploaded_file.name.lower().endswith('.csv'):
            return Response(
                {'error': 'Nur CSV-Dateien werden akzeptiert.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            file_path = _save_uploaded_csv(uploaded_file)
            rows, columns = _read_csv_rows(file_path)

            relink = request.data.get('relink', 'false').lower() == 'true'

            preview_rows = []
            stats = {
                'total': len(rows),
                'create': 0,
                'update': 0,
                'skipped': 0,
                'customer_matched': 0,
                'match_methods': {},
            }

            for i, row in enumerate(rows):
                result = _process_row(row, row_num=i + 2, dry_run=True, relink=relink)
                if result['status'] == 'skipped':
                    stats['skipped'] += 1
                else:
                    if result['status'] == 'create':
                        stats['create'] += 1
                    else:
                        stats['update'] += 1
                    if result.get('matched_customer'):
                        stats['customer_matched'] += 1
                        method = result.get('match_method', 'unknown')
                        stats['match_methods'][method] = stats['match_methods'].get(method, 0) + 1
                preview_rows.append(result)

            return Response({
                'file_name': uploaded_file.name,
                'file_path': file_path,
                'columns': columns,
                'stats': stats,
                'preview': preview_rows[:200],  # Limit preview to 200 rows
                'total_rows': len(rows),
            })

        except Exception as e:
            logger.error(f"VisiView License Import Preview failed: {e}", exc_info=True)
            return Response(
                {'error': f'Fehler bei der Vorschau: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VisiViewLicenseImportExecuteView(APIView):
    """
    POST: Executes the actual import from the previously uploaded CSV.
    Body: { "relink": false }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file_path = os.path.join(settings.MEDIA_ROOT, 'Settings', 'Licenses.csv')

        if not os.path.exists(file_path):
            return Response(
                {'error': 'Keine CSV-Datei gefunden. Bitte zuerst eine Datei hochladen.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        relink = request.data.get('relink', False)
        if isinstance(relink, str):
            relink = relink.lower() == 'true'

        try:
            rows, columns = _read_csv_rows(file_path)

            results = []
            stats = {
                'total': len(rows),
                'created': 0,
                'updated': 0,
                'skipped': 0,
                'customer_matched': 0,
                'preserved_links': 0,
                'relinked': 0,
                'errors': 0,
            }
            errors = []

            for i, row in enumerate(rows):
                try:
                    result = _process_row(row, row_num=i + 2, dry_run=False, relink=relink)
                    if result['status'] == 'skipped':
                        stats['skipped'] += 1
                    elif result['status'] == 'created':
                        stats['created'] += 1
                    elif result['status'] == 'updated':
                        stats['updated'] += 1

                    if result.get('customer_matched'):
                        stats['customer_matched'] += 1
                    if result.get('preserved'):
                        stats['preserved_links'] += 1
                    if result.get('relinked'):
                        stats['relinked'] += 1

                    results.append(result)
                except Exception as e:
                    stats['errors'] += 1
                    errors.append(f"Zeile {i + 2}: {str(e)}")

            return Response({
                'message': (
                    f"Import abgeschlossen: {stats['created']} erstellt, "
                    f"{stats['updated']} aktualisiert, {stats['skipped']} übersprungen."
                ),
                'stats': stats,
                'errors': errors[:50],
            })

        except Exception as e:
            logger.error(f"VisiView License Import failed: {e}", exc_info=True)
            return Response(
                {'error': f'Fehler beim Import: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
