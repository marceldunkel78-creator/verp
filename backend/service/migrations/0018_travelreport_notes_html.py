from django.db import migrations, models
from django.utils.html import escape


def plain_to_html(apps, schema_editor):
    """
    Migration: Bestehende Plain-Text-Notizen in HTML umhüllen,
    damit der Editor sie als formatierte Notizen anzeigen kann.
    Der ursprüngliche Text-Inhalt bleibt erhalten.
    """
    TravelReport = apps.get_model('service', 'TravelReport')
    for report in TravelReport.objects.all():
        plain = (report.notes or '').strip()
        if plain and not (report.notes_html or '').strip():
            escaped = (
                plain.replace('&', '&amp;')
                     .replace('<', '&lt;')
                     .replace('>', '&gt;')
                     .replace('\n', '<br/>')
            )
            report.notes_html = f'<p>{escaped}</p>'
            report.save(update_fields=['notes_html'])


def html_to_plain(apps, schema_editor):
    """
    Rollback: HTML wieder in Plain-Text zurückführen.
    """
    TravelReport = apps.get_model('service', 'TravelReport')
    for report in TravelReport.objects.all():
        html = (report.notes_html or '').strip()
        if html:
            # Tags strippen, Block-Tags -> Zeilenumbruch
            import re
            text = re.sub(r'<\s*br\s*/?>', '\n', html, flags=re.IGNORECASE)
            text = re.sub(r'</\s*(p|li|h[1-6])\s*>', '\n', text, flags=re.IGNORECASE)
            text = re.sub(r'<[^>]+>', '', text)
            text = (text.replace('&nbsp;', ' ')
                        .replace('&amp;', '&')
                        .replace('&lt;', '<')
                        .replace('&gt;', '>')
                        .replace('&quot;', '"')
                        .replace('&#39;', "'"))
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            report.notes = '\n'.join(lines)
            report.save(update_fields=['notes'])


class Migration(migrations.Migration):

    dependencies = [
        ('service', '0017_travelreport_executing_employee'),
    ]

    operations = [
        migrations.AddField(
            model_name='travelreport',
            name='notes_html',
            field=models.TextField(
                blank=True,
                default='',
                verbose_name='Notizen (Rich-Text / HTML)',
                help_text='Formatierte Notizen aus dem Editor (Tiptap). Wird serverseitig bereinigt.',
            ),
        ),
        migrations.AlterField(
            model_name='travelreport',
            name='notes',
            field=models.TextField(
                blank=True,
                verbose_name='Notizen (Plain-Text, Legacy)',
                help_text='Wird automatisch aus notes_html abgeleitet; bleibt als Plain-Text-Backup erhalten.',
            ),
        ),
        migrations.RunPython(plain_to_html, html_to_plain),
    ]