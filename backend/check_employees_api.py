import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()

import requests

BASE = 'http://127.0.0.1:8000/api'
USERNAME = 'postgres'
PASSWORD = 'TestPass123!'

s = requests.Session()
print('Logging in to', BASE + '/auth/login/')
resp = s.post(BASE + '/auth/login/', json={'username': USERNAME, 'password': PASSWORD})
print('login status', resp.status_code)
try:
    print('login json keys:', resp.json().keys())
except Exception as e:
    print('login resp text:', resp.text)

for path in ['/users/employees/', '/employees/']:
    print(f"\nGET {path}")
    resp = s.get(BASE + path)
    print('status', resp.status_code)
    try:
        j = resp.json()
        print('json:', j)
    except Exception as e:
        print('text:', resp.text)
