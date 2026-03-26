#!/usr/bin/env python
"""
Bereinigung des fehlerhaften Auftragsimports vom 26.03.2026
===========================================================

Löscht die 34 Aufträge O-109-01/26 bis O-142-03/26, die durch den
fehlerhaften Import mit instabiler Sortierung entstanden sind.

O-109-01/26 war ein Duplikat von O-108-01/26, und alle folgenden Nummern
waren dadurch um eins verschoben.

Die korrekt importierten Aufträge O-101-01/26 bis O-108-01/26 (Batch vom
12.02.2026) bleiben erhalten.

Verwendung:
    python cleanup_order_import_2026.py          # Dry-Run (keine Änderungen)
    python cleanup_order_import_2026.py --live    # Tatsächlich löschen
"""
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')

import django
django.setup()

from django.db import transaction
from customer_orders.models import CustomerOrder, CustomerOrderItem

# Die fehlerhaften Auftragsnummern (Batch vom 26.03.2026)
BAD_ORDER_NUMBERS = [
    'O-109-01/26', 'O-110-01/26', 'O-111-01/26', 'O-112-01/26',
    'O-113-01/26', 'O-114-01/26', 'O-115-01/26', 'O-116-01/26',
    'O-117-02/26', 'O-118-02/26', 'O-119-02/26', 'O-120-02/26',
    'O-121-02/26', 'O-122-02/26', 'O-123-02/26', 'O-124-02/26',
    'O-125-02/26', 'O-126-02/26', 'O-127-02/26', 'O-128-02/26',
    'O-129-02/26', 'O-130-02/26', 'O-131-02/26', 'O-132-03/26',
    'O-133-03/26', 'O-134-03/26', 'O-135-03/26', 'O-136-03/26',
    'O-137-03/26', 'O-138-03/26', 'O-139-03/26', 'O-140-03/26',
    'O-141-03/26', 'O-142-03/26',
]


def cleanup(dry_run=True):
    print("=" * 70)
    print("BEREINIGUNG FEHLERHAFTER AUFTRAGSIMPORT 26.03.2026")
    print("=" * 70)
    print(f"Modus: {'DRY-RUN (keine Änderungen)' if dry_run else 'LIVE (Daten werden gelöscht!)'}")
    print()

    orders = CustomerOrder.objects.filter(order_number__in=BAD_ORDER_NUMBERS)
    found_numbers = set(orders.values_list('order_number', flat=True))

    print(f"Gesuchte Aufträge:  {len(BAD_ORDER_NUMBERS)}")
    print(f"Gefunden in DB:     {len(found_numbers)}")
    print()

    if not found_numbers:
        print("Keine fehlerhaften Aufträge gefunden. Nichts zu tun.")
        return

    # Details anzeigen
    print(f"{'Auftragsnr.':<20} {'Datum':<12} {'Kunde':<50} {'Pos.'}")
    print("-" * 90)
    for o in orders.order_by('order_number'):
        cust = o.customer
        if cust:
            cust_str = f"{cust.customer_number} - {cust}"
        elif o.legacy_customer_company:
            cust_str = f"Legacy: {o.legacy_customer_company}"
        else:
            cust_str = "Kein Kunde"
        item_count = o.items.count()
        print(f"{o.order_number:<20} {str(o.order_date):<12} {cust_str[:50]:<50} {item_count}")

    order_ids = list(orders.values_list('id', flat=True))
    item_count = CustomerOrderItem.objects.filter(order_id__in=order_ids).count()

    print()
    print(f"Aufträge zu löschen:   {len(order_ids)}")
    print(f"Positionen zu löschen: {item_count}")

    not_found = set(BAD_ORDER_NUMBERS) - found_numbers
    if not_found:
        print()
        print(f"Bereits gelöscht / nicht vorhanden ({len(not_found)}):")
        for nr in sorted(not_found):
            print(f"  {nr}")

    if dry_run:
        print()
        print("=" * 70)
        print("DRY-RUN: Keine Daten wurden geändert.")
        print("Zum Löschen ausführen mit:  python cleanup_order_import_2026.py --live")
        print("=" * 70)
        return

    # Sicherheitsabfrage
    print()
    confirm = input("Sicher löschen? Eingabe 'ja' zum Bestätigen: ")
    if confirm.strip().lower() != 'ja':
        print("Abgebrochen.")
        return

    with transaction.atomic():
        items_deleted = CustomerOrderItem.objects.filter(order_id__in=order_ids).delete()
        orders_deleted = orders.delete()

        print()
        print(f"Positionen gelöscht: {items_deleted[0]}")
        print(f"Aufträge gelöscht:   {orders_deleted[0]}")

    # Verifizierung
    remaining = CustomerOrder.objects.filter(
        order_number__startswith='O-',
        order_number__endswith='/26'
    ).order_by('order_number')
    print()
    print(f"Verbleibende 2026-Aufträge: {remaining.count()}")
    for o in remaining:
        print(f"  {o.order_number}")

    print()
    print("Bereinigung abgeschlossen.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Bereinigung fehlerhafter Aufträge vom 26.03.2026')
    parser.add_argument('--live', action='store_true', help='Tatsächlich löschen (Standard: Dry-Run)')
    args = parser.parse_args()
    cleanup(dry_run=not args.live)
