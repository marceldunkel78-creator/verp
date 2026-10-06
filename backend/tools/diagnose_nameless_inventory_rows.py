"""
Zeigt, welche Roh-Zeilen der Lagerlisten zu Artikeln OHNE Namen fuehren -
also zu "Lagerartikel (kein Produktname)".

Hintergrund (2026-10-06): Solche Artikel blieben vom cleanup_empty_inventory_
items-KOMMANDO unentdeckt, weil die Listen in Kunde/Best.-Nr./Auftrag teils
Platzhalter wie "-" oder "k.a." stehen haben. Diese Werte zählen im
Leerkriterium bisher als "vorhanden" und blockieren so das Loeschen.

Das Skript liest NUR (keine Aenderungen) und listet je Zeile die belegten
Felder mit repr() - so sieht man genau, welches Platzhalter-Feld das
Kriterium faelschlich blockiert.

Aufruf (nur Entwicklung):
    cd backend
    ..\\.venv\\Scripts\\python.exe tools\\diagnose_nameless_inventory_rows.py
"""
import glob
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')

import django  # noqa: E402
django.setup()

from inventory.excel_sync import (  # noqa: E402
    load_mapping, read_source_file, extract_record, is_placeholder,
)


def main():
    mapping = load_mapping()
    base = sys.argv[1] if len(sys.argv) > 1 else str(
        BACKEND.parent / 'Datenvorlagen'
    )
    pattern = sys.argv[2] if len(sys.argv) > 2 else '*.xls*'
    files = sorted(glob.glob(os.path.join(base, '**', pattern), recursive=True))
    print(f'{len(files)} Dateien in {base}')
    print('Zeilen OHNE name+category (-> "Lagerartikel (kein Produktname)"):\n')

    found = 0
    placeholder_hits = 0
    blockers = {}
    cust_values = {}
    kept_by_cleanup = 0
    for f in files:
        try:
            sheets = read_source_file(Path(f), mapping)
        except Exception as exc:
            print(f'  (nicht lesbar: {Path(f).name}: {exc})')
            continue
        for sheet in sheets:
            if sheet.get('skipped') or sheet.get('error'):
                continue
            for row_num, row in sheet['rows']:
                r = extract_record(sheet, row, Path(f).name, row_num)
                if r['name'] or r['category']:
                    continue
                found += 1
                fields = {
                    'serial': r['serial_number'],
                    'best_nr': r['best_nr'],
                    'customer': r['customer'],
                    'order': r['order_number'],
                    'notes': r['notes'][:40],
                    'lfd': r['lfd_nr'],
                    'qty': r['quantity'],
                    'unit': r['unit'],
                    'date': r['delivery_date_raw'],
                }
                placeholders = [
                    k for k, v in fields.items()
                    if v and is_placeholder(v) and k != 'serial'
                ]
                if placeholders:
                    placeholder_hits += 1

                # Welche Felder wuerden das cleanup_empty_inventory_items-
                # Kriterium blockieren? (genau wie der Sync sie speichert)
                blocks = []
                if r['serial_key']:
                    blocks.append('serial')
                if (r['customer'] or '').strip():
                    blocks.append('customer_name')
                if (r['order_number'] or '').strip():
                    blocks.append('customer_order_number')
                if (r['best_nr'] or '').strip():
                    blocks.append('external_ref')
                if blocks:
                    kept_by_cleanup += 1
                    key = '+'.join(blocks)
                    blockers[key] = blockers.get(key, 0) + 1
                    if key == 'customer_name':
                        val = (r['customer'] or '').strip()
                        cust_values[val] = cust_values.get(val, 0) + 1

                if found <= 15:
                    tag = f'  PLATZHALTER in: {placeholders}' if placeholders else ''
                    print(f'{Path(f).name}:{row_num} ' +
                          ' '.join(f'{k}={v!r}' for k, v in fields.items() if v) +
                          tag)

    print('\n---')
    print(f'Betroffene Zeilen                  : {found}')
    print(f'davon mit Platzhaltern             : {placeholder_hits}')
    print(f'davon vom Cleanup-NICHT loeschbar  : {kept_by_cleanup}')
    print('Blockierende Felder (Histogramm):')
    for key, count in sorted(blockers.items(), key=lambda kv: -kv[1]):
        print(f'  {count:5d}  {key}')
    print(f'\nWerte in customer_name (nur-Gruppe, Top 25 von {len(cust_values)}):')
    for value, count in sorted(cust_values.items(), key=lambda kv: -kv[1])[:25]:
        print(f'  {count:5d}  {value!r}')


if __name__ == '__main__':
    main()
