"""
Debug script to check commission data
"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from customer_orders.models import EmployeeCommission, CustomerOrder, CustomerOrderCommissionRecipient
from company.models import CompanySettings
from users.models import Employee
from datetime import date

print("=" * 60)
print("COMMISSION DEBUG REPORT")
print("=" * 60)

# Check Company Settings
settings = CompanySettings.get_settings()
print(f"\n1. COMPANY FISCAL YEAR SETTINGS:")
print(f"   Fiscal year starts: Month {settings.fiscal_year_start_month}, Day {settings.fiscal_year_start_day}")
print(f"   Current fiscal year: {settings.get_current_fiscal_year()}")
print(f"   Today: {date.today()}")

# Check EmployeeCommission records
print(f"\n2. EMPLOYEE COMMISSION RECORDS:")
commissions = EmployeeCommission.objects.all()
print(f"   Total commission records: {commissions.count()}")

if commissions.exists():
    print("\n   All commissions:")
    for c in commissions:
        print(f"   - Employee ID: {c.employee_id}, Employee: {c.employee}, Order: {c.customer_order_id}, Amount: {c.commission_amount}, FY: {c.fiscal_year}")

# Check CustomerOrderCommissionRecipient records
print(f"\n3. COMMISSION RECIPIENT RECORDS:")
recipients = CustomerOrderCommissionRecipient.objects.all()
print(f"   Total recipient records: {recipients.count()}")

if recipients.exists():
    print("\n   All recipients:")
    for r in recipients:
        print(f"   - Order ID: {r.customer_order_id}, Employee ID: {r.employee_id}, Employee: {r.employee}, Percentage: {r.commission_percentage}%")

# Check confirmed orders
print(f"\n4. CONFIRMED ORDERS:")
confirmed = CustomerOrder.objects.filter(status='bestaetigt')
print(f"   Total confirmed orders: {confirmed.count()}")

if confirmed.exists():
    for order in confirmed[:5]:
        recs = CustomerOrderCommissionRecipient.objects.filter(customer_order=order)
        comms = EmployeeCommission.objects.filter(customer_order=order)
        print(f"   - Order ID: {order.id}, Number: {order.order_number}, Net: {order.total_net}")
        print(f"     Recipients: {recs.count()}, Commissions: {comms.count()}")

# Check employees
print(f"\n5. EMPLOYEES:")
for emp in Employee.objects.all()[:10]:
    comm_count = EmployeeCommission.objects.filter(employee=emp).count()
    print(f"   - ID: {emp.id}, Name: {emp.first_name} {emp.last_name}, Commission Rate: {emp.commission_rate}%, Commissions: {comm_count}")

print("\n" + "=" * 60)
