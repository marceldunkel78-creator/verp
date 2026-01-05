"""
Signal handlers für automatische Benachrichtigungen bei Statuswechsel.

Diese Signale werden ausgelöst, wenn sich der Status eines Objekts ändert,
und erstellen automatisch Benachrichtigungen für die konfigurierten Empfänger.
"""
import logging
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from .models import NotificationTask, NOTIFICATION_ENABLED_MODELS
# Import Notification from users app
from users.models import Notification

logger = logging.getLogger(__name__)


def get_object_display_name(instance):
    """Gibt einen lesbaren Namen für das Objekt zurück"""
    # Versuche verschiedene Attribute die als Bezeichner dienen könnten
    for attr in ['order_number', 'quotation_number', 'license_number', 
                 'ticket_number', 'project_number', 'name', 'title', 'pk']:
        if hasattr(instance, attr):
            value = getattr(instance, attr)
            if value:
                return str(value)
    return str(instance.pk)


def get_object_link(instance, content_type):
    """Generiert den Frontend-Link zum Objekt"""
    app_label = content_type.app_label
    model = content_type.model
    
    # Mapping von Model zu Frontend-Route
    link_mapping = {
        ('customer_orders', 'customerorder'): f'/sales/order-processing/{instance.pk}',
        ('orders', 'order'): f'/procurement/orders/{instance.pk}',
        ('sales', 'quotation'): f'/sales/quotations/{instance.pk}',
        ('projects', 'project'): f'/sales/projects/{instance.pk}',
        ('visiview', 'visiviewlicense'): f'/visiview/licenses/{instance.pk}',
        ('visiview', 'visiviewticket'): f'/visiview/tickets/{instance.pk}',
        ('visiview', 'visiviewmacro'): f'/visiview/macros/{instance.pk}',
        ('manufacturing', 'productionorder'): f'/manufacturing/production-orders/{instance.pk}',
        ('loans', 'loan'): f'/procurement/loans/{instance.pk}',
        ('service', 'serviceticket'): f'/service/tickets/{instance.pk}',
        ('service', 'rmacase'): f'/service/rma/{instance.pk}',
        ('dealers', 'dealer'): f'/sales/dealers/{instance.pk}',
        ('users', 'vacationrequest'): f'/myverp',
        ('users', 'travelexpensereport'): f'/myverp',
        ('inventory', 'inventoryitem'): f'/inventory/warehouse/{instance.pk}',
    }
    
    return link_mapping.get((app_label, model), '')


def get_status_display(instance, status_value, status_field='status'):
    """Gibt den lesbaren Statusnamen zurück"""
    model_class = type(instance)
    
    # Versuche STATUS_CHOICES zu finden
    choices_attr = f'{status_field.upper()}_CHOICES'
    if hasattr(model_class, choices_attr):
        choices = getattr(model_class, choices_attr)
    elif hasattr(model_class, 'STATUS_CHOICES'):
        choices = model_class.STATUS_CHOICES
    else:
        return status_value
    
    for value, label in choices:
        if value == status_value:
            return label
    return status_value


def check_and_create_notifications(instance, old_status, new_status, status_field, changed_by=None):
    """
    Prüft ob für den Statuswechsel Mitteilungsaufgaben existieren
    und erstellt entsprechende Benachrichtigungen.
    """
    logger.info(f"NOTIFICATION check_and_create_notifications called: old_status={old_status}, new_status={new_status}, status_field={status_field}")
    
    if old_status == new_status:
        logger.info(f"NOTIFICATION: Status unchanged, skipping")
        return
    
    content_type = ContentType.objects.get_for_model(instance)
    logger.info(f"NOTIFICATION: ContentType={content_type.app_label}.{content_type.model}")
    
    # Finde alle aktiven Mitteilungsaufgaben für diesen Statuswechsel
    tasks = NotificationTask.objects.filter(
        content_type=content_type,
        status_field=status_field,
        trigger_status=new_status,
        is_active=True
    ).prefetch_related('recipients__user')
    
    logger.info(f"NOTIFICATION: Found {tasks.count()} matching tasks for trigger_status={new_status}")
    
    if not tasks.exists():
        logger.info(f"NOTIFICATION: No tasks found, available tasks for this model:")
        all_tasks = NotificationTask.objects.filter(content_type=content_type)
        for t in all_tasks:
            logger.info(f"  - Task: {t.name}, status_field={t.status_field}, trigger_status={t.trigger_status}, is_active={t.is_active}")
        return
    
    object_name = get_object_display_name(instance)
    object_link = get_object_link(instance, content_type)
    old_status_display = get_status_display(instance, old_status, status_field)
    new_status_display = get_status_display(instance, new_status, status_field)
    
    # Finde den Modulnamen
    module_name = content_type.model.title()
    for app_label, model_name, sf, display_name in NOTIFICATION_ENABLED_MODELS:
        if content_type.app_label == app_label and content_type.model == model_name:
            module_name = display_name
            break
    
    for task in tasks:
        # Generiere Nachricht
        if task.message_template:
            message = task.message_template.format(
                object=object_name,
                old_status=old_status_display,
                new_status=new_status_display,
                changed_by=changed_by.get_full_name() if changed_by else 'System'
            )
        else:
            message = (
                f"{module_name} '{object_name}' wurde von '{old_status_display}' "
                f"auf '{new_status_display}' geändert."
            )
        
        title = f"{module_name}: Status geändert zu '{new_status_display}'"
        
        # Bestimme den notification_type basierend auf dem Model
        notification_type = 'info'
        if content_type.model == 'order':
            notification_type = 'order'
        elif content_type.model == 'quotation':
            notification_type = 'quotation'
        elif content_type.model == 'loan':
            notification_type = 'loan'
        elif content_type.model == 'vacationrequest':
            notification_type = 'vacation'
        
        # Erstelle Benachrichtigungen für alle Empfänger
        for recipient in task.recipients.all():
            users_to_notify = []
            
            # Prüfe ob HR-Genehmiger benachrichtigt werden sollen
            if recipient.notify_hr_approvers:
                # Finde alle Benutzer mit can_write_hr
                from django.contrib.auth import get_user_model
                User = get_user_model()
                hr_users = User.objects.filter(can_write_hr=True, is_active=True)
                users_to_notify.extend(list(hr_users))
                logger.info(f"NOTIFICATION: notify_hr_approvers enabled, found {hr_users.count()} HR users")
            else:
                # Normaler Empfänger
                user = recipient.user
                
                # Prüfe Bedingungen
                if recipient.notify_creator_only:
                    # Nur Ersteller benachrichtigen
                    creator = getattr(instance, 'created_by', None) or getattr(instance, 'user', None)
                    if creator != user:
                        continue
                
                if recipient.notify_assigned_only:
                    # Nur zugewiesener Bearbeiter
                    assigned = getattr(instance, 'assigned_to', None) or \
                               getattr(instance, 'responsible_user', None) or \
                               getattr(instance, 'handler', None)
                    if assigned != user:
                        continue
                
                users_to_notify.append(user)
            
            # Erstelle Benachrichtigungen für alle ermittelten Benutzer
            for user in users_to_notify:
                # Erstelle die Benachrichtigung (mit dem users.Notification Model)
                logger.info(f"NOTIFICATION: Creating notification for user={user.username}, title={title}")
                Notification.objects.create(
                    user=user,
                    title=title,
                    message=message,
                    notification_type=notification_type,
                    related_url=object_link
                )
                logger.info(f"NOTIFICATION: Successfully created notification for {user.username}")


