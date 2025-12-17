from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom User Model für VERP
    Erweitert Django's AbstractUser mit zusätzlichen Feldern
    """
    email = models.EmailField(unique=True, verbose_name='E-Mail')
    phone = models.CharField(max_length=50, blank=True, verbose_name='Telefon')
    position = models.CharField(max_length=100, blank=True, verbose_name='Position')
    department = models.CharField(max_length=100, blank=True, verbose_name='Abteilung')
    
    # Berechtigungen für Module - Lesen
    can_read_accounting = models.BooleanField(default=False, verbose_name='Buchhaltung - Lesen')
    can_read_hr = models.BooleanField(default=False, verbose_name='HR - Lesen')
    can_read_suppliers = models.BooleanField(default=False, verbose_name='Lieferanten - Lesen')
    can_read_customers = models.BooleanField(default=False, verbose_name='Kunden - Lesen')
    can_read_manufacturing = models.BooleanField(default=False, verbose_name='Produktion - Lesen')
    can_read_service = models.BooleanField(default=False, verbose_name='Service - Lesen')
    can_read_settings = models.BooleanField(default=False, verbose_name='Einstellungen - Lesen')
    
    # Berechtigungen für Module - Schreiben
    can_write_accounting = models.BooleanField(default=False, verbose_name='Buchhaltung - Schreiben')
    can_write_hr = models.BooleanField(default=False, verbose_name='HR - Schreiben')
    can_write_suppliers = models.BooleanField(default=False, verbose_name='Lieferanten - Schreiben')
    can_write_customers = models.BooleanField(default=False, verbose_name='Kunden - Schreiben')
    can_write_manufacturing = models.BooleanField(default=False, verbose_name='Produktion - Schreiben')
    can_write_service = models.BooleanField(default=False, verbose_name='Service - Schreiben')
    can_write_settings = models.BooleanField(default=False, verbose_name='Einstellungen - Schreiben')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Benutzer'
        verbose_name_plural = 'Benutzer'
        ordering = ['username']
    
    def __str__(self):
        return f"{self.get_full_name() or self.username}"
