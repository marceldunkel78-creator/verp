from django.db import models


class ExchangeRate(models.Model):
    """
    Wechselkurse für verschiedene Währungen
    """
    currency = models.CharField(
        max_length=3,
        unique=True,
        verbose_name='Währung',
        help_text='ISO Währungscode (USD, CHF, GBP, etc.)'
    )
    rate_to_eur = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        verbose_name='Kurs zu EUR',
        help_text='1 Einheit dieser Währung = X EUR'
    )
    last_updated = models.DateTimeField(
        auto_now=True,
        verbose_name='Zuletzt aktualisiert'
    )
    
    class Meta:
        verbose_name = 'Wechselkurs'
        verbose_name_plural = 'Wechselkurse'
        ordering = ['currency']
    
    def __str__(self):
        return f"{self.currency}: {self.rate_to_eur} EUR"
