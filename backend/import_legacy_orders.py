#!/usr/bin/env python
"""
Legacy Order Import Script
==========================

Importiert historische Aufträge aus der Access-Datenbank in VERP.

WICHTIG: 
- Es werden KEINE neuen Kunden angelegt - nur bestehende verlinkt
- Es werden KEINE neuen Produkte oder Angebote angelegt
- Die originalen Auftragsnummern werden übernommen (Format: Jahr-AngebotNummer)
- Wiederholter Import überspringt bereits existierende Aufträge

Datenstruktur Access -> VERP Mapping:
=====================================

Aufträge.csv (Legacy Order Header)
----------------------------------
- AuftragsID         -> Interne ID (für Positions-Zuordnung)
- AngebotNummer      -> Teil der Auftragsnummer (z.B. "101")  
- Jahr               -> Teil der Auftragsnummer (z.B. "1995")
- AdressenID         -> customer (via Matching)
- Auftragsname       -> customer_contact_name
- Auftragsbestellnummer -> customer_order_number
- Auftragsdatum      -> order_date
- Datum              -> confirmation_date
- Bestätigungadresse -> confirmation_address (als Text)
- Lieferadresse      -> shipping_address (als Text)
- Rechnungsadresse   -> billing_address (als Text)
- VerkäuferID        -> sales_person (via Mitarbeiter-Mapping)
- VerwaltungID       -> created_by (via Mitarbeiter-Mapping)
- Absprachen         -> order_notes
- Kommentar          -> notes (intern)
- Zahlungsziel       -> payment_term
- Lieferbedingungen  -> delivery_term
- Garantie           -> warranty_term
- Lieferzeitraum in Wochen -> delivery_time_weeks
- MwSt               -> tax_enabled (WAHR/FALSCH)
- MwStProzent        -> tax_rate
- Systempreis        -> (optional - System-Preis)
- Summe/Gesamtpreis  -> (berechnet aus Positionen)

AuftragsPositionen.csv (Legacy Order Items)
-------------------------------------------
- PositionsID        -> Interne ID
- PositionsNr        -> position
- AngebotID          -> order (via AuftragsID in Aufträge)
- Stückzahl          -> quantity
- ProduktID          -> (Referenz - nicht verlinkt)
- Stückpreis         -> list_price / final_price
- Sondervereinbarungen -> description (custom text)
- Einkaufspreis      -> purchase_price
- SerienNr           -> serial_number
- LieferNr           -> delivery_note_number
- RechnungNr         -> invoice_number
- Lieferdatum        -> (gespeichert wenn vorhanden)
- Bemerkungen        -> (zusätzliche Notizen)

Adressen.csv (Legacy Customer Addresses)
----------------------------------------
- AdressenID         -> ID für Matching
- Vorname/Name       -> Kundensuche
- Firma/Uni          -> company_name für Kundensuche
- PLZ/Ort            -> Für Matching
"""

import os
import sys
import csv
import django
from datetime import datetime
from decimal import Decimal, InvalidOperation

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db import transaction
from customers.models import Customer
from customer_orders.models import CustomerOrder, CustomerOrderItem
from users.models import User
from verp_settings.models import PaymentTerm, DeliveryTerm, WarrantyTerm


# ============================================================================
# Configuration
# ============================================================================

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'Datenvorlagen', 'aufragsrekonstruktion_complete')

# Mitarbeiter-Mapping (Legacy MitarbeiterID -> Username oder None)
MITARBEITER_MAPPING = {
    0: None,
    1: 'wurm',
    2: 'kuehn',      # Kühn
    3: 'waltinger',
    4: 'busch',
    5: 'gulde',
    6: 'willberg',
    7: 'draude',
    8: 'guckler',
}

# Status für importierte Aufträge
IMPORT_STATUS = 'abgeschlossen'  # Legacy-Aufträge gelten als abgeschlossen


# ============================================================================
# Helper Functions
# ============================================================================

def parse_german_decimal(value):
    """Parst deutsche Dezimalzahlen (1.234,56 -> 1234.56)"""
    if not value or value.strip() == '':
        return Decimal('0')
    try:
        # Entferne Tausender-Punkte und ersetze Komma durch Punkt
        cleaned = str(value).replace('.', '').replace(',', '.')
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return Decimal('0')


