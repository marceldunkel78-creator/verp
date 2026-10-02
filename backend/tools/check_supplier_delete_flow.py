"""
End-to-End-Test des Lieferanten-Lösch-Dialogs über die echte REST-API.

Deckt genau die Sequenz ab, die im Browser den Absturz ausgelöst hat:
  1. Kachel laden          GET  /suppliers/suppliers/
  2. Verknüpfungen laden    GET  /suppliers/suppliers/{id}/link_summary/
  3. Löschen MIT Umhängen   POST /suppliers/suppliers/{id}/delete_with_reassign/
  4. Danach die Liste neu laden (der Dialog schließt sich, supplier wird null)

Aufruf:
    python tools/check_supplier_delete_flow.py
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

User = get_user_model()

# KEIN Standardwert: das Testpasswort wird ausschliesslich per
# Umgebungsvariable gesetzt (VERP_TEST_PASSWORD). Sonst wandert ein
# Klartextpasswort in die Git-Historie und kollidiert auf dem Server
# mit dem echten postgres-Konto.
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
    """Antwort als Dict, ohne bei HTML-Fehlern zu explodieren."""
    try:
        return response.json()
    except ValueError:
        return {'_raw': response.content[:300].decode('utf-8', 'replace')}


def login(client, admin):
    """
    Meldet den Admin über den echten Login-Endpunkt an.

    Das Projekt nutzt JWT im HttpOnly-Cookie (`JWTCookieAuthentication`),
    `client.force_login()` greift daher nicht. Also den echten Weg gehen:
    Passwort setzen, einloggen, das gesetzte Cookie mitnehmen.

    ACHTUNG: `set_password()` schreibt sofort in die Datenbank. Der
    Rollback am Ende des Laufs macht das NICHT rückgängig, wenn das Passwort
    vorher unbrauchbar war (`set_unusable_password`) - der "unbrauchbar"-Zustand
    ist keine gespeicherte Datenbankzeile, sondern nur die Property des
    Objekts. Deshalb wird der Ausgangszustand hier gesichert und am Ende
    wiederhergestellt. Andernfalls bleibt ein Superuser mit Test-Passwort
    "Test-Passwort" zurück. Das Passwort selbst kommt aus
    VERP_TEST_PASSWORD (kein fester Wert im Code).
    """
    had_usable = admin.has_usable_password()
    original_hash = admin.password

    if not TEST_PASSWORD:
        raise RuntimeError(
            'VERP_TEST_PASSWORD ist nicht gesetzt. Beispiel (PowerShell):\n'
            "  $env:VERP_TEST_PASSWORD = 'mein-testpasswort'"
        )

    admin.set_password(TEST_PASSWORD)
    admin.save(update_fields=['password'])

    response = client.post(
        '/api/auth/login/',
        {'username': admin.username, 'password': TEST_PASSWORD},
        content_type='application/json',
    )
    if response.status_code != 200:
        _restore_password(admin, had_usable, original_hash)
        raise RuntimeError(f'Login fehlgeschlagen: {response.status_code}')
    return client


def _restore_password(admin, had_usable, original_hash):
    """Setzt das Passwort des Admin-Kontos auf den Ausgangszustand zurueck."""
    User.objects.filter(pk=admin.pk).update(password=original_hash)
    if not had_usable:
        admin.password = original_hash
    return admin


@override_settings(ALLOWED_HOSTS=['testserver', 'localhost', '127.0.0.1'])
def run():
    client = Client()

    admin = User.objects.filter(is_superuser=True).first()
    if not admin:
        print('Kein Superuser in der Datenbank - Abbruch.')
        return 1

    # Ausgangszustand des Passworts merken, um ihn danach wiederherzustellen.
    had_usable = admin.has_usable_password()
    original_hash = admin.password
    try:
        login(client, admin)
        return _run_checks(client, admin)
    finally:
        _restore_password(admin, had_usable, original_hash)
        print(f'\nAdmin-Konto {admin.username}: Passwort auf Ausgangszustand gesetzt.')


def _run_checks(client, admin):
    # Zwei Lieferanten als Quelle/Ziel, Absichtlich aehnlich benannt wie der
    # Import-Dublette: "100 - ..." neben dem echten.
    source = Supplier.objects.create(company_name='ZZ-Testquelle')
    target = Supplier.objects.create(company_name='ZZ-Testziel')

    from inventory.models import InventoryItem
    from orders.models import Order

    items = [
        InventoryItem.objects.create(
            name=f'ZZ-Objekt {i}', article_number=f'ZZ-{i}', supplier=source,
            quantity=1, item_function='TRADING_GOOD', status='FREI',
            purchase_price=0,
        )
        for i in range(3)
    ]
    orders = [
        Order.objects.create(
            order_number=f'ZZ-O-{i}', supplier=source, order_date='2026-10-02',
        )
        for i in range(2)
    ]
    print(f'\nQuelle  : {source.supplier_number} {source.company_name} (ID {source.id})')
    print(f'Ziel    : {target.supplier_number} {target.company_name} (ID {target.id})')
    print(f'Verknuepft: {len(items)} Lagerartikel, {len(orders)} Bestellungen\n')

    # --- 1) Liste mit Kennzahlen ---
    print('1) Lieferantenliste (Kachelzahlen)')
    r = client.get('/api/suppliers/suppliers/', {'search': 'ZZ-Testquelle'})
    check('HTTP 200', r.status_code == 200, f'-> {r.status_code}')
    rows = (payload(r).get('results') or [])
    row = next((x for x in rows if x['id'] == source.id), None)
    check('Lieferant in der Liste', row is not None)
    if row:
        check('Lagerartikel-Zahl = 3', row['inventory_items_count'] == 3,
              f"-> {row['inventory_items_count']}")
        check('Bestellungen-Zahl = 2', row['orders_count'] == 2,
              f"-> {row['orders_count']}")

    # --- 1b) Kontakte/Warengruppen/Preislisten in der Liste (Regression) ---
    print('\n1b) Kontakt-/Warengruppen-/Preislistenzahl in der Liste')
    from suppliers.models import PriceList, ProductGroup, SupplierContact
    for i in range(4):
        SupplierContact.objects.create(
            supplier=source, contact_type='service', contact_person=f'P{i}',
        )
    ProductGroup.objects.create(supplier=source, name='Standard', discount_percent=0)
    PriceList.objects.create(supplier=source, name='2026', valid_from='2026-01-01')

    r = client.get('/api/suppliers/suppliers/', {'search': 'ZZ-Testquelle'})
    rows = (payload(r).get('results') or [])
    row = next((x for x in rows if x['id'] == source.id), None)
    check('HTTP 200', r.status_code == 200, f'-> {r.status_code}')
    if row:
        check('Kontakte-Zahl = 4 (nicht 0!)', row.get('contacts_count') == 4,
              f"-> {row.get('contacts_count')}")
        check('Warengruppen-Zahl = 1', row.get('product_groups_count') == 1,
              f"-> {row.get('product_groups_count')}")
        check('Preislisten-Zahl = 1', row.get('price_lists_count') == 1,
              f"-> {row.get('price_lists_count')}")
        check('keine verschachtelten Objekte in der Liste',
              'contacts' not in row and 'product_groups' not in row)
        # Gegenprobe: die Zahl muss der DB entsprechen
        check('Kontakte-Zahl stimmt mit der DB ueberein',
              row.get('contacts_count') == SupplierContact.objects.filter(
                  supplier_id=source.id).count())

    # --- 2) Verknüpfungsuebersicht ---
    print('\n2) Verknuepfungsuebersicht (link_summary)')
    r = client.get(f'/api/suppliers/suppliers/{source.id}/link_summary/')
    check('HTTP 200', r.status_code == 200, f'-> {r.status_code}')
    data = payload(r)
    check('Lieferantenname im Antwort',
          data.get('supplier', {}).get('company_name') == 'ZZ-Testquelle',
          f"-> {data.get('_raw', '')}")
    check('kann ohne Umhaengen nicht geloescht werden', data.get('can_delete') is False)
    links = {l['key']: l for l in data.get('links', [])}
    if not links:
        check('Verknuepfungen geliefert', False, f"-> {data.get('_raw', '')}")
    else:
        check('Lagerartikel erkannt', links['inventory_items']['count'] == 3,
              f"-> {links['inventory_items']['count']}")
        check('Bestellungen erkannt', links['orders']['count'] == 2,
              f"-> {links['orders']['count']}")
        check('Bestellungen blockieren das Loeschen',
              links['orders']['blocks_delete'] is True)
        check('Beispiel-Eintraege geliefert',
              bool(links['inventory_items']['samples']),
              f"-> {links['inventory_items']['samples']}")

    # --- 3) Loeschen OHNE Umhaengen muss scheitern ---
    print('\n3) Loeschen ohne Umhaengen muss abgelehnt werden')
    r = client.post(
        f'/api/suppliers/suppliers/{source.id}/delete_with_reassign/',
        {'confirm': True, 'reassign_to': None}, content_type='application/json',
    )
    check('abgelehnt (400)', r.status_code == 400, f'-> {r.status_code}')
    check('Lieferant noch vorhanden',
          Supplier.objects.filter(pk=source.id).exists())

    # --- 4) Loeschen MIT Umhaengen ---
    print('\n4) Loeschen MIT Umhaengen auf den Ziel-Lieferanten')
    r = client.post(
        f'/api/suppliers/suppliers/{source.id}/delete_with_reassign/',
        {'confirm': True, 'reassign_to': target.id, 'dry_run': False},
        content_type='application/json',
    )
    check('HTTP 200', r.status_code == 200, f'-> {r.status_code} {r.content[:200]}')
    if r.status_code == 200:
        body = payload(r)
        check('Erfolgsmeldung mit Firmenname', 'ZZ-Testquelle' in body.get('message', ''),
              f"-> {body.get('_raw', '')}")
        check('Quell-Lieferant geloescht',
              not Supplier.objects.filter(pk=source.id).exists())
        check('3 Lagerartikel am Ziel',
              InventoryItem.objects.filter(supplier=target).count() == 3,
              f"-> {InventoryItem.objects.filter(supplier=target).count()}")
        check('2 Bestellungen am Ziel',
              Order.objects.filter(supplier=target).count() == 2,
              f"-> {Order.objects.filter(supplier=target).count()}")

    # --- 5) Liste nach dem Loeschen (supplier ist jetzt null) ---
    print('\n5) Liste nach dem Loeschen neu laden')
    r = client.get('/api/suppliers/suppliers/', {'search': 'ZZ-Test'})
    check('HTTP 200', r.status_code == 200, f'-> {r.status_code}')
    rows = (payload(r).get('results') or [])
    check('Quell-Lieferant nicht mehr in der Liste',
          all(x['id'] != source.id for x in rows))
    zz = next((x for x in rows if x['id'] == target.id), None)
    check('Ziel-Lieferant zeigt jetzt 3 / 2',
          zz is not None
          and zz['inventory_items_count'] == 3
          and zz['orders_count'] == 2,
          f"-> {zz['inventory_items_count']}/{zz['orders_count']}" if zz else 'fehlt')

    return 1 if failures else 0


try:
    with transaction.atomic():
        try:
            code = run()
        finally:
            transaction.set_rollback(True)
except Exception:
    import traceback
    traceback.print_exc()
    code = 1

print('\n' + '=' * 62)
print(f'Fehlgeschlagen: {len(failures)}' + (f' -> {failures}' if failures else ''))
sys.exit(code)
