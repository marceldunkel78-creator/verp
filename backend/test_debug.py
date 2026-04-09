import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()
from customer_orders.models import CustomerOrder
from customers.models import Customer, CustomerLegacyMapping
from verp_settings.customer_sync import get_mssql_connection

# Finde alle legacy_adressen_ids ohne Mapping
orders = CustomerOrder.objects.filter(
    order_number__startswith='O-', order_number__contains='/',
    legacy_adressen_id__isnull=False,
)

no_mapping_aids = set()
for o in orders:
    aid = o.legacy_adressen_id
    if not CustomerLegacyMapping.objects.filter(sql_id=aid).exists():
        if not Customer.objects.filter(legacy_sql_id=aid).exists():
            no_mapping_aids.add(aid)

print(f"AdressenIDs ohne Mapping: {len(no_mapping_aids)}")

# Nachschauen in SQL was das fuer Adressen sind
conn = get_mssql_connection(r'192.168.0.2\SQLEXPRESS,1433', 'VSDB')
cursor = conn.cursor()

aids_list = sorted(no_mapping_aids)
for aid in aids_list:
    cursor.execute("""
        SELECT AdressenID, Vorname, Name, [Firma/Uni], PLZ, Ort, 
               Kunde, Interessent, Lieferant, veraltet
        FROM Adressen WHERE AdressenID=?
    """, (aid,))
    row = cursor.fetchone()
    if row:
        cols = [d[0] for d in cursor.description]
        d = dict(zip(cols, row))
        # Zaehle Auftraege
        cursor.execute("SELECT COUNT(*) FROM [Aufträge] WHERE AdressenID=?", (aid,))
        cnt = cursor.fetchone()[0]
        flags = []
        if d.get('Kunde'): flags.append('K')
        if d.get('Interessent'): flags.append('I')
        if d.get('Lieferant'): flags.append('L')
        if d.get('veraltet'): flags.append('V')
        print(f"  {d['AdressenID']:>6} {d.get('Vorname') or '':>15} {d.get('Name') or '':>20} {d.get('Firma/Uni') or '':>40} {d.get('PLZ') or '':>6} {d.get('Ort') or '':>20} [{','.join(flags):>5}] {cnt:>3} Auftr.")
    else:
        print(f"  {aid}: nicht in SQL gefunden")

conn.close()

# Check die 3 spezifischen Auftraege
print("\nSpezifische Auftraege:")
for on in ['O-373-12/00', 'O-375-12/00', 'O-377-12/00']:
    o = CustomerOrder.objects.filter(order_number=on).first()
    if o:
        aid = o.legacy_adressen_id
        cust = o.customer
        print(f"  {on}: customer={cust.customer_number if cust else 'keiner'} {cust}, aid={aid}")
