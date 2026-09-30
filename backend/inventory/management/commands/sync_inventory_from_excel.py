"""
Abgleich der Excel-Lagerlisten mit dem VERP-Warenlager.

Legt ausschliesslich FEHLENDE Lagerartikel an. Bestehende Datensaetze werden
nie veraendert - der Abgleich ist damit additiv und wiederholbar.

Beispiel:
    python manage.py sync_inventory_from_excel --path \\\\fileserver\\Lager --dry-run
    python manage.py sync_inventory_from_excel --path C:/VERP/Datenvorlagen
"""
import csv
import difflib
import logging
import os
import re
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from customers.models import Customer
from inventory.excel_sync import (
    SourceFileLocked,
    SourceFileUnreadable,
    _normalize_header,
    build_serial_key,
    extract_record,
    load_mapping,
    read_source_file,
)
from inventory.models import InventoryItem
from suppliers.models import Supplier
from verp_settings.models import ProductCategory

logger = logging.getLogger('inventory.excel_sync')
User = get_user_model()

REPORT_FIELDS = [
    'source_file', 'source_sheet', 'source_row', 'action',
    'inventory_number', 'serial_number', 'name', 'message',
]

# Schwellwert fuer unscharfen Namensvergleich (0..1)
FUZZY_THRESHOLD = 0.86

# Anzahl Items, die fuer den unscharfen Vergleich gescannt werden
FUZZY_SCAN_LIMIT = 400

# Standardname des Lieferanten fuer Zeilen ohne Lieferantenangabe
DEFAULT_SUPPLIER_NAME = 'Unbekannt'

_MAPPING = load_mapping()
CATEGORY_LOOKUP = {
    name.strip().lower(): code
    for name, code in (_MAPPING.get('category_mapping') or {}).items()
    if name and name.strip()
}

# Spaltennamen, die mitten in einem Blatt erneut als Datenwert auftauchen
# koennen (z.B. "S/N" in der Seriennummer-Spalte).
HEADER_TOKENS = {
    field: {_normalize_header(alias) for alias in aliases}
    for field, aliases in (_MAPPING.get('header_aliases') or {}).items()
}
# Feldnamen selbst ("seriennummer", "produkt", ...) ebenfalls akzeptieren.
NORMALIZED_FIELD_TOKENS = {_normalize_header(field) for field in HEADER_TOKENS}
# Gesamte Menge aller bekannten Spaltennamen, felduebergreifend.
NORMALIZED_FIELD_TOKENS_ALL = set()
for _aliases in (_MAPPING.get('header_aliases') or {}).values():
    NORMALIZED_FIELD_TOKENS_ALL.update(
        _normalize_header(alias) for alias in _aliases
    )
NORMALIZED_FIELD_TOKENS_ALL |= NORMALIZED_FIELD_TOKENS


