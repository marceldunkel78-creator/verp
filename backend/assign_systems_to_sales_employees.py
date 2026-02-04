#!/usr/bin/env python
"""
Script zur automatischen Zuordnung von Systemen zu Vertriebsmitarbeitern
basierend auf den Vertriebsgebieten (Land und PLZ).

Logik:
1. Für jedes System mit Standortadresse:
   - Prüfe das Land (location_country) und PLZ (location_postal_code)
   - Finde den Vertriebsmitarbeiter, dessen Vertriebsgebiet passt:
     a) Land muss in sales_territory_countries sein
     b) Wenn DE: PLZ-Präfix muss in sales_territory_postal_codes sein
   - Falls kein passender Mitarbeiter gefunden: Helmut Wurm zuweisen

Usage:
    python assign_systems_to_sales_employees.py           # Dry-run (zeigt nur Änderungen)
    python assign_systems_to_sales_employees.py --execute # Führt Änderungen durch
    python assign_systems_to_sales_employees.py --only-unassigned  # Nur Systeme ohne Mitarbeiter
"""

import os
import sys
import django

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from systems.models import System
from users.models import Employee


def get_sales_employees():
    """Hole alle Vertriebsmitarbeiter mit definierten Vertriebsgebieten"""
    employees = Employee.objects.filter(
        department='vertrieb',
        employment_status='aktiv'
    ).exclude(
        sales_territory_countries=[]
    )
    
    print(f"\n=== Vertriebsmitarbeiter mit Vertriebsgebieten ===")
    for emp in employees:
        print(f"  {emp.first_name} {emp.last_name}:")
        print(f"    Länder: {emp.sales_territory_countries}")
        if emp.sales_territory_postal_codes:
            print(f"    PLZ-Bereiche (DE): {emp.sales_territory_postal_codes}")
    
    return list(employees)


def get_fallback_employee():
    """Hole Helmut Wurm als Fallback-Mitarbeiter"""
    try:
        helmut = Employee.objects.get(
            first_name__iexact='Helmut',
            last_name__iexact='Wurm'
        )
        print(f"\n=== Fallback-Mitarbeiter ===")
        print(f"  {helmut.first_name} {helmut.last_name} (ID: {helmut.id})")
        return helmut
    except Employee.DoesNotExist:
        print("\n⚠️  WARNUNG: Helmut Wurm nicht gefunden!")
        # Versuche alternative Schreibweisen
        helmuts = Employee.objects.filter(last_name__icontains='Wurm')
        if helmuts.exists():
            print("  Gefundene Mitarbeiter mit 'Wurm' im Namen:")
            for h in helmuts:
                print(f"    - {h.first_name} {h.last_name}")
        return None
    except Employee.MultipleObjectsReturned:
        helmut = Employee.objects.filter(
            first_name__iexact='Helmut',
            last_name__iexact='Wurm'
        ).first()
        print(f"\n=== Fallback-Mitarbeiter (erster Match) ===")
        print(f"  {helmut.first_name} {helmut.last_name} (ID: {helmut.id})")
        return helmut


def parse_postal_code_range(range_str):
    """
    Parse einen PLZ-Bereich String wie '66000-79999' in (start, end) Tuple.
    Gibt None zurück wenn Parsing fehlschlägt.
    """
    try:
        if '-' in str(range_str):
            parts = str(range_str).split('-')
            if len(parts) == 2:
                start = int(parts[0].strip())
                end = int(parts[1].strip())
                return (start, end)
        # Einzelner Wert (Präfix oder Nummer)
        return (int(range_str), int(range_str))
    except (ValueError, TypeError):
        return None


def extract_numeric_plz(postal_code):
    """
    Extrahiere numerische PLZ aus verschiedenen Formaten.
    z.B. '80336 München' -> 80336
         'D-80336' -> 80336
         '80336' -> 80336
    """
    import re
    # Entferne führende Ländercodes wie 'D-', 'DE-', 'A-', etc.
    cleaned = re.sub(r'^[A-Z]{1,2}[-\s]?', '', postal_code.strip())
    # Extrahiere erste 5-stellige Zahl
    match = re.search(r'\b(\d{5})\b', cleaned)
    if match:
        return int(match.group(1))
    # Versuche erste Ziffernfolge
    match = re.search(r'^(\d+)', cleaned)
    if match:
        return int(match.group(1))
    return None


