import core.upload_paths
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('development', '0007_development_tickets'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DevelopmentTicketComment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('comment', models.TextField(verbose_name='Kommentar')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Erstellt am')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Aktualisiert am')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='development_ticket_comments', to=settings.AUTH_USER_MODEL, verbose_name='Erstellt von')),
                ('ticket', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='development.developmentticket', verbose_name='Entwicklungsticket')),
            ],
            options={'verbose_name': 'Ticket-Kommentar', 'verbose_name_plural': 'Ticket-Kommentare', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='DevelopmentTicketAttachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to=core.upload_paths.development_ticket_attachment_path, verbose_name='Datei')),
                ('filename', models.CharField(max_length=255, verbose_name='Dateiname')),
                ('file_size', models.IntegerField(blank=True, null=True, verbose_name='Dateigröße (Bytes)')),
                ('content_type', models.CharField(blank=True, max_length=100, verbose_name='Content-Type')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True, verbose_name='Hochgeladen am')),
                ('ticket', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='development.developmentticket', verbose_name='Entwicklungsticket')),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='development_ticket_uploads', to=settings.AUTH_USER_MODEL, verbose_name='Hochgeladen von')),
            ],
            options={'verbose_name': 'Ticket-Anhang', 'verbose_name_plural': 'Ticket-Anhänge', 'ordering': ['-uploaded_at']},
        ),
        migrations.AlterField(
            model_name='developmentprojecttimeentry',
            name='project',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='time_entries', to='development.developmentproject', verbose_name='Projekt'),
        ),
        migrations.AlterField(
            model_name='developmentprojecttimeentry',
            name='employee',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='dev_project_time_entries', to=settings.AUTH_USER_MODEL, verbose_name='Mitarbeiter'),
        ),
        migrations.AddField(
            model_name='developmentprojecttimeentry',
            name='ticket',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='time_entries', to='development.developmentticket', verbose_name='Entwicklungsticket'),
        ),
    ]
