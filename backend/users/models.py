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
    
    # Zusätzliche Berechtigungen für Module
    can_access_accounting = models.BooleanField(default=False, verbose_name='Zugang Buchhaltung')
    can_access_hr = models.BooleanField(default=False, verbose_name='Zugang HR')
    can_access_suppliers = models.BooleanField(default=False, verbose_name='Zugang Lieferanten')
    can_access_customers = models.BooleanField(default=False, verbose_name='Zugang Kunden')
    can_access_manufacturing = models.BooleanField(default=False, verbose_name='Zugang Produktion')
    can_access_service = models.BooleanField(default=False, verbose_name='Zugang Service')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Benutzer'
        verbose_name_plural = 'Benutzer'
        ordering = ['username']
    
    def __str__(self):
        return f"{self.get_full_name() or self.username}"
