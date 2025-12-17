from rest_framework import serializers
from .models import ExchangeRate


class ExchangeRateSerializer(serializers.ModelSerializer):
    """Serializer für Wechselkurse"""
    
    class Meta:
        model = ExchangeRate
        fields = ['id', 'currency', 'rate_to_eur', 'last_updated']
        read_only_fields = ['id', 'last_updated']
