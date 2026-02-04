#!/usr/bin/env python
"""
Update Customer Salutations and Titles
======================================

Liest die Anrede und Titel aus der CSV-Datei AnredeKunden.csv und aktualisiert
die entsprechenden Kunden im VERP System.

Das Matching erfolgt über:
1. Vorname + Nachname + PLZ (falls vorhanden)
2. Firma/Uni + PLZ (falls kein Name vorhanden)

Nur Kunden mit Anrede oder Titel werden aktualisiert.
"""

import os
import sys
import csv
import django
from collections import defaultdict

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db import transaction
from customers.models import Customer, CustomerAddress


# ============================================================================
# Configuration
# ============================================================================

CSV_FILE = os.path.join(os.path.dirname(__file__), '..', 'Datenvorlagen', 'AnredeKunden.csv')

# Mapping von CSV-Anrede zu VERP-Anrede
ANREDE_MAPPING = {
    'Herr': 'Herr',
    'Herrn': 'Herr',
    'Frau': 'Frau',
    'Mr.': 'Mr.',
    'Mrs.': 'Mrs.',
    'Ms.': 'Ms.',
}

# Anreden die "Professor" enthalten - hier wird Professor entfernt und zum Titel hinzugefügt
PROFESSOR_ANREDEN = ['Herr Professor', 'Frau Professor', 'Professor']


def clean_string(s):
    """Bereinigt einen String für Vergleiche."""
    if not s:
        return ''
    return s.strip().lower()


def normalize_anrede_and_titel(anrede, titel):
    """
    Normalisiert Anrede und Titel.
    
    Spezialfall: "Frau Professor" oder "Herr Professor" 
    -> Anrede wird "Frau" oder "Herr"
    -> Titel wird "Prof." vorangestellt (z.B. "Prof. Dr." wenn Titel "Dr." war)
    
    Returns:
        Tuple (normalized_anrede, normalized_titel)
    """
    if not anrede:
        return '', titel.strip() if titel else ''
    
    anrede = anrede.strip()
    titel = titel.strip() if titel else ''
    
    # Prüfe auf Professor-Anreden
    anrede_lower = anrede.lower()
    
    if 'professor' in anrede_lower:
        # Extrahiere Herr/Frau aus der Anrede
        if 'herr' in anrede_lower:
            normalized_anrede = 'Herr'
        elif 'frau' in anrede_lower:
            normalized_anrede = 'Frau'
        else:
            # Nur "Professor" ohne Herr/Frau
            normalized_anrede = ''
        
        # Füge Prof. zum Titel hinzu (wenn nicht schon vorhanden)
        if titel:
            if not titel.lower().startswith('prof'):
                normalized_titel = f"Prof. {titel}"
            else:
                normalized_titel = titel
        else:
            normalized_titel = 'Prof.'
        
        return normalized_anrede, normalized_titel
    
    # Standard-Mapping für normale Anreden
    normalized_anrede = ANREDE_MAPPING.get(anrede, anrede)
    
    return normalized_anrede, titel


def read_csv_file():
    """
    Liest die CSV-Datei und gibt die relevanten Einträge zurück.
    Filtert auf Einträge mit Anrede oder Titel.
    """
    entries = []
    
    # Versuche verschiedene Encodings
    encodings = ['cp1252', 'latin-1', 'utf-8', 'utf-8-sig']
    
    skipped_veraltet = 0
    
    for encoding in encodings:
        try:
            with open(CSV_FILE, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f, delimiter=';')
                for row in reader:
                    # Veraltete Einträge überspringen
                    veraltet = row.get('veraltet', '').strip().upper()
                    if veraltet == 'WAHR' or veraltet == 'TRUE' or veraltet == '1':
                        skipped_veraltet += 1
                        continue
                    
                    anrede = row.get('Anrede', '').strip()
                    titel = row.get('Titel', '').strip()
                    
                    # Nur Einträge mit Anrede oder Titel
                    if not anrede and not titel:
                        continue
                    
                    entries.append({
                        'adressen_id': row.get('AdressenID', '').strip(),
                        'anrede': anrede,
                        'titel': titel,
                        'vorname': row.get('Vorname', '').strip(),
                        'name': row.get('Name', '').strip(),
                        'firma_uni': row.get('Firma/Uni', '').strip(),
                        'institut': row.get('Institut', '').strip(),
                        'plz': row.get('PLZ', '').strip(),
                        'ort': row.get('Ort', '').strip(),
                        'email': row.get('Email', '').strip(),
                    })
            
            print(f"CSV erfolgreich gelesen mit Encoding: {encoding}")
            print(f"Einträge mit Anrede/Titel gefunden: {len(entries)}")
            print(f"Veraltete Einträge übersprungen: {skipped_veraltet}")
            return entries
            
        except UnicodeDecodeError:
            continue
        except Exception as e:
            print(f"Fehler beim Lesen mit Encoding {encoding}: {e}")
            continue
    
    print("FEHLER: Konnte CSV-Datei mit keinem Encoding lesen!")
    return []


