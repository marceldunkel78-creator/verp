from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('service', '0028_rmareturn_proforma_address_city_and_more'),
    ]

    # Diese Spalten wurden bereits durch die zurückgesetzte Migration in der
    # Datenbank angelegt. Nur der Django-State wird rekonstruiert.
    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name='rmareturnitem',
                    name='custom_article_number',
                    field=models.CharField(blank=True, default='', max_length=100),
                ),
                migrations.AddField(
                    model_name='rmareturnitem',
                    name='custom_product_name',
                    field=models.CharField(blank=True, default='', max_length=300),
                ),
                migrations.AddField(
                    model_name='rmareturnitem',
                    name='custom_serial_number',
                    field=models.CharField(blank=True, default='', max_length=200),
                ),
                migrations.AddField(
                    model_name='rmareturnitem',
                    name='custom_unit',
                    field=models.CharField(blank=True, default='Stk', max_length=50),
                ),
                migrations.AddField(
                    model_name='rmareturnitem',
                    name='proforma_description',
                    field=models.CharField(blank=True, default='', max_length=300),
                ),
                migrations.AddField(
                    model_name='rmareturnitem',
                    name='proforma_hs_code',
                    field=models.CharField(blank=True, default='', max_length=20),
                ),
                migrations.AddField(
                    model_name='rmareturnitem',
                    name='proforma_origin_country',
                    field=models.CharField(blank=True, default='', max_length=100),
                ),
                migrations.AddField(
                    model_name='rmareturnitem',
                    name='proforma_value',
                    field=models.DecimalField(blank=True, max_digits=12, decimal_places=2, null=True),
                ),
                migrations.AddField(
                    model_name='rmareturnitem',
                    name='proforma_weight',
                    field=models.DecimalField(blank=True, max_digits=10, decimal_places=3, null=True),
                ),
            ],
        ),
    ]
