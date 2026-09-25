"""
Zentrale Änderungsprotokoll-Helfer für das Demo-Systeme-Modul.
Alle Mutations-Endpunkte protokollieren hierüber in DemoChangeLog.
"""
from .models import DemoChangeLog


def _stringify(value):
    """Wandelt einen Feldwert in eine lesbare Zeichenkette um."""
    if value is None:
        return ''
    if isinstance(value, bool):
        return 'Ja' if value else 'Nein'
    if hasattr(value, 'pk'):
        return str(value)
    return str(value)


def log_change(demo_system, entity_type, entity_id, entity_label, action,
               user, field_name='', old_value='', new_value=''):
    """Erstellt einen Eintrag im Demo-Änderungsprotokoll."""
    return DemoChangeLog.objects.create(
        demo_system=demo_system,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label or '',
        action=action,
        field_name=field_name or '',
        old_value=_stringify(old_value),
        new_value=_stringify(new_value),
        changed_by=user if (user and getattr(user, 'is_authenticated', False)) else None,
    )


def log_field_changes(demo_system, entity_type, entity_id, entity_label, user,
                      old_values, new_values, field_labels, status_field='status'):
    """
    Protokolliert Feld-Änderungen (alt -> neu) einzeln.

    old_values/new_values: Dict {field_name: value}
    field_labels: Dict {field_name: Anzeigename}
    Das Feld `status_field` wird als Aktion 'status_changed' protokolliert.
    """
    for field, old_value in old_values.items():
        new_value = new_values.get(field)
        if _stringify(old_value) != _stringify(new_value):
            action = 'status_changed' if field == status_field else 'updated'
            log_change(
                demo_system=demo_system,
                entity_type=entity_type,
                entity_id=entity_id,
                entity_label=entity_label,
                action=action,
                user=user,
                field_name=field_labels.get(field, field),
                old_value=old_value,
                new_value=new_value,
            )