from django.db import migrations, models
import decimal


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_user_employee'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='weekly_work_hours',
            field=models.DecimalField(default=decimal.Decimal('40.00'), max_digits=5, decimal_places=2, verbose_name='Wochenarbeitszeit (h)'),
            preserve_default=False,
        ),
    ]