def parse_german_date(value):
    """Parst deutsche Datumsformate (DD.MM.YYYY)"""
    if not value or value.strip() == '':
        return None
    try:
        # Versuche verschiedene Formate
        for fmt in ['%d.%m.%Y', '%d.%m.%y']:
            try:
                dt = datetime.strptime(value.strip(), fmt)
                # Korrigiere 2-stelliges Jahr
                if dt.year < 100:
                    dt = dt.replace(year=dt.year + 1900 if dt.year >= 90 else dt.year + 2000)
                return dt.date()
            except ValueError:
                continue
        return None
    except Exception:
        return None


def parse_german_bool(value):
    """Parst deutsche Booleans (WAHR/FALSCH, 1/0)"""
    if not value:
        return False
    val = str(value).strip().upper()
    return val in ('WAHR', 'TRUE', '1', 'JA', 'YES')


def clean_address_text(text):
    """Bereinigt mehrzeiligen Adress-Text"""
    if not text:
        return ''
    # Entferne führende/nachfolgende Whitespace und leere Zeilen
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    return '\n'.join(lines)


def load_csv_data(filename):
    """Lädt CSV-Datei mit Semikolon-Trennung und UTF-8/Latin1 Encoding"""
    filepath = os.path.join(DATA_DIR, filename)
    
    # Versuche verschiedene Encodings
    for encoding in ['utf-8-sig', 'utf-8', 'latin1', 'cp1252']:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f, delimiter=';')
                data = list(reader)
                print(f"  Loaded {filename} ({len(data)} rows, encoding: {encoding})")
                return data
        except (UnicodeDecodeError, UnicodeError):
            continue
    
    raise ValueError(f"Could not decode {filename} with any known encoding")