def build_customer_search_index():
    """
    Baut einen Such-Index für alle Kunden auf.
    Enthält Kunden-Daten und zugehörige Adressen.
    """
    index = []
    
    customers = Customer.objects.prefetch_related('addresses').all()
    
    for customer in customers:
        # Basis-Eintrag für Kunden ohne Adresse
        customer_entry = {
            'customer': customer,
            'first_name': clean_string(customer.first_name),
            'last_name': clean_string(customer.last_name),
            'addresses': []
        }
        
        # Adressen hinzufügen
        for address in customer.addresses.all():
            customer_entry['addresses'].append({
                'university': clean_string(address.university),
                'institute': clean_string(address.institute),
                'postal_code': clean_string(address.postal_code),
                'city': clean_string(address.city),
            })
        
        index.append(customer_entry)
    
    print(f"Such-Index erstellt: {len(index)} Kunden")
    return index


def find_matching_customer(entry, search_index):
    """
    Findet einen passenden Kunden für einen CSV-Eintrag.
    
    Matching-Strategien (streng - nur eindeutige Matches):
    1. Exakter Match auf Vorname + Nachname + PLZ
    2. Exakter Match auf Vorname + Nachname (ohne PLZ)
    3. Match auf Nachname + PLZ + Firma/Uni (alle drei müssen passen)
    
    WICHTIG: Kein Matching nur über PLZ + Firma ohne Namen!
    """
    vorname = clean_string(entry['vorname'])
    name = clean_string(entry['name'])
    firma_uni = clean_string(entry['firma_uni'])
    institut = clean_string(entry['institut'])
    plz = clean_string(entry['plz'])
    email = clean_string(entry['email'])
    
    # Wenn weder Name noch Vorname vorhanden, kein Matching möglich
    # (wir können nicht nur über Firma matchen, das führt zu Fehlern)
    if not vorname and not name:
        return None
    
    matches = []
    
    for customer_entry in search_index:
        customer = customer_entry['customer']
        c_first = customer_entry['first_name']
        c_last = customer_entry['last_name']
        
        # Strategie 1: Exakter Match auf Vorname + Nachname + PLZ
        if vorname and name and plz:
            for addr in customer_entry['addresses']:
                if addr['postal_code'] == plz:
                    if c_first == vorname and c_last == name:
                        return customer  # Perfekter Match - sofort zurückgeben
        
        # Strategie 2: Exakter Match auf Vorname + Nachname (ohne PLZ aber mit Uni-Prüfung)
        if vorname and name:
            if c_first == vorname and c_last == name:
                # Zusätzliche Prüfung: Wenn Firma/Uni angegeben, muss sie auch matchen
                if firma_uni:
                    for addr in customer_entry['addresses']:
                        uni = addr['university']
                        inst = addr['institute']
                        if (firma_uni in uni or uni in firma_uni) and firma_uni and uni:
                            matches.append(('name_firma', customer, 1))
                            break
                        if (firma_uni in inst or inst in firma_uni) and firma_uni and inst:
                            matches.append(('name_firma', customer, 1))
                            break
                else:
                    matches.append(('name_only', customer, 2))
        
        # Strategie 3: Match auf Nachname + PLZ (nur wenn Vorname im CSV leer)
        if name and plz and not vorname:
            for addr in customer_entry['addresses']:
                if addr['postal_code'] == plz:
                    if c_last == name:
                        # Zusätzliche Prüfung über Firma wenn vorhanden
                        if firma_uni:
                            uni = addr['university']
                            inst = addr['institute']
                            if (firma_uni in uni or uni in firma_uni) and firma_uni and uni:
                                matches.append(('name_plz_firma', customer, 0))
                            elif (firma_uni in inst or inst in firma_uni) and firma_uni and inst:
                                matches.append(('name_plz_firma', customer, 0))
                        else:
                            matches.append(('name_plz', customer, 1))
    
    # Bei mehreren Matches prüfen ob es ein eindeutiger Kunde ist
    if matches:
        # Sortiere nach Priorität (niedrigere Zahl = besser)
        matches.sort(key=lambda x: x[2])
        
        # Prüfe ob bester Match eindeutig ist
        best_priority = matches[0][2]
        best_matches = [m for m in matches if m[2] == best_priority]
        
        # Nur wenn genau ein Kunde mit bester Priorität, diesen zurückgeben
        unique_customers = set(m[1].id for m in best_matches)
        if len(unique_customers) == 1:
            return best_matches[0][1]
    
    return None


