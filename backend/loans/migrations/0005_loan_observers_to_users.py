from django.conf import settings
from django.db import migrations, models


def copy_employee_observers_to_users(apps, schema_editor):
    """
    Vorher war Loan.observers ein M2M auf users.Employee, jetzt auf auth.User.

    Das AlterField laeuft bewusst ZUERST: Django benennt in der
    Through-Tabelle nur die Spalte um (employee_id -> user_id), die
    enthaltenen Integer-IDs bleiben unveraendert erhalten. Sie koennen
    danach noch einmalig von Mitarbeiter-ID auf User-ID umgeschrieben
    werden - das ist eine reine Inhaltsmigration, kein Schemakonflikt.

    Mitarbeiter ohne aktiven Login werden verworfen: sie koennen per
    Definition keine Benachrichtigung empfangen.
    """
    Loan = apps.get_model('loans', 'Loan')
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Employee = apps.get_model('users', 'Employee')
    db_alias = schema_editor.connection.alias

    kept = 0
    dropped = 0

    for loan in Loan.objects.using(db_alias).prefetch_related('observers'):
        # die Werte sind jetzt noch die alten Mitarbeiter-IDs
        old_ids = list(loan.observers.values_list('id', flat=True))
        if not old_ids:
            continue

        employees = Employee.objects.using(db_alias).filter(id__in=old_ids)
        user_ids = list(
            User.objects.using(db_alias)
            .filter(employee__in=employees, is_active=True)
            .values_list('id', flat=True)
        )

        loan.observers.clear()
        if user_ids:
            loan.observers.set(user_ids)

        kept += len(user_ids)
        dropped += len(old_ids) - len(user_ids)

    if kept or dropped:
        print(
            'Loan-Beobachter umgestellt: '
            f'{kept} User uebernommen, {dropped} Legacy-Mitarbeiter ohne Login verworfen.'
        )


def clear_observers(apps, schema_editor):
    """
    Rueckwaertsrichtung: eine User-Zuordnung laesst sich nicht sinnvoll
    zurueck auf Mitarbeiter umrechnen, deshalb wird das Feld beim
    Rollback geleert statt geraten.
    """
    Loan = apps.get_model('loans', 'Loan')
    for loan in Loan.objects.using(schema_editor.connection.alias).all():
        loan.observers.clear()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('loans', '0004_add_responsible_employee_observers'),
    ]

    operations = [
        migrations.AlterField(
            model_name='loan',
            name='observers',
            field=models.ManyToManyField(
                blank=True,
                related_name='observed_loans',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Beobachter',
            ),
        ),
        migrations.RunPython(copy_employee_observers_to_users, clear_observers),
    ]