def plz_in_range(plz_numeric, postal_ranges):
    """
    Prüft ob eine PLZ in einem der angegebenen Bereiche liegt.
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


def find_matching_employee(system, sales_employees):
    """
    Finde den passenden Vertriebsmitarbeiter für ein System.
    
    Matching-Logik:
    1. Land muss in sales_territory_countries des Mitarbeiters sein
    2. Wenn Land = DE: PLZ muss in einem der sales_territory_postal_codes Bereiche liegen
    
    Returns: (Employee, reason_string) oder (None, reason_string)
    """
    country = (system.location_country or '').strip().upper()
    postal_code = (system.location_postal_code or '').strip()
    
    if not country:
        return None, "Kein Land angegeben"
    
    # Extrahiere numerische PLZ für Deutschland
    plz_numeric = None
    if country == 'DE' and postal_code:
        plz_numeric = extract_numeric_plz(postal_code)
    
    for employee in sales_employees:
        territories = employee.sales_territory_countries or []
        postal_ranges = employee.sales_territory_postal_codes or []
        
        # Prüfe ob Land im Vertriebsgebiet
        if country not in territories:
            continue
        
        # Wenn Deutschland: PLZ-Bereich prüfen
        if country == 'DE':
            if not postal_code:
                # Keine PLZ, aber Land passt - überspringen für präziseren Match
                continue
            
            if plz_numeric is None:
                # PLZ konnte nicht als Zahl geparst werden
                continue
            
            # Prüfe ob PLZ in einem der Bereiche liegt
            if plz_in_range(plz_numeric, postal_ranges):
                return employee, f"Match: {country}, PLZ {postal_code} ({plz_numeric}) in Bereich"
        else:
            # Nicht-DE Land - nur Land-Match erforderlich
            return employee, f"Match: {country}"
    
    # Kein exakter Match gefunden
    if country == 'DE':
        if postal_code:
            if plz_numeric:
                return None, f"Kein Mitarbeiter für PLZ {postal_code} ({plz_numeric}) in DE"
            else:
                return None, f"PLZ '{postal_code}' nicht als deutsche PLZ erkannt"
        else:
            return None, "DE ohne PLZ"
    
    return None, f"Kein Mitarbeiter für Land {country}"


def assign_systems(execute=False, only_unassigned=False):
    """
    Hauptfunktion: Ordne Systeme den Vertriebsmitarbeitern zu.
    """
    print("=" * 70)
    print("AUTOMATISCHE ZUORDNUNG VON SYSTEMEN ZU VERTRIEBSMITARBEITERN")
    print("=" * 70)
    
    # Hole Vertriebsmitarbeiter
    sales_employees = get_sales_employees()
    if not sales_employees:
        print("\n❌ Keine Vertriebsmitarbeiter mit Vertriebsgebieten gefunden!")
        return
    
    # Hole Fallback-Mitarbeiter
    fallback_employee = get_fallback_employee()
    if not fallback_employee and execute:
        print("\n❌ Ohne Fallback-Mitarbeiter kann das Script nicht ausgeführt werden!")
        return
    
    # Hole Systeme mit Adresse
    systems = System.objects.exclude(
        location_country__isnull=True
    ).exclude(
        location_country=''
    )
    
    if only_unassigned:
        systems = systems.filter(responsible_employee__isnull=True)
        print(f"\n📋 Modus: Nur Systeme ohne zuständigen Mitarbeiter")
    
    total_systems = systems.count()
    print(f"\n📊 Gefundene Systeme mit Standortland: {total_systems}")
    
    # Statistiken
    stats = {
        'matched': 0,
        'fallback': 0,
        'skipped_no_change': 0,
        'skipped_no_address': 0,
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
    
    for system in systems:
        country = (system.location_country or '').strip().upper()
        postal_code = (system.location_postal_code or '').strip()
        city = system.location_city or ''
        
        # Finde passenden Mitarbeiter
        matched_employee, match_reason = find_matching_employee(system, sales_employees)
        
        current_employee = system.responsible_employee
        current_name = f"{current_employee.first_name} {current_employee.last_name}" if current_employee else "Keiner"
        
        if matched_employee:
            new_employee = matched_employee
            assignment_type = 'matched'
            stats['matched'] += 1
        else:
            new_employee = fallback_employee
            assignment_type = 'fallback'
            stats['fallback'] += 1
            match_reason = f"Fallback (Helmut Wurm) - {match_reason}"
        
        new_name = f"{new_employee.first_name} {new_employee.last_name}" if new_employee else "N/A"
        
        # Prüfe ob Änderung nötig
        if current_employee == new_employee:
            stats['skipped_no_change'] += 1
            assignments['no_change'].append({
                'system': system,
                'employee': new_employee,
                'reason': match_reason
            })
            continue
        
        assignments[assignment_type].append({
            'system': system,
            'old_employee': current_employee,
            'new_employee': new_employee,
            'reason': match_reason,
            'location': f"{country}, {postal_code} {city}".strip(', ')
        })
        
        if execute and new_employee:
            try:
                system.responsible_employee = new_employee
                system.save(update_fields=['responsible_employee'])
            except Exception as e:
                stats['errors'].append(f"System {system.system_number}: {str(e)}")
    
    # Ausgabe der Ergebnisse
    print("\n" + "=" * 70)
    print("ERGEBNISSE")
    print("=" * 70)
    
    print(f"\n📊 STATISTIK:")
    print(f"  ✅ Direkt zugeordnet (Vertriebsgebiet): {stats['matched']}")
    print(f"  ⚡ Fallback (Helmut Wurm): {stats['fallback']}")
    print(f"  ⏭️  Keine Änderung nötig: {stats['skipped_no_change']}")
    print(f"  📍 Gesamt verarbeitet: {total_systems}")
    
    if assignments['matched']:
        print(f"\n📋 ZUORDNUNGEN ÜBER VERTRIEBSGEBIET ({len(assignments['matched'])}):")
        # Gruppiere nach Mitarbeiter
        by_employee = {}
        for a in assignments['matched']:
            emp_name = f"{a['new_employee'].first_name} {a['new_employee'].last_name}"
            if emp_name not in by_employee:
                by_employee[emp_name] = []
            by_employee[emp_name].append(a)
        
        for emp_name, items in sorted(by_employee.items()):
            print(f"\n  👤 {emp_name} ({len(items)} Systeme):")
            for a in items[:10]:  # Zeige max 10 pro Mitarbeiter
                old_name = f"{a['old_employee'].first_name} {a['old_employee'].last_name}" if a['old_employee'] else "Keiner"
                print(f"    - {a['system'].system_number}: {a['location']}")
                print(f"      (war: {old_name})")
            if len(items) > 10:
                print(f"    ... und {len(items) - 10} weitere")
    
    if assignments['fallback']:
        print(f"\n📋 FALLBACK-ZUORDNUNGEN ZU HELMUT WURM ({len(assignments['fallback'])}):")
        # Gruppiere nach Grund
        by_reason = {}
        for a in assignments['fallback']:
            reason = a['reason'].split(' - ')[-1] if ' - ' in a['reason'] else a['reason']
            if reason not in by_reason:
                by_reason[reason] = []
            by_reason[reason].append(a)
        
        for reason, items in sorted(by_reason.items()):
            print(f"\n  ❓ {reason} ({len(items)} Systeme):")
            for a in items[:5]:  # Zeige max 5 pro Grund
                print(f"    - {a['system'].system_number}: {a['location']}")
            if len(items) > 5:
                print(f"    ... und {len(items) - 5} weitere")
    
    if stats['errors']:
        print(f"\n❌ FEHLER ({len(stats['errors'])}):")
        for error in stats['errors']:
            print(f"  - {error}")
    
    # Zusammenfassung der Länder-Verteilung
    print("\n" + "=" * 70)
    print("LÄNDER-VERTEILUNG DER ZU ÄNDERNDEN SYSTEME")
    print("=" * 70)
    
    country_stats = {}
    for assignment_type in ['matched', 'fallback']:
        for a in assignments[assignment_type]:
            loc = (a['system'].location_country or 'UNBEKANNT').upper()
            if loc not in country_stats:
                country_stats[loc] = {'matched': 0, 'fallback': 0}
            country_stats[loc][assignment_type] += 1
    
    for country, counts in sorted(country_stats.items()):
        total = counts['matched'] + counts['fallback']
        print(f"  {country}: {total} (direkt: {counts['matched']}, fallback: {counts['fallback']})")
    
    if not execute:
        print("\n" + "=" * 70)
        print("⚠️  DRY-RUN MODUS - Keine Änderungen durchgeführt!")
        print("   Verwende --execute um die Zuordnungen durchzuführen.")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        total_changed = stats['matched'] + stats['fallback']
        print(f"✅ {total_changed} Systeme wurden aktualisiert!")
        print("=" * 70)


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='Ordne Systeme automatisch den Vertriebsmitarbeitern zu'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Führe die Änderungen tatsächlich durch (Standard: Dry-Run)'
    )
    parser.add_argument(
        '--only-unassigned',
        action='store_true',
        help='Bearbeite nur Systeme ohne zuständigen Mitarbeiter'
    )
    
    args = parser.parse_args()
    assign_systems(execute=args.execute, only_unassigned=args.only_unassigned)


if __name__ == '__main__':
    main()
