#!/usr/bin/env python
"""
Legacy Commission Import Script
================================

Importiert Provisionsempfänger für Legacy-Aufträge aus der Access-Datenbank.

Workflow:
1. Liest verkäufer.csv um Verkäufer-Index -> Mitarbeiter-Mapping zu erstellen
2. Erstellt fehlende Mitarbeiter als inaktiv
3. Liest aufträge.csv um Aufträge -> Verkäufer zuzuordnen
4. Matcht Aufträge über Auftragsdatum + Netto-Gesamtsumme
5. Erstellt CustomerOrderCommissionRecipient mit 100% Anteil

Verwendung:
    python import_legacy_commissions.py           # Dry-run (Vorschau)
    python import_legacy_commissions.py --live    # Echter Import
"""

import os
import sys
import csv
import django
from datetime import datetime
from decimal import Decimal, InvalidOperation

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db import transaction
from users.models import Employee
from customer_orders.models import CustomerOrder, CustomerOrderCommissionRecipient


# ============================================================================
# Configuration
# ============================================================================

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'Datenvorlagen')

# Mapping für Verkäufernamen die anders heißen
# BWurm und Beutin sind beide Benjamin Beutin
NAME_ALIASES = {
    'BWurm': 'Beutin',
    'Beutin': 'Beutin',
}

# Bekannte aktive Mitarbeiter (Nachnamen in lowercase)
ACTIVE_EMPLOYEES = [
    'babaryka',
    'beutin',
    'dunkel',
    'köhn',
    'koehn',
    'kühn',
    'kuehn',
    'linhuber',
    'steiner',
    'weisgerber',
    'wurm',
    'zobiak',
]

# Default-Mitarbeiterdaten für neue (inaktive) Mitarbeiter
DEFAULT_EMPLOYEE_DATA = {
    'date_of_birth': datetime(1970, 1, 1).date(),
    'employment_start_date': datetime(1990, 1, 1).date(),
    'employment_end_date': datetime(2020, 12, 31).date(),
    'contract_type': 'unbefristet',
    'job_title': 'Vertrieb (Legacy)',
    'department': 'Vertrieb',
    'employment_status': 'inaktiv',
}


# ============================================================================
# Helper Functions
# ============================================================================

def parse_german_decimal(value):
    """Parst deutsche Dezimalzahlen (1.234,56 -> 1234.56)"""
    if not value or str(value).strip() == '':
        return Decimal('0')
    try:
        # Entferne Tausender-Punkte und ersetze Komma durch Punkt
        cleaned = str(value).replace('.', '').replace(',', '.')
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return Decimal('0')


def parse_german_date(value):
    """Parst deutsche Datumsformate (DD.MM.YYYY)"""
    if not value or str(value).strip() == '':
        return None
    try:
        # Versuche verschiedene Formate
        for fmt in ['%d.%m.%Y', '%d.%m.%y']:
            try:
                dt = datetime.strptime(str(value).strip(), fmt)
                # Korrigiere 2-stelliges Jahr
                if dt.year < 100:
                    dt = dt.replace(year=dt.year + 1900 if dt.year >= 90 else dt.year + 2000)
                return dt.date()
            except ValueError:
                continue
        return None
    except Exception:
        return None


def load_csv_data(filename):
    """Lädt CSV-Datei mit Semikolon-Trennung und verschiedenen Encodings"""
    filepath = os.path.join(DATA_DIR, filename)
    
    # Versuche verschiedene Encodings
    for encoding in ['utf-8-sig', 'utf-8', 'latin1', 'cp1252']:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f, delimiter=';')
                data = list(reader)
                print(f"  Loaded {filename} ({len(data)} rows, encoding: {encoding})")
                return data
        except (UnicodeDecodeError, UnicodeError):
            continue
    
    raise ValueError(f"Could not decode {filename} with any known encoding")


def normalize_name(name):
    """Normalisiert Mitarbeiternamen für Vergleich"""
    if not name:
        return ''
    name = name.strip()
    # Ersetze Umlaute
    replacements = {
        'ä': 'ae', 'ö': 'oe', 'ü': 'ue',
        'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue',
        'ß': 'ss'
    }
    for old, new in replacements.items():
        name = name.replace(old, new)
    return name.lower()


