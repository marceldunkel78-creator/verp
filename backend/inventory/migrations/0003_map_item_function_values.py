from django.db import migrations


def forwards(apps, schema_editor):
    IncomingGoods = apps.get_model('inventory', 'IncomingGoods')
    InventoryItem = apps.get_model('inventory', 'InventoryItem')

    for Model in (IncomingGoods, InventoryItem):
        Model.objects.filter(item_function='STORAGE').update(item_function='ASSET')
        Model.objects.filter(item_function='MS').update(item_function='MATERIAL')


def reverse(apps, schema_editor):
    IncomingGoods = apps.get_model('inventory', 'IncomingGoods')
    InventoryItem = apps.get_model('inventory', 'InventoryItem')

    for Model in (IncomingGoods, InventoryItem):
        Model.objects.filter(item_function='ASSET').update(item_function='STORAGE')
        Model.objects.filter(item_function='MATERIAL').update(item_function='MS')


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_update_item_function_choices'),
    ]

    operations = [
        migrations.RunPython(forwards, reverse),
    ]
