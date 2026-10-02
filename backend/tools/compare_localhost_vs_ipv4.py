"""Vorher/Nachher-Vergleich: localhost (IPv6) gegen 127.0.0.1 (IPv4).

Zeigt in einem Lauf beide Wege zum selben laufenden Server, damit der
Unterschied nicht von Serverlast oder Datenbankzustand beeinflusst sein
kann - es ist derselbe Prozess, dieselbe Datenbank, dieselbe Anfrage.
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
from check_running_server import TempPassword  # noqa: E402

USERNAME = os.environ.get('VERP_USER', 'postgres')
PASSWORD = os.environ.get('VERP_TEST_PASSWORD', '')
PORT = int(os.environ.get('VERP_PORT', '8000'))
RUNS = 5

CASES = [
    ('Ohne Suche', '/api/suppliers/suppliers/?page=1&page_size=9'),
    ('Suche "andor"', '/api/suppliers/suppliers/?page=1&page_size=9&search=andor'),
    ('Suche "a"', '/api/suppliers/suppliers/?page=1&page_size=9&search=a'),
    ('Statusfilter', '/api/suppliers/suppliers/?page=1&page_size=9&is_active=true'),
    ('Alle 123', '/api/suppliers/suppliers/?page_size=1000'),
    ('Nur Benachrichtigungen', '/api/notifications/recent/'),
]


def measure(base, path, cookie):
    """Ein Request gegen base, mit gesetztem Cookie-Header."""
    host = base.split('://', 1)[1]
    s = __import__('socket').create_connection((host.split(':')[0], int(host.split(':')[1])), timeout=30)
    req = (f'GET {path} HTTP/1.1\r\nHost: {host}\r\n'
           f'Cookie: {cookie}\r\nConnection: close\r\n\r\n')
    t0 = time.perf_counter()
    s.sendall(req.encode())
    buf = b''
    while True:
        d = s.recv(65536)
        if not d:
            break
        buf += d
    dt = (time.perf_counter() - t0) * 1000
    s.close()
    status = int(buf[9:12]) if buf[:5] == b'HTTP/' else 0
    return dt, status


def urllib_measure(base, path, cookie):
    """ueber urllib - so wie es axios im Browser im Prinzip auch tut."""
    req = urllib.request.Request(base + path, headers={'Cookie': cookie})
    t0 = time.perf_counter()
    try:
        with urllib.request.build_opener().open(req, timeout=60) as r:
            r.read()
        return (time.perf_counter() - t0) * 1000, r.status
    except urllib.error.HTTPError as e:
        e.read()
        return (time.perf_counter() - t0) * 1000, e.code


def main():
    import django
    django.setup()
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.filter(username=USERNAME).first()
    if not user:
        print('Nutzer nicht gefunden.')
        return 1
    if not PASSWORD:
        print('VERP_TEST_PASSWORD ist nicht gesetzt - Abbruch.')
        print("  $env:VERP_TEST_PASSWORD = 'mein-testpasswort'")
        return 1

    had_usable = user.has_usable_password()

    with TempPassword(user, PASSWORD):
        jar = CookieJar()
        op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        data = json.dumps({'username': USERNAME, 'password': PASSWORD}).encode()
        rq = urllib.request.Request(
            f'http://127.0.0.1:{PORT}/api/auth/login/', data=data,
            headers={'Content-Type': 'application/json'})
        with op.open(rq, timeout=30) as r:
            print(f'Login: HTTP {r.status}')
        cookie = '; '.join(f'{c.name}={c.value}' for c in jar)
        print()

        print(f'{"Fall":28s} {"localhost":>12s} {"127.0.0.1":>12s} {"Faktor":>9s}')
        print('-' * 66)
        ratios = []
        for label, path in CASES:
            ts6, ts4, code6, code4 = [], [], 0, 0
            measure(f'http://localhost:{PORT}', path, cookie)  # Aufwaermen
            measure(f'http://127.0.0.1:{PORT}', path, cookie)
            for _ in range(RUNS):
                dt, code6 = urllib_measure(f'http://localhost:{PORT}', path, cookie)
                ts6.append(dt)
            for _ in range(RUNS):
                dt, code4 = urllib_measure(f'http://127.0.0.1:{PORT}', path, cookie)
                ts4.append(dt)
            m6 = statistics.median(ts6)
            m4 = statistics.median(ts4)
            ratios.append(m6 / m4 if m4 else 0)
            flag = '' if code6 == code4 == 200 else '  <-- HTTP'
            print(f'{label:28s} {m6:9.1f} ms {m4:9.1f} ms {m6 / m4:8.0f}x{flag}')
            print(f'{"":28s} [{code6}]        [{code4}]')

        print()
        print(f'Mittlerer Faktor: {statistics.mean(ratios):.0f}x')
        print(f'Schnellster Fall: {min(ratios):.0f}x')

    user.refresh_from_db()
    restored = user.has_usable_password() == had_usable
    print()
    print(f'Passwort-Zustand: {"wiederhergestellt" if restored else "ABWEICHUNG!"}')
    return 0 if restored else 1


if __name__ == '__main__':
    sys.exit(main())