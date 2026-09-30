"""
Tests fuer den Excel-Lagerabgleich (sync_inventory_from_excel).

Abgedeckt:
- Header-Erkennung trotz Titelfunken und geaenderter Spaltenreihenfolge
- Alias-Zuordnung (S/N vs. Seriennummer etc.)
- Normalisierung von Seriennummern, Dezimalzahlen und Datumswerten
- Inkrement-Verhalten (zweiter Lauf legt nichts doppelt an)
- Dubletten werden gemeldet, nicht zusammengefuehrt
- Dry-Run veraendert die Datenbank nicht
"""
import tempfile
from decimal import Decimal
from pathlib import Path
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from django.core.management.base import CommandError
from io import StringIO

from inventory.excel_sync import (
    build_serial_key,
    clean_serial_number,
    detect_header,
    extract_record,
    is_placeholder,
    load_mapping,
    map_columns,
    parse_date,
    parse_decimal,
    read_source_file,
)
from inventory.models import InventoryItem
from suppliers.models import Supplier

HEADER = 'lfd. Nr.;Best-Nr.;S/N;Kunde;Auftrag;Lieferant;Produkt;ausgeliefert;Infos'

User = get_user_model()


def write_csv(directory, filename, lines):
    path = Path(directory) / filename
    path.write_text('\n'.join(lines), encoding='utf-8')
    return path


class HeaderDetectionTests(SimpleTestCase):
    def setUp(self):
        self.mapping = load_mapping()

    def test_detects_header_without_titles(self):
        rows = [
            HEADER.split(';'),
            ['1', 'B-1', 'SN1', 'Kunde', 'O-1', 'Lieferant', 'Produkt A', '01.02.2020', ''],
        ]
        index, columns, _unknown, _extra = detect_header(rows, self.mapping)
        self.assertEqual(index, 0)
        self.assertEqual(columns['serial_number'], 2)
        self.assertEqual(columns['name'], 6)
        self.assertEqual(columns['supplier'], 5)

    def test_detects_header_below_titles_and_blanks(self):
        rows = [
            ['Warenlagerliste Stand 2026'],
            [],
            ['Export der Abteilung', '', '', ''],
            HEADER.split(';'),
            ['1', 'B-1', 'SN1', 'Kunde', 'O-1', 'Lieferant', 'Produkt A', '01.02.2020', ''],
        ]
        index, columns, _unknown, _extra = detect_header(rows, self.mapping)
        self.assertEqual(index, 3)
        self.assertEqual(columns['customer'], 3)

    def test_column_order_is_irrelevant(self):
        reordered = ['Produkt', 'S/N', 'Lieferant', 'Best-Nr.']
        columns, unknown, _extra = map_columns(reordered, self.mapping)
        self.assertEqual(columns['name'], 0)
        self.assertEqual(columns['serial_number'], 1)
        self.assertEqual(columns['supplier'], 2)
        self.assertEqual(columns['best_nr'], 3)
        self.assertEqual(unknown, [])

    def test_alternative_alias_seriennummer(self):
        columns, _unknown, _extra = map_columns(['Seriennummer', 'Bezeichnung'], self.mapping)
        self.assertEqual(columns['serial_number'], 0)
        self.assertEqual(columns['name'], 1)

    def test_unknown_headers_are_reported(self):
        columns, unknown, _extra = map_columns(['S/N', 'Wartungsvertrag Nr'], self.mapping)
        self.assertIn('serial_number', columns)
        self.assertEqual(unknown, ['Wartungsvertrag Nr'])

    def test_no_header_detected(self):
        rows = [['alpha', 'beta'], ['gamma', 'delta']]
        self.assertIsNone(detect_header(rows, self.mapping))

    def test_prefix_sn_columns_are_mapped(self):
        # "S/N Controller" und Verwandte sind Seriennummern-Spalten
        for header in ('S/N Controller', 'S/N AOTF', 'S/N Laser Head',
                       'Grade, S/N Controller', 'Lichtleiter S/N',
                       'S/N Stage', 'S/N Piezo'):
            columns, unknown, _extra = map_columns(
                ['Produkt', 'Kunde', header], self.mapping
            )
            self.assertEqual(
                columns.get('serial_number'), 2,
                f'{header!r} wurde nicht als serial_number erkannt',
            )
            self.assertNotIn(header, unknown)

    def test_grade_sn_controller_takes_priority(self):
        columns, _unknown, _extra = map_columns(
            ['Grade, S/N Controller', 'Produkt', 'Kunde', 'Lieferant'], self.mapping
        )
        self.assertEqual(columns['serial_number'], 0)

    def test_second_sn_column_becomes_extra(self):
        # Zwei S/N-Spalten: die erste ist der Lagerartikel, die zweite
        # (z.B. Controller-S/N) darf nicht den Lagerartikel uebernehmen.
        columns, _unknown, extra = map_columns(
            ['S/N', 'S/N Controller', 'Produkt', 'Kunde', 'Lieferant'],
            self.mapping,
        )
        self.assertEqual(columns['serial_number'], 0)
        self.assertEqual([e['name'] for e in extra], ['S/N Controller'])

    def test_firmware_prefix_mapped(self):
        columns, _unknown, _extra = map_columns(
            ['Firmware', 'Produkt', 'S/N', 'Kunde', 'Lieferant'], self.mapping
        )
        self.assertEqual(columns['firmware_version'], 0)

    def test_unknown_columns_become_extra_not_lost(self):
        columns, unknown, extra = map_columns(
            ['Produkt', 'S/N', 'Kunde', 'Lieferant', 'Board Version'],
            self.mapping,
        )
        self.assertIn('Board Version', unknown)
        names = [e['name'] for e in extra]
        self.assertIn('Board Version', names)
        self.assertEqual(extra[names.index('Board Version')]['index'], 4)

    def test_extra_values_land_in_extra_info(self):
        mapping = load_mapping()
        header = ['Produkt', 'S/N', 'Kunde', 'Lieferant', 'Board Version']
        columns, _unknown, extra = map_columns(header, mapping)
        sheet = {'sheet': 'T', 'columns': columns, 'header_index': 0,
                 'extra_columns': extra}
        row = ['Geraet X', 'SN-1', 'Kunde', 'Lieferant', 'Rev 2.1']
        record = extract_record(sheet, row, 'f.csv', 2)
        self.assertEqual(record['extra_info'], {'Board Version': 'Rev 2.1'})

    def test_empty_extra_columns_are_not_added(self):
        mapping = load_mapping()
        header = ['Produkt', 'S/N', 'Kunde', 'Lieferant', 'Board Version']
        columns, _unknown, extra = map_columns(header, mapping)
        sheet = {'sheet': 'T', 'columns': columns, 'header_index': 0,
                 'extra_columns': extra}
        row = ['Geraet X', 'SN-1', 'Kunde', 'Lieferant', '']
        record = extract_record(sheet, row, 'f.csv', 2)
        self.assertEqual(record['extra_info'], {})


