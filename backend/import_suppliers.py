#!/usr/bin/env python
"""
Script zum Importieren von Supplier (Lieferanten) und Supplier Contacts aus CSV-Dateien.

CSV-Dateien:
- suppliers_template.csv: Lieferanten-Stammdaten
- supplier_contacts_template.csv: Kontaktpersonen der Lieferanten

Logik:
- Wenn supplier_number leer ist: Neuen Supplier anlegen
- Wenn supplier_number vorhanden: Bestehenden Supplier aktualisieren
- Contacts werden dem entsprechenden Supplier zugeordnet

Usage:
    python import_suppliers.py                      # Dry-run (zeigt nur Änderungen)
    python import_suppliers.py --execute            # Führt Import durch
    python import_suppliers.py --suppliers-only     # Nur Suppliers importieren
    python import_suppliers.py --contacts-only      # Nur Contacts importieren
"""

import os
import sys
import django
import csv
import re

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from suppliers.models import Supplier, SupplierContact

# Pfade zu den CSV-Dateien
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SUPPLIERS_CSV = os.path.join(BASE_DIR, '..', 'Datenvorlagen', 'suppliers_template.csv')
CONTACTS_CSV = os.path.join(BASE_DIR, '..', 'Datenvorlagen', 'supplier_contacts_template.csv')


def clean_string(value):
    """Säubere einen String-Wert"""
    if value is None:
        return ''
    # Ersetze spezielle Zeichen
    value = str(value).strip()
    # Ersetze kaputte Umlaute
    value = value.replace('�', 'ü').replace('ä', 'ä').replace('ö', 'ö')
    # Non-breaking spaces ersetzen
    value = value.replace('\xa0', ' ')
    return value


def extract_supplier_number(supplier_number_field):
    """
    Extrahiere die Lieferantennummer aus dem Format "108 - CoolLED Ltd."
    Returns: (nummer, name) oder (None, None)
    """
    if not supplier_number_field:
        return None, None
    
    supplier_number_field = clean_string(supplier_number_field)
    
    # Versuche Format "123 - Name" zu parsen
    match = re.match(r'^(\d+)\s*-\s*(.+)$', supplier_number_field)
    if match:
        return match.group(1), match.group(2).strip()
    
    # Nur Nummer
    if supplier_number_field.isdigit():
        return supplier_number_field, None
    
    return None, supplier_number_field


def parse_boolean(value):
    """Parse einen Boolean-Wert aus verschiedenen Formaten"""
    if isinstance(value, bool):
        return value
    if not value:
        return True  # Default zu True für is_active
    value = str(value).strip().lower()
    return value in ('true', '1', 'yes', 'ja', 'wahr')


def get_country_code(country):
    """Konvertiere Ländernamen in ISO-2 Codes"""
    country_map = {
        'deutschland': 'DE',
        'germany': 'DE',
        'usa': 'US',
        'united states': 'US',
        'uk': 'GB',
        'united kingdom': 'GB',
        'northern ireland, uk': 'GB',
        'österreich': 'AT',
        'austria': 'AT',
        'schweiz': 'CH',
        'switzerland': 'CH',
        'italien': 'IT',
        'italy': 'IT',
        'frankreich': 'FR',
        'france': 'FR',
        'niederlande': 'NL',
        'netherlands': 'NL',
        'belgien': 'BE',
        'belgium': 'BE',
        'spanien': 'ES',
        'spain': 'ES',
        'japan': 'JP',
        'china': 'CN',
    }
    
    if not country:
        return 'DE'
    
    country_lower = clean_string(country).lower()
    
    # Bereits ein 2-stelliger Code?
    if len(country_lower) == 2:
        return country_lower.upper()
    
    return country_map.get(country_lower, country[:2].upper() if len(country) >= 2 else 'DE')


def read_csv_file(filepath):
    """Lese CSV-Datei mit Semikolon als Trennzeichen"""
    rows = []
    
    # Versuche verschiedene Encodings
    for encoding in ['utf-8', 'cp1252', 'latin-1']:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f, delimiter=';')
                rows = list(reader)
            break
        except UnicodeDecodeError:
            continue
    
    return rows


def find_supplier(supplier_number=None, company_name=None):
    """
    Finde einen Supplier entweder über Nummer oder Namen.
    Returns: Supplier oder None
    """
    if supplier_number:
        # Versuche über exakte Nummer zu finden
        try:
            return Supplier.objects.get(supplier_number=supplier_number)
        except Supplier.DoesNotExist:
            pass
    
    if company_name:
        # Versuche über Namen zu finden (case-insensitive)
        company_name_clean = clean_string(company_name)
        try:
            return Supplier.objects.get(company_name__iexact=company_name_clean)
        except Supplier.DoesNotExist:
            pass
        except Supplier.MultipleObjectsReturned:
            return Supplier.objects.filter(company_name__iexact=company_name_clean).first()
    
    return None


