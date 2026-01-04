from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from datetime import date
from decimal import Decimal

from visiview.models import (
    VisiViewLicense, MaintenanceTimeCredit, MaintenanceTimeExpenditure, MaintenanceTimeCreditDeduction
)

User = get_user_model()


class DeleteCreditResidualTest(TestCase):
    def setUp(self):
        self.user = User.objects.filter(is_active=True).first() or User.objects.create_user('test2', 'test2@example.com')
        self.license = VisiViewLicense.objects.create(license_number='L-RES', serial_number='S-RES')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_add_credit_then_delete_returns_original_debt(self):
        # Create an expenditure with 2h debt (no initial credits)
        payload = {
            'date': date.today().isoformat(),
            'time': '09:00',
            'user': self.user.id,
            'activity': 'email_support',
            'task_type': 'other',
            'hours_spent': '2.00',
            'comment': 'initial debt'
        }
        resp = self.client.post(f'/api/visiview/licenses/{self.license.id}/add_time_expenditure/', payload, format='json')
        self.assertEqual(resp.status_code, 201)
        exp_id = resp.data['id']

        # Add a credit of 3h (should cover the 2h debt and leave 1h remaining)
        credit_payload = {'start_date': date.today().isoformat(), 'end_date': (date.today()).isoformat(), 'user': self.user.id, 'credit_hours': '3.00'}
        resp2 = self.client.post(f'/api/visiview/licenses/{self.license.id}/add_time_credit/', credit_payload, format='json')
        self.assertEqual(resp2.status_code, 201)
        credit_id = resp2.data['id']

        # Delete the credit
        resp3 = self.client.delete(f'/api/visiview/licenses/{self.license.id}/delete_time_credit/{credit_id}/')
        self.assertEqual(resp3.status_code, 204)

        # The expenditure should have created_debt == 2.00 (original debt), not 4.00
        exp = MaintenanceTimeExpenditure.objects.get(id=exp_id)
        self.assertEqual(exp.created_debt, Decimal('2.00'))
