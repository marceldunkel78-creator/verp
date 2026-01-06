import csv

# Suche nach @PAR-100
with open(r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\aufragsrekonstruktion_complete\Produkte.csv', 'r', encoding='latin1') as f:
    reader = csv.DictReader(f, delimiter=';')
    for row in reader:
        if '@PAR-100' in row.get('Kennung', ''):
            print(f"ProduktID: {row.get('ProduktID')}")
            print(f"Kennung: {row.get('Kennung')}")
            print(f"Artikel: {row.get('Artikel')}")
            print()

# Jetzt suche nach SerienNr 259564
print('='*80)
print('Suche nach SerienNr 259564:')
with open(r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\aufragsrekonstruktion_complete\AuftragsPositionen.csv', 'r', encoding='latin1') as f:
    reader = csv.DictReader(f, delimiter=';')
    for row in reader:
        if '259564' in row.get('SerienNr', ''):
            print(f"AngebotID: {row.get('AngebotID')}, Pos: {row.get('PositionsNr')}, ProduktID: {row.get('ProduktID')}, SerienNr: {row.get('SerienNr')}")
