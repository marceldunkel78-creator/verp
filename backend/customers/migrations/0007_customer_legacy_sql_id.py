from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0006_add_contact_history'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='legacy_sql_id',
            field=models.IntegerField(
                blank=True,
                help_text='AdressenID aus der externen SQL-Datenbank für Synchronisation',
                null=True,
                unique=True,
                verbose_name='Legacy SQL ID',
            ),
        ),
    ]
