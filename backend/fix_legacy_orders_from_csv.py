"""
Bereinigt Legacy-Auftraege anhand der Access-CSV:
1. Loescht doppelte VERP-Auftraege (gleiche legacy_auftrags_id)
2. Benennt alle Auftraege nach der CSV um (direktes Mapping ID -> Nummer)

Ausfuehrung:
    python fix_legacy_orders_from_csv.py [--execute]

Ohne --execute: Dry-Run (zeigt was gemacht wuerde)
Mit --execute: Aenderungen werden tatsaechlich durchgefuehrt
"""
import os
import sys
import csv as csvlib
from collections import defaultdict

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()

from django.db import transaction
from customer_orders.models import CustomerOrder, CustomerOrderItem

CSV_PATH = r"C:\Users\mdunk\Documents\VERP\Datenvorlagen\AccessAufträge\Auftragsname-Auftrags-ID.csv"

DRY_RUN = '--execute' not in sys.argv

print(f"{'=== DRY RUN ===' if DRY_RUN else '=== EXECUTE ==='}")
print()

# ===== 1. CSV einlesen =====
csv_map = {}  # auftrags_id -> correct_order_number
with open(CSV_PATH, encoding='cp1252', newline='') as f:
    reader = csvlib.DictReader(f, delimiter=';')
    for row in reader:
        aid_str = row.get('AuftragsID', '').strip()
        nr = row.get('Auftrags Nr.', '').strip()
        if aid_str.isdigit() and nr:
            csv_map[int(aid_str)] = nr

print(f"CSV: {len(csv_map)} Eintraege (AuftragsID -> Nummer)")

# ===== 2. Duplikate finden und bereinigen =====
from django.db.models import Count

dupe_ids = list(
    CustomerOrder.objects
    .filter(legacy_auftrags_id__isnull=False)
    .values('legacy_auftrags_id')
    .annotate(cnt=Count('id'))
    .filter(cnt__gt=1)
    .values_list('legacy_auftrags_id', flat=True)
)

print(f"\n>>> PHASE 1: Duplikate bereinigen ({len(dupe_ids)} AuftragsIDs doppelt vergeben)")

to_delete_pks = []
kept_info = []

for aid in sorted(dupe_ids):
    orders = list(
        CustomerOrder.objects
        .filter(legacy_auftrags_id=aid)
        .prefetch_related('items')
    )
    correct_nr = csv_map.get(aid)

    # Bestimme welchen behalten: bevorzuge den mit MEHR Positionen (mehr Daten),
    # bei Gleichstand den mit korrekter CSV-Nummer.
    # Die Nummer wird danach ohnehin per CSV korrigiert.
    def score(o):
        item_count = o.items.count()
        nr_match = 1 if (correct_nr and o.order_number == correct_nr) else 0
        return (item_count, nr_match)

    orders.sort(key=score, reverse=True)
    keep = orders[0]
    delete_orders = orders[1:]

    for d in delete_orders:
        items = d.items.count()
        to_delete_pks.append(d.pk)
        kept_info.append({
            'aid': aid,
            'keep_nr': keep.order_number,
            'keep_items': keep.items.count(),
            'delete_nr': d.order_number,
            'delete_items': items,
        })
        print(f"  AuftragsID {aid:5d}: BEHALTEN={keep.order_number} ({keep.items.count()} Pos.)  "
              f"LOESCHEN={d.order_number} ({items} Pos.)  CSV-Soll={correct_nr or 'unbekannt'}")

print(f"\n  => {len(to_delete_pks)} Auftraege werden geloescht")

if not DRY_RUN and to_delete_pks:
    with transaction.atomic():
        deleted_count, _ = CustomerOrder.objects.filter(pk__in=to_delete_pks).delete()
        print(f"  => {deleted_count} Auftraege geloescht!")
elif DRY_RUN:
    print("  => (Dry-Run, nichts geloescht)")

# ===== 3. Alle Auftraege nach CSV umbenennen =====
print(f"\n>>> PHASE 2: Auftraege nach CSV umbenennen")

# Neu laden (nach Duplikat-Loeschung)
if DRY_RUN:
    # Im Dry-Run: ausschliessen was geloescht worden waere
    legacy_orders = list(
        CustomerOrder.objects
        .filter(legacy_auftrags_id__isnull=False)
        .exclude(pk__in=to_delete_pks)
        .values('pk', 'order_number', 'legacy_auftrags_id')
    )
else:
    legacy_orders = list(
        CustomerOrder.objects
        .filter(legacy_auftrags_id__isnull=False)
        .values('pk', 'order_number', 'legacy_auftrags_id')
    )

print(f"  Auftraege mit legacy_id: {len(legacy_orders)}")

renames = []  # (pk, old_nr, new_nr)
already_correct = 0
no_csv_entry = 0

for o in legacy_orders:
    correct_nr = csv_map.get(o['legacy_auftrags_id'])
    if not correct_nr:
        no_csv_entry += 1
        continue
    if o['order_number'] == correct_nr:
        already_correct += 1
    else:
        renames.append((o['pk'], o['order_number'], correct_nr))

