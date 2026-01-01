#!/usr/bin/env python
"""
Import-Skript für Kundenadressen aus AdressenAnsehen.csv

Strategie:
1. Lieferanten ausschließen (Lieferant=WAHR)
2. Veraltete Adressen ausschließen (Anschrift ist veraltet=WAHR)
3. Einträge ohne Vor- UND Nachname ausschließen
4. Bei identischem Vor- und Nachnamen: Kunde als einen behandeln, mehrere Adressen anlegen
5. Telefonnummern: Vorwahl (Ortsnetz) + Anschlussnummer zusammenführen
6. Nicht vorhandene Felder ignorieren

CSV-Spalten → Datenbank-Mapping:
- Vorname → Customer.first_name
- Name → Customer.last_name  
- Email → CustomerEmail.email
- Firma/Uni → CustomerAddress.university
- Institut → CustomerAddress.institute
- Lehrstuhl → CustomerAddress.department
- Straße → CustomerAddress.street (mit Hausnummer extrahieren)
- PLZ → CustomerAddress.postal_code
- Ort → CustomerAddress.city
- Land → CustomerAddress.country (konvertieren zu ISO-Code)
- Anfahrt → CustomerAddress.directions
- Ortsnetz + Anschluß1 → CustomerPhone (Büro)
- Tel2 → CustomerPhone (Mobil oder 2. Büro)
- Tel3 → CustomerPhone (Labor)
- Fax → ignorieren (kein Feld vorhanden)
- Newsletter → CustomerEmail.newsletter_consent
- Institution → ignorieren (in university/institute abgedeckt)
- Marker, Serie, VisiView, Aufträge, Angebote, etc. → ignorieren
"""

import os
import sys
import csv
import re
import django

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db import transaction
from customers.models import Customer, CustomerAddress, CustomerPhone, CustomerEmail


# Land-Mapping: CSV-Wert → ISO-Code
COUNTRY_MAP = {
    'Deutschland': 'DE',
    'Germany': 'DE',
    'Österreich': 'AT',
    'Austria': 'AT',
    'Schweiz': 'CH',
    'Switzerland': 'CH',
    'Frankreich': 'FR',
    'France': 'FR',
    'Italien': 'IT',
    'Italy': 'IT',
    'Spanien': 'ES',
    'Spain': 'ES',
    'Großbritannien': 'GB',
    'United Kingdom': 'GB',
    'UK': 'GB',
    'USA': 'US',
    'Vereinigte Staaten': 'US',
    'Niederlande': 'NL',
    'Netherlands': 'NL',
    'Belgien': 'BE',
    'Belgium': 'BE',
    'Polen': 'PL',
    'Poland': 'PL',
    'Tschechien': 'CZ',
    'Czech Republic': 'CZ',
    'Schweden': 'SE',
    'Sweden': 'SE',
    'Norwegen': 'NO',
    'Norway': 'NO',
    'Dänemark': 'DK',
    'Denmark': 'DK',
    'Kanada': 'CA',
    'Canada': 'CA',
    'Japan': 'JP',
    'China': 'CN',
    'Australien': 'AU',
    'Australia': 'AU',
    'Luxemburg': 'LU',
    'Luxembourg': 'LU',
}


def clean_string(value):
    """Bereinigt einen String-Wert"""
    if not value:
        return ''
    return str(value).strip()


def truncate_field(value, max_length):
    """Kürzt einen String auf die maximale Länge"""
    if not value:
        return value
    value_str = str(value)
    if len(value_str) > max_length:
        return value_str[:max_length]
    return value_str


def parse_bool(value):
    """Konvertiert WAHR/FALSCH zu Boolean"""
    if not value:
        return False
    return str(value).upper() in ('WAHR', 'TRUE', '1', 'JA', 'YES')


def extract_street_and_number(street_str):
    """Extrahiert Straße und Hausnummer aus kombiniertem String"""
    if not street_str:
        return '', ''
    
    street_str = clean_string(street_str)
    
    # Pattern: "Straßenname 123" oder "Straßenname 123a"
    match = re.match(r'^(.+?)\s+(\d+\s*[a-zA-Z]?)$', street_str)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    
    return street_str, ''


def combine_phone(area_code, number):
    """Kombiniert Vorwahl und Anschlussnummer"""
    area = clean_string(area_code)
    num = clean_string(number)
    
    if not num:
        return ''
    
    if area:
        # Normalisiere Vorwahl (entferne führende 0 wenn nötig)
        if not area.startswith('0') and not area.startswith('+'):
            area = '0' + area
        return f"{area} {num}"
    
    return num


