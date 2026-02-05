#!/usr/bin/env python
"""
Import-Script für VisiView Supported Hardware / Compatibility-Daten.

Importiert Hardware-Daten aus CSV-Dateien in die SupportedHardware-Tabelle.

Usage:
    # Dry-run (zeigt was importiert würde)
    python import_supported_hardware.py
    
    # Live-Import
    python import_supported_hardware.py --live
    
    # Nur bestimmte Datei importieren
    python import_supported_hardware.py --file cameras.csv --live
    
    # Alle löschen und neu importieren
    python import_supported_hardware.py --live --delete-existing
"""

import os
import sys
import csv
import django
from datetime import datetime

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from visiview.models import SupportedHardware


# Mapping von CSV-Spaltennamen auf Model-Felder
COLUMN_MAPPING = {
    # Common fields
    'category': 'category',
    'manufacturer': 'manufacturer',
    'device': 'device',
    'driver name': 'driver_name',
    'driver version': 'driver_version',
    'visiview version': 'visiview_version',
    'limitations': 'limitations',
    'comment': 'comment',
    'required visiview option': 'required_visiview_option',
    'support level': 'support_level',
    'service status (manufacturer)': 'service_status',
    'data quality': 'data_quality',
    'autor': 'author',
    'actualizationdate': 'actualization_date',
    
    # Camera-specific (Boolean)
    'dual cam': 'dual_cam',
    'device streaming': 'device_streaming',
    'virtex': 'virtex',
    'virtex ': 'virtex',  # Mit trailing space
    'splitview': 'splitview',
    
    # Microscope-specific (Boolean)
    'xy': 'xy_support',
    'z': 'z_support',
    'objective': 'objective_support',
    'beam path': 'beam_path_support',
    'light': 'light_support',
    
    # Light source-specific (Boolean)
    'ttl shutter': 'ttl_shutter',
    'sw shutter': 'sw_shutter',
    'analog intensity': 'analog_intensity',
    'sw intensity': 'sw_intensity',
}

# Boolean-Felder
BOOLEAN_FIELDS = {
    'dual_cam', 'device_streaming', 'virtex', 'splitview',
    'xy_support', 'z_support', 'objective_support', 'beam_path_support', 'light_support',
    'ttl_shutter', 'sw_shutter', 'analog_intensity', 'sw_intensity'
}

# Kategorie-Mapping (CSV-Wert → Model-Wert)
CATEGORY_MAPPING = {
    'camera': 'Camera',
    'microscope': 'Microscope',
    'hardware autofocus': 'Hardware Autofocus',
    'light source': 'Light source',
    'controller': 'Controller',
    'filterwheel': 'Filterwheel',
    'component': 'Component',
    'computer hardware': 'Computer hardware',
    'accessory': 'Accessory',
    'illumination': 'Illumination',
    'image splitter': 'Image Splitter',
    'shutter': 'Shutter',
    'spinning disk': 'Spinning Disk',
    'xy-stage': 'xy-stage',
    'z-drive': 'z-drive',
    'peripherals': 'Peripherals',
}

# Support Level Mapping
SUPPORT_LEVEL_MAPPING = {
    'official support': 'Official Support',
    'tested by visitron': 'Tested by Visitron',
    'tested and fully supported': 'Tested by Visitron',  # Alias
    'untested, driver provided by manufacturer': 'Untested, driver provided by manufacturer',
    'basic support': 'Basic Support',
    'limited support': 'Basic Support',  # Alias
    'experimental': 'Experimental',
    'third-party driver': 'Third-party driver',
    'discontinued': 'Discontinued',
    'not supported': 'Discontinued',  # Alias
}


def parse_boolean(value):
    """Parse boolean values from CSV (x, X, 1, true, yes → True)"""
    if not value:
        return False
    v = str(value).strip().lower()
    return v in ('x', '1', 'true', 'yes', 'ja', 'y')


