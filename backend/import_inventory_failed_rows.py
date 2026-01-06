#!/usr/bin/env python3
"""
Import fehlgeschlagener Inventar-Zeilen aus Lager-gesamt.csv
Dieses Skript importiert nur die Zeilen, die beim ursprünglichen Import 
wegen fehlendem Lieferanten fehlgeschlagen sind.

Verwendung:
  python import_inventory_failed_rows.py          # Dry-Run
  python import_inventory_failed_rows.py --live   # Echter Import
"""

import os
import sys
import django
import csv
import argparse
from datetime import datetime
from decimal import Decimal

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import transaction
from suppliers.models import Supplier
from customers.models import Customer
from inventory.models import InventoryItem
from verp_settings.models import ProductCategory
import chardet

# Mapping der CSV-Kategorien zu Datenbank-Codes
CATEGORY_MAPPING = {
    'Kamera': 'KAMERA',
    'Filter': 'FILTER',
    'Laser': 'LASER', 
    'Lichtleiter': 'LICHTLEITER',
    'Scanningtisch': 'SCANNINGTISCH',
    'Filterrad': 'FILTERRAD',
    'Sonstiges': 'SONSTIGES',
    'HBO-XBO': 'HBO_XBO',
    'Shuttersystem': 'SHUTTERSYSTEM',
    'DualCam/Splitter': 'DUALCAM_SPLITTER',
    'Piezo': 'PIEZO',
    'Shutter': 'SHUTTER',
    'Mikroskopadapter': 'MIKROSKOPADAPTER',
    'Rohstoff': 'ROHSTOFF',
    'Orbital': 'ORBITAL',
    'Spektrometer': 'SPEKTROMETER',
    'TIRF': 'TIRF',
    'FRAP-TIRF': 'FRAP_TIRF',
    'PC': 'PC',
    'Confocal': 'CONFOCAL',
    '': 'SONSTIGES',
    None: 'SONSTIGES'
}

def detect_csv_encoding(file_path):
    """Erkennt die Zeichenkodierung der CSV-Datei"""
    with open(file_path, 'rb') as f:
        raw_data = f.read(10000)
        result = chardet.detect(raw_data)
        return result['encoding']

def get_or_create_unknown_supplier():
    """Erstellt oder holt den 'Unbekannt' Lieferanten"""
    try:
        supplier = Supplier.objects.get(company_name__iexact='Unbekannt')
        print(f"  ✓ Verwende existierenden Lieferanten: {supplier.id} - {supplier.company_name}")
        return supplier
    except Supplier.DoesNotExist:
        supplier = Supplier.objects.create(
            company_name='Unbekannt',
            street='',
            house_number='',
            city='',
            postal_code='',
            country='DE',
            phone='',
            email='',
            website='',
            notes='Automatisch erstellter Lieferant für Legacy-Import ohne Lieferantenangabe'
        )
        print(f"  ✓ Erstellt neuen Lieferanten: {supplier.id} - {supplier.company_name}")
        return supplier

def find_customer(kunde_text):
    """Findet Kunden in der Datenbank basierend auf dem CSV-Text"""
    if not kunde_text or kunde_text.strip().lower() in ['', 'demo', 'frei']:
        return None, 0
    
    import re
    kunden_nr_match = re.search(r'K-(\d{5})', kunde_text)
    if kunden_nr_match:
        kunden_nr = kunden_nr_match.group(1)
        try:
            customer = Customer.objects.get(customer_number__endswith=kunden_nr)
            return customer, 100
        except (Customer.DoesNotExist, Customer.MultipleObjectsReturned):
            pass
    
    words = kunde_text.split()
    if words:
        lastname = words[0].strip(',')
        try:
            customers = Customer.objects.filter(last_name__iexact=lastname)
            if customers.count() == 1:
                return customers.first(), 90
        except:
            pass
    
    return None, 0

def determine_status(kunde_text):
    """Bestimmt den Status basierend auf Kundentext"""
    if not kunde_text or kunde_text.strip().lower() in ['', 'demo', 'frei']:
        return 'FREI'
    return 'GELIEFERT'

