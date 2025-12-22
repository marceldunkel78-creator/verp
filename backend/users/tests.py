from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from .models import Employee
import json

User = get_user_model()


class EmployeeMeAPITest(TestCase):
    def setUp(self):
        # create a normal user and an employee record
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='pass')
        self.employee = Employee.objects.create(
            first_name='Test', last_name='User', work_email='test@example.com', annual_vacation_days=30, vacation_balance=30.0
        )
        self.user.employee = self.employee
        self.user.save()
        self.client = Client()

    def test_me_endpoint_returns_employee(self):
        self.client.login(username='testuser', password='pass')
        resp = self.client.get('/users/employees/me/')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        # expect at least vacation_balance to be present
        self.assertIn('vacation_balance', data)
        self.assertEqual(float(data['vacation_balance']), 30.0)


class CancelVacationTest(TestCase):
    def setUp(self):
        # admin user
        self.admin = User.objects.create_user(username='admin', email='admin@example.com', password='adminpass', is_staff=True)
        # normal user + employee
        self.user = User.objects.create_user(username='emp', email='emp@example.com', password='pass')
        self.employee = Employee.objects.create(first_name='Emp', last_name='User', work_email='emp@example.com', annual_vacation_days=20, vacation_balance=15.0)
        self.user.employee = self.employee
        self.user.save()
        # create an approved vacation request that consumed 3 days
        from .models import VacationRequest
        self.request = VacationRequest.objects.create(user=self.user, start_date='2025-12-01', end_date='2025-12-03', days_requested=3.0, status='approved')
        # simulate balance already deducted
        self.employee.vacation_balance = 12.0
        self.employee.save()
        self.client = Client()

    def test_admin_can_cancel_and_restore_days(self):
        # login as admin
        self.client.login(username='admin', password='adminpass')
        resp = self.client.patch(f'/users/vacation-requests/{self.request.id}/', {'status': 'cancelled'}, content_type='application/json')
        self.assertIn(resp.status_code, [200, 204])
        self.request.refresh_from_db()
        self.employee.refresh_from_db()
        self.assertEqual(self.request.status, 'cancelled')
        # balance should be restored by 3.0
        self.assertAlmostEqual(float(self.employee.vacation_balance), 15.0, places=3)

    def test_admin_can_delete_cancelled_and_rejected(self):
        # create cancelled and rejected
        from .models import VacationRequest
        cancelled = VacationRequest.objects.create(user=self.user, start_date='2025-11-01', end_date='2025-11-02', days_requested=2.0, status='cancelled')
        rejected = VacationRequest.objects.create(user=self.user, start_date='2025-10-01', end_date='2025-10-02', days_requested=2.0, status='rejected')
        # login as admin
        self.client.login(username='admin', password='adminpass')
        resp1 = self.client.delete(f'/users/vacation-requests/{cancelled.id}/')
        self.assertIn(resp1.status_code, [200, 204])
        self.assertFalse(VacationRequest.objects.filter(id=cancelled.id).exists())
        resp2 = self.client.delete(f'/users/vacation-requests/{rejected.id}/')
        self.assertIn(resp2.status_code, [200, 204])
        self.assertFalse(VacationRequest.objects.filter(id=rejected.id).exists())
