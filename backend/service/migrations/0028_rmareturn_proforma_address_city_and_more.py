import core.upload_paths
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('service', '0027_rmamanufacturerreturn_proforma_address_city_and_more'),
    ]

    # Die Spalten wurden bereits durch die zuvor verwendete, inzwischen
    # zurückgesetzte Migration in die Datenbank geschrieben. Deshalb werden
    # sie hier nur noch in den Django-Migrationszustand aufgenommen und nicht
    # erneut per ALTER TABLE angelegt.
    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
        migrations.AddField(
            model_name='rmareturn',
            name='proforma_address_city',
            field=models.CharField(blank=True, max_length=100, verbose_name='Proforma Stadt'),
        ),
        migrations.AddField(
            model_name='rmareturn',
            name='proforma_address_country',
            field=models.CharField(blank=True, max_length=100, verbose_name='Proforma Land'),
        ),
        migrations.AddField(
            model_name='rmareturn',
            name='proforma_address_house_number',
            field=models.CharField(blank=True, max_length=20, verbose_name='Proforma Hausnummer'),
        ),
        migrations.AddField(
            model_name='rmareturn',
            name='proforma_address_name',
            field=models.CharField(blank=True, max_length=200, verbose_name='Proforma Empfänger'),
        ),
        migrations.AddField(
            model_name='rmareturn',
            name='proforma_address_postal_code',
            field=models.CharField(blank=True, max_length=20, verbose_name='Proforma PLZ'),
        ),
        migrations.AddField(
            model_name='rmareturn',
            name='proforma_address_street',
            field=models.CharField(blank=True, max_length=200, verbose_name='Proforma Straße'),
        ),
        migrations.AddField(
            model_name='rmareturn',
            name='proforma_comment',
            field=models.TextField(blank=True, help_text='Wird im PDF unterhalb der Positionen angezeigt', verbose_name='Proforma-Invoice Kommentar'),
        ),
        migrations.AddField(
            model_name='rmareturn',
            name='proforma_pdf',
            field=models.FileField(blank=True, null=True, upload_to=core.upload_paths.rma_return_pdf_path, verbose_name='Proforma-Invoice PDF'),
        ),
        migrations.AddField(
            model_name='rmareturn',
            name='proforma_title',
            field=models.CharField(
                blank=True,
                default='Proforma Invoice – For Customs Purposes Only / No Commercial Value',
                max_length=200,
                verbose_name='Proforma-Invoice Titel',
            ),
        ),
            ],
        ),
    ]
