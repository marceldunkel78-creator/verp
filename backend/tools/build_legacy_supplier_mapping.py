"""Erzeugt eine editierbare Lieferanten-Zuordnung aus den offenen CSV-Namen.

Einmalig ausfuehren, danach legacy_supplier_mapping.json im Editor pflegen.
Nur Namen, die der Import aktuell NICHT selbst zuordnen kann, landen in der
Datei - sowie ein Kommentar mit Zeilenzahl als Groessenordnung.
"""
import os, sys, django, collections, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()
from verp_settings.legacy_procurement_import import (
    _read_csv, _supplier_match, load_supplier_mapping, _mapping_path, DEFAULT_IGNORED_SUPPLIER_VALUES,
)
from suppliers.models import Supplier

suppliers = list(Supplier.objects.all())
mapping = load_supplier_mapping()
rows = _read_csv()

counter = collections.Counter()
for row in rows:
    name = str(row.get('Lieferant') or '').strip()
    supplier, match_type = _supplier_match(name, suppliers, mapping)
    if supplier is None and match_type not in {'ignored', 'empty'}:
        counter[name] += 1

ignore = sorted(set(mapping['ignore']) | set(DEFAULT_IGNORED_SUPPLIER_VALUES))
payload = {
    '_hinweis': (
        'Zuordnung Legacy-Lieferantennamen (bestlist.csv) -> VERP-Lieferant. '
        'Schluessel = Name aus der CSV-Spalte "Lieferant". '
        'Wert = Firmenname ODER Lieferantennummer im VERP, oder {"supplier": ..., "note": ...}. '
        'Nur was hier nicht steht, wird weiterhin ueber den unscharfen Namensabgleich versucht. '
        'Names unter "ignore" werden komplett uebersprungen (keine Bestellung). '
        'Wird bei jedem Lauf neu gelesen - kein Neustart noetig.'
    ),
    'ignore': ignore,
    'supplier_map': {},
}
for name in sorted(counter, key=lambda n: (-counter[n], n)):
    payload['supplier_map'][name] = {'supplier': '', 'note': f'{counter[name]} Zeilen - Firmenname oder Lieferantennummer eintragen'}

path = _mapping_path()
path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(counter)} offene Namen, {sum(counter.values())} CSV-Zeilen -> {path}')
for name, n in counter.most_common(15):
    print(f'  {n:5d}  {name!r}')