def create_customer_from_legacy_address(address_data, existing_customers, search_index, newly_created_cache, dry_run=False):
    """
    Erstellt einen neuen Kunden aus Legacy-Adressdaten.
    Prüft zuerst, ob der Kunde bereits existiert (anhand Firma+PLZ).
    
    Args:
        address_data: Legacy-Adressdaten
        existing_customers: Liste aller existierenden Kunden
        search_index: Such-Index für Matching
        newly_created_cache: Dict zum Tracken neu erstellter Kunden (firma+plz -> customer)
        dry_run: Wenn True, nur simulieren
    
    Returns:
        Customer object (oder simuliertes Dict im Dry-Run) oder None bei Fehler
    """
    from customers.models import CustomerAddress
    
    # Extrahiere Daten
    vorname = address_data.get('Vorname', '').strip()
    name = address_data.get('Name', '').strip()
    firma = address_data.get('Firma/Uni', '').strip()
    strasse = address_data.get('Strasse', '').strip()
    plz = address_data.get('PLZ', '').strip()
    ort = address_data.get('Ort', '').strip()
    land = address_data.get('Land', 'DE').strip() or 'DE'
    
    # Cache-Key für Duplikat-Erkennung
    cache_key = f"{firma.lower()}|{plz}" if firma and plz else f"{name.lower()}|{plz}"
    
    # Prüfe ob wir diesen Kunden gerade eben erstellt haben
    if cache_key in newly_created_cache:
        cached = newly_created_cache[cache_key]
        if dry_run:
            cached['reused_count'] = cached.get('reused_count', 0) + 1
            print(f"    [CACHE-HIT] Would reuse newly created customer: {firma or name} ({plz})")
        else:
            print(f"    [CACHE-HIT] Reusing newly created customer: {cached.customer_number}")
        return cached
    
    # Prüfe ob ein ähnlicher Kunde bereits in der DB existiert
    if firma and plz:
        firma_lower = firma.lower()
        for entry in search_index:
            if entry['postal_code'] == plz:
                uni_lower = entry['university'].lower()
                inst_lower = entry['institute'].lower()
                
                # Exakter Match auf Universität + PLZ
                if uni_lower and (firma_lower in uni_lower or uni_lower in firma_lower):
                    if not dry_run:
                        print(f"    [FOUND] Customer already exists: {entry['customer'].customer_number}")
                    return entry['customer']
                
                # Match auf Institut + PLZ
                if inst_lower and (firma_lower in inst_lower or inst_lower in firma_lower):
                    if not dry_run:
                        print(f"    [FOUND] Customer already exists: {entry['customer'].customer_number}")
                    return entry['customer']
    
    # Bestimme Vor- und Nachname
    if not vorname and not name:
        # Wenn kein Name, verwende Firma als Nachname
        first_name = ''
        last_name = firma[:100] if firma else 'Unbekannt'
    else:
        first_name = vorname[:100] if vorname else ''
        last_name = name[:100] if name else 'Unbekannt'
    
    if dry_run:
        # Im Dry-Run: Simuliere Kunde
        simulated_customer = {
            'customer_number': f'K-NEW-{len(newly_created_cache)+1:05d}',
            'first_name': first_name,
            'last_name': last_name,
            'firma': firma,
            'plz': plz,
            'ort': ort,
            'reused_count': 0,
            'is_simulation': True
        }
        newly_created_cache[cache_key] = simulated_customer
        print(f"    [SIMULATE] Would create customer: {firma or f'{first_name} {last_name}'} ({plz} {ort})")
        return simulated_customer
    
    try:
        # Erstelle Kunden
        customer = Customer.objects.create(
            first_name=first_name,
            last_name=last_name,
            language='DE',
            is_active=True
        )
        
        print(f"    [CREATED] New customer: {customer.customer_number} - {firma or f'{first_name} {last_name}'}")
        
        # Erstelle Adresse wenn vorhanden
        if strasse and plz and ort:
            # Trenne Hausnummer von Straße (einfache Heuristik)
            street_parts = strasse.rsplit(' ', 1)
            if len(street_parts) == 2 and any(c.isdigit() for c in street_parts[1]):
                street = street_parts[0][:200]
                house_number = street_parts[1][:20]
            else:
                street = strasse[:200]
                house_number = ''
            
            CustomerAddress.objects.create(
                customer=customer,
                address_type='Office',
                university=firma[:200] if firma else '',
                street=street,
                house_number=house_number,
                postal_code=plz[:20],
                city=ort[:100],
                country=land[:2] if len(land) == 2 else 'DE',
                is_active=True
            )
            
            # Füge neuen Kunden zum search_index hinzu für zukünftige Matches
            search_index.append({
                'customer': customer,
                'customer_name': f"{customer.first_name} {customer.last_name}".lower(),
                'university': firma[:200].lower() if firma else '',
                'institute': '',
                'department': '',
                'postal_code': plz[:20],
                'city': ort[:100].lower(),
                'street': street.lower(),
            })
        
        # Cache den neuen Kunden
        newly_created_cache[cache_key] = customer
        
        return customer
        
    except Exception as e:
        print(f"    [ERROR] Could not create customer: {e}")
        return None


# ============================================================================
# Customer Matching
# ============================================================================

def build_customer_search_index(customers):
    """
    Baut einen Such-Index für Kunden auf Basis ihrer Adressen.
    
    Returns:
        List von Dicts mit customer, search_terms (name, university, institute, plz, city)
    """
    from customers.models import CustomerAddress
    
    index = []
    for customer in customers:
        # Basis-Info vom Kunden
        customer_name = f"{customer.first_name} {customer.last_name}".strip().lower()
        
        # Alle Adressen des Kunden
        addresses = CustomerAddress.objects.filter(customer=customer)
        
        for addr in addresses:
            entry = {
                'customer': customer,
                'customer_name': customer_name,
                'university': (addr.university or '').lower(),
                'institute': (addr.institute or '').lower(),
                'department': (addr.department or '').lower(),
                'postal_code': (addr.postal_code or '').strip(),
                'city': (addr.city or '').lower(),
                'street': (addr.street or '').lower(),
            }
            index.append(entry)
        
        # Falls keine Adresse, trotzdem hinzufügen
        if not addresses.exists():
            index.append({
                'customer': customer,
                'customer_name': customer_name,
                'university': '',
                'institute': '',
                'department': '',
                'postal_code': '',
                'city': '',
                'street': '',
            })
    
    return index


