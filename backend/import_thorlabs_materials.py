#!/usr/bin/env python
"""
Import Thorlabs articles from CSV cart export as MaterialSupply (Material & Supplies).

Reads: Datenvorlagen/Thorlabs-Cart.csv
Creates MaterialSupply records with prices valid for 1 year from today.

Usage:
    python import_thorlabs_materials.py              # Dry-run (default)
    python import_thorlabs_materials.py --apply       # Actually write to DB
"""

import os
import sys
import csv
import argparse
from decimal import Decimal, InvalidOperation
from datetime import date
from dateutil.relativedelta import relativedelta

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')

import django
django.setup()

from django.db import transaction
from suppliers.models import MaterialSupply, Supplier


CSV_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', 'Datenvorlagen', 'Thorlabs-Cart.csv'
)

SUPPLIER_NAME = 'Thorlabs'


def parse_euro_price(price_str):
    """
    Parse German-formatted Euro prices like '27,53 €' or '1.465,77 €'.
    Returns Decimal or None.
    """
    if not price_str:
        return None
    price_str = price_str.strip()
    # Remove currency symbol and whitespace
    price_str = price_str.replace('€', '').replace('\u00a0', '').strip()
    # German format: dots as thousand separators, comma as decimal separator
    price_str = price_str.replace('.', '').replace(',', '.')
    try:
        return Decimal(price_str)
    except (InvalidOperation, ValueError):
        return None


def read_csv(path):
    """Read the Thorlabs cart CSV and return a list of article dicts."""
    articles = []
    encodings = ['utf-8-sig', 'utf-8', 'cp1252', 'latin-1', 'iso-8859-1']

    for enc in encodings:
        try:
            with open(path, 'r', encoding=enc) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    item_number = row.get('Item Number', '').strip()
                    description = row.get('Description', '').strip()
                    unit_price_str = row.get('Unit Price', '').strip()

                    # Skip empty rows, footer/disclaimer rows
                    if not item_number or not description:
                        continue

                    unit_price = parse_euro_price(unit_price_str)
                    if unit_price is None:
                        print(f"  WARNUNG: Preis nicht parsbar für {item_number}: '{unit_price_str}' – übersprungen")
                        continue

                    url = row.get('URL', '').strip()

                    articles.append({
                        'item_number': item_number,
                        'description': description,
                        'unit_price': unit_price,
                        'url': url,
                    })
            break  # successfully read
        except UnicodeDecodeError:
            continue
    else:
        print(f"FEHLER: Konnte die Datei {path} mit keinem Encoding lesen.")
        sys.exit(1)

    return articles


def deduplicate(articles):
    """
    Remove duplicate item numbers, keeping the first occurrence.
    """
    seen = {}
    unique = []
    duplicates = 0
    for art in articles:
        key = art['item_number']
        if key not in seen:
            seen[key] = True
            unique.append(art)
        else:
            duplicates += 1
    if duplicates:
        print(f"  {duplicates} Duplikate in CSV entfernt (gleiche Item Number).")
    return unique


def get_or_create_supplier():
    """Get or create the Thorlabs supplier."""
    supplier = Supplier.objects.filter(company_name__icontains='Thorlabs').first()
    if supplier:
        return supplier, False

    # Create Thorlabs supplier
    supplier = Supplier.objects.create(
        company_name=SUPPLIER_NAME,
        country='DE',
        is_active=True,
    )
    return supplier, True


def run_import(apply=False):
    print("=" * 70)
    print("Thorlabs Material & Supplies Import")
    print("=" * 70)

    # 1) Read CSV
    csv_path = os.path.normpath(CSV_PATH)
    print(f"\nCSV-Datei: {csv_path}")
    if not os.path.exists(csv_path):
        print(f"FEHLER: Datei nicht gefunden: {csv_path}")
        sys.exit(1)

    articles = read_csv(csv_path)
    print(f"  {len(articles)} Artikel aus CSV gelesen.")

    # 2) Deduplicate
    articles = deduplicate(articles)
    print(f"  {len(articles)} einzigartige Artikel nach Deduplizierung.")

    # 3) Supplier
    supplier, created = get_or_create_supplier()
    if created:
        print(f"\n  Neuer Lieferant angelegt: {supplier.company_name} (Nr. {supplier.supplier_number})")
    else:
        print(f"\n  Lieferant gefunden: {supplier.company_name} (Nr. {supplier.supplier_number})")

    # 4) Date range
    today = date.today()
    valid_until = today + relativedelta(years=1)
    print(f"  Preisgültigkeit: {today} bis {valid_until}")

    # 5) Process articles
    created_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []

    print(f"\n{'Nr':<5} {'Item Number':<20} {'Beschreibung':<50} {'Preis':>12} {'Status'}")
    print("-" * 100)

    for i, art in enumerate(articles, 1):
        item_number = art['item_number']
        description = art['description']
        unit_price = art['unit_price']
        url = art['url']

        # Truncate description for display
        desc_display = description[:47] + '...' if len(description) > 50 else description

        # Check if already exists (by supplier + supplier_part_number)
        existing = MaterialSupply.objects.filter(
            supplier=supplier,
            supplier_part_number=item_number
        ).first()

        if existing:
            # Update price and validity
            if apply:
                existing.list_price = unit_price
                existing.price_valid_from = today
                existing.price_valid_until = valid_until
                existing.name = description
                if url:
                    existing.description = url
                existing.is_active = True
                existing.save()
            print(f"{i:<5} {item_number:<20} {desc_display:<50} {str(unit_price)+' €':>12} AKTUALISIERT")
            updated_count += 1
        else:
            # Create new
            if apply:
                try:
                    ms = MaterialSupply(
                        name=description,
                        supplier_part_number=item_number,
                        supplier=supplier,
                        category='BETRIEBSSTOFF',
                        short_description=description[:200],
                        description=url if url else '',
                        list_price=unit_price,
                        list_price_currency='EUR',
                        price_valid_from=today,
                        price_valid_until=valid_until,
                        unit='Stück',
                        is_active=True,
                    )
                    ms.save()  # auto-generates visitron_part_number
                except Exception as e:
                    errors.append((item_number, str(e)))
                    print(f"{i:<5} {item_number:<20} {desc_display:<50} {str(unit_price)+' €':>12} FEHLER: {e}")
                    continue
            print(f"{i:<5} {item_number:<20} {desc_display:<50} {str(unit_price)+' €':>12} NEU")
            created_count += 1

    # 6) Summary
    print("\n" + "=" * 70)
    print("Zusammenfassung:")
    print(f"  Gelesen:       {len(articles)} Artikel")
    print(f"  Neu angelegt:  {created_count}")
    print(f"  Aktualisiert:  {updated_count}")
    print(f"  Fehler:        {len(errors)}")

    if not apply:
        print("\n  *** DRY-RUN – Es wurden keine Änderungen geschrieben. ***")
        print("  Verwende --apply um die Artikel tatsächlich zu importieren.")
    else:
        print("\n  Import abgeschlossen.")

    if errors:
        print("\nFehler-Details:")
        for item, err in errors:
            print(f"  {item}: {err}")


def main():
    parser = argparse.ArgumentParser(
        description='Importiert Thorlabs-Artikel aus CSV als Material & Supplies'
    )
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Änderungen tatsächlich in die Datenbank schreiben (Default: Dry-Run)'
    )
    args = parser.parse_args()

    with transaction.atomic():
        run_import(apply=args.apply)
        if not args.apply:
            # Rollback in dry-run mode
            transaction.set_rollback(True)


if __name__ == '__main__':
    main()
