from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'
    verbose_name = 'Mitteilungen'
    
    def ready(self):
        """Verbinde Signale wenn die App geladen wird"""
        from . import signals
        signals.connect_signals()