def find_employee_by_lastname(lastname, employees_dict):
    """Findet Mitarbeiter anhand des Nachnamens"""
    if not lastname:
        return None
    
    # Prüfe auf Alias
    if lastname in NAME_ALIASES:
        lastname = NAME_ALIASES[lastname]
    
    normalized = normalize_name(lastname)
    
    # Suche in vorhandenen Mitarbeitern
    for emp_name, emp in employees_dict.items():
        if normalize_name(emp_name) == normalized:
            return emp
        # Auch auf exact match prüfen
        if emp.last_name.lower() == lastname.lower():
            return emp
    
    return None


def load_seller_mapping():
    """Lädt die Verkäufer-Mapping-Tabelle"""
    data = load_csv_data('verkäufer.csv')
    mapping = {}
    
    print("\n  Verkäufer-Mapping aus CSV:")
    for row in data:
        # Finde die Spalten (können unterschiedlich benannt sein wegen Encoding)
        name_key = None
        index_key = None
        
        for key in row.keys():
            if 'name' in key.lower():
                name_key = key
            if 'index' in key.lower() or 'id' in key.lower():
                index_key = key
        
        if not name_key or not index_key:
            # Fallback: Erste und zweite Spalte
            keys = list(row.keys())
            name_key = keys[0] if len(keys) > 0 else None
            index_key = keys[1] if len(keys) > 1 else None
        
        if name_key and index_key:
            name = row.get(name_key, '').strip()
            try:
                index = int(row.get(index_key, '0'))
            except ValueError:
                continue
            
            if name:  # Leere Namen überspringen
                mapping[index] = name
                print(f"    Index {index:2d} -> {name}")
    
    return mapping


def get_next_employee_id():
    """Generiert die nächste eindeutige Employee ID"""
    from users.models import Employee
    # Finde die höchste EMP-Nummer
    all_employees = Employee.objects.all()
    max_number = 0
    for emp in all_employees:
        if emp.employee_id and emp.employee_id.startswith('EMP'):
            try:
                num = int(emp.employee_id[3:])
                if num > max_number:
                    max_number = num
            except ValueError:
                pass
    return f"EMP{max_number + 1:03d}"


def get_or_create_employees(seller_mapping, dry_run=False):
    """
    Erstellt oder findet Mitarbeiter basierend auf Verkäufer-Mapping.
    Gibt ein Dict zurück: seller_index -> Employee
    """
    print("\n" + "="*60)
    print("PHASE 1: Mitarbeiter-Zuordnung")
    print("="*60)
    
    # Lade existierende Mitarbeiter
    existing_employees = {normalize_name(e.last_name): e for e in Employee.objects.all()}
    print(f"\n  Existierende Mitarbeiter: {len(existing_employees)}")
    for name, emp in existing_employees.items():
        print(f"    - {emp.last_name}, {emp.first_name} ({emp.employee_id}, {emp.employment_status})")
    
    seller_to_employee = {}
    employees_to_create = []
    employees_found = []
    employees_missing = []
    
    for seller_index, seller_name in seller_mapping.items():
        if not seller_name:
            continue
        
        # Behandle Aliase
        effective_name = NAME_ALIASES.get(seller_name, seller_name)
        
        # Suche existierenden Mitarbeiter
        employee = find_employee_by_lastname(effective_name, existing_employees)
        
        if employee:
            seller_to_employee[seller_index] = employee
            employees_found.append((seller_index, seller_name, employee))
        else:
            employees_missing.append((seller_index, seller_name, effective_name))
    
    print(f"\n  Gefundene Mitarbeiter ({len(employees_found)}):")
    for idx, name, emp in employees_found:
        print(f"    Index {idx:2d}: {name:20s} -> {emp.last_name}, {emp.first_name} ({emp.employee_id})")
    
    print(f"\n  Fehlende Mitarbeiter ({len(employees_missing)}):")
    for idx, name, eff_name in employees_missing:
        is_active = normalize_name(eff_name) in [normalize_name(n) for n in ACTIVE_EMPLOYEES]
        status = "AKTIV" if is_active else "INAKTIV"
        print(f"    Index {idx:2d}: {name:20s} (effektiv: {eff_name}) -> wird als {status} angelegt")
    
    # Erstelle fehlende Mitarbeiter
    if employees_missing:
        print(f"\n  Erstelle {len(employees_missing)} fehlende Mitarbeiter...")
        
        for idx, name, eff_name in employees_missing:
            is_active = normalize_name(eff_name) in [normalize_name(n) for n in ACTIVE_EMPLOYEES]
            
            if dry_run:
                print(f"    [DRY-RUN] Würde anlegen: {eff_name} (inaktiv={not is_active})")
                # Simuliere Employee für Dry-Run
                class SimulatedEmployee:
                    def __init__(self, name, idx, is_active):
                        self.last_name = name
                        self.first_name = '(Legacy)'
                        self.employee_id = f'SIM-{idx:03d}'
                        self.employment_status = 'aktiv' if is_active else 'inaktiv'
                        self.pk = None
                        self.id = None
                    def __str__(self):
                        return f"{self.first_name} {self.last_name}"
                
                simulated = SimulatedEmployee(eff_name, idx, is_active)
                seller_to_employee[idx] = simulated
            else:
                # Erstelle echten Mitarbeiter - jeder in eigener Transaktion
                emp_data = DEFAULT_EMPLOYEE_DATA.copy()
                emp_data['last_name'] = eff_name
                emp_data['first_name'] = '(Legacy)'
                # Generiere eindeutige employee_id
                emp_data['employee_id'] = get_next_employee_id()
                
                if is_active:
                    emp_data['employment_status'] = 'aktiv'
                    emp_data['employment_end_date'] = None
                
                try:
                    with transaction.atomic():
                        new_emp = Employee.objects.create(**emp_data)
                        seller_to_employee[idx] = new_emp
                        existing_employees[normalize_name(eff_name)] = new_emp
                        print(f"    [CREATED] {new_emp.employee_id}: {eff_name}")
                except Exception as e:
                    print(f"    [ERROR] Konnte {eff_name} nicht anlegen: {e}")
    
    return seller_to_employee


