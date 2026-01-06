#!/usr/bin/env python
"""Check order details to debug position mismatch"""

import os
import sys
import csv
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from customer_orders.models import CustomerOrder

# Lade CSV für Vergleich
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'Datenvorlagen', 'aufragsrekonstruktion_complete')

def load_csv(filename):
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'r', encoding='latin1') as f:
        reader = csv.DictReader(f, delimiter=';')
        return list(reader)

auftraege = load_csv('Aufträge.csv')
positionen = load_csv('AuftragsPositionen.csv')
order_numbers = load_csv('Auftragsnummern-ID.csv')

# Hole ersten importierten Auftrag
order = CustomerOrder.objects.filter(order_number__startswith='O-').first()

if order:
    print(f"\n{'='*80}")
    print(f"ORDER IN DATABASE: {order.order_number}")
    print(f"{'='*80}")
    print(f"Customer: {order.customer.customer_number}")
    print(f"Created: {order.created_at}")
    print(f"Notes: {order.notes[:100] if order.notes else 'None'}")
    print(f"\nITEMS ({order.items.count()}):")
    for item in order.items.all():
        print(f"  Pos {item.position}: {item.name}")
        print(f"    Article: {item.article_number}")
        print(f"    Qty: {item.quantity} x {item.final_price} {item.currency}")
        print(f"    Serial: {item.serial_number or '(none)'}")
        print(f"    Description: {item.description[:80] if item.description else '(none)'}...")
    
    # Finde den entsprechenden Auftrag in CSV
    print(f"\n{'='*80}")
    print(f"CORRESPONDING CSV DATA")
    print(f"{'='*80}")
    
    # Finde AuftragsID für diese Order Number
    auftrags_id = None
    for row in order_numbers:
        if row.get('Auftrags Nr.', '').strip() == order.order_number:
            auftrags_id = row.get('AuftragsID', '')
            break
    
    if auftrags_id:
        print(f"AuftragsID: {auftrags_id}")
        
        # Finde Auftrag in Aufträge.csv
        auftrag_row = None
        for row in auftraege:
            if row.get('AuftragsID', '') == auftrags_id:
                auftrag_row = row
                break
        
        if auftrag_row:
            print(f"Version (AngebotID): {auftrag_row.get('Version', '')}")
            print(f"Auftragsname: {auftrag_row.get('Auftragsname', '')}")
            
            # Finde Positionen in AuftragsPositionen.csv
            version = auftrag_row.get('Version', '')
            print(f"\nPOSITIONS in AuftragsPositionen.csv (AngebotID={version}):")
            for pos in positionen:
                if pos.get('AngebotID', '') == version:
                    print(f"  Pos {pos.get('PositionsNr', '')}: ProduktID={pos.get('ProduktID', '')}, Qty={pos.get('Stückzahl', '')}, Price={pos.get('Stückpreis', '')}")
                    print(f"    Serial: {pos.get('SerienNr', '')}")
        else:
            print("ERROR: Auftrag nicht in Aufträge.csv gefunden!")
    else:
        print("ERROR: Order number nicht in Auftragsnummern-ID.csv gefunden!")
