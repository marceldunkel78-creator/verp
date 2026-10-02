"""Prueft statisch, ob Suppliers.js beim Aufruf noch abruft.

Simuliert die Effekt-Reihenfolge fuer drei Faelle:
  1. Erstaufruf ohne URL-Parameter und ohne sessionStorage
  2. Erstaufruf mit gespeicherten Filtern
  3. Aufruf per Direktlink mit Parametern

Erwartung nach der Aenderung:
  Fall 1 -> 0 Abrufe der Lieferantenliste
  Fall 2 -> 0 Abrufe (Filter nur ins Formular uebernommen)
  Fall 3 -> 1 Abruf (Direktlink erwartet ein Ergebnis)
"""
import re
from pathlib import Path

SRC = Path(r'C:\Users\mdunk\Documents\VERP\frontend\src\pages\Suppliers.js')
text = SRC.read_text(encoding='utf-8')

print('=== Wo wird fetchSuppliers() aufgerufen? ===')
for m in re.finditer(r'fetchSuppliers\(', text):
    line_no = text[:m.start()].count('\n') + 1
    line = text.splitlines()[line_no - 1].strip()
    print(f'  Zeile {line_no:4d}: {line}')
print()

print('=== Wo wird hasSearched gesetzt? ===')
for m in re.finditer(r'setHasSearched\(', text):
    line_no = text[:m.start()].count('\n') + 1
    line = text.splitlines()[line_no - 1].strip()
    print(f'  Zeile {line_no:4d}: {line}')
print()

print('=== Initialwert hasSearched ===')
m = re.search(r'const \[hasSearched, setHasSearched\] = useState\((.*?)\);', text)
print(f'  {m.group(0) if m else "NICHT GEFUNDEN"}')
print()

print('=== Mount-Effekt (Zeile mit "Aufruf der Seite") ===')
lines = text.splitlines()
start = next(i for i, l in enumerate(lines) if 'Aufruf der Seite' in l)
for i in range(start - 2, start + 16):
    print(f'  {i + 1:4d}| {lines[i]}')
print()

print('=== Enthaelt loadSearchState noch einen Abruf? ===')
m = re.search(r'const loadSearchState = \(\) => \{.*?\n  \};', text, re.S)
body = m.group(0)
bad = [k for k in ('fetchSuppliers', 'setSuppliers', 'setHasSearched(true)',
                   'setCurrentPage(', 'setSearchParams') if k in body]
print(f'  Problematische Aufrufe: {bad if bad else "keine"}')
print()

print('=== Enthaelt saveSearchState noch die Liste? ===')
m = re.search(r'const saveSearchState = \(\) => \{.*?\n  \};', text, re.S)
body = m.group(0)
bad = [k for k in ('suppliers', 'totalPages', 'hasSearched', 'currentPage')
       if k in body.replace('suppliers search state', '')]
print(f'  Problematische Felder: {bad if bad else "keine"}')
print()

print('=== Umlaute ===')
bad_moji = [m2 for m2 in ('Ã¼', 'Ã¤', 'Ã¶', 'Ã\x9f', 'Ãœ', 'Ã©')
            if m2 in text]
print(f'  Mojibake: {bad_moji if bad_moji else "keine"}')
for probe in ('Filter zurücksetzen', 'Zurück', 'Schließen', 'Gültig',
              'Prüfe', 'ausgewählt', 'hinzufügen'):
    print(f'  {probe!r:26s} -> {text.count(probe)}x')
print()

print('=== BOM ===')
print(f'  {SRC.read_bytes()[:3] == b"\\xef\\xbb\\xbf"}')