class DirectoryExclusionTests(SimpleTestCase):
    """Unterordner-Ausschluss ueber _discover_files (ohne DB)."""

    def _make_tree(self, root):
        h = HEADER
        (root / 'Kamera.csv').write_text(
            f'{h}\n1;B-1;SN-1;frei;;L;P;;\n', encoding='utf-8')
        (root / 'Archiv').mkdir(exist_ok=True)
        (root / 'Archiv' / 'Laser.csv').write_text(
            f'{h}\n2;B-2;SN-2;frei;;L;P;;\n', encoding='utf-8')
        deep = root / '2023' / 'Alt'
        deep.mkdir(parents=True, exist_ok=True)
        (deep / 'Alt.csv').write_text(
            f'{h}\n3;B-3;SN-3;frei;;L;P;;\n', encoding='utf-8')

    def _names(self, **kwargs):
        from inventory.management.commands.sync_inventory_from_excel import Command
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._make_tree(root)
            cmd = Command()
            return sorted(
                str(p.relative_to(root)).replace('\\', '/')
                for p in cmd._discover_files(root, '*.csv', None, **kwargs)
            )

    def test_recursive_by_default_finds_all(self):
        self.assertEqual(
            self._names(),
            ['2023/Alt/Alt.csv', 'Archiv/Laser.csv', 'Kamera.csv'],
        )

    def test_no_recursive_only_toplevel(self):
        self.assertEqual(self._names(recursive=False), ['Kamera.csv'])

    def test_exclude_dirs_skips_named_folder(self):
        self.assertEqual(
            self._names(exclude_dirs='Archiv'),
            ['2023/Alt/Alt.csv', 'Kamera.csv'],
        )

    def test_exclude_dirs_skips_nested_folder(self):
        # "Alt" liegt zwei Ebenen tief - muss trotzdem greifen
        self.assertEqual(
            self._names(exclude_dirs='Alt'),
            ['Archiv/Laser.csv', 'Kamera.csv'],
        )

    def test_exclude_dirs_is_case_insensitive(self):
        self.assertEqual(
            self._names(exclude_dirs='ARCHIV'),
            ['2023/Alt/Alt.csv', 'Kamera.csv'],
        )


