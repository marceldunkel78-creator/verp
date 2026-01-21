"""
Exportiere Supplier- und SupplierContact-Daten als CSV und erstelle Templates.
Ausführen: python tools/export_suppliers_csv.py
"""
import os
import sys
import django
import csv
from pathlib import Path

# Ensure backend folder is on sys.path so Django settings (verp.settings) can be imported
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from suppliers.models import Supplier, SupplierContact
from verp_settings.models import PaymentTerm, DeliveryTerm, DeliveryInstruction

OUT_DIR = Path(__file__).resolve().parent.parent.parent / 'Datenvorlagen' / 'exports'
TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / 'Datenvorlagen' / 'templates'
OUT_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)

# Supplier fields for export
supplier_fields = [
    'supplier_number', 'company_name',
    'street', 'house_number', 'address_supplement', 'postal_code', 'city', 'state', 'country',
    'email', 'phone', 'website',
    'customer_number', 'payment_term', 'delivery_term', 'delivery_instruction',
    'notes', 'is_active'
]

# Contacts fields for export
contact_fields = [
    'supplier_number', 'contact_type', 'is_primary',
    'contact_person', 'contact_function',
    'street', 'house_number', 'address_supplement', 'postal_code', 'city', 'state', 'country',
    'email', 'phone', 'mobile', 'notes', 'is_active'
]

# Write suppliers CSV
with open(OUT_DIR / 'suppliers_export.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=supplier_fields)
    writer.writeheader()
    for s in Supplier.objects.all().order_by('company_name'):
        writer.writerow({
            'supplier_number': s.supplier_number or '',
            'company_name': s.company_name,
            'street': s.street,
            'house_number': s.house_number,
            'address_supplement': s.address_supplement,
            'postal_code': s.postal_code,
            'city': s.city,
            'state': s.state,
            'country': s.country,
            'email': s.email,
            'phone': s.phone,
            'website': s.website,
            'customer_number': s.customer_number,
            'payment_term': s.payment_term.name if s.payment_term else '',
            'delivery_term': s.delivery_term.incoterm if s.delivery_term else '',
            'delivery_instruction': s.delivery_instruction.name if s.delivery_instruction else '',
            'notes': s.notes,
            'is_active': s.is_active,
        })

# Write contacts CSV
with open(OUT_DIR / 'supplier_contacts_export.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=contact_fields)
    writer.writeheader()
    for c in SupplierContact.objects.select_related('supplier').all().order_by('supplier__company_name'):
        writer.writerow({
            'supplier_number': c.supplier.supplier_number or '',
            'contact_type': c.contact_type,
            'is_primary': c.is_primary,
            'contact_person': c.contact_person,
            'contact_function': c.contact_function,
            'street': c.street,
            'house_number': c.house_number,
            'address_supplement': c.address_supplement,
            'postal_code': c.postal_code,
            'city': c.city,
            'state': c.state,
            'country': c.country,
            'email': c.email,
            'phone': c.phone,
            'mobile': c.mobile,
            'notes': c.notes,
            'is_active': c.is_active,
        })

# Create templates (header only) if not exists
for path, fields in [
    (TEMPLATE_DIR / 'suppliers_template.csv', supplier_fields),
    (TEMPLATE_DIR / 'supplier_contacts_template.csv', contact_fields),
]:
    if not path.exists():
        with open(path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()

# Contact types file
contact_types_path = TEMPLATE_DIR / 'supplier_contact_types.txt'
with open(contact_types_path, 'w', encoding='utf-8') as f:
    for key, label in SupplierContact.CONTACT_TYPE_CHOICES:
        f.write(f"{key} - {label}\n")

print('Export abgeschlossen:')
print(' - Suppliers: ', OUT_DIR / 'suppliers_export.csv')
print(' - Contacts: ', OUT_DIR / 'supplier_contacts_export.csv')
print('Templates: ', TEMPLATE_DIR)
print('Contact types: ', contact_types_path)
