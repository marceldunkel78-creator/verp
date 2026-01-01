from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

User = get_user_model()


class MediaTrash(models.Model):
    """
    Papierkorb für gelöschte Medien (Dateien/Ordner)
    Medien werden hierhin verschoben statt direkt gelöscht
    """
    # Ursprünglicher Pfad der Datei
    original_path = models.CharField(
        max_length=500,
        verbose_name='Ursprünglicher Pfad'
    )
    
    # Aktueller Pfad im Papierkorb
    trash_path = models.CharField(
        max_length=500,
        verbose_name='Papierkorb-Pfad'
    )
    
    # Dateiname
    filename = models.CharField(
        max_length=255,
        verbose_name='Dateiname'
    )
    
    # Dateigröße in Bytes
    file_size = models.BigIntegerField(
        verbose_name='Dateigröße (Bytes)',
        default=0
    )
    
    # Verknüpfung zum gelöschten Objekt (Generic Foreign Key)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Objekttyp'
    )
    object_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Objekt-ID'
    )
    deleted_object = GenericForeignKey('content_type', 'object_id')
    
    # Beschreibung des gelöschten Objekts
    object_description = models.CharField(
        max_length=500,
        verbose_name='Objektbeschreibung',
        help_text='Z.B. "Angebot ANG-2024-001"'
    )
    
    # Wer hat gelöscht
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Gelöscht von'
    )
    
    # Wann wurde gelöscht
    deleted_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Gelöscht am'
    )
    
    # Grund für Löschung (optional)
    deletion_reason = models.TextField(
        blank=True,
        verbose_name='Grund der Löschung'
    )
    
    # Metadaten
    can_restore = models.BooleanField(
        default=True,
        verbose_name='Wiederherstellbar',
        help_text='Kann die Datei wiederhergestellt werden?'
    )
    
    class Meta:
        verbose_name = 'Gelöschte Medien'
        verbose_name_plural = 'Gelöschte Medien'
        ordering = ['-deleted_at']
    
    def __str__(self):
        return f"{self.filename} - {self.object_description}"


class DeletionLog(models.Model):
    """
    Protokoll aller Löschvorgänge im System
    """
    ENTITY_CHOICES = [
        ('quotation', 'Angebot'),
        ('customer_order', 'Kundenauftrag'),
        ('customer', 'Kunde'),
        ('supplier', 'Lieferant'),
        ('distributor', 'Distributor'),
        ('project', 'Projekt'),
        ('system', 'System'),
        ('order', 'Bestellung'),
        ('other', 'Sonstiges'),
    ]
    
    ACTION_CHOICES = [
        ('deleted', 'Gelöscht'),
        ('cancelled', 'Storniert'),
        ('force_deleted', 'Zwangsgelöscht'),
    ]
    
    # Entitätstyp
    entity_type = models.CharField(
        max_length=50,
        choices=ENTITY_CHOICES,
        verbose_name='Entitätstyp'
    )
    
    # Entitäts-ID und Beschreibung
    entity_id = models.PositiveIntegerField(
        verbose_name='Entitäts-ID'
    )
    
    entity_description = models.CharField(
        max_length=500,
        verbose_name='Entitätsbeschreibung',
        help_text='Z.B. "ANG-2024-001 - Kunde Mustermann"'
    )
    
    # Aktion
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        verbose_name='Aktion'
    )
    
    # Wer hat gelöscht
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Durchgeführt von'
    )
    
    # Zeitstempel
    deleted_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Durchgeführt am'
    )
    
    # Grund
    reason = models.TextField(
        blank=True,
        verbose_name='Grund'
    )
    
    # War Force-Delete?
    was_forced = models.BooleanField(
        default=False,
        verbose_name='Erzwungene Löschung',
        help_text='Wurde die Entwicklungscheckbox verwendet?'
    )
    
    # Anzahl gelöschter Medien
    media_count = models.IntegerField(
        default=0,
        verbose_name='Anzahl gelöschter Medien'
    )
    
    class Meta:
        verbose_name = 'Löschprotokoll'
        verbose_name_plural = 'Löschprotokolle'
        ordering = ['-deleted_at']
    
    def __str__(self):
        return f"{self.get_action_display()}: {self.entity_description} am {self.deleted_at.strftime('%d.%m.%Y %H:%M')}"