def get_country_code(country_name):
    """Konvertiert Ländername zu ISO-Code"""
    if not country_name:
        return 'DE'  # Default
    
    country_name = clean_string(country_name)
    
    # Direkt im Mapping suchen
    if country_name in COUNTRY_MAP:
        return COUNTRY_MAP[country_name]
    
    # Case-insensitive suchen
    for name, code in COUNTRY_MAP.items():
        if name.lower() == country_name.lower():
            return code
    
    # Wenn schon ISO-Code (2 Buchstaben), direkt verwenden
    if len(country_name) == 2 and country_name.isalpha():
        return country_name.upper()
    
    return 'DE'  # Fallback


def get_language_from_country(country_code):
    """Ermittelt Sprache basierend auf Land"""
    lang_map = {
        'DE': 'DE', 'AT': 'DE', 'CH': 'DE', 'LU': 'DE',
        'FR': 'FR', 'BE': 'FR',
        'IT': 'IT',
        'ES': 'ES',
        'US': 'EN', 'GB': 'EN', 'CA': 'EN', 'AU': 'EN',
        'NL': 'EN', 'SE': 'EN', 'NO': 'EN', 'DK': 'EN',
        'PL': 'EN', 'CZ': 'EN', 'JP': 'EN', 'CN': 'EN',
    }
    return lang_map.get(country_code, 'DE')