def build_order_lookup(orders):
    """
    Erstellt ein Lookup-Dict für Aufträge basierend auf Datum + Netto-Summe.
    Key: (order_date, rounded_net_total)
    Value: Liste von Orders (können mehrere sein bei gleichem Datum+Summe)
    """
    lookup = {}
    
    for order in orders:
        if not order.order_date:
            continue
        
        # Runde auf 2 Dezimalstellen für Vergleich
        net_total = round(float(order.total_net), 2)
        key = (order.order_date, net_total)
        
        if key not in lookup:
            lookup[key] = []
        lookup[key].append(order)
    
    return lookup


def import_commissions(seller_to_employee, dry_run=False):
    """
    Importiert Provisionsempfänger für Legacy-Aufträge.
    Matcht über Auftragsdatum + Netto-Gesamtsumme.
    """
    print("\n" + "="*60)
    print("PHASE 2: Provisionsempfänger importieren")
    print("="*60)
    
    # Lade Auftrags-CSV
    orders_data = load_csv_data('aufträge.csv')
    print(f"\n  Aufträge in CSV: {len(orders_data)}")
    
    # Lade alle Kundenaufträge
    all_orders = list(CustomerOrder.objects.all().select_related())
    print(f"  Aufträge in Datenbank: {len(all_orders)}")
    
    # Baue Lookup
    order_lookup = build_order_lookup(all_orders)
    print(f"  Unique Datum+Summe Kombinationen: {len(order_lookup)}")
    
    # Statistiken
    stats = {
        'processed': 0,
        'matched': 0,
        'already_has_recipient': 0,
        'created': 0,
        'no_seller': 0,
        'no_employee': 0,
        'no_match': 0,
        'multiple_matches': 0,
        'errors': 0,
    }
    
    # Finde Spaltennamen (können wegen Encoding unterschiedlich sein)
    sample_row = orders_data[0] if orders_data else {}
    seller_id_key = None
    order_date_key = None
    total_key = None
    
    for key in sample_row.keys():
        key_lower = key.lower()
        if 'verkäufer' in key_lower or 'verkaufer' in key_lower or 'verk' in key_lower:
            seller_id_key = key
        elif 'auftragsdatum' in key_lower:
            order_date_key = key
        elif 'gesamtpreis' in key_lower or 'summe' == key_lower:
            if total_key is None:  # Bevorzuge Gesamtpreis
                total_key = key
    
    # Fallback auf Spalten mit ähnlichen Namen
    if not seller_id_key:
        for key in sample_row.keys():
            if 'id' in key.lower() and 'ver' in key.lower():
                seller_id_key = key
                break
    
    print(f"\n  Verwendete Spalten:")
    print(f"    VerkäuferID: {seller_id_key}")
    print(f"    Auftragsdatum: {order_date_key}")
    print(f"    Gesamtpreis: {total_key}")
    
    if not all([seller_id_key, order_date_key, total_key]):
        print("\n  [ERROR] Konnte nicht alle benötigten Spalten finden!")
        print(f"  Verfügbare Spalten: {list(sample_row.keys())}")
        return stats
    
    print("\n  Verarbeite Aufträge...")
    
    for row in orders_data:
        stats['processed'] += 1
        
        # Parse Verkäufer-ID
        try:
            seller_id = int(row.get(seller_id_key, '0'))
        except (ValueError, TypeError):
            seller_id = 0
        
        if seller_id == 0:
            stats['no_seller'] += 1
            continue
        
        # Finde Mitarbeiter
        employee = seller_to_employee.get(seller_id)
        if not employee:
            stats['no_employee'] += 1
            continue
        
        # Parse Datum und Summe
        order_date = parse_german_date(row.get(order_date_key, ''))
        total = parse_german_decimal(row.get(total_key, '0'))
        
        if not order_date:
            stats['no_match'] += 1
            continue
        
        # Suche passenden Auftrag
        rounded_total = round(float(total), 2)
        key = (order_date, rounded_total)
        
        matching_orders = order_lookup.get(key, [])
        
        if not matching_orders:
            stats['no_match'] += 1
            continue
        
        if len(matching_orders) > 1:
            stats['multiple_matches'] += 1
            # Bei mehreren Matches: Nimm alle (selten)
        
        stats['matched'] += 1
        
        for order in matching_orders:
            # Prüfe ob schon Provisionsempfänger existiert
            if order.commission_recipients.exists():
                stats['already_has_recipient'] += 1
                continue
            
            if dry_run:
                print(f"    [DRY-RUN] {order.order_number}: {employee.last_name} (100%)")
                stats['created'] += 1
            else:
                try:
                    CustomerOrderCommissionRecipient.objects.create(
                        customer_order=order,
                        employee=employee,
                        commission_percentage=Decimal('100.00')
                    )
                    stats['created'] += 1
                except Exception as e:
                    print(f"    [ERROR] {order.order_number}: {e}")
                    stats['errors'] += 1
    
    return stats


