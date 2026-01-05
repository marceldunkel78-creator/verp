# Generated manually for Marketing module

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def marketing_file_upload_path(instance, filename):
    return f'marketing/{instance.marketing_item.id}/{filename}'


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0012_alter_quotation_date_field'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('users', '__latest__'),
    ]

    operations = [
        migrations.CreateModel(
            name='MarketingItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(choices=[('newsletter', 'Newsletter'), ('appnote', 'AppNote'), ('technote', 'TechNote'), ('brochure', 'Broschüre'), ('show', 'Show'), ('workshop', 'Workshop')], max_length=50)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('event_date', models.DateTimeField(blank=True, null=True)),
                ('event_location', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='marketing_items_created', to=settings.AUTH_USER_MODEL)),
                ('responsible_employees', models.ManyToManyField(blank=True, related_name='marketing_items', to='users.employee')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='MarketingItemFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='marketing/')),
                ('filename', models.CharField(max_length=255)),
                ('file_size', models.IntegerField(default=0)),
                ('content_type', models.CharField(blank=True, max_length=100)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('marketing_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to='sales.marketingitem')),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-uploaded_at'],
            },
        ),
    ]
