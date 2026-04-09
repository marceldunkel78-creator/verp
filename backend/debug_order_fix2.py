"""Debug: Find which AuftragsID should generate O-373-12/00 and check mismatches."""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from customer_orders.models import CustomerOrder
from customers.models import CustomerLegacyMapping
from verp_settings.customer_sync import get_mssql_connection
from verp_settings.order_import import generate_legacy_order_numbers, fetch_auftraege, _parse_date

conn = get_mssql_connection('192.168.0.2\\SQLEXPRESS,1433', 'VSDB')
auftraege = fetch_auftraege(conn, limit=None)

order_numbers = generate_legacy_order_numbers(auftraege)

# Find which AuftragsID generates O-373-12/00
target = 'O-373-12/00'
for aid, info in order_numbers.items():
    if info['order_number'] == target:
        print(f"Korrekte Zuordnung: {target} -> AuftragsID {aid}")
        # Find SQL row
        for row in auftraege:
            if row.get('AuftragsID') == aid:
                print(f"  AdressenID: {row.get('AdressenID')}")
                print(f"  Datum: {row.get('Datum')}")
                print(f"  Auftragsdatum: {row.get('Auftragsdatum')}")
                print(f"  Kurzbeschreibung: {row.get('Kurzbeschreibung')}")
                # Check customer mapping
                adr_id = row.get('AdressenID')
                mapping = CustomerLegacyMapping.objects.filter(sql_id=adr_id).select_related('customer').first()
                if mapping:
                    print(f"  -> Korrekter Kunde: {mapping.customer}")
                break
        break

# What does AuftragsID 1082 generate?
info_1082 = order_numbers.get(1082)
if info_1082:
    print(f"\nAuftragsID 1082 -> {info_1082['order_number']}")

# Now check: how many VERP orders have wrong AuftragsID assignment?
# i.e., order_number doesn't match what generate_legacy_order_numbers would produce
print("\n=== Mismatched AuftragsID assignments ===")
mismatched = 0
total = 0
examples = []

legacy_orders = CustomerOrder.objects.filter(
    legacy_auftrags_id__isnull=False,
    order_number__startswith='O-',
).order_by('order_number')

for order in legacy_orders:
    total += 1
    correct_info = order_numbers.get(order.legacy_auftrags_id)
    if not correct_info:
        continue
    correct_number = correct_info['order_number']
    if order.order_number != correct_number:
        mismatched += 1
        if len(examples) < 10:
            examples.append(f"  {order.order_number} hat AuftragsID={order.legacy_auftrags_id} -> sollte {correct_number} sein")

print(f"Total: {total}")
print(f"Mismatched (Nummer != erwartet): {mismatched}")
for ex in examples:
    print(ex)

# Check: how many orders have legacy_adressen_id that doesn't match SQL AdressenID?
sql_by_id = {row.get('AuftragsID'): row for row in auftraege}
wrong_adr = 0
wrong_adr_examples = []

for order in legacy_orders:
    sql_row = sql_by_id.get(order.legacy_auftrags_id)
    if not sql_row:
        continue
    sql_adr = sql_row.get('AdressenID')
    if order.legacy_adressen_id and sql_adr and order.legacy_adressen_id != sql_adr:
        wrong_adr += 1
        if len(wrong_adr_examples) < 5:
            wrong_adr_examples.append(f"  {order.order_number}: VERP adr={order.legacy_adressen_id} vs SQL adr={sql_adr}")

print(f"\nWrong legacy_adressen_id (vs SQL): {wrong_adr}")
for ex in wrong_adr_examples:
    print(ex)

conn.close()
