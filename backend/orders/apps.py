from django.apps import AppConfig


class OrdersConfig(AppConfig):
    name = 'orders'

    def ready(self):
        # Import signals to ensure post_save handlers are connected
        try:
            from . import signals  # noqa: F401
        except Exception as e:
            print(f"Failed to import orders.signals: {e}")
