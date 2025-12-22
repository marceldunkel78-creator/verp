import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()

import requests
from getpass import getpass

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

# Try /users/me/
print('\nGET /users/me/')
resp = s.get(BASE + '/users/me/')
print('status', resp.status_code)
try:
    print('json:', resp.json())
except Exception as e:
    print('text:', resp.text)

# Try /users/
print('\nGET /users/')
resp = s.get(BASE + '/users/')
print('status', resp.status_code)
try:
    j = resp.json()
    if isinstance(j, dict) and 'results' in j:
        print('results length:', len(j['results']))
        print('first keys:', list(j['results'][0].keys()) if j['results'] else 'no results')
    else:
        print('json type:', type(j), 'keys:', (j.keys() if isinstance(j, dict) else 'non-dict'))
        print(j)
except Exception as e:
    print('text:', resp.text)
