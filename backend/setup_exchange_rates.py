import os
import sys
import django

# Setze das Working Directory auf backend
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.contrib.auth import get_user_model
from verp_settings.models import ExchangeRate
from decimal import Decimal

User = get_user_model()

print('=== VERP Settings Setup ===\n')

# Update user permissions
try:
    user = User.objects.get(username='mdunk')
    user.can_read_settings = True
    user.can_write_settings = True
    user.save()
    print(f'✓ User {user.username} Einstellungen-Berechtigungen gesetzt!')
except User.DoesNotExist:
    print('✗ User mdunk nicht gefunden!')
except Exception as e:
    print(f'✗ Fehler beim Update des Users: {e}')

# Create exchange rates
rates_data = [
    ('USD', '1.08', 'US Dollar'),
    ('CHF', '1.06', 'Schweizer Franken'),
    ('GBP', '0.85', 'Britisches Pfund'),
    ('JPY', '0.0071', 'Japanischer Yen'),
]

print('\n=== Wechselkurse ===')
for currency, rate, name in rates_data:
    try:
        rate_obj, created = ExchangeRate.objects.get_or_create(
            currency=currency,
            defaults={'rate_to_eur': Decimal(rate)}
        )
        if created:
            print(f'✓ Erstellt: {currency} ({name}) = {rate} EUR')
        else:
            rate_obj.rate_to_eur = Decimal(rate)
            rate_obj.save()
            print(f'✓ Aktualisiert: {currency} ({name}) = {rate} EUR')
    except Exception as e:
        print(f'✗ Fehler bei {currency}: {e}')

print('\n=== Setup abgeschlossen! ===')
