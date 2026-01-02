#!/usr/bin/env python
"""Check CSV structure"""
import os

csv_file = r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\Trading Products.csv'

encodings = ['utf-8', 'cp1252', 'latin-1', 'iso-8859-1']
for encoding in encodings:
    try:
        with open(csv_file, 'r', encoding=encoding) as f:
            lines = f.readlines()[:5]
            print(f"\n=== Using encoding: {encoding} ===")
            for i, line in enumerate(lines):
                parts = line.strip().split(';')
                print(f"Line {i}: {len(parts)} columns")
                if i < 3:  # Show first 3 lines in detail
                    for j, part in enumerate(parts):
                        print(f"  Col {j}: '{part[:80]}{'...' if len(part) > 80 else ''}'")
            break
    except UnicodeDecodeError:
        continue
