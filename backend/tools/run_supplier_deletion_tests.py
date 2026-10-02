"""
Hilfs-Skript: fuehrt die Lieferanten-Tests aus, OHNE Testdatenbank anzulegen.

Hintergrund
------------
`manage.py test` braucht eine eigene Datenbank (`CREATE DATABASE`). Der
DB-Benutzer `verp_user` hat dieses Recht nicht ("keine Berechtigung, um
Datenbank zu erzeugen"), deshalb bricht der Testrunner ab.

Das Skript umgeht das, indem jeder Test in einer Transaktion laeuft, die am
Ende zurueckgerollt wird - exakt das Prinzip von `django.test.TestCase`. Die
echten Constraints werden dabei voll pruefbar:

  * `on_delete=PROTECT`   -> muss beim Loeschen greifen
  * `unique_together`     -> Umhaengen darf keine Kollision erzeugen
  * `unique` Spalten      -> visitron_part_number

Es werden also KEINE Daten zurueckgelassen. Trotzdem: nur gegen die
Entwicklungsdatenbank laufen lassen, nicht gegen die Produktion.

Aufruf:
    python tools/run_supplier_deletion_tests.py
"""

import os
import sys
import traceback

import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db import transaction  # noqa: E402

from suppliers.tests import (  # noqa: E402
    BlockingLinkTests,
    DuplicateDetectionTests,
    GuardTests,
    ListSerializerCountTests,
    ReassignTests,
    VisitronNumberTests,
)

CLASSES = [
    GuardTests,
    BlockingLinkTests,
    ReassignTests,
    VisitronNumberTests,
    ListSerializerCountTests,
    DuplicateDetectionTests,
]


def run_one(cls, method_name):
    """Fuehrt setUp + Testmethode eines Testfalls aus."""
    case = cls(method_name)
    getattr(case, 'setUp', lambda: None)()
    getattr(case, method_name)()


def main():
    passed, failed = 0, []

    for cls in CLASSES:
        names = sorted(m for m in dir(cls) if m.startswith('test_'))
        print(f'\n{cls.__name__} ({len(names)} Tests)')
        print('-' * (len(cls.__name__) + 12))
        for name in names:
            try:
                with transaction.atomic():
                    run_one(cls, name)
                    # Alles zurueckrollen - kein Test darf Daten hinterlassen.
                    transaction.set_rollback(True)
                passed += 1
                print(f'  OK    {name}')
            except Exception as exc:  # noqa: BLE001
                failed.append((cls.__name__, name, exc))
                print(f'  FAIL  {name}')
                traceback.print_exc(limit=8)
                # Verbindung aus einem kaputten Zustand befreien
                connection = transaction.get_connection()
                if connection.in_atomic_block:
                    connection.set_rollback(True)

    print('\n' + '=' * 62)
    print(f'Ergebnis: {passed} bestanden, {len(failed)} fehlgeschlagen')
    for cls_name, test_name, exc in failed:
        print(f'  {cls_name}.{test_name}: {exc}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
