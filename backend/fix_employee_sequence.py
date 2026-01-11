#!/usr/bin/env python
"""
Fix PostgreSQL sequences for Employee model
"""
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Get the maximum ID from users_employee table
    cursor.execute('SELECT MAX(id) FROM users_employee;')
    max_id = cursor.fetchone()[0]
    print(f'Max Employee ID: {max_id}')
    
    # Reset the sequence to max_id + 1
    if max_id:
        cursor.execute(f'ALTER SEQUENCE users_employee_id_seq RESTART WITH {max_id + 1};')
        print(f'Sequence reset to {max_id + 1}')
    else:
        print('No employees found')

print('Done!')
