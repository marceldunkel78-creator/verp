#!/usr/bin/env python
"""
Fix Backup - Supplier Field Name (JSON Format)
==============================================

Behebt das Problem mit dem Supplier.name Feld im JSON Backup.
Das alte Backup verwendet 'name', das neue Model verwendet 'company_name'.

Verwendung:
python fix_backup_supplier_field_json.py <backup.json> [output.json]
"""

import sys
import json

def fix_supplier_field_in_json_backup(input_file, output_file=None):
    """
    Ersetzt alle 'name' Referenzen in der suppliers_supplier Tabelle durch 'company_name'
    """
    if output_file is None:
        output_file = input_file.replace('.json', '_fixed.json')
    
    print(f"Reading JSON backup from: {input_file}")
    print(f"Writing fixed backup to: {output_file}")
    
    # Lade JSON
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    replacements = 0
    suppliers_found = False
    
    # pgAdmin JSON Format: Liste von Tabellen mit "data" Arrays
    if isinstance(data, dict):
        # Durchsuche alle Tabellen
        for table_name, table_data in data.items():
            if 'suppliers_supplier' in table_name or table_name == 'suppliers_supplier':
                suppliers_found = True
                print(f"\n✓ Found suppliers_supplier table: {table_name}")
                
                # Wenn es ein "columns" Array gibt
                if 'columns' in table_data:
                    for i, col in enumerate(table_data['columns']):
                        if col == 'name':
                            table_data['columns'][i] = 'company_name'
                            replacements += 1
                            print(f"  ✓ Fixed column name in columns list")
                
                # Wenn es ein "data" Array mit Objekten gibt
                if 'data' in table_data and isinstance(table_data['data'], list):
                    for row in table_data['data']:
                        if isinstance(row, dict) and 'name' in row:
                            row['company_name'] = row.pop('name')
                            replacements += 1
    
    # Alternatives Format: Liste von Records
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                # Prüfe ob es ein Supplier Record ist
                if item.get('table') == 'suppliers_supplier' or 'suppliers_supplier' in str(item.get('table', '')):
                    suppliers_found = True
                    
                    # Columns Array
                    if 'columns' in item:
                        for i, col in enumerate(item['columns']):
                            if col == 'name':
                                item['columns'][i] = 'company_name'
                                replacements += 1
                    
                    # Data Record
                    if 'data' in item and isinstance(item['data'], dict):
                        if 'name' in item['data']:
                            item['data']['company_name'] = item['data'].pop('name')
                            replacements += 1
                    elif 'name' in item:
                        item['company_name'] = item.pop('name')
                        replacements += 1
    
    if not suppliers_found:
        print("\n⚠ Warning: No suppliers_supplier table found in backup!")
        print("This might mean:")
        print("  1. The backup doesn't contain the suppliers table")
        print("  2. The JSON format is different than expected")
        print("\nShowing first few keys/items for debugging:")
        if isinstance(data, dict):
            print(f"Top-level keys: {list(data.keys())[:10]}")
        elif isinstance(data, list) and len(data) > 0:
            print(f"First item keys: {list(data[0].keys())[:10] if isinstance(data[0], dict) else 'Not a dict'}")
    
    # Schreibe reparierte Datei
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Fixed {replacements} occurrences of 'name' -> 'company_name'")
    print(f"✓ Repaired backup saved to: {output_file}")
    
    if replacements > 0:
        print("\nYou can now restore this backup in pgAdmin.")
    
    return output_file


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fix_backup_supplier_field_json.py <backup.json> [output.json]")
        print("\nExample:")
        print("  python fix_backup_supplier_field_json.py verp_backup_20260105.json")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    fix_supplier_field_in_json_backup(input_file, output_file)
