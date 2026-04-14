"""Zeigt welche Auftraege beim Renumber blockiert sind und warum."""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()

from verp_settings.order_import import (
    get_mssql_connection, fetch_auftraege, generate_legacy_order_numbers,
)
from customer_orders.models import CustomerOrder

SERVER = r'192.168.0.2\SQLEXPRESS,1433'
DATABASE = 'VSDB'

print("Lade SQL-Daten...")
conn = get_mssql_connection(SERVER, DATABASE)
try:
    auftraege = fetch_auftraege(conn, limit=None)
finally:
    conn.close()

# AngebotNummer -> SQL row
sql_by_id = {r['AuftragsID']: r for r in auftraege}
correct_numbers = {}
for aid, info in generate_legacy_order_numbers(auftraege).items():
    nr = info.get('order_number')
    if nr:
        correct_numbers[aid] = nr

print(f"SQL: {len(auftraege)} Auftraege, {len(correct_numbers)} mit Nummer")

# VERP Auftraege mit legacy_auftrags_id
legacy_orders = list(CustomerOrder.objects.filter(
    legacy_auftrags_id__isnull=False
).values('pk', 'order_number', 'legacy_auftrags_id'))

print(f"VERP: {len(legacy_orders)} Auftraege mit legacy_auftrags_id")

renames = []
already_correct = 0
no_sql = 0
for o in legacy_orders:
    correct = correct_numbers.get(o['legacy_auftrags_id'])
    if not correct:
        no_sql += 1
        continue
    if o['order_number'] == correct:
        already_correct += 1
    else:
        renames.append((o['pk'], o['order_number'], correct))

source_pks = {pk for pk, _, _ in renames}
target_numbers = {new for _, _, new in renames}

blockers = list(
    CustomerOrder.objects.filter(
        order_number__in=target_numbers
    ).exclude(pk__in=source_pks)
    .values('pk', 'order_number', 'legacy_auftrags_id')
)

print(f"\nAlready correct: {already_correct}, No SQL match: {no_sql}")
print(f"Renames: {len(renames)}, Blocked by: {len(blockers)} Auftraege")
print()

blocker_map = {b['order_number']: b for b in blockers}

# Zeige alle blockierten Paare
blocked_renames = [(pk, old, new) for pk, old, new in renames if new in blocker_map]
free_renames = [(pk, old, new) for pk, old, new in renames if new not in blocker_map]

print(f"=== FREIE UMBENENNUNGEN ({len(free_renames)}) ===")
for pk, old, new in free_renames:
    print(f"  {old:22s} -> {new}")

print(f"\n=== BLOCKIERTE UMBENENNUNGEN ({len(blocked_renames)}) ===")
for pk, old, new in sorted(blocked_renames, key=lambda x: x[2]):
    b = blocker_map[new]
    b_correct = correct_numbers.get(b['legacy_auftrags_id'])
    b_has_lid = b['legacy_auftrags_id'] is not None
    src_row = sql_by_id.get(next(
        (o['legacy_auftrags_id'] for o in legacy_orders if o['pk'] == pk), None
    ))
    angebot_nr = src_row.get('AngebotNummer') if src_row else '?'
    print(f"  Quelle: pk={pk:6d} {old:22s}  -> Ziel: {new}  (AngebotNr={angebot_nr})")
    print(f"  Blocker: pk={b['pk']:6d} {b['order_number']:22s}  legacy_id={b['legacy_auftrags_id']}  "
          f"korrekte Ziel={b_correct or 'KEIN SQL'}  hat_lid={b_has_lid}")
    print()

# Zusammenfassung der Blocker-Typen
print("=== BLOCKER-TYPEN ===")
blocker_correct_at_target = sum(
    1 for b in blockers
    if b['legacy_auftrags_id'] and correct_numbers.get(b['legacy_auftrags_id']) == b['order_number']
)
blocker_wrong_number = sum(
    1 for b in blockers
    if b['legacy_auftrags_id'] and correct_numbers.get(b['legacy_auftrags_id']) and
       correct_numbers.get(b['legacy_auftrags_id']) != b['order_number']
)
blocker_no_lid = sum(1 for b in blockers if b['legacy_auftrags_id'] is None)
blocker_no_sql = sum(
    1 for b in blockers
    if b['legacy_auftrags_id'] and not correct_numbers.get(b['legacy_auftrags_id'])
)
print(f"  Blocker korrekt an Zielnummer (echter Konflikt): {blocker_correct_at_target}")
print(f"  Blocker selbst falsch platziert (aber nicht in rename-Liste): {blocker_wrong_number}")
print(f"  Blocker ohne legacy_auftrags_id (Orphan):        {blocker_no_lid}")
print(f"  Blocker mit legacy_id aber kein SQL-Match:       {blocker_no_sql}")
