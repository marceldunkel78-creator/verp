"""Misst die echte Antwortzeit des Lieferanten-Listenendpunkts.

Ruft die URL mehrfach ueber den Django-Testclient auf und medianwertet.
Nutzt einen echten Login (force_login), damit die Berechtigungen greifen.
"""
import time

import django
from django.test import Client
from django.test.utils import override_settings
from django.contrib.auth import get_user_model

User = get_user_model()

CASES = [
    ('Seite 1 (9 Lieferanten)', '/api/suppliers/suppliers/?page=1&page_size=9'),
    ('Seite 1, alle aktiv', '/api/suppliers/suppliers/?page=1&page_size=9&is_active=true'),
    ('Suche "a"', '/api/suppliers/suppliers/?page=1&page_size=9&search=a'),
    ('Suche "Thorlabs"', '/api/suppliers/suppliers/?page=1&page_size=9&search=Thorlabs'),
    ('Alle 123 (kein Paging)', '/api/suppliers/suppliers/?page_size=1000'),
]


HOST = {'HTTP_HOST': 'localhost'}
TEST_PASSWORD = os.environ.get('VERP_TEST_PASSWORD', '')


def login(client, admin):
    """Meldet sich ueber die echte API an - force_login greift bei
    JWT-Cookie-Auth nicht. Setzt das Passwort nur temporaer."""
    original_hash = admin.password
    admin.set_password(TEST_PASSWORD)
    admin.save(update_fields=['password'])
    try:
        r = client.post(
            '/api/auth/login/',
            {'username': admin.username, 'password': TEST_PASSWORD},
            content_type='application/json', **HOST)
        if r.status_code != 200:
            raise RuntimeError(f'Login fehlgeschlagen: {r.status_code}')
    finally:
        User.objects.filter(pk=admin.pk).update(password=original_hash)


def get(c, url):
    """GET mit erlaubtem Host - sonst blockt ALLOWED_HOSTS den Testclient."""
    return c.get(url, **HOST)


def main():
    admin = User.objects.filter(is_superuser=True).first()
    if not admin:
        print('Kein Superuser - Abbruch.')
        return
    c = Client()
    login(c, admin)

    print(f'Lieferanten: {django.apps.apps.get_model("suppliers", "Supplier").objects.count()}')
    print()
    print(f'{"Fall":30s} {"HTTP":6s} {"Median":>10s} {"Min":>9s} {"count":>7s}')
    print('-' * 70)

    worst = 0.0
    for label, url in CASES:
        get(c, url)  # Aufwaermen (Login, caches)
        times = []
        status = None
        count = None
        for _ in range(5):
            t0 = time.perf_counter()
            r = get(c, url)
            times.append((time.perf_counter() - t0) * 1000)
            status = r.status_code
            try:
                count = r.json().get('count')
            except Exception:
                pass
        times.sort()
        med = times[len(times) // 2]
        worst = max(worst, med)
        print(f'{label:30s} {status!s:6s} {med:9.1f}ms {times[0]:8.1f}ms {count!s:>7s}')

    print()
    print(f'Langsamster Fall: {worst:.1f} ms')
    if worst > 500:
        print('WARNUNG: weiterhin zu langsam')
    else:
        print('OK: alle Faelle unter 500 ms')


if __name__ == '__main__':
    with override_settings(ALLOWED_HOSTS=['testserver', 'localhost', '127.0.0.1']):
        main()