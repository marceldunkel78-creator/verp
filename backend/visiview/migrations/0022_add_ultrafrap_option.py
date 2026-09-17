from django.db import migrations


def add_ultrafrap_option(apps, schema_editor):
    VisiViewOption = apps.get_model('visiview', 'VisiViewOption')
    VisiViewOption.objects.update_or_create(
        bit_position=49,
        defaults={
            'name': 'UltraFRAP',
            'price': 0,
            'description': 'VisiView OptionID 50',
            'is_active': True,
        },
    )


def remove_ultrafrap_option(apps, schema_editor):
    VisiViewOption = apps.get_model('visiview', 'VisiViewOption')
    VisiViewOption.objects.filter(bit_position=49, name='UltraFRAP').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('visiview', '0021_alter_visiviewlicense_distributor_legacy'),
    ]

    operations = [
        migrations.RunPython(add_ultrafrap_option, remove_ultrafrap_option),
    ]