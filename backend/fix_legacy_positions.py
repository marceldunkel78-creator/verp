"""
Korrigiert alle Positionen der Legacy-Auftraege aus SQL.
Liest AuftragsPositionen + Produkte direkt aus SQL Server und
ersetzt alle VERP-Positionen mit den korrekten Daten.

Mapping: AuftragsPositionen.AngebotID = Aufträge.AuftragsID = CustomerOrder.legacy_auftrags_id

Ausfuehrung:
    python fix_legacy_positions.py                  # Dry-Run
    python fix_legacy_positions.py --execute        # Wirklich ausfuehren
"""
import os
import sys
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()

from django.db import transaction
from customer_orders.models import CustomerOrder, CustomerOrderItem
from verp_settings.order_import import get_mssql_connection

DRY_RUN = '--execute' not in sys.argv
print(f"{'=== DRY RUN ===' if DRY_RUN else '=== EXECUTE ==='}\n")


def fetchall_dict(cursor):
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


# ===== 1. SQL-Daten laden =====
print("Lade SQL-Daten...")
conn = get_mssql_connection(r'localhost\SQLEXPRESS', 'VSDB')
cursor = conn.cursor()

# Produkte-Lookup
cursor.execute("SELECT ProduktID, Kennung, Artikel, ProduktBeschreibung FROM dbo.Produkte")
produkt_lookup = {}
for row in fetchall_dict(cursor):
    produkt_lookup[row['ProduktID']] = {
        'kennung': (row['Kennung'] or '').strip(),
        'artikel': (row['Artikel'] or '').strip(),
        'beschreibung': (row['ProduktBeschreibung'] or '').strip(),
    }
print(f"  Produkte: {len(produkt_lookup)}")

# Positionen-Lookup aus Positionen-Tabelle (Sondervereinbarungen fuer Angebote)
cursor.execute("SELECT AngebotID, PositionsNr, Sondervereinbarungen FROM dbo.Positionen")
angebots_pos_lookup = {}
for row in fetchall_dict(cursor):
    key = (row['AngebotID'], row['PositionsNr'])
    sv = (row['Sondervereinbarungen'] or '').strip()
    if sv:
        angebots_pos_lookup[key] = sv
print(f"  Positionen (Sondervereinbarungen): {len(angebots_pos_lookup)}")

# AuftragsPositionen gruppiert nach AngebotID (= AuftragsID)
cursor.execute("""
    SELECT AngebotID, PositionsNr, ProduktID, Stückzahl, Stückpreis,
           Einkaufspreis, Sondervereinbarungen, SerienNr, LieferNr, RechnungNr
    FROM dbo.AuftragsPositionen
    ORDER BY AngebotID, PositionsNr
""")
sql_positions = {}  # auftrags_id -> [positions]
for row in fetchall_dict(cursor):
    aid = row['AngebotID']
    if aid not in sql_positions:
        sql_positions[aid] = []
    sql_positions[aid].append(row)
print(f"  AuftragsPositionen: {sum(len(v) for v in sql_positions.values())} Positionen fuer {len(sql_positions)} Auftraege")

conn.close()

# ===== 2. VERP-Auftraege laden =====
print("\nLade VERP-Auftraege...")
legacy_orders = list(
    CustomerOrder.objects
    .filter(legacy_auftrags_id__isnull=False)
    .prefetch_related('items')
)
print(f"  Legacy-Auftraege: {len(legacy_orders)}")

# ===== 3. Vergleichen und korrigieren =====
print("\nVergleiche Positionen...\n")

stats = {
    'correct': 0,
    'fixed': 0,
    'no_sql': 0,
    'errors': 0,
    'items_deleted': 0,
    'items_created': 0,
}

