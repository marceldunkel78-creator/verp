from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class MondayMeetingTodo(models.Model):
    """
    Todo-Einträge für das Montagsmeeting.
    Wenn abgehakt (is_completed) wird der Eintrag beim Speichern gelöscht.
    """
    title = models.CharField(
        max_length=500,
        verbose_name='Titel'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    is_completed = models.BooleanField(
        default=False,
        verbose_name='Erledigt'
    )
    
    # Priorität/Sortierung
    priority = models.IntegerField(
        default=0,
        verbose_name='Priorität',
        help_text='Höhere Zahl = höhere Priorität'
    )
    
    # Metadaten
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monday_meeting_todos_created',
        verbose_name='Erstellt von'
    )
    
    class Meta:
        verbose_name = 'Montagsmeeting Todo'
        verbose_name_plural = 'Montagsmeeting Todos'
        ordering = ['-priority', '-created_at']
    
    def __str__(self):
        return self.title


class SalesMeetingTodo(models.Model):
    """
    Todo-Einträge für das Vertriebsmeeting.
    Mit History - erledigte Einträge werden durchgestrichen, aber nicht gelöscht.
    """
    title = models.CharField(
        max_length=500,
        verbose_name='Titel'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    is_completed = models.BooleanField(
        default=False,
        verbose_name='Erledigt'
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Erledigt am'
    )
    completed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_meeting_todos_completed',
        verbose_name='Erledigt von'
    )
    
    # Priorität/Sortierung
    priority = models.IntegerField(
        default=0,
        verbose_name='Priorität',
        help_text='Höhere Zahl = höhere Priorität'
    )
    
    # Metadaten
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_meeting_todos_created',
        verbose_name='Erstellt von'
    )
    
    class Meta:
        verbose_name = 'Vertriebsmeeting Todo'
        verbose_name_plural = 'Vertriebsmeeting Todos'
        ordering = ['is_completed', '-priority', '-created_at']
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        # Setze completed_at wenn is_completed geändert wird
        if self.is_completed and not self.completed_at:
            self.completed_at = timezone.now()
        elif not self.is_completed:
            self.completed_at = None
            self.completed_by = None
        super().save(*args, **kwargs)


class VisiViewMeetingTodo(models.Model):
    """
    Todo-Einträge für das VisiView-Meeting.
    """
    title = models.CharField(
        max_length=500,
        verbose_name='Titel'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Beschreibung'
    )
    is_completed = models.BooleanField(
        default=False,
        verbose_name='Erledigt'
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Erledigt am'
    )
    completed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_meeting_todos_completed',
        verbose_name='Erledigt von'
    )
    
    # Verknüpfung zu VisiView Ticket (optional)
    visiview_ticket = models.ForeignKey(
        'visiview.VisiViewTicket',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='meeting_todos',
        verbose_name='Verknüpftes Ticket'
    )
    
    # Priorität/Sortierung
    priority = models.IntegerField(
        default=0,
        verbose_name='Priorität',
        help_text='Höhere Zahl = höhere Priorität'
    )
    
    # Metadaten
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Erstellt am'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Aktualisiert am'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visiview_meeting_todos_created',
        verbose_name='Erstellt von'
    )
    
    class Meta:
        verbose_name = 'VisiView-Meeting Todo'
        verbose_name_plural = 'VisiView-Meeting Todos'
        ordering = ['is_completed', '-priority', '-created_at']
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        # Setze completed_at wenn is_completed geändert wird
        if self.is_completed and not self.completed_at:
            self.completed_at = timezone.now()
        elif not self.is_completed:
            self.completed_at = None
            self.completed_by = None
        super().save(*args, **kwargs)
