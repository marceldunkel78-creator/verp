from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('service', '0035_repair_rma_document_columns'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rmacase',
            name='warranty_status',
            field=models.CharField(
                choices=[
                    ('unknown', 'Unbekannt'),
                    ('in_warranty', 'In Garantie'),
                    ('out_of_warranty', 'Außerhalb Garantie'),
                    ('extended_warranty', 'Erweiterte Garantie'),
                    ('dead_on_arrival', 'DeadOnArrival'),
                    ('goodwill', 'Kulanz'),
                ],
                default='unknown',
                max_length=20,
                verbose_name='Garantiestatus',
            ),
        ),
    ]