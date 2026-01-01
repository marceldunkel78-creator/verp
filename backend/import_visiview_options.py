#!/usr/bin/env python
"""
Import VisiView Options from Options.csv
Format: Bit;Wert;OptionID;Name;Preis
"""
import os
import sys
import django
import csv
from decimal import Decimal

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from visiview.models import VisiViewOption


def import_options(csv_path, dry_run=True):
    """Import options from CSV file."""
    created = 0
    updated = 0
    errors = []
    
    # First, delete all existing options if not dry run
    if not dry_run:
        deleted_count = VisiViewOption.objects.all().delete()[0]
        print(f"Deleted {deleted_count} existing options")
    
    # Detect encoding
    encodings = ['utf-8', 'latin-1', 'cp1252']
    encoding = 'utf-8'
    
    for enc in encodings:
        try:
            with open(csv_path, 'r', encoding=enc) as f:
                f.readline()
            encoding = enc
            break
        except UnicodeDecodeError:
            continue
    
    print(f"Using encoding: {encoding}")
    
    with open(csv_path, 'r', encoding=encoding) as f:
        reader = csv.DictReader(f, delimiter=';')
        print(f"Detected columns: {reader.fieldnames}")
        
        for row_num, row in enumerate(reader, start=2):
            try:
                bit_position = int(row.get('Bit', row.get('bit', 0)))
                name = row.get('Name', row.get('name', '')).strip()
                price_str = row.get('Preis', row.get('preis', '0'))
                
                # Handle price (may have comma as decimal separator)
                price_str = price_str.replace(',', '.').strip()
                try:
                    price = Decimal(price_str)
                except:
                    price = Decimal('0')
                
                # Skip reserved options with no real name
                is_active = name.lower() not in ['res.', 'reserviert', 'reserved', '']
                
                if dry_run:
                    status = "active" if is_active else "reserved"
                    print(f"Bit {bit_position}: {name} - {price} EUR ({status})")
                else:
                    option, was_created = VisiViewOption.objects.update_or_create(
                        bit_position=bit_position,
                        defaults={
                            'name': name if name else f'reserviert (Bit {bit_position})',
                            'price': price,
                            'is_active': is_active,
                            'description': ''
                        }
                    )
                    
                    if was_created:
                        created += 1
                        print(f"Created: {option.name} (Bit {bit_position})")
                    else:
                        updated += 1
                        print(f"Updated: {option.name} (Bit {bit_position})")
                        
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
    
    return created, updated, errors


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Import VisiView Options from CSV')
    parser.add_argument('csv_file', nargs='?', 
                        default=r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\Options.csv',
                        help='Path to the Options.csv file')
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
    
    created, updated, errors = import_options(args.csv_file, dry_run=dry_run)
    
    print(f"\n=== Summary ===")
    if not dry_run:
        print(f"Created: {created}")
        print(f"Updated: {updated}")
    
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for error in errors[:20]:
            print(f"  - {error}")
    
    print("\nDone!")
