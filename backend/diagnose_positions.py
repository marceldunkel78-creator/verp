"""Diagnose: Vergleicht VERP-Positionen mit SQL-Positionen fuer Auftraege."""
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()

from verp_settings.order_import import get_mssql_connection, fetch_auftraege, generate_legacy_order_numbers
from customer_orders.models import CustomerOrder, CustomerOrderItem

def fetchall_dict(cursor):
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

def fetchone_dict(cursor):
    cols = [d[0] for d in cursor.description]
    row = cursor.fetchone()
    return dict(zip(cols, row)) if row else None

# SQL-Verbindung
conn = get_mssql_connection(r'localhost\SQLEXPRESS', 'VSDB')
cursor = conn.cursor()

# Teste mit den gemeldeten Auftraegen
test_ids = [5494, 5495]

print("=== SQL-Daten ===")
for aid in test_ids:
    cursor.execute("SELECT AuftragsID, AngebotNummer, Datum, Auftragsdatum, Auftragsname FROM dbo.[Aufträge] WHERE AuftragsID=?", (aid,))
    row = fetchone_dict(cursor)
    if row:
        print(f"AuftragsID={aid}: AngebotNr={row['AngebotNummer']}, Datum={row['Datum']}, Name={row['Auftragsname']}")

    cursor.execute("SELECT AngebotID, PositionsNr, ProduktID, Stückzahl, Stückpreis FROM dbo.AuftragsPositionen WHERE AngebotID=? ORDER BY PositionsNr", (aid,))
    rows = fetchall_dict(cursor)
    print(f"  SQL-Positionen: {len(rows)}")
    for r in rows[:3]:
        print(f"    Pos {r['PositionsNr']}: ProduktID={r['ProduktID']}, Menge={r['Stückzahl']}, Preis={r['Stückpreis']}")
    if len(rows) > 3:
        print(f"    ... ({len(rows)-3} weitere)")
    print()

print("\n=== VERP-Daten ===")
for aid in test_ids:
    o = CustomerOrder.objects.filter(legacy_auftrags_id=aid).first()
    if not o:
        print(f"legacy_id={aid}: NICHT GEFUNDEN")
        continue
    items = list(o.items.all().order_by('position'))
    print(f"legacy_id={aid}: {o.order_number} (pk={o.pk}, {len(items)} Pos., Kunde={o.customer})")
    for i in items[:3]:
        print(f"    Pos {i.position}: {i.name[:60]} / Preis={i.final_price}")
    if len(items) > 3:
        print(f"    ... ({len(items)-3} weitere)")
    print()

# Systematischer Vergleich: Positions-Anzahl SQL vs VERP
print("\n=== Systematischer Vergleich: Positions-Anzahl SQL vs VERP ===")

cursor.execute("SELECT AngebotID, COUNT(*) as cnt FROM dbo.AuftragsPositionen GROUP BY AngebotID")
sql_counts = {}
for row in fetchall_dict(cursor):
    try:
        sql_counts[int(row['AngebotID'])] = row['cnt']
    except (ValueError, TypeError):
        pass

from django.db.models import Count
verp_counts = dict(
    CustomerOrder.objects
    .filter(legacy_auftrags_id__isnull=False)
    .annotate(item_count=Count('items'))
    .values_list('legacy_auftrags_id', 'item_count')
)

mismatch = []
for aid in sorted(set(sql_counts.keys()) & set(verp_counts.keys())):
    if sql_counts[aid] != verp_counts[aid]:
        mismatch.append((aid, sql_counts[aid], verp_counts[aid]))

print(f"Uebereinstimmend: {len(set(sql_counts.keys()) & set(verp_counts.keys())) - len(mismatch)}")
print(f"Abweichende Positions-Anzahl: {len(mismatch)}")
for aid, sql_cnt, verp_cnt in mismatch[:20]:
    o = CustomerOrder.objects.filter(legacy_auftrags_id=aid).first()
    print(f"  AuftragsID={aid}: SQL={sql_cnt} Pos, VERP={verp_cnt} Pos ({o.order_number if o else '?'})")

# Preisvergleich
print("\n=== Preis-Vergleich fuer O-121/O-122 ===")
for aid in test_ids:
    cursor.execute("SELECT SUM(CAST(Stückzahl AS FLOAT) * CAST(Stückpreis AS FLOAT)) as total FROM dbo.AuftragsPositionen WHERE AngebotID=?", (aid,))
    sql_total = fetchone_dict(cursor)['total']
    
    o = CustomerOrder.objects.filter(legacy_auftrags_id=aid).first()
    if o:
        from django.db.models import F, Sum
        verp_total = o.items.aggregate(total=Sum(F('quantity') * F('final_price')))['total']
        print(f"AuftragsID={aid} ({o.order_number}): SQL-Summe={sql_total:.2f}, VERP-Summe={verp_total:.2f}")

conn.close()
