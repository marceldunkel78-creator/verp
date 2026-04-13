"""
Loescht doppelte Legacy-Auftraege (gleiche legacy_auftrags_id).
Behaelt pro Gruppe den Auftrag mit der niedrigsten PK (aeltester Import).

Ausfuehrung:
    python delete_duplicate_legacy_orders.py            # Dry-Run
    python delete_duplicate_legacy_orders.py --execute   # Wirklich loeschen
"""
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()

from django.db import transaction
from django.db.models import Count, Min
from customer_orders.models import CustomerOrder

DRY_RUN = '--execute' not in sys.argv
print(f"{'=== DRY RUN ===' if DRY_RUN else '=== EXECUTE ==='}\n")

# Duplikat-Gruppen finden
dupes = list(
    CustomerOrder.objects
    .filter(legacy_auftrags_id__isnull=False)
    .values('legacy_auftrags_id')
    .annotate(cnt=Count('id'), min_pk=Min('id'))
    .filter(cnt__gt=1)
)

print(f"Duplikat-Gruppen: {len(dupes)}")

to_delete_pks = []
for d in dupes:
    aid = d['legacy_auftrags_id']
    orders = list(
        CustomerOrder.objects
        .filter(legacy_auftrags_id=aid)
        .order_by('pk')
        .values('pk', 'order_number')
    )
    keep = orders[0]
    for drop in orders[1:]:
        items = CustomerOrder.objects.get(pk=drop['pk']).items.count()
        to_delete_pks.append(drop['pk'])
        print(f"  AuftragsID {aid:5d}: BEHALTEN pk={keep['pk']} {keep['order_number']}  "
              f"LOESCHEN pk={drop['pk']} {drop['order_number']} ({items} Pos.)")

print(f"\nZu loeschen: {len(to_delete_pks)} Auftraege")

if not DRY_RUN and to_delete_pks:
    with transaction.atomic():
        deleted, details = CustomerOrder.objects.filter(pk__in=to_delete_pks).delete()
        print(f"Geloescht: {deleted} Objekte")
        for model, count in details.items():
            print(f"  {model}: {count}")
elif DRY_RUN:
    print("\n=> Dry-Run, nichts geloescht.")
    print("=> Starte mit: python delete_duplicate_legacy_orders.py --execute")
else:
    print("\nKeine Duplikate gefunden.")
