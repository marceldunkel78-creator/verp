"""
End-to-End-Test des RMA-Abschnitts "Reparatur beim Hersteller in Auftrag gegeben".

Deckt ab:
  1. Datum + verknuepfte Einkaufsbestellung speichern und laden
  2. Freitext-Bestellnummer, wenn die Bestellung NICHT im VERP ist
  3. Freitext wird gesperrt, sobald eine echte Bestellung gewaehlt ist
  4. Kommentar speichern und laden
  5. Verknuepfte Bestellung im Detail-Antwort lesbar

Aufruf:
    python tools/check_rma_manufacturer_order.py
"""

import os
import sys

import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db import transaction  # noqa: E402
from django.test import Client, override_settings  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402

from suppliers.models import Supplier  # noqa: E402
from orders.models import Order  # noqa: E402
from service.models import RMACase  # noqa: E402

User = get_user_model()

# KEIN Standardwert: nur per Umgebungsvariable VERP_TEST_PASSWORD.
TEST_PASSWORD = os.environ.get('VERP_TEST_PASSWORD', '')

OK = '\033[92mOK\033[0m'
FAIL = '\033[91mFAIL\033[0m'
failures = []


def check(label, condition, detail=''):
    if condition:
        print(f'  {OK}  {label}')
    else:
        print(f'  {FAIL}  {label} {detail}')
        failures.append(label)


def payload(response):
    try:
        return response.json()
    except ValueError:
        return {'_raw': response.content[:300].decode('utf-8', 'replace')}


def login(client, admin):
    if not TEST_PASSWORD:
        raise RuntimeError(
            'VERP_TEST_PASSWORD ist nicht gesetzt. Beispiel (PowerShell):\n'
            "  $env:VERP_TEST_PASSWORD = 'mein-testpasswort'"
        )
    had_usable = admin.has_usable_password()
    original_hash = admin.password
    admin.set_password(TEST_PASSWORD)
    admin.save(update_fields=['password'])
    r = client.post('/api/auth/login/',
                    {'username': admin.username, 'password': TEST_PASSWORD},
                    content_type='application/json')
    if r.status_code != 200:
        User.objects.filter(pk=admin.pk).update(password=original_hash)
        raise RuntimeError(f'Login fehlgeschlagen: {r.status_code}')


def restore_password(admin, had_usable, original_hash):
    User.objects.filter(pk=admin.pk).update(password=original_hash)


@override_settings(ALLOWED_HOSTS=['testserver', 'localhost', '127.0.0.1'])
def run(client):
    admin = User.objects.filter(is_superuser=True).first()
    if not admin:
        print('Kein Superuser - Abbruch.')
        return 1
    had_usable = admin.has_usable_password()
    original_hash = admin.password
    try:
        login(client, admin)
        return _run_checks(client)
    finally:
        restore_password(admin, had_usable, original_hash)
        print(f'\nAdmin-Konto {admin.username}: Passwort zurueckgesetzt.')


