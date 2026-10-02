"""Listet alle Nicht-ASCII-Zeichen einer Datei auf - zur Encoding-Kontrolle."""
import sys
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

files = sys.argv[1:] or ['frontend/src/pages/Suppliers.js']

for arg in files:
    p = Path(arg)
    if not p.is_absolute():
        p = ROOT / arg
    raw = p.read_bytes()
    t = raw.decode('utf-8')

    print(f'=== {p.name} ===')
    print(f'BOM: {raw[:3] == bytes([0xEF, 0xBB, 0xBF])}  Groesse: {len(raw)}')
    print()

    c = Counter(ch for ch in t if ord(ch) > 127)
    if not c:
        print('  (nur ASCII)')
    for ch, n in sorted(c.items(), key=lambda x: -x[1]):
        cp = f'U+{ord(ch):04X}'
        name = unicodedata.name(ch, 'UNBEKANNT')
        print(f'  {cp}  {ch}  {n:3d}x  {name}')

    # Verdaechtige Zeichen
    suspect = [ch for ch in c if ch in 'ÃÂÅÐÑ']
    if suspect:
        print()
        print(f'  ACHTUNG Mojibake-Verdacht: {suspect}')
        for ch in suspect:
            idx = t.index(ch)
            print(f'    {t[max(0,idx-12):idx+12]!r}')
    print()