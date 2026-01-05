from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

User = get_user_model()


class NotificationTask(models.Model):
    """
    Mitteilungsaufgabe - definiert wer bei welchem Statuswechsel benachrichtigt wird.
    
    Beispiel: Wenn eine Kundenbestellung (CustomerOrder) auf Status 'bestätigt' wechselt,
    soll User X eine Benachrichtigung erhalten.
    """
    
    # Das Modul/Model auf das sich die Aufgabe bezieht
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        verbose_name='Modul',
        help_text='Das Modul, auf dessen Statusänderungen reagiert werden soll'
    )
    
    # Der Name des Statusfelds im Model (z.B. "status", "employment_status")
    status_field = models.CharField(
        max_length=100,
        verbose_name='Statusfeld',
        help_text='Name des Statusfelds im Model (z.B. "status")'
    )
    
    # Der Statuswert bei dem die Benachrichtigung ausgelöst wird
    trigger_status = models.CharField(
        max_length=100,
        verbose_name='Auslösender Status',
        help_text='Der Statuswert, bei dem die Benachrichtigung ausgelöst wird'
    )
    
    # Name/Beschreibung der Mitteilungsaufgabe
    name = models.CharField(
        max_length=200,
        verbose_name='Bezeichnung',
        help_text='Beschreibende Bezeichnung für diese Mitteilungsaufgabe'
    )
    
    # Optionale Nachrichtenvorlage
    message_template = models.TextField(
        blank=True,
        verbose_name='Nachrichtenvorlage',
        help_text='Optionale Vorlage für die Nachricht. Variablen: {object}, {old_status}, {new_status}, {changed_by}'
    )
    
    # Ist die Aufgabe aktiv?
    is_active = models.BooleanField(
        default=True,
        verbose_name='Aktiv'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_notification_tasks',
        verbose_name='Erstellt von'
    )
    
    class Meta:
        verbose_name = 'Mitteilungsaufgabe'
        verbose_name_plural = 'Mitteilungsaufgaben'
        ordering = ['content_type__app_label', 'content_type__model', 'trigger_status']
        unique_together = ['content_type', 'status_field', 'trigger_status', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.content_type.model}: {self.status_field} → {self.trigger_status})"
    
    def get_module_display(self):
        """Gibt den lesbaren Modulnamen zurück"""
        return f"{self.content_type.app_label}.{self.content_type.model}"


class NotificationTaskRecipient(models.Model):
    """
    Empfänger einer Mitteilungsaufgabe.
    Verknüpft User mit NotificationTasks.
    """
    
    task = models.ForeignKey(
        NotificationTask,
        on_delete=models.CASCADE,
        related_name='recipients',
        verbose_name='Mitteilungsaufgabe'
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notification_task_subscriptions',
        verbose_name='Empfänger'
    )
    
    # Optional: Nur bei bestimmten Bedingungen benachrichtigen
    # (z.B. nur wenn der User der Ersteller ist)
    notify_creator_only = models.BooleanField(
        default=False,
        verbose_name='Nur Ersteller benachrichtigen',
        help_text='Wenn aktiv, wird nur der Ersteller des Objekts benachrichtigt'
    )
    
    # Optional: Nur bei bestimmten Bedingungen benachrichtigen
    # (z.B. nur wenn der User der zugewiesene Bearbeiter ist)
    notify_assigned_only = models.BooleanField(
        default=False,
        verbose_name='Nur zugewiesener Bearbeiter',
        help_text='Wenn aktiv, wird nur der zugewiesene Bearbeiter benachrichtigt'
    )
    
    # Optional: Alle HR-Genehmiger benachrichtigen (für Urlaubsanträge)
    notify_hr_approvers = models.BooleanField(
        default=False,
        verbose_name='Alle HR-Genehmiger benachrichtigen',
        help_text='Wenn aktiv, werden alle Benutzer mit HR-Schreibrechten benachrichtigt (für Urlaubsanträge)'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Mitteilungsempfänger'
        verbose_name_plural = 'Mitteilungsempfänger'
        unique_together = ['task', 'user']
    
    def __str__(self):
        return f"{self.user.username} @ {self.task.name}"


# Registrierung der Module die Status-Felder haben
# Diese werden im Frontend zur Auswahl angeboten
NOTIFICATION_ENABLED_MODELS = [
    # (app_label, model_name, status_field, display_name)
    ('customer_orders', 'customerorder', 'status', 'Kundenaufträge'),
    ('orders', 'order', 'status', 'Lieferantenbestellungen'),
    ('sales', 'quotation', 'status', 'Angebote'),
    ('projects', 'project', 'status', 'Projekte'),
    ('visiview', 'visiviewlicense', 'status', 'VisiView Lizenzen'),
    ('visiview', 'visiviewticket', 'status', 'VisiView Tickets'),
    ('visiview', 'visiviewmacro', 'status', 'VisiView Makros'),
    ('manufacturing', 'productionorder', 'status', 'Produktionsaufträge'),
    ('loans', 'loan', 'status', 'Leihgeräte'),
    ('service', 'serviceticket', 'status', 'Service Tickets'),
    ('service', 'rmacase', 'status', 'RMA Fälle'),
    ('dealers', 'dealer', 'status', 'Händler'),
    ('users', 'vacationrequest', 'status', 'Urlaubsanträge'),
    ('users', 'travelexpensereport', 'status', 'Reisekostenabrechnungen'),
    ('inventory', 'inventoryitem', 'status', 'Inventar'),
]


def get_model_status_choices(content_type):
    """
    Gibt die Status-Choices für ein bestimmtes Model zurück.
    """
    model_class = content_type.model_class()
    if model_class is None:
        return []
    
    # Versuche verschiedene bekannte Statusfeld-Namen
    status_field_names = ['status', 'employment_status', 'license_status']
    
    for field_name in status_field_names:
        if hasattr(model_class, field_name):
            field = model_class._meta.get_field(field_name)
            if hasattr(field, 'choices') and field.choices:
                return [(choice[0], choice[1]) for choice in field.choices]
    
    # Fallback: Versuche STATUS_CHOICES Konstante
    if hasattr(model_class, 'STATUS_CHOICES'):
        return list(model_class.STATUS_CHOICES)
    
    return []
