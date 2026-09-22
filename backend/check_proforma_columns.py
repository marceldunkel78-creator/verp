import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()
from django.db import connection

c = connection.cursor()
c.execute("SELECT column_name FROM information_schema.columns WHERE table_name='service_rmareturn' AND column_name LIKE 'proforma%'")
print('rmareturn proforma:', [r[0] for r in c.fetchall()])
c.execute("SELECT column_name FROM information_schema.columns WHERE table_name='service_rmamanufacturerreturn' AND column_name LIKE 'proforma%'")
print('manufacturerreturn proforma:', [r[0] for r in c.fetchall()])