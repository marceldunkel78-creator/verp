from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer für User Model"""
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone', 'position', 'department',
            'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
            'can_read_customers', 'can_read_manufacturing', 'can_read_service',
            'can_read_settings',
            'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
            'can_write_customers', 'can_write_manufacturing', 'can_write_service',
            'can_write_settings',
            'is_active', 'is_staff', 'date_joined', 'last_login'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer für User Erstellung mit Passwort"""
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'phone', 'position', 'department',
            'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
            'can_read_customers', 'can_read_manufacturing', 'can_read_service',
            'can_read_settings',
            'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
            'can_write_customers', 'can_write_manufacturing', 'can_write_service',
            'can_write_settings',
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwörter stimmen nicht überein."})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer für User Update"""
    
    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name', 'phone', 'position', 'department',
            'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
            'can_read_customers', 'can_read_manufacturing', 'can_read_service',
            'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
            'can_write_customers', 'can_write_manufacturing', 'can_write_service',
            'is_active'
        ]


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer für Passwort Änderung"""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    new_password_confirm = serializers.CharField(required=True, write_only=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Passwörter stimmen nicht überein."})
        return attrs
