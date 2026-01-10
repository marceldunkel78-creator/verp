from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Employee, TimeEntry, VacationRequest, Message, Reminder, Notification,
    TravelExpenseReport, TravelExpenseDay, TravelExpenseItem, TravelPerDiemRate,
    VacationYearBalance, VacationAdjustment
)

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
            # Hauptmodule - Lesen
            'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
            'can_read_customers', 'can_read_manufacturing', 'can_read_service',
            'can_read_settings', 'can_read_sales', 'can_read_trading', 'can_read_material_supplies',
            'can_read_finance', 'can_read_procurement', 'can_read_inventory',
            'can_read_visiview', 'can_read_bi', 'can_read_documents',
            'can_read_development',
            # Submodule - Lesen
            'can_read_procurement_orders', 'can_read_procurement_loans', 'can_read_procurement_product_collections',
            'can_read_sales_dealers', 'can_read_sales_pricelists', 'can_read_sales_projects',
            'can_read_sales_systems', 'can_read_sales_quotations', 'can_read_sales_order_processing',
            'can_read_sales_marketing', 'can_read_sales_tickets',
            'can_read_manufacturing_vs_hardware', 'can_read_manufacturing_production_orders',
            'can_read_visiview_products', 'can_read_visiview_licenses', 'can_read_visiview_tickets', 'can_read_visiview_macros',
            'can_read_visiview_maintenance_time',
            'can_read_service_vs_service', 'can_read_service_tickets', 'can_read_service_rma', 'can_read_service_troubleshooting',
            'can_read_hr_employees', 'can_read_inventory_warehouse',
            'can_read_development_projects',
            # Hauptmodule - Schreiben
            'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
            'can_write_customers', 'can_write_manufacturing', 'can_write_service',
            'can_write_settings', 'can_write_sales', 'can_write_trading', 'can_write_material_supplies',
            'can_write_finance', 'can_write_procurement', 'can_write_inventory',
            'can_write_visiview', 'can_write_bi', 'can_write_documents',
            'can_write_development',
            # Submodule - Schreiben
            'can_write_procurement_orders', 'can_write_procurement_loans', 'can_write_procurement_product_collections',
            'can_write_sales_dealers', 'can_write_sales_pricelists', 'can_write_sales_projects',
            'can_write_sales_systems', 'can_write_sales_quotations', 'can_write_sales_order_processing',
            'can_write_sales_marketing', 'can_write_sales_tickets',
            'can_write_manufacturing_vs_hardware', 'can_write_manufacturing_production_orders',
            'can_write_visiview_products', 'can_write_visiview_licenses', 'can_write_visiview_tickets', 'can_write_visiview_macros',
            'can_write_visiview_maintenance_time',
            'can_write_service_vs_service', 'can_write_service_tickets', 'can_write_service_rma', 'can_write_service_troubleshooting',
            'can_write_hr_employees', 'can_write_inventory_warehouse',
            'can_write_development_projects',
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
            # Hauptmodule - Lesen
            'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
            'can_read_customers', 'can_read_manufacturing', 'can_read_service',
            'can_read_settings', 'can_read_sales', 'can_read_trading', 'can_read_material_supplies',
            'can_read_finance', 'can_read_procurement', 'can_read_inventory',
            'can_read_visiview', 'can_read_bi', 'can_read_documents',
            'can_read_development',
            # Submodule - Lesen
            'can_read_procurement_orders', 'can_read_procurement_loans', 'can_read_procurement_product_collections',
            'can_read_sales_dealers', 'can_read_sales_pricelists', 'can_read_sales_projects',
            'can_read_sales_systems', 'can_read_sales_quotations', 'can_read_sales_order_processing',
            'can_read_sales_marketing', 'can_read_sales_tickets',
            'can_read_manufacturing_vs_hardware', 'can_read_manufacturing_production_orders',
            'can_read_visiview_products', 'can_read_visiview_licenses', 'can_read_visiview_tickets', 'can_read_visiview_macros',
            'can_read_visiview_maintenance_time',
            'can_read_service_vs_service', 'can_read_service_tickets', 'can_read_service_rma', 'can_read_service_troubleshooting',
            'can_read_hr_employees', 'can_read_inventory_warehouse',
            'can_read_development_projects',
            # Hauptmodule - Schreiben
            'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
            'can_write_customers', 'can_write_manufacturing', 'can_write_service',
            'can_write_settings', 'can_write_sales', 'can_write_trading', 'can_write_material_supplies',
            'can_write_finance', 'can_write_procurement', 'can_write_inventory',
            'can_write_visiview', 'can_write_bi', 'can_write_documents',
            'can_write_development',
            # Submodule - Schreiben
            'can_write_procurement_orders', 'can_write_procurement_loans', 'can_write_procurement_product_collections',
            'can_write_sales_dealers', 'can_write_sales_pricelists', 'can_write_sales_projects',
            'can_write_sales_systems', 'can_write_sales_quotations', 'can_write_sales_order_processing',
            'can_write_sales_marketing', 'can_write_sales_tickets',
            'can_write_manufacturing_vs_hardware', 'can_write_manufacturing_production_orders',
            'can_write_visiview_products', 'can_write_visiview_licenses', 'can_write_visiview_tickets', 'can_write_visiview_macros',
            'can_write_visiview_maintenance_time',
            'can_write_service_vs_service', 'can_write_service_tickets', 'can_write_service_rma', 'can_write_service_troubleshooting',
            'can_write_hr_employees', 'can_write_inventory_warehouse',
            'can_write_development_projects',
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
            # Hauptmodule - Lesen
            'can_read_accounting', 'can_read_hr', 'can_read_suppliers',
            'can_read_customers', 'can_read_manufacturing', 'can_read_service',
            'can_read_settings', 'can_read_sales', 'can_read_trading', 'can_read_material_supplies',
            'can_read_finance', 'can_read_procurement', 'can_read_inventory',
            'can_read_visiview', 'can_read_bi', 'can_read_documents',
            'can_read_development',
            # Submodule - Lesen
            'can_read_procurement_orders', 'can_read_procurement_loans', 'can_read_procurement_product_collections',
            'can_read_sales_dealers', 'can_read_sales_pricelists', 'can_read_sales_projects',
            'can_read_sales_systems', 'can_read_sales_quotations', 'can_read_sales_order_processing',
            'can_read_sales_marketing', 'can_read_sales_tickets',
            'can_read_manufacturing_vs_hardware', 'can_read_manufacturing_production_orders',
            'can_read_visiview_products', 'can_read_visiview_licenses', 'can_read_visiview_tickets', 'can_read_visiview_macros',
            'can_read_visiview_maintenance_time',
            'can_read_service_vs_service', 'can_read_service_tickets', 'can_read_service_rma', 'can_read_service_troubleshooting',
            'can_read_hr_employees', 'can_read_inventory_warehouse',
            'can_read_development_projects',
            # Hauptmodule - Schreiben
            'can_write_accounting', 'can_write_hr', 'can_write_suppliers',
            'can_write_customers', 'can_write_manufacturing', 'can_write_service',
            'can_write_settings', 'can_write_sales', 'can_write_trading', 'can_write_material_supplies',
            'can_write_finance', 'can_write_procurement', 'can_write_inventory',
            'can_write_visiview', 'can_write_bi', 'can_write_documents',
            'can_write_development',
            # Submodule - Schreiben
            'can_write_procurement_orders', 'can_write_procurement_loans', 'can_write_procurement_product_collections',
            'can_write_sales_dealers', 'can_write_sales_pricelists', 'can_write_sales_projects',
            'can_write_sales_systems', 'can_write_sales_quotations', 'can_write_sales_order_processing',
            'can_write_sales_marketing', 'can_write_sales_tickets',
            'can_write_manufacturing_vs_hardware', 'can_write_manufacturing_production_orders',
            'can_write_visiview_products', 'can_write_visiview_licenses', 'can_write_visiview_tickets', 'can_write_visiview_macros',
            'can_write_visiview_maintenance_time',
            'can_write_service_vs_service', 'can_write_service_tickets', 'can_write_service_rma', 'can_write_service_troubleshooting',
            'can_write_hr_employees', 'can_write_inventory_warehouse',
            'can_write_development_projects',
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
    signature_image_url = serializers.SerializerMethodField()
    user_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'first_name', 'last_name', 'date_of_birth',
            'address', 'personal_email', 'work_email', 'phone',
            'employment_start_date', 'employment_end_date', 'contract_type',
            'job_title', 'department', 'working_time_percentage', 'employment_status',
            'weekly_work_hours', 'work_days',
            'annual_vacation_days', 'vacation_balance',
            'signature_image', 'signature_image_url', 'closing_greeting',
            'bank_account_holder', 'bank_iban', 'bank_bic', 'bank_name',
            'created_at', 'updated_at', 'user_id'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'employee_id', 'signature_image_url', 'user_id']
    
    def get_signature_image_url(self, obj):
        if obj.signature_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.signature_image.url)
            return obj.signature_image.url
        return None

    def get_user_id(self, obj):
        # Try to find a linked User for this Employee (User.employee FK)
        try:
            user = User.objects.filter(employee=obj).first()
            if user:
                return user.id
        except Exception:
            return None
        return None
    
    def validate_work_days(self, value):
        """Validiere work_days: kann als JSON-String oder Liste kommen"""
        import json
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Ungültiges Format für Arbeitstage.")
        if not isinstance(value, list):
            raise serializers.ValidationError("Arbeitstage müssen eine Liste sein.")
        valid_days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        for day in value:
            if day not in valid_days:
                raise serializers.ValidationError(f"Ungültiger Tag: {day}")
        return value
    
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
    sender_name = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'sender_name', 'user', 'recipient_name',
            'title', 'content', 'message_type', 'is_read',
            'is_deleted_by_sender', 'is_deleted_by_recipient',
            'related_ticket', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'sender_name', 'recipient_name']
    
    def get_sender_name(self, obj):
        if obj.sender:
            return f"{obj.sender.first_name} {obj.sender.last_name}".strip() or obj.sender.username
        return 'System'
    
    def get_recipient_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return None


