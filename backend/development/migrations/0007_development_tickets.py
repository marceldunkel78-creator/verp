import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def convert_todos_to_tickets(apps, schema_editor):
    Todo = apps.get_model('development', 'DevelopmentProjectTodo')
    Ticket = apps.get_model('development', 'DevelopmentTicket')
    existing = Ticket.objects.exclude(ticket_number__isnull=True).values_list('ticket_number', flat=True)
    numbers = [int(number.split('-')[-1]) for number in existing if number.startswith('DT-') and number.split('-')[-1].isdigit()]
    next_number = max(numbers, default=0) + 1

    for todo in Todo.objects.order_by('id').iterator():
        text = todo.text or ''
        Ticket.objects.create(
            ticket_number=f'DT-{next_number:05d}',
            title=text[:200] or 'Aufgabe',
            description=text if len(text) > 200 else '',
            status='closed' if todo.is_completed else 'new',
            priority='normal',
            project_id=todo.project_id,
            assigned_to_id=todo.assigned_to_id,
            created_by_id=todo.created_by_id,
            created_at=todo.created_at,
            updated_at=todo.updated_at,
        )
        next_number += 1


class Migration(migrations.Migration):
    dependencies = [
        ('development', '0006_alter_developmentproject_project_start'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DevelopmentTicket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ticket_number', models.CharField(blank=True, editable=False, max_length=15, null=True, unique=True, verbose_name='Ticketnummer')),
                ('title', models.CharField(max_length=200, verbose_name='Titel')),
                ('description', models.TextField(blank=True, verbose_name='Beschreibung')),
                ('category', models.CharField(blank=True, choices=[('optics', 'Optik'), ('electronics', 'Elektronik')], max_length=20, verbose_name='Kategorie')),
                ('status', models.CharField(choices=[('new', 'Neu'), ('in_progress', 'Bearbeitung'), ('closed', 'Geschlossen')], default='new', max_length=20, verbose_name='Status')),
                ('priority', models.CharField(choices=[('low', 'Niedrig'), ('normal', 'Normal'), ('high', 'Hoch'), ('urgent', 'Dringend')], default='normal', max_length=20, verbose_name='Priorität')),
                ('start_date', models.DateField(blank=True, null=True, verbose_name='Bearbeitungsbeginn')),
                ('end_date', models.DateField(blank=True, null=True, verbose_name='Abgabe')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_development_tickets', to=settings.AUTH_USER_MODEL, verbose_name='Zuständig')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_development_tickets', to=settings.AUTH_USER_MODEL, verbose_name='Erstellt von')),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tickets', to='development.developmentproject', verbose_name='Entwicklungsprojekt')),
            ],
            options={'verbose_name': 'Entwicklungsticket', 'verbose_name_plural': 'Entwicklungstickets', 'ordering': ['-updated_at']},
        ),
        migrations.RunPython(convert_todos_to_tickets, migrations.RunPython.noop),
        migrations.DeleteModel(name='DevelopmentProjectTodo'),
    ]
