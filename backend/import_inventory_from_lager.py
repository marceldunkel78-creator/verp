#!/usr/bin/env python
"""
Import Inventory Items from Lager-gesamt.csv
Creates suppliers as needed, links customers if found, otherwise stores info in notes.
"""
import os
import sys
import django
import csv
import re
from decimal import Decimal
from datetime import datetime

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from inventory.models import InventoryItem
from suppliers.models import Supplier
from customers.models import Customer, CustomerAddress
from verp_settings.models import ProductCategory
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

# Category mapping from CSV to database codes
CATEGORY_MAPPING = {
    'Kamera': 'KAMERA',
    'Laser': 'LASER',
    'Scanningtisch': 'SCANNINGTISCH',
    'Filterrad': 'FILTERRAD',
    'Piezo': 'PIEZO',
    'Shutter': 'SHUTTER',
    'LED': 'LED',
    'Inkubation': 'INKUBATION',
    'TIRF': 'TIRF',
    'FRAP': 'FRAP',
    'FRAP-TIRF': 'FRAP_TIRF',
    'Confocal': 'CONFOCAL',
    'VisiView': 'VISIVIEW',
    'DualCam': 'DUALCAM_SPLITTER',
    'Splitter': 'DUALCAM_SPLITTER',
    'Filter': 'FILTER',
    'Mikroskop': 'MIKROSKOP',
    'PC': 'PC',
    'Kabel': 'KABEL',
    'Software': 'SOFTWARE',
    'Lichtleiter': 'LICHTLEITER',
    'Mikroskopadapter': 'MIKROSKOPADAPTER',
    'HBO': 'HBO_XBO',
    'XBO': 'HBO_XBO',
    'HBO-XBO': 'HBO_XBO',
    'Orbital': 'ORBITAL',
    'ViRTEx': 'VIRTEX',
    'VS-LMS': 'VS_LMS',
    'Sonstiges': 'SONSTIGES',
}

def parse_date(date_str):
    """Parse German date format dd.mm.yyyy"""
    if not date_str or not date_str.strip():
        return None
    date_str = date_str.strip()
    
    # Try various formats
    formats = ['%d.%m.%Y', '%d.%m.%y', '%Y-%m-%d', '%d/%m/%Y']
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


def normalize_supplier_name(name):
    """Normalize supplier name for comparison"""
    if not name:
        return ''
    # Remove extra whitespace, lowercase
    return ' '.join(name.strip().lower().split())


def get_or_create_supplier(supplier_name, created_suppliers, admin_user):
    """Get existing supplier or create a new one"""
    if not supplier_name or not supplier_name.strip():
        return None
    
    supplier_name = supplier_name.strip()
    normalized = normalize_supplier_name(supplier_name)
    
    # Check cache first
    if normalized in created_suppliers:
        return created_suppliers[normalized]
    
    # Try to find existing supplier (case-insensitive)
    supplier = Supplier.objects.filter(company_name__iexact=supplier_name).first()
    if supplier:
        created_suppliers[normalized] = supplier
        return supplier
    
    # Try partial match
    supplier = Supplier.objects.filter(company_name__icontains=supplier_name).first()
    if supplier:
        created_suppliers[normalized] = supplier
        return supplier
    
    # Create new supplier
    supplier = Supplier.objects.create(
        company_name=supplier_name,
        is_active=True,
        created_by=admin_user
    )
    created_suppliers[normalized] = supplier
    print(f"  ✓ Created new supplier: {supplier.supplier_number} - {supplier_name}")
    return supplier


def find_customer(customer_str, customer_cache):
    """
    Try to find a customer in the database based on the customer string.
    Returns (Customer, match_confidence) or (None, 0)
    """
    if not customer_str or not customer_str.strip():
        return None, 0
    
    customer_str = customer_str.strip()
    
    # Check if it's "frei" or "demo" - these are not customers
    lower_str = customer_str.lower()
    if lower_str in ['frei', 'demo', 'demo-gerät', 'demo gerät', 'demogerät']:
        return None, 0
    if 'demo' in lower_str and len(customer_str) < 20:
        return None, 0
    
    # Check cache
    if customer_str in customer_cache:
        return customer_cache[customer_str]
    
    # Parse customer string - typical formats:
    # "Name, Stadt" or "Uni Stadt, Prof. Name" or "Name Uni Stadt"
    parts = [p.strip() for p in customer_str.split(',')]
    
    search_terms = []
    for part in parts:
        # Split by spaces and collect meaningful terms
        words = part.split()
        for word in words:
            word = word.strip()
            if len(word) > 2 and word.lower() not in ['uni', 'prof', 'dr', 'prof.', 'dr.', 'mr', 'mrs', 'ms', 'ehem', 'ehem.']:
                search_terms.append(word)
    
    if not search_terms:
        customer_cache[customer_str] = (None, 0)
        return None, 0
    
    # Try exact last name match first
    for term in search_terms:
        customers = Customer.objects.filter(last_name__iexact=term)
        if customers.count() == 1:
            customer_cache[customer_str] = (customers.first(), 100)
            return customers.first(), 100
    
    # Try with university/city from address
    for term in search_terms:
        # Search in customer addresses for university or city match
        addresses = CustomerAddress.objects.filter(
            Q(university__icontains=term) | Q(city__icontains=term)
        ).select_related('customer')
        
        # Get unique customers
        matching_customers = set()
        for addr in addresses:
            matching_customers.add(addr.customer)
        
        # If we have a name term too, filter further
        for name_term in search_terms:
            if name_term != term:
                name_filtered = [c for c in matching_customers 
                               if name_term.lower() in c.last_name.lower() 
                               or name_term.lower() in c.first_name.lower()]
                if len(name_filtered) == 1:
                    customer_cache[customer_str] = (name_filtered[0], 90)
                    return name_filtered[0], 90
    
    # Try partial name match
    for term in search_terms:
        customers = Customer.objects.filter(
            Q(last_name__icontains=term) | Q(first_name__icontains=term)
        )
        if customers.count() == 1:
            customer_cache[customer_str] = (customers.first(), 70)
            return customers.first(), 70
    
    # Multiple matches or no matches - not unique
    customer_cache[customer_str] = (None, 0)
    return None, 0


