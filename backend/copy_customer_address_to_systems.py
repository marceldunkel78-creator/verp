#!/usr/bin/env python
"""
Script zum Kopieren der Kundenadresse in die Systemadresse und Geocoding.

Fuer Systeme mit verknuepftem Kunden wird die erste (aktive) Kundenadresse
als Systemstandort-Adresse uebernommen und optional geocodiert.

Usage:
    python copy_customer_address_to_systems.py                    # Dry-run
    python copy_customer_address_to_systems.py --execute          # Ausfuehren
    python copy_customer_address_to_systems.py --geocode          # Mit Geocoding
    python copy_customer_address_to_systems.py --system S-00042   # Nur ein System
"""

import os
import sys
import argparse
import django
import time
import requests
from decimal import Decimal

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from systems.models import System
from customers.models import CustomerAddress


def geocode_address(street, house_number, postal_code, city, country):
    """
    Geocodiert eine Adresse mit Nominatim API.
    Gibt (latitude, longitude) oder (None, None) zurueck.
    """
    # Adress-String bauen
    parts = []
    if street and house_number:
        parts.append(f"{street} {house_number}")
    elif street:
        parts.append(street)
    if postal_code and city:
        parts.append(f"{postal_code} {city}")
    elif city:
        parts.append(city)
    if country:
        # Laendercodes in Namen umwandeln fuer bessere Ergebnisse
        country_names = {
            'DE': 'Germany', 'AT': 'Austria', 'CH': 'Switzerland',
            'US': 'USA', 'GB': 'United Kingdom', 'FR': 'France',
            'NL': 'Netherlands', 'BE': 'Belgium', 'IT': 'Italy',
            'ES': 'Spain', 'JP': 'Japan', 'CN': 'China',
            'KR': 'South Korea', 'AU': 'Australia', 'CA': 'Canada',
        }
        parts.append(country_names.get(country, country))
    
    if not parts:
        return None, None
    
    address = ", ".join(parts)
    
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'format': 'json',
            'q': address,
            'limit': 1
        }
        headers = {
            'User-Agent': 'VERP-System/1.0 (System Location Geocoder)'
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data and len(data) > 0:
            lat = Decimal(str(data[0]['lat']))
            lon = Decimal(str(data[0]['lon']))
            # Auf 7 Dezimalstellen runden (ca. 1cm Praezision)
            lat = lat.quantize(Decimal('0.0000001'))
            lon = lon.quantize(Decimal('0.0000001'))
            return lat, lon
        
    except Exception as e:
        return None, None
    
    return None, None


def get_customer_address(customer):
    """
    Holt die beste Adresse eines Kunden.
    Priorisierung: Office > Labor > erste aktive Adresse
    """
    if not customer:
        return None
    
    # Versuche zuerst Office-Adresse
    address = customer.addresses.filter(is_active=True, address_type='Office').first()
    if address:
        return address
    
    # Dann Labor-Adresse
    address = customer.addresses.filter(is_active=True, address_type='Labor').first()
    if address:
        return address
    
    # Fallback auf erste aktive Adresse
    return customer.addresses.filter(is_active=True).first()


def has_system_address(system):
    """Prueft ob das System bereits eine Adresse hat"""
    return bool(
        system.location_street or 
        system.location_city or 
        system.location_postal_code
    )


def copy_address_to_system(system, address, do_geocode=False, dry_run=True, verbose=True):
    """
    Kopiert eine Kundenadresse in die Systemadresse.
    """
    result = {
        'system': system.system_number,
        'copied': False,
        'geocoded': False,
        'message': ''
    }
    
    if not address:
        result['message'] = "Keine Kundenadresse vorhanden"
        return result
    
    # Adressfelder zuordnen
    fields_to_copy = {
        'location_university': address.university or '',
        'location_institute': address.institute or '',
        'location_department': address.department or '',
        'location_street': address.street or '',
        'location_house_number': address.house_number or '',
        'location_address_supplement': address.address_supplement or '',
        'location_postal_code': address.postal_code or '',
        'location_city': address.city or '',
        'location_country': address.country or 'DE',
    }
    
    address_str = f"{address.street} {address.house_number}, {address.postal_code} {address.city}"
    
    if dry_run:
        result['copied'] = True
        result['message'] = f"Adresse: {address_str}"
        
        if do_geocode and address.city:
            # Im Dry-Run zeigen wir nur an, dass geocodet werden wuerde
            result['message'] += " [wuerde geocodet]"
    else:
        # Felder kopieren
        for field, value in fields_to_copy.items():
            setattr(system, field, value)
        
        # Geocoding wenn gewuenscht
        if do_geocode and address.city:
            # Erst versuchen, Koordinaten von Kundenadresse zu uebernehmen
            if address.latitude and address.longitude:
                system.location_latitude = address.latitude
                system.location_longitude = address.longitude
                result['geocoded'] = True
                result['message'] = f"Adresse: {address_str} (Koordinaten vom Kunden)"
            else:
                # Nominatim abfragen
                lat, lon = geocode_address(
                    address.street,
                    address.house_number,
                    address.postal_code,
                    address.city,
                    address.country
                )
                if lat and lon:
                    system.location_latitude = lat
                    system.location_longitude = lon
                    result['geocoded'] = True
                    result['message'] = f"Adresse: {address_str} (geocodet: {lat}, {lon})"
                else:
                    result['message'] = f"Adresse: {address_str} (Geocoding fehlgeschlagen)"
        else:
            result['message'] = f"Adresse: {address_str}"
        
        system.save()
        result['copied'] = True
    
    return result


def main():
    parser = argparse.ArgumentParser(
        description='Kopiert Kundenadressen in Systemadressen und geocodiert optional'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Tatsaechlich kopieren (ohne diesen Flag: nur Dry-Run)'
    )
    parser.add_argument(
        '--geocode',
        action='store_true',
        help='Adressen auch geocodieren (Koordinaten ermitteln)'
    )
    parser.add_argument(
        '--system',
        type=str,
        help='Nur ein bestimmtes System verarbeiten (z.B. S-00042)'
    )
    parser.add_argument(
        '--overwrite',
        action='store_true',
        help='Auch Systeme mit vorhandener Adresse ueberschreiben'
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
    print("Kundenadressen in Systemadressen kopieren")
    print("=" * 70)
    
    if dry_run:
        print("\n[DRY-RUN] Modus - es werden keine Aenderungen vorgenommen\n")
    else:
        print("\n[EXECUTE] Modus - Aenderungen werden durchgefuehrt!\n")
    
    if args.geocode:
        print("[INFO] Geocoding aktiviert - Koordinaten werden ermittelt")
        if not dry_run:
            print("[INFO] Rate-Limiting: max 1 Request pro Sekunde (Nominatim)\n")
    
    # Systeme laden
    if args.system:
        try:
            systems = [System.objects.get(system_number=args.system)]
            print(f"Verarbeite nur System: {args.system}")
        except System.DoesNotExist:
            print(f"[FEHLER] System {args.system} nicht gefunden!")
            sys.exit(1)
    else:
        # Systeme mit verknuepftem Kunden
        systems = System.objects.filter(customer__isnull=False)
        if not args.overwrite:
            # Nur Systeme ohne vorhandene Adresse
            systems = systems.filter(
                location_street='',
                location_city=''
            )
        print(f"Durchsuche {systems.count()} Systeme...")
    
    print()
    
    total_processed = 0
    total_copied = 0
    total_geocoded = 0
    total_no_address = 0
    total_skipped = 0
    
    for system in systems:
        total_processed += 1
        
        # Pruefen ob bereits Adresse vorhanden
        if has_system_address(system) and not args.overwrite:
            total_skipped += 1
            if verbose:
                print(f"[SKIP] {system.system_number}: Hat bereits Adresse")
            continue
        
        # Kundenadresse holen
        address = get_customer_address(system.customer)
        
        if not address:
            total_no_address += 1
            if verbose:
                print(f"[--] {system.system_number}: Kunde hat keine Adresse")
            continue
        
        # Adresse kopieren
        result = copy_address_to_system(
            system, 
            address, 
            do_geocode=args.geocode, 
            dry_run=dry_run, 
            verbose=verbose
        )
        
        if result['copied']:
            total_copied += 1
            if result['geocoded']:
                total_geocoded += 1
            if verbose:
                geo_mark = " [GEO]" if result['geocoded'] else ""
                print(f"[OK] {system.system_number}: {result['message']}{geo_mark}")
        
        # Rate-Limiting fuer Nominatim (nur bei echtem Geocoding)
        if args.geocode and not dry_run and result['geocoded']:
            time.sleep(1.1)  # Nominatim: max 1 request/sec
    
    # Zusammenfassung
    print("\n" + "=" * 70)
    print("ZUSAMMENFASSUNG")
    print("=" * 70)
    print(f"Systeme verarbeitet: {total_processed}")
    print(f"Uebersprungen (hat Adresse): {total_skipped}")
    print(f"Kunde ohne Adresse: {total_no_address}")
    print(f"{'Wuerden kopiert' if dry_run else 'Kopiert'}: {total_copied}")
    if args.geocode:
        print(f"{'Wuerden geocodet' if dry_run else 'Geocodet'}: {total_geocoded}")
    
    if dry_run and total_copied > 0:
        print(f"\n[HINWEIS] Um die Aenderungen durchzufuehren:")
        print(f"  python copy_customer_address_to_systems.py --execute")
        if args.geocode:
            print(f"  python copy_customer_address_to_systems.py --execute --geocode")
        if args.system:
            print(f"  (mit --system {args.system} fuer einzelnes System)")


if __name__ == '__main__':
    main()
