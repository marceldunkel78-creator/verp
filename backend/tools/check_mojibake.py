"""Sucht Double-Encoding (Mojibake) in Textdateien des Repos.

Muster: Ein echtes UTF-8-Umlaut-Byte (0xC3) wurde als Latin-1-Zeichen gelesen
und erneut als UTF-8 kodiert -> C3 83 C2 BC statt C3 BC.
Erkennbar an der Zeichenkette 'Ã' gefolgt von U+0080..U+00FF.
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

MARKERS = ('Ã¼', 'Ã¤', 'Ã¶', 'Ã\x9f', 'Ã\x84', 'Ã\x96', 'Ã\xdc',
           'Ãœ', 'Ã©', 'Ã¨', 'Ã¡', 'Ã\x87', 'Ã±', 'Â\xa0', 'Ã\xa4')


def mojibake_score(text):
    """Zaehlt belastbare Mojibake-Treffer."""
    hits = 0
    idx = 0
    while idx < len(text):
        ch = text[idx]
        if ch in ('Ã', 'Â') and idx + 1 < len(text):
            nxt = ord(text[idx + 1])
            # Umlaute/Schweiss als Latin-1 -> U+00C0..U+00FF
            # Umlaute als Windows-1252 -> U+0080..U+009F
            if 0xA0 <= nxt <= 0xFF or 0x80 <= nxt <= 0x9F:
                hits += 1
                idx += 2
                continue
        idx += 1
    return hits


def main():
    targets = sys.argv[1:] or None
    files = []
    if targets:
        for t in targets:
            p = Path(t)
            if not p.is_absolute():
                p = ROOT / t
            files.append(p)
    else:
        for p in ROOT.rglob('*'):
            if not p.is_file():
                continue
            if any(part in SKIP_DIRS for part in p.parts):
                continue
            if p.suffix.lower() in SKIP_SUFFIX:
                continue
            files.append(p)

    report = []
    for p in sorted(set(files)):
        try:
            raw = p.read_bytes()
        except OSError:
            continue
        if b'\x00' in raw[:8000]:
            continue
        bom = raw[:3] == b'\xef\xbb\xbf'
        text = raw.decode('utf-8', errors='replace')
        hits = mojibake_score(text)
        if hits or bom:
            examples = []
            for m in MARKERS:
                c = text.count(m)
                if c:
                    examples.append(f'{m!r}x{c}')
            report.append((hits, bom, p, ', '.join(examples)))

    report.sort(reverse=True)
    total = 0
    for hits, bom, p, ex in report:
        total += hits
        try:
            rel = p.relative_to(ROOT)
        except ValueError:
            rel = p
        flag = 'BOM ' if bom else ''
        print(f'{flag}{hits:4d}  {rel}   {ex}')
    print()
    print(f'Dateien betroffen: {len(report)} | Treffer gesamt: {total}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())