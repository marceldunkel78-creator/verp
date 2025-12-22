import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()

username = 'postgres'
qs = User.objects.filter(username=username)
if not qs.exists():
    print(f"User '{username}' nicht gefunden")
else:
    u = qs.first()
    print('username:', u.username)
    print('email:', getattr(u, 'email', None))
    print('is_active:', u.is_active)
    print('is_staff:', getattr(u, 'is_staff', None))
    print('is_superuser:', getattr(u, 'is_superuser', None))
    print('last_login:', getattr(u, 'last_login', None))
    print('date_joined:', getattr(u, 'date_joined', None))
    # zusätzliche Felder, falls vorhanden
    if hasattr(u, 'is_verified'):
        print('is_verified:', getattr(u, 'is_verified'))
