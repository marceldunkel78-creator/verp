import csv

# Lade Aufträge
with open(r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\aufragsrekonstruktion_complete\Aufträge.csv', 'r', encoding='latin1') as f:
    reader = csv.DictReader(f, delimiter=';')
    auftraege = list(reader)

# Finde Auftrag 103
for row in auftraege:
    if row.get('AngebotNummer') == '103':
        print('Auftrag O-103-05/95:')
        print(f'  AuftragsID: {row.get("AuftragsID")}')
        print(f'  Version (AngebotID): {row.get("Version")}')
        break

# Jetzt schaue in Angebote.csv für AngebotID
with open(r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\aufragsrekonstruktion_complete\Angebote.csv', 'r', encoding='latin1') as f:
    reader = csv.DictReader(f, delimiter=';')
    angebote_pos = list(reader)

print('\nPositionen in Angebote.csv (AngebotID=8):')
for pos in angebote_pos[:20]:
    if pos.get('AngebotID') == '8':
        print(f'  Pos {pos.get("PositionsNr")}: ProduktID={pos.get("ProduktID")}, Kennung={pos.get("Kennung")}, SerienNr={pos.get("SerienNr")}')

# Jetzt schaue in AuftragsPositionen.csv
with open(r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\aufragsrekonstruktion_complete\AuftragsPositionen.csv', 'r', encoding='latin1') as f:
    reader = csv.DictReader(f, delimiter=';')
    auftrags_pos = list(reader)

print('\nPositionen in AuftragsPositionen.csv (AngebotID=8):')
for pos in auftrags_pos[:50]:
    if pos.get('AngebotID') == '8':
        print(f'  Pos {pos.get("PositionsNr")}: ProduktID={pos.get("ProduktID")}, SerienNr={pos.get("SerienNr")}')
