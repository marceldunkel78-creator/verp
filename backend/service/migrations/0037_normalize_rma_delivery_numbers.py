from django.db import migrations


def normalize_delivery_numbers(apps, schema_editor):
    RMAReturn = apps.get_model('service', 'RMAReturn')
    RMAManufacturerReturn = apps.get_model('service', 'RMAManufacturerReturn')

    for model in (RMAReturn, RMAManufacturerReturn):
        for item in model.objects.filter(return_number__isnull=False):
            number = item.return_number or ''
            if number.startswith('RMA-A-'):
                item.return_number = number[4:]
                item.save(update_fields=['return_number'])
            elif number.startswith('RMA-H-'):
                item.return_number = number[4:]
                item.save(update_fields=['return_number'])


def reverse_normalize_delivery_numbers(apps, schema_editor):
    RMAReturn = apps.get_model('service', 'RMAReturn')
    RMAManufacturerReturn = apps.get_model('service', 'RMAManufacturerReturn')

    for item in RMAReturn.objects.filter(return_number__startswith='A-'):
        item.return_number = f'RMA-{item.return_number}'
        item.save(update_fields=['return_number'])

    for item in RMAManufacturerReturn.objects.filter(return_number__startswith='H-'):
        item.return_number = f'RMA-{item.return_number}'
        item.save(update_fields=['return_number'])


class Migration(migrations.Migration):
    dependencies = [
        ('service', '0036_alter_rmacase_warranty_status'),
    ]

    operations = [
        migrations.RunPython(normalize_delivery_numbers, reverse_normalize_delivery_numbers),
    ]