class ValueNormalisationTests(SimpleTestCase):
    def test_build_serial_key_ignores_separators_and_case(self):
        self.assertEqual(build_serial_key('AB-123'), 'AB123')
        self.assertEqual(build_serial_key('ab 123'), 'AB123')
        self.assertEqual(build_serial_key('AB123'), 'AB123')
        self.assertEqual(build_serial_key(''), '')

    def test_build_serial_key_does_not_collide_different_numbers(self):
        self.assertNotEqual(build_serial_key('AB-1'), build_serial_key('ABX1'))

    def test_parse_decimal_german_format(self):
        self.assertEqual(parse_decimal('1.234,50'), Decimal('1234.50'))
        self.assertEqual(parse_decimal('12'), Decimal('12'))
        self.assertIsNone(parse_decimal(''))

    def test_parse_date_formats(self):
        self.assertEqual(parse_date('12.09.2002').isoformat(), '2002-09-12')
        self.assertEqual(parse_date('2002-09-12').isoformat(), '2002-09-12')
        self.assertIsNone(parse_date('kein Datum'))
        self.assertIsNone(parse_date(''))

    def test_clean_serial_number_removes_excel_float_artefacts(self):
        # .xls liefert Zahlen als float -> '10056340.0' statt '10056340'
        self.assertEqual(clean_serial_number('10056340.0'), '10056340')
        self.assertEqual(clean_serial_number('113.0'), '113')
        self.assertEqual(clean_serial_number('AB 123'), 'AB123')
        self.assertEqual(clean_serial_number(''), '')

    def test_placeholders_are_not_treated_as_serial_numbers(self):
        # In den Lagerlisten stehen Platzhalter wie '……' oder '...' in der
        # S/N-Spalte. Diese duerfen NICHT als Seriennummer gelten.
        for value in ('...', '……', '-', 'n/a', 'ohne', '  '):
            self.assertTrue(is_placeholder(value), f'{value!r} sollte Platzhalter sein')
        for value in ('AB-123', '10056340', 'X1'):
            self.assertFalse(is_placeholder(value), f'{value!r} ist eine echte S/N')

    def test_extract_record_treats_placeholder_serial_as_empty(self):
        mapping = load_mapping()
        header = HEADER.split(';')
        columns, _unknown, _extra = map_columns(header, mapping)
        sheet = {'sheet': 'T', 'columns': columns, 'header_index': 0,
                 'extra_columns': []}
        row = ['1', 'B-1', '……', 'Kunde', 'O-1', 'Lieferant', 'Produkt A', '01.02.2020', '']
        record = extract_record(sheet, row, 'f.csv', 2)
        self.assertEqual(record['serial_number'], '')
        self.assertEqual(record['serial_key'], '')
        # Name ist weiterhin gefuellt -> die Zeile ist nicht leer
        self.assertFalse(record['is_empty'])

    def test_extract_record_strips_float_artefact_in_serial(self):
        mapping = load_mapping()
        header = HEADER.split(';')
        columns, _unknown, _extra = map_columns(header, mapping)
        sheet = {'sheet': 'T', 'columns': columns, 'header_index': 0,
                 'extra_columns': []}
        row = ['1', 'B-1', '10056340.0', 'Kunde', 'O-1', 'Lieferant', 'Produkt A', '01.02.2020', '']
        record = extract_record(sheet, row, 'f.csv', 2)
        self.assertEqual(record['serial_number'], '10056340')


