import json

# Lade Backup
with open(r'C:\Users\mdunk\Downloads\verp_backup_20260105.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Finde Supplier-bezogene Keys
supplier_keys = [k for k in data['data'].keys() if 'supplier' in k.lower()]
print('Supplier keys found:')
for k in supplier_keys:
    print(f'  {k}: {len(data["data"][k])} records')

# Zeige erste Supplier-Datensatz wenn vorhanden
if 'suppliers.Supplier' in data['data'] and len(data['data']['suppliers.Supplier']) > 0:
    print('\nFirst Supplier record structure:')
    first_record = data['data']['suppliers.Supplier'][0]
    print(f'  Model: {first_record["model"]}')
    print(f'  PK: {first_record["pk"]}')
    print(f'  Fields: {list(first_record["fields"].keys())}')
    
    # Prüfe ob "name" existiert
    if 'name' in first_record['fields']:
        print(f'\n  ✓ Found "name" field with value: {first_record["fields"]["name"]}')
    elif 'company_name' in first_record['fields']:
        print(f'\n  ✓ Found "company_name" field with value: {first_record["fields"]["company_name"]}')
    else:
        print('\n  ⚠ Neither "name" nor "company_name" found!')