def find_customer_by_legacy_address(address_data, search_index):
    """
    Versucht einen Kunden anhand der Legacy-Adresse zu finden.
    
    Matching-Strategie:
    1. Exakter Match auf Universität/Firma + PLZ
    2. Match auf Name + PLZ
    3. Teilmatch auf Universität/Institut
    """
    firma = address_data.get('Firma/Uni', '').strip()
    name = address_data.get('Name', '').strip()
    plz = address_data.get('PLZ', '').strip()
    ort = address_data.get('Ort', '').strip()
    strasse = address_data.get('Strasse', '').strip()
    
    if not (firma or name):
        return None
    
    # Normalisiere für Suche
    firma_lower = firma.lower() if firma else ''
    name_lower = name.lower() if name else ''
    ort_lower = ort.lower() if ort else ''
    strasse_lower = strasse.lower() if strasse else ''
    
    best_match = None
    best_score = 0
    
    for entry in search_index:
        score = 0
        
        # PLZ Match (wichtigster Faktor)
        if plz and entry['postal_code'] == plz:
            score += 50
        
        # Universität/Firma Match
        if firma_lower:
            uni = entry['university']
            inst = entry['institute']
            dept = entry['department']
            
            if uni and (firma_lower in uni or uni in firma_lower):
                score += 40
            elif inst and (firma_lower in inst or inst in firma_lower):
                score += 30
            elif dept and (firma_lower in dept or dept in firma_lower):
                score += 20
        
        # Name Match (Kundenname)
        if name_lower and entry['customer_name']:
            # Prüfe Namensbestandteile
            name_parts = set(name_lower.split())
            cust_parts = set(entry['customer_name'].split())
            common = name_parts & cust_parts
            if len(common) >= 1:
                score += 20 * len(common)
        
        # Stadt Match
        if ort_lower and entry['city']:
            if ort_lower in entry['city'] or entry['city'] in ort_lower:
                score += 10
        
        # Straße Match (Bonus)
        if strasse_lower and entry['street']:
            if strasse_lower[:10] in entry['street'] or entry['street'][:10] in strasse_lower:
                score += 15
        
        # Bestes Match speichern
        if score > best_score:
            best_score = score
            best_match = entry['customer']
    
    # Nur zurückgeben wenn Score hoch genug (mindestens PLZ + etwas Match)
    if best_score >= 60:
        return best_match
    
    return None


# ============================================================================
# Main Import Logic
# ============================================================================

