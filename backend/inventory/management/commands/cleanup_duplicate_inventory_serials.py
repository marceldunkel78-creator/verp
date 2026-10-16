"""Bereinigt Lagerartikel mit doppelten normalisierten Seriennummern.

Standard ist ein Dry-Run. Ohne --live wird nichts geloescht. Pro Gruppe
bleibt die numerisch niedrigste Inventarnummer erhalten; alle anderen
werden im CSV-Report aufgefuehrt. Artikel mit bestehenden Verknuepfungen
werden nicht geloescht, damit diese Verknuepfungen nicht verloren gehen.
"""

import csv
from collections import defaultdict
from datetime import datetime
from pathlib import Path
import re

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from inventory.excel_sync import build_serial_key, clean_serial_number, is_placeholder
from inventory.models import InventoryItem


class Command(BaseCommand):
    help = (
        'Bereinigt Lagerartikel mit doppelten normalisierten Seriennummern. '
        'Standard: Dry-Run; mit --live werden unverknuepfte Duplikate geloescht.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--live', action='store_true',
            help='Tatsaechlich loeschen (ohne --live nur Dry-Run)',
        )
        parser.add_argument(
            '--report', type=str, default=None,
            help='Pfad fuer den CSV-Report (Default: backend/logs/cleanup_duplicate_inventory_serials_<timestamp>.csv)',
        )

    @staticmethod
    def _inventory_number_key(item):
        match = re.fullmatch(r'I-(\d+)', item.inventory_number or '', re.IGNORECASE)
        if match:
            return (0, int(match.group(1)), item.pk)
        return (1, item.inventory_number or '', item.pk)

    @staticmethod
    def _has_related_objects(item):
        """Check reverse FK/M2M relations before deleting referenced items."""
        for relation in item._meta.related_objects:
            if relation.related_model._base_manager.filter(
                **{relation.field.name: item}
            ).exists():
                return True
        return False

    def _report_path(self, option):
        if option:
            return Path(option)
        return Path(settings.BASE_DIR) / 'logs' / (
            f'cleanup_duplicate_inventory_serials_{datetime.now():%Y%m%d_%H%M%S}.csv'
        )

    def handle(self, *args, **options):
        groups = defaultdict(list)
        items = InventoryItem.objects.exclude(serial_number__isnull=True).exclude(
            serial_number=''
        ).only('id', 'inventory_number', 'serial_number', 'name').iterator()

        for item in items:
            serial = clean_serial_number(item.serial_number)
            if is_placeholder(serial):
                continue
            key = build_serial_key(serial)
            if key:
                groups[key].append(item)

        duplicate_groups = [group for group in groups.values() if len(group) > 1]
        duplicate_groups.sort(key=lambda group: min(
            self._inventory_number_key(item) for item in group
        ))

        report_path = self._report_path(options['report'])
        report_path.parent.mkdir(parents=True, exist_ok=True)
        live = options['live']
        group_count = 0
        delete_count = 0
        linked_count = 0
        delete_ids = []
        report_rows = []

        for group in duplicate_groups:
            group.sort(key=self._inventory_number_key)
            keeper = group[0]
            group_count += 1
            for duplicate in group[1:]:
                has_links = self._has_related_objects(duplicate)
                if has_links:
                    linked_count += 1
                else:
                    delete_count += 1
                    delete_ids.append(duplicate.pk)
                report_rows.append([
                    'linked_skip' if has_links else ('delete' if live else 'would_delete'),
                    build_serial_key(clean_serial_number(duplicate.serial_number)),
                    keeper.inventory_number, keeper.pk,
                    duplicate.inventory_number, duplicate.pk,
                    duplicate.serial_number, duplicate.name,
                    has_links,
                ])

        report_path.parent.mkdir(parents=True, exist_ok=True)
        with report_path.open('w', newline='', encoding='utf-8-sig') as report_file:
            writer = csv.writer(report_file)
            writer.writerow([
                'action', 'serial_key', 'keep_inventory_number', 'keep_id',
                'duplicate_inventory_number', 'duplicate_id', 'serial_number',
                'name', 'has_related_records',
            ])
            writer.writerows(report_rows)

        if live and delete_ids:
            with transaction.atomic():
                locked_ids = set(
                    InventoryItem.objects.select_for_update()
                    .filter(pk__in=delete_ids)
                    .values_list('pk', flat=True)
                )
                if locked_ids != set(delete_ids):
                    raise CommandError('Datensaetze haben sich waehrend des Laufs geaendert; nichts geloescht.')
                if any(
                    self._has_related_objects(item)
                    for item in InventoryItem.objects.filter(pk__in=delete_ids)
                ):
                    raise CommandError(
                        'Mindestens ein Duplikat hat verknuepfte Datensaetze; '
                        'nichts geloescht. Siehe Report.'
                    )
                InventoryItem.objects.filter(pk__in=delete_ids).delete()

        mode = 'LIVE' if live else 'DRY-RUN'
        self.stdout.write(
            f'{mode}: {group_count} Seriennummern-Gruppen, '
            f'{delete_count} loeschbare Duplikate, {linked_count} '
            f'verknuepfte Duplikate uebersprungen; Report: {report_path}'
        )
        if not live:
            self.stdout.write('Zum Loeschen nach Report-Pruefung erneut mit --live starten.')