def parse_date(date_str):
    """Parst verschiedene Datumsformate"""
    if not date_str:
        return None
    for fmt in ['%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None

def import_failed_rows(csv_file_path, dry_run=True):
    """Importiert nur die Zeilen ohne Lieferantenangabe"""
    
    print(f"Starte Import fehlgeschlagener Zeilen aus: {csv_file_path}")
    print(f"Modus: {'DRY-RUN (keine Änderungen)' if dry_run else 'LIVE-IMPORT'}")
    print("-" * 80)
    
    encoding = detect_csv_encoding(csv_file_path)
    print(f"Using encoding: {encoding}")
    
    # Hole/erstelle "Unbekannt" Lieferanten
    if not dry_run:
        unknown_supplier = get_or_create_unknown_supplier()
    else:
        print("  [DRY-RUN] Würde 'Unbekannt' Lieferant erstellen/verwenden")
        unknown_supplier = None
    
    stats = {
        'processed': 0,
        'would_import': 0,
        'already_exists': 0,
        'imported': 0,
        'errors': 0,
        'customers_linked': 0,
        'customers_not_found': 0
    }
    
    samples = []
    
    try:
        with open(csv_file_path, 'r', encoding=encoding) as file:
            reader = csv.DictReader(file, delimiter=';')
            
            for row_num, row in enumerate(reader, 2):  # Start at 2 (header is 1)
                stats['processed'] += 1
                
                try:
                    # Extrahiere Daten
                    kategorie = row.get('Kategorie', '').strip()
                    b_nr = row.get('B-Nr.', '').strip()
                    serial_number = row.get('S/N', '').strip()
                    kunde = row.get('Kunde', '').strip()
                    auftrag = row.get('Auftragsnummer', '').strip()
                    lieferant_text = row.get('Lieferant', '').strip()
                    produkt = row.get('Produkt', '').strip()
                    ausgeliefert = row.get('ausgeliefert', '').strip()
                    notizen1 = row.get('Allgemeine Notizen 1', '').strip()
                    firmware = row.get('Instanz-Details Firmware', '').strip()
                    firmware_notes = row.get('Instanzdetails - Firmwarenotizen', '').strip()
                    
                    # NUR Zeilen ohne Lieferant importieren
                    if lieferant_text:
                        continue  # Hat Lieferant, wurde bereits importiert
                    
                    # Skip komplett leere Zeilen
                    if not any([kategorie, b_nr, serial_number, produkt]):
                        continue
                    
                    # Prüfe ob bereits existiert (mit article_number)
                    if b_nr:
                        existing = InventoryItem.objects.filter(article_number=b_nr).first()
                        if existing:
                            stats['already_exists'] += 1
                            continue
                    
                    stats['would_import'] += 1
                    
                    # Sammle Beispiele für Output
                    if len(samples) < 10:
                        samples.append(f"Line {row_num}: {kategorie} | {produkt[:40] if produkt else '(leer)'} | B-Nr: {b_nr} | Kunde: {kunde[:30] if kunde else ''}")
                    
                    if not dry_run:
                        # Finde Kategorie
                        category_code = CATEGORY_MAPPING.get(kategorie, 'SONSTIGES')
                        try:
                            product_category = ProductCategory.objects.get(code=category_code)
                        except ProductCategory.DoesNotExist:
                            try:
                                product_category = ProductCategory.objects.get(code='SONSTIGES')
                            except ProductCategory.DoesNotExist:
                                product_category = None
                        
                        # Finde Kunden
                        customer, confidence = find_customer(kunde)
                        if customer:
                            stats['customers_linked'] += 1
                        elif kunde:
                            stats['customers_not_found'] += 1
                        
                        # Bestimme Status
                        status = determine_status(kunde)
                        
                        # Erstelle Notizen
                        notes_parts = []
                        if kunde and not customer:
                            notes_parts.append(f"Kunde (nicht zugeordnet): {kunde}")
                        if notizen1:
                            notes_parts.append(notizen1)
                        
                        # Produkt-Name
                        product_name = produkt if produkt else f"{kategorie} (kein Produktname)"
                        
                        # Artikel-Nummer
                        article_number = b_nr if b_nr else f"LEGACY-{row_num}"
                        
                        # Parse Lieferdatum
                        delivery_date = parse_date(ausgeliefert)
                        
                        try:
                            with transaction.atomic():
                                inventory_item = InventoryItem.objects.create(
                                    # TAB 1: Basisinfo
                                    name=product_name[:500],
                                    model_designation='',
                                    description=f"Importiert aus Legacy-Lager\nKategorie: {kategorie}\nB-Nr: {b_nr}\nAuftrag: {auftrag}",
                                    supplier=unknown_supplier,
                                    article_number=article_number[:100],
                                    visitron_part_number='',
                                    product_category=product_category,
                                    item_function='TRADING_GOOD',
                                    
                                    # TAB 2: Instanz-spezifisch
                                    serial_number=serial_number[:100] if serial_number else '',
                                    quantity=Decimal('1.00'),
                                    unit='Stück',
                                    customer=customer,
                                    customer_name=kunde[:200] if (kunde and not customer) else '',
                                    order_number=auftrag[:20] if auftrag else '',
                                    delivery_date=delivery_date,
                                    firmware_version=firmware[:100] if firmware else '',
                                    firmware_notes=firmware_notes,
                                    
                                    # Preis und Status
                                    purchase_price=Decimal('0.00'),
                                    currency='EUR',
                                    status=status,
                                    
                                    # Notizen
                                    notes='\n'.join(notes_parts) if notes_parts else '',
                                    
                                    # Pflichtfelder
                                    stored_by_id=1,  # Admin user
                                )
                                stats['imported'] += 1
                                
                                if stats['imported'] % 100 == 0:
                                    print(f"  Imported {stats['imported']} items...")
                        
                        except Exception as e:
                            stats['errors'] += 1
                            if stats['errors'] <= 5:
                                print(f"Line {row_num}: ERROR - {str(e)[:100]}")
                
                except Exception as e:
                    stats['errors'] += 1
                    if stats['errors'] <= 5:
                        print(f"Line {row_num}: ERROR - {str(e)[:100]}")
    
    except FileNotFoundError:
        print(f"FEHLER: Datei nicht gefunden: {csv_file_path}")
        return
    except Exception as e:
        print(f"FEHLER beim Lesen der Datei: {str(e)}")
        return
    
    # Zeige Beispiele
    if samples:
        print("\nBeispiele der zu importierenden Zeilen:")
        for sample in samples:
            print(f"  {sample}")
    
    # Zusammenfassung
    print("\n" + "-" * 80)
    print("Import Summary:")
    print(f"  Total rows processed: {stats['processed']}")
    print(f"  Rows without supplier (to import): {stats['would_import']}")
    print(f"  Already exists (skipped): {stats['already_exists']}")
    print(f"  Errors: {stats['errors']}")
    
    if not dry_run:
        print(f"  Successfully imported: {stats['imported']}")
        print(f"  Customers linked: {stats['customers_linked']}")
        print(f"  Customers not found (in notes): {stats['customers_not_found']}")
    else:
        print("\n  [DRY-RUN] Führe mit --live aus um tatsächlich zu importieren")

def main():
    parser = argparse.ArgumentParser(description='Import fehlgeschlagener Inventar-Zeilen (ohne Lieferant)')
    parser.add_argument('--csv', default=r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\Lager-gesamt.csv',
                      help='Pfad zur CSV-Datei')
    parser.add_argument('--live', action='store_true',
                      help='Führe tatsächlichen Import durch (standardmäßig Dry-Run)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.csv):
        print(f"FEHLER: CSV-Datei nicht gefunden: {args.csv}")
        return
    
    import_failed_rows(args.csv, dry_run=not args.live)

if __name__ == '__main__':
    main()
