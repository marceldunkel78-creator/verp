"""
Tests fuer die Lieferanten-Loeschlogik (backend/suppliers/deletion.py).

Wichtig: die Tests laufen gegen die echten Modelle und pruefen genau die
Faelle, die beim Aufraeumen der Dubletten aus dem Excel-Lagerimport auftreten:
  * Lagerartikel und Bestellungen (PROTECT) blockieren das Löschen
  * Umhängen verschiebt Lagerartikel auf den Ziel-Lieferanten
  * unique_together auf ProductGroup/SupplierProduct kollidiert nicht
  * visitron_part_number bleibt konsistent zum neuen Lieferanten
  * SET_NULL-Verknüpfungen werden nicht stillschweigend verloren
  * Bestätigung ist Pflicht
"""

from django.test import TestCase
from django.contrib.auth import get_user_model

from .deletion import (
    delete_supplier, get_link_counts, get_headline_counts,
    get_blocking_links, find_duplicates,
)
from .models import Supplier, ProductGroup, SupplierContact

User = get_user_model()


class SupplierDeletionTestBase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='tester', password='x', is_superuser=True, is_staff=True,
        )
        self.target = Supplier.objects.create(
            company_name='Excelitas-PCO', created_by=self.user,
        )
        self.dup = Supplier.objects.create(
            company_name='100 - Excelitas-PCO', created_by=self.user,
        )

    def assertSupplierGone(self, supplier):
        self.assertFalse(Supplier.objects.filter(pk=supplier.pk).exists())


class BlockingLinkTests(SupplierDeletionTestBase):
    def test_supplier_without_links_is_deletable(self):
        result = delete_supplier(self.dup, confirm=True)
        self.assertTrue(result['ok'])
        self.assertTrue(result['deleted'])
        self.assertSupplierGone(self.dup)

    def test_inventory_item_blocks_delete_without_reassign(self):
        from inventory.models import InventoryItem
        InventoryItem.objects.create(
            name='Test-Objekt', article_number='A-1', supplier=self.dup,
            quantity=1, item_function='TRADING_GOOD',
            status='FREI', purchase_price=0,
        )

        result = delete_supplier(self.dup, confirm=True)
        self.assertFalse(result['ok'])
        self.assertIn('Lagerartikel', result['error'])
        # Nichts gelöscht
        self.assertTrue(Supplier.objects.filter(pk=self.dup.pk).exists())
        self.assertEqual(InventoryItem.objects.filter(supplier=self.dup).count(), 1)

    def test_blocking_links_are_reported_with_counts(self):
        from inventory.models import InventoryItem
        for i in range(3):
            InventoryItem.objects.create(
                name=f'Objekt {i}', article_number=f'A-{i}', supplier=self.dup,
                quantity=1, item_function='TRADING_GOOD', status='FREI', purchase_price=0,
            )

        blocked = {b['key']: b for b in get_blocking_links(self.dup)}
        self.assertIn('inventory_items', blocked)
        self.assertEqual(blocked['inventory_items']['count'], 3)

        counts = get_headline_counts(self.dup)
        self.assertEqual(counts['inventory_items'], 3)
        self.assertEqual(counts['orders'], 0)


