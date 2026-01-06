#!/usr/bin/env python
"""
Cleanup Script für fehlgeschlagenen Legacy-Import
=================================================

Löscht:
1. Alle importierten Aufträge (order_number startsWith 'O-' oder 'L-')
2. Kunden ab K-07450 (neu erstellte Kunden beim Import)

WICHTIG: Backup erstellen vor Ausführung!
"""

import os
import sys
import django

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db import transaction
from customers.models import Customer
from customer_orders.models import CustomerOrder


def cleanup_failed_import(dry_run=True):
    """
    Löscht importierte Aufträge und neu erstellte Kunden.
    
    Args:
        dry_run: Wenn True, werden keine Daten gelöscht (nur Vorschau)
    """
    print("\n" + "="*80)
    print("CLEANUP FAILED IMPORT")
    print("="*80)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE DELETION'}")
    print()
    
    # ========================================================================
    # Step 1: Find Legacy Orders
    # ========================================================================
    print("Searching for imported orders...")
    
    # Finde Aufträge mit Legacy-Nummernformat
    # Format: O-XXX-YY/ZZ oder L-YYYY-NNNN
    legacy_orders = CustomerOrder.objects.filter(
        order_number__startswith='O-'
    ) | CustomerOrder.objects.filter(
        order_number__startswith='L-'
    )
    
    order_count = legacy_orders.count()
    print(f"  Found {order_count} imported orders")
    
    # Zeige einige Beispiele
    if order_count > 0:
        print("\n  Sample orders:")
        for order in legacy_orders[:10]:
            print(f"    - {order.order_number}: {order.customer} ({order.items.count()} items)")
        if order_count > 10:
            print(f"    ... and {order_count - 10} more")
    
    # ========================================================================
    # Step 2: Find New Customers (>= K-07450)
    # ========================================================================
    print("\nSearching for newly created customers...")
    
    # Extrahiere Kundennummern >= 7450
    all_customers = Customer.objects.filter(
        customer_number__isnull=False,
        customer_number__startswith='K-'
    )
    
    new_customers = []
    for customer in all_customers:
        try:
            # Extrahiere numerischen Teil (K-07450 -> 7450)
            num_part = int(customer.customer_number.split('-')[1])
            if num_part >= 7450:
                new_customers.append(customer)
        except (ValueError, IndexError):
            continue
    
    customer_count = len(new_customers)
    print(f"  Found {customer_count} newly created customers (>= K-07450)")
    
    # Zeige einige Beispiele
    if customer_count > 0:
        print("\n  Sample customers:")
        for customer in new_customers[:10]:
            order_count = CustomerOrder.objects.filter(customer=customer).count()
            print(f"    - {customer.customer_number}: {customer.first_name} {customer.last_name} ({order_count} orders)")
        if customer_count > 10:
            print(f"    ... and {customer_count - 10} more")
    
    # ========================================================================
    # Step 3: Delete if not dry-run
    # ========================================================================
    if not dry_run:
        print("\n" + "="*80)
        print("DELETING DATA...")
        print("="*80)
        
        with transaction.atomic():
            # Lösche zuerst die Aufträge (wegen Foreign Key)
            if order_count > 0:
                print(f"\nDeleting {order_count} orders...")
                deleted_orders = legacy_orders.delete()
                print(f"  ✓ Deleted: {deleted_orders}")
            
            # Dann lösche die Kunden
            if customer_count > 0:
                print(f"\nDeleting {customer_count} customers...")
                for customer in new_customers:
                    customer.delete()
                print(f"  ✓ Deleted {customer_count} customers")
        
        print("\n✓ Cleanup completed successfully!")
    else:
        print("\n" + "="*80)
        print("DRY RUN - No changes made")
        print("="*80)
        print(f"Would delete: {order_count} orders and {customer_count} customers")
        print("\nRun with --live to actually delete the data")
    
    return {
        'orders_found': order_count,
        'customers_found': customer_count
    }


# ============================================================================
# CLI
# ============================================================================

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Cleanup failed legacy import')
    parser.add_argument('--live', action='store_true', help='Actually delete data (default is dry-run)')
    
    args = parser.parse_args()
    
    if args.live:
        print("\n" + "!"*80)
        print("WARNING: LIVE DELETION MODE")
        print("This will permanently delete imported orders and customers!")
        print("!"*80)
        confirm = input("\nType 'DELETE' to confirm: ")
        if confirm != 'DELETE':
            print("Aborted.")
            sys.exit(1)
    
    cleanup_failed_import(dry_run=not args.live)
