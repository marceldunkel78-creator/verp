from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='incominggoods',
            name='item_function',
            field=models.CharField(choices=[('TRADING_GOOD', 'Handelsware'), ('ASSET', 'Asset'), ('MATERIAL', 'Material')], default='TRADING_GOOD', max_length=20, verbose_name='Warenfunktion'),
        ),
        migrations.AlterField(
            model_name='incominggoods',
            name='serial_number',
            field=models.CharField(blank=True, help_text='Für Handelsware und Asset erforderlich; nicht für Material-Kategorien', max_length=100, verbose_name='Seriennummer'),
        ),
        migrations.AlterField(
            model_name='inventoryitem',
            name='item_function',
            field=models.CharField(choices=[('TRADING_GOOD', 'Handelsware'), ('ASSET', 'Asset'), ('MATERIAL', 'Material')], max_length=20, verbose_name='Warenfunktion'),
        ),
        migrations.AlterField(
            model_name='inventoryitem',
            name='serial_number',
            field=models.CharField(blank=True, help_text='Für einzelne Instanzen (Handelsware, Asset)', max_length=100, verbose_name='Seriennummer'),
        ),
    ]
