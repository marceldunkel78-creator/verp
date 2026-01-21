from django.core.management.base import BaseCommand, CommandError
import csv
from suppliers.models import Supplier, SupplierContact
from django.db import transaction
from django.conf import settings

class Command(BaseCommand):
    help = 'Import suppliers and supplier contacts from CSV files. Use --dry-run to simulate.'

    def add_arguments(self, parser):
        parser.add_argument('--suppliers', type=str, help='Path to suppliers CSV file')
        parser.add_argument('--contacts', type=str, help='Path to supplier contacts CSV file')
        parser.add_argument('--dry-run', action='store_true', help='Do not save changes')

    def handle(self, *args, **options):
        suppliers_path = options.get('suppliers')
        contacts_path = options.get('contacts')
        dry_run = options.get('dry_run')

        if not suppliers_path and not contacts_path:
            raise CommandError('Please provide --suppliers and/or --contacts CSV path')

        created_suppliers = 0
        updated_suppliers = 0
        created_contacts = 0
        updated_contacts = 0

        try:
            if suppliers_path:
                with open(suppliers_path, newline='', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    rows = list(reader)

                self.stdout.write(f"Processing {len(rows)} supplier rows (dry-run={dry_run})...")

                for row in rows:
                    sup_num = (row.get('supplier_number') or '').strip()
                    company_name = (row.get('company_name') or '').strip()
                    if not company_name:
                        self.stdout.write(self.style.WARNING('Skipping row without company_name'))
                        continue

                    supplier = None
                    if sup_num:
                        supplier = Supplier.objects.filter(supplier_number=sup_num).first()
                    if not supplier:
                        supplier = Supplier.objects.filter(company_name=company_name).first()

                    if supplier:
                        # Update
                        supplier.street = row.get('street', '')
                        supplier.house_number = row.get('house_number', '')
                        supplier.address_supplement = row.get('address_supplement', '')
                        supplier.postal_code = row.get('postal_code', '')
                        supplier.city = row.get('city', '')
                        supplier.state = row.get('state', '')
                        supplier.country = row.get('country', '')
                        supplier.email = row.get('email', '')
                        supplier.phone = row.get('phone', '')
                        supplier.website = row.get('website', '')
                        supplier.customer_number = row.get('customer_number', '')
                        supplier.notes = row.get('notes', '')
                        is_active = row.get('is_active')
                        if is_active is not None and is_active != '':
                            supplier.is_active = str(is_active).strip().lower() in ['true', '1', 'yes', 'y']
                        if not dry_run:
                            supplier.save()
                        updated_suppliers += 1
                        self.stdout.write(self.style.SUCCESS(f"Updated supplier: {supplier.company_name}"))
                    else:
                        # Create
                        supplier = Supplier(
                            company_name=company_name,
                            street=row.get('street', ''),
                            house_number=row.get('house_number', ''),
                            address_supplement=row.get('address_supplement', ''),
                            postal_code=row.get('postal_code', ''),
                            city=row.get('city', ''),
                            state=row.get('state', ''),
                            country=row.get('country', 'DE'),
                            email=row.get('email', ''),
                            phone=row.get('phone', ''),
                            website=row.get('website', ''),
                            customer_number=row.get('customer_number', ''),
                            notes=row.get('notes', ''),
                            is_active=str(row.get('is_active', 'True')).strip().lower() in ['true', '1', 'yes', 'y']
                        )
                        if not dry_run:
                            supplier.save()
                        created_suppliers += 1
                        self.stdout.write(self.style.SUCCESS(f"Created supplier: {supplier.company_name}"))

            if contacts_path:
                with open(contacts_path, newline='', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    rows = list(reader)

                self.stdout.write(f"Processing {len(rows)} contact rows (dry-run={dry_run})...")
                for row in rows:
                    sup_num = (row.get('supplier_number') or '').strip()
                    contact_type = (row.get('contact_type') or '').strip()
                    contact_person = (row.get('contact_person') or '').strip()
                    if not sup_num:
                        self.stdout.write(self.style.WARNING('Skipping contact row without supplier_number'))
                        continue
                    supplier = Supplier.objects.filter(supplier_number=sup_num).first()
                    if not supplier:
                        self.stdout.write(self.style.WARNING(f"Supplier with supplier_number {sup_num} not found, skipping contact"))
                        continue

                    # Try to find existing contact
                    contact = SupplierContact.objects.filter(supplier=supplier, contact_person=contact_person, contact_type=contact_type).first()
                    if contact:
                        contact.is_primary = str(row.get('is_primary', contact.is_primary)).strip().lower() in ['true', '1', 'yes', 'y']
                        contact.contact_function = row.get('contact_function', contact.contact_function)
                        contact.street = row.get('street', contact.street)
                        contact.house_number = row.get('house_number', contact.house_number)
                        contact.address_supplement = row.get('address_supplement', contact.address_supplement)
                        contact.postal_code = row.get('postal_code', contact.postal_code)
                        contact.city = row.get('city', contact.city)
                        contact.state = row.get('state', contact.state)
                        contact.country = row.get('country', contact.country)
                        contact.email = row.get('email', contact.email)
                        contact.phone = row.get('phone', contact.phone)
                        contact.mobile = row.get('mobile', contact.mobile)
                        contact.notes = row.get('notes', contact.notes)
                        contact.is_active = str(row.get('is_active', contact.is_active)).strip().lower() in ['true', '1', 'yes', 'y']
                        if not dry_run:
                            contact.save()
                        updated_contacts += 1
                        self.stdout.write(self.style.SUCCESS(f"Updated contact: {contact}"))
                    else:
                        contact = SupplierContact(
                            supplier=supplier,
                            contact_type=contact_type or 'main',
                            is_primary=str(row.get('is_primary', 'False')).strip().lower() in ['true', '1', 'yes', 'y'],
                            contact_person=contact_person,
                            contact_function=row.get('contact_function', ''),
                            street=row.get('street', ''),
                            house_number=row.get('house_number', ''),
                            address_supplement=row.get('address_supplement', ''),
                            postal_code=row.get('postal_code', ''),
                            city=row.get('city', ''),
                            state=row.get('state', ''),
                            country=row.get('country', 'DE'),
                            email=row.get('email', ''),
                            phone=row.get('phone', ''),
                            mobile=row.get('mobile', ''),
                            notes=row.get('notes', ''),
                            is_active=str(row.get('is_active', 'True')).strip().lower() in ['true', '1', 'yes', 'y']
                        )
                        if not dry_run:
                            contact.save()
                        created_contacts += 1
                        self.stdout.write(self.style.SUCCESS(f"Created contact: {contact}"))

        except Exception as e:
            raise CommandError(str(e))

        self.stdout.write(self.style.SUCCESS('Import complete'))
        self.stdout.write(self.style.SUCCESS(f"Suppliers created: {created_suppliers}, updated: {updated_suppliers}"))
        self.stdout.write(self.style.SUCCESS(f"Contacts created: {created_contacts}, updated: {updated_contacts}"))
