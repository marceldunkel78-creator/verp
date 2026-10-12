from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service', '0038_rmacase_manufacturer_order_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='travelreportphoto',
            name='caption',
            field=models.TextField(blank=True, verbose_name='Bildkommentar'),
        ),
    ]
