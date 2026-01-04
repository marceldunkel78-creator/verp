"""
Import Systems from CSV file

Usage:
    python manage.py import_systems --dry-run  # Test run without saving
    python manage.py import_systems            # Live import
"""
import csv
from datetime import datetime
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from systems.models import System
from customers.models import Customer
from visiview.models import VisiViewLicense


class Command(BaseCommand):
    help = 'Import systems from Systems.csv file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Perform a dry run without saving to database',
        )
        parser.add_argument(
            '--file',
            type=str,
            default='Datenvorlagen/Systems.csv',
            help='Path to CSV file (relative to project root)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        csv_file = options['file']
        
        mode = "DRY RUN" if dry_run else "LIVE IMPORT"
        self.stdout.write(self.style.WARNING(f"\n{'='*60}"))
        self.stdout.write(self.style.WARNING(f"  {mode}"))
        self.stdout.write(self.style.WARNING(f"{'='*60}\n"))
        
        stats = {
            'total': 0,
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0,
            'customer_found': 0,
            'customer_not_found': 0,
            'license_found': 0,
            'license_not_found': 0,
        }
        
        # Track processed dongles to detect duplicates within this import run
        processed_dongles = {}  # dongle_number -> (system_id or 'NEW', row_number)
        
        try:
            # Try different encodings commonly used for German text
            encodings = ['utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']
            file_handle = None
            used_encoding = None
            
            for encoding in encodings:
                try:
                    file_handle = open(csv_file, 'r', encoding=encoding)
                    # Try to read first line to validate encoding
                    file_handle.readline()
                    file_handle.seek(0)  # Reset to beginning
                    used_encoding = encoding
                    break
                except UnicodeDecodeError:
                    if file_handle:
                        file_handle.close()
                    continue
            
            if file_handle is None:
                self.stdout.write(self.style.ERROR('Error: Could not decode file with any known encoding'))
                return
            
            self.stdout.write(f'Using encoding: {used_encoding}\n')
            
            # Read CSV with semicolon delimiter
            reader = csv.DictReader(file_handle, delimiter=';')
            
            # Get field names
            fieldnames = reader.fieldnames
            self.stdout.write(f"CSV Columns: {fieldnames}\n")
            
            if dry_run:
                # In dry-run mode, process all rows without saving
                for row in reader:
                    stats['total'] += 1
                    self._process_row(row, stats, dry_run=True, processed_dongles=processed_dongles)
            else:
                # In live mode, use transaction for safety
                with transaction.atomic():
                    for row in reader:
                        stats['total'] += 1
                        self._process_row(row, stats, dry_run=False, processed_dongles=processed_dongles)
            
            file_handle.close()
        
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f"\nFile not found: {csv_file}"))
            self.stdout.write(self.style.ERROR("Please run from project root or specify --file path"))
            return
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\nError reading file: {str(e)}"))
            return
        
        # Print summary
        self.stdout.write(self.style.WARNING(f"\n{'='*60}"))
        self.stdout.write(self.style.WARNING(f"  IMPORT SUMMARY ({mode})"))
        self.stdout.write(self.style.WARNING(f"{'='*60}"))
        self.stdout.write(f"\nTotal rows processed: {stats['total']}")
        self.stdout.write(self.style.SUCCESS(f"Systems created: {stats['created']}"))
        self.stdout.write(self.style.SUCCESS(f"Systems updated: {stats['updated']}"))
        self.stdout.write(self.style.WARNING(f"Skipped (empty dongle): {stats['skipped']}"))
        self.stdout.write(self.style.ERROR(f"Errors: {stats['errors']}"))
        self.stdout.write(f"\nCustomer found in DB: {stats['customer_found']}")
        self.stdout.write(f"Customer not found (added to notes): {stats['customer_not_found']}")
        self.stdout.write(f"VisiView license found: {stats['license_found']}")
        self.stdout.write(f"VisiView license not found: {stats['license_not_found']}")
        
        if dry_run:
            self.stdout.write(self.style.WARNING("\n⚠ DRY RUN - No changes were saved to database"))
            self.stdout.write(self.style.SUCCESS("\nTo perform live import, run without --dry-run flag"))
        else:
            self.stdout.write(self.style.SUCCESS("\n✓ Import completed successfully!"))
    
    def _process_row(self, row, stats, dry_run=True, processed_dongles=None):
        """Process a single CSV row"""
        if processed_dongles is None:
            processed_dongles = {}
        
        try:
            # Extract data from CSV (columns with German names)
            dongle_number = row.get('Dongle nummer/ VisiView Lizenz nummer', '').strip()
            customer_name = row.get('CustomerName', '').strip()
            customer_address = row.get('CustomerAddress', '').strip()
            description = row.get('Beschriebung', '').strip()
            installation_date_str = row.get('Installation Date', '').strip()
            order_number = row.get('Kundenaufrag', '').strip()
            
            # Skip rows without dongle number
            if not dongle_number:
                stats['skipped'] += 1
                return
            
            # Parse installation date
            installation_date = None
            if installation_date_str:
                installation_date = self._parse_date(installation_date_str)
            
            # Try to find customer in database
            customer = None
            customer_note = ""
            
            if customer_name or customer_address:
                customer = self._find_customer(customer_name, customer_address)
                
                if customer:
                    stats['customer_found'] += 1
                    if dry_run:
                        self.stdout.write(f"  ✓ Customer found: {customer.customer_number} - {customer.first_name} {customer.last_name}")
                else:
                    stats['customer_not_found'] += 1
                    # Build note with customer info
                    customer_note = f"Kunde: {customer_name}"
                    if customer_address:
                        customer_note += f"\nAdresse: {customer_address}"
                    
                    if dry_run:
                        self.stdout.write(f"  ⚠ Customer not found, will add to notes: {customer_name} / {customer_address}")
            
            # Try to find VisiView license by dongle number
            visiview_license = None
            try:
                visiview_license = VisiViewLicense.objects.filter(
                    Q(license_number=dongle_number) | Q(serial_number=dongle_number)
                ).first()
                
                if visiview_license:
                    stats['license_found'] += 1
                    if dry_run:
                        self.stdout.write(f"  ✓ VisiView license found: {visiview_license.license_number}")
                else:
                    stats['license_not_found'] += 1
                    if dry_run:
                        self.stdout.write(f"  ⚠ VisiView license not found for dongle: {dongle_number}")
            except Exception as e:
                if dry_run:
                    self.stdout.write(f"  ⚠ Error finding license: {str(e)}")
            
            # Build notes field
            notes_parts = []
            if customer_note:
                notes_parts.append(customer_note)
            if order_number:
                notes_parts.append(f"Auftragsnummer: {order_number}")
            
            notes = "\n".join(notes_parts)
            
            # Generate system name from customer and description
            system_name = self._generate_system_name(customer_name, description, dongle_number)
            
            # Check if this dongle was already processed in this import run
            is_duplicate_in_run = dongle_number in processed_dongles
            
            # Check if system already exists in database (by visiview_license or system_name)
            existing_system = None
            if visiview_license:
                existing_system = System.objects.filter(visiview_license=visiview_license).first()
            
            if not existing_system and system_name:
                # Try to find by similar name
                existing_system = System.objects.filter(system_name__icontains=dongle_number).first()
            
            if dry_run:
                # Dry run - just report what would happen
                if is_duplicate_in_run:
                    # This dongle was already processed in this run
                    prev_row = processed_dongles[dongle_number]
                    self.stdout.write(self.style.WARNING(f"\n[{stats['total']}] DUPLICATE in CSV - Would UPDATE system from row {prev_row['row']} (dongle: {dongle_number})"))
                    stats['updated'] += 1
                elif existing_system:
                    # System exists in database
                    self.stdout.write(self.style.WARNING(f"\n[{stats['total']}] Would UPDATE existing system: {existing_system.system_number}"))
                    stats['updated'] += 1
                    # Track this dongle as processed
                    processed_dongles[dongle_number] = {'row': stats['total'], 'system_id': existing_system.system_number}
                else:
                    # New system
                    self.stdout.write(self.style.SUCCESS(f"\n[{stats['total']}] Would CREATE new system for dongle: {dongle_number}"))
                    stats['created'] += 1
                    # Track this dongle as processed
                    processed_dongles[dongle_number] = {'row': stats['total'], 'system_id': 'NEW'}
                
                self.stdout.write(f"  Dongle: {dongle_number}")
                self.stdout.write(f"  System Name: {system_name}")
                self.stdout.write(f"  Customer: {customer.customer_number if customer else 'Not linked'}")
                self.stdout.write(f"  License: {visiview_license.license_number if visiview_license else 'Not linked'}")
                self.stdout.write(f"  Description: {description[:50]}...")
                self.stdout.write(f"  Installation: {installation_date}")
                if notes:
                    self.stdout.write(f"  Notes: {notes[:100]}...")
            else:
                # Live mode - actually save
                if is_duplicate_in_run or existing_system:
                    # Update existing system (either from database or created earlier in this run)
                    if not existing_system and is_duplicate_in_run:
                        # Find the system created earlier in this run
                        if visiview_license:
                            existing_system = System.objects.filter(visiview_license=visiview_license).first()
                        if not existing_system:
                            existing_system = System.objects.filter(system_name__icontains=dongle_number).first()
                    
                    if existing_system:
                        existing_system.system_name = system_name
                        existing_system.customer = customer
                        existing_system.visiview_license = visiview_license
                        existing_system.description = description
                        if installation_date:
                            existing_system.installation_date = installation_date
                        if notes:
                            # Append to existing notes
                            if existing_system.notes:
                                existing_system.notes += f"\n\n--- Import Update ---\n{notes}"
                            else:
                                existing_system.notes = notes
                        existing_system.save()
                        
                        self.stdout.write(self.style.SUCCESS(f"[{stats['total']}] ✓ Updated: {existing_system.system_number}"))
                        stats['updated'] += 1
                        # Track this dongle as processed
                        processed_dongles[dongle_number] = {'row': stats['total'], 'system_id': existing_system.system_number}
                else:
                    # Create new system
                    new_system = System.objects.create(
                        system_name=system_name,
                        customer=customer,
                        visiview_license=visiview_license,
                        description=description,
                        installation_date=installation_date,
                        notes=notes,
                        status='active'
                    )
                    
                    self.stdout.write(self.style.SUCCESS(f"[{stats['total']}] ✓ Created: {new_system.system_number}"))
                    stats['created'] += 1
                    # Track this dongle as processed
                    processed_dongles[dongle_number] = {'row': stats['total'], 'system_id': new_system.system_number}
        
        except Exception as e:
            stats['errors'] += 1
            self.stdout.write(self.style.ERROR(f"[{stats['total']}] ✗ Error: {str(e)}"))
            if not dry_run:
                # In live mode, re-raise to trigger transaction rollback
                raise
    
    def _find_customer(self, customer_name, customer_address):
        """Try to find customer in database by name and address"""
        if not customer_name:
            return None
        
        # Split customer name into parts
        name_parts = customer_name.split()
        
        # Try various search strategies
        queries = []
        
        # 1. Try exact match on last name
        if len(name_parts) >= 2:
            last_name = name_parts[-1]
            first_name = ' '.join(name_parts[:-1])
            queries.append(
                Q(last_name__iexact=last_name) & Q(first_name__icontains=first_name)
            )
        
        # 2. Try searching in addresses if provided
        if customer_address:
            queries.append(
                Q(addresses__city__icontains=customer_address) |
                Q(addresses__university__icontains=customer_address) |
                Q(addresses__institute__icontains=customer_address)
            )
        
        # 3. Try partial name match
        queries.append(
            Q(first_name__icontains=customer_name) | Q(last_name__icontains=customer_name)
        )
        
        # Execute queries
        for query in queries:
            customer = Customer.objects.filter(query).first()
            if customer:
                return customer
        
        return None
    
    def _parse_date(self, date_str):
        """Parse date from German format (DD.MM.YYYY)"""
        if not date_str:
            return None
        
        try:
            # Try DD.MM.YYYY format
            return datetime.strptime(date_str, '%d.%m.%Y').date()
        except ValueError:
            try:
                # Try DD.MM.YY format
                return datetime.strptime(date_str, '%d.%m.%y').date()
            except ValueError:
                return None
    
    def _generate_system_name(self, customer_name, description, dongle_number):
        """Generate a descriptive system name"""
        parts = []
        
        if customer_name:
            # Take first 30 chars of customer name
            parts.append(customer_name[:30])
        
        if description:
            # Take first 40 chars of description
            parts.append(description[:40])
        
        if not parts:
            parts.append(f"System {dongle_number}")
        
        return " - ".join(parts)
