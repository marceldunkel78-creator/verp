#!/usr/bin/env python
"""
Setup script to populate German travel per-diem rates (Verpflegungspauschalen)
Based on German tax law (§ 9 EStG) - rates as of 2024
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from users.models import TravelPerDiemRate
from decimal import Decimal
from datetime import date

# German per-diem rates 2024 (Verpflegungspauschalen nach deutschem Steuerrecht)
# Source: BMF-Schreiben zu Reisekosten
# Model fields: country, country_code, full_day_rate, partial_day_rate, overnight_rate
RATES_2024 = [
    # Germany (Inland)
    {'country_code': 'DE', 'country': 'Deutschland', 'full_day_rate': Decimal('28.00'), 'partial_day_rate': Decimal('14.00'), 'overnight_rate': Decimal('20.00')},
    
    # Common European countries
    {'country_code': 'AT', 'country': 'Österreich', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('30.00')},
    {'country_code': 'CH', 'country': 'Schweiz', 'full_day_rate': Decimal('66.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('45.00')},
    {'country_code': 'FR', 'country': 'Frankreich', 'full_day_rate': Decimal('58.00'), 'partial_day_rate': Decimal('39.00'), 'overnight_rate': Decimal('40.00')},
    {'country_code': 'IT', 'country': 'Italien', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('30.00')},
    {'country_code': 'ES', 'country': 'Spanien', 'full_day_rate': Decimal('34.00'), 'partial_day_rate': Decimal('23.00'), 'overnight_rate': Decimal('25.00')},
    {'country_code': 'NL', 'country': 'Niederlande', 'full_day_rate': Decimal('47.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('35.00')},
    {'country_code': 'BE', 'country': 'Belgien', 'full_day_rate': Decimal('52.00'), 'partial_day_rate': Decimal('35.00'), 'overnight_rate': Decimal('35.00')},
    {'country_code': 'GB', 'country': 'Großbritannien', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('40.00')},
    {'country_code': 'PL', 'country': 'Polen', 'full_day_rate': Decimal('29.00'), 'partial_day_rate': Decimal('20.00'), 'overnight_rate': Decimal('18.00')},
    {'country_code': 'CZ', 'country': 'Tschechien', 'full_day_rate': Decimal('35.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('20.00')},
    {'country_code': 'DK', 'country': 'Dänemark', 'full_day_rate': Decimal('66.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('45.00')},
    {'country_code': 'SE', 'country': 'Schweden', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('40.00')},
    {'country_code': 'NO', 'country': 'Norwegen', 'full_day_rate': Decimal('73.00'), 'partial_day_rate': Decimal('49.00'), 'overnight_rate': Decimal('50.00')},
    {'country_code': 'FI', 'country': 'Finnland', 'full_day_rate': Decimal('50.00'), 'partial_day_rate': Decimal('34.00'), 'overnight_rate': Decimal('35.00')},
    {'country_code': 'PT', 'country': 'Portugal', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('22.00')},
    {'country_code': 'GR', 'country': 'Griechenland', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('25.00')},
    {'country_code': 'HU', 'country': 'Ungarn', 'full_day_rate': Decimal('27.00'), 'partial_day_rate': Decimal('18.00'), 'overnight_rate': Decimal('18.00')},
    {'country_code': 'IE', 'country': 'Irland', 'full_day_rate': Decimal('52.00'), 'partial_day_rate': Decimal('35.00'), 'overnight_rate': Decimal('35.00')},
    {'country_code': 'LU', 'country': 'Luxemburg', 'full_day_rate': Decimal('55.00'), 'partial_day_rate': Decimal('37.00'), 'overnight_rate': Decimal('38.00')},
    
    # Other major countries
    {'country_code': 'US', 'country': 'USA', 'full_day_rate': Decimal('59.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('40.00')},
    {'country_code': 'CA', 'country': 'Kanada', 'full_day_rate': Decimal('55.00'), 'partial_day_rate': Decimal('37.00'), 'overnight_rate': Decimal('38.00')},
    {'country_code': 'JP', 'country': 'Japan', 'full_day_rate': Decimal('63.00'), 'partial_day_rate': Decimal('42.00'), 'overnight_rate': Decimal('45.00')},
    {'country_code': 'CN', 'country': 'China', 'full_day_rate': Decimal('49.00'), 'partial_day_rate': Decimal('33.00'), 'overnight_rate': Decimal('32.00')},
    {'country_code': 'AU', 'country': 'Australien', 'full_day_rate': Decimal('51.00'), 'partial_day_rate': Decimal('34.00'), 'overnight_rate': Decimal('35.00')},
    {'country_code': 'SG', 'country': 'Singapur', 'full_day_rate': Decimal('60.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('42.00')},
    {'country_code': 'AE', 'country': 'Vereinigte Arabische Emirate', 'full_day_rate': Decimal('54.00'), 'partial_day_rate': Decimal('36.00'), 'overnight_rate': Decimal('38.00')},
    {'country_code': 'TR', 'country': 'Türkei', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('25.00')},
    {'country_code': 'RU', 'country': 'Russland', 'full_day_rate': Decimal('35.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('24.00')},
    {'country_code': 'IN', 'country': 'Indien', 'full_day_rate': Decimal('35.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('24.00')},
    {'country_code': 'BR', 'country': 'Brasilien', 'full_day_rate': Decimal('49.00'), 'partial_day_rate': Decimal('33.00'), 'overnight_rate': Decimal('32.00')},
    {'country_code': 'MX', 'country': 'Mexiko', 'full_day_rate': Decimal('45.00'), 'partial_day_rate': Decimal('30.00'), 'overnight_rate': Decimal('30.00')},
    {'country_code': 'ZA', 'country': 'Südafrika', 'full_day_rate': Decimal('29.00'), 'partial_day_rate': Decimal('20.00'), 'overnight_rate': Decimal('18.00')},
    {'country_code': 'KR', 'country': 'Südkorea', 'full_day_rate': Decimal('60.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('42.00')},
    
    # Default / Other
    {'country_code': 'XX', 'country': 'Sonstige Länder', 'full_day_rate': Decimal('34.00'), 'partial_day_rate': Decimal('23.00'), 'overnight_rate': Decimal('22.00')},
]


def setup_per_diem_rates():
    """Create or update per-diem rates for 2024"""
    valid_from = date(2024, 1, 1)
    created_count = 0
    updated_count = 0
    
    for rate_data in RATES_2024:
        rate, created = TravelPerDiemRate.objects.update_or_create(
            country=rate_data['country'],
            valid_from=valid_from,
            defaults={
                'country_code': rate_data['country_code'],
                'full_day_rate': rate_data['full_day_rate'],
                'partial_day_rate': rate_data['partial_day_rate'],
                'overnight_rate': rate_data['overnight_rate'],
                'valid_until': None,  # Currently valid
                'is_active': True,
            }
        )
        
        if created:
            created_count += 1
            print(f"✓ Created: {rate_data['country']} ({rate_data['country_code']})")
        else:
            updated_count += 1
            print(f"↻ Updated: {rate_data['country']} ({rate_data['country_code']})")
    
    print(f"\n{'='*50}")
    print(f"Done! Created: {created_count}, Updated: {updated_count}")
    print(f"Total per-diem rates in database: {TravelPerDiemRate.objects.count()}")


if __name__ == '__main__':
    print("Setting up German travel per-diem rates (Verpflegungspauschalen 2024)...")
    print("="*50)
    setup_per_diem_rates()
