#!/usr/bin/env python
"""
Repariert PostgreSQL Auto-Increment Sequenzen für alle Tabellen.

Problem: Nach Datenimport/Restore können die Sequenzzähler hinter den tatsächlichen
max(id)-Werten liegen, was zu "duplicate key" Fehlern führt.

Usage:
    cd backend
    python fix_sequences.py
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection


def fix_all_sequences():
    """Repariert alle Sequenzen basierend auf den aktuellen Max-IDs"""
    
    print("=" * 70)
    print("FIX POSTGRESQL SEQUENCES")
    print("=" * 70)
    
    with connection.cursor() as cursor:
        # Finde alle Tabellen mit einer id-Sequenz
        cursor.execute("""
            SELECT 
                t.table_name,
                pg_get_serial_sequence(t.table_name, 'id') AS sequence_name
            FROM information_schema.tables t
            JOIN information_schema.columns c ON c.table_name = t.table_name AND c.column_name = 'id'
            WHERE t.table_schema = 'public'
              AND t.table_type = 'BASE TABLE'
              AND pg_get_serial_sequence(t.table_name, 'id') IS NOT NULL
            ORDER BY t.table_name;
        """)
        
        tables = cursor.fetchall()
        
        if not tables:
            print("Keine Tabellen mit Sequenzen gefunden.")
            return
        
        fixed = 0
        already_ok = 0
        
        for table_name, sequence_name in tables:
            # Hole aktuelle Max-ID
            cursor.execute(f'SELECT COALESCE(MAX(id), 0) FROM "{table_name}"')
            max_id = cursor.fetchone()[0]
            
            # Hole aktuellen Sequenzwert
            cursor.execute(f"SELECT last_value FROM {sequence_name}")
            current_seq = cursor.fetchone()[0]
            
            if max_id > current_seq:
                # Sequenz reparieren
                cursor.execute(f"SELECT setval('{sequence_name}', {max_id})")
                new_val = cursor.fetchone()[0]
                print(f"  🔧 {table_name}: Sequenz {current_seq} → {new_val} (max_id={max_id})")
                fixed += 1
            else:
                already_ok += 1
        
        print(f"\n📊 Ergebnis:")
        print(f"  🔧 Repariert: {fixed}")
        print(f"  ✅ Bereits OK: {already_ok}")
        print(f"  📋 Tabellen gesamt: {len(tables)}")


if __name__ == '__main__':
    fix_all_sequences()
    print("\n✅ Fertig!")
