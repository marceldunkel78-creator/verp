from django.core.management.base import BaseCommand
from collections import defaultdict
from decimal import Decimal
from orders.models import Order


class Command(BaseCommand):
    help = "Deduplicate OrderItem rows per order. Keeps items with positive quantities and removes duplicate zero-quantity placeholders. Use --dry-run to see changes only."

    def add_arguments(self, parser):
        parser.add_argument('--order-id', type=int, dest='order_id', help='Only process this order id')
        parser.add_argument('--dry-run', action='store_true', dest='dry_run', help='Do not modify DB, only show report')

    def handle(self, *args, **options):
        order_qs = Order.objects.all()
        if options.get('order_id'):
            order_qs = order_qs.filter(id=options['order_id'])

        total_deleted = 0
        total_merged = 0
        for order in order_qs:
            groups = defaultdict(list)
            for it in order.items.all():
                key = (it.position, (it.article_number or '').strip(), (it.name or '').strip())
                groups[key].append(it)

            for key, items in groups.items():
                if len(items) <= 1:
                    continue

                # Prefer items with quantity > 0
                positive_items = [i for i in items if i.quantity and i.quantity > 0]

                if positive_items:
                    keeper = positive_items[0]
                    others = [i for i in items if i.id != keeper.id]

                    for other in others:
                        if other.quantity and other.quantity > 0:
                            # merge positive quantities into keeper
                            if not options['dry_run']:
                                keeper.quantity = (keeper.quantity or Decimal('0')) + (other.quantity or Decimal('0'))
                                # preserve confirmed_price if missing
                                if keeper.confirmed_price is None and other.confirmed_price is not None:
                                    keeper.confirmed_price = other.confirmed_price
                                if other.controlling_checked:
                                    keeper.controlling_checked = True
                                keeper.save()
                                other.delete()
                            total_merged += 1
                            self.stdout.write(self.style.NOTICE(f"Merged item {other.id} into {keeper.id} for order {order.id}"))
                        else:
                            # delete zero-quantity placeholder
                            if not options['dry_run']:
                                other.delete()
                            total_deleted += 1
                            self.stdout.write(self.style.WARNING(f"Deleted zero-quantity item {other.id} for order {order.id}"))
                else:
                    # no positive items, keep first and remove rest
                    keeper = items[0]
                    for other in items[1:]:
                        if not options['dry_run']:
                            other.delete()
                        total_deleted += 1
                        self.stdout.write(self.style.WARNING(f"Deleted duplicate item {other.id} (no positives) for order {order.id}"))

        self.stdout.write(self.style.SUCCESS(f"Done. Merged: {total_merged}, Deleted: {total_deleted} (dry_run={options['dry_run']})"))