class AddressImporter:
    def __init__(self, csv_path, dry_run=True):
        self.csv_path = csv_path
        self.dry_run = dry_run
        self.stats = {
            'total_rows': 0,
            'skipped_supplier': 0,
            'skipped_outdated': 0,
            'skipped_no_name': 0,
            'skipped_empty': 0,
            'customers_created': 0,
            'customers_updated': 0,
            'addresses_created': 0,
            'phones_created': 0,
            'emails_created': 0,
            'errors': [],
        }
        # Cache für Kunden nach Vor+Nachname
        self.customer_cache = {}
    
    def load_existing_customers(self):
        """Lädt existierende Kunden in Cache"""
        for customer in Customer.objects.all():
            key = f"{customer.first_name.lower()}|{customer.last_name.lower()}"
            self.customer_cache[key] = customer
        print(f"  {len(self.customer_cache)} existierende Kunden geladen")
    
    def get_or_create_customer(self, first_name, last_name, country_code):
        """Holt oder erstellt einen Kunden basierend auf Name"""
        key = f"{first_name.lower()}|{last_name.lower()}"
        
        if key in self.customer_cache:
            self.stats['customers_updated'] += 1
            return self.customer_cache[key], False
        
        # Neuen Kunden erstellen
        customer = Customer(
            first_name=first_name,
            last_name=last_name,
            language=get_language_from_country(country_code),
            is_active=True,
        )
        
        if not self.dry_run:
            customer.save()
        
        self.customer_cache[key] = customer
        self.stats['customers_created'] += 1
        return customer, True
    
    def address_exists(self, customer, street, postal_code, city):
        """Prüft ob eine ähnliche Adresse bereits existiert"""
        if self.dry_run:
            return False
        
        return CustomerAddress.objects.filter(
            customer=customer,
            street__iexact=street,
            postal_code=postal_code,
            city__iexact=city
        ).exists()
    
    def create_address(self, customer, row):
        """Erstellt eine Adresse für den Kunden"""
        street_raw = clean_string(row.get('Straße', ''))
        street, house_number = extract_street_and_number(street_raw)
        
        postal_code = clean_string(row.get('PLZ', ''))
        city = clean_string(row.get('Ort', ''))
        country_code = get_country_code(row.get('Land', ''))
        
        # Prüfe ob Adresse bereits existiert
        if street and postal_code and city:
            if self.address_exists(customer, street, postal_code, city):
                return None
        
        # Truncate fields to database limits
        address = CustomerAddress(
            customer=customer,
            address_type='Office',
            is_active=True,
            university=truncate_field(clean_string(row.get('Firma/Uni', '')), 200),
            institute=truncate_field(clean_string(row.get('Institut', '')), 200),
            department=truncate_field(clean_string(row.get('Lehrstuhl', '')), 200),
            street=truncate_field(street or '-', 200),  # Pflichtfeld
            house_number=truncate_field(house_number, 20),
            postal_code=truncate_field(postal_code or '-', 20),  # Pflichtfeld
            city=truncate_field(city or '-', 100),  # Pflichtfeld
            country=country_code,
            directions=clean_string(row.get('Anfahrt', '')),  # TextField, no limit
        )
        
        if not self.dry_run:
            address.save()
        
        self.stats['addresses_created'] += 1
        return address
    
    def create_phones(self, customer, row):
        """Erstellt Telefonnummern für den Kunden"""
        phones_created = []
        
        # Haupttelefon: Ortsnetz + Anschluß1
        phone1 = combine_phone(row.get('Ortsnetz', ''), row.get('Anschluß1', ''))
        if phone1:
            phone = CustomerPhone(
                customer=customer,
                phone_type='Büro',
                phone_number=truncate_field(phone1, 50),
                is_primary=True
            )
            if not self.dry_run:
                # Prüfe ob bereits vorhanden
                if not CustomerPhone.objects.filter(customer=customer, phone_number=truncate_field(phone1, 50)).exists():
                    phone.save()
                    phones_created.append(phone)
                    self.stats['phones_created'] += 1
            else:
                phones_created.append(phone)
                self.stats['phones_created'] += 1
        
        # Tel2
        phone2 = clean_string(row.get('Tel2', ''))
        if phone2:
            phone = CustomerPhone(
                customer=customer,
                phone_type='Mobil',
                phone_number=truncate_field(phone2, 50),
                is_primary=False
            )
            if not self.dry_run:
                if not CustomerPhone.objects.filter(customer=customer, phone_number=truncate_field(phone2, 50)).exists():
                    phone.save()
                    phones_created.append(phone)
                    self.stats['phones_created'] += 1
            else:
                phones_created.append(phone)
                self.stats['phones_created'] += 1
        
        # Tel3
        phone3 = clean_string(row.get('Tel3', ''))
        if phone3:
            phone = CustomerPhone(
                customer=customer,
                phone_type='Lab',
                phone_number=truncate_field(phone3, 50),
                is_primary=False
            )
            if not self.dry_run:
                if not CustomerPhone.objects.filter(customer=customer, phone_number=truncate_field(phone3, 50)).exists():
                    phone.save()
                    phones_created.append(phone)
                    self.stats['phones_created'] += 1
            else:
                phones_created.append(phone)
                self.stats['phones_created'] += 1
        
        return phones_created
    
    def create_email(self, customer, row):
        """Erstellt E-Mail für den Kunden"""
        email_str = clean_string(row.get('Email', ''))
        
        if not email_str or '@' not in email_str:
            return None
        
        # Prüfe ob E-Mail bereits existiert
        if not self.dry_run:
            if CustomerEmail.objects.filter(customer=customer, email=email_str).exists():
                return None
        
        newsletter = parse_bool(row.get('Newsletter', ''))
        
        email = CustomerEmail(
            customer=customer,
            email=email_str,
            is_primary=True,
            newsletter_consent=newsletter,
            marketing_consent=newsletter
        )
        
        if not self.dry_run:
            email.save()
        
        self.stats['emails_created'] += 1
        return email
    
    def process_row(self, row, row_num):
        """Verarbeitet eine CSV-Zeile"""
        self.stats['total_rows'] += 1
        
        # 1. Lieferanten ausschließen
        if parse_bool(row.get('Lieferant', '')):
            self.stats['skipped_supplier'] += 1
            return
        
        # 2. Veraltete Adressen ausschließen
        if parse_bool(row.get('Anschrift ist veraltet', '')):
            self.stats['skipped_outdated'] += 1
            return
        
        # 3. Vor- und Nachname prüfen
        first_name = clean_string(row.get('Vorname', ''))
        last_name = clean_string(row.get('Name', ''))
        
        if not first_name and not last_name:
            self.stats['skipped_no_name'] += 1
            return
        
        # Fallback wenn nur einer vorhanden
        if not first_name:
            first_name = '-'
        if not last_name:
            last_name = '-'
        
        # 4. Prüfe ob Zeile überhaupt Daten hat
        has_data = any([
            row.get('Email'),
            row.get('Firma/Uni'),
            row.get('Straße'),
            row.get('Ort'),
        ])
        
        if not has_data:
            self.stats['skipped_empty'] += 1
            return
        
        country_code = get_country_code(row.get('Land', ''))
        
        # Kunde holen oder erstellen
        customer, is_new = self.get_or_create_customer(first_name, last_name, country_code)
        
        # Adresse erstellen
        self.create_address(customer, row)
        
        # Telefonnummern erstellen (nur bei neuem Kunden oder wenn noch keine vorhanden)
        if is_new:
            self.create_phones(customer, row)
        
        # E-Mail erstellen
        self.create_email(customer, row)
    
    def run(self):
        """Führt den Import aus"""
        print(f"\n{'='*60}")
        print(f"CSV-Import: {self.csv_path}")
        print(f"Modus: {'DRY-RUN (keine Änderungen)' if self.dry_run else 'LIVE-IMPORT'}")
        print(f"{'='*60}\n")
        
        # Existierende Kunden laden
        print("Lade existierende Kunden...")
        self.load_existing_customers()
        
        print("Lese CSV-Datei...")
        
        # CSV mit verschiedenen Encodings versuchen
        encodings = ['utf-8', 'cp1252', 'latin-1', 'iso-8859-1']
        
        for encoding in encodings:
            try:
                with open(self.csv_path, 'r', encoding=encoding) as f:
                    # Teste ob lesbar
                    f.read(1000)
                    f.seek(0)
                    
                    reader = csv.DictReader(f, delimiter=';')
                    
                    print(f"  Encoding: {encoding}")
                    print(f"  Spalten: {reader.fieldnames}\n")
                    
                    # Process each row in its own transaction to prevent cascade failures
                    for row_num, row in enumerate(reader, start=2):
                        try:
                            with transaction.atomic():
                                self.process_row(row, row_num)
                                
                                if self.dry_run:
                                    # Rollback bei Dry-Run
                                    transaction.set_rollback(True)
                        except Exception as e:
                            # Log error and continue with next row
                            error_msg = str(e)
                            # Shorten long error messages
                            if len(error_msg) > 100:
                                error_msg = error_msg[:100] + '...'
                            self.stats['errors'].append(f"Zeile {row_num}: {error_msg}")
                        
                        # Progress alle 1000 Zeilen
                        if row_num % 1000 == 0:
                            print(f"  Verarbeitet: {row_num} Zeilen...")
                    
                    break  # Erfolgreich gelesen
                    
            except UnicodeDecodeError:
                continue
            except Exception as e:
                print(f"Fehler mit Encoding {encoding}: {e}")
                continue
        
        self.print_stats()
    
    def print_stats(self):
        """Gibt Statistiken aus"""
        print(f"\n{'='*60}")
        print("IMPORT-STATISTIK")
        print(f"{'='*60}")
        print(f"Gesamt Zeilen:           {self.stats['total_rows']:>8}")
        print(f"Übersprungen (Lieferant):{self.stats['skipped_supplier']:>8}")
        print(f"Übersprungen (veraltet): {self.stats['skipped_outdated']:>8}")
        print(f"Übersprungen (kein Name):{self.stats['skipped_no_name']:>8}")
        print(f"Übersprungen (leer):     {self.stats['skipped_empty']:>8}")
        print(f"{'-'*60}")
        print(f"Kunden erstellt:         {self.stats['customers_created']:>8}")
        print(f"Kunden aktualisiert:     {self.stats['customers_updated']:>8}")
        print(f"Adressen erstellt:       {self.stats['addresses_created']:>8}")
        print(f"Telefonnummern erstellt: {self.stats['phones_created']:>8}")
        print(f"E-Mails erstellt:        {self.stats['emails_created']:>8}")
        print(f"{'='*60}")
        
        if self.stats['errors']:
            print(f"\nFEHLER ({len(self.stats['errors'])}):")
            for error in self.stats['errors'][:20]:  # Max 20 anzeigen
                print(f"  - {error}")
            if len(self.stats['errors']) > 20:
                print(f"  ... und {len(self.stats['errors']) - 20} weitere")
        
        if self.dry_run:
            print("\n[!] DRY-RUN: Keine Daten wurden gespeichert!")
            print("    Für echten Import: python import_addresses.py --live")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Importiert Kundenadressen aus CSV')
    parser.add_argument('--csv', default='../Datenvorlagen/AdressenAnsehen.csv',
                        help='Pfad zur CSV-Datei')
    parser.add_argument('--live', action='store_true',
                        help='Führt echten Import aus (ohne: nur Dry-Run)')
    
    args = parser.parse_args()
    
    # Pfad relativ zum Skript auflösen
    csv_path = os.path.join(os.path.dirname(__file__), args.csv)
    
    if not os.path.exists(csv_path):
        print(f"Fehler: CSV-Datei nicht gefunden: {csv_path}")
        sys.exit(1)
    
    importer = AddressImporter(csv_path, dry_run=not args.live)
    importer.run()


if __name__ == '__main__':
    main()