class ReassignTests(SupplierDeletionTestBase):
    def test_inventory_items_move_to_target(self):
        from inventory.models import InventoryItem
        for i in range(4):
            InventoryItem.objects.create(
                name=f'Objekt {i}', article_number=f'A-{i}', supplier=self.dup,
                quantity=1, item_function='TRADING_GOOD', status='FREI', purchase_price=0,
            )

        result = delete_supplier(self.dup, reassign_to=self.target, confirm=True)

        self.assertTrue(result['ok'], msg=result.get('error'))
        self.assertSupplierGone(self.dup)
        self.assertEqual(
            InventoryItem.objects.filter(supplier=self.target).count(), 4,
            'Lagerartikel müssen am Ziel hängen',
        )

    def test_orders_move_to_target(self):
        from orders.models import Order
        Order.objects.create(
            order_number='O-1', supplier=self.dup, order_date='2026-01-01',
        )
        Order.objects.create(
            order_number='O-2', supplier=self.dup, order_date='2026-01-01',
        )
        dup_id = self.dup.pk

        result = delete_supplier(self.dup, reassign_to=self.target, confirm=True)

        self.assertTrue(result['ok'], msg=result.get('error'))
        self.assertEqual(Order.objects.filter(supplier=self.target).count(), 2)
        self.assertEqual(Order.objects.filter(supplier_id=dup_id).count(), 0)

    def test_owned_children_are_removed_not_orphaned(self):
        SupplierContact.objects.create(
            supplier=self.dup, contact_type='main', contact_person='Max',
        )
        ProductGroup.objects.create(
            supplier=self.dup, name='Standard', discount_percent=0,
        )

        result = delete_supplier(self.dup, reassign_to=self.target, confirm=True)

        self.assertTrue(result['ok'], msg=result.get('error'))
        # Beim Umhängen wandern sie zum Ziel
        self.assertEqual(SupplierContact.objects.filter(supplier=self.target).count(), 1)
        self.assertEqual(ProductGroup.objects.filter(supplier=self.target).count(), 1)

    def test_unique_together_product_group_collision_is_merged(self):
        """Gleicher Warengruppenname bei beiden -> kein IntegrityError."""
        ProductGroup.objects.create(supplier=self.dup, name='Standard', discount_percent=0)
        ProductGroup.objects.create(supplier=self.target, name='Standard', discount_percent=0)

        result = delete_supplier(self.dup, reassign_to=self.target, confirm=True)

        self.assertTrue(result['ok'], msg=result.get('error'))
        groups = ProductGroup.objects.filter(name='Standard')
        self.assertEqual(groups.count(), 1, 'Dublette muss zusammengeführt werden')
        self.assertEqual(groups.first().supplier_id, self.target.id)
        self.assertTrue(any('Dublette' in w for w in result['warnings']))

    def test_unique_together_supplier_product_collision_is_merged(self):
        from .models import SupplierProduct, TradingProduct
        product = TradingProduct.objects.create(
            name='Kamera XYZ', supplier=self.target, list_price='100',
            list_price_currency='EUR', price_valid_from='2026-01-01',
        )
        SupplierProduct.objects.create(supplier=self.dup, product=product)
        SupplierProduct.objects.create(supplier=self.target, product=product)

        result = delete_supplier(self.dup, reassign_to=self.target, confirm=True)

        self.assertTrue(result['ok'], msg=result.get('error'))
        links = SupplierProduct.objects.filter(product=product)
        self.assertEqual(links.count(), 1)
        self.assertEqual(links.first().supplier_id, self.target.id)

    def test_mixed_owned_and_foreign_links_all_move(self):
        from inventory.models import InventoryItem
        from orders.models import Order
        InventoryItem.objects.create(
            name='Objekt', article_number='A-1', supplier=self.dup,
            quantity=1, item_function='TRADING_GOOD', status='FREI', purchase_price=0,
        )
        Order.objects.create(
            order_number='O-1', supplier=self.dup, order_date='2026-01-01',
        )
        SupplierContact.objects.create(
            supplier=self.dup, contact_type='main', contact_person='Max',
        )

        result = delete_supplier(self.dup, reassign_to=self.target, confirm=True)

        self.assertTrue(result['ok'], msg=result.get('error'))
        moved = {m['key']: m['count'] for m in result['moved']}
        self.assertEqual(moved.get('inventory_items'), 1)
        self.assertEqual(moved.get('orders'), 1)
        self.assertEqual(moved.get('contacts'), 1)


