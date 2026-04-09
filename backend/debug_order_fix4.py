"""Check: how many VERP orders still have wrong dates/customers vs SQL."""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from customer_orders.models import CustomerOrder
from customers.models import CustomerLegacyMapping
from verp_settings.customer_sync import get_mssql_connection
from verp_settings.order_import import _parse_date

conn = get_mssql_connection('192.168.0.2\\SQLEXPRESS,1433', 'VSDB')
cursor = conn.cursor()

# Load all SQL orders into dict
cursor.execute("SELECT AuftragsID, AdressenID, Datum, Auftragsdatum FROM Aufträge")
sql_data = {}
for row in cursor.fetchall():
    sql_data[row[0]] = {
        'adressen_id': row[1],
        'datum': row[2].date() if row[2] else None,
        'auftragsdatum': row[3].date() if row[3] else None,
    }

# Load all customer legacy mappings
all_mappings = {}
for m in CustomerLegacyMapping.objects.select_related('customer').all():
    all_mappings[m.sql_id] = m

# Check all VERP legacy orders
legacy_orders = CustomerOrder.objects.filter(
    legacy_auftrags_id__isnull=False,
).select_related('customer')

wrong_conf_date = 0
wrong_ord_date = 0
wrong_customer = 0
wrong_adressen_id = 0
conf_date_is_auftragsdatum = 0
total = 0
examples_date = []
examples_customer = []

for order in legacy_orders:
    total += 1
    sql = sql_data.get(order.legacy_auftrags_id)
    if not sql:
        continue
    
    # Check confirmation_date (should be SQL Datum)
    if sql['datum'] and order.confirmation_date and order.confirmation_date != sql['datum']:
        wrong_conf_date += 1
        if sql['auftragsdatum'] and order.confirmation_date == sql['auftragsdatum']:
            conf_date_is_auftragsdatum += 1
        if len(examples_date) < 5:
            examples_date.append(
                f"  {order.order_number}: conf_date={order.confirmation_date} "
                f"(SQL Datum={sql['datum']}, Auftragsdatum={sql['auftragsdatum']})"
            )
    
    # Check order_date (should be SQL Auftragsdatum)
    if sql['auftragsdatum'] and order.order_date and order.order_date != sql['auftragsdatum']:
        wrong_ord_date += 1
    
    # Check customer (should match SQL AdressenID mapping)
    correct_mapping = all_mappings.get(sql['adressen_id'])
    if correct_mapping and order.customer_id and order.customer_id != correct_mapping.customer_id:
        wrong_customer += 1
        if len(examples_customer) < 5:
            examples_customer.append(
                f"  {order.order_number}: VERP={order.customer} "
                f"-> Korrekt={correct_mapping.customer} (SQL AdressenID={sql['adressen_id']})"
            )
    
    # Check legacy_adressen_id
    if order.legacy_adressen_id and sql['adressen_id'] and order.legacy_adressen_id != sql['adressen_id']:
        wrong_adressen_id += 1

print(f"Total checked: {total}")
print(f"\nFalsche confirmation_date (vs SQL Datum): {wrong_conf_date}")
print(f"  davon: conf_date = Auftragsdatum statt Datum: {conf_date_is_auftragsdatum}")
print(f"Falsches order_date (vs SQL Auftragsdatum): {wrong_ord_date}")
print(f"Falscher Kunde: {wrong_customer}")
print(f"Falsche legacy_adressen_id: {wrong_adressen_id}")

if examples_date:
    print("\nBeispiele falsche Daten:")
    for ex in examples_date:
        print(ex)

if examples_customer:
    print("\nBeispiele falscher Kunde:")
    for ex in examples_customer:
        print(ex)

conn.close()