class ReadSourceFileTests(SimpleTestCase):
    def setUp(self):
        self.mapping = load_mapping()

    def test_reads_semicolon_csv_with_bom(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_csv(tmp, 'Kamera.csv', [
                HEADER,
                '1;B-1;SN-1;Kunde;O-1;Macrotron;17" TFT;12.09.2002;Hinweis',
            ])
            sheets = read_source_file(path, self.mapping)
            self.assertEqual(len(sheets), 1)
            self.assertEqual(sheets[0]['unknown_headers'], [])
            self.assertEqual(sheets[0]['locked'], False)
            self.assertEqual(len(sheets[0]['rows']), 1)
            record = extract_record(sheets[0], sheets[0]['rows'][0][1], 'Kamera.csv', 2)
            self.assertEqual(record['serial_number'], 'SN-1')
            self.assertEqual(record['serial_key'], 'SN1')
            self.assertEqual(record['name'], '17" TFT')
            self.assertEqual(record['delivery_date'].isoformat(), '2002-09-12')

    def test_reports_error_when_no_header_found(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_csv(tmp, 'kaputt.csv', ['alpha;beta', 'gamma;delta'])
            sheets = read_source_file(path, self.mapping)
            self.assertTrue(sheets[0]['error'])

    def test_locked_file_raises_sourcefilelocked(self):
        from inventory.excel_sync import SourceFileLocked
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'gesperrt.xlsx'
            path.write_bytes(b'PK\x03\x04dummy')
            # Simuliert die exklusive Excel-Sperre, indem load_workbook
            # mit einer PermissionError antwortet.
            with mock.patch('openpyxl.load_workbook', side_effect=PermissionError(32, 'Die Datei ist von einem anderen Prozess geoeffnet')):
                with self.assertRaises(SourceFileLocked):
                    read_source_file(path, self.mapping)

    def test_broken_file_raises_sourcefileunreadable(self):
        from inventory.excel_sync import SourceFileUnreadable
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'kaputt.xlsx'
            path.write_bytes(b'kein zip')
            with self.assertRaises(SourceFileUnreadable):
                read_source_file(path, self.mapping)


class SyncCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username='syncadmin', email='a@b.de', password='x'
        )
        self.supplier = Supplier.objects.create(
            company_name='Macrotron', is_active=True, created_by=self.user
        )
        self.tmp = tempfile.TemporaryDirectory()
        self.path = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def _run(self, *extra, expect_error=False):
        out = StringIO()
        args = [
            'sync_inventory_from_excel',
            '--path', self.path,
            '--pattern', '*.csv',
        ] + list(extra)
        if expect_error:
            with self.assertRaises(CommandError):
                call_command(*args, stdout=out, stderr=out)
        else:
            call_command(*args, stdout=out, stderr=out)
        return out.getvalue()

    def _write_list(self, lines, filename='Kamera.csv'):
        return write_csv(self.path, filename, [HEADER] + lines)

    def test_creates_new_item_with_provenance(self):
        self._write_list(['1;B-4711;SN-NEW-1;frei;;Macrotron;Neues Geraet;01.02.2026;'])
        self._run()

        item = InventoryItem.objects.get(serial_number='SN-NEW-1')
        self.assertEqual(item.source_file, 'Kamera.csv')
        self.assertEqual(item.source_row, 2)
        self.assertEqual(item.article_number, 'B-4711')
        self.assertEqual(item.item_function, 'ASSET')
        self.assertEqual(item.supplier, self.supplier)
        self.assertEqual(item.stored_by, self.user)
        self.assertEqual(item.management_info.get('external_ref'), 'B-4711')

    def test_second_run_creates_nothing(self):
        self._write_list(['1;B-4711;SN-NEW-1;frei;;Macrotron;Neues Geraet;01.02.2026;'])
        self._run()
        self._run()

        self.assertEqual(
            InventoryItem.objects.filter(serial_number='SN-NEW-1').count(), 1
        )

    def test_existing_item_is_not_modified(self):
        item = InventoryItem.objects.create(
            name='Neues Geraet',
            article_number='MANUELL',
            serial_number='SN-NEW-1',
            supplier=self.supplier,
            item_function='ASSET',
            notes='Von Hand gepflegt',
        )
        self._write_list(['1;B-4711;SN-NEW-1;frei;;Macrotron;Anderer Name;01.02.2026;'])
        self._run()

        item.refresh_from_db()
        self.assertEqual(item.article_number, 'MANUELL')
        self.assertEqual(item.name, 'Neues Geraet')
        self.assertEqual(item.notes, 'Von Hand gepflegt')
        self.assertEqual(item.source_file, '')

    def test_dry_run_changes_nothing(self):
        self._write_list(['1;B-4711;SN-NEW-1;frei;;Macrotron;Neues Geraet;01.02.2026;'])
        self._run('--dry-run')

        self.assertEqual(InventoryItem.objects.count(), 0)
        self.assertEqual(Supplier.objects.filter(company_name='Macrotron').count(), 1)

    def test_duplicate_rows_within_one_file_are_reported_once(self):
        self._write_list([
            '1;B-1;SN-DUP;frei;;Macrotron;Geraet A;01.02.2026;',
            '2;B-1;SN-DUP;frei;;Macrotron;Geraet A;01.02.2026;',
        ])
        self._run()

        self.assertEqual(InventoryItem.objects.filter(serial_number='SN-DUP').count(), 1)

    def test_item_without_serial_matches_on_name_and_supplier(self):
        InventoryItem.objects.create(
            name='Standard Kabel 5m',
            article_number='B-1',
            supplier=self.supplier,
            item_function='TRADING_GOOD',
        )
        self._write_list(['1;B-1;;frei;;Macrotron;Standard Kabel 5m;;'])
        self._run()

        self.assertEqual(
            InventoryItem.objects.filter(name='Standard Kabel 5m').count(), 1
        )

    def test_missing_directory_raises_command_error(self):
        out = StringIO()
        with self.assertRaises(CommandError):
            call_command(
                'sync_inventory_from_excel',
                '--path', str(Path(self.path) / 'gibt_es_nicht'),
                stdout=out, stderr=out,
            )

    def test_report_file_is_written(self):
        self._write_list(['1;B-4711;SN-NEW-1;frei;;Macrotron;Neues Geraet;01.02.2026;'])
        report = Path(self.path) / 'report.csv'
        self._run('--report', str(report))

        self.assertTrue(report.exists())
        content = report.read_text(encoding='utf-8-sig')
        self.assertIn('create', content)
        self.assertIn('SN-NEW-1', content)
