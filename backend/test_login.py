import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
username = 'postgres'
new_password = 'TestPass123!'
try:
    u = User.objects.get(username=username)
    u.set_password(new_password)
    u.save()
    print('Password set for', username)
except User.DoesNotExist:
    print('User not found')

# Now test token endpoint
import requests
url = 'http://127.0.0.1:8000/api/auth/login/'
resp = requests.post(url, json={'username': username, 'password': new_password})
print('status', resp.status_code)
try:
    print('json', resp.json())
except Exception as e:
    print('text', resp.text)
