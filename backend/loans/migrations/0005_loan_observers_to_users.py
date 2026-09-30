from django.conf import settings
from django.db import migrations, models


def drop_old_employee_fk(apps, schema_editor):
    """
    MUSS vor dem Umschreiben laufen.

    In der Through-Tabelle liegt noch ein Fremdschluessel
    loans_loan_observers_employee_id -> users_employee.id. Sobald dort
    eine User-ID steht, verletzt diese Zeile den Constraint und Django
    bricht mit folgendem Fehler ab:

      Key (employee_id)=(6) is not present in table "users_employee"

    Genau das ist in der Produktion nach dem Umschreiben passiert: das
    Umschreiben selbst war korrekt, aber der alte Constraint hat die
    neuen Werte abgewiesen.

    Deshalb wird der Constraint hier zuerst entfernt. Das AlterField
    legt danach den passenden Constraint auf users_user an - es ist also
    am Ende wieder alles sauber referenziert.
    """
    db_alias = schema_editor.connection.alias

    # Alle Fremdschluessel der Through-Tabelle, die auf users_employee
    # zeigen. Name und Ziel werden nicht hart verdrahtet, weil Postgres
    # den Suffix aus Tabellennamen bildet.
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT con.conname, rel.relname "
            "FROM pg_constraint con "
            "JOIN pg_class rel ON rel.oid = con.conrelid "
            "JOIN pg_class tgt ON tgt.oid = con.confrelid "
            "WHERE rel.relname = %s AND con.contype = 'f' "
            "AND tgt.relname = %s",
            ['loans_loan_observers', 'users_employee'],
        )
        constraints = cursor.fetchall()

    for name, _target in constraints:
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                f'ALTER TABLE loans_loan_observers DROP CONSTRAINT "{name}"'
            )
        print(f'loans.0005: Fremdschluessel {name} entfernt '
              '(zeigt noch auf users_employee)')


def remap_employee_ids_to_user_ids(apps, schema_editor):
    """
    Hier passiert die eigentliche Umwandlung - solange die Spalte noch
    employee_id heisst.

    Das AlterField benennt nur die Spalte um (employee_id -> user_id); die
    Zahlen bleiben unveraendert stehen. Postgres prueft den Fremdschluessel
    dann sofort. Deshalb werden die IDs vorher auf echte User-IDs
    umgeschrieben - das AlterField kann danach nicht mehr scheitern.

    Warum das nicht vorher funktioniert hat: Mitarbeiter-IDs und
    User-IDs sind unabhaengige Autoincrement-Zaehler. Andreas Babaryka
    ist Mitarbeiter 13, sein User ist aber 24, und eine User-ID 13 gibt
    es in der Produktion gar nicht. Ein Beobachter employee_id=13 wurde
    beim blossen Umbenennen zu user_id=13 - und der FK lehnte ab.

    Verworfen wird nur, was ohnehin tot ist: ein Mitarbeiter ohne
    aktiven Login kann nie benachrichtigt werden.
    """
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Employee = apps.get_model('users', 'Employee')
    db_alias = schema_editor.connection.alias

    with schema_editor.connection.cursor() as cursor:
        cursor.execute('SELECT id, employee_id FROM loans_loan_observers ORDER BY id')
        rows = cursor.fetchall()

    if not rows:
        print('loans.0005: keine Beobachter vorhanden, nichts zu tun.')
        return

    employee_ids = {r[1] for r in rows}

    # Mitarbeiter-ID -> User-IDs (nur aktive Logins)
    employee_to_users = {}
    for emp_id, user_id in (
        User.objects.using(db_alias)
        .filter(employee_id__in=employee_ids, is_active=True)
        .values_list('employee_id', 'id')
    ):
        employee_to_users.setdefault(emp_id, []).append(user_id)

    existing = set(
        Employee.objects.using(db_alias)
        .filter(id__in=employee_ids)
        .values_list('id', flat=True)
    )
    no_login = existing - set(employee_to_users)
    unknown = employee_ids - existing

    kept = 0
    dropped = 0
    updates = []
    deletes = []

    for row_id, emp_id in rows:
        user_ids = employee_to_users.get(emp_id)
        if not user_ids:
            deletes.append(row_id)
            dropped += 1
            continue
        # Ein Mitarbeiter kann 0..n User haben. Als Beobachter wird der
        # erste genommen - praktisch ist es hoechstens einer.
        updates.append((user_ids[0], row_id))
        kept += 1

    with schema_editor.connection.cursor() as cursor:
        if deletes:
            cursor.execute(
                f'DELETE FROM loans_loan_observers '
                f'WHERE id IN ({", ".join(["%s"] * len(deletes))})',
                deletes,
            )
        for user_id, row_id in updates:
            cursor.execute(
                'UPDATE loans_loan_observers SET employee_id = %s WHERE id = %s',
                [user_id, row_id],
            )

    detail = []
    if unknown:
        detail.append(f'{len(unknown)} unbekannte Mitarbeiter-ID(s) {sorted(unknown)}')
    if no_login:
        names = list(
            Employee.objects.using(db_alias)
            .filter(id__in=no_login)
            .values_list('id', 'first_name', 'last_name')
        )
        rendered = ', '.join(f'{i} {f} {l}'.strip() for i, f, l in names[:20])
        detail.append(f'{len(no_login)} ohne aktiven Login ({rendered})')
    if detail:
        print('loans.0005 - verworfen: ' + '; '.join(detail))
    print(f'loans.0005: {kept} Beobachter auf User-IDs umgeschrieben, '
          f'{dropped} Zeilen entfernt.')