def import_suppliers(execute=False):
    """Importiere Suppliers aus CSV"""
    print("\n" + "=" * 70)
    print("IMPORT SUPPLIERS")
    print("=" * 70)
    
    if not os.path.exists(SUPPLIERS_CSV):
        print(f"❌ Datei nicht gefunden: {SUPPLIERS_CSV}")
        return {}
    
    rows = read_csv_file(SUPPLIERS_CSV)
    print(f"📄 {len(rows)} Zeilen in suppliers_template.csv gefunden")
    
    stats = {
        'created': 0,
        'updated': 0,
        'skipped': 0,
        'errors': []
    }
    
    # Mapping von Supplier-Namen zu Supplier-Objekten für Contacts-Import
    supplier_mapping = {}
    
    for i, row in enumerate(rows, start=2):  # Start bei 2 wegen Header
        company_name = clean_string(row.get('company_name', ''))
        
        # Überspringe leere Zeilen
        if not company_name:
            continue
        
        supplier_number_field = clean_string(row.get('supplier_number', ''))
        current_name = clean_string(row.get('current_supplier_name', ''))
        
        # Extrahiere Supplier-Nummer
        extracted_number, extracted_name = extract_supplier_number(supplier_number_field)
        
        # Finde bestehenden Supplier
        existing_supplier = None
        if extracted_number:
            existing_supplier = find_supplier(supplier_number=extracted_number)
        if not existing_supplier and current_name:
            existing_supplier = find_supplier(company_name=current_name)
        if not existing_supplier:
            existing_supplier = find_supplier(company_name=company_name)
        
        # Daten vorbereiten
        supplier_data = {
            'company_name': company_name,
            'street': clean_string(row.get('street', '')),
            'house_number': clean_string(row.get('house_number', '')),
            'address_supplement': clean_string(row.get('address_supplement', '')),
            'postal_code': clean_string(row.get('postal_code', '')),
            'city': clean_string(row.get('city', '')),
            'state': clean_string(row.get('state', '')),
            'country': get_country_code(row.get('country', '')),
            'email': clean_string(row.get('email', '')),
            'phone': clean_string(row.get('phone', '')),
            'website': clean_string(row.get('website', '')),
            'customer_number': clean_string(row.get('customer_number', '')),
            'notes': clean_string(row.get('notes', '')),
            'is_active': parse_boolean(row.get('is_active', True)),
        }
        
        if existing_supplier:
            # Update bestehenden Supplier
            action = "UPDATE"
            changes = []
            
            for field, new_value in supplier_data.items():
                old_value = getattr(existing_supplier, field, '')
                if new_value and str(new_value) != str(old_value):
                    changes.append(f"{field}: '{old_value}' → '{new_value}'")
                    if execute:
                        setattr(existing_supplier, field, new_value)
            
            if changes:
                print(f"\n📝 [{action}] {existing_supplier.supplier_number} - {company_name}")
                for change in changes[:5]:  # Max 5 Änderungen anzeigen
                    print(f"    {change}")
                if len(changes) > 5:
                    print(f"    ... und {len(changes) - 5} weitere Änderungen")
                
                if execute:
                    try:
                        existing_supplier.save()
                        stats['updated'] += 1
                    except Exception as e:
                        stats['errors'].append(f"Zeile {i}: {str(e)}")
                else:
                    stats['updated'] += 1
                
                supplier_mapping[company_name.lower()] = existing_supplier
                if current_name:
                    supplier_mapping[current_name.lower()] = existing_supplier
            else:
                stats['skipped'] += 1
                supplier_mapping[company_name.lower()] = existing_supplier
                if current_name:
                    supplier_mapping[current_name.lower()] = existing_supplier
        else:
            # Neuen Supplier anlegen
            action = "CREATE"
            print(f"\n✨ [{action}] {company_name}")
            print(f"    Adresse: {supplier_data['street']} {supplier_data['house_number']}, {supplier_data['postal_code']} {supplier_data['city']}")
            
            if execute:
                try:
                    new_supplier = Supplier.objects.create(**supplier_data)
                    print(f"    → Neue Nummer: {new_supplier.supplier_number}")
                    stats['created'] += 1
                    supplier_mapping[company_name.lower()] = new_supplier
                    if current_name:
                        supplier_mapping[current_name.lower()] = new_supplier
                except Exception as e:
                    stats['errors'].append(f"Zeile {i}: {str(e)}")
            else:
                stats['created'] += 1
    
    print(f"\n📊 SUPPLIERS STATISTIK:")
    print(f"  ✨ Neu erstellt: {stats['created']}")
    print(f"  📝 Aktualisiert: {stats['updated']}")
    print(f"  ⏭️  Übersprungen: {stats['skipped']}")
    
    if stats['errors']:
        print(f"\n❌ FEHLER ({len(stats['errors'])}):")
        for error in stats['errors'][:10]:
            print(f"  - {error}")
    
    return supplier_mapping


