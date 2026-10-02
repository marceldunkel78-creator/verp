"""Repariert Double-Encoding (Mojibake) in Textdateien.

Der Fehler: Ein korrektes UTF-8-Zeichen wurde als cp1252 gelesen und
nochmal als UTF-8 gespeichert. 'ü' (C3 BC) -> 'Ã¼' (C3 83 C2 BC).
Rueckgaengig machen: cp1252-Encode, dann UTF-8-Decode.

Das Skript ist idempotent: laeuft es zweimal, aendert sich beim zweiten
Lauf nichts mehr, weil keine Marker mehr vorhanden sind.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SKIP_DIRS = {
    'node_modules', '.git', 'venv', '.venv', 'build', 'dist',
    '__pycache__', '.idea', 'logs', 'media', 'staticfiles',
}
SKIP_SUFFIX = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip',
               '.xlsx', '.xlsm', '.docx', '.mo', '.po', '.so', '.pyd',
               '.dll', '.exe', '.woff', '.woff2', '.ttf', '.eot'}

# Bytes, die es in korrekt kodiertem UTF-8 deutschem Text praktisch
# nie gibt. Werden sie zusammen mit 'Ã'/'Â' gefunden, sind sie Marker.
#
# WICHTIG: Die zweite Komponente ist der Unicode-CodePOINT des Zeichens,
# mit dem 'Ã' im Text steht. Fuer 'ß' ist das U+0178 (Y mit Trema), weil
# cp1252 an der Stelle 0x9F kein 'ß' kennt, sondern 'Ÿ' mapped.
# Ein blosses 'Ã' + 'Ÿ' zu uebersehen war ein echter Fehler in der
# ersten Fassung dieses Skripts.
MOJIBAKE_SECOND = {
    0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C,
    0x8E, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B,
    0x9C, 0x9E, 0x9F, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7,
    0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF, 0xB0, 0xB1, 0xB2,
    0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD,
    0xBE, 0xBF, 0xBC, 0xDC, 0x178,
}

MOJIBAKE_PAIRS = {
    ('Ã', 0xBC): 'ü',   # ü
    ('Ã', 0xA4): 'ä',   # ä
    ('Ã', 0xB6): 'ö',   # ö
    ('Ã', 0xBC): 'ü',   # ü
    ('Ã', 0xA7): 'ç',   # ç
    ('Ã', 0xB1): '±',   # ±
    ('Ã', 0xA9): 'é',   # é
    ('Ã', 0xA8): 'è',   # è
    ('Ã', 0xA1): '¡',   # ¡
    ('Ã', 0x178): 'ß',  # ß (cp1252 hat an 0x9F kein ß, sondern Ÿ)
    ('Ã', 0xDC): 'Ü',   # Ü
    ('Ã', 0x9C): 'Ü',   # Ü
    ('Ã', 0x84): 'Ä',   # Ä
    ('Ã', 0x96): 'Ö',   # Ö
    ('Ã', 0x9E): 'ß',   # ß
    ('Â', 0xA0): '\u00a0',  # geschuetztes Leerzeichen
    ('Â', 0xAD): '\u00ad',  # weiches Trennzeichen
}


def find_markers(text):
    """Findet (start, end) Positionen von Mojibake-Paaren."""
    spans = []
    idx = 0
    while idx < len(text) - 1:
        a = text[idx]
        b = ord(text[idx + 1])
        if a in ('Ã', 'Â') and b in MOJIBAKE_SECOND:
            spans.append((idx, idx + 2))
            idx += 2
        else:
            idx += 1
    return spans


def fix(text):
    """Ersetzt alle Mojibake-Paare durch die echten Zeichen."""
    spans = find_markers(text)
    if not spans:
        return text, 0
    out = []
    last = 0
    for start, end in spans:
        out.append(text[last:start])
        a = text[start]
        b = ord(text[start + 1])
        rep = MOJIBAKE_PAIRS.get((a, b))
        if rep is None:
            out.append(text[start:end])
        else:
            out.append(rep)
        last = end
    out.append(text[last:])
    return ''.join(out), len(spans)


def main():
    targets = sys.argv[1:] or None
    if not targets:
        print('Bitte Dateien oder Verzeichnisse angeben.')
        print('Beispiel: fix_mojibake.py frontend/src/pages/Suppliers.js')
        return 1

    files = []
    for t in targets:
        p = Path(t)
        if not p.is_absolute():
            p = ROOT / t
        if p.is_dir():
            files.extend(
                q for q in p.rglob('*')
                if q.is_file()
                and not any(part in SKIP_DIRS for part in q.parts)
                and q.suffix.lower() not in SKIP_SUFFIX
            )
        else:
            files.append(p)

    total = 0
    for p in sorted(set(files)):
        try:
            raw = p.read_bytes()
        except OSError:
            continue
        text = raw.decode('utf-8')
        if text.startswith('\ufeff'):
            text = text[1:]
        fixed, n = fix(text)
        if n and fixed != text:
            p.write_bytes(fixed.encode('utf-8'))
            print(f'REPARIERT {n:4d}  {p.relative_to(ROOT) if str(p).startswith(str(ROOT)) else p}')
            total += n
        elif n:
            print(f'UNBEKANNT {n:4d}  {p}')
            total += n

    print()
    print(f'Reparierte Stellen: {total}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())