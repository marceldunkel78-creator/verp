#!/usr/bin/env python
"""Check User and Employee relationship"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from users.models import Employee
from django.contrib.auth import get_user_model
User = get_user_model()

print("=" * 60)
print("USER AND EMPLOYEE CHECK")
print("=" * 60)

print("\n1. Marcel Dunkel Employee:")
for e in Employee.objects.filter(first_name='Marcel'):
    print(f"   Employee ID: {e.id}")
    print(f"   Name: {e.first_name} {e.last_name}")
    print(f"   Has users relation: {hasattr(e, 'users')}")

print("\n2. Users with 'marcel' in username:")
for u in User.objects.filter(username__icontains='marcel'):
    print(f"   User ID: {u.id}")
    print(f"   Username: {u.username}")
    print(f"   Email: {u.email}")
    print(f"   Has employee relation: {hasattr(u, 'employee')}")
    if hasattr(u, 'employee'):
        print(f"   Linked Employee ID: {u.employee_id if u.employee_id else 'None'}")

print("\n3. All Users with Employee link:")
for u in User.objects.filter(employee__isnull=False):
    print(f"   User: {u.username} (ID: {u.id}) -> Employee ID: {u.employee_id}")

print("\n4. Employees relationship to User:")
# Check the User model fields
print(f"   User model fields: {[f.name for f in User._meta.fields]}")

print("\n5. Check if Marcel Dunkel is linked:")
marcel_employees = Employee.objects.filter(first_name='Marcel', last_name='Dunkel')
for emp in marcel_employees:
    linked_users = User.objects.filter(employee=emp)
    print(f"   Employee {emp.id} ({emp.first_name} {emp.last_name}):")
    for u in linked_users:
        print(f"      -> User {u.id} ({u.username})")
    if not linked_users.exists():
        print(f"      -> No linked user")
