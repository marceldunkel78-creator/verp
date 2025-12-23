from django.test import TestCase
from suppliers.models import Supplier
from .models import Order, OrderItem
from .serializers import OrderCreateUpdateSerializer, OrderDetailSerializer


class OrderSerializersTests(TestCase):
    def test_update_controlling_checked_persists(self):
        supplier = Supplier.objects.create(company_name='Test Supplier')
        order = Order.objects.create(supplier=supplier)
        item1 = OrderItem.objects.create(order=order, article_number='A1', name='Item 1', list_price=100, final_price=90, quantity=1, position=1)
        item2 = OrderItem.objects.create(order=order, article_number='A2', name='Item 2', list_price=50, final_price=45, quantity=2, position=2)

        # Prepare payload to set controlling_checked True
        data = {'items': []}
        for itm in OrderDetailSerializer(order).data['items']:
            itm['controlling_checked'] = True
            data['items'].append(itm)

        serializer = OrderCreateUpdateSerializer(instance=order, data=data, partial=True)
        self.assertTrue(serializer.is_valid(), msg=f"Errors: {serializer.errors}")
        serializer.save()

        # Reload items from DB and assert controlling_checked persisted
        item1.refresh_from_db()
        item2.refresh_from_db()
        self.assertTrue(item1.controlling_checked)
        self.assertTrue(item2.controlling_checked)

        # Also ensure we did not create duplicate items and quantities are preserved
        order.refresh_from_db()
        # There should still be exactly 2 items for this order
        self.assertEqual(order.items.count(), 2)
        # And both should have quantity > 0
        self.assertEqual(order.items.filter(quantity__gt=0).count(), 2)

