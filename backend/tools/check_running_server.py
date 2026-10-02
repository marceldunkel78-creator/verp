"""Testet den LAUFENDEN Dev-Server auf Port 8000 mit echtem JWT-Login.

Zweck: Pruefen, ob der laufende Prozess die aktuelle views.py geladen hat.
Ein `NameError: OuterRef` taucht als HTTP 500 mit Django-Fehlerseite auf.

SICHERHEIT: Das Passwort des Testnutzers wird nur temporaer gesetzt und
ueber einen Contextmanager zwingend zurueckgesetzt - inklusive des
Sonderfalls "vorher unbrauchbar" (has_usable_password() == False), wie es
bei den Produktivnutzern der Fall ist.

Die erste Fassung hatte in derselben Zeile zwei Fehler: sie importierte
`get_user_model` und rief dann `.objects` darauf auf (es ist eine Funktion,
kein Modell). Der AttributeError in `__exit__` liess das Passwort
zurueckbleiben. Der naheliegende Ersatz per Direktimport aus
`auth.models` scheiterte, weil AUTH_USER_MODEL auf `users.User` zeigt.
Beides ist jetzt behoben, plus eine Gegenprobe am Ende.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')

BASE = os.environ.get('VERP_BASE', 'http://localhost:8000')
USERNAME = os.environ.get('VERP_USER', 'postgres')
# KEIN Standardwert: das Testpasswort wird ausschliesslich per
# Umgebungsvariable gesetzt (VERP_TEST_PASSWORD). Sonst laeuft ein
# Skript auf einem System, wo dieser Name ein echtes Passwort ist.
PASSWORD = os.environ.get('VERP_TEST_PASSWORD', '')

CASES = [
    ('OHNE Suche', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9'),
    ('Suche "andor"', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9&search=andor'),
    ('Suche "a"', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9&search=a'),
    ('Suche "Thorlabs"', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9&search=Thorlabs'),
    ('Statusfilter', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9&is_active=true'),
    ('Leere Suche', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9&search='),
    ('Sonderzeichen', f'{BASE}/api/suppliers/suppliers/?page=1&page_size=9&search=%C3%BC'),
]


class TempPassword:
    """Setzt ein Passwort temporaer und stellt den Ursprungszustand her.

    Als Contextmanager, damit der Rueckbau auch bei SystemExit und bei
    Fehlern im Testkoerper garantiert laeuft.
    """

    def __init__(self, user, password):
        self.user = user
        self.password = password
        self.original_hash = None
        self.had_usable = None

    def __enter__(self):
        self.original_hash = self.user.password
        self.had_usable = self.user.has_usable_password()
        self.user.set_password(self.password)
        self.user.save(update_fields=['password'])
        return self.user

    def __exit__(self, exc_type, exc, tb):
        # Zwei Fallen in einer Zeile, beide in der ersten Fassung:
        #  1. `get_user_model` ist eine FUNKTION, kein Modell -
        #     `.objects` darauf schlaegt mit AttributeError fehl.
        #  2. `from django.contrib.auth.models import User` ist ebenfalls
        #     falsch: AUTH_USER_MODEL zeigt auf 'users.User', und der
        #     Manager ist dann nicht mehr erreichbar
        #     ("Manager isn't available; 'auth.User' has been swapped").
        # Richtig ist der Aufruf der Funktion.
        from django.contrib.auth import get_user_model
        get_user_model().objects.filter(pk=self.user.pk).update(
            password=self.original_hash)
        return False


def opener():
    jar = CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def login(op):
    data = json.dumps({'username': USERNAME, 'password': PASSWORD}).encode()
    req = urllib.request.Request(
        f'{BASE}/api/auth/login/', data=data,
        headers={'Content-Type': 'application/json'})
    with op.open(req, timeout=30) as r:
        return r.status


def describe_error(body):
    """Zieht Titel und Exception-Wert aus der Django-Fehlerseite."""
    m = re.search(r'<title>(.*?)</title>', body, re.S)
    title = m.group(1).strip() if m else ''
    m2 = re.search(r'class="exception_value"[^>]*>(.*?)</', body, re.S)
    exc = m2.group(1).strip() if m2 else ''
    if exc:
        return f'{title} | {exc}'
    return title or body[:150].replace('\n', ' ')


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
        print('Beispiel (PowerShell):')
        print("  $env:VERP_TEST_PASSWORD = 'mein-testpasswort'")
        return 1

    # Ausgangszustand VOR dem Aendern sichern. TempPassword.set_password()
    # wuerde sonst einen unbrauchbaren Zustand in einen nutzbaren umwandeln
    # und der Aufrufer haette danach ein Passwort, das es vorher nicht gab.
    had_usable_before = user.has_usable_password()

    with TempPassword(user, PASSWORD):
        op = opener()
        try:
            status = login(op)
            print(f'Login: HTTP {status}')
        except urllib.error.HTTPError as e:
            print(f'Login fehlgeschlagen: HTTP {e.code}')
            return 1

        print()
        print(f'{"Fall":20s} {"HTTP":6s} {"count":>7s}  Hinweis')
        print('-' * 70)
        failed = 0
        for label, url in CASES:
            try:
                with op.open(urllib.request.Request(url), timeout=60) as r:
                    body = r.read().decode('utf-8', 'replace')
                    code = r.status
            except urllib.error.HTTPError as e:
                body = e.read().decode('utf-8', 'replace')
                code = e.code

            count = ''
            note = ''
            try:
                count = json.loads(body).get('count')
            except Exception:
                note = describe_error(body)
            if code != 200 and not note:
                note = body[:150].replace('\n', ' ')
            print(f'{label:20s} {code!s:6s} {count!s:>7s}  {note}')
            if code != 200:
                failed += 1

    # Gegenprobe: Ist der Ausgangszustand wirklich wiederhergestellt?
    user.refresh_from_db()
    now_usable = user.has_usable_password()
    ok = (now_usable == had_usable_before)
    print()
    print(f'Passwort-Zustand: vorher brauchbar={had_usable_before}, '
          f'nachher brauchbar={now_usable} -> '
          f'{"wiederhergestellt" if ok else "ABWEICHUNG!"}')

    if failed:
        print(f'FEHLER: {failed} Fall(e) mit HTTP != 200')
        return 1
    if not ok:
        print('WARNUNG: Passwort-Zustand wurde nicht sauber zurueckgesetzt!')
        return 1
    print('OK: alle Faelle HTTP 200, Passwort unveraendert')
    return 0


if __name__ == '__main__':
    sys.exit(main())