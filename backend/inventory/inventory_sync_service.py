"""
Programmatischer Aufruf des Excel-Lagerabgleichs.

Wird vom Settings-Modul "Lager-Abgleich (Excel)" genutzt (analog zum
Legacy-Procurement-Import). Die Logik selbst steckt im Management-Command
`sync_inventory_from_excel` - diese Kapselung verpackt ihn in einen
aufrufbaren Funktionsaufruf mit strukturiertem Ergebnis.

Wichtig fuer Aufrufer: ein Lauf dauert je nach Datenbestand 1-2 Minuten
(Produktion: 74 Dateien, ~20.000 Zeilen, ~90 s). Der Aufruf ist bewusst
SYNCHRON - genau wie der Legacy-Procurement-Import.
"""

import io

from django.core.management import CommandError

from .management.commands.sync_inventory_from_excel import (
    Command as SyncCommand,
    get_setting,
)

SAMPLE_LIMIT = 150


def _as_positive_int(value):
    """Wandelt einen Request-Wert in eine positive int um (sonst None)."""
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def run_inventory_sync(user=None, dry_run=True, max_files=None, row_limit=None):
    """Fuehrt den Lagerabgleich aus und liefert eine strukturierte Auswertung.

    Args:
        user:      ausloesender Benutzer (nur zur Information)
        dry_run:   True = nichts speichern (Vorschau), False = echter Lauf
        max_files: nur die ersten N Dateien (Schnelltest). ACHTUNG: ein
                   begrenzter Live-Lauf importiert auch nur diesen Teil!
        row_limit: hoechstens so viele Datenzeilen gesamt (ueber alle Dateien)

    Returns:
        dict mit ok/error, stats, sample_rows (Report-Auszug), log_tail und
        report_path (kompletter CSV-Report liegt danach in logs/).
    """
    stdout = io.StringIO()
    stderr = io.StringIO()
    cmd = SyncCommand(stdout=stdout, stderr=stderr)

    options = {
        'path': None,
        'pattern': None,
        'dry_run': bool(dry_run),
        'report': None,
        'since': None,
        'no_fuzzy': False,
        'limit': _as_positive_int(row_limit),
        'max_files': _as_positive_int(max_files),
        'no_recursive': False,
        'exclude_dirs': get_setting('INVENTORY_EXCEL_EXCLUDE_DIRS', '') or '',
    }

    error = None
    try:
        cmd.handle(**options)
    except CommandError as exc:
        # CommandError am Ende = es gab Fehler bei einzelnen Dateien/blaettern.
        # Die Auswertung ist trotzdem vorhanden (last_run) und wird geliefert.
        error = str(exc)

    run = getattr(cmd, 'last_run', None) or {}
    rows = getattr(cmd, 'last_report_rows', []) or []

    return {
        **run,
        'dry_run': bool(dry_run),
        'ok': error is None,
        'error': error,
        'sample_rows': rows[:SAMPLE_LIMIT],
        'sample_truncated': max(0, len(rows) - SAMPLE_LIMIT),
        'log_tail': stdout.getvalue().splitlines()[-40:],
        'warnings': [
            line for line in stderr.getvalue().splitlines() if line.strip()
        ][-20:],
    }