def import_legacy_orders(dry_run=True, limit=None):
    """
    Hauptimport-Funktion für Legacy-Aufträge.
    
    Args:
        dry_run: Wenn True, werden keine Daten gespeichert
        limit: Max. Anzahl zu importierender Aufträge (None = alle)
    """
    print("\n" + "="*80)
    print("LEGACY ORDER IMPORT")
    print("="*80)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE IMPORT'}")
    print(f"Limit: {limit if limit else 'All orders'}")
    print()
    
    # ========================================================================
    # Step 1: Load CSV Data
    # ========================================================================
    print("Loading CSV data...")
    orders_data = load_csv_data('Aufträge.csv')
    positions_data = load_csv_data('AuftragsPositionen.csv')
    addresses_data = load_csv_data('Adressen.csv')
    
    # NEW: Load Auftragsnummern-ID for proper order numbers
    order_numbers_data = load_csv_data('Auftragsnummern-ID.csv')
    
    # NEW: Load Produkte.csv for article names and descriptions
    produkte_data = load_csv_data('Produkte.csv')
    
    # NEW: Load Positionen.csv for Sondervereinbarungen (linked via AngebotID)
    angebots_positionen_data = load_csv_data('Positionen.csv')
    
    # Build order number lookup by AuftragsID
    order_number_lookup = {}
    for row in order_numbers_data:
        auftrags_id = row.get('AuftragsID', '')
        order_nr = row.get('Auftrags Nr.', '').strip()
        if auftrags_id and order_nr:
            order_number_lookup[auftrags_id] = order_nr
    print(f"  Order number lookup: {len(order_number_lookup)} entries")
    
    # Build product lookup by ProduktID
    produkt_lookup = {}
    for prod in produkte_data:
        prod_id = prod.get('ProduktID', '')
        if prod_id:
            produkt_lookup[prod_id] = {
                'artikel': prod.get('Artikel', '').strip(),
                'kennung': prod.get('Kennung', '').strip(),
                'beschreibung': prod.get('ProduktBeschreibung', '').strip(),
            }
    print(f"  Product lookup: {len(produkt_lookup)} entries")
    
    # Build Angebots-Positionen lookup by AngebotID+PositionsNr for Sondervereinbarungen
    angebots_pos_lookup = {}
    for pos in angebots_positionen_data:
        angebot_id = pos.get('AngebotID', '')
        pos_nr = pos.get('PositionsNr', '')
        if angebot_id:
            key = f"{angebot_id}:{pos_nr}"
            angebots_pos_lookup[key] = {
                'sondervereinbarungen': pos.get('Sondervereinbarungen', '').strip(),
            }
    print(f"  Angebots-Positionen lookup: {len(angebots_pos_lookup)} entries")
    
    # Build address lookup by AdressenID
    address_lookup = {}
    for addr in addresses_data:
        addr_id = addr.get('AdressenID', '')
        if addr_id:
            address_lookup[addr_id] = addr
    
    print(f"  Address lookup: {len(address_lookup)} entries")
    
    # Build positions lookup by AngebotID
    # IMPORTANT: AuftragsPositionen.AngebotID matches Aufträge.AuftragsID (NOT Version field!)
    # The relationship is: Aufträge.AuftragsID == AuftragsPositionen.AngebotID
    positions_by_auftrags_id = {}
    for pos in positions_data:
        auftrags_ref = pos.get('AngebotID', '')  # This actually refers to AuftragsID!
        if auftrags_ref:
            if auftrags_ref not in positions_by_auftrags_id:
                positions_by_auftrags_id[auftrags_ref] = []
            positions_by_auftrags_id[auftrags_ref].append(pos)
    
    print(f"  Positions grouped: {len(positions_by_auftrags_id)} orders with items")
    
    # ========================================================================
    # Step 2: Load VERP Data for Matching
    # ========================================================================
    print("\nLoading VERP reference data...")
    
    # Load all customers for matching
    customers = list(Customer.objects.all())
    print(f"  Customers in VERP: {len(customers)}")
    
    # Build search index for customer matching
    print("  Building customer search index...")
    customer_search_index = build_customer_search_index(customers)
    print(f"  Customer search index: {len(customer_search_index)} entries")
    
    # Load users for Mitarbeiter mapping
    users = {u.username.lower(): u for u in User.objects.all()}
    print(f"  Users in VERP: {len(users)}")
    
    # Load payment/delivery/warranty terms
    payment_terms = {pt.name.lower(): pt for pt in PaymentTerm.objects.all()}
    delivery_terms = {dt.incoterm.lower(): dt for dt in DeliveryTerm.objects.all()}
    warranty_terms = {}  # WarrantyTerm might not exist yet
    try:
        warranty_terms = {wt.name.lower(): wt for wt in WarrantyTerm.objects.all()}
    except Exception:
        pass
    print(f"  Payment terms: {len(payment_terms)}")
    print(f"  Delivery terms: {len(delivery_terms)}")
    print(f"  Warranty terms: {len(warranty_terms)}")
    
    # Get existing order numbers to avoid duplicates
    existing_orders = set(CustomerOrder.objects.values_list('order_number', flat=True))
    print(f"  Existing orders in VERP: {len(existing_orders)}")
    
    # ========================================================================
    # Step 3: Process Orders
    # ========================================================================
    print("\nProcessing orders...")
    
    stats = {
        'total': 0,
        'imported': 0,
        'skipped_exists': 0,
        'skipped_no_customer': 0,
        'skipped_no_items': 0,
        'errors': 0,
        'items_created': 0,
        'customers_found': 0,
        'customers_created': 0,
    }
    
    unmatched_customers = {}  # Track unmatched for reporting
    newly_created_cache = {}  # Cache für neu erstellte Kunden (Duplikat-Vermeidung)
    
    for i, order_row in enumerate(orders_data):
        if limit and stats['imported'] >= limit:
            print(f"\nReached limit of {limit} orders")
            break
        
        stats['total'] += 1
        
        # Get AuftragsID for order number lookup
        auftrags_id = order_row.get('AuftragsID', '')
        
        # Get proper order number from Auftragsnummern-ID.csv
        order_number = order_number_lookup.get(auftrags_id)
        
        if not order_number:
            # Fallback: Build from Jahr + AngebotNummer with L- prefix
            jahr = order_row.get('Jahr', '')
            angebot_nr = order_row.get('AngebotNummer', '')
            if jahr and angebot_nr:
                order_number = f"L-{jahr}-{angebot_nr.zfill(4)}"
            else:
                print(f"  [SKIP] Row {i+1}: No order number found for AuftragsID {auftrags_id}")
                stats['errors'] += 1
                continue
        
        # Skip if already exists
        if order_number in existing_orders:
            stats['skipped_exists'] += 1
            continue
        
        # Get address and find customer
        adressen_id = order_row.get('AdressenID', '')
        address_data = address_lookup.get(adressen_id, {})
        
        customer = find_customer_by_legacy_address(address_data, customer_search_index)
        
        if customer:
            stats['customers_found'] += 1
        
        if not customer:
            # Versuche, Kunden aus Adressdaten zu erstellen
            firma = address_data.get('Firma/Uni', 'UNKNOWN')
            name = address_data.get('Name', '')
            
            if dry_run:
                # Dry-Run: Simuliere Customer-Creation
                customer = create_customer_from_legacy_address(
                    address_data, customers, customer_search_index, 
                    newly_created_cache, dry_run=True
                )
                if customer:
                    stats['customers_created'] += 1
            else:
                print(f"  [CREATE] Creating customer for {firma} / {name}...")
                customer = create_customer_from_legacy_address(
                    address_data, customers, customer_search_index,
                    newly_created_cache, dry_run=False
                )
                
                if customer:
                    stats['customers_created'] += 1
            
            if not customer:
                # Kunde konnte nicht erstellt werden
                key = f"{adressen_id}:{firma}"
                if key not in unmatched_customers:
                    unmatched_customers[key] = {
                        'id': adressen_id,
                        'firma': firma,
                        'plz': address_data.get('PLZ', ''),
                        'ort': address_data.get('Ort', ''),
                        'count': 0
                    }
                unmatched_customers[key]['count'] += 1
                stats['skipped_no_customer'] += 1
                continue
        
        # Get order items by AuftragsID (which matches AngebotID in AuftragsPositionen)
        # IMPORTANT: Use AuftragsID, NOT Version field!
        # Version field refers to quotation version, AuftragsID matches the actual positions
        order_positions = positions_by_auftrags_id.get(auftrags_id, [])
        
        if not order_positions:
            stats['skipped_no_items'] += 1
            continue
        
        # Parse order data
        order_date = parse_german_date(order_row.get('Auftragsdatum', ''))
        confirmation_date = parse_german_date(order_row.get('Datum', ''))
        
        # Get sales person from Mitarbeiter mapping
        verkaeufer_id = int(order_row.get('VerkäuferID', '0') or '0')
        verwaltung_id = int(order_row.get('VerwaltungID', '0') or '0')
        
        sales_username = MITARBEITER_MAPPING.get(verkaeufer_id)
        creator_username = MITARBEITER_MAPPING.get(verwaltung_id)
        
        sales_person = users.get(sales_username) if sales_username else None
        created_by = users.get(creator_username) if creator_username else None
        
        # Parse addresses
        confirmation_addr = clean_address_text(order_row.get('Bestätigungadresse', ''))
        shipping_addr = clean_address_text(order_row.get('Lieferadresse', ''))
        billing_addr = clean_address_text(order_row.get('Rechnungsadresse', ''))
        
        # Tax settings
        tax_enabled = parse_german_bool(order_row.get('MwSt', 'WAHR'))
        tax_rate = parse_german_decimal(order_row.get('MwStProzent', '15'))
        if tax_rate == 0 and tax_enabled:
            tax_rate = Decimal('15')  # Default für alte Aufträge
        
        # Delivery time
        delivery_weeks = int(order_row.get('Lieferzeitraum in Wochen', '0') or '0')
        
        # Build order notes from multiple fields
        notes_parts = []
        absprachen = order_row.get('Absprachen', '').strip()
        kommentar = order_row.get('Kommentar', '').strip()
        if absprachen:
            notes_parts.append(f"Absprachen: {absprachen}")
        if kommentar:
            notes_parts.append(f"Kommentar: {kommentar}")
        
        if not dry_run:
            try:
                with transaction.atomic():
                    # Create order
                    order = CustomerOrder.objects.create(
                        order_number=order_number,
                        status=IMPORT_STATUS,
                        customer=customer,
                        quotation=None,  # No quotation link for legacy
                        customer_order_number=order_row.get('Auftragsbestellnummer', ''),
                        customer_contact_name=order_row.get('Auftragsname', ''),
                        order_date=order_date,
                        confirmation_date=confirmation_date,
                        confirmation_address=confirmation_addr if confirmation_addr else None,
                        shipping_address=shipping_addr if shipping_addr else None,
                        billing_address=billing_addr if billing_addr else None,
                        delivery_time_weeks=delivery_weeks,
                        tax_enabled=tax_enabled,
                        tax_rate=tax_rate,
                        notes='\n\n'.join(notes_parts) if notes_parts else '',
                        order_notes=absprachen,
                        sales_person=sales_person,
                        created_by=created_by,
                    )
                    
                    # Create order items
                    for pos_row in order_positions:
                        pos_nr = int(pos_row.get('PositionsNr', '1') or '1')
                        quantity = parse_german_decimal(pos_row.get('Stückzahl', '1'))
                        if quantity == 0:
                            quantity = Decimal('1')
                        
                        list_price = parse_german_decimal(pos_row.get('Stückpreis', '0'))
                        purchase_price = parse_german_decimal(pos_row.get('Einkaufspreis', '0'))
                        
                        # Get ProduktID for product lookup
                        produkt_id = pos_row.get('ProduktID', '')
                        produkt_info = produkt_lookup.get(produkt_id, {})
                        
                        # Position name from Produkte.Artikel
                        position_name = produkt_info.get('artikel', '')
                        article_number = produkt_info.get('kennung', '')
                        produkt_beschreibung = produkt_info.get('beschreibung', '')
                        
                        # Get Sondervereinbarungen from Positionen.csv via AuftragsID
                        # Positionen.csv also uses AngebotID which corresponds to AuftragsID
                        angebots_pos_key = f"{auftrags_id}:{pos_nr}"
                        angebots_pos_info = angebots_pos_lookup.get(angebots_pos_key, {})
                        sondervereinbarungen = angebots_pos_info.get('sondervereinbarungen', '')
                        
                        # Also check Sondervereinbarungen directly in AuftragsPositionen
                        auftrags_sondervereinbarungen = pos_row.get('Sondervereinbarungen', '').strip()
                        
                        # Build description: ProduktBeschreibung + Sondervereinbarungen
                        desc_parts = []
                        if produkt_beschreibung:
                            desc_parts.append(produkt_beschreibung)
                        if sondervereinbarungen:
                            desc_parts.append(sondervereinbarungen)
                        if auftrags_sondervereinbarungen and auftrags_sondervereinbarungen not in desc_parts:
                            desc_parts.append(auftrags_sondervereinbarungen)
                        description = '\n'.join(desc_parts)
                        
                        # Fallback name if no product found
                        if not position_name:
                            position_name = auftrags_sondervereinbarungen[:100] if auftrags_sondervereinbarungen else f"Position {pos_nr}"
                        
                        # Serial number
                        serial = pos_row.get('SerienNr', '').strip()
                        if serial == '..............................' or serial == '.....':
                            serial = ''  # Clean placeholder
                        
                        # Delivery/Invoice numbers
                        delivery_nr = int(pos_row.get('LieferNr', '1') or '1')
                        invoice_nr = int(pos_row.get('RechnungNr', '1') or '1')
                        
                        CustomerOrderItem.objects.create(
                            order=order,
                            position=pos_nr,
                            position_display=str(pos_nr),
                            article_number=article_number,
                            name=position_name,
                            description=description,
                            purchase_price=purchase_price,
                            list_price=list_price,
                            final_price=list_price,  # No discount stored
                            quantity=quantity,
                            unit='Stück',
                            currency='DEM',  # Deutsche Mark for old orders
                            delivery_note_number=delivery_nr,
                            invoice_number=invoice_nr,
                            serial_number=serial,
                            is_delivered=True,  # Legacy orders are completed
                            is_invoiced=True,
                        )
                        stats['items_created'] += 1
                    
                    existing_orders.add(order_number)
                    stats['imported'] += 1
                    
                    if stats['imported'] % 100 == 0:
                        print(f"  Imported {stats['imported']} orders...")
                        
            except Exception as e:
                print(f"  [ERROR] Order {order_number}: {e}")
                stats['errors'] += 1
        else:
            # Dry run - just count
            stats['imported'] += 1
            stats['items_created'] += len(order_positions)
    
    # ========================================================================
    # Step 4: Report Results
    # ========================================================================
    print("\n" + "="*80)
    if dry_run:
        print("DRY-RUN RESULTS (No data was actually imported)")
    else:
        print("IMPORT RESULTS")
    print("="*80)
    print(f"Total orders processed:     {stats['total']}")
    print(f"Orders to import:           {stats['imported']}")
    print(f"Items to create:            {stats['items_created']}")
    print()
    print(f"Customers already in DB:    {stats['customers_found']}")
    print(f"New customers to create:    {stats['customers_created']}")
    print()
    print(f"Skipped (already exists):   {stats['skipped_exists']}")
    print(f"Skipped (no customer):      {stats['skipped_no_customer']}")
    print(f"Skipped (no items):         {stats['skipped_no_items']}")
    print(f"Errors:                     {stats['errors']}")
    
    if dry_run and newly_created_cache:
        # Zeige Duplikat-Analyse
        print("\n" + "-"*80)
        print("DUPLICATE ANALYSIS:")
        print("-"*80)
        
        duplicates = {k: v for k, v in newly_created_cache.items() 
                     if isinstance(v, dict) and v.get('reused_count', 0) > 0}
        
        if duplicates:
            print(f"Found {len(duplicates)} customers that would be created and reused multiple times:")
            print()
            for cache_key, cust in sorted(duplicates.items(), 
                                         key=lambda x: -x[1].get('reused_count', 0))[:20]:
                reuse_count = cust.get('reused_count', 0)
                total_orders = reuse_count + 1  # +1 für die erste Erstellung
                print(f"  {total_orders:3d} orders | {cust['firma'][:50]:<50} | {cust['plz']} {cust['ort']}")
        else:
            print("✓ No duplicate customer creations detected!")
    
    if unmatched_customers:
        print("\n" + "-"*80)
        print("TOP 20 UNMATCHED CUSTOMERS:")
        print("-"*80)
        sorted_unmatched = sorted(unmatched_customers.values(), key=lambda x: -x['count'])
        for i, info in enumerate(sorted_unmatched[:20]):
            print(f"  {info['count']:4d}x | ID:{info['id']:>5} | {info['firma'][:50]:<50} | {info['plz']} {info['ort']}")
    
    if dry_run:
        print("\n" + "="*80)
        print("To perform the actual import, run with --live flag")
        print("="*80)
    
    return stats


# ============================================================================
# CLI
# ============================================================================

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Import legacy orders from Access database')
    parser.add_argument('--live', action='store_true', help='Actually import (default is dry-run)')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of orders to import')
    
    args = parser.parse_args()
    
    if args.live:
        print("\n" + "!"*80)
        print("WARNING: LIVE IMPORT MODE")
        print("This will create actual orders in the database!")
        confirm = input("Type 'yes' to continue: ")
        if confirm.lower() != 'yes':
            print("Aborted.")
            sys.exit(1)
    
    import_legacy_orders(dry_run=not args.live, limit=args.limit)
