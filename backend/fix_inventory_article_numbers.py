#!/usr/bin/env python3
"""
Korrigiert die InventoryItems:
- B-Nr. (B-xxx-MM/YY) von article_number -> order_number (Bestellnummer beim Lieferanten)
- Auftragsnummer (O-xxx) aus CSV -> customer_order_number (Kundenauftragsnummer)
- article_number wird geleert (Lieferanten-Artikelnummer ist nicht in der CSV)

Verwendung:
  python fix_inventory_article_numbers.py          # Dry-Run
  python fix_inventory_article_numbers.py --live   # Echter Update
"""

import os
import sys
import django
import csv
import argparse
import chardet

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from inventory.models import InventoryItem

def detect_csv_encoding(file_path):
    """Erkennt die Zeichenkodierung der CSV-Datei"""
    with open(file_path, 'rb') as f:
        raw_data = f.read(10000)
        result = chardet.detect(raw_data)
        return result['encoding']

def fix_article_numbers(csv_file_path, dry_run=True):
    """Korrigiert die article_number Felder"""
    
    print(f"Korrigiere Inventar-Artikelnummern aus: {csv_file_path}")
    print(f"Modus: {'DRY-RUN (keine Änderungen)' if dry_run else 'LIVE-UPDATE'}")
    print("-" * 80)
    
    encoding = detect_csv_encoding(csv_file_path)
    print(f"Using encoding: {encoding}")
    
    stats = {
        'processed': 0,
        'updated': 0,
        'not_found': 0,
        'no_change': 0,
        'errors': 0
    }
    
    samples = []
    
    try:
        with open(csv_file_path, 'r', encoding=encoding) as file:
            reader = csv.DictReader(file, delimiter=';')
            
            for row_num, row in enumerate(reader, 2):
                stats['processed'] += 1
                
                try:
                    # Extrahiere Daten aus CSV (Spaltennames wie in der CSV)
                    b_nr = row.get('order', '').strip()  # "order" ist die Bestellnummer B-xxx
                    serial_number = row.get('S/N', '').strip()
                    produkt = row.get('Produktname', '').strip()
                    auftrag = row.get('cutomer_order', '').strip()  # Tippfehler in CSV: "cutomer_order"
                    
                    # Finde das InventoryItem
                    # Zuerst nach article_number (wo B-Nr. fälschlicherweise ist)
                    item = None
                    
                    if b_nr:
                        # Suche nach B-Nr. in article_number
                        item = InventoryItem.objects.filter(article_number=b_nr).first()
                    
                    if not item and serial_number:
                        # Fallback: Suche nach Seriennummer
                        item = InventoryItem.objects.filter(serial_number=serial_number).first()
                    
                    if not item:
                        # Suche nach LEGACY-Nummer
                        legacy_nr = f"LEGACY-{row_num}"
                        item = InventoryItem.objects.filter(article_number=legacy_nr).first()
                    
                    if not item:
                        stats['not_found'] += 1
                        continue
                    
                    # Prüfe ob Update nötig
                    current_article = item.article_number
                    current_order = item.order_number
                    current_customer_order = item.customer_order_number
                    
                    # Korrekte Zuordnung:
                    # - B-Nr. (B-xxx-MM/YY) -> order_number (Bestellnummer beim Lieferanten)
                    # - Auftragsnummer (O-xxx) -> customer_order_number (Kundenauftragsnummer)
                    # - article_number -> leer (Lieferanten-Artikelnummer nicht in CSV)
                    
                    needs_update = False
                    new_article_number = ''  # Lieferanten-Artikelnummer ist nicht in der CSV
                    new_order_number = b_nr if b_nr else ''  # B-Nr. ist die Bestellnummer
                    new_customer_order_number = auftrag if auftrag else ''  # O-xxx ist Kundenauftrag
                    
                    # Prüfe ob article_number eine B-Nr. enthält (B-xxx Format) - muss verschoben werden
                    if current_article and current_article.startswith('B-'):
                        needs_update = True
                    
                    # Prüfe ob order_number noch nicht die B-Nr. hat
                    if b_nr and current_order != b_nr:
                        needs_update = True
                    
                    # Prüfe ob customer_order_number noch nicht die O-Nr. hat
                    if auftrag and current_customer_order != auftrag:
                        needs_update = True
                    
                    if not needs_update:
                        stats['no_change'] += 1
                        continue
                    
                    if len(samples) < 10:
                        samples.append(
                            f"ID {item.id}: article_number '{current_article}' -> '', "
                            f"order_number '{current_order}' -> '{new_order_number}', "
                            f"customer_order_number '{current_customer_order}' -> '{new_customer_order_number}'"
                        )
                    
                    if not dry_run:
                        # Update durchführen
                        item.article_number = new_article_number
                        item.order_number = new_order_number[:20] if new_order_number else ''
                        item.customer_order_number = new_customer_order_number[:100] if new_customer_order_number else ''
                        item.save(update_fields=['article_number', 'order_number', 'customer_order_number'])
                    
                    stats['updated'] += 1
                    
                    if stats['updated'] % 500 == 0:
                        print(f"  Updated {stats['updated']} items...")
                
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
        print("\nBeispiele der Änderungen:")
        for sample in samples:
            print(f"  {sample}")
    
    # Zusammenfassung
    print("\n" + "-" * 80)
    print("Update Summary:")
    print(f"  Total rows processed: {stats['processed']}")
    print(f"  Items to update: {stats['updated']}")
    print(f"  Items not found: {stats['not_found']}")
    print(f"  No change needed: {stats['no_change']}")
    print(f"  Errors: {stats['errors']}")
    
    if dry_run:
        print("\n  [DRY-RUN] Führe mit --live aus um tatsächlich zu aktualisieren")

def main():
    parser = argparse.ArgumentParser(description='Korrigiert Inventar-Artikelnummern')
    parser.add_argument('--csv', default=r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\Lager-gesamt.csv',
                      help='Pfad zur CSV-Datei')
    parser.add_argument('--live', action='store_true',
                      help='Führe tatsächliches Update durch (standardmäßig Dry-Run)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.csv):
        print(f"FEHLER: CSV-Datei nicht gefunden: {args.csv}")
        return
    
    fix_article_numbers(args.csv, dry_run=not args.live)

if __name__ == '__main__':
    main()
