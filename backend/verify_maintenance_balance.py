#!/usr/bin/env python
"""Verify maintenance balance calculation for license 1598"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from visiview.models import VisiViewLicense
from visiview.serializers import calculate_maintenance_balance

# Get license
license_obj = VisiViewLicense.objects.get(serial_number='1598')

print(f"License: {license_obj.license_number} (Serial: {license_obj.serial_number})")
print(f"=" * 80)

print(f"\nTime Credits:")
print(f"-" * 80)
credits = license_obj.time_credits.all().order_by('start_date')
for c in credits:
    print(f"  {c.start_date} - {c.end_date}: {c.credit_hours}h (remaining: {c.remaining_hours}h)")

print(f"\nTime Expenditures:")
print(f"-" * 80)
expenditures = license_obj.time_expenditures.all().order_by('date', 'time')
for e in expenditures:
    print(f"  {e.date} {e.time}: {e.hours_spent}h by {e.user} "
          f"(goodwill: {e.is_goodwill}, debt: {e.created_debt}h)")
    # Show deductions
    for deduction in e.deductions.all():
        print(f"    -> Deducted {deduction.hours_deducted}h from credit "
              f"{deduction.credit.start_date} - {deduction.credit.end_date}")

# Calculate balance
balance = calculate_maintenance_balance(license_obj.id)

print(f"\n" + "=" * 80)
print(f"Calculated Balance:")
print(f"=" * 80)
print(f"  Total Credits:       {balance['total_credits']}h")
print(f"  Total Expenditures:  {balance['total_expenditures']}h")
print(f"  Total Debt:          {balance.get('total_debt', 0)}h")
print(f"  Current Balance:     {balance['current_balance']}h")

# Calculate remaining credits from individual credit objects
total_remaining = sum(c.remaining_hours for c in credits)
used_from_credits = balance['total_credits'] - total_remaining

print(f"  Used from Credits:   {used_from_credits}h")
print(f"  Remaining Credits:   {total_remaining}h")

print(f"\n" + "=" * 80)
print(f"Verification:")
print(f"=" * 80)

# Expected calculation:
# Credits: 3h + 3h + 3h = 9h
# Expenditures: 5.58h (goodwill) + 0.42h + 0.28h + 0.33h = 6.61h (but 5.58h is goodwill)
# Non-goodwill: 0.42h + 0.28h + 0.33h = 1.03h
# Used from credits: 1.03h
# Remaining: 9h - 1.03h = 7.97h
# Current balance: 7.97h (no debt)

total_goodwill = sum(e.hours_spent for e in expenditures if e.is_goodwill)
total_non_goodwill = sum(e.hours_spent for e in expenditures if not e.is_goodwill)

print(f"  Goodwill hours:      {total_goodwill}h (not deducted)")
print(f"  Non-goodwill hours:  {total_non_goodwill}h (deducted from credits)")
print(f"  Expected remaining:  {balance['total_credits'] - total_non_goodwill}h")
print(f"  Actual remaining:    {total_remaining}h")

if abs(total_remaining - (balance['total_credits'] - total_non_goodwill)) < 0.01:
    print(f"\n  ✓ Balance calculation is CORRECT!")
else:
    print(f"\n  ✗ Balance calculation mismatch!")
