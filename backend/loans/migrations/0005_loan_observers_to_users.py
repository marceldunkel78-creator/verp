from django.conf import settings
from django.db import migrations, models


def drop_orphan_observers(apps, schema_editor):
    """
    MUSS vor dem AlterField laufen.

    Das AlterField benennt in der Through-Tabelle nur die Spalte um
    (employee_id -> user_id); die Integer-IDs bleiben unveraendert. Postgres
    prueft den Fremdschluessel sofort, also bricht die Migration ab,
    sobald eine ID in der Tabelle steht, die es in users_user nicht gibt
    (Produktion: 13).

    Zwei verschiedene ID-Raeume muessen sauber getrennt werden:
      - loans_loan_observers.employee_id verweist auf users_employee.id
      - loans_loan_observers.user_id    verweist auf users_user.id

    Nach dem Rename wird employee_id als user_id gelesen. Verwaist ist
    deshalb eine Mitarbeiter-ID, fuer die es KEINEN aktiven User gibt -
    nicht eine ID, die es nicht in users_employee gibt (der Mitarbeiter
    existiert sehr wohl) und nicht eine, die es nicht in users_user.id
    gibt (User-IDs und Mitarbeiter-IDs sind unabhaengige Zaehler).

    Verwaiste Zeilen sind wertlos: ohne VERP-Login kann niemand
    benachrichtigt werden, das war ja das Problem hinter der Aenderung.
    """
    Employee = apps.get_model('users', 'Employee')
    User = apps.get_model(settings.AUTH_USER_MODEL)
    db_alias = schema_editor.connection.alias

    # Mitarbeiter-IDs, die in der Through-Tabelle referenziert werden
    with schema_editor.connection.cursor() as cursor:
        cursor.execute('SELECT DISTINCT employee_id FROM loans_loan_observers')
        referenced = {row[0] for row in cursor.fetchall()}

    if not referenced:
        return

    employees = Employee.objects.using(db_alias).filter(id__in=referenced)
    # Mitarbeiter, fuer die es mindestens einen aktiven Login gibt
    usable = set(
        User.objects.using(db_alias)
        .filter(employee_id__in=employees, is_active=True)
        .values_list('employee_id', flat=True)
    )
    # Mitarbeiter existieren, haben aber keinen aktiven Login
    existing = set(employees.values_list('id', flat=True))
    orphans_known = existing - usable
    orphans_unknown = referenced - existing

    orphaned = orphans_known | orphans_unknown
    if not orphaned:
        return

    orphan_ph = ', '.join(['%s'] * len(orphaned))
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            f'DELETE FROM loans_loan_observers WHERE employee_id IN ({orphan_ph})',
            sorted(orphaned),
        )
        deleted = cursor.rowcount

    detail = []
    if orphans_unknown:
        detail.append(f'{len(orphans_unknown)} unbekannte Mitarbeiter-ID(s)')
    if orphans_known:
        names = list(
            Employee.objects.using(db_alias)
            .filter(id__in=orphans_known)
            .values_list('id', 'first_name', 'last_name')[:20]
        )
        rendered = ', '.join(f'{i} {f} {l}'.strip() for i, f, l in names)
        detail.append(f'{len(orphans_known)} ohne aktiven Login ({rendered})')

    print(
        f'loans.0005: {deleted} verwaiste Beobachter-Zeilen entfernt: '
        + '; '.join(detail)
        + '. Diese Mitarbeiter koennen nie benachrichtigt werden.'
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
