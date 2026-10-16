"""
Loescht Lagerartikel ohne Seriennummer und ohne Bestellreferenz.

Artikel mit Seriennummer oder Bestellreferenz bleiben erhalten. Als
Bestellreferenz gelten Best-Nr. (management_info.external_ref), Auftrag
(customer_order_number / management_info.order_number_raw), order_number sowie
eine verknuepfte Bestellung oder ein verknuepfter Kundenauftrag. Kunden-,
Namens- oder Statusangaben allein schuetzen einen Artikel nicht.

Standard ist ein Dry-Run. Erst --live loescht tatsaechlich; immer wird ein
CSV-Report geschrieben. Vor dem Live-Lauf unbedingt den Report pruefen.

    python manage.py cleanup_empty_inventory_items
    python manage.py cleanup_empty_inventory_items --live
"""

import csv
from collections import Counter
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand
from django.conf import settings

from inventory.models import InventoryItem
from inventory.excel_sync import (
    clean_serial_number,
    is_placeholder,
)

REPORT_FIELDS = [
    'action', 'inventory_number', 'name', 'article_number',
    'supplier_number', 'supplier_name', 'serial_number', 'customer_name',
    'order_number', 'customer_order_number', 'visitron_part_number',
    'stored_at', 'source_file', 'source_row',
]


def is_empty_item(item):
    """True, wenn Seriennummer und alle Bestellreferenzen fehlen."""
    serial = clean_serial_number(item.serial_number)
    if serial and not is_placeholder(serial):
        return False
    if item.order_id is not None or item.customer_order_id is not None:
        return False
    if not is_placeholder(item.order_number):
        return False
    if not is_placeholder(item.customer_order_number):
        return False
    info = item.management_info or {}
    if not is_placeholder(str(info.get('external_ref') or '')):
        return False
    if not is_placeholder(str(info.get('order_number_raw') or '')):
        return False
    return True


