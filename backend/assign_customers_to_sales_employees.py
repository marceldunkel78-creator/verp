#!/usr/bin/env python
"""
Script zur automatischen Zuordnung von Kunden zu Vertriebs-/Geschaeftsfuehrungs-
mitarbeitern basierend auf dem Vertriebsgebiet (Land und PLZ).

Logik:
1. Fuer jeden Kunden mit Adresse:
   - Pruefe Land (CustomerAddress.country) und PLZ (CustomerAddress.postal_code)
   - Finde Mitarbeiter, dessen Vertriebsgebiet passt:
     a) Land muss in sales_territory_countries sein
     b) Wenn DE: PLZ muss in einem der sales_territory_postal_codes Bereiche liegen
   - Falls kein passender Mitarbeiter gefunden: Fallback (Helmut Wurm)
2. Setzt customer.responsible_user auf den User des Mitarbeiters

Usage:
    python assign_customers_to_sales_employees.py           # Dry-run
    python assign_customers_to_sales_employees.py --execute # Fuehrt Aenderungen durch
    python assign_customers_to_sales_employees.py --only-unassigned
"""

import os
import sys
import re
import django

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from customers.models import Customer, CustomerAddress
from users.models import Employee


def get_sales_employees():
    """Hole alle Vertriebs-/Geschaeftsfuehrungsmitarbeiter mit Vertriebsgebieten."""
    employees = Employee.objects.filter(
        department__in=['vertrieb', 'geschaeftsfuehrung'],
        employment_status='aktiv'
    ).exclude(
        sales_territory_countries=[]
    )

    print("\n=== Mitarbeiter mit Vertriebsgebieten ===")
    for emp in employees:
        print(f"  {emp.first_name} {emp.last_name}:")
        print(f"    Laender: {emp.sales_territory_countries}")
        if emp.sales_territory_postal_codes:
            print(f"    PLZ-Bereiche (DE): {emp.sales_territory_postal_codes}")

    return list(employees)


def get_fallback_employee():
    """Hole Helmut Wurm als Fallback-Mitarbeiter."""
    try:
        helmut = Employee.objects.get(
            first_name__iexact='Helmut',
            last_name__iexact='Wurm'
        )
        print("\n=== Fallback-Mitarbeiter ===")
        print(f"  {helmut.first_name} {helmut.last_name} (ID: {helmut.id})")
        return helmut
    except Employee.DoesNotExist:
        print("\nWARNUNG: Helmut Wurm nicht gefunden!")
        return None
    except Employee.MultipleObjectsReturned:
        helmut = Employee.objects.filter(
            first_name__iexact='Helmut',
            last_name__iexact='Wurm'
        ).first()
        print("\n=== Fallback-Mitarbeiter (erster Match) ===")
        print(f"  {helmut.first_name} {helmut.last_name} (ID: {helmut.id})")
        return helmut


def parse_postal_code_range(range_str):
    """
    Parse einen PLZ-Bereich String wie '66000-79999' in (start, end) Tuple.
    Gibt None zurueck wenn Parsing fehlschlaegt.
    """
    try:
        if '-' in str(range_str):
            parts = str(range_str).split('-')
            if len(parts) == 2:
                start = int(parts[0].strip())
                end = int(parts[1].strip())
                return (start, end)
        # Einzelner Wert (Praefix oder Nummer)
        return (int(range_str), int(range_str))
    except (ValueError, TypeError):
        return None


def extract_numeric_plz(postal_code):
    """
    Extrahiere numerische PLZ aus verschiedenen Formaten.
    z.B. '80336 Muenchen' -> 80336
         'D-80336' -> 80336
         '80336' -> 80336
    """
    if not postal_code:
        return None
    cleaned = re.sub(r'^[A-Z]{1,2}[-\s]?', '', str(postal_code).strip())
    match = re.search(r'\b(\d{5})\b', cleaned)
    if match:
        return int(match.group(1))
    match = re.search(r'^(\d+)', cleaned)
    if match:
        return int(match.group(1))
    return None


def plz_in_range(plz_numeric, postal_ranges):
    """
    Prueft ob eine PLZ in einem der angegebenen Bereiche liegt.
    postal_ranges: Liste von Strings wie ['66000-79999', '82000-89999']
    """
    if plz_numeric is None:
        return False

    for range_str in postal_ranges:
        parsed = parse_postal_code_range(range_str)
        if parsed:
            start, end = parsed
            if start <= plz_numeric <= end:
                return True
    return False


def get_customer_address(customer):
    """Hole bevorzugte Adresse fuer den Kunden."""
    addr = customer.addresses.filter(address_type='Office', is_active=True).first()
    if addr:
        return addr
    addr = customer.addresses.filter(is_active=True).first()
    if addr:
        return addr
    return customer.addresses.first()