def get_product_category(category_name):
    """Get or return None for product category"""
    if not category_name:
        return None
    
    code = CATEGORY_MAPPING.get(category_name.strip())
    if code:
        try:
            return ProductCategory.objects.get(code=code)
        except ProductCategory.DoesNotExist:
            pass
    return None


def determine_status(customer_str, delivery_date):
    """
    Determine inventory status based on customer field:
    - 'frei', 'demo', empty = FREI
    - otherwise = GELIEFERT (if delivered)
    """
    if not customer_str or not customer_str.strip():
        return 'FREI'
    
    lower_str = customer_str.strip().lower()
    
    # Check for frei/demo indicators
    if lower_str in ['frei', 'demo', 'demo-gerät', 'demogerät']:
        return 'FREI'
    if lower_str.startswith('demo ') or lower_str.startswith('demo,'):
        return 'FREI'
    if 'demo' in lower_str and len(customer_str) < 15:
        return 'FREI'
    
    # Has customer info -> GELIEFERT
    return 'GELIEFERT'


def get_or_create_default_supplier(admin_user):
    """Get or create a default 'Unbekannt' supplier for items without supplier info"""
    supplier = Supplier.objects.filter(company_name='Unbekannt').first()
    if not supplier:
        supplier = Supplier.objects.create(
            company_name='Unbekannt',
            is_active=True,
            notes='Default-Lieferant für importierte Waren ohne Lieferantenangabe',
            created_by=admin_user
        )
        print(f"  ✓ Created default supplier: {supplier.supplier_number} - Unbekannt")
    return supplier


