from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0042_user_can_read_sales_sql_angebote_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='reminder',
            name='checklist',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Liste von Unterpunkten, z.B. [{"text": "Punkt", "is_completed": false}]',
                verbose_name='Checkliste',
            ),
        ),
    ]
