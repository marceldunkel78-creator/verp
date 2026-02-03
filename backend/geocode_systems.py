"""
Script to geocode system locations using Nominatim (OpenStreetMap)
"""
import os
import sys
import django
import time
import requests
from decimal import Decimal

# Django Setup
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from systems.models import System


def geocode_address(street, house_number, postal_code, city, country):
    """
    Geocode an address using Nominatim API
    """
    # Build address string
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
        parts.append(country)
    
    if not parts:
        return None, None
    
    address = ", ".join(parts)
    
    try:
        # Nominatim API with user agent
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
            # Round to 6 decimal places (approx 11cm precision)
            lat = lat.quantize(Decimal('0.000001'))
            lon = lon.quantize(Decimal('0.000001'))
            return lat, lon
        
    except Exception as e:
        print(f"  ❌ Geocoding error: {e}")
    
    return None, None


def main():
    print("🗺️  Geocoding System Locations")
    print("=" * 60)
    
    # Find systems without coordinates but with address
    systems = System.objects.filter(
        location_latitude__isnull=True,
        location_city__isnull=False
    ).exclude(location_city='')
    
    total = systems.count()
    print(f"\nFound {total} systems without coordinates\n")
    
    if total == 0:
        print("✅ All systems with addresses already have coordinates!")
        return
    
    success_count = 0
    failed_count = 0
    skipped_count = 0
    
    for i, system in enumerate(systems, 1):
        print(f"[{i}/{total}] {system.system_number} - {system.system_name}")
        print(f"  📍 {system.location_city}")
        
        # Check if minimal address info is available
        if not system.location_city:
            print("  ⏭️  Skipped (no city)")
            skipped_count += 1
            continue
        
        # Geocode the address
        lat, lon = geocode_address(
            system.location_street,
            system.location_house_number,
            system.location_postal_code,
            system.location_city,
            system.location_country
        )
        
        if lat and lon:
            system.location_latitude = lat
            system.location_longitude = lon
            system.save(update_fields=['location_latitude', 'location_longitude'])
            print(f"  ✅ Geocoded: {lat}, {lon}")
            success_count += 1
        else:
            print(f"  ❌ Failed to geocode")
            failed_count += 1
        
        # Rate limiting: Nominatim requires max 1 request per second
        if i < total:
            time.sleep(1.1)
    
    print("\n" + "=" * 60)
    print("📊 Summary:")
    print(f"  ✅ Successfully geocoded: {success_count}")
    print(f"  ❌ Failed: {failed_count}")
    print(f"  ⏭️  Skipped: {skipped_count}")
    print(f"  📍 Total processed: {total}")
    print("=" * 60)


if __name__ == '__main__':
    main()
