from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('dealers', '0001_initial'),
        ('suppliers', '0001_initial'),
        ('customer_loans', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customerloan',
            name='customer',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='customer_loans', to='customers.customer', verbose_name='Kunde'),
        ),
        migrations.AddField(
            model_name='customerloan',
            name='supplier_contact',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='customer_loans_as_recipient', to='suppliers.suppliercontact', verbose_name='Lieferantenmitarbeiter als Empfänger'),
        ),
        migrations.AddField(
            model_name='customerloan',
            name='distributor_employee',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='customer_loans_as_recipient', to='dealers.dealeremployee', verbose_name='Distributormitarbeiter als Empfänger'),
        ),
    ]