def import_contacts(execute=False, supplier_mapping=None):
    """Importiere Supplier Contacts aus CSV"""
    print("\n" + "=" * 70)
    print("IMPORT SUPPLIER CONTACTS")
    print("=" * 70)
    
    if not os.path.exists(CONTACTS_CSV):
        print(f"❌ Datei nicht gefunden: {CONTACTS_CSV}")
        return
    
    if supplier_mapping is None:
        supplier_mapping = {}
    
    rows = read_csv_file(CONTACTS_CSV)
    print(f"📄 {len(rows)} Zeilen in supplier_contacts_template.csv gefunden")
    
    stats = {
        'created': 0,
        'updated': 0,
        'skipped': 0,
        'supplier_created': 0,
        'errors': []
    }
    
    # Kontakttyp-Mapping
    contact_type_map = {
        'main': 'main',
        'hauptansprechpartner': 'main',
        'service': 'service',
        'sales': 'sales',
        'vertrieb': 'sales',
        'orders': 'orders',
        'bestellungen': 'orders',
        'order_processing': 'order_processing',
        'auftragsabwicklung': 'order_processing',
        'ceo': 'ceo',
        'geschäftsführung': 'ceo',
    }
    
    for i, row in enumerate(rows, start=2):
        supplier_number_field = clean_string(row.get('supplier_number', ''))
        supplier_name = clean_string(row.get('supplier_name', ''))
        contact_person = clean_string(row.get('contact_person', ''))
        contact_type_raw = clean_string(row.get('contact_type', '')).lower()
        
        # Überspringe leere Zeilen
        if not supplier_name and not supplier_number_field:
            continue
        
        # Validiere Kontakttyp
        contact_type = contact_type_map.get(contact_type_raw, contact_type_raw)
        if contact_type not in dict(SupplierContact.CONTACT_TYPE_CHOICES):
            stats['errors'].append(f"Zeile {i}: Ungültiger Kontakttyp '{contact_type_raw}'")
            continue
        
        # Finde oder erstelle Supplier
        extracted_number, extracted_name = extract_supplier_number(supplier_number_field)
        
        supplier = None
        
        # 1. Versuche über Mapping
        if supplier_name:
            supplier = supplier_mapping.get(supplier_name.lower())
        
        # 2. Versuche über Nummer
        if not supplier and extracted_number:
            supplier = find_supplier(supplier_number=extracted_number)
            if supplier:
                supplier_mapping[supplier.company_name.lower()] = supplier
        
        # 3. Versuche über Namen
        if not supplier and supplier_name:
            supplier = find_supplier(company_name=supplier_name)
            if supplier:
                supplier_mapping[supplier_name.lower()] = supplier
        
        # 4. Erstelle neuen Supplier wenn nötig
        if not supplier:
            company_name = supplier_name or extracted_name or f"Supplier Zeile {i}"
            print(f"\n⚠️  Supplier '{company_name}' nicht gefunden - wird erstellt")
            
            # Sammle Adressdaten aus Contact
            new_supplier_data = {
                'company_name': company_name,
                'street': clean_string(row.get('street', '')),
                'house_number': clean_string(row.get('house_number', '')),
                'address_supplement': clean_string(row.get('address_supplement', '')),
                'postal_code': clean_string(row.get('postal_code', '')),
                'city': clean_string(row.get('city', '')),
                'state': clean_string(row.get('state', '')),
                'country': get_country_code(row.get('country', '')),
                'email': clean_string(row.get('email', '')),
                'phone': clean_string(row.get('phone', '')),
            }
            
            if execute:
                try:
                    supplier = Supplier.objects.create(**new_supplier_data)
                    print(f"    → Neue Nummer: {supplier.supplier_number}")
                    supplier_mapping[company_name.lower()] = supplier
                    stats['supplier_created'] += 1
                except Exception as e:
                    stats['errors'].append(f"Zeile {i}: Supplier erstellen fehlgeschlagen - {str(e)}")
                    continue
            else:
                print(f"    → Würde Supplier '{company_name}' erstellen")
                stats['supplier_created'] += 1
                continue  # Im Dry-Run können wir keine Contacts ohne Supplier erstellen
        
        # Kontaktdaten vorbereiten
        contact_data = {
            'supplier': supplier,
            'contact_type': contact_type,
            'is_primary': parse_boolean(row.get('is_primary', False)),
            'contact_person': contact_person,
            'contact_function': clean_string(row.get('contact_function', '')),
            'street': clean_string(row.get('street', '')),
            'house_number': clean_string(row.get('house_number', '')),
            'address_supplement': clean_string(row.get('address_supplement', '')),
            'postal_code': clean_string(row.get('postal_code', '')),
            'city': clean_string(row.get('city', '')),
            'state': clean_string(row.get('state', '')),
            'country': get_country_code(row.get('country', '')),
            'email': clean_string(row.get('email', '')),
            'phone': clean_string(row.get('phone', '')),
            'mobile': clean_string(row.get('mobile', '')),
            'notes': clean_string(row.get('notes', '')),
            'is_active': parse_boolean(row.get('is_active', True)),
        }
        
        # Prüfe ob Kontakt bereits existiert
        existing_contact = None
        if contact_person:
            existing_contact = SupplierContact.objects.filter(
                supplier=supplier,
                contact_type=contact_type,
                contact_person__iexact=contact_person
            ).first()
        elif contact_data['email']:
            existing_contact = SupplierContact.objects.filter(
                supplier=supplier,
                contact_type=contact_type,
                email__iexact=contact_data['email']
            ).first()
        
        if existing_contact:
            # Update
            changes = []
            for field, new_value in contact_data.items():
                if field == 'supplier':
                    continue
                old_value = getattr(existing_contact, field, '')
                if new_value and str(new_value) != str(old_value):
                    changes.append(f"{field}: '{old_value}' → '{new_value}'")
                    if execute:
                        setattr(existing_contact, field, new_value)
            
            if changes:
                print(f"\n📝 [UPDATE] {supplier.company_name} - {contact_type}: {contact_person}")
                for change in changes[:3]:
                    print(f"    {change}")
                
                if execute:
                    try:
                        existing_contact.save()
                        stats['updated'] += 1
                    except Exception as e:
                        stats['errors'].append(f"Zeile {i}: {str(e)}")
                else:
                    stats['updated'] += 1
            else:
                stats['skipped'] += 1
        else:
            # Create
            contact_label = contact_person or contact_data['email'] or contact_type
            print(f"\n✨ [CREATE] {supplier.company_name} - {contact_type}: {contact_label}")
            
            if execute:
                try:
                    SupplierContact.objects.create(**contact_data)
                    stats['created'] += 1
                except Exception as e:
                    stats['errors'].append(f"Zeile {i}: {str(e)}")
            else:
                stats['created'] += 1
    
    print(f"\n📊 CONTACTS STATISTIK:")
    print(f"  ✨ Neu erstellt: {stats['created']}")
    print(f"  📝 Aktualisiert: {stats['updated']}")
    print(f"  ⏭️  Übersprungen: {stats['skipped']}")
    print(f"  🏢 Suppliers erstellt: {stats['supplier_created']}")
    
    if stats['errors']:
        print(f"\n❌ FEHLER ({len(stats['errors'])}):")
        for error in stats['errors'][:10]:
            print(f"  - {error}")


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='Importiere Suppliers und Supplier Contacts aus CSV'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Führe den Import tatsächlich durch (Standard: Dry-Run)'
    )
    parser.add_argument(
        '--suppliers-only',
        action='store_true',
        help='Nur Suppliers importieren'
    )
    parser.add_argument(
        '--contacts-only',
        action='store_true',
        help='Nur Contacts importieren'
    )
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("SUPPLIER IMPORT")
    print("=" * 70)
    
    if not args.execute:
        print("\n⚠️  DRY-RUN MODUS - Keine Änderungen werden durchgeführt!")
    
    supplier_mapping = {}
    
    if not args.contacts_only:
        supplier_mapping = import_suppliers(execute=args.execute)
    
    if not args.suppliers_only:
        import_contacts(execute=args.execute, supplier_mapping=supplier_mapping)
    
    if not args.execute:
        print("\n" + "=" * 70)
        print("⚠️  DRY-RUN MODUS - Verwende --execute um den Import durchzuführen!")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        print("✅ IMPORT ABGESCHLOSSEN!")
        print("=" * 70)


if __name__ == '__main__':
    main()
