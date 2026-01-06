import csv

# Lade alle CSV-Dateien
with open(r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\aufragsrekonstruktion_complete\Aufträge.csv', 'r', encoding='latin1') as f:
    auftraege = {r.get('AuftragsID'): r for r in csv.DictReader(f, delimiter=';')}

with open(r'C:\Users\mdunk\Documents\VERP\Datenvorlagen\aufragsrekonstruktion_complete\AuftragsPositionen.csv', 'r', encoding='latin1') as f:
    auftrags_pos = list(csv.DictReader(f, delimiter=';'))

# Auftrag 103 hat AuftragsID=6
auftrag = auftraege['6']
print(f"Auftrag O-103:")
print(f"  AuftragsID: 6")
print(f"  AngebotNummer: {auftrag.get('AngebotNummer')}")
print(f"  Version: {auftrag.get('Version')}")
print()

# Suche Positionen nach AngebotID
print("Positionen mit AngebotID=6 (wie AuftragsID):")
for pos in auftrags_pos:
    if pos.get('AngebotID') == '6':
        print(f"  Pos {pos.get('PositionsNr')}: ProduktID={pos.get('ProduktID')}, SerienNr={pos.get('SerienNr')}")

print()
print("Positionen mit AngebotID=8 (wie Version field):")
for pos in auftrags_pos:
    if pos.get('AngebotID') == '8':
        print(f"  Pos {pos.get('PositionsNr')}: ProduktID={pos.get('ProduktID')}, SerienNr={pos.get('SerienNr')}")
