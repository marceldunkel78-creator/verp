import csv

# Lade AuftragsPositionen
with open(r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\aufragsrekonstruktion_complete\AuftragsPositionen.csv', 'r', encoding='latin1') as f:
    reader = csv.DictReader(f, delimiter=';')
    auftrags_pos = list(reader)

print('Positionen in AuftragsPositionen.csv für AngebotID=8:')
for pos in auftrags_pos:
    if pos.get('AngebotID') == '8':
        print(f"Pos {pos.get('PositionsNr')}:")
        print(f"  ProduktID: {pos.get('ProduktID')}")
        print(f"  SerienNr: {pos.get('SerienNr')}")
        print(f"  Stückzahl: {pos.get('Stückzahl')}")
        print(f"  Stückpreis: {pos.get('Stückpreis')}")
        print(f"  Einkaufspreis: {pos.get('Einkaufspreis')}")
        print()

# Lade Produkte für Mapping
with open(r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\aufragsrekonstruktion_complete\Produkte.csv', 'r', encoding='latin1') as f:
    reader = csv.DictReader(f, delimiter=';')
    produkte = {p.get('ProduktID'): p for p in reader}

print('\nProdukte-Details:')
for pos in auftrags_pos:
    if pos.get('AngebotID') == '8':
        prod_id = pos.get('ProduktID')
        if prod_id in produkte:
            prod = produkte[prod_id]
            print(f"ProduktID {prod_id}:")
            print(f"  Kennung: {prod.get('Kennung')}")
            print(f"  Artikel: {prod.get('Artikel')}")
            print()