class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer für das Erstellen von Nachrichten"""
    class Meta:
        model = Message
        fields = ['user', 'title', 'content']
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['sender'] = request.user if request else None
        validated_data['message_type'] = 'user'
        return super().create(validated_data)


class ReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reminder
        fields = [
            'id', 'title', 'description', 'due_date', 'is_completed', 'is_dismissed',
            'related_object_type', 'related_object_id', 'related_url', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type', 'notification_type_display',
            'is_read', 'related_url', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


# ==================== Reisekosten Serializers ====================

class TravelExpenseItemSerializer(serializers.ModelSerializer):
    """Serializer für einzelne Reisekostenpositionen"""
    expense_type_display = serializers.CharField(source='get_expense_type_display', read_only=True)
    receipt_url = serializers.SerializerMethodField()

    class Meta:
        model = TravelExpenseItem
        fields = [
            'id', 'expense_type', 'expense_type_display', 'description', 'amount',
            'guest_names', 'hospitality_reason', 'receipt', 'receipt_url', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'receipt_url']

    def get_receipt_url(self, obj):
        if obj.receipt:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.receipt.url)
            return obj.receipt.url
        return None


class TravelExpenseDaySerializer(serializers.ModelSerializer):
    """Serializer für Reisetage"""
    expenses = TravelExpenseItemSerializer(many=True, read_only=True)
    day_total = serializers.SerializerMethodField()

    class Meta:
        model = TravelExpenseDay
        fields = [
            'id', 'date', 'location', 'country', 
            'per_diem_full', 'per_diem_partial', 'per_diem_applied',
            'departure_time', 'arrival_time', 'is_full_day', 'travel_hours',
            'overnight_allowance', 'notes', 'expenses', 'day_total', 'created_at'
        ]
        read_only_fields = ['id', 'per_diem_full', 'per_diem_partial', 'created_at']

    def get_day_total(self, obj):
        """Berechnet die Gesamtkosten für den Tag"""
        expenses_total = sum(e.amount for e in obj.expenses.all())
        return float(obj.per_diem_applied or 0) + float(expenses_total)


class TravelExpenseReportSerializer(serializers.ModelSerializer):
    """Serializer für Reisekostenabrechnungen"""
    days = TravelExpenseDaySerializer(many=True, read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)

    class Meta:
        model = TravelExpenseReport
        fields = [
            'id', 'user_name', 'username', 'calendar_week', 'year',
            'destination', 'country', 'purpose', 'start_date', 'end_date',
            'status', 'status_display', 'total_amount', 'pdf_file',
            'approved_by', 'approved_by_name', 'approved_at',
            'days', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_name', 'username', 'total_amount', 'pdf_file', 'approved_by', 'approved_at', 'created_at', 'updated_at']


class TravelExpenseReportCreateSerializer(serializers.ModelSerializer):
    """Serializer für das Erstellen von Reisekostenabrechnungen"""

    class Meta:
        model = TravelExpenseReport
        fields = [
            'calendar_week', 'year', 'destination', 'country', 'purpose',
            'start_date', 'end_date'
        ]

    def validate(self, attrs):
        # Prüfen ob bereits eine Abrechnung für diese KW existiert
        user = self.context['request'].user
        if TravelExpenseReport.objects.filter(
            user=user,
            calendar_week=attrs['calendar_week'],
            year=attrs['year']
        ).exists():
            raise serializers.ValidationError(
                f"Es existiert bereits eine Reisekostenabrechnung für KW{attrs['calendar_week']}/{attrs['year']}"
            )
        return attrs

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TravelPerDiemRateSerializer(serializers.ModelSerializer):
    """Serializer für Reisekostenpauschalen"""

    class Meta:
        model = TravelPerDiemRate
        fields = [
            'id', 'country', 'country_code', 'full_day_rate', 'partial_day_rate',
            'overnight_rate', 'valid_from', 'valid_until', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ==================== Urlaub Jahresabschluss Serializers ====================

class VacationAdjustmentSerializer(serializers.ModelSerializer):
    """Serializer für Urlaubsanpassungen (Changelog)"""
    adjustment_type_display = serializers.CharField(source='get_adjustment_type_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VacationAdjustment
        fields = [
            'id', 'employee', 'employee_name', 'year_balance', 'vacation_request',
            'adjustment_type', 'adjustment_type_display', 'days',
            'balance_before', 'balance_after', 'reason',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'balance_before', 'balance_after', 'created_at']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return 'System'
    
    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}"
        return None


class VacationYearBalanceSerializer(serializers.ModelSerializer):
    """Serializer für Jahresurlaubskonten"""
    employee_name = serializers.SerializerMethodField()
    adjustments = VacationAdjustmentSerializer(many=True, read_only=True)
    closed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VacationYearBalance
        fields = [
            'id', 'employee', 'employee_name', 'year',
            'entitlement', 'carryover', 'manual_adjustment', 'taken', 'balance',
            'is_closed', 'closed_at', 'closed_by', 'closed_by_name',
            'adjustments', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'balance', 'taken', 'is_closed', 'closed_at', 'closed_by', 'created_at', 'updated_at']
    
    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}"
        return None
    
    def get_closed_by_name(self, obj):
        if obj.closed_by:
            return f"{obj.closed_by.first_name} {obj.closed_by.last_name}".strip() or obj.closed_by.username
        return None


class VacationManualAdjustmentSerializer(serializers.Serializer):
    """Serializer für manuelle Urlaubsanpassungen durch HR"""
    days = serializers.DecimalField(max_digits=5, decimal_places=1, help_text="Positive Zahl = hinzufügen, Negative = abziehen")
    reason = serializers.CharField(max_length=500)
    year = serializers.IntegerField(required=False, help_text="Jahr für die Anpassung (Standard: aktuelles Jahr)")