class VisitronNumberTests(SupplierDeletionTestBase):
    def test_numbers_kept_by_default(self):
        from .models import TradingProduct
        product = TradingProduct.objects.create(
            name='Objektiv', supplier=self.dup, list_price='10',
            list_price_currency='EUR', price_valid_from='2026-01-01',
        )
        original = product.visitron_part_number
        self.assertTrue(original.startswith(f'{self.dup.supplier_number}-'))

        result = delete_supplier(self.dup, reassign_to=self.target, confirm=True)

        self.assertTrue(result['ok'], msg=result.get('error'))
        product.refresh_from_db()
        # Standardmäßig unverändert - die Nummer steht in Bestelldokumenten.
        self.assertEqual(product.visitron_part_number, original)
        self.assertEqual(product.supplier_id, self.target.id)

    def test_numbers_renumbered_on_request(self):
        from .models import TradingProduct, MaterialSupply
        product = TradingProduct.objects.create(
            name='Objektiv', supplier=self.dup, list_price='10',
            list_price_currency='EUR', price_valid_from='2026-01-01',
        )
        material = MaterialSupply.objects.create(
            name='Pellet', supplier=self.dup, list_price='5',
            list_price_currency='EUR', price_valid_from='2026-01-01',
        )
        old_product_number = product.visitron_part_number
        old_material_number = material.visitron_part_number

        result = delete_supplier(
            self.dup, reassign_to=self.target, renumber=True, confirm=True,
        )

        self.assertTrue(result['ok'], msg=result.get('error'))
        product.refresh_from_db()
        material.refresh_from_db()
        self.assertTrue(
            product.visitron_part_number.startswith(f'{self.target.supplier_number}-'),
            msg=f'sollte {self.target.supplier_number}- haben, ist {product.visitron_part_number}',
        )
        self.assertTrue(
            material.visitron_part_number.startswith(f'{self.target.supplier_number}-M'),
            msg=f'sollte {self.target.supplier_number}-M haben, ist {material.visitron_part_number}',
        )
        self.assertNotEqual(product.visitron_part_number, old_product_number)
        self.assertNotEqual(material.visitron_part_number, old_material_number)


class GuardTests(SupplierDeletionTestBase):
    def test_requires_confirm(self):
        result = delete_supplier(self.dup, confirm=False)
        self.assertFalse(result['ok'])
        self.assertIn('bestaetigt', result['error'])
        self.assertTrue(Supplier.objects.filter(pk=self.dup.pk).exists())

    def test_same_source_and_target_rejected(self):
        result = delete_supplier(self.dup, reassign_to=self.dup, confirm=True)
        self.assertFalse(result['ok'])
        self.assertIn('identisch', result['error'])
        self.assertTrue(Supplier.objects.filter(pk=self.dup.pk).exists())

    def test_dry_run_changes_nothing(self):
        from inventory.models import InventoryItem
        InventoryItem.objects.create(
            name='Objekt', article_number='A-1', supplier=self.dup,
            quantity=1, item_function='TRADING_GOOD', status='FREI', purchase_price=0,
        )

        result = delete_supplier(
            self.dup, reassign_to=self.target, dry_run=True, confirm=True,
        )

        self.assertTrue(result['ok'], msg=result.get('error'))
        self.assertFalse(result['deleted'])
        self.assertTrue(Supplier.objects.filter(pk=self.dup.pk).exists())
        self.assertEqual(InventoryItem.objects.filter(supplier=self.dup).count(), 1)
        actions = {m['action'] for m in result['moved']}
        self.assertIn('verschieben', actions)


