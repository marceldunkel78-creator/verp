#!/usr/bin/env python
"""
Import VS-Service Products from CSV file
CSV Format: Kennung;Name-Titel;Listenpreis;ProduktBeschreibung deutsch lang;...;Einkaufspreis;...
Creates product and price record (valid until March 2026)
"""
import os
import sys
import django
import csv
from decimal import Decimal
from datetime import date

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from service.models import VSService, VSServicePrice
from django.contrib.auth import get_user_model

User = get_user_model()


def parse_decimal(value_str):
    """Parse German decimal format (comma as decimal separator, dot as thousands)"""
    if not value_str or value_str.strip() == '':
        return Decimal('0.00')
    
    # Remove thousands separator (dot) and replace comma with dot
    cleaned = value_str.strip().replace('.', '').replace(',', '.')
    try:
        return Decimal(cleaned)
    except:
        return Decimal('0.00')


def import_vsservice_products(csv_path):
    """Import VS-Service products from CSV"""
    
    # Get system user for created_by
    admin_user = User.objects.filter(is_superuser=True).first()
    
    # Valid until March 2026
    valid_from = date.today()
    valid_until = date(2026, 3, 31)
    
    imported_count = 0
    skipped_count = 0
    error_count = 0
    
    print(f"Importing VS-Service Products from: {csv_path}")
    print(f"Price validity: {valid_from} bis {valid_until}")
    print("-" * 80)
    
    # Try different encodings
    encodings = ['cp1252', 'utf-8', 'latin-1', 'iso-8859-1']
    file_content = None
    used_encoding = None
    
    for encoding in encodings:
        try:
            with open(csv_path, 'r', encoding=encoding) as f:
                file_content = f.read()
                used_encoding = encoding
                break
        except (UnicodeDecodeError, UnicodeError):
            continue
    
    if file_content is None:
        print("Error: Could not read file with any known encoding")
        return
    
    print(f"Using encoding: {used_encoding}")
    print("-" * 80)
    
    # Use csv.reader for proper CSV parsing
    csv_reader = csv.reader(file_content.splitlines(), delimiter=';')
    rows = list(csv_reader)
    
    if len(rows) == 0:
        print("Error: File is empty")
        return
    
    # Skip header row
    for line_num, row in enumerate(rows[1:], start=2):
        try:
            if len(row) < 5:
                skipped_count += 1
                continue
            
            # Extract fields - CSV structure:
            # Name-Titel;Listenpreis;ProduktBeschreibung deutsch lang;ProduktBeschreibung deutsch lang zusatz;Einkaufspreis;DollarEK;Name-Titel englisch;ProduktBeschreibung englisch lang;ProduktBeschreibung englisch lang zusatz
            name = row[0].strip()
            listenpreis_str = row[1].strip()
            beschreibung_de = row[2].strip()
            beschreibung_de_zusatz = row[3].strip() if len(row) > 3 else ''
            einkaufspreis_str = row[4].strip() if len(row) > 4 else '0'
            # row[5] is DollarEK flag (WAHR/FALSCH)
            name_en = row[6].strip() if len(row) > 6 else ''
            beschreibung_en = row[7].strip() if len(row) > 7 else ''
            beschreibung_en_zusatz = row[8].strip() if len(row) > 8 else ''
            
            if not name:
                skipped_count += 1
                continue
            
            # Parse prices
            list_price = parse_decimal(listenpreis_str)
            purchase_price = parse_decimal(einkaufspreis_str)
            
            # Combine descriptions
            full_description_de = beschreibung_de
            if beschreibung_de_zusatz:
                full_description_de += '\n' + beschreibung_de_zusatz
            
            full_description_en = beschreibung_en
            if beschreibung_en_zusatz:
                full_description_en += '\n' + beschreibung_en_zusatz
            
            # Check if product already exists (by name)
            existing = VSService.objects.filter(
                name__iexact=name
            ).first()
            
            if existing:
                print(f"Line {line_num}: Skipped - product '{name}' already exists ({existing.article_number})")
                skipped_count += 1
                continue
            
            # Create product (use short_description for first 500 chars of description)
            short_desc = full_description_de[:500] if full_description_de else ''
            short_desc_en = full_description_en[:500] if full_description_en else ''
            
            product = VSService.objects.create(
                name=name,
                short_description=short_desc,
                short_description_en=short_desc_en,
                description=full_description_de,
                description_en=full_description_en,
                is_active=True,
                created_by=admin_user
            )
            
            # Create price record
            VSServicePrice.objects.create(
                vs_service=product,
                purchase_price=purchase_price,
                sales_price=list_price,
                valid_from=valid_from,
                valid_until=valid_until,
                notes=f'Importiert aus CSV',
                created_by=admin_user
            )
            
            print(f"Line {line_num}: ✓ Created {product.article_number} - {name[:50]}... (EK: {purchase_price}€, VK: {list_price}€)")
            imported_count += 1
            
        except Exception as e:
            print(f"Line {line_num}: ERROR - {str(e)}")
            error_count += 1
    
    print("-" * 80)
    print(f"Import completed:")
    print(f"  Imported: {imported_count}")
    print(f"  Skipped:  {skipped_count}")
    print(f"  Errors:   {error_count}")
    print(f"  Total:    {imported_count + skipped_count + error_count}")


if __name__ == '__main__':
    csv_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'Datenvorlagen',
        'VS-Service-produkte.csv'
    )
    
    if not os.path.exists(csv_file):
        print(f"ERROR: CSV file not found: {csv_file}")
        sys.exit(1)
    
    import_vsservice_products(csv_file)
