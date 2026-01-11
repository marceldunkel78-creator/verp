"""
Script to recalculate commissions for confirmed orders
"""
from customer_orders.models import CustomerOrder, CustomerOrderCommissionRecipient, EmployeeCommission
from company.models import CompanySettings

print("=" * 60)
print("RECALCULATE COMMISSIONS FOR CONFIRMED ORDERS")
print("=" * 60)

# Get all confirmed orders with commission recipients
confirmed_orders = CustomerOrder.objects.filter(status='bestaetigt')
print(f"\nTotal confirmed orders: {confirmed_orders.count()}")

# Get orders with commission recipients
orders_with_recipients = []
for order in confirmed_orders:
    recipients = CustomerOrderCommissionRecipient.objects.filter(order=order)
    if recipients.exists():
        orders_with_recipients.append(order)
        print(f"\nOrder {order.id} - {order.customer} - Recipients: {recipients.count()}")
        for recipient in recipients:
            print(f"  - {recipient.employee} ({recipient.commission_percentage}%)")

print(f"\nOrders with recipients: {len(orders_with_recipients)}")

# Delete existing commissions to recalculate
print(f"\nDeleting existing commissions...")
deleted_count = EmployeeCommission.objects.all().delete()[0]
print(f"Deleted {deleted_count} commission records")

# Recalculate commissions
print(f"\nRecalculating commissions...")
for order in orders_with_recipients:
    print(f"\nProcessing order {order.id}...")
    order._calculate_commissions()

# Show results
new_commissions = EmployeeCommission.objects.all()
print(f"\n{'=' * 60}")
print(f"RESULTS")
print(f"{'=' * 60}")
print(f"\nTotal commissions created: {new_commissions.count()}")

if new_commissions.exists():
    print("\nCommission records:")
    for comm in new_commissions:
        print(f"  - Employee: {comm.employee}, Amount: €{comm.commission_amount:.2f}, Order: {comm.customer_order_id}, Year: {comm.fiscal_year}")

print(f"\n{'=' * 60}")
