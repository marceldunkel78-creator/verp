from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('service', '0016_travelreport_effort_and_work_times'),
        ('users', '0042_user_can_read_sales_sql_angebote_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='travelreport',
            name='executing_employee',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='executed_travel_reports',
                to='users.employee',
                verbose_name='Ausf\u00fchrender Mitarbeiter',
            ),
        ),
    ]