# Cache für alte Status-Werte
_status_cache = {}


def cache_old_status(sender, instance, **kwargs):
    """Speichert den alten Status vor dem Speichern"""
    logger.info(f"NOTIFICATION cache_old_status: sender={sender}, instance pk={getattr(instance, 'pk', None)}")
    if not instance.pk:
        return
    
    # Finde das richtige Statusfeld für dieses Model
    status_field = 'status'
    for app_label, model_name, sf, display_name in NOTIFICATION_ENABLED_MODELS:
        ct = ContentType.objects.get_for_model(instance)
        if ct.app_label == app_label and ct.model == model_name:
            status_field = sf
            break
    
    if not hasattr(instance, status_field):
        return
    
    try:
        old_instance = sender.objects.get(pk=instance.pk)
        old_status = getattr(old_instance, status_field)
        cache_key = f"{sender._meta.label}_{instance.pk}"
        _status_cache[cache_key] = (old_status, status_field)
    except sender.DoesNotExist:
        pass


def process_status_change(sender, instance, created, **kwargs):
    """Verarbeitet den Statuswechsel nach dem Speichern"""
    logger.info(f"NOTIFICATION process_status_change: sender={sender}, created={created}, instance pk={instance.pk}")
    
    if created:
        logger.info(f"NOTIFICATION: Skipping because created=True")
        return
    
    cache_key = f"{sender._meta.label}_{instance.pk}"
    if cache_key not in _status_cache:
        logger.info(f"NOTIFICATION: Skipping because cache_key={cache_key} not in _status_cache. Available keys: {list(_status_cache.keys())}")
        return
    
    old_status, status_field = _status_cache.pop(cache_key)
    logger.info(f"NOTIFICATION: Found cached status: old_status={old_status}, status_field={status_field}")
    
    if not hasattr(instance, status_field):
        logger.info(f"NOTIFICATION: Skipping because instance has no attribute {status_field}")
        return
    
    new_status = getattr(instance, status_field)
    logger.info(f"NOTIFICATION: new_status={new_status}")
    
    # Versuche den ändernden User zu ermitteln
    # (wird normalerweise über den Request-Context gesetzt)
    changed_by = getattr(instance, '_changed_by', None)
    
    check_and_create_notifications(instance, old_status, new_status, status_field, changed_by)


def connect_signals():
    """
    Verbindet die Signal-Handler mit allen relevanten Models.
    Wird in apps.py aufgerufen.
    """
    from django.apps import apps
    
    logger.info("NOTIFICATION connect_signals: Starting to connect signals...")
    
    for app_label, model_name, status_field, display_name in NOTIFICATION_ENABLED_MODELS:
        try:
            model = apps.get_model(app_label, model_name)
            pre_save.connect(cache_old_status, sender=model, dispatch_uid=f"notification_pre_{app_label}_{model_name}")
            post_save.connect(process_status_change, sender=model, dispatch_uid=f"notification_post_{app_label}_{model_name}")
            logger.info(f"NOTIFICATION: Connected signals for {app_label}.{model_name}")
        except LookupError as e:
            # Model existiert nicht (noch nicht installiert)
            logger.warning(f"NOTIFICATION: Could not connect signals for {app_label}.{model_name}: {e}")
    
    logger.info("NOTIFICATION connect_signals: Finished connecting signals")