for order in legacy_orders:
    aid = order.legacy_auftrags_id
    sql_pos_list = sql_positions.get(aid, [])
    verp_items = list(order.items.all().order_by('position'))

    if not sql_pos_list:
        stats['no_sql'] += 1
        continue

    # Schnell-Check: stimmen Anzahl und Preise ueberein?
    sql_count = len(sql_pos_list)
    verp_count = len(verp_items)

    # Preis-Fingerprint: sortierte Liste aus (PositionsNr, Stueckpreis)
    sql_fingerprint = sorted(
        (p['PositionsNr'], float(p['Stückpreis'] or 0))
        for p in sql_pos_list
    )
    verp_fingerprint = sorted(
        (i.position, float(i.final_price))
        for i in verp_items
    )

    if sql_fingerprint == verp_fingerprint:
        stats['correct'] += 1
        continue

    # Positionen stimmen NICHT ueberein -> korrigieren
    stats['fixed'] += 1

    if stats['fixed'] <= 20:
        print(f"  {order.order_number} (legacy_id={aid}): "
              f"VERP={verp_count} Pos -> SQL={sql_count} Pos")

    if not DRY_RUN:
        try:
            with transaction.atomic():
                # Alte Positionen loeschen
                deleted_count = order.items.all().delete()[0]
                stats['items_deleted'] += deleted_count

                # Neue Positionen aus SQL erstellen
                for pos in sql_pos_list:
                    pos_nr = pos['PositionsNr'] or 1
                    quantity = Decimal(str(pos['Stückzahl'] or 1))
                    if quantity == 0:
                        quantity = Decimal('1')

                    list_price = Decimal(str(pos['Stückpreis'] or 0))
                    purchase_price = Decimal(str(pos['Einkaufspreis'] or 0))

                    # Produkt-Info
                    prod_info = produkt_lookup.get(pos['ProduktID'], {})
                    position_name = prod_info.get('artikel', '')
                    article_number = prod_info.get('kennung', '')
                    prod_beschreibung = prod_info.get('beschreibung', '')

                    # Sondervereinbarungen (aus AuftragsPositionen + Positionen)
                    auftrags_sv = (pos['Sondervereinbarungen'] or '').strip()
                    angebots_sv = angebots_pos_lookup.get((aid, pos_nr), '')

                    desc_parts = []
                    if prod_beschreibung:
                        desc_parts.append(prod_beschreibung)
                    if angebots_sv:
                        desc_parts.append(angebots_sv)
                    if auftrags_sv and auftrags_sv not in desc_parts:
                        desc_parts.append(auftrags_sv)
                    description = '\n'.join(desc_parts)

                    # Fallback Name
                    if not position_name:
                        position_name = auftrags_sv[:100] if auftrags_sv else f"Position {pos_nr}"

                    # Seriennummer
                    serial = (pos['SerienNr'] or '').strip()
                    if serial in ('..............................', '.....', ''):
                        serial = ''

                    delivery_nr = int(pos['LieferNr'] or 1)
                    invoice_nr = int(pos['RechnungNr'] or 1)

                    CustomerOrderItem.objects.create(
                        order=order,
                        position=pos_nr,
                        position_display=str(pos_nr),
                        article_number=article_number,
                        name=position_name,
                        description=description,
                        purchase_price=purchase_price,
                        list_price=list_price,
                        final_price=list_price,
                        quantity=quantity,
                        unit='Stück',
                        currency='DEM',
                        delivery_note_number=delivery_nr,
                        invoice_number=invoice_nr,
                        serial_number=serial,
                        is_delivered=True,
                        is_invoiced=True,
                    )
                    stats['items_created'] += 1

        except Exception as e:
            stats['errors'] += 1
            print(f"  FEHLER {order.order_number}: {e}")
    else:
        stats['items_deleted'] += verp_count
        stats['items_created'] += sql_count

if stats['fixed'] > 20:
    print(f"  ... ({stats['fixed'] - 20} weitere)")

# ===== 4. Zusammenfassung =====
print(f"\n===== ZUSAMMENFASSUNG =====")
print(f"Bereits korrekt:     {stats['correct']}")
print(f"Korrigiert:          {stats['fixed']}")
print(f"Kein SQL-Match:      {stats['no_sql']}")
print(f"Fehler:              {stats['errors']}")
print(f"Positionen geloescht:{stats['items_deleted']}")
print(f"Positionen erstellt: {stats['items_created']}")
if DRY_RUN:
    print(f"\nStarte mit: python fix_legacy_positions.py --execute")
