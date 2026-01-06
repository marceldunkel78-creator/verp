#!/usr/bin/env python
"""
Convert Custom Backup Format to Django Loaddata Format
=======================================================

Konvertiert das custom Backup-Format in das Django loaddata Format.
"""

import json
import sys

def convert_backup_format(input_file, output_file=None):
    """
    Konvertiert custom backup format zu Django loaddata format
    """
    if output_file is None:
        output_file = input_file.replace('.json', '_django.json')
    
    print(f"Reading backup from: {input_file}")
    
    # Lade custom backup
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Konvertiere zu Django Format
    django_data = []
    
    if 'data' in data and isinstance(data['data'], dict):
        print("\nConverting tables:")
        for model_name, records in data['data'].items():
            print(f"  {model_name}: {len(records)} records")
            
            for record in records:
                # Custom Format hat bereits die richtige Struktur!
                # {'model': 'app.model', 'pk': 123, 'fields': {...}}
                if isinstance(record, dict) and 'model' in record and 'fields' in record:
                    django_data.append(record)
                else:
                    print(f"    ⚠ Skipping invalid record in {model_name}")
    
    print(f"\nTotal records to export: {len(django_data)}")
    
    # Schreibe Django Format
    print(f"Writing Django loaddata format to: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(django_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Conversion complete!")
    print(f"\nYou can now restore with:")
    print(f"  python manage.py loaddata \"{output_file}\"")
    
    return output_file


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python convert_backup_to_django.py <backup.json> [output.json]")
        print("\nExample:")
        print("  python convert_backup_to_django.py verp_backup_20260105.json")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    convert_backup_format(input_file, output_file)
