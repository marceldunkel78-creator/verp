#!/usr/bin/env python
"""
Import VisiView Licenses from Licenses.csv
Format: ID;Serialnum;InternalSN;CustomerName;CustomerAddress;Options;Hardware;Version;DeliveryDate;ExpireDate;Maintenance;...

This script reads the Licenses.csv file and imports the license data into the database.
Customer linking is done via name/address matching against existing customers.
"""
import os
import sys
import django
import csv
import re
import unicodedata
from datetime import datetime
from decimal import Decimal

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from visiview.models import VisiViewLicense
from customers.models import Customer


def parse_date(date_str):
    """Parse a date string in various formats."""
    if not date_str or date_str.strip() == '':
        return None
    
    # Try different date formats
    formats = [
        '%d.%m.%Y',
        '%Y-%m-%d',
        '%d/%m/%Y',
        '%m/%d/%Y',
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    
    return None


def parse_options_bitmask(options_str):
    """
    Parse options string and return lower 32 bits and upper 32 bits.
    Options string can be a comma-separated list of bit positions or a single number.
    """
    if not options_str or options_str.strip() == '':
        return 0, 0
    
    try:
        # If it's a single number, treat it as the full options mask
        options_value = int(options_str.strip())
        lower_32 = options_value & 0xFFFFFFFF
        upper_32 = (options_value >> 32) & 0xFFFFFFFF
        return lower_32, upper_32
    except ValueError:
        # Try parsing as comma-separated bit positions
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
        except:
            return 0, 0


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


def find_customer(customer_name, customer_address):
    """Try to find a customer by name and address with basic normalization."""
    if not customer_name and not customer_address:
        return None, None

    from django.db.models import Value
    from django.db.models.functions import Concat

    raw_name = customer_name.strip() if customer_name else ''
    normalized_name = _strip_legal_suffixes(_normalize_text(raw_name))

    if normalized_name:
        # Exact-ish match on last_name
        customer = Customer.objects.filter(last_name__iexact=raw_name).first()
        if customer:
            return customer, 'name_exact'

        # Contains on last_name
        customer = Customer.objects.filter(last_name__icontains=raw_name).first()
        if customer:
            return customer, 'name_last_contains'

        # Normalized contains on last_name
        customer = Customer.objects.filter(last_name__icontains=normalized_name).first()
        if customer:
            return customer, 'name_last_normalized'

        # Full name matches
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

    # Address-based matching
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


def import_licenses(csv_path, dry_run=True, relink=False, verbose=False):
    """Import licenses from CSV file."""
    created = 0
    updated = 0
    skipped = 0
    errors = []
    customer_matches = 0
    preserved_links = 0
    relinked = 0
    match_stats = {
        'name_exact': 0,
        'name_last_contains': 0,
        'name_last_normalized': 0,
        'name_full_contains': 0,
        'name_full_rev_contains': 0,
        'address_match': 0,
    }
    
    # Detect encoding
    encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
    
    for encoding in encodings:
        try:
            with open(csv_path, 'r', encoding=encoding) as f:
                # Read first line to test encoding
                f.readline()
            print(f"Using encoding: {encoding}")
            break
        except UnicodeDecodeError:
            continue
    
    with open(csv_path, 'r', encoding=encoding) as f:
        # Try different delimiters
        sample = f.read(2048)
        f.seek(0)
        
        # Detect delimiter
        delimiter = ';'
        if sample.count(';') < sample.count(','):
            delimiter = ','
        
        reader = csv.DictReader(f, delimiter=delimiter)
        
        # Print detected columns
        print(f"Detected columns: {reader.fieldnames}")
        
        for row_num, row in enumerate(reader, start=2):
            try:
                # Map column names (handle variations)
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
                    skipped += 1
                    continue
                
                # Parse dates
                delivery_date = parse_date(delivery_date_str)
                expire_date = parse_date(expire_date_str)
                maintenance_date = parse_date(maintenance_str)
                
                # Parse options bitmask
                lower_32, upper_32 = parse_options_bitmask(options_str)
                
                # Determine if it's hardware (not a software license to show)
                is_hardware = hardware.lower() in ['true', '1', 'yes', 'ja', 'x'] if hardware else False
                
                existing_license = None
                existing_customer = None
                if not dry_run:
                    existing_license = VisiViewLicense.objects.select_related('customer').filter(
                        serial_number=serial_number
                    ).first()
                    if existing_license and existing_license.customer_id:
                        existing_customer = existing_license.customer

                # Try to find matching customer
                customer, match_method = find_customer(customer_name, customer_address)
                if customer:
                    customer_matches += 1
                    match_stats[match_method] += 1
                
                if dry_run:
                    if existing_customer:
                        existing_display = f"{existing_customer.first_name} {existing_customer.last_name}".strip()
                        existing_info = f"Existing customer: {existing_display} (ID: {existing_customer.id})"
                    else:
                        existing_info = "Existing customer: none"

                    if customer:
                        customer_display = f"{customer.first_name} {customer.last_name}".strip()
                        match_info = f"Matched customer: {customer_display} (ID: {customer.id}, method={match_method})"
                    else:
                        match_info = "Matched customer: none"

                    if existing_customer and not customer:
                        action_info = "Action: keep existing link"
                    elif existing_customer and customer and existing_customer.id != customer.id:
                        action_info = "Action: relink" if relink else "Action: keep existing link"
                    elif customer:
                        action_info = "Action: link"
                    else:
                        action_info = "Action: none"

                    print(
                        f"Row {row_num}: SN={serial_number}, Customer='{customer_name}', "
                        f"Options={options_str} | {existing_info} | {match_info} | {action_info}"
                    )
                else:
                    customer_to_use = customer
                    if existing_customer:
                        if not customer:
                            customer_to_use = existing_customer
                            preserved_links += 1
                        elif existing_customer.id != customer.id and not relink:
                            customer_to_use = existing_customer
                            preserved_links += 1
                        elif existing_customer.id != customer.id and relink:
                            relinked += 1

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

                    if was_created:
                        created += 1
                    else:
                        updated += 1

                    if verbose:
                        result = 'CREATED' if was_created else 'UPDATED'
                        linked = f"customer_id={customer_to_use.id}" if customer_to_use else 'customer_id=None'
                        print(f"Row {row_num}: {result} SN={serial_number} {linked}")
                        
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
    
    return created, updated, skipped, customer_matches, preserved_links, relinked, match_stats, errors


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Import VisiView Licenses from CSV')
    parser.add_argument('csv_file', help='Path to the Licenses.csv file')
    parser.add_argument('--live', action='store_true', help='Actually import data (default is dry-run)')
    parser.add_argument('--relink', action='store_true', help='Allow relinking licenses to a different customer')
    parser.add_argument('--verbose', action='store_true', help='Print per-row results in live mode')
    args = parser.parse_args()
    
    if not os.path.exists(args.csv_file):
        print(f"Error: File not found: {args.csv_file}")
        sys.exit(1)
    
    dry_run = not args.live
    
    if dry_run:
        print("=== DRY RUN MODE ===")
        print("Use --live flag to actually import data\n")
    else:
        print("=== LIVE IMPORT MODE ===\n")
    
    created, updated, skipped, customer_matches, preserved_links, relinked, match_stats, errors = import_licenses(
        args.csv_file,
        dry_run=dry_run,
        relink=args.relink,
        verbose=args.verbose
    )
    
    print(f"\n=== Summary ===")
    if not dry_run:
        print(f"Created: {created}")
        print(f"Updated: {updated}")
        print(f"Preserved links: {preserved_links}")
        print(f"Relinked: {relinked}")
    print(f"Skipped (no serial): {skipped}")
    print(f"Customer matches: {customer_matches}")
    if customer_matches:
        print("Match methods:")
        for method, count in match_stats.items():
            if count:
                print(f"  - {method}: {count}")
    
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for error in errors[:20]:  # Show first 20 errors
            print(f"  - {error}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more errors")
    
    print("\nDone!")
