"""
Check which systems have addresses that could be geocoded
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

# Get his systems without coordinates
systems = System.objects.filter(
    responsible_employee=bernd,
    location_latitude__isnull=True
)

print(f'{systems.count()} Systeme ohne Koordinaten:')
print()

for s in systems:
    print(f'{s.system_number}: {s.system_name}')
    print(f'  Stadt: {s.location_city or "(leer)"}')
    print(f'  Straße: {s.location_street or "(leer)"}')
    print(f'  PLZ: {s.location_postal_code or "(leer)"}')
    print(f'  Land: {s.location_country or "(leer)"}')
    
    # Check if it has enough address info
    has_city = bool(s.location_city and s.location_city.strip())
    if has_city:
        print(f'  ✅ Kann geocodet werden (hat Stadt)')
    else:
        print(f'  ❌ Kann nicht geocodet werden (keine Stadt)')
    print()
