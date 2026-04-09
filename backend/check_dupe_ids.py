import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'verp.settings'
import django
django.setup()
from customer_orders.models import CustomerOrder
from django.db.models import Count

# Duplikate bei legacy_auftrags_id?
dupes = (CustomerOrder.objects
    .filter(legacy_auftrags_id__isnull=False)
    .values('legacy_auftrags_id')
    .annotate(cnt=Count('id'))
    .filter(cnt__gt=1)
    .order_by('-cnt'))

print(f"Auftrags_IDs mehrfach belegt: {dupes.count()}")
for d in list(dupes[:15]):
    aid = d['legacy_auftrags_id']
    orders = list(CustomerOrder.objects.filter(legacy_auftrags_id=aid).values('order_number', 'customer__last_name'))
    print(f"  ID {aid} ({d['cnt']}x): {orders}")

total = CustomerOrder.objects.count()
with_id = CustomerOrder.objects.filter(legacy_auftrags_id__isnull=False).count()
without = CustomerOrder.objects.filter(legacy_auftrags_id__isnull=True).count()
print(f"\nGesamt: {total}, mit legacy_id: {with_id}, ohne: {without}")