def recreate_constraints(apps, schema_editor):
    """
    Nach dem AlterField wiederherstellen.

    Django entfernt beim Aendern eines M2M-Feldes die Fremdschluessel der
    Through-Tabelle. Im Test liess es beide weg - auch den auf loans_loan,
    der gar nichts mit dieser Aenderung zu tun hat. Ohne FK kann eine
    Beobachter-Zeile auf einen geloeschten Loan oder User zeigen.

    Deshalb werden beide Constraints hier ausdruecklich gesetzt, falls sie
    fehlen. Idempotent: existieren sie schon, wird nichts getan.
    """
    db_alias = schema_editor.connection.alias

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT conname, tgt.relname "
            "FROM pg_constraint con "
            "JOIN pg_class rel ON rel.oid = con.conrelid "
            "JOIN pg_class tgt ON tgt.oid = con.confrelid "
            "WHERE rel.relname = 'loans_loan_observers' AND con.contype = 'f'",
        )
        existing = {t for _n, t in cursor.fetchall()}

    if 'loans_loan' not in existing:
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                'ALTER TABLE loans_loan_observers '
                'ADD CONSTRAINT loans_loan_observers_loan_id_fk '
                'FOREIGN KEY (loan_id) REFERENCES loans_loan(id) ON DELETE CASCADE'
            )
        print('loans.0005: Fremdschluessel auf loans_loan wiederhergestellt')

    if 'users_user' not in existing:
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                'ALTER TABLE loans_loan_observers '
                'ADD CONSTRAINT loans_loan_observers_user_id_fk '
                'FOREIGN KEY (user_id) REFERENCES users_user(id) ON DELETE CASCADE'
            )
        print('loans.0005: Fremdschluessel auf users_user wiederhergestellt')


def copy_employee_observers_to_users(apps, schema_editor):
    """
    Nach dem AlterField.

    Die Spalte heisst jetzt user_id, die Inhalte sind aber bereits in
    remap_employee_ids_to_user_ids umgeschrieben worden. Diese Stufe
    entdoppelt nur noch und stellt sicher, dass keine ungueltigen IDs
    zurueckbleiben.
    """
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Loan = apps.get_model('loans', 'Loan')
    db_alias = schema_editor.connection.alias

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            'SELECT l.id, o.user_id '
            'FROM loans_loan_observers o '
            'JOIN loans_loan l ON l.id = o.loan_id '
            'WHERE o.user_id IS NOT NULL'
        )
        rows = cursor.fetchall()

    if not rows:
        return

    valid_user_ids = set(
        User.objects.using(db_alias).filter(is_active=True).values_list('id', flat=True)
    )

    dangling = sorted({r[1] for r in rows} - valid_user_ids)
    if dangling:
        # Sollte nach dem Remap nicht mehr vorkommen. Wenn doch, ist es
        # ein Fehler im Ablauf und wird nicht stillschweigend uebergangen.
        raise RuntimeError(
            f'loans.0005: nach dem Umstellen sind weiterhin ungueltige '
            f'user_id-Werte vorhanden: {dangling}. Abbruch, damit keine '
            'falschen Beobachter entstehen.'
        )

    # (loan_id, user_id) doppelte Zeilen entfernen
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            'DELETE FROM loans_loan_observers a '
            'USING loans_loan_observers b '
            'WHERE a.loan_id = b.loan_id AND a.user_id = b.user_id '
            'AND a.id > b.id'
        )
        removed = cursor.rowcount

    if removed:
        print(f'loans.0005: {removed} doppelte Beobachter-Zeilen entfernt.')


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
        migrations.RunPython(drop_old_employee_fk, migrations.RunPython.noop),
        migrations.RunPython(remap_employee_ids_to_user_ids, migrations.RunPython.noop),
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
        migrations.RunPython(recreate_constraints, migrations.RunPython.noop),
    ]