def parse_date(value):
    """Parse date from CSV (various formats)"""
    if not value or not value.strip():
        return None
    
    value = value.strip()
    
    # Try various date formats
    formats = [
        '%d.%m.%Y',  # 22.03.2019
        '%Y-%m-%d',  # 2019-03-22
        '%d/%m/%Y',  # 22/03/2019
        '%m/%d/%Y',  # 03/22/2019
        '%d-%m-%Y',  # 22-03-2019
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    
    print(f"  ⚠️  Ungültiges Datum: '{value}'")
    return None


def normalize_category(value):
    """Normalize category value to match model choices"""
    if not value:
        return None
    v = value.strip().lower()
    return CATEGORY_MAPPING.get(v, value.strip())


def normalize_support_level(value):
    """Normalize support level to match model choices"""
    if not value:
        return ''
    v = value.strip().lower()
    return SUPPORT_LEVEL_MAPPING.get(v, value.strip())


def import_csv_file(filepath, dry_run=True, stats=None):
    """Import a single CSV file"""
    if stats is None:
        stats = {'created': 0, 'updated': 0, 'skipped': 0, 'errors': 0}
    
    filename = os.path.basename(filepath)
    print(f"\n📁 Verarbeite: {filename}")
    print("-" * 50)
    
    # Try different encodings
    encodings = ['utf-8-sig', 'utf-8', 'cp1252', 'latin-1', 'iso-8859-1']
    content = None
    used_encoding = None
    
    for encoding in encodings:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                content = f.read()
                used_encoding = encoding
                break
        except UnicodeDecodeError:
            continue
    
    if content is None:
        print(f"  ❌ Konnte Datei nicht lesen (kein passendes Encoding)")
        return stats
    
    print(f"  📝 Encoding: {used_encoding}")
    
    import io
    f = io.StringIO(content)
    
    # Detect delimiter
    sample = content[:2048]
    
    if ';' in sample and sample.count(';') > sample.count(','):
        delimiter = ';'
    else:
        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(sample)
            delimiter = dialect.delimiter
        except csv.Error:
            delimiter = ';'
    
    reader = csv.DictReader(f, delimiter=delimiter)
    
    # Normalize header names
    if reader.fieldnames:
        reader.fieldnames = [h.strip().lower() for h in reader.fieldnames]
    
    row_count = 0
    for row in reader:
        row_count += 1
        
        # Skip empty rows
        manufacturer = row.get('manufacturer', '').strip()
        device = row.get('device', '').strip()
        
        if not manufacturer or not device:
            stats['skipped'] += 1
            continue
        
        # Build data dict
        data = {}
        for csv_col, model_field in COLUMN_MAPPING.items():
            if csv_col in row:
                value = row[csv_col]
                if value is not None:
                    value = value.strip()
                
                if model_field in BOOLEAN_FIELDS:
                    data[model_field] = parse_boolean(value)
                elif model_field == 'category':
                    data[model_field] = normalize_category(value)
                elif model_field == 'support_level':
                    data[model_field] = normalize_support_level(value)
                elif model_field == 'actualization_date':
                    data[model_field] = parse_date(value)
                else:
                    data[model_field] = value or ''
        
        # Validate required fields
        if not data.get('category'):
            print(f"  ⚠️  Zeile {row_count}: Keine Kategorie - übersprungen")
            stats['skipped'] += 1
            continue
        
        # Check if exists (by manufacturer + device + category)
        existing = SupportedHardware.objects.filter(
            manufacturer__iexact=manufacturer,
            device__iexact=device,
            category=data['category']
        ).first()
        
        if dry_run:
            if existing:
                print(f"  🔄 UPDATE: {manufacturer} - {device} ({data['category']})")
                stats['updated'] += 1
            else:
                print(f"  ✅ CREATE: {manufacturer} - {device} ({data['category']})")
                stats['created'] += 1
        else:
            try:
                if existing:
                    # Update existing
                    for field, value in data.items():
                        if field not in ['manufacturer', 'device']:  # Don't update key fields
                            setattr(existing, field, value)
                    existing.save()
                    print(f"  🔄 Aktualisiert: {manufacturer} - {device}")
                    stats['updated'] += 1
                else:
                    # Create new
                    SupportedHardware.objects.create(**data)
                    print(f"  ✅ Erstellt: {manufacturer} - {device}")
                    stats['created'] += 1
            except Exception as e:
                print(f"  ❌ Fehler bei {manufacturer} - {device}: {e}")
                stats['errors'] += 1
    
    print(f"\n  📊 Datei-Statistik: {row_count} Zeilen verarbeitet")
    
    return stats


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Import VisiView Supported Hardware')
    parser.add_argument('--live', action='store_true', help='Führe echten Import durch')
    parser.add_argument('--file', type=str, help='Nur bestimmte Datei importieren')
    parser.add_argument('--delete-existing', action='store_true', help='Lösche alle existierenden Einträge vor Import')
    parser.add_argument('--data-dir', type=str, 
                       default=os.path.join(os.path.dirname(__file__), '..', 'Datenvorlagen', 'compatibility'),
                       help='Verzeichnis mit CSV-Dateien')
    
    args = parser.parse_args()
    dry_run = not args.live
    
    print("=" * 60)
    print("VisiView Supported Hardware Import")
    print("=" * 60)
    
    if dry_run:
        print("\n🔍 DRY-RUN Modus - Keine Änderungen werden vorgenommen")
        print("   Verwende --live für echten Import\n")
    else:
        print("\n🚀 LIVE Modus - Änderungen werden in die Datenbank geschrieben\n")
    
    # Get data directory
    data_dir = os.path.abspath(args.data_dir)
    
    if not os.path.exists(data_dir):
        print(f"❌ Verzeichnis nicht gefunden: {data_dir}")
        sys.exit(1)
    
    print(f"📂 Datenverzeichnis: {data_dir}")
    
    # Collect CSV files
    if args.file:
        csv_files = [os.path.join(data_dir, args.file)]
        if not os.path.exists(csv_files[0]):
            print(f"❌ Datei nicht gefunden: {csv_files[0]}")
            sys.exit(1)
    else:
        csv_files = [
            os.path.join(data_dir, f) 
            for f in ['cameras.csv', 'microscopes.csv', 'Lightsources.csv', 'peripherals.csv']
            if os.path.exists(os.path.join(data_dir, f))
        ]
    
    if not csv_files:
        print("❌ Keine CSV-Dateien gefunden")
        sys.exit(1)
    
    print(f"📄 Zu importierende Dateien: {len(csv_files)}")
    for f in csv_files:
        print(f"   - {os.path.basename(f)}")
    
    # Delete existing if requested
    if args.delete_existing and not dry_run:
        count = SupportedHardware.objects.count()
        if count > 0:
            confirm = input(f"\n⚠️  {count} existierende Einträge werden gelöscht. Fortfahren? (j/n): ")
            if confirm.lower() != 'j':
                print("Abgebrochen.")
                sys.exit(0)
            SupportedHardware.objects.all().delete()
            print(f"🗑️  {count} Einträge gelöscht")
    elif args.delete_existing and dry_run:
        count = SupportedHardware.objects.count()
        print(f"\n🗑️  [DRY-RUN] Würde {count} existierende Einträge löschen")
    
    # Import files
    stats = {'created': 0, 'updated': 0, 'skipped': 0, 'errors': 0}
    
    for filepath in csv_files:
        try:
            import_csv_file(filepath, dry_run=dry_run, stats=stats)
        except Exception as e:
            print(f"❌ Fehler beim Verarbeiten von {filepath}: {e}")
            import traceback
            traceback.print_exc()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 ZUSAMMENFASSUNG")
    print("=" * 60)
    print(f"   ✅ Erstellt:     {stats['created']}")
    print(f"   🔄 Aktualisiert: {stats['updated']}")
    print(f"   ⏭️  Übersprungen: {stats['skipped']}")
    print(f"   ❌ Fehler:       {stats['errors']}")
    print(f"   ────────────────────")
    print(f"   📦 Gesamt:       {stats['created'] + stats['updated']}")
    
    if dry_run:
        print("\n💡 Für echten Import: python import_supported_hardware.py --live")


if __name__ == '__main__':
    main()
