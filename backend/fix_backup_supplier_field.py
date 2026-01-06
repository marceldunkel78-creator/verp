#!/usr/bin/env python
"""
Fix Backup - Supplier Field Name
=================================

Behebt das Problem mit dem Supplier.name Feld im Backup.
Das alte Backup verwendet 'name', das neue Model verwendet 'company_name'.

Verwendung:
1. Backup als SQL-Datei exportieren (falls nicht schon geschehen)
2. Dieses Skript ausführen um das Backup zu reparieren
3. Repariertes Backup wiederherstellen
"""

import sys
import re

def fix_supplier_field_in_backup(input_file, output_file=None):
    """
    Ersetzt alle 'name' Referenzen in der suppliers_supplier Tabelle durch 'company_name'
    """
    if output_file is None:
        output_file = input_file.replace('.sql', '_fixed.sql')
    
    print(f"Reading backup from: {input_file}")
    print(f"Writing fixed backup to: {output_file}")
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        # Versuche mit latin1 encoding
        with open(input_file, 'r', encoding='latin1') as f:
            content = f.read()
    
    # Zähle Ersetzungen
    replacements = 0
    
    # Pattern 1: CREATE TABLE suppliers_supplier - Spaltendefinition
    # Ersetze: "name" character varying(200) -> "company_name" character varying(200)
    pattern1 = r'(\bcreate\s+table\s+public\.suppliers_supplier\s*\([^;]+)"name"(\s+character\s+varying)'
    if re.search(pattern1, content, re.IGNORECASE):
        content = re.sub(pattern1, r'\1"company_name"\2', content, flags=re.IGNORECASE)
        replacements += 1
        print("  ✓ Fixed CREATE TABLE definition")
    
    # Pattern 2: INSERT INTO suppliers_supplier - Spaltenliste
    # Ersetze: (supplier_number, name, ...) -> (supplier_number, company_name, ...)
    pattern2 = r'(\binsert\s+into\s+public\.suppliers_supplier\s*\([^)]*)"name"'
    matches = re.findall(pattern2, content, re.IGNORECASE)
    if matches:
        content = re.sub(pattern2, r'\1"company_name"', content, flags=re.IGNORECASE)
        replacements += len(matches)
        print(f"  ✓ Fixed {len(matches)} INSERT statements")
    
    # Pattern 3: ALTER TABLE ... ADD CONSTRAINT - Foreign Key Referenzen
    # Diese sollten normalerweise kein Problem sein, aber zur Sicherheit
    pattern3 = r'(suppliers_supplier\s+\([^)]*)"name"'
    matches = re.findall(pattern3, content, re.IGNORECASE)
    if matches:
        content = re.sub(pattern3, r'\1"company_name"', content, flags=re.IGNORECASE)
        replacements += len(matches)
        print(f"  ✓ Fixed {len(matches)} constraint references")
    
    # Pattern 4: COPY suppliers_supplier - Column list
    pattern4 = r'(\bCOPY\s+public\.suppliers_supplier\s*\([^)]*)"name"'
    matches = re.findall(pattern4, content, re.IGNORECASE)
    if matches:
        content = re.sub(pattern4, r'\1"company_name"', content, flags=re.IGNORECASE)
        replacements += len(matches)
        print(f"  ✓ Fixed {len(matches)} COPY statements")
    
    # Schreibe reparierte Datei
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\n✓ Fixed {replacements} occurrences of 'name' -> 'company_name'")
    print(f"✓ Repaired backup saved to: {output_file}")
    print("\nYou can now restore this backup in pgAdmin.")
    
    return output_file


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fix_backup_supplier_field.py <backup.sql> [output.sql]")
        print("\nExample:")
        print("  python fix_backup_supplier_field.py verp_backup.sql")
        print("  python fix_backup_supplier_field.py verp_backup.sql verp_backup_fixed.sql")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    fix_supplier_field_in_backup(input_file, output_file)