def find_matching_employee(address, sales_employees):
    """
    Finde den passenden Vertriebsmitarbeiter fuer eine Adresse.
    
    Matching-Logik:
    1. Land muss in sales_territory_countries sein
    2. Wenn Land = DE: PLZ muss in einem der sales_territory_postal_codes Bereiche liegen

    Returns: (Employee, reason_string) oder (None, reason_string)
    """
    if not address:
        return None, "Keine Adresse"

    country = (address.country or '').strip().upper()
    postal_code = (address.postal_code or '').strip()

    if not country:
        return None, "Kein Land angegeben"

    plz_numeric = None
    if country == 'DE' and postal_code:
        plz_numeric = extract_numeric_plz(postal_code)

    for employee in sales_employees:
        territories = employee.sales_territory_countries or []
        postal_ranges = employee.sales_territory_postal_codes or []

        if country not in territories:
            continue

        if country == 'DE':
            if not postal_code:
                continue
            if plz_numeric is None:
                continue
            if plz_in_range(plz_numeric, postal_ranges):
                return employee, f"Match: {country}, PLZ {postal_code} ({plz_numeric})"
        else:
            return employee, f"Match: {country}"

    if country == 'DE':
        if postal_code:
            if plz_numeric:
                return None, f"Kein Mitarbeiter fuer PLZ {postal_code} ({plz_numeric}) in DE"
            return None, f"PLZ '{postal_code}' nicht als deutsche PLZ erkannt"
        return None, "DE ohne PLZ"

    return None, f"Kein Mitarbeiter fuer Land {country}"


def get_user_for_employee(employee):
    """Hole einen aktiven User fuer den Mitarbeiter."""
    if not employee:
        return None
    users = employee.users.filter(is_active=True)
    return users.first() if users.exists() else None


def assign_customers(execute=False, only_unassigned=False):
    """Hauptfunktion: Ordne Kunden Vertriebsmitarbeitern zu."""
    print("=" * 70)
    print("AUTOMATISCHE ZUORDNUNG VON KUNDEN ZU VERTRIEBSMITARBEITERN")
    print("=" * 70)

    sales_employees = get_sales_employees()
    if not sales_employees:
        print("\nKeine Mitarbeiter mit Vertriebsgebieten gefunden!")
        return

    fallback_employee = get_fallback_employee()
    if not fallback_employee and execute:
        print("\nOhne Fallback-Mitarbeiter kann das Script nicht ausgefuehrt werden!")
        return

    customers = Customer.objects.all()
    if only_unassigned:
        customers = customers.filter(responsible_user__isnull=True)
        print("\nModus: Nur Kunden ohne zustaendigen Mitarbeiter")

    total_customers = customers.count()
    print(f"\nGefundene Kunden: {total_customers}")

    stats = {
        'matched': 0,
        'fallback': 0,
        'skipped_no_change': 0,
        'skipped_no_address': 0,
        'skipped_no_user': 0,
        'errors': []
    }

    assignments = {
        'matched': [],
        'fallback': [],
        'no_change': []
    }

    print("\n" + "=" * 70)
    print("ANALYSE DER ZUORDNUNGEN")
    print("=" * 70)

    for customer in customers:
        address = get_customer_address(customer)
        if not address:
            stats['skipped_no_address'] += 1
            continue

        matched_employee, match_reason = find_matching_employee(address, sales_employees)

        if matched_employee:
            new_employee = matched_employee
            assignment_type = 'matched'
            stats['matched'] += 1
        else:
            new_employee = fallback_employee
            assignment_type = 'fallback'
            stats['fallback'] += 1
            match_reason = f"Fallback (Helmut Wurm) - {match_reason}"

        new_user = get_user_for_employee(new_employee)
        if not new_user:
            stats['skipped_no_user'] += 1
            continue

        current_user = customer.responsible_user
        if current_user == new_user:
            stats['skipped_no_change'] += 1
            assignments['no_change'].append({
                'customer': customer,
                'user': new_user,
                'reason': match_reason
            })
            continue

        assignments[assignment_type].append({
            'customer': customer,
            'old_user': current_user,
            'new_user': new_user,
            'reason': match_reason,
            'location': f"{address.country}, {address.postal_code} {address.city}".strip(', ')
        })

        if execute:
            try:
                customer.responsible_user = new_user
                customer.save(update_fields=['responsible_user'])
            except Exception as e:
                stats['errors'].append(f"Kunde {customer.id}: {str(e)}")

    print("\n" + "=" * 70)
    print("ERGEBNISSE")
    print("=" * 70)

    print("\nSTATISTIK:")
    print(f"  Direkt zugeordnet (Vertriebsgebiet): {stats['matched']}")
    print(f"  Fallback (Helmut Wurm): {stats['fallback']}")
    print(f"  Keine Aenderung noetig: {stats['skipped_no_change']}")
    print(f"  Ohne Adresse: {stats['skipped_no_address']}")
    print(f"  Ohne User zum Mitarbeiter: {stats['skipped_no_user']}")
    print(f"  Gesamt verarbeitet: {total_customers}")

    if stats['errors']:
        print(f"\nFEHLER ({len(stats['errors'])}):")
        for error in stats['errors']:
            print(f"  - {error}")

    if not execute:
        print("\n" + "=" * 70)
        print("DRY-RUN MODUS - Keine Aenderungen durchgefuehrt!")
        print("   Verwende --execute um die Zuordnungen durchzufuehren.")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        total_changed = stats['matched'] + stats['fallback']
        print(f"{total_changed} Kunden wurden aktualisiert!")
        print("=" * 70)


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='Ordne Kunden automatisch den Vertriebsmitarbeitern zu'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Fuehre die Aenderungen tatsaechlich durch (Standard: Dry-Run)'
    )
    parser.add_argument(
        '--only-unassigned',
        action='store_true',
        help='Bearbeite nur Kunden ohne zustaendigen Mitarbeiter'
    )

    args = parser.parse_args()
    assign_customers(execute=args.execute, only_unassigned=args.only_unassigned)


if __name__ == '__main__':
    main()
