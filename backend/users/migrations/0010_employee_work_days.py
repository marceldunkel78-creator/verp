from django.db import migrations, models


def default_work_days():
    return ['mon', 'tue', 'wed', 'thu', 'fri']


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_employee_weekly_work_hours'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='work_days',
            field=models.JSONField(default=default_work_days, verbose_name='Arbeitstage'),
        ),
    ]
