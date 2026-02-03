"""
Check coordinate data for Bernd Zobiak's systems
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from systems.models import System
from users.models import Employee

# Find Bernd Zobiak
bernd = Employee.objects.filter(first_name__icontains='bernd', last_name__icontains='zobiak').first()
print(f'Mitarbeiter: {bernd}')
print()

# Get his systems
systems = System.objects.filter(responsible_employee=bernd)
print(f'Anzahl Systeme: {systems.count()}')
print()

for s in systems:
    print(f'{s.system_number}: {s.system_name}')
    print(f'  Lat: {repr(s.location_latitude)} (type: {type(s.location_latitude).__name__})')
    print(f'  Lng: {repr(s.location_longitude)} (type: {type(s.location_longitude).__name__})')
    
    # Check if they would pass the validation
    lat = s.location_latitude
    lng = s.location_longitude
    
    if lat is None or lng is None:
        print(f'  ❌ NULL coordinate')
    else:
        latStr = str(lat).strip()
        lngStr = str(lng).strip()
        
        if latStr == '' or lngStr == '':
            print(f'  ❌ Empty string after conversion')
        else:
            try:
                latNum = float(latStr)
                lngNum = float(lngStr)
                
                # Check if 0.0
                if latNum == 0.0 or lngNum == 0.0:
                    print(f'  ❌ Coordinate is 0.0 (latNum={latNum}, lngNum={lngNum})')
                elif not (isinstance(latNum, float) and isinstance(lngNum, float)):
                    print(f'  ❌ Not float type')
                else:
                    print(f'  ✅ Valid (latNum={latNum}, lngNum={lngNum})')
            except (ValueError, TypeError) as e:
                print(f'  ❌ Conversion error: {e}')
    print()
