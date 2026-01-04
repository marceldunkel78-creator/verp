#!/usr/bin/env python
"""
Import Maintenance Time Credits and Expenditures from CSV files.
Usage: python import_maintenance_data.py [--license-id XXXX]
"""
import os
import sys
import csv
import django
from datetime import datetime, time as dtime
from decimal import Decimal

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.contrib.auth import get_user_model
from visiview.models import VisiViewLicense, MaintenanceTimeCredit, MaintenanceTimeExpenditure
from visiview.serializers import process_expenditure_deduction, apply_new_credit_to_debt

User = get_user_model()

# User name mappings from CSV to database
USER_MAPPING = {
    'Gunther Köhn': 'Gunther Köhn',
    'Gunther K�hn': 'Gunther Köhn',
    'Marcel Dunkel': 'Marcel Dunkel',
    'Andreas Babaryka': 'Andreas Babaryka',
    'Alexander Steiner': 'Alexander Steiner',
    'Peter Waltinger': 'Peter Waltinger',
    'Oliver Weisgerber': 'Oliver Weisgerber',
    'Bernd Zobiak': 'Bernd Zobiak',
    'Sanjana Singh': 'Sanjana Singh',
    'Benjamin Beutin': 'Benjamin Beutin',
    'Goran Hallum': 'Goran Hallum',
    'Redmine Admin': 'Redmine Admin',
}

ACTIVITY_MAPPING = {
    'Remote Support': 'remote_support',
    'Telefon Support': 'phone_support',
    'EMail Support': 'email_support',
}

TASK_TYPE_MAPPING = {
    'Bugs': 'bug_fix',
    'Sonstiges': 'other',
    'Schulung': 'training',
    'Test': 'testing',
}


def parse_german_date(date_str):
    """Parse German date format DD.MM.YYYY"""
    return datetime.strptime(date_str, '%d.%m.%Y').date()


def parse_german_decimal(decimal_str):
    """Parse German decimal format (comma as separator)"""
    return Decimal(decimal_str.replace(',', '.'))


def get_or_create_user(user_name):
    """Get or create user by name"""
    mapped_name = USER_MAPPING.get(user_name, user_name)
    
    # Try to find by first and last name
    parts = mapped_name.split()
    if len(parts) >= 2:
        first_name = parts[0]
        last_name = ' '.join(parts[1:])
        user = User.objects.filter(first_name=first_name, last_name=last_name).first()
        if user:
            return user
    
    # If not found, create a generic username
    username = mapped_name.lower().replace(' ', '.').replace('ö', 'oe').replace('ü', 'ue')
    
    # Check if user already exists by username
    user = User.objects.filter(username=username).first()
    if user:
        return user
    
    # Create new user with unique email
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            'first_name': parts[0] if parts else mapped_name,
            'last_name': ' '.join(parts[1:]) if len(parts) > 1 else '',
            'email': f'{username}@visitron.local',  # Unique email
            'is_active': True,
        }
    )
    if created:
        print(f"  Created user: {user.username} ({mapped_name})")
    return user


def import_time_credits(csv_path, serial_number=None):
    """Import time credits from Zeitgutschriften.csv"""
    print(f"\n=== Importing Time Credits from {csv_path} ===")
    
    created_count = 0
    skipped_count = 0
    error_count = 0
    
    with open(csv_path, 'r', encoding='cp1252') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            try:
                visiview_serial = str(row['VisiView ID']).strip()
                
                # Filter by serial number if specified
                if serial_number and visiview_serial != serial_number:
                    continue
                
                # Get license by serial_number
                try:
                    license_obj = VisiViewLicense.objects.get(serial_number=visiview_serial)
                except VisiViewLicense.DoesNotExist:
                    print(f"  Warning: License with serial {visiview_serial} not found, skipping...")
                    skipped_count += 1
                    continue
                
                # Parse data
                start_date = parse_german_date(row['Beginn Datum'])
                end_date = parse_german_date(row['Ende Datum'])
                user = get_or_create_user(row['User'])
                credit_hours = parse_german_decimal(row['Zeitgutschrift (h)'])
                
                # Check if this credit already exists (same license, dates, user, amount)
                existing = MaintenanceTimeCredit.objects.filter(
                    license=license_obj,
                    start_date=start_date,
                    end_date=end_date,
                    user=user,
                    credit_hours=credit_hours
                ).first()
                
                if existing:
                    print(f"  Skipped duplicate credit: License {visiview_serial}, {credit_hours}h ({start_date} - {end_date})")
                    skipped_count += 1
                    continue
                
                # Create time credit
                credit = MaintenanceTimeCredit.objects.create(
                    license=license_obj,
                    start_date=start_date,
                    end_date=end_date,
                    user=user,
                    credit_hours=credit_hours,
                    remaining_hours=credit_hours  # Will be adjusted after expenditures
                )
                
                print(f"  Created credit: License {visiview_serial}, {credit_hours}h ({start_date} - {end_date}) by {user}")
                created_count += 1
                
            except Exception as e:
                print(f"  Error processing row: {row}, Error: {e}")
                error_count += 1
    
    print(f"\nTime Credits: {created_count} created, {skipped_count} skipped, {error_count} errors")
    return created_count


