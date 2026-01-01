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


def find_customer_by_name(customer_name):
    """Try to find a customer by name (exact or fuzzy match)."""
    if not customer_name or customer_name.strip() == '':
        return None
    
    customer_name = customer_name.strip()
    
    # Try exact match on last_name first
    customer = Customer.objects.filter(last_name__iexact=customer_name).first()
    if customer:
        return customer
    
    # Try contains match on last_name
    customer = Customer.objects.filter(last_name__icontains=customer_name).first()
    if customer:
        return customer
    
    # Try matching concatenated first + last name
    from django.db.models import Value
    from django.db.models.functions import Concat
    
    customer = Customer.objects.annotate(
        full_name=Concat('first_name', Value(' '), 'last_name')
    ).filter(full_name__icontains=customer_name).first()
    if customer:
        return customer
    
    # Try matching last + first name (reversed)
    customer = Customer.objects.annotate(
        full_name_rev=Concat('last_name', Value(' '), 'first_name')
    ).filter(full_name_rev__icontains=customer_name).first()
    if customer:
        return customer
    
    return None


def import_licenses(csv_path, dry_run=True):
    """Import licenses from CSV file."""
    created = 0
    updated = 0
    skipped = 0
    errors = []
    customer_matches = 0
    
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
                
                # Try to find matching customer
                customer = find_customer_by_name(customer_name)
                if customer:
                    customer_matches += 1
                
                if dry_run:
                    if customer:
                        customer_display = f"{customer.first_name} {customer.last_name}".strip()
                        customer_info = f"-> Customer: {customer_display} (ID: {customer.id})"
                    else:
                        customer_info = "-> No customer match"
                    print(f"Row {row_num}: SN={serial_number}, Customer='{customer_name}', Options={options_str} {customer_info}")
                else:
                    license_obj, was_created = VisiViewLicense.objects.update_or_create(
                        serial_number=serial_number,
                        defaults={
                            'internal_serial': internal_serial[:50] if internal_serial else '',
                            'customer': customer,
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
                        
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
    
    return created, updated, skipped, customer_matches, errors


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Import VisiView Licenses from CSV')
    parser.add_argument('csv_file', help='Path to the Licenses.csv file')
    parser.add_argument('--live', action='store_true', help='Actually import data (default is dry-run)')
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
    
    created, updated, skipped, customer_matches, errors = import_licenses(args.csv_file, dry_run=dry_run)
    
    print(f"\n=== Summary ===")
    if not dry_run:
        print(f"Created: {created}")
        print(f"Updated: {updated}")
    print(f"Skipped (no serial): {skipped}")
    print(f"Customer matches: {customer_matches}")
    
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for error in errors[:20]:  # Show first 20 errors
            print(f"  - {error}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more errors")
    
    print("\nDone!")
