from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from .models import Order, order_document_upload_path
from .pdf_generator import render_order_pdf_bytes
import traceback


@receiver(post_save, sender=Order)
def generate_and_save_order_pdf(sender, instance, created, **kwargs):
    """Generiere bei Save das PDF und speichere es in `order_document` (überschreibt alte Datei).

    Wenn `order_type` == 'online' ist, wird kein automatisch generiertes PDF erzeugt.
    """
    try:
        if getattr(instance, 'order_type', None) == 'online':
            print(f"Skipping PDF generation for online order {instance.pk} ({instance.order_number})")
            return

        # Render PDF bytes
        pdf_bytes = render_order_pdf_bytes(instance)
        if not pdf_bytes:
            print(f"render_order_pdf_bytes returned empty for order {instance.pk}")
            return

        # Determine filename and path using same upload_to helper
        # Use a neutral filename (without duplicating the order_number) — upload handler will sanitize and prefix as necessary
        filename = "Bestellung.pdf"
        path = order_document_upload_path(instance, filename)

        # Overwrite if exists
        if default_storage.exists(path):
            try:
                default_storage.delete(path)
            except Exception as e:
                print(f"Warning: failed to delete existing file {path}: {e}")

        saved_path = default_storage.save(path, ContentFile(pdf_bytes))

        # Update DB field without sending another post_save signal
        Order.objects.filter(pk=instance.pk).update(order_document=saved_path)
        print(f"Order PDF saved to {saved_path} for order {instance.order_number}")
    except Exception as e:
        print(f"Failed to generate/save PDF for order {instance.pk}: {e}")
        print(traceback.format_exc())