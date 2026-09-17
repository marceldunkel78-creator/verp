from django.db import migrations


def add_aurox_option(apps, schema_editor):
    VisiViewOption = apps.get_model('visiview', 'VisiViewOption')
    VisiViewOption.objects.update_or_create(
        bit_position=47,
        defaults={
            'name': 'Aurox',
            'price': 0,
            'description': 'VisiView OptionID 48',
            'is_active': True,
        },
    )


def remove_aurox_option(apps, schema_editor):
    VisiViewOption = apps.get_model('visiview', 'VisiViewOption')
    VisiViewOption.objects.filter(bit_position=47, name='Aurox').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('visiview', '0022_add_ultrafrap_option'),
    ]

    operations = [
        migrations.RunPython(add_aurox_option, remove_aurox_option),
    ]