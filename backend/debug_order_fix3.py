"""Check raw SQL Datum vs Auftragsdatum for specific orders."""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from verp_settings.customer_sync import get_mssql_connection

conn = get_mssql_connection('192.168.0.2\\SQLEXPRESS,1433', 'VSDB')
cursor = conn.cursor()

# Check specific orders
for aid in [1079, 1080, 1081, 1082, 1083, 1084]:
    cursor.execute(f"SELECT AuftragsID, Datum, Auftragsdatum, AdressenID FROM Aufträge WHERE AuftragsID = {aid}")
    row = cursor.fetchone()
    if row:
        print(f"AuftragsID={row[0]}: Datum={row[1]}, Auftragsdatum={row[2]}, AdressenID={row[3]}")

# Count how many have NULL Datum
cursor.execute("SELECT COUNT(*) FROM Aufträge WHERE Datum IS NULL")
null_datum = cursor.fetchone()[0]
cursor.execute("SELECT COUNT(*) FROM Aufträge")
total = cursor.fetchone()[0]
print(f"\nTotal: {total}, Datum IS NULL: {null_datum}")

# Count how many have Datum != Auftragsdatum
cursor.execute("SELECT COUNT(*) FROM Aufträge WHERE Datum IS NOT NULL AND Auftragsdatum IS NOT NULL AND CAST(Datum AS DATE) != CAST(Auftragsdatum AS DATE)")
diff = cursor.fetchone()[0]
print(f"Datum != Auftragsdatum: {diff}")

# How many have Datum = Auftragsdatum (including both NULL)?
cursor.execute("SELECT COUNT(*) FROM Aufträge WHERE Datum IS NOT NULL AND Auftragsdatum IS NOT NULL AND CAST(Datum AS DATE) = CAST(Auftragsdatum AS DATE)")
same = cursor.fetchone()[0]
cursor.execute("SELECT COUNT(*) FROM Aufträge WHERE Datum IS NULL AND Auftragsdatum IS NOT NULL")
datum_null_auftrag_set = cursor.fetchone()[0]
print(f"Datum = Auftragsdatum: {same}")
print(f"Datum NULL but Auftragsdatum set: {datum_null_auftrag_set}")

conn.close()
