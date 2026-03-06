from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service', '0014_add_redmine_sync_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='travelreport',
            name='pdf_file',
            field=models.FileField(blank=True, null=True, upload_to='Reiseberichte-Serviceberichte/', verbose_name='PDF-Datei'),
        ),
    ]
