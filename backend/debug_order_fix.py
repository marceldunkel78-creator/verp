"""Debug: Check specific order O-373-12/00 and its SQL data."""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from customer_orders.models import CustomerOrder
from customers.models import CustomerLegacyMapping
from verp_settings.customer_sync import get_mssql_connection
from verp_settings.order_import import _parse_date

# Check the VERP order
orders = CustomerOrder.objects.filter(order_number='O-373-12/00').select_related('customer')
for o in orders:
    print(f"VERP Order: {o.order_number}")
    print(f"  PK: {o.pk}")
    print(f"  legacy_auftrags_id: {o.legacy_auftrags_id}")
    print(f"  legacy_adressen_id: {o.legacy_adressen_id}")
    print(f"  customer: {o.customer} (id={o.customer_id})")
    print(f"  confirmation_date: {o.confirmation_date}")
    print(f"  order_date: {o.order_date}")
    print(f"  system_reference: {o.system_reference}")
    print()

# Check SQL data for this AuftragsID
if orders and orders[0].legacy_auftrags_id:
    aid = orders[0].legacy_auftrags_id
    conn = get_mssql_connection('192.168.0.2\\SQLEXPRESS,1433', 'VSDB')
    cursor = conn.cursor()
    cursor.execute(f"SELECT AuftragsID, AdressenID, Datum, Auftragsdatum, Kurzbeschreibung, Jahr FROM Aufträge WHERE AuftragsID = {aid}")
    row = cursor.fetchone()
    if row:
        print(f"SQL AuftragsID={row[0]}")
        print(f"  AdressenID: {row[1]}")
        print(f"  Datum (Bestätigung): {row[2]}")
        print(f"  Auftragsdatum: {row[3]}")
        print(f"  Kurzbeschreibung: {row[4]}")
        print(f"  Jahr: {row[5]}")
        
        # Check which customer this AdressenID maps to
        adr_id = row[1]
        mapping = CustomerLegacyMapping.objects.filter(sql_id=adr_id).select_related('customer').first()
        if mapping:
            print(f"  -> VERP Customer: {mapping.customer} (id={mapping.customer_id})")
        else:
            print(f"  -> No CustomerLegacyMapping for AdressenID {adr_id}")
        
        # Check address name
        cursor.execute(f"SELECT Firma, Name, Vorname FROM Adressen WHERE AdressenID = {adr_id}")
        addr = cursor.fetchone()
        if addr:
            print(f"  -> SQL Address: Firma={addr[0]}, Name={addr[1]}, Vorname={addr[2]}")
    
    # Also check: what does the current legacy_adressen_id on the order map to?
    if orders[0].legacy_adressen_id:
        wrong_adr = orders[0].legacy_adressen_id
        cursor.execute(f"SELECT Firma, Name, Vorname FROM Adressen WHERE AdressenID = {wrong_adr}")
        addr2 = cursor.fetchone()
        if addr2:
            print(f"\nWrong AdressenID {wrong_adr}: Firma={addr2[0]}, Name={addr2[1]}, Vorname={addr2[2]}")
        wrong_map = CustomerLegacyMapping.objects.filter(sql_id=wrong_adr).select_related('customer').first()
        if wrong_map:
            print(f"  -> Maps to: {wrong_map.customer} (id={wrong_map.customer_id})")
    
    conn.close()
else:
    print("Order not found or no legacy_auftrags_id")

# Also check: how many orders still have wrong dates?
print("\n=== Date mismatch check (sample) ===")
conn = get_mssql_connection('192.168.0.2\\SQLEXPRESS,1433', 'VSDB')
cursor = conn.cursor()

wrong_dates = 0
wrong_customers = 0
checked = 0
examples = []

legacy_orders = CustomerOrder.objects.filter(
    legacy_auftrags_id__isnull=False
).select_related('customer')[:100]

for order in legacy_orders:
    cursor.execute(f"SELECT AdressenID, Datum, Auftragsdatum FROM Aufträge WHERE AuftragsID = {order.legacy_auftrags_id}")
    row = cursor.fetchone()
    if not row:
        continue
    checked += 1
    
    sql_adr_id = row[0]
    sql_datum = row[1].date() if row[1] else None
    sql_auftragsdatum = row[2].date() if row[2] else None
    
    date_wrong = False
    if sql_datum and order.confirmation_date != sql_datum:
        date_wrong = True
        wrong_dates += 1
    
    # Check customer
    correct_mapping = CustomerLegacyMapping.objects.filter(sql_id=sql_adr_id).first()
    customer_wrong = False
    if correct_mapping and order.customer_id != correct_mapping.customer_id:
        customer_wrong = True
        wrong_customers += 1
    
    if (date_wrong or customer_wrong) and len(examples) < 5:
        examples.append({
            'order': order.order_number,
            'conf_date': f"{order.confirmation_date} vs SQL {sql_datum}" if date_wrong else "OK",
            'customer': f"{order.customer} vs mapping {correct_mapping.customer if correct_mapping else '?'}" if customer_wrong else "OK",
            'adr_id_order': order.legacy_adressen_id,
            'adr_id_sql': sql_adr_id,
        })

print(f"Checked: {checked}")
print(f"Wrong dates: {wrong_dates}")
print(f"Wrong customers: {wrong_customers}")
for ex in examples:
    print(f"  {ex['order']}: date={ex['conf_date']}, customer={ex['customer']}, adr_order={ex['adr_id_order']}, adr_sql={ex['adr_id_sql']}")

conn.close()
