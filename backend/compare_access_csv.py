"""
Vergleicht die Access-CSV (Auftragsname-Auftrags-ID.csv) mit den VERP-Auftraegen.
Zeigt Diskrepanzen bei Nummern und findet Blockierungs-Ursachen.
"""
import os
import sys
import csv

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')

import django
django.setup()

from customer_orders.models import CustomerOrder

CSV_PATH = r"C:\Users\mdunk\Documents\VERP\Datenvorlagen\AccessAufträge\Auftragsname-Auftrags-ID.csv"

# ===== 1. CSV einlesen =====
csv_map = {}  # auftrags_id -> correct_order_number
csv_rows = []
with open(CSV_PATH, encoding='cp1252', newline='') as f:
    reader = csv.DictReader(f, delimiter=';')
    for row in reader:
        auftrags_id_str = row.get('AuftragsID', '').strip()
        order_number = row.get('Auftrags Nr.', '').strip()
        if auftrags_id_str.isdigit() and order_number:
            auftrags_id = int(auftrags_id_str)
            csv_map[auftrags_id] = order_number
            csv_rows.append((auftrags_id, order_number, row))

print(f"CSV: {len(csv_map)} Eintraege mit gueltiger AuftragsID")
print(f"CSV AuftragsID-Bereich: {min(csv_map)} - {max(csv_map)}")

# ===== 2. VERP-Auftraege laden =====
verp_orders = list(CustomerOrder.objects.filter(
    legacy_auftrags_id__isnull=False
).select_related('customer').values(
    'pk', 'order_number', 'legacy_auftrags_id', 'legacy_adressen_id', 'customer__id', 'customer__last_name'
))
print(f"\nVERP: {len(verp_orders)} Auftraege mit legacy_auftrags_id")

# Alle VERP-Nummern (inkl. ohne auftrags_id)
all_verp_numbers = set(
    CustomerOrder.objects.values_list('order_number', flat=True)
)
print(f"VERP gesamt: {CustomerOrder.objects.count()} Auftraege")
print(f"VERP ohne legacy_auftrags_id: {CustomerOrder.objects.filter(legacy_auftrags_id__isnull=True).count()}")

# ===== 3. Vergleich =====
auftrags_id_to_verp = {o['legacy_auftrags_id']: o for o in verp_orders}

correct = 0
wrong_number = []
not_in_verp = []
not_in_csv = []

for auftrags_id, correct_nr in sorted(csv_map.items()):
    verp_order = auftrags_id_to_verp.get(auftrags_id)
    if verp_order is None:
        not_in_verp.append((auftrags_id, correct_nr))
    elif verp_order['order_number'] == correct_nr:
        correct += 1
    else:
        wrong_number.append({
            'auftrags_id': auftrags_id,
            'correct': correct_nr,
            'current': verp_order['order_number'],
            'customer': verp_order['customer__last_name'],
            'pk': verp_order['pk'],
        })

for o in verp_orders:
    if o['legacy_auftrags_id'] not in csv_map:
        not_in_csv.append(o)

print(f"\n===== ERGEBNIS =====")
print(f"Korrekte Nummern:      {correct}")
print(f"Falsche Nummern:       {len(wrong_number)}")
print(f"In CSV aber nicht VERP: {len(not_in_verp)}")
print(f"In VERP aber nicht CSV: {len(not_in_csv)}")

# ===== 4. Blockierungs-Analyse =====
print(f"\n===== BLOCKIERUNGEN =====")
# Welche Nummern sind blockiert?
# Eine Ziel-Nummer ist blockiert wenn sie von einem VERP-Auftrag besetzt ist
# der selbst NICHT umbenannt wird (weil er schon "korrekt" laut CSV ist)

target_numbers = {w['correct'] for w in wrong_number}
source_numbers = {w['current'] for w in wrong_number}

# Nummern die als Ziel gewuenscht sind UND von einem nicht-betroffenen Auftrag besetzt
blocked = []
for w in wrong_number:
    if w['correct'] in all_verp_numbers and w['correct'] not in source_numbers:
        # Wessen Nummer ist das?
        holder = CustomerOrder.objects.filter(order_number=w['correct']).values(
            'legacy_auftrags_id', 'order_number', 'customer__last_name'
        ).first()
        blocked.append({
            'wants': w['correct'],
            'currently_is': w['current'],
            'auftrags_id': w['auftrags_id'],
            'holder_id': holder['legacy_auftrags_id'] if holder else None,
            'holder_name': holder['customer__last_name'] if holder else None,
        })

print(f"Blockierte Umbenennungen: {len(blocked)}")

if blocked:
    print("\nBeispiele (erste 20):")
    for b in blocked[:20]:
        print(f"  AuftragsID {b['auftrags_id']:5d}: will {b['wants']} "
              f"(belegt von AuftragsID={b['holder_id']}, {b['holder_name']})")

# ===== 5. Falsche Nummern - Beispiele =====
if wrong_number:
    print(f"\nFalsche Nummern - erste 20:")
    for w in wrong_number[:20]:
        print(f"  AuftragsID {w['auftrags_id']:5d}: VERP={w['current']:15s} -> Soll={w['correct']:15s}  ({w['customer']})")

# ===== 6. Duplikat-Nummern in CSV =====
print(f"\n===== DUPLIKAT-ANALYSE =====")
from collections import Counter
nr_counts = Counter(csv_map.values())
dupes = {nr: count for nr, count in nr_counts.items() if count > 1}
print(f"Gleiche Nummern mehrfach in CSV: {len(dupes)}")
if dupes:
    for nr, count in list(dupes.items())[:10]:
        ids = [aid for aid, n in csv_map.items() if n == nr]
        print(f"  {nr}: {count}x (AuftragsIDs: {ids[:5]})")

# ===== 7. Kollisionen in VERP =====
verp_nr_counts = Counter(o['order_number'] for o in verp_orders)
verp_dupes = {nr: count for nr, count in verp_nr_counts.items() if count > 1}
print(f"\nGleiche Nummern mehrfach in VERP (mit legacy_id): {len(verp_dupes)}")
if verp_dupes:
    for nr, count in list(verp_dupes.items())[:10]:
        holders = [o for o in verp_orders if o['order_number'] == nr]
        print(f"  {nr}: {count}x (AuftragsIDs: {[h['legacy_auftrags_id'] for h in holders]})")
