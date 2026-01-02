#!/usr/bin/env python
"""
Delete all Trading Products and their price history from database
WARNING: This action cannot be undone!
"""
import os
import sys
import django

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from suppliers.models import TradingProduct, TradingProductPrice


def delete_all_trading_products():
    """Delete all trading products and their price history"""
    
    # Count records
    product_count = TradingProduct.objects.count()
    price_count = TradingProductPrice.objects.count()
    
    print("=" * 80)
    print("WARNUNG: Trading Products löschen")
    print("=" * 80)
    print(f"Trading Products in Datenbank: {product_count}")
    print(f"Preisdatensätze in Datenbank: {price_count}")
    print()
    
    if product_count == 0:
        print("Keine Trading Products zum Löschen vorhanden.")
        return
    
    # Confirmation
    print("ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!")
    confirmation = input("Möchten Sie wirklich ALLE Trading Products löschen? (ja/nein): ")
    
    if confirmation.lower() != 'ja':
        print("Abbruch. Keine Daten wurden gelöscht.")
        return
    
    # Double confirmation
    print()
    print("Letzte Warnung!")
    final_confirmation = input(f"Wirklich {product_count} Trading Products PERMANENT löschen? (JA in Großbuchstaben): ")
    
    if final_confirmation != 'JA':
        print("Abbruch. Keine Daten wurden gelöscht.")
        return
    
    print()
    print("Lösche Trading Products...")
    
    # Delete prices first (cascade should handle this, but to be safe)
    deleted_prices = TradingProductPrice.objects.all().delete()
    print(f"✓ {deleted_prices[0]} Preisdatensätze gelöscht")
    
    # Delete products
    deleted_products = TradingProduct.objects.all().delete()
    print(f"✓ {deleted_products[0]} Trading Products gelöscht")
    
    print()
    print("=" * 80)
    print("Alle Trading Products wurden erfolgreich gelöscht!")
    print("=" * 80)


if __name__ == '__main__':
    delete_all_trading_products()
