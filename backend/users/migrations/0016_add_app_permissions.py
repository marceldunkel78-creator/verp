from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0015_vacationrequest_end_half_vacationrequest_start_half'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='can_read_sales',
            field=models.BooleanField(default=False, verbose_name='Sales - Lesen'),
        ),
        migrations.AddField(
            model_name='user',
            name='can_read_trading',
            field=models.BooleanField(default=False, verbose_name='Handelsware - Lesen'),
        ),
        migrations.AddField(
            model_name='user',
            name='can_read_material_supplies',
            field=models.BooleanField(default=False, verbose_name='Material & Supplies - Lesen'),
        ),
        migrations.AddField(
            model_name='user',
            name='can_read_assets',
            field=models.BooleanField(default=False, verbose_name='Assets - Lesen'),
        ),
        migrations.AddField(
            model_name='user',
            name='can_write_sales',
            field=models.BooleanField(default=False, verbose_name='Sales - Schreiben'),
        ),
        migrations.AddField(
            model_name='user',
            name='can_write_trading',
            field=models.BooleanField(default=False, verbose_name='Handelsware - Schreiben'),
        ),
        migrations.AddField(
            model_name='user',
            name='can_write_material_supplies',
            field=models.BooleanField(default=False, verbose_name='Material & Supplies - Schreiben'),
        ),
        migrations.AddField(
            model_name='user',
            name='can_write_assets',
            field=models.BooleanField(default=False, verbose_name='Assets - Schreiben'),
        ),
    ]
