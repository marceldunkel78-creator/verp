import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()

import requests
BASE='http://127.0.0.1:8000/api'
s=requests.Session()
print('OPTIONS /users/time-entries/')
resp=s.options(BASE+'/users/time-entries/')
print('status',resp.status_code)
print('headers', resp.headers)
try:
    print('body', resp.json())
except:
    print(resp.text)

print('\nGET')
resp=s.get(BASE+'/users/time-entries/')
print(resp.status_code)
print(resp.text[:400])

print('\nPOST test (empty)')
resp=s.post(BASE+'/users/time-entries/', json={})
print(resp.status_code)
print(resp.text[:400])
