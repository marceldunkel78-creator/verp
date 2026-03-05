"""
Django Management Command: Bereinigt doppelte Maintenance-Zeitaufwendungen
und fehlerhafte Zeitgutschriften (0h Redmine-Credits).

Usage:
  python manage.py cleanup_maintenance_duplicates           # Dry-Run
  python manage.py cleanup_maintenance_duplicates --execute  # Tatsächlich löschen
"""
import re
from django.core.management.base import BaseCommand
from django.db.models import Count, Min
from visiview.models import MaintenanceTimeCredit, MaintenanceTimeExpenditure


def _normalize_comment(text):
    if not text:
        return ''
    return re.sub(r'\s+', ' ', text.strip())


class Command(BaseCommand):
    help = 'Bereinigt doppelte Maintenance-Zeitaufwendungen und fehlerhafte Zeitgutschriften'

    def add_arguments(self, parser):
        parser.add_argument(
            '--execute',
            action='store_true',
            help='Änderungen tatsächlich durchführen (ohne dieses Flag: Dry-Run)',
        )

    def handle(self, *args, **options):
        execute = options['execute']

        if execute:
            self.stdout.write(self.style.WARNING('=== AUSFÜHRUNGSMODUS ==='))
        else:
            self.stdout.write(self.style.NOTICE('=== DRY-RUN MODUS (mit --execute ausführen) ==='))

        deleted_credits = self._cleanup_zero_credits(execute)
        deleted_expenditures = self._cleanup_expenditure_duplicates(execute)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'--- Zusammenfassung ---'))
        self.stdout.write(f'Zeitgutschriften (0h) gelöscht:     {deleted_credits}')
        self.stdout.write(f'Zeitaufwendungen (Duplikate) gelöscht: {deleted_expenditures}')
        self.stdout.write(f'Gesamt gelöscht: {deleted_credits + deleted_expenditures}')

        # Final stats
        self.stdout.write('')
        self.stdout.write(f'Zeitgutschriften verbleibend: {MaintenanceTimeCredit.objects.count()}')
        self.stdout.write(f'Zeitaufwendungen verbleibend: {MaintenanceTimeExpenditure.objects.count()}')

    def _cleanup_zero_credits(self, execute):
        """Entfernt Redmine-Zeitgutschriften mit 0 Stunden (falsch importiert)."""
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Schritt 1: Zeitgutschriften mit 0h bereinigen'))

        zero_credits = MaintenanceTimeCredit.objects.filter(
            redmine_id__isnull=False,
            credit_hours=0,
        )
        count = zero_credits.count()
        self.stdout.write(f'  Redmine-Credits mit 0 Stunden: {count}')

        if count == 0:
            self.stdout.write('  Nichts zu bereinigen.')
            return 0

        for c in zero_credits[:5]:
            self.stdout.write(
                f'    id={c.id} redmine_id={c.redmine_id} lizenz={c.license_id} hours=0'
            )
        if count > 5:
            self.stdout.write(f'    ... und {count - 5} weitere')

        if execute:
            deleted, _ = zero_credits.delete()
            self.stdout.write(self.style.SUCCESS(f'  -> {deleted} gelöscht'))
            return deleted
        else:
            self.stdout.write(f'  -> Würde {count} löschen')
            return 0

    def _cleanup_expenditure_duplicates(self, execute):
        """Entfernt doppelte Zeitaufwendungen (normalisierter Kommentar-Vergleich)."""
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Schritt 2: Doppelte Zeitaufwendungen bereinigen'))

        dupes = (MaintenanceTimeExpenditure.objects
                 .values('license_id', 'date', 'hours_spent')
                 .annotate(cnt=Count('id'))
                 .filter(cnt__gt=1))

        to_delete_ids = []

        for d in dupes:
            entries = list(MaintenanceTimeExpenditure.objects.filter(
                license_id=d['license_id'],
                date=d['date'],
                hours_spent=d['hours_spent'],
            ).order_by('id'))

            # Gruppe nach normalisiertem Kommentar
            groups = {}
            for e in entries:
                norm = _normalize_comment(e.comment)
                groups.setdefault(norm, []).append(e)

            # Pro Gruppe: behalte den besten Eintrag
            for norm_comment, group in groups.items():
                if len(group) <= 1:
                    continue

                with_rid = [e for e in group if e.redmine_time_entry_id is not None]
                without_rid = [e for e in group if e.redmine_time_entry_id is None]

                if with_rid:
                    keep = with_rid[0]
                    remove = without_rid + with_rid[1:]
                else:
                    keep = group[0]
                    remove = group[1:]

                if remove:
                    self.stdout.write(
                        f'  Lizenz={d["license_id"]} {d["date"]} {d["hours_spent"]}h '
                        f'"{norm_comment[:40]}" -> behalte id={keep.id}, '
                        f'lösche {len(remove)}x'
                    )
                    to_delete_ids.extend(r.id for r in remove)

            # Prefix-Match über verschiedene normalisierte Kommentare
            norms = list(groups.keys())
            handled = set()
            for i in range(len(norms)):
                if norms[i] in handled:
                    continue
                for j in range(i + 1, len(norms)):
                    if norms[j] in handled:
                        continue
                    ni, nj = norms[i], norms[j]
                    if not ni or not nj or len(ni) <= 15 or len(nj) <= 15:
                        continue

                    if ni.startswith(nj[:20]) or nj.startswith(ni[:20]):
                        if len(groups[ni]) == 1 and len(groups[nj]) == 1:
                            e1, e2 = groups[ni][0], groups[nj][0]
                            if e1.id in to_delete_ids or e2.id in to_delete_ids:
                                continue

                            if e1.redmine_time_entry_id and not e2.redmine_time_entry_id:
                                keep, remove_e = e1, e2
                            elif e2.redmine_time_entry_id and not e1.redmine_time_entry_id:
                                keep, remove_e = e2, e1
                            else:
                                keep, remove_e = (e1, e2) if e1.id < e2.id else (e2, e1)

                            self.stdout.write(
                                f'  Lizenz={d["license_id"]} {d["date"]} {d["hours_spent"]}h '
                                f'PREFIX -> behalte id={keep.id}, lösche id={remove_e.id}'
                            )
                            to_delete_ids.append(remove_e.id)
                            handled.update([ni, nj])

        to_delete_ids = list(set(to_delete_ids))
        self.stdout.write(f'  Duplikate gefunden: {len(to_delete_ids)}')

        if not to_delete_ids:
            self.stdout.write('  Nichts zu bereinigen.')
            return 0

        if execute:
            deleted, _ = MaintenanceTimeExpenditure.objects.filter(id__in=to_delete_ids).delete()
            self.stdout.write(self.style.SUCCESS(f'  -> {deleted} gelöscht'))
            return deleted
        else:
            self.stdout.write(f'  -> Würde {len(to_delete_ids)} löschen')
            return 0