def main():
    """Hauptfunktion"""
    print("\n" + "="*60)
    print("LEGACY COMMISSION IMPORT")
    print("="*60)
    
    # Prüfe auf --live Flag
    dry_run = '--live' not in sys.argv
    
    if dry_run:
        print("\n*** DRY-RUN MODE ***")
        print("Keine Änderungen werden durchgeführt.")
        print("Verwende --live für echten Import.\n")
    else:
        print("\n*** LIVE MODE ***")
        print("Änderungen werden in die Datenbank geschrieben!\n")
    
    try:
        # Phase 1: Lade Verkäufer-Mapping
        seller_mapping = load_seller_mapping()
        print(f"\n  Geladene Verkäufer: {len(seller_mapping)}")
        
        # Phase 2: Erstelle/finde Mitarbeiter (außerhalb atomic block)
        seller_to_employee = get_or_create_employees(seller_mapping, dry_run=dry_run)
        
        print(f"\n  Verkäufer -> Mitarbeiter Mapping: {len(seller_to_employee)}")
        
        # Phase 3: Importiere Provisionsempfänger
        if dry_run:
            stats = import_commissions(seller_to_employee, dry_run=True)
        else:
            with transaction.atomic():
                stats = import_commissions(seller_to_employee, dry_run=False)
        
        # Statistik ausgeben
        print("\n" + "="*60)
        print("STATISTIK")
        print("="*60)
        print(f"  Verarbeitete Zeilen:         {stats['processed']:6d}")
        print(f"  Aufträge gematcht:           {stats['matched']:6d}")
        print(f"  Bereits mit Empfänger:       {stats['already_has_recipient']:6d}")
        print(f"  Provisionsempfänger erstellt:{stats['created']:6d}")
        print(f"  Kein Verkäufer (ID=0):       {stats['no_seller']:6d}")
        print(f"  Kein Mitarbeiter gefunden:   {stats['no_employee']:6d}")
        print(f"  Kein Auftrag gematcht:       {stats['no_match']:6d}")
        print(f"  Mehrfach-Matches:            {stats['multiple_matches']:6d}")
        print(f"  Fehler:                      {stats['errors']:6d}")
        
        if dry_run:
            print("\n*** DRY-RUN ABGESCHLOSSEN ***")
            print("Führe mit --live aus für echten Import.")
        else:
            print("\n*** IMPORT ABGESCHLOSSEN ***")
        
    except Exception as e:
        print(f"\n[ERROR] Import fehlgeschlagen: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
