from customer_orders.models import EmployeeCommission, CustomerOrderCommissionRecipient, CustomerOrder

print("=" * 60)
print("COMMISSION DATA CHECK")
print("=" * 60)

# Check commission records
commission_count = EmployeeCommission.objects.count()
print(f"\nTotal EmployeeCommission records: {commission_count}")

if commission_count > 0:
    print("\nLast 5 commissions:")
    for comm in EmployeeCommission.objects.all().order_by('-id')[:5]:
        print(f"  ID: {comm.id}, Employee: {comm.employee}, Order: {comm.order_id}, Amount: {comm.commission_amount}, Fiscal Year: {comm.fiscal_year}")

# Check commission recipients
recipient_count = CustomerOrderCommissionRecipient.objects.count()
print(f"\nTotal CustomerOrderCommissionRecipient records: {recipient_count}")

if recipient_count > 0:
    print("\nAll commission recipients:")
    for rec in CustomerOrderCommissionRecipient.objects.all():
        print(f"  Order ID: {rec.order_id}, Employee: {rec.employee}, Percentage: {rec.commission_percentage}%, Rate: {rec.commission_rate}%")

# Check orders with status 'bestaetigt'
confirmed_orders = CustomerOrder.objects.filter(status='bestaetigt')
print(f"\nTotal confirmed orders: {confirmed_orders.count()}")

if confirmed_orders.count() > 0:
    print("\nConfirmed orders:")
    for order in confirmed_orders[:5]:
        recipients = CustomerOrderCommissionRecipient.objects.filter(order=order)
        print(f"  Order ID: {order.id}, Customer: {order.customer}, Recipients: {recipients.count()}")

print("\n" + "=" * 60)
