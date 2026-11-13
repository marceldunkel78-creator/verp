from datetime import date, time
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, TransactionTestCase

from development.models import DevelopmentProject, DevelopmentProjectTimeEntry, DevelopmentTicket


class DevelopmentTicketTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='development-time-test', password='test')
        self.project = DevelopmentProject.objects.create(name='Time entry project')
        self.ticket = DevelopmentTicket.objects.create(title='Ticket time test', project=self.project)

    def test_ticket_time_entry_is_included_in_project_total(self):
        entry = DevelopmentProjectTimeEntry.objects.create(
            project=self.project,
            ticket=self.ticket,
            date=date(2026, 11, 13),
            time=time(10, 30),
            employee=self.user,
            hours_spent=Decimal('1.50'),
            description='Ticket work',
            created_by=self.user,
        )

        self.assertEqual(self.project.time_entries.get(pk=entry.pk).hours_spent, Decimal('1.50'))
        self.assertEqual(self.ticket.time_entries.get(pk=entry.pk).project_id, self.project.pk)

    def test_time_entry_must_link_project_and_ticket_consistently(self):
        other_project = DevelopmentProject.objects.create(name='Different project')
        entry = DevelopmentProjectTimeEntry(
            project=other_project,
            ticket=self.ticket,
            date=date(2026, 11, 13),
            time=time(10, 30),
            hours_spent=Decimal('1.00'),
            description='Mismatched work',
        )

        with self.assertRaises(ValidationError):
            entry.save()

    def test_start_and_end_dates_transition_status(self):
        ticket = DevelopmentTicket.objects.create(title='Date transition test')
        ticket.start_date = date(2026, 11, 13)
        ticket.save()
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, 'in_progress')

        ticket.end_date = date(2026, 11, 20)
        ticket.save()
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, 'closed')


class DevelopmentTicketMigrationTests(TransactionTestCase):
    reset_sequences = True

    def test_todo_conversion_preserves_status_assignment_and_project(self):
        from django.db import connection
        from django.db.migrations.executor import MigrationExecutor

        executor = MigrationExecutor(connection)
        executor.migrate([('development', '0006_alter_developmentproject_project_start')])
        old_apps = executor.loader.project_state([('development', '0006_alter_developmentproject_project_start')]).apps
        Todo = old_apps.get_model('development', 'DevelopmentProjectTodo')
        Project = old_apps.get_model('development', 'DevelopmentProject')
        user_model = get_user_model()
        user = user_model.objects.create_user(username='migration-ticket-user', password='test')
        project = Project.objects.create(name='Migration test')
        project_id = project.pk
        Todo.objects.create(project_id=project_id, text='Open task', assigned_to_id=user.pk)
        Todo.objects.create(project_id=project_id, text='Completed task', is_completed=True, assigned_to_id=user.pk)

        executor = MigrationExecutor(connection)
        executor.migrate([('development', '0007_development_tickets')])
        ticket_apps = executor.loader.project_state([('development', '0007_development_tickets')]).apps
        Ticket = ticket_apps.get_model('development', 'DevelopmentTicket')
        migrated = {ticket.title: ticket for ticket in Ticket.objects.filter(project_id=project_id)}

        self.assertEqual(set(migrated), {'Open task', 'Completed task'})
        self.assertEqual(migrated['Open task'].status, 'new')
        self.assertEqual(migrated['Completed task'].status, 'closed')
        self.assertEqual(migrated['Open task'].assigned_to_id, user.pk)
        self.assertEqual(migrated['Completed task'].assigned_to_id, user.pk)
        self.assertEqual(migrated['Open task'].project_id, project_id)
