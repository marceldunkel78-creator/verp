from django.conf import settings
from django.db import migrations, models


def drop_orphan_observers(apps, schema_editor):
    """
    MUSS vor dem AlterField laufen.

    Das AlterField benennt in der Through-Tabelle nur die Spalte um
    (employee_id -> user_id); die Integer-IDs bleiben unveraendert. Postgres
    prueft den Fremdschluessel aber sofort, wenn die Spalte umbenannt wird -
    also bricht die Migration ab, sobald eine Mitarbeiter-ID ohne
    passende users_user-Zeile in der Tabelle steht (Produktion: user_id=13).

    Deshalb werden verwaiste Zeilen VOR dem Umbenennen entfernt. Sie sind
    ohnehin wertlos: ein Mitarbeiter ohne VERP-Login kann nicht
    benachrichtigt werden, genau das war das Problem hinter der Aenderung.
    """
    Loan = apps.get_model('loans', 'Loan')
    Employee = apps.get_model('users', 'Employee')
    db_alias = schema_editor.connection.alias

    loan_ids = list(Loan.objects.using(db_alias).values_list('id', flat=True))
    if not loan_ids:
        return

    # Mitarbeiter-IDs, die es in users_employee ueberhaupt gibt
    used_employee_ids = set(
        Employee.objects.using(db_alias).values_list('id', flat=True)
    )

    # ... und die tatsaechlich in der Through-Tabelle referenziert werden
    loan_ph = ', '.join(['%s'] * len(loan_ids))
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            f'SELECT DISTINCT employee_id FROM loans_loan_observers '
            f'WHERE loan_id IN ({loan_ph})',
            loan_ids,
        )
        referenced = {row[0] for row in cursor.fetchall()}

    orphaned = referenced - used_employee_ids
    if not orphaned:
        return

    orphan_ph = ', '.join(['%s'] * len(orphaned))
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            f'DELETE FROM loans_loan_observers '
            f'WHERE employee_id IN ({orphan_ph}) AND loan_id IN ({loan_ph})',
            [*sorted(orphaned), *loan_ids],
        )
        deleted = cursor.rowcount

    print(
        f'loans.0005: {deleted} verwaiste Beobachter-Zeilen entfernt '
        f'(Mitarbeiter-IDs ohne User: {sorted(orphaned)}). '
        'Diese Mitarbeiter haben keinen VERP-Login und konnten nie '
        'benachrichtigt werden.'
    )


def copy_employee_observers_to_users(apps, schema_editor):
    """
    Vorher war Loan.observers ein M2M auf users.Employee, jetzt auf auth.User.

    Laeuft NACH dem AlterField: die Spalte heisst jetzt user_id, enthaelt aber
    noch die alten Mitarbeiter-IDs. Diese werden hier einmalig auf echte
    User-IDs umgeschrieben.

    Mitarbeiter ohne aktiven Login werden verworfen: sie koennen per
    Definition keine Benachrichtigung empfangen.
    """
    Loan = apps.get_model('loans', 'Loan')
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Employee = apps.get_model('users', 'Employee')
    db_alias = schema_editor.connection.alias

    kept = 0
    dropped = 0

    # WICHTIG: die Werte roh per SQL lesen, nicht ueber den ORM.
    #
    # EinORM-Zugriff mit prefetch_related('observers') liefert den
    # Prefetch-Cache zurueck - also nur die Objekte, die es gerade noch
    # gibt. Nicht aufloesbare IDs fallen dadurch stillschweigend weg,
    # statt konvertiert zu werden. Genau das hat ein Test aufgedeckt:
    # Mitarbeiter 13 (User 24) waere dabei einfach verschwunden.
    loan_ids = list(Loan.objects.using(db_alias).values_list('id', flat=True))
    if not loan_ids:
        return

    loan_ph = ', '.join(['%s'] * len(loan_ids))
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            f'SELECT loan_id, user_id FROM loans_loan_observers '
            f'WHERE loan_id IN ({loan_ph})',
            loan_ids,
        )
        rows = cursor.fetchall()

    # Mitarbeiter-ID -> User-IDs (nur aktive Logins)
    employee_to_users = {}
    if rows:
        employee_ids = {r[1] for r in rows}
        emp_ph = ', '.join(['%s'] * len(employee_ids))
        for user in (User.objects.using(db_alias)
                     .filter(employee_id__in=employee_ids, is_active=True)
                     .values_list('employee_id', 'id')):
            employee_to_users.setdefault(user[0], []).append(user[1])

    # jede Zeile einzeln neu setzen
    rewritten = []
    for loan_id, old_id in rows:
        new_ids = employee_to_users.get(old_id, [])
        kept += len(new_ids)
        dropped += 0 if new_ids else 1
        rewritten.append((loan_id, new_ids))

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            f'DELETE FROM loans_loan_observers WHERE loan_id IN ({loan_ph})',
            loan_ids,
        )
        for loan_id, new_ids in rewritten:
            for new_id in new_ids:
                cursor.execute(
                    'INSERT INTO loans_loan_observers (loan_id, user_id) '
                    'VALUES (%s, %s)',
                    [loan_id, new_id],
                )

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
        migrations.RunPython(drop_orphan_observers, migrations.RunPython.noop),
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