def import_time_expenditures(csv_path, serial_number=None):
    """Import time expenditures from timelog.csv"""
    print(f"\n=== Importing Time Expenditures from {csv_path} ===")
    
    created_count = 0
    skipped_count = 0
    error_count = 0
    
    with open(csv_path, 'r', encoding='cp1252') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            try:
                visiview_serial = str(row['VisiView ID']).strip()
                
                # Filter by serial number if specified
                if serial_number and visiview_serial != serial_number:
                    continue
                
                # Get license by serial_number
                try:
                    license_obj = VisiViewLicense.objects.get(serial_number=visiview_serial)
                except VisiViewLicense.DoesNotExist:
                    print(f"  Warning: License with serial {visiview_serial} not found, skipping...")
                    skipped_count += 1
                    continue
                
                # Parse data
                date = parse_german_date(row['Datum'])
                user = get_or_create_user(row['User'])
                activity = ACTIVITY_MAPPING.get(row['Aktivität'], 'other')
                task_type = TASK_TYPE_MAPPING.get(row['Tätigkeit'], 'other')
                hours_spent = parse_german_decimal(row['aufgewendete Zeit (h)'])
                is_goodwill = row['Kulanz'].strip().lower() in ['ja', 'yes', 'true', '1']
                comment = row.get('Kommentar', '').strip()
                
                # Check if this expenditure already exists
                existing = MaintenanceTimeExpenditure.objects.filter(
                    license=license_obj,
                    date=date,
                    time='09:00:00',  # Default time as we don't have it in CSV
                    user=user,
                    hours_spent=hours_spent,
                    is_goodwill=is_goodwill
                ).first()
                
                if existing:
                    print(f"  Skipped duplicate expenditure: License {visiview_serial}, {hours_spent}h on {date}")
                    skipped_count += 1
                    continue
                
                # Create time expenditure (without automatic deduction first)
                expenditure = MaintenanceTimeExpenditure.objects.create(
                    license=license_obj,
                    date=date,
                    time=dtime(9, 0),  # Default time
                    user=user,
                    activity=activity,
                    task_type=task_type,
                    hours_spent=hours_spent,
                    is_goodwill=is_goodwill,
                    comment=comment,
                    created_debt=Decimal('0.00')  # Will be calculated
                )
                
                print(f"  Created expenditure: License {visiview_serial}, {hours_spent}h on {date} by {user} (goodwill: {is_goodwill})")
                created_count += 1
                
            except Exception as e:
                print(f"  Error processing row: {row}, Error: {e}")
                error_count += 1
    
    print(f"\nTime Expenditures: {created_count} created, {skipped_count} skipped, {error_count} errors")
    return created_count


def recalculate_balances(serial_number=None):
    """Recalculate all balances for licenses by processing expenditures"""
    print(f"\n=== Recalculating Balances ===")
    
    if serial_number:
        licenses = VisiViewLicense.objects.filter(serial_number=serial_number)
    else:
        # Only licenses with maintenance data
        licenses = VisiViewLicense.objects.filter(
            time_credits__isnull=False
        ).distinct() | VisiViewLicense.objects.filter(
            time_expenditures__isnull=False
        ).distinct()
    
    for license_obj in licenses:
        print(f"\nProcessing License {license_obj.id} ({license_obj.license_number}):")
        
        # Reset all credits to their original amounts
        for credit in license_obj.time_credits.all():
            credit.remaining_hours = credit.credit_hours
            credit.save()
        
        # Reset all expenditures
        for expenditure in license_obj.time_expenditures.all():
            expenditure.created_debt = Decimal('0.00')
            expenditure.save()
            # Clear existing deductions
            expenditure.deductions.all().delete()
        
        # Process all expenditures in chronological order (date, then time)
        expenditures = license_obj.time_expenditures.order_by('date', 'time')
        
        print(f"  Found {expenditures.count()} expenditures to process")
        
        for expenditure in expenditures:
            if not expenditure.is_goodwill:
                process_expenditure_deduction(expenditure)
                expenditure.refresh_from_db()
                print(f"    Processed expenditure {expenditure.id}: {expenditure.hours_spent}h -> debt: {expenditure.created_debt}h")
        
        # Apply credits to existing debts
        credits = license_obj.time_credits.order_by('start_date')
        for credit in credits:
            apply_new_credit_to_debt(credit)
            credit.refresh_from_db()
            print(f"    Applied credit {credit.id}: {credit.credit_hours}h -> remaining: {credit.remaining_hours}h")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Import maintenance time data from CSV files')
    parser.add_argument('--serial-number', type=str, help='Only import data for this serial number')
    parser.add_argument('--credits-csv', default='../Datenvorlagen/Zeitgutschriften.csv',
                        help='Path to time credits CSV file')
    parser.add_argument('--expenditures-csv', default='../Datenvorlagen/timelog.csv',
                        help='Path to time expenditures CSV file')
    parser.add_argument('--skip-credits', action='store_true', help='Skip importing credits')
    parser.add_argument('--skip-expenditures', action='store_true', help='Skip importing expenditures')
    parser.add_argument('--skip-recalc', action='store_true', help='Skip recalculating balances')
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("MAINTENANCE DATA IMPORT")
    print("=" * 80)
    
    if args.serial_number:
        print(f"\nFiltering for Serial Number: {args.serial_number}")
    
    # Import credits first (they should come before expenditures chronologically)
    if not args.skip_credits:
        credits_path = os.path.join(os.path.dirname(__file__), args.credits_csv)
        import_time_credits(credits_path, args.serial_number)
    
    # Import expenditures
    if not args.skip_expenditures:
        expenditures_path = os.path.join(os.path.dirname(__file__), args.expenditures_csv)
        import_time_expenditures(expenditures_path, args.serial_number)
    
    # Recalculate all balances
    if not args.skip_recalc:
        recalculate_balances(args.serial_number)
    
    print("\n" + "=" * 80)
    print("IMPORT COMPLETE")
    print("=" * 80)


if __name__ == '__main__':
    main()