class ListSerializerCountTests(SupplierDeletionTestBase):
    """
    Regressionstests für die Kachel-Zahlen.

    1) Zwei Count-Annotationen über verschiedene Relationen erzeugen ohne
       `distinct=True` einen Kreuzprodukt-Join: ein Lieferant mit 6 Lagerartikeln
       und 5 Bestellungen zeigte 30 Lagerartikel.
    2) Regression 2026-10-02: beim Umbau auf den Listen-Serializer wurden die
       verschachtelten Listen (`contacts`, `product_groups`, `price_lists`)
       entfernt, ohne die Kachel umzustellen - die Kontaktzahl stand danach
       dauerhaft auf 0. Deshalb pruefen beide Tests, dass alle FUENF Zaehler
       vorhanden sind UND mit den echten Zahlen uebereinstimmen.
    """

    def _annotated(self, supplier):
        from django.db.models import Count
        return Supplier.objects.annotate(
            inventory_items_count=Count('inventory_items', distinct=True),
            orders_count=Count('orders', distinct=True),
            contacts_count=Count('contacts', distinct=True),
            product_groups_count=Count('product_groups', distinct=True),
            price_lists_count=Count('price_lists', distinct=True),
        ).get(pk=supplier.pk)

    def test_annotated_counts_match_real_counts(self):
        from inventory.models import InventoryItem
        from orders.models import Order
        for i in range(6):
            InventoryItem.objects.create(
                name=f'Objekt {i}', article_number=f'A-{i}', supplier=self.dup,
                quantity=1, item_function='TRADING_GOOD', status='FREI',
                purchase_price=0,
            )
        for i in range(5):
            Order.objects.create(
                order_number=f'O-{i}', supplier=self.dup, order_date='2026-01-01',
            )

        obj = self._annotated(self.dup)

        self.assertEqual(obj.inventory_items_count, 6)
        self.assertEqual(obj.orders_count, 5)
        # Gegenprobe: ohne distinct wären es 30 - deshalb der Test.
        from django.db.models import Count as C
        naive = Supplier.objects.annotate(
            inventory_items_count=C('inventory_items'),
        ).get(pk=self.dup.pk)
        self.assertEqual(naive.inventory_items_count, 6)

    def test_serializer_exposes_counts(self):
        from .serializers import SupplierListSerializer
        data = SupplierListSerializer(self._annotated(self.dup)).data
        self.assertIn('inventory_items_count', data)
        self.assertIn('orders_count', data)
        self.assertEqual(data['inventory_items_count'], 0)
        self.assertEqual(data['orders_count'], 0)
        # Felder, die das Frontend für die Kachel braucht
        self.assertIn('supplier_number', data)
        self.assertIn('company_name', data)

    def test_all_five_counters_are_exposed(self):
        """Regression: `contacts_count` fehlte, die Kachel zeigte 0."""
        from .serializers import SupplierListSerializer
        data = SupplierListSerializer(self._annotated(self.dup)).data
        for field in ('inventory_items_count', 'orders_count', 'contacts_count',
                      'product_groups_count', 'price_lists_count'):
            self.assertIn(field, data, f'{field} fehlt in der Listen-Antwort')

    def test_related_counts_are_not_zero(self):
        """
        Kern der Regression: angelegte Kontakte/Warengruppen/Preislisten
        MUESSEN in der Listen-Antwort sichtbar sein.
        """
        from .models import PriceList, SupplierContact
        from .serializers import SupplierListSerializer
        for i in range(4):
            SupplierContact.objects.create(
                supplier=self.dup, contact_type='service',
                contact_person=f'Person {i}',
            )
        ProductGroup.objects.create(
            supplier=self.dup, name='Standard', discount_percent=0,
        )
        PriceList.objects.create(
            supplier=self.dup, name='2026', valid_from='2026-01-01',
        )

        data = SupplierListSerializer(self._annotated(self.dup)).data

        self.assertEqual(data['contacts_count'], 4)
        self.assertEqual(data['product_groups_count'], 1)
        self.assertEqual(data['price_lists_count'], 1)

    def test_list_serializer_has_no_nested_objects(self):
        """
        Die Liste liefert bewusst KEINE verschachtelten Objekte. Wer sie
        braucht, muss den Detail-Endpunkt nutzen - sonst N+1-Queries.
        """
        from .serializers import SupplierListSerializer
        SupplierContact.objects.create(
            supplier=self.dup, contact_type='main', contact_person='Max',
        )
        data = SupplierListSerializer(self._annotated(self.dup)).data
        self.assertNotIn('contacts', data)
        self.assertNotIn('product_groups', data)
        self.assertNotIn('price_lists', data)


class DuplicateDetectionTests(SupplierDeletionTestBase):
    def test_number_prefix_duplicate_is_found(self):
        matches = find_duplicates(self.dup)
        ids = [m['id'] for m in matches]
        self.assertIn(self.target.id, ids)
        self.assertNotIn(self.dup.id, ids)

    def test_unrelated_supplier_has_no_duplicates(self):
        # Eigene Nummer verwenden, damit reale DB-Eintraege den Test nicht stoeren
        other = Supplier.objects.create(company_name='FirmaXYZZY', created_by=self.user)
        matches = find_duplicates(other)
        self.assertEqual(
            [m for m in matches if m['company_name'] == 'FirmaXYZZY'], [],
        )

    def test_counts_reflect_ownership(self):
        SupplierContact.objects.create(
            supplier=self.dup, contact_type='main', contact_person='Max',
        )
        counts = get_link_counts(self.dup)
        self.assertEqual(counts['contacts']['count'], 1)
        self.assertTrue(counts['contacts']['owned'])
        self.assertFalse(counts['inventory_items']['owned'])
