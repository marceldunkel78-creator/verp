from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0008_order_order_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='management_info',
            field=models.JSONField(default=dict, blank=True, null=True, help_text='Warenfunktion, Auftrags-/Projekt-/Systemzuordnungen etc.', verbose_name='Management Info'),
        ),
    ]
