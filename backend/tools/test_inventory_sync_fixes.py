"""
Testet die Fixes 2026-10-06 am Excel-Lagerabgleich.

Geprueft wird:
  1. Leere Zeilen (ohne Seriennummer, ohne Kunde, ohne Bestellnummer) werden
     NICHT importiert (skip_empty).
  2. Unbekannte Lieferanten erzeugen KEINE neuen Stammdaten mehr - der Artikel
     faellt auf den Platzhalter "Unbekannt" zurueck.
  3. Ein zweiter Lauf legt nichts doppelt an (kein Vermehren mehr).
  4. cleanup_empty_inventory_items findet genau die leeren Artikel (Kriterium)
     und loescht sie mit --live.

SICHERHEIT: der komplette Lauf steckt in einer Transaktion, die am Ende
zurueckgerollt wird. Es bleibt also NICHTS in der Datenbank - auch kein
Test-Lieferant und keine Test-Artikel. Wie bei den anderen tools/-Skripten
nur auf der ENTWICKLUNGSDATENBANK ausfuehren.

Aufruf:
    cd backend
    ..\\.venv\\Scripts\\python.exe tools\\test_inventory_sync_fixes.py
"""
import io
import os
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')

import django  # noqa: E402
django.setup()

from django.core.management import CommandError  # noqa: E402
from django.db import transaction  # noqa: E402
from openpyxl import Workbook  # noqa: E402

from inventory.models import InventoryItem  # noqa: E402
from suppliers.models import Supplier  # noqa: E402
from inventory.management.commands.sync_inventory_from_excel import (  # noqa: E402
    Command as SyncCommand,
)
from inventory.management.commands.cleanup_empty_inventory_items import (  # noqa: E402
    Command as CleanupCommand,
    is_empty_item,
)

PASS = []
FAIL = []


def check(label, condition, detail=''):
    if condition:
        PASS.append(label)
        print(f'  OK   {label}')
    else:
        FAIL.append(label)
        print(f'  FAIL {label}  {detail}')


def run_sync(tmp, dry_run=False):
    out = io.StringIO()
    cmd = SyncCommand(stdout=out, stderr=out)
    error = None
    try:
        cmd.handle(
            path=str(tmp), pattern='*.xlsx', dry_run=dry_run,
            report=str(tmp / 'report.csv'), since=None, no_fuzzy=False,
            limit=None, no_recursive=True, exclude_dirs='',
        )
    except CommandError as exc:
        error = str(exc)
    return getattr(cmd, 'last_run', None) or {}, out.getvalue(), error


def build_test_file(tmp):
    wb = Workbook()
    ws = wb.active
    ws.title = 'Testblatt'
    ws.append(['Kategorie', 'Lfd. Nr.', 'Best.-Nr.', 'S/N', 'Kunde',
               'Auftrag', 'Lieferant', 'Produktname'])
    # Zeile 1: "leer" im Sinne des Filters - nur ein Name, sonst nichts
    ws.append(['TestKat', '', '', '', '', '', '', 'Leerzeilen-Test'])
    # Zeile 2: nur Kategorie -> klassische Muellzeile (is_empty)
    ws.append(['TestKat', '', '', '', '', '', '', ''])
    # Zeile 3: Best-Nr. + unbekannter Lieferant -> Fallback, KEIN neuer Lieferant
    # (Name bewusst so, dass ihn weder exakt noch unscharf ein Stamm-Lieferant
    # matcht - "...Unbekannt..." waere auf den Platzhalter gelaufen)
    ws.append(['TestKat', '1', 'TST-001', '', '', '', 'Zzz-Testlieferant Nichtvorhanden7',
               'Testartikel A'])
    # Zeile 4: Seriennummer + unbekannter Lieferant -> Fallback
    ws.append(['TestKat', '2', '', 'TSTSN123', '', '', 'Zzz-Testlieferant Nichtvorhanden7',
               'Testartikel B'])
    # Zeile 5: Seriennummer + BEKANNTER Lieferant (89North gibt es in der Dev-DB)
    ws.append(['TestKat', '3', '', 'TSTSN999', '', '', '89North', 'Testartikel C'])
    wb.save(tmp / 'test_lager.xlsx')


