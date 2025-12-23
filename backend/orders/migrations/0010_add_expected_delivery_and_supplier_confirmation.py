from django.db import migrations, models
import orders.models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0009_add_management_info'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='expected_delivery_date',
            field=models.DateField(blank=True, help_text='Voraussichtliches Lieferdatum laut Auftragsbestätigung', null=True, verbose_name='Voraussichtliches Lieferdatum'),
        ),
        migrations.AddField(
            model_name='order',
            name='supplier_confirmation_document',
            field=models.FileField(blank=True, help_text='Hochladen der Auftragsbestätigung des Lieferanten (PDF)', null=True, upload_to=orders.models.order_document_upload_path, verbose_name='Auftragsbestätigung (Lieferant)'),
        ),
    ]