print(f"  Bereits korrekt: {already_correct}")
print(f"  Kein CSV-Eintrag: {no_csv_entry}")
print(f"  Umzubenennen: {len(renames)}")

# Kollisions-Check: Ziel-Nummer bereits von einem nicht-betroffenen Auftrag belegt?
target_numbers = {new for _, _, new in renames}
source_pks = {pk for pk, _, _ in renames}

blocked_numbers = set(
    CustomerOrder.objects
    .filter(order_number__in=target_numbers)
    .exclude(pk__in=source_pks)
    .values_list('order_number', flat=True)
)

# Im Dry-Run: zu loeschende auch aus blocker-liste entfernen
if DRY_RUN and to_delete_pks:
    deleted_numbers = set(
        CustomerOrder.objects
        .filter(pk__in=to_delete_pks, order_number__in=blocked_numbers)
        .values_list('order_number', flat=True)
    )
    blocked_numbers -= deleted_numbers

if blocked_numbers:
    print(f"\n  WARNUNG: {len(blocked_numbers)} Nummern noch blockiert:")
    for nr in sorted(blocked_numbers)[:10]:
        holder = CustomerOrder.objects.filter(order_number=nr).values('legacy_auftrags_id', 'pk').first()
        print(f"    {nr}  (legacy_id={holder['legacy_auftrags_id'] if holder else '?'})")

# Ausfuehrung
renamed = 0
errors = []

if not DRY_RUN and renames:
    # Neu berechnen nach Phase 1 (Loeschung bereits committed)
    target_numbers = {new for _, _, new in renames}
    source_pks = {pk for pk, _, _ in renames}
    blocked_numbers = set(
        CustomerOrder.objects
        .filter(order_number__in=target_numbers)
        .exclude(pk__in=source_pks)
        .values_list('order_number', flat=True)
    )
    if blocked_numbers:
        print(f"\n  Blockiert nach Phase 1: {len(blocked_numbers)}")
        for nr in sorted(blocked_numbers)[:10]:
            holder = CustomerOrder.objects.filter(order_number=nr).values('pk', 'legacy_auftrags_id').first()
            print(f"    {nr}  (pk={holder['pk'] if holder else '?'}, legacy_id={holder['legacy_auftrags_id'] if holder else '?'})")

    valid_renames = [(pk, old, new) for pk, old, new in renames if new not in blocked_numbers]
    print(f"\n  Gueltiger Umbenennungen: {len(valid_renames)} (von {len(renames)})")

    # Phase A: Alle auf temp-Nummern (einzelne Savepoints)
    temp_set = set()
    for pk, old_nr, new_nr in valid_renames:
        try:
            with transaction.atomic():
                CustomerOrder.objects.filter(pk=pk).update(order_number=f"_R_{pk}")
                temp_set.add(pk)
        except Exception as e:
            errors.append(f"TempRename {old_nr}: {e}")

    # Phase B: Temp-Nummern auf korrekte Nummern (einzelne Savepoints)
    for pk, old_nr, new_nr in valid_renames:
        if pk not in temp_set:
            continue
        try:
            with transaction.atomic():
                CustomerOrder.objects.filter(pk=pk).update(order_number=new_nr)
                renamed += 1
        except Exception as e:
            errors.append(f"{old_nr} -> {new_nr}: {e}")
            try:
                with transaction.atomic():
                    CustomerOrder.objects.filter(pk=pk).update(order_number=old_nr)
            except Exception:
                errors.append(f"  Rollback fehlgeschlagen fuer pk={pk}")

    print(f"\n  => {renamed} Auftraege umbenannt")
    if errors:
        print(f"  => {len(errors)} Fehler:")
        for e in errors[:20]:
            print(f"    {e}")
else:
    # Dry-Run
    valid_renames = [(pk, o, n) for pk, o, n in renames if n not in blocked_numbers]
    print(f"\n  => Wuerde {len(valid_renames)} Auftraege umbenennen "
          f"({len(blocked_numbers)} blockiert)")
    for _, old, new in valid_renames[:15]:
        print(f"    {old:18s} -> {new}")
    if len(valid_renames) > 15:
        print(f"    ... ({len(valid_renames) - 15} weitere)")

# ===== 4. Zusammenfassung =====
print(f"\n===== ZUSAMMENFASSUNG =====")
print(f"Phase 1 - Duplikate loeschen: {len(to_delete_pks)}")
if DRY_RUN:
    valid_renames_count = len([r for r in renames if r[2] not in blocked_numbers])
    print(f"Phase 2 - Umbenennen:         {valid_renames_count} (von {len(renames)})")
    print(f"Noch blockiert:               {len(blocked_numbers)}")
    print()
    print("Starte mit: python fix_legacy_orders_from_csv.py --execute")
else:
    print(f"Phase 2 - Umbenannt:          {renamed}")
    print(f"Fehler:                       {len(errors)}")
