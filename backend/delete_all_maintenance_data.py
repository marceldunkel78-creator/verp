#!/usr/bin/env python
"""
Delete all Maintenance Time Credits, Expenditures, and Deductions.
This script clears all maintenance data for a fresh re-import with the new calculation logic.

Usage: python delete_all_maintenance_data.py [--confirm]
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from visiview.models import MaintenanceTimeCredit, MaintenanceTimeExpenditure, MaintenanceTimeCreditDeduction


def delete_all_maintenance_data(confirm=False):
    """Delete all maintenance data"""
    
    # Count existing records
    deductions_count = MaintenanceTimeCreditDeduction.objects.count()
    expenditures_count = MaintenanceTimeExpenditure.objects.count()
    credits_count = MaintenanceTimeCredit.objects.count()
    
    print("=" * 60)
    print("MAINTENANCE DATA DELETION")
    print("=" * 60)
    print(f"\nCurrent records in database:")
    print(f"  - MaintenanceTimeCreditDeduction: {deductions_count}")
    print(f"  - MaintenanceTimeExpenditure: {expenditures_count}")
    print(f"  - MaintenanceTimeCredit: {credits_count}")
    print(f"  - Total: {deductions_count + expenditures_count + credits_count}")
    
    if not confirm:
        print("\n⚠️  WARNING: This will DELETE ALL maintenance data!")
        print("Run with --confirm to actually delete the data.")
        return False
    
    print("\n🗑️  Deleting all maintenance data...")
    
    # Delete in order (deductions first due to FK constraints)
    print(f"  Deleting {deductions_count} MaintenanceTimeCreditDeduction records...")
    MaintenanceTimeCreditDeduction.objects.all().delete()
    
    print(f"  Deleting {expenditures_count} MaintenanceTimeExpenditure records...")
    MaintenanceTimeExpenditure.objects.all().delete()
    
    print(f"  Deleting {credits_count} MaintenanceTimeCredit records...")
    MaintenanceTimeCredit.objects.all().delete()
    
    print("\n✅ All maintenance data deleted successfully!")
    print("\nYou can now run the import script with the new calculation logic:")
    print("  python import_maintenance_data.py")
    
    return True


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Delete all maintenance data for fresh re-import')
    parser.add_argument('--confirm', action='store_true', 
                        help='Actually delete the data (required for safety)')
    
    args = parser.parse_args()
    
    delete_all_maintenance_data(confirm=args.confirm)


if __name__ == '__main__':
    main()
