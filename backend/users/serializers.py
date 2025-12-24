from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Employee, TimeEntry, VacationRequest, Message, Reminder

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer für User Model"""
    
    class Meta:
        model = User
        fields = [
            'employee',
            'employee_id',
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone', 'position', 'department',
            'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
            'can_read_customers', 'can_read_manufacturing', 'can_read_service',
            'can_read_settings', 'can_read_sales', 'can_read_trading', 'can_read_material_supplies', 'can_read_assets',
            'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
            'can_write_customers', 'can_write_manufacturing', 'can_write_service',
            'can_write_settings', 'can_write_sales', 'can_write_trading', 'can_write_material_supplies', 'can_write_assets',
            'is_active', 'is_staff', 'date_joined', 'last_login'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    employee_id = serializers.SerializerMethodField(read_only=True)

    def get_employee_id(self, obj):
        return obj.employee.employee_id if obj.employee else None


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer für User Erstellung mit Passwort"""
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    class Meta:
        model = User
        fields = [
            'employee',
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'phone', 'position', 'department',
            'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
            'can_read_customers', 'can_read_manufacturing', 'can_read_service',
            'can_read_settings', 'can_read_sales', 'can_read_trading', 'can_read_material_supplies', 'can_read_assets',
            'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
            'can_write_customers', 'can_write_manufacturing', 'can_write_service',
            'can_write_settings', 'can_write_sales', 'can_write_trading', 'can_write_material_supplies', 'can_write_assets',
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
            'employee',
            'email', 'first_name', 'last_name', 'phone', 'position', 'department',
            'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
            'can_read_customers', 'can_read_manufacturing', 'can_read_service', 'can_read_sales', 'can_read_trading', 'can_read_material_supplies',
            'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
            'can_write_customers', 'can_write_manufacturing', 'can_write_service', 'can_write_sales', 'can_write_trading', 'can_write_material_supplies',
            'password', 'password_confirm',
            'is_active' 
        ]
        
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    def validate(self, attrs):
        pw = attrs.get('password')
        pwc = attrs.get('password_confirm')
        if pw or pwc:
            if pw != pwc:
                raise serializers.ValidationError({
                    'password': 'Passwörter stimmen nicht überein.'
                })
        return attrs
    
    def update(self, instance, validated_data):
        # Handle password separately
        password = validated_data.pop('password', None)
        validated_data.pop('password_confirm', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

class ChangePasswordSerializer(serializers.Serializer):
    """Serializer für Passwort Änderung"""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    new_password_confirm = serializers.CharField(required=True, write_only=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Passwörter stimmen nicht überein."})
        return attrs


class EmployeeSerializer(serializers.ModelSerializer):
    """Serializer für Employee Model (HR-Daten)"""
    
    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'first_name', 'last_name', 'date_of_birth',
            'address', 'personal_email', 'work_email', 'phone',
            'employment_start_date', 'employment_end_date', 'contract_type',
            'job_title', 'department', 'working_time_percentage', 'employment_status',
            'weekly_work_hours', 'work_days',
            'annual_vacation_days', 'vacation_balance',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'employee_id']
    
    def validate_date_of_birth(self, value):
        """Validiere Geburtsdatum: nicht in Zukunft, plausibel"""
        from django.utils import timezone
        if value > timezone.now().date():
            raise serializers.ValidationError("Geburtsdatum darf nicht in der Zukunft liegen.")
        return value
    
    def validate_employment_start_date(self, value):
        """Validiere Eintrittsdatum: nicht in ferner Zukunft"""
        from django.utils import timezone
        today = timezone.now().date()
        if value > today.replace(year=today.year + 1):
            raise serializers.ValidationError("Eintrittsdatum scheint unrealistisch.")
        return value
    
    def validate(self, attrs):
        """Gesamtvalidierung: Austrittsdatum >= Eintrittsdatum"""
        start = attrs.get('employment_start_date')
        end = attrs.get('employment_end_date')
        if start and end and end < start:
            raise serializers.ValidationError("Austrittsdatum muss nach Eintrittsdatum liegen.")
        return attrs


class TimeEntrySerializer(serializers.ModelSerializer):
    """Serializer für TimeEntry Model"""

    duration_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TimeEntry
        fields = ['id', 'date', 'start_time', 'end_time', 'break_time', 'description', 'duration_display', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_duration_display(self, obj):
        try:
            dur = obj.duration
            hours = dur.total_seconds() / 3600
            return f"{hours:.2f}h"
        except Exception:
            return "0.00h"



class TimeEntrySerializer(serializers.ModelSerializer):
    """Serializer für TimeEntry Model"""

    duration_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TimeEntry
        fields = ['id', 'date', 'start_time', 'end_time', 'break_time', 'description', 'duration_display', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_duration_display(self, obj):
        try:
            dur = obj.duration
            hours = dur.total_seconds() / 3600
            return f"{hours:.2f}h"
        except Exception:
            return "0.00h"


class VacationRequestSerializer(serializers.ModelSerializer):
    """Serializer für VacationRequest Model"""

    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    start_half_label = serializers.CharField(source='get_start_half_display', read_only=True)
    end_half_label = serializers.CharField(source='get_end_half_display', read_only=True)

    class Meta:
        model = VacationRequest
        fields = [
            'id', 'start_date', 'end_date', 'start_half', 'start_half_label', 'end_half', 'end_half_label', 'days_requested', 'reason', 'status',
            'approved_by', 'approved_by_name', 'approved_at', 'user_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at', 'updated_at']

    def validate(self, attrs):
        # ensure status transitions are valid (only HR can approve/reject/cancel)
        status = attrs.get('status')
        if status in ['approved', 'rejected', 'cancelled']:
            # actual permission check is done in the view, but adding a simple sanity check
            if status not in [c[0] for c in self.Meta.model.STATUS_CHOICES]:
                raise serializers.ValidationError({'status': 'Ungültiger Status.'})
        return attrs


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            'id', 'title', 'content', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reminder
        fields = [
            'id', 'title', 'description', 'due_date', 'is_completed', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