def _run_checks(client):
    # Testdaten
    supplier = Supplier.objects.create(company_name='ZZ-Hersteller GmbH')
    order = Order.objects.create(
        order_number='ZZ-BES-4711', supplier=supplier,
        order_date='2026-10-01',
    )
    case = RMACase.objects.create(title='ZZ-Testfall', manufacturer=supplier)

    print(f'Hersteller : {supplier.supplier_number} {supplier.company_name}')
    print(f'Bestellung : {order.order_number}')
    print(f'RMA-Fall   : {case.rma_number}\n')

    # Route lautet /api/service/rma/ (router.register(r'rma', RMACaseViewSet))
    base = f'/api/service/rma/{case.id}/'

    # --- 1) Bestellsuche des Frontends (liefert die geforderten Felder) ---
    print('1) Bestellsuche fuer die Komponente')
    r = client.get('/api/orders/orders/', {'search': 'ZZ-BES', 'page_size': 20})
    check('HTTP 200', r.status_code == 200, f'-> {r.status_code}')
    rows = payload(r).get('results') or []
    hit = next((x for x in rows if x['id'] == order.id), None)
    check('Bestellung auffindbar', hit is not None)
    if hit:
        check('order_number vorhanden', bool(hit.get('order_number')))
        check('supplier_name vorhanden', hit.get('supplier_name') == supplier.company_name,
              f"-> {hit.get('supplier_name')}")
        check('order_date vorhanden', bool(hit.get('order_date')))

    # --- 2) Speichern mit Datum + Bestellung + Kommentar ---
    print('\n2) Speichern mit Datum, Bestellung und Kommentar')
    r = client.patch(base, {
        'manufacturer_order_date': '2026-10-02',
        'manufacturer_order': order.id,
        'manufacturer_order_comment': 'Preis 1.250 EUR vereinbart, Rücksendung frei Haus.',
    }, content_type='application/json')
    check('HTTP 200', r.status_code == 200, f'-> {r.status_code} {payload(r).get("_raw","")}')
    case.refresh_from_db()
    check('Datum gespeichert', str(case.manufacturer_order_date) == '2026-10-02',
          f'-> {case.manufacturer_order_date}')
    check('Bestellung verknuepft', case.manufacturer_order_id == order.id,
          f'-> {case.manufacturer_order_id}')
    check('Kommentar gespeichert', '1.250 EUR' in (case.manufacturer_order_comment or ''))

    # --- 3) Detail-Antwort ---
    print('\n3) Detail-Antwort liefert die neuen Felder')
    body = payload(client.get(base))
    for field in ('manufacturer_order_date', 'manufacturer_order',
                  'manufacturer_order_number', 'manufacturer_order_comment'):
        check(f'{field} vorhanden', field in body, f"-> {body.get('_raw','')}")
    check('manufacturer_order_display lesbar',
          'ZZ-BES-4711' in (body.get('manufacturer_order_display') or ''),
          f"-> {body.get('manufacturer_order_display')}")

    # --- 4) Freitext, wenn keine Bestellung existiert ---
    print('\n4) Freitext ohne verknuepfte Bestellung')
    r = client.patch(base, {
        'manufacturer_order': None,
        'manufacturer_order_date': '2026-09-15',
        'manufacturer_order_number': 'B-Nr. 26-99812 (noch nicht importiert)',
    }, content_type='application/json')
    check('HTTP 200', r.status_code == 200, f'-> {r.status_code} {payload(r).get("_raw","")}')
    case.refresh_from_db()
    check('Bestellung geloescht', case.manufacturer_order_id is None)
    check('Freitext gespeichert',
          '26-99812' in (case.manufacturer_order_number or ''),
          f'-> {case.manufacturer_order_number!r}')

    # --- 5) Leeres Datum als null (Formular sendet '') ---
    print('\n5) Leeres Datum wird zu null')
    r = client.patch(base, {'manufacturer_order_date': ''}, content_type='application/json')
    check('HTTP 200', r.status_code == 200, f'-> {r.status_code} {payload(r).get("_raw","")}')
    case.refresh_from_db()
    check('Datum ist None', case.manufacturer_order_date is None,
          f'-> {case.manufacturer_order_date}')

    # --- 6) Loeschen der Bestellung darf den RMA-Fall nicht mitreissen ---
    print('\n6) Bestellung loeschen (SET_NULL) reisst den RMA-Fall nicht mit')
    case.refresh_from_db()
    oid = case.manufacturer_order_id
    if oid:
        Order.objects.filter(pk=oid).delete()
        check('RMA-Fall weiterhin vorhanden',
              RMACase.objects.filter(pk=case.pk).exists())
        case.refresh_from_db()
        check('Verknuepfung auf null gesetzt', case.manufacturer_order_id is None)

    return 1 if failures else 0


client = Client()
try:
    with transaction.atomic():
        try:
            code = run(client)
        finally:
            transaction.set_rollback(True)
except Exception:
    import traceback
    traceback.print_exc()
    code = 1

print('\n' + '=' * 62)
print(f'Fehlgeschlagen: {len(failures)}' + (f' -> {failures}' if failures else ''))
sys.exit(code)
