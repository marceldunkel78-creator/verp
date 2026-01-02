#!/usr/bin/env python
"""
Import Trading Products from CSV file
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

from suppliers.models import TradingProduct, TradingProductPrice, Supplier
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


def get_or_create_supplier(company_name):
    """Get or create supplier by company name with auto-generated supplier number"""
    if not company_name or company_name.strip() == '':
        # Fallback to default supplier
        company_name = 'Import Lieferant'
    
    company_name = company_name.strip()
    
    # Check if supplier exists
    supplier = Supplier.objects.filter(company_name=company_name).first()
    if supplier:
        return supplier
    
    # Generate next supplier number (3 digits: 100-999)
    existing_numbers = Supplier.objects.filter(
        supplier_number__isnull=False
    ).values_list('supplier_number', flat=True)
    
    # Convert to integers and find max
    used_numbers = []
    for num in existing_numbers:
        try:
            used_numbers.append(int(num))
        except (ValueError, TypeError):
            continue
    
    if used_numbers:
        next_number = max(used_numbers) + 1
    else:
        next_number = 100
    
    # Ensure it's within 3 digits
    if next_number > 999:
        raise ValueError("Supplier number exceeded maximum (999)")
    
    # Create new supplier
    supplier = Supplier.objects.create(
        company_name=company_name,
        supplier_number=str(next_number).zfill(3),
        is_active=True,
        email=f'import@{company_name.lower().replace(" ", "")}.com'
    )
    
    print(f"✓ Created new supplier: {company_name} (Nr: {supplier.supplier_number})")
    return supplier


def import_trading_products(csv_path):
    """Import trading products from CSV"""
    
    # Get system user for created_by
    admin_user = User.objects.filter(is_superuser=True).first()
    
    # Valid until March 2026
    valid_from = date.today()
    valid_until = date(2026, 3, 31)
    
    imported_count = 0
    skipped_count = 0
    error_count = 0
    suppliers_created = set()
    
    print(f"Importing Trading Products from: {csv_path}")
    print(f"Price validity: {valid_from} bis {valid_until}")
    print("-" * 80)
    
    # Try different encodings
    encodings = ['cp1252', 'utf-8', 'latin-1', 'iso-8859-1']
    used_encoding = None
    
    for encoding in encodings:
        try:
            with open(csv_path, 'r', encoding=encoding, newline='') as f:
                # Try to read header to test encoding
                csv_reader = csv.reader(f, delimiter=';')
                header = next(csv_reader)
                used_encoding = encoding
                break
        except UnicodeDecodeError:
            continue
    
    if used_encoding is None:
        print("ERROR: Could not decode file with any known encoding")
        return
    
    print(f"Using encoding: {used_encoding}")
    print("-" * 80)
    
    # Now process the file
    with open(csv_path, 'r', encoding=used_encoding, newline='') as f:
        csv_reader = csv.reader(f, delimiter=';')
        header = next(csv_reader)  # Skip header
        
        for line_num, row in enumerate(csv_reader, start=2):
            try:
                if len(row) < 11:
                    print(f"Line {line_num}: Skipped - insufficient columns (has {len(row)})")
                    skipped_count += 1
                    continue
                
                # Extract fields (now with supplier in first column)
                lieferant_name = row[0].strip()
                kennung = row[1].strip()
                name = row[2].strip()
                listenpreis_str = row[3].strip()
                beschreibung_de = row[4].strip()
                beschreibung_de_zusatz = row[5].strip()
                einkaufspreis_str = row[6].strip()
                dollar_ek = row[7].strip()  # WAHR/FALSCH
                name_en = row[8].strip()
                beschreibung_en = row[9].strip()
                beschreibung_en_zusatz = row[10].strip()
                
                if not kennung or not name:
                    print(f"Line {line_num}: Skipped - missing kennung or name")
                    skipped_count += 1
                    continue
                
                # Get or create supplier
                supplier = get_or_create_supplier(lieferant_name)
                if supplier.company_name not in suppliers_created:
                    suppliers_created.add(supplier.company_name)
                
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
                
                # Check if product already exists (by supplier + supplier_part_number)
                existing = TradingProduct.objects.filter(
                    supplier=supplier,
                    supplier_part_number=kennung
                ).first()
                
                if existing:
                    print(f"Line {line_num}: Skipped - product with Kennung '{kennung}' already exists ({existing.visitron_part_number})")
                    skipped_count += 1
                    continue
                
                # Create product
                product = TradingProduct.objects.create(
                    name=name,
                    supplier_part_number=kennung,
                    description=full_description_de,
                    description_en=full_description_en,
                    supplier=supplier,
                    list_price=list_price,
                    list_price_currency='EUR',
                    exchange_rate=Decimal('1.0'),
                    price_valid_from=valid_from,
                    price_valid_until=valid_until,
                    is_active=True
                )
                
                # Create price record
                TradingProductPrice.objects.create(
                    product=product,
                    supplier_list_price=list_price,
                    supplier_currency='EUR',
                    exchange_rate=Decimal('1.0'),
                    discount_percent=Decimal('0.0'),
                    purchase_price=purchase_price,
                    list_price=list_price,
                    valid_from=valid_from,
                    valid_until=valid_until,
                    notes=f'Importiert aus CSV',
                    created_by=admin_user
                )
                
                print(f"Line {line_num}: ✓ Created {product.visitron_part_number} - {name[:50]}... (Supplier: {supplier.company_name}, EK: {purchase_price}€, LP: {list_price}€)")
                imported_count += 1
                
            except Exception as e:
                print(f"Line {line_num}: ERROR - {str(e)}")
                error_count += 1
    
    print("-" * 80)
    print(f"Import completed:")
    print(f"  New Suppliers: {len(suppliers_created)}")
    print(f"  Imported: {imported_count}")
    print(f"  Skipped:  {skipped_count}")
    print(f"  Errors:   {error_count}")
    print(f"  Total:    {imported_count + skipped_count + error_count}")


if __name__ == '__main__':
    csv_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'Datenvorlagen',
        'Trading Products.csv'
    )
    
    if not os.path.exists(csv_file):
        print(f"ERROR: CSV file not found: {csv_file}")
        sys.exit(1)
    
    import_trading_products(csv_file)