class Command(BaseCommand):
    help = (
        'Loescht Lagerartikel ohne Seriennummer und Bestellreferenz. '
        'Standard: Dry-Run. Mit --live wird geloescht.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--live',
            action='store_true',
            help='Tatsaechlich loeschen (ohne --live wird nur gezaehlt)',
        )
        parser.add_argument(
            '--supplier-number',
            type=str,
            default=None,
            help='Nur Artikel dieses Lieferanten (z.B. 226) betrachten',
        )
        parser.add_argument(
            '--stored-since',
            type=str,
            default=None,
            help='Nur Artikel, die ab diesem Datum eingelagert wurden (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Hoechstens so viele Artikel betrachten (zum Testen)',
        )
        parser.add_argument(
            '--report',
            type=str,
            default=None,
            help='Pfad fuer die CSV-Reportdatei',
        )

    # ------------------------------------------------------------------
    # Helfer
    # ------------------------------------------------------------------

    def _resolve_report_path(self, option_value):
        if option_value:
            return Path(option_value)
        log_dir = Path(settings.BASE_DIR) / 'logs'
        stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return log_dir / f'cleanup_empty_inventory_{stamp}.csv'

    def _report_row(self, action, item):
        return {
            'action': action,
            'inventory_number': item.inventory_number,
            'name': item.name,
            'article_number': item.article_number,
            'supplier_number': item.supplier.supplier_number if item.supplier_id else '',
            'supplier_name': item.supplier.company_name if item.supplier_id else '',
            'serial_number': item.serial_number,
            'customer_name': item.customer_name,
            'order_number': item.order_number,
            'customer_order_number': item.customer_order_number,
            'visitron_part_number': item.visitron_part_number,
            'stored_at': item.stored_at.isoformat(timespec='seconds') if item.stored_at else '',
            'source_file': item.source_file,
            'source_row': item.source_row or '',
        }

    # ------------------------------------------------------------------
    # Hauptlauf
    # ------------------------------------------------------------------

    def handle(self, *args, **options):
        live = options['live']
        limit = options['limit']

        report_path = self._resolve_report_path(options.get('report'))
        report_path.parent.mkdir(parents=True, exist_ok=True)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'Bereinigung leerer Lagerartikel  ({"LIVE" if live else "DRY-RUN"})'
        ))
        self.stdout.write(
            'Kriterium: keine Seriennummer und keine Bestellreferenz '
            '(Best-Nr., Auftrag, order_number, Kundenauftrag)'
        )

        qs = InventoryItem.objects.select_related('supplier').order_by('stored_at')
        if options.get('supplier_number'):
            qs = qs.filter(supplier__supplier_number=options['supplier_number'])
            self.stdout.write(f'Filter Lieferant : {options["supplier_number"]}')
        if options.get('stored_since'):
            try:
                since = datetime.strptime(options['stored_since'], '%Y-%m-%d')
            except ValueError:
                self.stderr.write(self.style.ERROR('--stored-since braucht YYYY-MM-DD'))
                return
            qs = qs.filter(stored_at__gte=since)
            self.stdout.write(f'Filter Eingelagert ab: {options["stored_since"]}')

        candidates = []
        for item in qs.iterator():
            if not is_empty_item(item):
                continue
            candidates.append(item)
            if limit and len(candidates) >= limit:
                break

        self.stdout.write('')
        self.stdout.write(f'Gefundene Artikel ohne Seriennummer/Bestellreferenz: {len(candidates)}')
        if not candidates:
            self.stdout.write(self.style.SUCCESS('Nichts zu tun - Lager ist sauber.'))
            return

        # Nach Quelle und Eingelagert-Datum gruppieren, damit erkennbar ist,
        # aus welchem Import die Artikel stammen (Altbestand vs. Sync-Laeufe).
        by_source = Counter((c.source_file or '(ohne Quelldatei)') for c in candidates)
        by_month = Counter(
            c.stored_at.strftime('%Y-%m') if c.stored_at else '(ohne Datum)'
            for c in candidates
        )
        self.stdout.write('')
        self.stdout.write('Nach Quelldatei:')
        for name, count in by_source.most_common(15):
            self.stdout.write(f'  {count:6d}  {name}')
        self.stdout.write('Nach Eingelagert-Monat:')
        for month, count in sorted(by_month.items()):
            self.stdout.write(f'  {count:6d}  {month}')

        self.stdout.write('')
        self.stdout.write('Beispiele:')
        for item in candidates[:25]:
            self.stdout.write(self._safe(
                f'  {item.inventory_number}  Lieferant '
                f'{item.supplier.supplier_number if item.supplier_id else "-"} '
                f'{(item.supplier.company_name if item.supplier_id else "")[:24]:24} '
                f'| Name: {(item.name or "")[:40]} '
                f'| Quelle: {item.source_file or "-"}'
            ))

        # Report schreiben (Dry-Run wie Live - zum Nachsehen vor dem Loeschen)
        with open(report_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=REPORT_FIELDS)
            writer.writeheader()
            for item in candidates:
                writer.writerow(self._report_row(
                    'deleted' if live else 'would_delete', item
                ))

        deleted = 0
        errors = 0
        if live:
            self.stdout.write('')
            for item in candidates:
                try:
                    item.delete()
                    deleted += 1
                except Exception as exc:  # z.B. unerwarteter Schutz-FK
                    errors += 1
                    self.stderr.write(self.style.ERROR(
                        f'  {item.inventory_number} nicht loeschbar: {exc}'
                    ))

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Zusammenfassung'))
        self.stdout.write(f'  Artikel gefunden       : {len(candidates)}')
        if live:
            self.stdout.write(f'  Geloescht              : {deleted}')
            self.stdout.write(f'  Fehler                 : {errors}')
        else:
            self.stdout.write('  Geloescht              : 0 (Dry-Run - mit --live loeschen)')
        self.stdout.write(f'  Report                 : {report_path}')

    def _safe(self, text, limit=None):
        if text is None:
            return ''
        text = str(text)
        if limit:
            text = text[:limit]
        return text.encode('utf-8', errors='replace').decode('utf-8')
