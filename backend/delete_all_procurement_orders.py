#!/usr/bin/env python
"""
Delete all Procurement Orders (Lieferantenbestellungen) from database
WARNING: This action cannot be undone!
"""
import os
import sys
import django

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from orders.models import Order, OrderItem


def delete_all_orders():
    """Delete all procurement orders and their items"""
    
    # Count records
    order_count = Order.objects.count()
    item_count = OrderItem.objects.count()
    
    print("=" * 80)
    print("WARNUNG: Lieferantenbestellungen löschen")
    print("=" * 80)
    print(f"Bestellungen in Datenbank: {order_count}")
    print(f"Bestellpositionen in Datenbank: {item_count}")
    print()
    
    if order_count == 0:
        print("Keine Bestellungen zum Löschen vorhanden.")
        return
    
    # Confirmation
    print("ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!")
    confirmation = input("Möchten Sie wirklich ALLE Lieferantenbestellungen löschen? (ja/nein): ")
    
    if confirmation.lower() != 'ja':
        print("Abbruch. Keine Daten wurden gelöscht.")
        return
    
    # Double confirmation
    print()
    print("Letzte Warnung!")
    final_confirmation = input(f"Wirklich {order_count} Bestellungen PERMANENT löschen? (JA in Großbuchstaben): ")
    
    if final_confirmation != 'JA':
        print("Abbruch. Keine Daten wurden gelöscht.")
        return
    
    print()
    print("Lösche Bestellungen...")
    
    # Delete order items first (cascade should handle this, but to be safe)
    deleted_items = OrderItem.objects.all().delete()
    print(f"✓ {deleted_items[0]} Bestellpositionen gelöscht")
    
    # Delete orders
    deleted_orders = Order.objects.all().delete()
    print(f"✓ {deleted_orders[0]} Bestellungen gelöscht")
    
    print()
    print("=" * 80)
    print("Alle Lieferantenbestellungen wurden erfolgreich gelöscht!")
    print("=" * 80)


if __name__ == '__main__':
    delete_all_orders()