def import_inventory(csv_path, dry_run=True, limit=None):
    """Import inventory items from CSV"""
    
    admin_user = User.objects.filter(is_superuser=True).first()
    if not admin_user:
        print("ERROR: No admin user found!")
        return
    
    # Caches
    created_suppliers = {}
    customer_cache = {}
    
    # Get default supplier for items without supplier
    default_supplier = get_or_create_default_supplier(admin_user) if not dry_run else None
    
    # Stats
    stats = {
        'total': 0,
        'imported': 0,
        'skipped': 0,
        'errors': 0,
        'suppliers_created': 0,
        'customers_linked': 0,
        'customers_not_found': 0,
    }
    
    print(f"{'DRY RUN - ' if dry_run else ''}Importing Inventory from: {csv_path}")
    print("-" * 80)
    
    # Read CSV with different encodings
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
        print("ERROR: Could not read file with any known encoding")
        return
    
    print(f"Using encoding: {used_encoding}")
    print("-" * 80)
    
    # Parse CSV
    csv_reader = csv.reader(file_content.splitlines(), delimiter=';')
    rows = list(csv_reader)
    
    if len(rows) < 2:
        print("ERROR: File has no data rows")
        return
    
    # Header: Kategorie;lfd. Nr.;B-Nr.;S/N;Kunde;Auftragsnummer;Lieferant;Produkt;ausgeliefert;Allgemeine Notizen 1;Allgemeine Notizen 1;Instanz-Details Firmware;Instanzdetails - Firmwarenotizen
    header = rows[0]
    print(f"Header: {header}")
    print("-" * 80)
    
    # Process rows
    for line_num, row in enumerate(rows[1:], start=2):
        if limit and stats['total'] >= limit:
            break
        
        stats['total'] += 1
        
        try:
            # Extract fields
            kategorie = row[0].strip() if len(row) > 0 else ''
            lfd_nr = row[1].strip() if len(row) > 1 else ''
            b_nr = row[2].strip() if len(row) > 2 else ''
            serial_number = row[3].strip() if len(row) > 3 else ''
            kunde_str = row[4].strip() if len(row) > 4 else ''
            auftragsnummer = row[5].strip() if len(row) > 5 else ''
            lieferant_str = row[6].strip() if len(row) > 6 else ''
            produkt = row[7].strip() if len(row) > 7 else ''
            ausgeliefert = row[8].strip() if len(row) > 8 else ''
            notizen1 = row[9].strip() if len(row) > 9 else ''
            notizen2 = row[10].strip() if len(row) > 10 else ''
            firmware = row[11].strip() if len(row) > 11 else ''
            firmware_notes = row[12].strip() if len(row) > 12 else ''
            
            # Skip empty rows
            if not produkt and not serial_number and not kunde_str:
                stats['skipped'] += 1
                continue
            
            # Get or create supplier (use default if none specified)
            supplier = get_or_create_supplier(lieferant_str, created_suppliers, admin_user) if lieferant_str else default_supplier
            if not supplier and not dry_run:
                supplier = default_supplier
            
            # Try to find customer
            customer, confidence = find_customer(kunde_str, customer_cache)
            
            # Determine status
            status = determine_status(kunde_str, parse_date(ausgeliefert))
            
            # Get product category
            product_category = get_product_category(kategorie)
            
            # Build notes for unmatched customer info
            notes_parts = []
            if notizen1:
                notes_parts.append(notizen1)
            if notizen2:
                notes_parts.append(notizen2)
            
            # If customer not found, add original customer string to notes
            if not customer and kunde_str and kunde_str.lower() not in ['frei', 'demo']:
                notes_parts.insert(0, f"Kunde (nicht zugeordnet): {kunde_str}")
                stats['customers_not_found'] += 1
            elif customer:
                stats['customers_linked'] += 1
            
            # Combine notes
            notes = '\n'.join(notes_parts) if notes_parts else ''
            
            # Parse delivery date
            delivery_date = parse_date(ausgeliefert)
            
            # Build product name
            name = produkt if produkt else f"{kategorie} (kein Produktname)"
            
            # Build article number from B-Nr. or generate placeholder
            article_number = b_nr if b_nr else f"LEGACY-{line_num}"
            
            if dry_run:
                print(f"Line {line_num}: {kategorie} | {name[:40]}... | S/N: {serial_number or '-'} | Status: {status}")
                if customer:
                    print(f"  → Customer: {customer.customer_number} - {customer.last_name}")
                elif kunde_str and kunde_str.lower() not in ['frei', 'demo']:
                    print(f"  → Customer NOT FOUND: {kunde_str}")
                if supplier:
                    print(f"  → Supplier: {supplier.supplier_number} - {supplier.company_name}")
            else:
                # Create inventory item
                item = InventoryItem.objects.create(
                    name=name,
                    description=f"Importiert aus Legacy-Lager\nKategorie: {kategorie}\nB-Nr: {b_nr}\nAuftrag: {auftragsnummer}",
                    article_number=article_number,
                    serial_number=serial_number,
                    supplier=supplier,
                    product_category=product_category,
                    item_category=kategorie,  # Legacy field
                    item_function='TRADING_GOOD',
                    customer=customer,
                    customer_name=kunde_str if not customer else '',
                    customer_order_number=auftragsnummer,
                    status=status,
                    delivery_date=delivery_date,
                    firmware_version=firmware,
                    firmware_notes=firmware_notes,
                    notes=notes,
                    quantity=Decimal('1'),
                    purchase_price=Decimal('0.00'),  # Unknown from legacy data
                    stored_by=admin_user
                )
                
                if stats['imported'] % 100 == 0:
                    print(f"  Imported {stats['imported']} items...")
            
            stats['imported'] += 1
            
        except Exception as e:
            print(f"Line {line_num}: ERROR - {str(e)}")
            stats['errors'] += 1
    
    # Count newly created suppliers
    existing_before = set()
    for supplier in created_suppliers.values():
        if hasattr(supplier, '_is_new') and supplier._is_new:
            stats['suppliers_created'] += 1
    
    # Actually count by checking which weren't found initially
    stats['suppliers_created'] = len([s for s in created_suppliers.values() 
                                      if s.created_at and (datetime.now().date() - s.created_at.date()).days == 0])
    
    print("-" * 80)
    print(f"{'DRY RUN ' if dry_run else ''}Import Summary:")
    print(f"  Total rows processed: {stats['total']}")
    print(f"  Successfully {'would be ' if dry_run else ''}imported: {stats['imported']}")
    print(f"  Skipped (empty): {stats['skipped']}")
    print(f"  Errors: {stats['errors']}")
    print(f"  Customers linked: {stats['customers_linked']}")
    print(f"  Customers not found (in notes): {stats['customers_not_found']}")
    print(f"  Unique suppliers used: {len(created_suppliers)}")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Import inventory from Lager-gesamt.csv')
    parser.add_argument('--live', action='store_true', help='Actually import (default is dry-run)')
    parser.add_argument('--limit', type=int, help='Limit number of rows to process')
    
    args = parser.parse_args()
    
    csv_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'Datenvorlagen',
        'Lager-gesamt.csv'
    )
    
    if not os.path.exists(csv_file):
        print(f"ERROR: CSV file not found: {csv_file}")
        sys.exit(1)
    
    import_inventory(csv_file, dry_run=not args.live, limit=args.limit)
