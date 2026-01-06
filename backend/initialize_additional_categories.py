#!/usr/bin/env python
"""
Initialize additional product categories for inventory management
"""
import os
import sys
import django

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from verp_settings.models import ProductCategory

def initialize_additional_categories():
    """Initialize the additional categories: Piezo, Shutter"""

    new_categories = [
        ('PIEZO', 'Piezo'),
        ('SHUTTER', 'Shutter'),
    ]

    created_count = 0
    for code, name in new_categories:
        _, created = ProductCategory.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'requires_serial_number': True,  # Hardware needs serial numbers
                'applies_to_trading_goods': True,
                'applies_to_material_supplies': False,
                'applies_to_vs_hardware': True,
                'applies_to_vs_software': False,
                'applies_to_vs_service': False,
                'is_active': True,
                'sort_order': 60,  # Insert after existing hardware categories
            }
        )
        if created:
            created_count += 1
            print(f"✓ Created category: {code} - {name}")

    print(f"\nCreated {created_count} additional categories")
    print(f"Total categories: {ProductCategory.objects.count()}")

if __name__ == '__main__':
    initialize_additional_categories()