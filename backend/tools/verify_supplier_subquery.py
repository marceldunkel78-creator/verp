"""Verifiziert die Subquery-Variante inkl. Coalesce gegen alle 123 Lieferanten.

Prueft:
  1. Laufzeit
  2. Gleichheit mit dem bisherigen JOIN-Ergebnis (inkl. 0 statt None)
  3. Verhalten bei Suche und Statusfilter
  4. Dass die Werte im Serializer als Zahl ankommen
"""
import time

import django
from django.db.models import Count, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce

from suppliers.models import Supplier
from suppliers.serializers import SupplierListSerializer

RELATIONS = ['inventory_items', 'orders', 'contacts', 'product_groups', 'price_lists']


def count_subquery(rel):
    """Subquery, die auch bei 0 Verknuepfungen 0 liefert (nicht None)."""
    field = Supplier._meta.get_field(rel)
    model = field.related_model
    fk = field.field.name
    inner = (model.objects.filter(**{fk: OuterRef('pk')})
             .values(fk)
             .annotate(c=Count('*'))
             .values('c')[:1])
    return Coalesce(Subquery(inner), Value(0))


def qs_old():
    return Supplier.objects.annotate(**{
        f'{r}_count': Count(r, distinct=True) for r in RELATIONS
    }).select_related('created_by')


def qs_new():
    return Supplier.objects.annotate(**{
        f'{r}_count': count_subquery(r) for r in RELATIONS
    }).select_related('created_by')


KEYS = [f'{r}_count' for r in RELATIONS]


def fetch(qs):
    return [{'id': s.id, **{k: getattr(s, k) for k in KEYS}} for s in qs]


def timeit(fn, runs=3):
    fn()
    return min(_run(fn) for _ in range(runs))


def _run(fn):
    t0 = time.perf_counter()
    fn()
    return time.perf_counter() - t0


def main():
    old = {r['id']: tuple(r[k] for k in KEYS) for r in fetch(qs_old())}
    new = {r['id']: tuple(r[k] for k in KEYS) for r in fetch(qs_new())}

    print(f'Lieferanten: {len(old)}')
    print()

    print('--- Gleichheit ---')
    diff = [i for i in old if old[i] != new.get(i)]
    print(f'Abweichungen: {len(diff)}')
    for i in diff[:8]:
        print(f'  id={i}:  ALT={old[i]}')
        print(f'         NEU={new.get(i)}')
    print()

    print('--- None-Pruefung ---')
    nones = [i for i, v in new.items() if any(x is None for x in v)]
    print(f'Spalten mit None: {len(nones)}')
    print()

    print('--- Laufzeit (Seite 1, 9 Lieferanten) ---')
    t_old = timeit(lambda: fetch(qs_old()[:9]))
    t_new = timeit(lambda: fetch(qs_new()[:9]))
    print(f'ALT (JOIN):  {t_old * 1000:9.1f} ms')
    print(f'NEU (Sub):   {t_new * 1000:9.1f} ms')
    print(f'Faktor:      {t_old / t_new:9.1f}x')
    print()

    print('--- Laufzeit (alle Lieferanten, 13 Seiten) ---')
    f_old = timeit(lambda: [s.pk for s in qs_old()], runs=2)
    f_new = timeit(lambda: [s.pk for s in qs_new()], runs=2)
    print(f'ALT: {f_old * 1000:.1f} ms')
    print(f'NEU: {f_new * 1000:.1f} ms')
    print(f'Faktor: {f_old / f_new:.1f}x')
    print()

    print('--- Mit Suchfilter ---')
    for term in ['a', 'Thorlabs', 'Zeiss']:
        qo = qs_old().filter(company_name__icontains=term)
        qn = qs_new().filter(company_name__icontains=term)
        to = timeit(lambda: [s.pk for s in qo[:9]], runs=2)
        tn = timeit(lambda: [s.pk for s in qn[:9]], runs=2)
        co = qo.count()
        cn = qn.count()
        print(f'  {term:12s} ALT={to * 1000:8.1f}ms/{co:4d}  '
              f'NEU={tn * 1000:7.1f}ms/{cn:4d}  Faktor={to / tn:.0f}x')
    print()

    print('--- Mit Statusfilter ---')
    for val in [True, False]:
        qo = qs_old().filter(is_active=val)
        qn = qs_new().filter(is_active=val)
        to = timeit(lambda: [s.pk for s in qo[:9]], runs=2)
        tn = timeit(lambda: [s.pk for s in qn[:9]], runs=2)
        print(f'  is_active={str(val):5s} ALT={to * 1000:8.1f}ms/{qo.count():4d}  '
              f'NEU={tn * 1000:7.1f}ms/{qn.count():4d}  Faktor={to / tn:.0f}x')
    print()

    print('--- Serializer-Ausgabe (Seite 1) ---')
    data = SupplierListSerializer(qs_new()[:9], many=True).data
    for row in data[:4]:
        print(f"  {row['supplier_number']:>4s} {row['company_name'][:34]:34s} "
              f"Inv={row['inventory_items_count']:5d} "
              f"Best={row['orders_count']:5d} "
              f"Kont={row['contacts_count']:3d} "
              f"WG={row['product_groups_count']:3d} "
              f"PL={row['price_lists_count']:3d}")
    print()
    types = {k: type(data[0][k]).__name__ for k in KEYS}
    print(f'Typen: {types}')
    print(f'Alle int: {all(t == "int" for t in types.values())}')


if __name__ == '__main__':
    main()