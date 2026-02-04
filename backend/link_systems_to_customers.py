#!/usr/bin/env python
"""
Script zum Verknuepfen von Systemen mit Kunden basierend auf Notizen.

Durchsucht System-Notizen nach dem Kundennamen (Format: "Kunde: [Name]")
und verknuepft das System mit dem entsprechenden Kunden in der Datenbank.

Usage:
    python link_systems_to_customers.py                    # Dry-run
    python link_systems_to_customers.py --execute          # Ausfuehren
    python link_systems_to_customers.py --system S-00042   # Nur ein System
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

from django.db.models import Q
from systems.models import System
from customers.models import Customer


def extract_customer_name(text):
    """
    Extrahiert den Kundennamen aus den Notizen.
    Sucht nach Pattern wie: "Kunde: Dr. Max Mustermann"
    """
    if not text:
        return None
    
    # Pattern: "Kunde: " gefolgt vom Namen bis zum Zeilenende oder "Adresse:"
    match = re.search(r'Kunde:\s*([^\n]+?)(?:\s*\n|\s*Adresse:|$)', text, re.IGNORECASE)
    if match:
        name = match.group(1).strip()
        # Entferne eventuelle Klammern am Ende (z.B. "(Kate Poole)")
        name = re.sub(r'\s*\([^)]*\)\s*$', '', name).strip()
        return name if name else None
    return None


def normalize_name(name):
    """Normalisiert einen Namen fuer den Vergleich"""
    if not name:
        return ''
    # Entferne Titel und Anreden
    name = re.sub(r'\b(Prof\.|Professor|Dr\.|Herr|Frau|Mr\.|Mrs\.|Ms\.)\s*', '', name, flags=re.IGNORECASE)
    # Entferne mehrfache Leerzeichen
    name = ' '.join(name.split())
    return name.strip().lower()


def find_customer_by_name(customer_name):
    """
    Sucht einen Kunden basierend auf dem Namen.
    Versucht verschiedene Matching-Strategien.
    """
    if not customer_name:
        return None, "Kein Kundenname"
    
    normalized = normalize_name(customer_name)
    
    # Strategie 1: Exakter Match auf Vor- und Nachname
    parts = customer_name.split()
    if len(parts) >= 2:
        # Versuche verschiedene Kombinationen
        for i in range(len(parts) - 1):
            first_name_parts = parts[:i+1]
            last_name_parts = parts[i+1:]
            
            first_name = ' '.join(first_name_parts)
            last_name = ' '.join(last_name_parts)
            
            # Entferne Titel aus Vornamen
            first_name = re.sub(r'\b(Prof\.|Professor|Dr\.|Herr|Frau|Mr\.|Mrs\.|Ms\.)\s*', '', first_name, flags=re.IGNORECASE).strip()
            
            if first_name and last_name:
                customers = Customer.objects.filter(
                    Q(first_name__iexact=first_name, last_name__iexact=last_name) |
                    Q(first_name__icontains=first_name, last_name__iexact=last_name)
                )
                if customers.count() == 1:
                    return customers.first(), f"Match: {first_name} {last_name}"
    
    # Strategie 2: Nur Nachname (letztes Wort)
    last_word = parts[-1] if parts else ''
    if last_word and len(last_word) > 2:
        customers = Customer.objects.filter(last_name__iexact=last_word)
        if customers.count() == 1:
            return customers.first(), f"Match Nachname: {last_word}"
        elif customers.count() > 1 and customers.count() <= 5:
            # Versuche mit Vorname einzugrenzen
            if len(parts) >= 2:
                first_parts = ' '.join(parts[:-1])
                first_parts = re.sub(r'\b(Prof\.|Professor|Dr\.|Herr|Frau|Mr\.|Mrs\.|Ms\.)\s*', '', first_parts, flags=re.IGNORECASE).strip()
                if first_parts:
                    refined = customers.filter(first_name__icontains=first_parts.split()[-1])
                    if refined.count() == 1:
                        return refined.first(), f"Match verfeinert: {first_parts} {last_word}"
    
    # Strategie 3: Suche mit contains auf beiden Feldern
    search_terms = [t for t in normalized.split() if len(t) > 2 and t not in ['und', 'von', 'der', 'die', 'das']]
    if search_terms:
        q = Q()
        for term in search_terms[-2:]:  # Nur die letzten 2 Begriffe (wahrscheinlich Name)
            q &= (Q(first_name__icontains=term) | Q(last_name__icontains=term))
        
        customers = Customer.objects.filter(q)
        if customers.count() == 1:
            return customers.first(), f"Match contains: {' '.join(search_terms[-2:])}"
    
    # Kein eindeutiger Match gefunden
    return None, f"Kein eindeutiger Match ({customers.count() if 'customers' in dir() else 0} Kandidaten)"


def link_system_to_customer(system, dry_run=True, verbose=True):
    """
    Verknuepft ein System mit einem Kunden basierend auf den Notizen.
    """
    result = {
        'system': system.system_number,
        'customer_name': None,
        'linked': False,
        'already_linked': False,
        'message': ''
    }
    
    # Pruefen ob bereits verknuepft
    if system.customer:
        result['already_linked'] = True
        result['message'] = f"Bereits verknuepft mit {system.customer.customer_number}"
        return result
    
    # Kundenname aus Notizen extrahieren
    customer_name = extract_customer_name(system.notes)
    result['customer_name'] = customer_name
    
    if not customer_name:
        result['message'] = "Kein Kundenname in Notizen gefunden"
        return result
    
    # Kunden suchen
    customer, match_info = find_customer_by_name(customer_name)
    
    if not customer:
        result['message'] = f"'{customer_name}' -> {match_info}"
        return result
    
    # Verknuepfung herstellen
    if dry_run:
        result['linked'] = True
        result['message'] = f"'{customer_name}' -> {customer.customer_number} ({customer.first_name} {customer.last_name})"
    else:
        system.customer = customer
        system.save(update_fields=['customer'])
        result['linked'] = True
        result['message'] = f"Verknuepft: '{customer_name}' -> {customer.customer_number}"
    
    return result


def main():
    parser = argparse.ArgumentParser(
        description='Verknuepft Systeme mit Kunden basierend auf Notizen'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Tatsaechlich verknuepfen (ohne diesen Flag: nur Dry-Run)'
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
    parser.add_argument(
        '--only-unlinked',
        action='store_true',
        default=True,
        help='Nur Systeme ohne Kundenverknuepfung (Standard: True)'
    )
    
    args = parser.parse_args()
    dry_run = not args.execute
    verbose = not args.quiet
    
    print("=" * 70)
    print("Systeme mit Kunden verknuepfen")
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
        # Alle Systeme ohne Kunde mit Notizen
        systems = System.objects.exclude(notes='').exclude(notes__isnull=True)
        if args.only_unlinked:
            systems = systems.filter(customer__isnull=True)
        print(f"Durchsuche {systems.count()} Systeme ohne Kundenverknuepfung...")
    
    print()
    
    total_processed = 0
    total_linked = 0
    total_already = 0
    total_not_found = 0
    not_found_names = []
    
    for system in systems:
        total_processed += 1
        
        result = link_system_to_customer(system, dry_run=dry_run, verbose=verbose)
        
        if result['already_linked']:
            total_already += 1
            if verbose:
                print(f"[SKIP] {system.system_number}: {result['message']}")
        elif result['linked']:
            total_linked += 1
            if verbose:
                print(f"[OK] {system.system_number}: {result['message']}")
        else:
            total_not_found += 1
            if verbose:
                print(f"[--] {system.system_number}: {result['message']}")
            if result['customer_name']:
                not_found_names.append((system.system_number, result['customer_name']))
    
    # Zusammenfassung
    print("\n" + "=" * 70)
    print("ZUSAMMENFASSUNG")
    print("=" * 70)
    print(f"Systeme verarbeitet: {total_processed}")
    print(f"Bereits verknuepft: {total_already}")
    print(f"{'Wuerden verknuepft' if dry_run else 'Verknuepft'}: {total_linked}")
    print(f"Kein Match gefunden: {total_not_found}")
    
    if not_found_names and verbose:
        print(f"\nKundennamen ohne Match (erste 20):")
        for sys_num, name in not_found_names[:20]:
            print(f"  {sys_num}: {name}")
    
    if dry_run and total_linked > 0:
        print(f"\n[HINWEIS] Um die Aenderungen durchzufuehren:")
        print(f"  python link_systems_to_customers.py --execute")
        if args.system:
            print(f"  python link_systems_to_customers.py --execute --system {args.system}")


if __name__ == '__main__':
    main()
