#!/usr/bin/env python
"""
Importer for Carl Zeiss microscopy trading goods.

Behavior:
- Reads CSV at Datenvorlagen/Zeiss Preisliste 2026 Teil1.csv (semicolon-delimited)
- Supplier: 'Carl Zeiss Microscopy GmbH' (created if missing)
- If a product with the supplier article number (column 0) exists for that supplier,
  the script creates a new TradingProductPrice entry for that product.
  If not, a new TradingProduct + TradingProductPrice will be created.
- Price validity default: valid_from = today, valid_until = 2026-12-31
- Purchase price (EK) is calculated by applying the ProductGroup (Warengruppe) discount
  to the supplier list price (the calculation is delegated to model.save()).
- Visitron-Listenpreis (VLP) will be set to equal the supplier list price (script sets
  margin_percent == discount_percent so VLP == supplier_list_price). Re-running the
  script will add new price records for existing products if the current VLP does not
  match the supplier list price (safe, append-only history).

Usage:
  python backend/import_zeiss_trading_products.py --dry-run    # only show actions
  python backend/import_zeiss_trading_products.py --apply      # perform DB writes
  python backend/import_zeiss_trading_products.py --apply --force-replace  # overwrite existing price records for same validity

"""
import os
import sys
import django
import csv
from decimal import Decimal
from datetime import date

# Django setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction
from django.apps import apps

User = get_user_model()


def parse_decimal(value_str):
    if not value_str:
        return Decimal('0.00')
    cleaned = value_str.strip().replace('.', '').replace(',', '.')
    try:
        return Decimal(cleaned)
    except Exception:
        return Decimal('0.00')


def get_or_create_supplier(company_name):
    Supplier = apps.get_model('suppliers', 'Supplier')
    if not company_name:
        company_name = 'Carl Zeiss Microscopy GmbH'
    company_name = company_name.strip()
    supplier = Supplier.objects.filter(company_name=company_name).first()
    if supplier:
        return supplier

    # Create minimal supplier (supplier_number auto-generated)
    supplier = Supplier.objects.create(
        company_name=company_name,
        is_active=True,
        email=f'import@{company_name.lower().replace(" ","")}.local'
    )
    print(f"✓ Created supplier: {supplier.company_name} (Nr: {supplier.supplier_number})")
    return supplier


def get_or_create_product_group(supplier, group_name):
    ProductGroup = apps.get_model('suppliers', 'ProductGroup')
    if not group_name:
        return None
    pg = ProductGroup.objects.filter(supplier=supplier, name=group_name).first()
    if pg:
        return pg
    pg = ProductGroup.objects.create(supplier=supplier, name=group_name, discount_percent=Decimal('0.00'))
    print(f"Created ProductGroup '{group_name}' for supplier {supplier.company_name} with 0% discount")
    return pg


def get_or_create_pricelist(supplier, name, valid_from, valid_until):
    PriceList = apps.get_model('suppliers', 'PriceList')
    pl = PriceList.objects.filter(supplier=supplier, name=name, valid_from=valid_from, valid_until=valid_until).first()
    if pl:
        return pl
    pl = PriceList.objects.create(supplier=supplier, name=name, valid_from=valid_from, valid_until=valid_until)
    return pl