def main():
    print('=== Test: Excel-Lagerabgleich-Fixes (Rollback-Transaktion) ===\n')

    with transaction.atomic():
        tmp_path = Path(tempfile.mkdtemp(prefix='verp_sync_test_'))
        build_test_file(tmp_path)

        suppliers_before = Supplier.objects.count()
        items_before = InventoryItem.objects.count()

        print('1) Erster Lauf (live, in Transaktion):')
        run1, out1, err1 = run_sync(tmp_path)
        s1 = run1.get('stats', {})
        print(f'   stats: {dict(s1)}')
        if err1:
            print(f'   Hinweis: CommandError -> {err1}')

        check('leere Zeile wird als skip_empty gezaehlt', s1.get('empty') == 1,
              f"empty={s1.get('empty')}")
        check('Muellzeile ohne alles bleibt is_empty/skip', s1.get('skip', 0) >= 1,
              f"skip={s1.get('skip')}")
        check('3 echte Artikel angelegt', s1.get('create') == 3,
              f"create={s1.get('create')}")
        check('KEINE neuen Lieferanten angelegt',
              Supplier.objects.count() == suppliers_before,
              f"{Supplier.objects.count()} vs {suppliers_before}")
        check('Fallback-Warnung steht in der Ausgabe',
              'nicht im Stamm' in out1, '')
        check('Anzahl Items = vorher + 3',
              InventoryItem.objects.count() == items_before + 3,
              f"{InventoryItem.objects.count()} vs {items_before + 3}")

        junk = InventoryItem.objects.filter(name='Leerzeilen-Test').count()
        check('die leere Zeile wurde NICHT angelegt', junk == 0, f'junk={junk}')

        print('\n2) Zweiter Lauf (gleiche Daten - darf nichts doppelt anlegen):')
        run2, out2, err2 = run_sync(tmp_path)
        s2 = run2.get('stats', {})
        print(f'   stats: {dict(s2)}')
        check('zweiter Lauf: 0 neu angelegt', s2.get('create') == 0,
              f"create={s2.get('create')}")
        # skip = 3 wiedererkannte Artikel + 1 klassische Muellzeile (is_empty)
        check('zweiter Lauf: alle 4 bekannten Zeilen uebersprungen',
              s2.get('skip') == 4, f"skip={s2.get('skip')}")
        check('zweiter Lauf: leere Zeile weiterhin uebersprungen',
              s2.get('empty') == 1, f"empty={s2.get('empty')}")
        check('keine Vermehrung der Items',
              InventoryItem.objects.count() == items_before + 3,
              f"{InventoryItem.objects.count()}")

        print('\n3) Cleanup-Kriterium (is_empty_item):')
        placeholder = Supplier.objects.get(company_name='Unbekannt')
        garbage = InventoryItem.objects.create(
            name='Test-Muell (leer)', supplier=placeholder,
            article_number='TST-EMPTY-1', item_function='TRADING_GOOD',
            purchase_price=0,
        )
        control = InventoryItem.objects.create(
            name='Test-Kontrolle (mit S/N)', supplier=placeholder,
            article_number='TST-CONTROL-1', item_function='ASSET',
            serial_number='KEEPME1', purchase_price=0,
        )
        check('leerer Artikel wird erkannt', is_empty_item(garbage),
              'garbage nicht leer?')
        check('Artikel MIT Seriennummer bleibt verschont',
              not is_empty_item(control), 'control faelschlich leer?')

        print('\n4) cleanup_empty_inventory_items --live (in Transaktion):')
        outc = io.StringIO()
        CleanupCommand(stdout=outc, stderr=outc).handle(
            live=True, supplier_number=None, stored_since=None,
            limit=None, report=str(tmp_path / 'cleanup.csv'),
        )
        check('leerer Artikel wurde geloescht',
              not InventoryItem.objects.filter(pk=garbage.pk).exists(), '')
        check('Kontrollartikel ueberlebt',
              InventoryItem.objects.filter(pk=control.pk).exists(), '')

        print('\n5) Dry-Run des Cleanup (aendert nichts):')
        before = InventoryItem.objects.count()
        outc2 = io.StringIO()
        CleanupCommand(stdout=outc2, stderr=outc2).handle(
            live=False, supplier_number=None, stored_since=None,
            limit=None, report=str(tmp_path / 'cleanup_dry.csv'),
        )
        check('Dry-Run loescht nichts', InventoryItem.objects.count() == before,
              f'{InventoryItem.objects.count()} vs {before}')

        print('\nAlles zurueckrollen ...')
        transaction.set_rollback(True)

    print(f'\n=== ERGEBNIS: {len(PASS)} OK, {len(FAIL)} FEHLGESCHLAGEN ===')
    if FAIL:
        for label in FAIL:
            print(f'  FEHLER: {label}')
        sys.exit(1)
    print('Alle Tests bestanden. Es wurde NICHTS veraendert (Rollback).')


if __name__ == '__main__':
    main()
