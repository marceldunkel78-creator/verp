"""Misst die Antwortzeit des LAUFENDEN Dev-Servers auf Port 8000.

Waehrend der Messung laeuft der Server im selben Prozess wie die
Datenbank - das sind also echte HTTP-Roundtrips inkl. Serialisierung,
Authentifizierung und Paginierung.
"""
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_running_server import TempPassword, opener  # noqa: E402

BASE = os.environ.get('VERP_BASE', 'http://localhost:8000')
USERNAME = os.environ.get('VERP_USER', 'postgres')
PASSWORD = os.environ.get('VERP_TEST_PASSWORD', '')

CASES = [
    ('Seite 1 (9 Lieferanten)', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9'),
    ('Suche "andor"', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9&search=andor'),
    ('Suche "a" (67 Treffer)', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9&search=a'),
    ('Statusfilter aktiv', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9&is_active=true'),
    ('Letzte Seite (13)', f'{BASE}/api/suppliers/suppliers/?page=14&page_size=9'),
    ('Alle 123', f'{BASE}/api/suppliers/suppliers/?page_size=1000'),
]

RUNS = 5


def main():
    import django
    django.setup()
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.filter(username=USERNAME).first()
    if not user:
        print(f'Nutzer {USERNAME} nicht gefunden.')
        return 1
    if not PASSWORD:
        print('VERP_TEST_PASSWORD ist nicht gesetzt - Abbruch.')
        print("  $env:VERP_TEST_PASSWORD = 'mein-testpasswort'")
        return 1

    had_usable = user.has_usable_password()

    with TempPassword(user, PASSWORD):
        op = opener()
        data = json.dumps({'username': USERNAME, 'password': PASSWORD}).encode()
        req = urllib.request.Request(
            f'{BASE}/api/auth/login/', data=data,
            headers={'Content-Type': 'application/json'})
        with op.open(req, timeout=30) as r:
            print(f'Login: HTTP {r.status}')
        print()

        print(f'{"Fall":28s} {"HTTP":6s} {"Median":>9s} {"Min":>9s} {"Max":>9s} {"count":>7s}')
        print('-' * 78)
        worst = 0.0
        failures = 0
        for label, url in CASES:
            op.open(urllib.request.Request(url), timeout=60)  # Aufwaermen
            times = []
            code = None
            count = None
            for _ in range(RUNS):
                t0 = time.perf_counter()
                try:
                    with op.open(urllib.request.Request(url), timeout=60) as r:
                        body = r.read()
                    code = r.status
                except urllib.error.HTTPError as e:
                    e.read()
                    code = e.code
                times.append((time.perf_counter() - t0) * 1000)
            try:
                count = json.loads(body).get('count')
            except Exception:
                pass
            med = statistics.median(times)
            worst = max(worst, med)
            if code != 200:
                failures += 1
            print(f'{label:28s} {code!s:6s} {med:8.1f}ms {min(times):8.1f}ms '
                  f'{max(times):8.1f}ms {count!s:>7s}')

    user.refresh_from_db()
    restored = user.has_usable_password() == had_usable

    print()
    print(f'Langsamster Median: {worst:.1f} ms')
    if not restored:
        print('WARNUNG: Passwort-Zustand nicht wiederhergestellt!')
        return 1
    if failures:
        print(f'FEHLER: {failures} Fall(e) mit HTTP != 200')
        return 1
    if worst > 500:
        print('WARNUNG: weiterhin zu langsam (> 500 ms)')
        return 1
    print('OK: alle Faelle HTTP 200 und unter 500 ms, Passwort unveraendert')
    return 0


if __name__ == '__main__':
    sys.exit(main())