"""
Script to geocode customer addresses using Nominatim (OpenStreetMap)
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

from customers.models import CustomerAddress


def geocode_address(street, house_number, postal_code, city, state, country):
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
    if state:
        parts.append(state)
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
            'User-Agent': 'VERP-System/1.0 (Customer Address Geocoder)'
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
    print("🗺️  Geocoding Customer Addresses")
    print("=" * 60)
    
    # Find active addresses without coordinates but with city
    addresses = CustomerAddress.objects.filter(
        is_active=True,
        latitude__isnull=True,
        city__isnull=False
    ).exclude(city='').select_related('customer')
    
    total = addresses.count()
    print(f"Found {total} active address(es) without coordinates\n")
    
    if total == 0:
        print("✅ All active addresses already have coordinates!")
        return
    
    success_count = 0
    failed_count = 0
    
    for i, address in enumerate(addresses, 1):
        customer_name = address.customer.full_name if hasattr(address.customer, 'full_name') else str(address.customer)
        customer_number = address.customer.customer_number
        address_type = address.get_address_type_display()
        
        print(f"[{i}/{total}] {customer_number} - {customer_name}")
        print(f"  Type: {address_type}")
        print(f"  Address: {address.street} {address.house_number}, {address.postal_code} {address.city}")
        
        # Geocode the address
        lat, lon = geocode_address(
            address.street,
            address.house_number,
            address.postal_code,
            address.city,
            address.state,
            address.country
        )
        
        if lat and lon:
            # Save coordinates
            address.latitude = lat
            address.longitude = lon
            address.save()
            print(f"  ✅ Coordinates: {lat}, {lon}")
            success_count += 1
        else:
            print(f"  ❌ Failed to geocode")
            failed_count += 1
        
        # Rate limiting: Nominatim allows 1 request per second
        if i < total:
            time.sleep(1)
        
        print()
    
    print("=" * 60)
    print(f"📊 Summary:")
    print(f"  Total addresses: {total}")
    print(f"  ✅ Successfully geocoded: {success_count}")
    print(f"  ❌ Failed: {failed_count}")
    print()
    print("Note: Some addresses may fail if the address is incomplete or not found.")
    print("You can manually add coordinates in the customer detail page.")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
