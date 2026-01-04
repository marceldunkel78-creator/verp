from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from datetime import date
from decimal import Decimal

from visiview.models import (
    VisiViewLicense, MaintenanceTimeCredit, MaintenanceTimeExpenditure, MaintenanceTimeCreditDeduction
)

User = get_user_model()


class MaintenanceTests(TestCase):
    def setUp(self):
        self.user = User.objects.filter(is_active=True).first() or User.objects.create_user('test', 'test@example.com')
        self.license = VisiViewLicense.objects.create(license_number='L-TEST', serial_number='S-TEST')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_expenditure_spans_multiple_credits_creates_deductions(self):
        c1 = MaintenanceTimeCredit.objects.create(
            license=self.license,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            credit_hours=Decimal('2.00'),
            remaining_hours=Decimal('2.00'),
            user=self.user,
            created_by=self.user
        )
        c2 = MaintenanceTimeCredit.objects.create(
            license=self.license,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 12, 31),
            credit_hours=Decimal('5.00'),
            remaining_hours=Decimal('5.00'),
            user=self.user,
            created_by=self.user
        )

        # Add expenditure of 3 hours -> should take 2 from c1 and 1 from c2
        payload = {
            'date': date.today().isoformat(),
            'time': '10:00',
            'user': self.user.id,
            'activity': 'email_support',
            'task_type': 'other',
            'hours_spent': '3.00',
            'comment': 'test'
        }
        resp = self.client.post(f'/api/visiview/licenses/{self.license.id}/add_time_expenditure/', payload, format='json')
        self.assertEqual(resp.status_code, 201)

        exp = MaintenanceTimeExpenditure.objects.get(id=resp.data['id'])
        self.assertEqual(exp.created_debt, Decimal('0'))

        deductions = MaintenanceTimeCreditDeduction.objects.filter(expenditure=exp)
        self.assertEqual(deductions.count(), 2)
        amounts = sorted([d.hours_deducted for d in deductions])
        self.assertEqual(amounts, [Decimal('1.00'), Decimal('2.00')])

        c1.refresh_from_db()
        c2.refresh_from_db()
        self.assertEqual(c1.remaining_hours, Decimal('0'))
        self.assertEqual(c2.remaining_hours, Decimal('4.00'))

    def test_delete_credit_transfers_deductions_to_debt(self):
        # Create credit and expenditure that consumes part of it
        c = MaintenanceTimeCredit.objects.create(
            license=self.license,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            credit_hours=Decimal('5.00'),
            remaining_hours=Decimal('5.00'),
            user=self.user,
            created_by=self.user
        )
        # Expenditure of 3 hours -> deduction 3 from credit
        payload = {
            'date': date.today().isoformat(),
            'time': '11:00',
            'user': self.user.id,
            'activity': 'email_support',
            'task_type': 'other',
            'hours_spent': '3.00',
            'comment': 'test'
        }
        resp = self.client.post(f'/api/visiview/licenses/{self.license.id}/add_time_expenditure/', payload, format='json')
        self.assertEqual(resp.status_code, 201)
        exp_id = resp.data['id']

        # Confirm deduction exists
        deductions = MaintenanceTimeCreditDeduction.objects.filter(credit=c)
        self.assertEqual(deductions.count(), 1)
        self.assertEqual(deductions.first().hours_deducted, Decimal('3.00'))

        # Delete the credit via API
        resp2 = self.client.delete(f'/api/visiview/licenses/{self.license.id}/delete_time_credit/{c.id}/')
        self.assertEqual(resp2.status_code, 204)

        # Reload expenditure and verify created_debt increased by 3.00
        from visiview.models import MaintenanceTimeExpenditure
        exp = MaintenanceTimeExpenditure.objects.get(id=exp_id)
        self.assertEqual(exp.created_debt, Decimal('3.00'))

        # Deductions for that credit should be removed
        self.assertFalse(MaintenanceTimeCreditDeduction.objects.filter(credit=c).exists())
