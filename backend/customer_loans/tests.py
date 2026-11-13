from django.test import SimpleTestCase

from customers.models import Customer
from .serializers import CustomerLoanCreateUpdateSerializer


class CustomerLoanCustomerSelectionTests(SimpleTestCase):
    def test_inactive_customer_cannot_be_selected_for_new_loan(self):
        customer = Customer(id=1, first_name='Inactive', last_name='Customer', is_active=False)
        serializer = CustomerLoanCreateUpdateSerializer()

        with self.assertRaises(Exception) as raised:
            serializer.validate({'customer': customer, 'loan_date': '2026-11-13'})

        self.assertIn('customer', str(raised.exception))