class Command(BaseCommand):
    help = (
        'Importiert NEUE Lagerartikel aus Excel-/CSV-Lagerlisten. '
        'Bestehende Artikel werden nicht veraendert. Mit --dry-run nur simulieren.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--path',
            type=str,
            help='Verzeichnis mit den Excel-/CSV-Dateien (Default: INVENTORY_EXCEL_DIR aus .env)',
        )
        parser.add_argument(
            '--pattern',
            type=str,
            default=None,
            help='glob-Pattern fuer Dateien (Default: INVENTORY_EXCEL_PATTERN aus .env, sonst *.xlsx)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Nichts speichern, nur Report erzeugen',
        )
        parser.add_argument(
            '--report',
            type=str,
            default=None,
            help='Pfad fuer die CSV-Reportdatei (Default: <BASE_DIR>/logs/inventory_sync_<zeitstempel>.csv)',
        )
        parser.add_argument(
            '--since',
            type=str,
            default=None,
            help='Nur Dateien einbeziehen, die seit diesem Datum geaendert wurden (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--no-fuzzy',
            action='store_true',
            help='Unscharfen Namensvergleich fuer Artikel ohne Seriennummer deaktivieren',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Maximale Anzahl Datenzeilen je Datei (zum Testen)',
        )
        parser.add_argument(
            '--no-recursive',
            action='store_true',
            help='Nur Dateien direkt im Verzeichnis, keine Unterordner',
        )
        parser.add_argument(
            '--exclude-dirs',
            type=str,
            default=os.environ.get('INVENTORY_EXCEL_EXCLUDE_DIRS', ''),
            help='Kommaseparierte Ordnernamen, die ausgeschlossen werden '
                 '(auch als Zwischenordner). Default aus INVENTORY_EXCEL_EXCLUDE_DIRS',
        )

    # =====================
    # Helfer
    # =====================

    def _force_utf8_stdout(self):
        """stdout/stderr auf UTF-8 umstellen, damit Sonderzeichen klappen."""
        for stream_name in ('stdout', 'stderr'):
            stream = getattr(self, stream_name, None)
            reconfigure = getattr(stream, 'reconfigure', None)
            if reconfigure is None:
                continue
            try:
                reconfigure(encoding='utf-8', errors='replace')
            except (ValueError, OSError):
                # Bereits UTF-8 oder nicht unterstuetzbar - nicht schlimm.
                pass

    def _safe(self, text, limit=None):
        """Text fuer die Konsolenausgabe entschaerfen."""
        if text is None:
            return ''
        text = str(text)
        if limit:
            text = text[:limit]
        return text.encode('utf-8', errors='replace').decode('utf-8')

    def _resolve_path(self, option_value):
        configured = option_value or os.environ.get('INVENTORY_EXCEL_DIR')
        if configured:
            return Path(configured)
        candidates = [
            Path(settings.BASE_DIR).parent / 'Datenvorlagen',
            Path(settings.BASE_DIR) / 'Datenvorlagen',
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        return candidates[0]

    def _resolve_pattern(self, option_value):
        return option_value or os.environ.get('INVENTORY_EXCEL_PATTERN') or '*.xlsx'

    def _resolve_report_path(self, option_value):
        if option_value:
            return Path(option_value)
        log_dir = Path(settings.BASE_DIR) / 'logs'
        stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return log_dir / f'inventory_sync_{stamp}.csv'

    def _discover_files(self, base_path, pattern, since, recursive=True,
                        exclude_dirs=''):
        if not base_path.exists():
            raise CommandError(
                f'Verzeichnis nicht gefunden: {base_path}\n'
                'Netzlaufwerk pruefen bzw. --path bzw. INVENTORY_EXCEL_DIR setzen.'
            )
        if not base_path.is_dir():
            raise CommandError(f'--path muss ein Verzeichnis sein, keine Datei: {base_path}')

        since_dt = None
        if since:
            try:
                since_dt = datetime.strptime(since, '%Y-%m-%d')
            except ValueError:
                raise CommandError(f'Ungueltiges --since-Format (erwartet YYYY-MM-DD): {since}')

        # Ausgeschlossene Ordnernamen (kommasepariert, Gross-/Kleinschreibung
        # und Pfad-Trenner werden ignoriert). Damit lassen sich Unterordner
        # wie "Archiv", "_alt" oder "__Bak" vom Import fernhalten.
        excluded = {
            d.strip().strip('\\/').lower()
            for d in exclude_dirs.split(',') if d.strip()
        }
        self._excluded_dirs = excluded

        files = []
        if recursive:
            candidates = base_path.rglob(pattern)
        else:
            candidates = base_path.glob(pattern)

        for path in sorted(candidates):
            if path.name.startswith('~$'):  # Excel-Sperrdateien
                continue
            if excluded:
                # Relativer Pfad vom Basisverzeichnis, jede Komponente pruefen
                try:
                    rel = path.relative_to(base_path)
                except ValueError:
                    rel = path
                parts = {p.strip().lower() for p in rel.parts[:-1]}
                # Auch Teil-Ordnerpfade abdecken (z.B. "2023/Archiv")
                if any(part in excluded for part in parts):
                    continue
                joined = str(rel).replace('/', '\\').lower()
                if any(re.search(
                    rf'(^|\\){re.escape(d)}($|\\)', joined
                ) for d in excluded):
                    continue
            if since_dt:
                mtime = datetime.fromtimestamp(path.stat().st_mtime)
                if mtime < since_dt:
                    continue
            files.append(path)
        return files

    def _get_admin_user(self):
        user = User.objects.filter(is_superuser=True).order_by('id').first()
        if not user:
            raise CommandError('Kein Superuser vorhanden - bitte createsuperuser ausfuehren.')
        return user

    # =====================
    # Matching
    # =====================

    def _find_by_serial(self, serial_key):
        """Exakter Treffer auf die normalisierte Seriennummer.

        Die DB-Suche ist case-insensitiv, kann aber keine Sonderzeichen
        normalisieren. Deshalb wird eine Kandidatenmenge geladen und in
        Python gegen den normalisierten Schluessel geprueft.
        """
        if not serial_key:
            return []
        # Ein Pruefzeichen-Fragment verkleinert die Kandidatenmenge stark.
        fragment = serial_key[:6] if len(serial_key) > 6 else serial_key
        candidates = InventoryItem.objects.exclude(serial_number='').filter(
            serial_number__icontains=fragment
        ).only('id', 'inventory_number', 'serial_number', 'name')
        return [
            item for item in candidates
            if build_serial_key(item.serial_number) == serial_key
        ]

    def _find_without_serial(self, name, supplier, best_nr, use_fuzzy):
        """Match ohne Seriennummer: exakte external_ref, sonst Produkt+Lieferant.

        WICHTIG: Hier wird bewusst KEIN unscharfer Vergleich verwendet, wenn
        bereits mehrere Kandidaten existieren. Eine Excel-Zeile ohne S/N
        beschreibt typischerweise einen Mengenartikel, waehrend im VERP
        mehrere Einzelstuecke dazu existieren. Der unscharfe Vergleich wuerde
        dort grundlos zusaetzliche Artikel erzeugen.
        """
        if not name:
            return []

        # 1) Exakte external_ref (Best-Nr. + Lieferant)
        if best_nr:
            items = InventoryItem.objects.filter(management_info__external_ref=best_nr)
            if supplier:
                items = items.filter(supplier=supplier)
            exact = list(items[:10])
            if exact:
                return exact

        # 2) Produktname + Lieferant exakt
        qs = InventoryItem.objects.filter(name__iexact=name)
        if supplier:
            qs = qs.filter(supplier=supplier)
        exact = list(qs[:10])
        if exact:
            return exact

        # 3) Unscharfer Namensvergleich (nur wenn angefordert)
        if use_fuzzy:
            qs = InventoryItem.objects.all()
            if supplier:
                qs = qs.filter(supplier=supplier)
            best, ratio = self._fuzzy_best(name, qs)
            if best and ratio >= FUZZY_THRESHOLD:
                return [best]
        return []

    def _fuzzy_best(self, name, queryset):
        """Beste Namensueberdeckung im Queryset (dflib, begrenzt auf FUZZY_SCAN_LIMIT)."""
        target = name.lower().strip()
        best = None
        best_ratio = 0.0
        for item in queryset.only('id', 'name')[:FUZZY_SCAN_LIMIT]:
            ratio = difflib.SequenceMatcher(
                None, target, (item.name or '').lower().strip()
            ).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best = item
        return best, best_ratio

    # =====================
    # Stammdaten
    # =====================

    def _get_or_create_supplier(self, name, cache, admin_user):
        key = (name or '').strip().lower()
        if not key:
            return self._default_supplier(admin_user)
        if key in cache:
            return cache[key]

        supplier = Supplier.objects.filter(company_name__iexact=name).first()
        if not supplier:
            supplier = Supplier.objects.filter(company_name__icontains=name).first()
        if not supplier:
            supplier = Supplier.objects.create(
                company_name=name.strip()[:200],
                is_active=True,
                created_by=admin_user,
            )
            self.stdout.write(self._safe(
                f'  + Lieferant angelegt: {supplier.supplier_number} {supplier.company_name}'
            ))
        cache[key] = supplier
        return supplier

    def _default_supplier(self, admin_user):
        if '__default__' not in _DEFAULT_SUPPLIER_CACHE:
            supplier = Supplier.objects.filter(company_name=DEFAULT_SUPPLIER_NAME).first()
            if not supplier:
                supplier = Supplier.objects.create(
                    company_name=DEFAULT_SUPPLIER_NAME,
                    is_active=True,
                    notes='Default-Lieferant fuer aus Excel importierte Waren ohne Lieferantenangabe',
                    created_by=admin_user,
                )
            _DEFAULT_SUPPLIER_CACHE['__default__'] = supplier
        return _DEFAULT_SUPPLIER_CACHE['__default__']

    def _get_category(self, category_name, filename, category_cache):
        """Kategorie aus Spalte 'kategorie' bzw. aus dem Dateinamen ableiten."""
        candidates = [category_name or '']
        candidates.extend(re.split(r'[^0-9A-Za-zÄÖÜäöüß]+', Path(filename).stem))
        for candidate in candidates:
            key = candidate.strip().lower()
            if not key:
                continue
            if key in category_cache:
                obj = category_cache[key]
                if obj is not None:
                    return obj
                continue
            code = CATEGORY_LOOKUP.get(key)
            category = None
            if code:
                category = ProductCategory.objects.filter(code=code).first()
            category_cache[key] = category
            if category:
                return category
        return None

    def _find_customer(self, customer_str, cache):
        """Kunde aus dem Textfeld zuordnen; None wenn nicht eindeutig."""
        text = (customer_str or '').strip()
        if not text:
            return None
        lower = text.lower()
        if lower in ('frei', 'demo', 'demo-gerät', 'demogerät', 'demo gerät', 'lager'):
            return None
        if 'demo' in lower and len(text) < 20:
            return None
        if text in cache:
            return cache[text]

        # Komma: Nachname vor dem Komma ist der staerkste Treffer
        primary = text.split(',')[0].strip()
        tokens = [t for t in re.split(r'\s+', primary) if len(t) > 2]
        if not tokens:
            cache[text] = None
            return None

        for token in tokens:
            hits = Customer.objects.filter(
                Q(last_name__iexact=token) | Q(first_name__iexact=token)
            )[:2]
            if len(hits) == 1:
                cache[text] = hits[0]
                return hits[0]
        cache[text] = None
        return None

    def _determine_status(self, customer_str, delivery_date):
        if not customer_str or not customer_str.strip():
            return 'FREI'
        lower = customer_str.strip().lower()
        if lower in ('frei', 'demo', 'demo-gerät', 'demogerät'):
            return 'FREI'
        if 'demo' in lower and len(customer_str) < 15:
            return 'FREI'
        return 'GELIEFERT' if delivery_date else 'FREI'

    def _article_number(self, record, used):
        """Eindeutige Artikelnummer: Best-Nr. bevorzugt, sonst 'EXCEL-...'."""
        best_nr = (record['best_nr'] or '').strip()
        if best_nr:
            base = best_nr
        elif record['serial_number']:
            base = f"SN-{record['serial_number']}"
        else:
            base = f"EXCEL-{Path(record['source_file']).stem}-{record['source_row']}"
        base = base[:100]
        candidate = base
        counter = 1
        while candidate in used:
            counter += 1
            suffix = f"-{counter}"
            candidate = base[:100 - len(suffix)] + suffix
        used.add(candidate)
        return candidate

    # =====================
    # Hauptlauf
    # =====================

    def handle(self, *args, **options):
        # Die Konsole kann unter Windows cp1252 sein. Produktnamen enthalten
        # aber Sonderzeichen (z.B. Lambda, µ, °). Ohne diese Umstellung
        # bricht der Lauf mit UnicodeEncodeError ab - beim Task-Scheduler
        # waere das ein stiller Fehler ohne Logeintrag.
        self._force_utf8_stdout()

        dry_run = options['dry_run']
        use_fuzzy = not options['no_fuzzy']
        base_path = self._resolve_path(options.get('path'))
        pattern = self._resolve_pattern(options.get('pattern'))
        report_path = self._resolve_report_path(options.get('report'))
        limit = options.get('limit')

        mapping = load_mapping()
        recursive = not options['no_recursive']
        exclude_dirs = options.get('exclude_dirs') or ''
        files = self._discover_files(
            base_path, pattern, options.get('since'),
            recursive=recursive, exclude_dirs=exclude_dirs,
        )

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'Excel-Lagerabgleich  ({"DRY-RUN" if dry_run else "LIVE"})'
        ))
        self.stdout.write(f'Verzeichnis : {base_path}')
        self.stdout.write(f'Pattern     : {pattern}')
        self.stdout.write(f'Unterordner : {"ja" if recursive else "nein (--no-recursive)"}')
        if exclude_dirs:
            self.stdout.write(f'Ausgeschlossen: {exclude_dirs}')
        self.stdout.write(f'Dateien     : {len(files)}')
        if not files:
            self.stdout.write(self.style.WARNING('Keine Dateien gefunden - nichts zu tun.'))
            return

        admin_user = self._get_admin_user()
        supplier_cache = {}
        customer_cache = {}
        category_cache = {}
        used_article_numbers = set()

        report_rows = []
        stats = defaultdict(int)
        # Schluessel -> (Quellzeile, action, Inventarnummer) fuer die
        # Dublettenerkennung innerhalb dieses Laufs.
        seen_keys = {}
        started = datetime.now()

        for path in files:
            self.stdout.write('')
            self.stdout.write(self.style.MIGRATE_HEADING(self._safe(f'Datei: {path.name}')))

            try:
                sheets = read_source_file(path, mapping)
            except SourceFileLocked as exc:
                # Datei ist gerade in Excel geoeffnet. Das ist ein temporaerer
                # Zustand: ueberspringen, NICHT den Lauf abbrechen. Die Datei
                # wird beim naechsten Lauf nachgeholt.
                message = f'uebersprungen (gesperrt): {exc}'
                self.stdout.write(self.style.WARNING(self._safe(f'  {message}')))
                logger.warning('inventory_sync: %s uebersprungen: %s', path.name, exc)
                report_rows.append(self._report_row(
                    path.name, '', 0, 'locked', '', '', '', str(exc)
                ))
                stats['locked'] += 1
                continue
            except SourceFileUnreadable as exc:
                message = f'nicht lesbar: {exc}'
                self.stderr.write(self.style.ERROR(self._safe(f'  {message}')))
                logger.error('inventory_sync: %s nicht lesbar: %s', path.name, exc)
                report_rows.append(self._report_row(
                    path.name, '', 0, 'error', '', '', '', str(exc)
                ))
                stats['error'] += 1
                continue

            for sheet in sheets:
                if sheet.get('skipped'):
                    self.stdout.write(self.style.WARNING(
                        f'  Blatt "{sheet["sheet"]}" uebersprungen (per Mapping ausgeschlossen)'
                    ))
                    stats['sheets_skipped'] += 1
                    continue

                if sheet.get('error'):
                    # Ein Blatt ohne erkennbare Kopfzeile ist meistens KEIN
                    # Fehler, sondern eine Info-/Preis-/Konfigurationstabelle.
                    # Deshalb zaehlt es nicht als Fehler, wird aber gelistet.
                    self.stdout.write(self.style.WARNING(self._safe(
                        f'  Blatt "{sheet["sheet"]}" ({path.name}): {sheet["error"]}'
                    )))
                    logger.info(
                        'inventory_sync: Blatt ohne Lagerartikel uebersprungen: '
                        '%s / %s', path.name, sheet['sheet'],
                    )
                    report_rows.append(self._report_row(
                        path.name, sheet['sheet'], 0, 'no_header', '', '', '',
                        sheet['error'],
                    ))
                    stats['no_header'] += 1
                    continue

                self.stdout.write(self._safe(
                    f'  Blatt "{sheet["sheet"]}": {len(sheet["rows"])} Zeilen ab Zeile '
                    f'{(sheet["header_index"] or 0) + 2}'
                ))
                if sheet['unknown_headers']:
                    self.stdout.write(self.style.WARNING(
                        '    unbekannte Spalten (kommen ins Beschreibungsfeld): '
                        + ', '.join(sheet['unknown_headers'])
                    ))
                if sheet.get('extra_columns'):
                    extra_names = ', '.join(
                        e['name'] for e in sheet['extra_columns']
                    )
                    self.stdout.write(
                        '    Zusatzspalten (kommen ins Beschreibungsfeld): '
                        + extra_names
                    )

                with transaction.atomic():
                    for row_number, row in sheet['rows']:
                        if limit and stats['rows'] >= limit:
                            break
                        stats['rows'] += 1
                        self._process_row(
                            record=extract_record(sheet, row, path.name, row_number),
                            sheet=sheet,
                            dry_run=dry_run,
                            use_fuzzy=use_fuzzy,
                            admin_user=admin_user,
                            supplier_cache=supplier_cache,
                            customer_cache=customer_cache,
                            category_cache=category_cache,
                            used_article_numbers=used_article_numbers,
                            report_rows=report_rows,
                            stats=stats,
                            seen_keys=seen_keys,
                        )
                if limit and stats['rows'] >= limit:
                    break
            if limit and stats['rows'] >= limit:
                break

        # Report schreiben
        self._write_report(report_path, report_rows)

        duration = (datetime.now() - started).total_seconds()
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Zusammenfassung'))
        self.stdout.write(f'  Dateien              : {len(files)}')
        self.stdout.write(f'  Zeilen gelesen       : {stats["rows"]}')
        self.stdout.write(f'  Neu angelegt         : {stats["create"]}{" (Dry-Run)" if dry_run else ""}')
        self.stdout.write(f'  Bereits vorhanden    : {stats["skip"]}')
        self.stdout.write(f'  Dublette (echt)      : {stats["duplicate"]}')
        self.stdout.write(f'  Mehrdeutig (>1 Treffer): {stats["ambiguous"]}')
        self.stdout.write(f'  Uebersprungen (Excel offen): {stats["locked"]}')
        self.stdout.write(f'  Blaetter ohne Lagerartikel: {stats["sheets_skipped"] + stats["no_header"]}')
        self.stdout.write(f'  Wiederholte Kopfzeilen: {stats["header_rows"]}')
        self.stdout.write(f'  Fehler               : {stats["error"]}')
        self.stdout.write(f'  Report               : {report_path}')
        self.stdout.write(f'  Dauer                : {duration:.1f}s')
        logger.info(
            'inventory_sync fertig: rows=%s create=%s skip=%s duplicate=%s ambiguous=%s '
            'locked=%s no_header=%s error=%s report=%s',
            stats['rows'], stats['create'], stats['skip'], stats['duplicate'],
            stats['ambiguous'], stats['locked'], stats['no_header'],
            stats['error'], report_path,
        )
        if stats['error']:
            raise CommandError(f"{stats['error']} Datei(en)/Blatt(er) konnten nicht verarbeitet werden.")

    # =====================
    # Dubletten innerhalb eines Laufs
    # =====================

    def _match_key(self, record):
        """Schluessel fuer die Dublettenerkennung innerhalb eines Laufs."""
        if record['serial_key']:
            return ('sn', record['serial_key'])
        parts = [
            (record['name'] or '').strip().lower(),
            (record['supplier'] or '').strip().lower(),
            (record['best_nr'] or '').strip().lower(),
        ]
        if not any(parts):
            return None
        return ('nsn', tuple(parts))

    def _seen_this_run(self, record, seen_keys):
        """Prueft, ob dieser Schluessel in diesem Lauf schon verarbeitet wurde.

        Returns: (row_number, action, inventory_number) oder None.
        """
        key = self._match_key(record)
        if key is None:
            return None
        return seen_keys.get(key)

    def _remember(self, record, seen_keys, action, inventory_number):
        key = self._match_key(record)
        if key is not None:
            seen_keys[key] = (record['source_row'], action, inventory_number)

    # =====================
    # Zeilenverarbeitung
    # =====================

    def _is_repeated_header(self, record, sheet):
        """True, wenn die Zeile erneut Spaltennamen enthaelt.

        In den Lagerlisten stehen haeufig mitten im Blatt die Spaltennamen
        nochmal (Seitenumbruch, zusammengefuehrte Tabellen). Solche Zeilen
        sind KEINE Lagerartikel - ohne diesen Filter wuerde z.B. die
        Seriennummer "S/N" als Lagerartikel angelegt.

        Kriterium: mindestens 2 befuellte Felder, von denen mindestens die
        Mehrheit der Zellen INSGESAMT bekannte Spaltennamen sind.

        Wichtig: der Vergleich ist bewusst felduebergreifend. Eine
        Zwischen-Headerzeile kann um eins versetzt sein - "Kunde" steht
        dann z.B. in der Spalte fuer order_number. Deshalb wird jeder
        Zellwert gegen ALLE bekannten Spaltennamen geprueft, nicht nur
        gegen den Namen des eigenen Feldes.
        """
        cells = record.get('_cells_by_field') or {}
        if not cells:
            return False

        filled = {f: v for f, v in cells.items() if v}
        if len(filled) < 2:
            return False

        matched = 0
        for value in filled.values():
            if _normalize_header(value) in NORMALIZED_FIELD_TOKENS_ALL:
                matched += 1
        return matched >= 2 and matched >= (len(filled) * 0.5)

    def _build_description(self, record):
        """Beschreibungstext fuer den Lagerartikel.

        Nimmt die Herkunftsangaben AUF und - wichtig - alle Spaltenwerte,
        die keinem logischen Feld zugeordnet werden konnten (z.B.
        "Board Version", "Bst. Nr. Katalog", "Info Generation"). Sonst
        ginge diese Information beim Import verloren.
        """
        lines = [
            'Importiert aus Excel-Lagerliste',
            f"Kategorie: {record['category'] or '-'}",
            f"Best-Nr.: {record['best_nr'] or '-'}",
            f"Auftrag: {record['order_number'] or '-'}",
        ]

        extras = record.get('extra_info') or {}
        if extras:
            lines.append('')
            lines.append('Weitere Angaben aus der Lagerliste:')
            for label, value in extras.items():
                lines.append(f'  {label}: {value}')

        return '\n'.join(lines)

    def _process_row(self, record, sheet, dry_run, use_fuzzy, admin_user,
                     supplier_cache, customer_cache, category_cache,
                     used_article_numbers, report_rows, stats, seen_keys):
        if record['is_empty']:
            stats['skip'] += 1
            return

        if self._is_repeated_header(record, sheet):
            stats['header_rows'] += 1
            return

        supplier = None
        if record['supplier']:
            # Im Dry-Run nur nachschauen, aber nicht anlegen.
            supplier = Supplier.objects.filter(
                company_name__iexact=record['supplier']
            ).first() or Supplier.objects.filter(
                company_name__icontains=record['supplier']
            ).first()
        customer = self._find_customer(record['customer'], customer_cache)
        status = self._determine_status(record['customer'], record['delivery_date'])

        # ---- Match ----
        if record['serial_key']:
            matches = self._find_by_serial(record['serial_key'])
        else:
            matches = self._find_without_serial(
                record['name'], supplier, record['best_nr'], use_fuzzy
            )

        # ---- Dubletten innerhalb desselben Laufs/Dateiblatts ----
        # Zwei Zeilen mit identischem Seriennummer bzw. identischem
        # (Produkt+Lieferant+Best-Nr.)-Schluessel deuten auf einen
        # Kopierfehler in der Excel-Liste hin. Beim Live-Run waere die
        # zweite Zeile sonst ein False-Positive gegen das gerade angelegte
        # Objekt und wuerde faelschlich als 'bereits vorhanden' verschluckt.
        duplicate_of = self._seen_this_run(record, seen_keys)
        if duplicate_of and duplicate_of[1] == 'create':
            seen_row, _, seen_inventory = duplicate_of
            report_rows.append(self._report_row(
                record['source_file'], record['source_sheet'], record['source_row'],
                'duplicate', seen_inventory, record['serial_number'], record['name'],
                f'Dublette: gleicher Schluessel wie Zeile {seen_row} '
                f'({seen_inventory}) - nicht zusammengefuehrt',
            ))
            stats['duplicate'] += 1
            return

        if len(matches) > 1:
            numbers = ', '.join(sorted(m.inventory_number for m in matches))
            # ACHTUNG: das ist KEINE Dublette im engeren Sinn, sondern
            # Mehrdeutigkeit. Typischer Fall: eine Excel-Zeile beschreibt
            # einen Mengenartikel ohne S/N, im VERP existieren dazu mehrere
            # einzelne Lagerartikel. Ohne S/N ist nicht entscheidbar, welche
            # gemeint ist - deshalb wird bewusst NICHTS angelegt.
            report_rows.append(self._report_row(
                record['source_file'], record['source_sheet'], record['source_row'],
                'ambiguous', numbers, record['serial_number'], record['name'],
                f'mehrdeutig: {len(matches)} Lagerartikel passen zum Schluessel '
                f'({numbers}) - nichts angelegt, manuell zuordnen',
            ))
            stats['ambiguous'] += 1
            return

        if len(matches) == 1:
            item = matches[0]
            report_rows.append(self._report_row(
                record['source_file'], record['source_sheet'], record['source_row'],
                'skip', item.inventory_number, record['serial_number'], record['name'],
                'bereits vorhanden - nicht veraendert',
            ))
            stats['skip'] += 1
            self._remember(record, seen_keys, 'skip', item.inventory_number)
            return

        # ---- Neuanlage ----
        category = self._get_category(
            record['category'], record['source_file'], category_cache
        )
        if not dry_run:
            supplier = self._get_or_create_supplier(
                record['supplier'], supplier_cache, admin_user
            )

        article_number = self._article_number(record, used_article_numbers)
        item_function = 'ASSET' if record['serial_number'] else 'TRADING_GOOD'
        quantity = record['quantity_value'] or Decimal('1')
        if record['serial_number']:
            quantity = Decimal('1')
        unit = record['unit'] or 'Stück'

        notes_parts = []
        if record['notes']:
            notes_parts.append(record['notes'])
        if not customer and record['customer'] and \
                record['customer'].strip().lower() not in ('frei', 'demo', ''):
            notes_parts.insert(0, f"Kunde (nicht zugeordnet): {record['customer']}")

        management_info = {
            'import_source': 'excel_sync',
            'external_ref': record['best_nr'],
            'category_raw': record['category'],
            'lfd_nr': record['lfd_nr'],
            'order_number_raw': record['order_number'],
            'delivery_date_raw': record['delivery_date_raw'],
            'imported_at': datetime.now().isoformat(timespec='seconds'),
        }

        if dry_run:
            self.stdout.write(self._safe(
                f'  + [{record["source_file"]}:{record["source_row"]}] '
                f'{record["name"][:45]} '
                f'(S/N: {record["serial_number"] or "-"}, Art.-Nr: {article_number})'
            ))
            report_rows.append(self._report_row(
                record['source_file'], record['source_sheet'], record['source_row'],
                'create', '', record['serial_number'], record['name'],
                f'wuerde angelegt werden (Status: {status}, Lieferant: '
                f'{supplier.company_name if supplier else "-"}, Kunde: '
                f'{customer or "nicht zugeordnet"})',
            ))
            stats['create'] += 1
            self._remember(record, seen_keys, 'create', '(dry-run)')
            return

        item = InventoryItem.objects.create(
            name=record['name'] or f"{record['category'] or 'Lagerartikel'} (kein Produktname)",
            description=self._build_description(record),
            article_number=article_number,
            serial_number=record['serial_number'],
            supplier=supplier or self._default_supplier(admin_user),
            product_category=category,
            item_category=record['category'][:50],
            item_function=item_function,
            customer=customer,
            customer_name=record['customer'] if not customer else '',
            customer_order_number=record['order_number'][:200],
            status=status,
            delivery_date=record['delivery_date'],
            firmware_version=record['firmware_version'],
            firmware_notes=record['firmware_notes'],
            notes='\n'.join(notes_parts),
            quantity=quantity,
            unit=unit,
            purchase_price=Decimal('0.00'),
            management_info=management_info,
            source_file=record['source_file'],
            source_row=record['source_row'],
            stored_by=admin_user,
        )
        self.stdout.write(self._safe(
            f'  + {item.inventory_number} {record["name"][:45]} '
            f'(S/N: {record["serial_number"] or "-"})'
        ))
        report_rows.append(self._report_row(
            record['source_file'], record['source_sheet'], record['source_row'],
            'create', item.inventory_number, record['serial_number'], record['name'],
            f'angelegt (Status: {status}, Lieferant: {item.supplier.company_name}, '
            f'Kunde: {customer or "nicht zugeordnet"})',
        ))
        stats['create'] += 1
        self._remember(record, seen_keys, 'create', item.inventory_number)

    # =====================
    # Report
    # =====================

    def _report_row(self, source_file, source_sheet, source_row, action,
                    inventory_number, serial_number, name, message):
        return {
            'source_file': source_file,
            'source_sheet': source_sheet,
            'source_row': source_row,
            'action': action,
            'inventory_number': inventory_number,
            'serial_number': serial_number,
            'name': name,
            'message': message,
        }

    def _write_report(self, report_path, rows):
        try:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            with open(report_path, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.DictWriter(f, fieldnames=REPORT_FIELDS)
                writer.writeheader()
                for row in rows:
                    writer.writerow(row)
        except OSError as exc:
            self.stderr.write(self.style.ERROR(f'Report konnte nicht geschrieben werden: {exc}'))


# Cache fuer den Default-Lieferanten innerhalb eines Laufs
_DEFAULT_SUPPLIER_CACHE = {}
