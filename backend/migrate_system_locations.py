#!/usr/bin/env python
"""
Migration Script: Übernimmt Kundenadresse als Systemstandort

Dieses Script kopiert für alle bestehenden Systeme, die noch keine 
Standortadresse haben, die primäre Kundenadresse (Office/Labor) 
als Systemstandort.

Ausführung:
    cd backend
    python migrate_system_locations.py

Optionen:
    --dry-run   Zeigt nur an, was geändert würde (keine Änderungen)
    --force     Überschreibt auch bereits vorhandene Standortadressen
"""

import os
import sys
import django

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from systems.models import System
from customers.models import CustomerAddress


def migrate_system_locations(dry_run=False, force=False):
    """
    Migriert Standortadressen für bestehende Systeme.
    
    Args:
        dry_run: Wenn True, werden keine Änderungen gespeichert
        force: Wenn True, werden auch Systeme mit bestehender Adresse aktualisiert
    """
    systems = System.objects.select_related('customer').all()
    
    updated_count = 0
    skipped_count = 0
    no_address_count = 0
    no_customer_count = 0
    
    print(f"\n{'='*60}")
    print(f"Systemstandort-Migration {'(DRY RUN)' if dry_run else ''}")
    print(f"{'='*60}\n")
    print(f"Gefundene Systeme: {systems.count()}")
    print(f"Force-Modus: {'Ja' if force else 'Nein'}\n")
    
    for system in systems:
        # Prüfe ob Kunde vorhanden
        if not system.customer:
            print(f"  ⚠ {system.system_number}: Kein Kunde zugeordnet - übersprungen")
            no_customer_count += 1
            continue
        
        # Prüfe ob bereits Standortadresse vorhanden (wenn nicht force)
        has_address = any([
            system.location_university,
            system.location_institute,
            system.location_street,
            system.location_city
        ])
        
        if has_address and not force:
            print(f"  ⏭ {system.system_number}: Standortadresse bereits vorhanden - übersprungen")
            skipped_count += 1
            continue
        
        # Suche Kundenadresse (Office oder Labor bevorzugt)
        address = system.customer.addresses.filter(
            is_active=True,
            address_type__in=['Office', 'Labor']
        ).order_by('address_type').first()
        
        if not address:
            # Fallback auf erste aktive Adresse
            address = system.customer.addresses.filter(is_active=True).first()
        
        if not address:
            print(f"  ⚠ {system.system_number}: Keine Kundenadresse verfügbar - übersprungen")
            no_address_count += 1
            continue
        
        # Adresse übertragen
        if not dry_run:
            system.location_university = address.university or ''
            system.location_institute = address.institute or ''
            system.location_department = address.department or ''
            system.location_street = address.street or ''
            system.location_house_number = address.house_number or ''
            system.location_address_supplement = address.address_supplement or ''
            system.location_postal_code = address.postal_code or ''
            system.location_city = address.city or ''
            system.location_country = address.country or 'DE'
            system.save()
        
        # Zusammenfassung der Adresse
        addr_parts = []
        if address.university:
            addr_parts.append(address.university)
        if address.city:
            addr_parts.append(address.city)
        addr_summary = ', '.join(addr_parts) if addr_parts else 'Adresse ohne Details'
        
        action = "würde aktualisiert" if dry_run else "aktualisiert"
        print(f"  ✓ {system.system_number} ({system.system_name}): {action}")
        print(f"      → {addr_summary}")
        
        updated_count += 1
    
    print(f"\n{'='*60}")
    print(f"Zusammenfassung:")
    print(f"{'='*60}")
    print(f"  Aktualisiert:              {updated_count}")
    print(f"  Bereits vorhanden:         {skipped_count}")
    print(f"  Ohne Kunde:                {no_customer_count}")
    print(f"  Ohne Kundenadresse:        {no_address_count}")
    print(f"  Gesamt:                    {systems.count()}")
    
    if dry_run:
        print(f"\n💡 Dies war ein Testlauf. Führe das Script ohne --dry-run aus,")
        print(f"   um die Änderungen tatsächlich zu speichern.")
    else:
        print(f"\n✅ Migration abgeschlossen!")


if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv
    force = '--force' in sys.argv
    
    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        sys.exit(0)
    
    migrate_system_locations(dry_run=dry_run, force=force)
