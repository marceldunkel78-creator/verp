#!/usr/bin/env python
"""
Setup script to populate standard warranty terms (Garantiebedingungen)
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from verp_settings.models import WarrantyTerm

STANDARD_WARRANTY_TERMS = [
    {
        'name': '12 Monate Garantie',
        'name_en': '12 Months Warranty',
        'duration_months': 12,
        'description': 'Standardgarantie von 12 Monaten ab Lieferdatum. Umfasst Material- und Verarbeitungsfehler.',
        'description_en': 'Standard warranty of 12 months from delivery date. Covers material and manufacturing defects.',
        'is_default': True,
    },
    {
        'name': '24 Monate Garantie',
        'name_en': '24 Months Warranty',
        'duration_months': 24,
        'description': 'Erweiterte Garantie von 24 Monaten ab Lieferdatum. Umfasst Material- und Verarbeitungsfehler.',
        'description_en': 'Extended warranty of 24 months from delivery date. Covers material and manufacturing defects.',
        'is_default': False,
    },
    {
        'name': '36 Monate Garantie',
        'name_en': '36 Months Warranty',
        'duration_months': 36,
        'description': 'Premium-Garantie von 36 Monaten ab Lieferdatum. Umfasst Material- und Verarbeitungsfehler.',
        'description_en': 'Premium warranty of 36 months from delivery date. Covers material and manufacturing defects.',
        'is_default': False,
    },
    {
        'name': '6 Monate Garantie auf Verschleißteile',
        'name_en': '6 Months Warranty on Wear Parts',
        'duration_months': 6,
        'description': 'Garantie auf Verschleißteile von 6 Monaten ab Lieferdatum.',
        'description_en': 'Warranty on wear parts of 6 months from delivery date.',
        'is_default': False,
    },
    {
        'name': 'Keine Garantie',
        'name_en': 'No Warranty',
        'duration_months': 0,
        'description': 'Keine Garantie. Gewährleistung nach gesetzlichen Bestimmungen.',
        'description_en': 'No warranty. Statutory warranty applies.',
        'is_default': False,
    },
]


def setup_warranty_terms():
    """Create or update warranty terms"""
    created_count = 0
    updated_count = 0
    
    for term_data in STANDARD_WARRANTY_TERMS:
        term, created = WarrantyTerm.objects.update_or_create(
            name=term_data['name'],
            defaults={
                'name_en': term_data['name_en'],
                'duration_months': term_data['duration_months'],
                'description': term_data['description'],
                'description_en': term_data['description_en'],
                'is_default': term_data['is_default'],
                'is_active': True,
            }
        )
        
        if created:
            created_count += 1
            print(f"✓ Created: {term_data['name']}")
        else:
            updated_count += 1
            print(f"↻ Updated: {term_data['name']}")
    
    print(f"\n{'='*50}")
    print(f"Done! Created: {created_count}, Updated: {updated_count}")
    print(f"Total warranty terms in database: {WarrantyTerm.objects.count()}")


if __name__ == '__main__':
    print("Setting up warranty terms (Garantiebedingungen)...")
    print("="*50)
    setup_warranty_terms()