def import_zeiss(csv_path, apply_changes=False):
    TradingProduct = apps.get_model('suppliers', 'TradingProduct')
    TradingProductPrice = apps.get_model('suppliers', 'TradingProductPrice')
    SupplierProduct = apps.get_model('suppliers', 'SupplierProduct')

    admin_user = User.objects.filter(is_superuser=True).first()

    supplier = get_or_create_supplier('Carl Zeiss Microscopy GmbH')

    valid_from = date.today()
    valid_until = date(2026, 12, 31)

    pricelist = get_or_create_pricelist(supplier, 'Zeiss Preisliste 2026 Teil1', valid_from, valid_until)

    imported = 0
    prices_added = 0
    skipped = 0
    errors = 0

    # detect encoding
    encodings = ['cp1252', 'utf-8', 'iso-8859-1', 'latin-1']
    used_encoding = None
    for enc in encodings:
        try:
            with open(csv_path, 'r', encoding=enc, newline='') as f:
                _ = f.readline()
            used_encoding = enc
            break
        except UnicodeDecodeError:
            continue

    if used_encoding is None:
        print('Could not decode CSV file with known encodings')
        return

    print(f"Using encoding: {used_encoding}")

    with open(csv_path, 'r', encoding=used_encoding, newline='') as f:
        reader = csv.reader(f, delimiter=';')
        header = next(reader, None)

        for lineno, row in enumerate(reader, start=2):
            try:
                if not row or len(row) < 4:
                    skipped += 1
                    continue

                supplier_artikel = row[0].strip()
                name = row[1].strip()
                description_long = row[2].strip() if len(row) > 2 else ''
                listenpreis_str = row[3].strip() if len(row) > 3 else ''
                warengruppe = row[4].strip() if len(row) > 4 else ''
                warenkategorie = row[5].strip() if len(row) > 5 else ''

                list_price = parse_decimal(listenpreis_str)

                # Determine product group
                pg = get_or_create_product_group(supplier, warengruppe) if warengruppe else None

                existing = TradingProduct.objects.filter(supplier=supplier, supplier_part_number=supplier_artikel).first()

                if existing:
                    # create or update a price record for existing product
                    # determine discount from product group or existing product
                    discount = (pg.discount_percent if pg else (existing.discount_percent or Decimal('0.00')))

                    # find any existing prices with the same validity period
                    existing_prices_qs = existing.price_history.filter(valid_from=valid_from, valid_until=valid_until)

                    if existing_prices_qs.exists():
                        # If any existing price already matches supplier LP and VLP
                        match = existing_prices_qs.filter(supplier_list_price=list_price, list_price=list_price).first()
                        if match:
                            if existing_prices_qs.count() == 1:
                                print(f"Line {lineno}: price already exists and matches VLP for {supplier_artikel}, skipping")
                                skipped += 1
                                continue
                            else:
                                # multiple entries: keep the matching one, remove others if force_replace
                                if force_replace:
                                    others = existing_prices_qs.exclude(pk=match.pk)
                                    print(f"Line {lineno}: Removing {others.count()} duplicate price(s) and keeping matching price for {existing.visitron_part_number} ({supplier_artikel})")
                                    if apply_changes:
                                        others.delete()
                                else:
                                    print(f"Line {lineno}: Multiple price records exist for {existing.visitron_part_number} ({supplier_artikel}); --force-replace would remove duplicates")
                                    skipped += 1
                                    continue

                        else:
                            # No exact matching price exists for this LP/VLP
                            if force_replace:
                                print(f"Line {lineno}: Replacing {existing_prices_qs.count()} existing price(s) for {existing.visitron_part_number} ({supplier_artikel})")
                                if apply_changes:
                                    with transaction.atomic():
                                        existing_prices_qs.delete()
                                        # create new price
                                        TradingProductPrice.objects.create(
                                            product=existing,
                                            supplier_list_price=list_price,
                                            supplier_currency='EUR',
                                            exchange_rate=Decimal('1.0'),
                                            discount_percent=discount,
                                            margin_percent=discount,
                                            valid_from=valid_from,
                                            valid_until=valid_until,
                                            notes='Import Zeiss Preisliste 2026 Teil1 (force-replace)',
                                            created_by=admin_user
                                        )
                            else:
                                # append-only: do not delete, just add a new price record
                                print(f"Line {lineno}: Adding additional price for existing product {existing.visitron_part_number} ({supplier_artikel})")
                                if apply_changes:
                                    with transaction.atomic():
                                        TradingProductPrice.objects.create(
                                            product=existing,
                                            supplier_list_price=list_price,
                                            supplier_currency='EUR',
                                            exchange_rate=Decimal('1.0'),
                                            discount_percent=discount,
                                            margin_percent=discount,
                                            valid_from=valid_from,
                                            valid_until=valid_until,
                                            notes='Import Zeiss Preisliste 2026 Teil1',
                                            created_by=admin_user
                                        )
                    else:
                        # no existing prices for that validity -> create one
                        print(f"Line {lineno}: Adding price for existing product {existing.visitron_part_number} ({supplier_artikel})")
                        if apply_changes:
                            with transaction.atomic():
                                TradingProductPrice.objects.create(
                                    product=existing,
                                    supplier_list_price=list_price,
                                    supplier_currency='EUR',
                                    exchange_rate=Decimal('1.0'),
                                    discount_percent=discount,
                                    margin_percent=discount,
                                    valid_from=valid_from,
                                    valid_until=valid_until,
                                    notes='Import Zeiss Preisliste 2026 Teil1',
                                    created_by=admin_user
                                )

                    prices_added += 1
                    continue

                # Create new product
                print(f"Line {lineno}: Creating product for supplier Artikel {supplier_artikel} - {name[:50]}")
                if apply_changes:
                    with transaction.atomic():
                        discount = (pg.discount_percent if pg else Decimal('0.00'))

                        product = TradingProduct.objects.create(
                            name=name,
                            supplier_part_number=supplier_artikel,
                            description=description_long,
                            supplier=supplier,
                            list_price=list_price,
                            list_price_currency='EUR',
                            exchange_rate=Decimal('1.0'),
                            price_valid_from=valid_from,
                            price_valid_until=valid_until,
                            product_group=pg,
                            discount_percent=discount,
                            is_active=True,
                            price_list=pricelist
                        )

                        TradingProductPrice.objects.create(
                            product=product,
                            supplier_list_price=list_price,
                            supplier_currency='EUR',
                            exchange_rate=Decimal('1.0'),
                            discount_percent=discount,
                            margin_percent=discount,
                            valid_from=valid_from,
                            valid_until=valid_until,
                            notes='Import Zeiss Preisliste 2026 Teil1',
                            created_by=admin_user
                        )

                        # Create SupplierProduct mapping
                        SupplierProduct.objects.create(
                            supplier=supplier,
                            product=product,
                            supplier_article_number=supplier_artikel,
                            purchase_price=None,
                            currency='EUR'
                        )

                imported += 1

            except Exception as e:
                print(f"Line {lineno}: ERROR - {e}")
                errors += 1

    print("\nImport summary:")
    print(f"  Products created: {imported}")
    print(f"  Prices added (existing products): {prices_added}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {errors}")


if __name__ == '__main__':
    import argparse

    default_csv = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Datenvorlagen', 'Zeiss Preisliste 2026 Teil1.csv')
    default_csv = os.path.normpath(default_csv)

    parser = argparse.ArgumentParser(description='Import Zeiss trading goods CSV')
    parser.add_argument('--csv', default=default_csv, help='Path to CSV file')
    parser.add_argument('--apply', action='store_true', help='Apply changes to DB (default is dry-run)')
    parser.add_argument('--force-replace', dest='force_replace', action='store_true', help='Replace existing price records for the same validity instead of adding new ones')
    args = parser.parse_args()

    force_replace = bool(getattr(args, 'force_replace', False))

    if not os.path.exists(args.csv):
        print(f"CSV file not found: {args.csv}")
        sys.exit(1)

    import_zeiss(args.csv, apply_changes=args.apply)