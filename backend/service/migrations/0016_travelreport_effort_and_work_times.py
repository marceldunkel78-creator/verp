from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service', '0015_travelreport_pdf_file'),
    ]

    operations = [
        migrations.AddField(
            model_name='travelreport',
            name='travel_effort_hours',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=6,
                null=True,
                verbose_name='Zeitaufwand An-/Abfahrt (Stunden)',
            ),
        ),
        migrations.AddField(
            model_name='travelreport',
            name='work_effort_hours',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=6,
                null=True,
                verbose_name='Arbeitszeitaufwand (Stunden)',
            ),
        ),
        migrations.AddField(
            model_name='travelreport',
            name='work_end_time',
            field=models.TimeField(blank=True, null=True, verbose_name='Ende der Arbeiten'),
        ),
        migrations.AddField(
            model_name='travelreport',
            name='work_start_time',
            field=models.TimeField(blank=True, null=True, verbose_name='Beginn der Arbeiten'),
        ),
    ]
