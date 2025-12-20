# Generated manually to populate Incoterms 2020

from django.db import migrations


def create_incoterms(apps, schema_editor):
    """Erstelle alle 11 Incoterms 2020"""
    DeliveryTerm = apps.get_model('verp_settings', 'DeliveryTerm')
    
    incoterms = [
        {
            'incoterm': 'EXW',
            'description': 'Ex Works - Ware wird ab Werk/Lager des Verkäufers übergeben. Käufer trägt alle Kosten und Risiken ab diesem Punkt.',
            'is_active': True
        },
        {
            'incoterm': 'FCA',
            'description': 'Free Carrier - Ware wird dem Frachtführer übergeben. Verkäufer trägt Kosten bis zur Übergabe.',
            'is_active': True
        },
        {
            'incoterm': 'CPT',
            'description': 'Carriage Paid To - Verkäufer trägt Frachtkosten bis zum Bestimmungsort, Risiko geht jedoch bei Übergabe an Frachtführer über.',
            'is_active': True
        },
        {
            'incoterm': 'CIP',
            'description': 'Carriage and Insurance Paid To - Wie CPT, aber Verkäufer schließt zusätzlich Transportversicherung ab.',
            'is_active': True
        },
        {
            'incoterm': 'DAP',
            'description': 'Delivered at Place - Ware wird am benannten Bestimmungsort bereitgestellt (nicht entladen). Verkäufer trägt alle Kosten und Risiken bis dahin.',
            'is_active': True
        },
        {
            'incoterm': 'DPU',
            'description': 'Delivered at Place Unloaded - Ware wird am Bestimmungsort entladen übergeben. Verkäufer trägt auch Entladungskosten.',
            'is_active': True
        },
        {
            'incoterm': 'DDP',
            'description': 'Delivered Duty Paid - Ware wird verzollt am Bestimmungsort übergeben. Verkäufer trägt alle Kosten inkl. Zoll.',
            'is_active': True
        },
        {
            'incoterm': 'FAS',
            'description': 'Free Alongside Ship - Ware wird längsseits des Schiffes im Verschiffungshafen übergeben. Nur für Seefracht.',
            'is_active': True
        },
        {
            'incoterm': 'FOB',
            'description': 'Free on Board - Ware wird an Bord des Schiffes übergeben. Verkäufer trägt Kosten und Risiken bis zur Verladung. Nur für Seefracht.',
            'is_active': True
        },
        {
            'incoterm': 'CFR',
            'description': 'Cost and Freight - Verkäufer trägt Kosten und Fracht bis zum Bestimmungshafen. Risiko geht bei Verladung über. Nur für Seefracht.',
            'is_active': True
        },
        {
            'incoterm': 'CIF',
            'description': 'Cost, Insurance and Freight - Wie CFR, aber Verkäufer schließt zusätzlich Transportversicherung ab. Nur für Seefracht.',
            'is_active': True
        }
    ]
    
    for incoterm_data in incoterms:
        DeliveryTerm.objects.get_or_create(
            incoterm=incoterm_data['incoterm'],
            defaults={
                'description': incoterm_data['description'],
                'is_active': incoterm_data['is_active']
            }
        )


def remove_incoterms(apps, schema_editor):
    """Entferne alle Incoterms"""
    DeliveryTerm = apps.get_model('verp_settings', 'DeliveryTerm')
    DeliveryTerm.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('verp_settings', '0004_deliveryinstruction_deliveryterm_paymentterm'),
    ]

    operations = [
        migrations.RunPython(create_incoterms, remove_incoterms),
    ]
