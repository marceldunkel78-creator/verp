#!/usr/bin/env python
"""
Delete all Customer Orders (Kundenaufträge) from database
WARNING: This action cannot be undone!
"""
import os
import sys
import django

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from customer_orders.models import CustomerOrder, CustomerOrderItem


def delete_all_customer_orders():
    """Delete all customer orders and their items"""
    
    # Count records
    order_count = CustomerOrder.objects.count()
    position_count = CustomerOrderItem.objects.count()
    
    print("=" * 80)
    print("WARNUNG: Kundenaufträge löschen")
    print("=" * 80)
    print(f"Kundenaufträge in Datenbank: {order_count}")
    print(f"Auftragspositionen in Datenbank: {position_count}")
    print()
    
    if order_count == 0:
        print("Keine Kundenaufträge zum Löschen vorhanden.")
        return
    
    # Confirmation
    print("ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!")
    confirmation = input("Möchten Sie wirklich ALLE Kundenaufträge löschen? (ja/nein): ")
    
    if confirmation.lower() != 'ja':
        print("Abbruch. Keine Daten wurden gelöscht.")
        return
    
    # Double confirmation
    print()
    print("Letzte Warnung!")
    final_confirmation = input(f"Wirklich {order_count} Kundenaufträge PERMANENT löschen? (JA in Großbuchstaben): ")
    
    if final_confirmation != 'JA':
        print("Abbruch. Keine Daten wurden gelöscht.")
        return
    
    print()
    print("Lösche Kundenaufträge...")
    
    # Delete order items first (cascade should handle this, but to be safe)
    deleted_positions = CustomerOrderItem.objects.all().delete()
    print(f"✓ {deleted_positions[0]} Auftragspositionen gelöscht")
    
    # Delete orders
    deleted_orders = CustomerOrder.objects.all().delete()
    print(f"✓ {deleted_orders[0]} Kundenaufträge gelöscht")
    
    print()
    print("=" * 80)
    print("Alle Kundenaufträge wurden erfolgreich gelöscht!")
    print("=" * 80)


if __name__ == '__main__':
    delete_all_customer_orders()
