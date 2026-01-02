# Generated migration to add DIENSTLEISTUNG category

from django.db import migrations

def add_dienstleistung_category(apps, schema_editor):
    ProductCategory = apps.get_model('verp_settings', 'ProductCategory')
    
    # Check if DIENSTLEISTUNG already exists
    if not ProductCategory.objects.filter(code='DIENSTLEISTUNG').exists():
        ProductCategory.objects.create(
            code='DIENSTLEISTUNG',
            name='Dienstleistung',
            description='Service und Dienstleistungen',
            applies_to_trading_goods=True,
            applies_to_material_supplies=True,
            applies_to_vs_hardware=True,
            applies_to_vs_software=True,
            applies_to_vs_service=True,
            requires_serial_number=False,
            is_active=True,
            sort_order=999
        )

def remove_dienstleistung_category(apps, schema_editor):
    ProductCategory = apps.get_model('verp_settings', 'ProductCategory')
    ProductCategory.objects.filter(code='DIENSTLEISTUNG').delete()

class Migration(migrations.Migration):

    dependencies = [
        ('verp_settings', '0007_warrantyterm'),
    ]

    operations = [
        migrations.RunPython(add_dienstleistung_category, remove_dienstleistung_category),
    ]