def update_customer_salutation(customer, anrede, titel, dry_run=False):
    """
    Aktualisiert Anrede und Titel eines Kunden.
    
    Returns:
        Tuple (updated, changes) - updated ist bool, changes ist dict mit Änderungen
    """
    changes = {}
    normalized_anrede, normalized_titel = normalize_anrede_and_titel(anrede, titel)
    
    # Prüfe Änderungen
    if normalized_anrede and customer.salutation != normalized_anrede:
        changes['salutation'] = (customer.salutation, normalized_anrede)
    
    if normalized_titel and customer.title != normalized_titel:
        changes['title'] = (customer.title, normalized_titel)
    
    if not changes:
        return False, {}
    
    if not dry_run:
        if 'salutation' in changes:
            customer.salutation = normalized_anrede
        if 'title' in changes:
            customer.title = normalized_titel
        customer.save(update_fields=['salutation', 'title', 'updated_at'])
    
    return True, changes


def main(dry_run=True):
    """
    Hauptfunktion für das Update der Anrede und Titel.
    
    Args:
        dry_run: Wenn True, nur Vorschau ohne tatsächliche Änderungen
    """
    print("=" * 70)
    print("Update Customer Salutations and Titles")
    print("=" * 70)
    print(f"Modus: {'DRY RUN (Vorschau)' if dry_run else 'LIVE (Änderungen werden gespeichert)'}")
    print()
    
    # CSV lesen
    print("Lese CSV-Datei...")
    entries = read_csv_file()
    if not entries:
        print("Keine Einträge gefunden oder Fehler beim Lesen.")
        return
    
    print()
    
    # Such-Index aufbauen
    print("Erstelle Such-Index für Kunden...")
    search_index = build_customer_search_index()
    print()
    
    # Statistiken
    stats = {
        'total_csv_entries': len(entries),
        'matched': 0,
        'updated': 0,
        'no_change': 0,
        'not_found': 0,
    }
    
    not_found_entries = []
    updated_entries = []
    
    print("Verarbeite CSV-Einträge...")
    print("-" * 70)
    
    for i, entry in enumerate(entries, 1):
        if i % 1000 == 0:
            print(f"  Fortschritt: {i}/{len(entries)} ({i*100//len(entries)}%)")
        
        customer = find_matching_customer(entry, search_index)
        
        if not customer:
            stats['not_found'] += 1
            not_found_entries.append(entry)
            continue
        
        stats['matched'] += 1
        
        updated, changes = update_customer_salutation(
            customer,
            entry['anrede'],
            entry['titel'],
            dry_run=dry_run
        )
        
        if updated:
            stats['updated'] += 1
            updated_entries.append({
                'customer': customer,
                'entry': entry,
                'changes': changes
            })
        else:
            stats['no_change'] += 1
    
    print()
    print("=" * 70)
    print("ERGEBNIS")
    print("=" * 70)
    print(f"CSV-Einträge insgesamt:     {stats['total_csv_entries']}")
    print(f"Kunden gefunden:            {stats['matched']}")
    print(f"  - Aktualisiert:           {stats['updated']}")
    print(f"  - Keine Änderung nötig:   {stats['no_change']}")
    print(f"Nicht gefunden:             {stats['not_found']}")
    print()
    
    # Zeige Beispiele der Updates
    if updated_entries:
        print("-" * 70)
        print("BEISPIEL-ÄNDERUNGEN (erste 20):")
        print("-" * 70)
        for item in updated_entries[:20]:
            c = item['customer']
            e = item['entry']
            changes = item['changes']
            
            print(f"\n{c.customer_number}: {c.first_name} {c.last_name}")
            print(f"  CSV: {e['vorname']} {e['name']} | {e['firma_uni']} | PLZ: {e['plz']}")
            for field, (old, new) in changes.items():
                print(f"  {field}: '{old}' -> '{new}'")
    
    # Zeige nicht gefundene Einträge
    if not_found_entries and dry_run:
        print()
        print("-" * 70)
        print(f"NICHT GEFUNDENE EINTRÄGE (erste 20 von {len(not_found_entries)}):")
        print("-" * 70)
        for entry in not_found_entries[:20]:
            print(f"  ID: {entry['adressen_id']} | {entry['vorname']} {entry['name']} | "
                  f"{entry['firma_uni']} | PLZ: {entry['plz']} | {entry['anrede']} {entry['titel']}")
    
    print()
    if dry_run:
        print("=" * 70)
        print("Dies war ein DRY RUN - keine Änderungen wurden gespeichert.")
        print("Führen Sie das Script mit --execute aus, um die Änderungen zu speichern.")
        print("=" * 70)


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Aktualisiert Anrede und Titel der Kunden aus CSV-Datei'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Führt die Änderungen tatsächlich aus (ohne diesen Parameter nur Vorschau)'
    )
    
    args = parser.parse_args()
    
    main(dry_run=not args.execute)
