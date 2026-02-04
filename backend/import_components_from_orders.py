#!/usr/bin/env python
"""
Script zum Importieren von Komponenten aus Aufträgen zu Systemen.

Durchsucht System-Notizen nach Auftragsnummern (Format: "O-xxx-xx/xx" oder "O-xxx-xx-xx")
und fügt die Positionen aus den entsprechenden Aufträgen als Komponenten zum System hinzu.

Beispiele für erkannte Muster:
- "Auftragsnummer: O-101-10/25"
- "O-234-05-24"
- "Auftrag O-100-12/23"

Usage:
    python import_components_from_orders.py                    # Dry-run
    python import_components_from_orders.py --execute          # Ausführen
    python import_components_from_orders.py --system S-00042   # Nur ein System
"""

import os
import sys
import re
import argparse
import django

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db import models
from systems.models import System, SystemComponent
from customer_orders.models import CustomerOrder, CustomerOrderItem


def extract_order_numbers(text):
    """
    Extrahiert Auftragsnummern aus Text.
    Sucht nach Pattern wie:
    - O-101-10/25
    - O-101-10-25
    - O-234-05/24
    """
    if not text:
        return []
    
    # Pattern für Auftragsnummern: O-XXX-MM/YY oder O-XXX-MM-YY
    pattern = r'O-(\d{3})-(\d{2})[/-](\d{2})'
    
    matches = re.findall(pattern, text, re.IGNORECASE)
    
    order_numbers = []
    for match in matches:
        num, month, year = match
        # Format mit Schrägstrich (wie in der Datenbank): O-XXX-MM/YY
        order_number = f"O-{num}-{month}/{year}"
        if order_number not in order_numbers:
            order_numbers.append(order_number)
    
    return order_numbers


def get_existing_order_components(system):
    """
    Gibt eine Menge von (order_number, position_name) zurück,
    die bereits als Komponenten importiert wurden.
    """
    existing = set()
    for component in system.components.all():
        if component.notes and 'Importiert aus Auftrag' in component.notes:
            # Parse notes: "Importiert aus Auftrag O-xxx-xx/xx, Pos. X"
            match = re.search(r'Importiert aus Auftrag (O-\d{3}-\d{2}[/-]\d{2})', component.notes)
            if match:
                existing.add((match.group(1), component.name))
    return existing


def import_components_for_system(system, dry_run=True, verbose=True):
    """
    Importiert Komponenten aus Aufträgen für ein einzelnes System.
    """
    order_numbers = extract_order_numbers(system.notes)
    
    if not order_numbers:
        return {'system': system.system_number, 'found_orders': [], 'imported': 0, 'skipped': 0}
    
    result = {
        'system': system.system_number,
        'found_orders': order_numbers,
        'imported': 0,
        'skipped': 0,
        'details': []
    }
    
    existing_components = get_existing_order_components(system)
    
    for order_number in order_numbers:
        try:
            order = CustomerOrder.objects.get(order_number=order_number)
        except CustomerOrder.DoesNotExist:
            if verbose:
                print(f"    [!] Auftrag {order_number} nicht gefunden")
            result['details'].append({
                'order': order_number,
                'status': 'not_found'
            })
            continue
        
        positions = order.items.exclude(is_group_header=True)
        
        if verbose:
            print(f"    [OK] Auftrag {order_number} gefunden: {positions.count()} Positionen")
        
        for pos in positions:
            # Prüfen ob bereits importiert
            if (order_number, pos.name) in existing_components:
                if verbose:
                    print(f"      - {pos.name}: bereits vorhanden (uebersprungen)")
                result['skipped'] += 1
                continue
            
            if dry_run:
                if verbose:
                    print(f"      + {pos.name}: wuerde importiert werden")
                result['imported'] += 1
            else:
                # Ermittle hoechste Position im System
                max_pos = system.components.aggregate(
                    max_pos=models.Max('position')
                )['max_pos'] or 0
                max_pos += 1
                
                component = SystemComponent.objects.create(
                    system=system,
                    position=max_pos,
                    component_type='custom',
                    name=pos.name,
                    description=pos.description or '',
                    serial_number=pos.serial_number or '',
                    category='other',
                    notes=f'Importiert aus Auftrag {order_number}, Pos. {pos.position}'
                )
                
                if verbose:
                    print(f"      + {pos.name}: importiert als Komponente #{component.id}")
                result['imported'] += 1
        
        result['details'].append({
            'order': order_number,
            'status': 'processed',
            'positions': positions.count()
        })
    
    return result


def main():
    parser = argparse.ArgumentParser(
        description='Importiert Komponenten aus Aufträgen zu Systemen basierend auf Notizen'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Tatsächlich importieren (ohne diesen Flag: nur Dry-Run)'
    )
    parser.add_argument(
        '--system',
        type=str,
        help='Nur ein bestimmtes System verarbeiten (z.B. S-00042)'
    )
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Weniger Ausgabe'
    )
    
    args = parser.parse_args()
    dry_run = not args.execute
    verbose = not args.quiet
    
    print("=" * 70)
    print("Komponenten aus Aufträgen importieren")
    print("=" * 70)
    
    if dry_run:
        print("\n[DRY-RUN] Modus - es werden keine Aenderungen vorgenommen\n")
    else:
        print("\n[EXECUTE] Modus - Aenderungen werden durchgefuehrt!\n")
    
    # Systeme laden
    if args.system:
        try:
            systems = [System.objects.get(system_number=args.system)]
            print(f"Verarbeite nur System: {args.system}")
        except System.DoesNotExist:
            print(f"[FEHLER] System {args.system} nicht gefunden!")
            sys.exit(1)
    else:
        # Alle Systeme mit Notizen, die Auftragsnummern enthalten koennten
        systems = System.objects.exclude(notes='').exclude(notes__isnull=True)
        print(f"Durchsuche {systems.count()} Systeme mit Notizen...")
    
    print()
    
    total_found = 0
    total_imported = 0
    total_skipped = 0
    systems_with_orders = []
    
    for system in systems:
        # Prüfen ob Notizen Auftragsnummern enthalten
        order_numbers = extract_order_numbers(system.notes)
        if not order_numbers:
            continue
        
        total_found += 1
        
        if verbose:
            print(f"\n[SYSTEM] {system.system_number} - {system.system_name}")
            print(f"   Notizen: {system.notes[:100]}..." if len(system.notes) > 100 else f"   Notizen: {system.notes}")
            print(f"   Gefundene Auftragsnummern: {', '.join(order_numbers)}")
        
        result = import_components_for_system(system, dry_run=dry_run, verbose=verbose)
        
        total_imported += result['imported']
        total_skipped += result['skipped']
        
        if result['imported'] > 0 or result['skipped'] > 0:
            systems_with_orders.append(result)
    
    # Zusammenfassung
    print("\n" + "=" * 70)
    print("ZUSAMMENFASSUNG")
    print("=" * 70)
    print(f"Systeme mit Auftragsnummern in Notizen: {total_found}")
    print(f"Komponenten {'zum Importieren' if dry_run else 'importiert'}: {total_imported}")
    print(f"Komponenten übersprungen (bereits vorhanden): {total_skipped}")
    
    if dry_run and total_imported > 0:
        print(f"\n[HINWEIS] Um die Aenderungen durchzufuehren, fuehren Sie aus:")
        print(f"  python import_components_from_orders.py --execute")
        if args.system:
            print(f"  python import_components_from_orders.py --execute --system {args.system}")


if __name__ == '__main__':
    main()
