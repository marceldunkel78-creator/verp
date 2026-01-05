from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Sum
from datetime import date
from decimal import Decimal
from .models import (
    VisiViewProduct, VisiViewProductPrice, VisiViewLicense, VisiViewOption,
    VisiViewTicket, VisiViewTicketComment, VisiViewTicketChangeLog, VisiViewTicketAttachment,
    VisiViewTicketTimeEntry, MaintenanceTimeCredit, MaintenanceTimeExpenditure, MaintenanceTimeCreditDeduction,
    MaintenanceInvoice
)

User = get_user_model()


class VisiViewProductPriceSerializer(serializers.ModelSerializer):
    """Serializer für VisiView Produkt Preise"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewProductPrice
        fields = [
            'id', 'product', 'purchase_price', 'list_price',
            'valid_from', 'valid_until', 'notes',
            'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def validate(self, data):
        """Prüft auf Überlappungen bei Gültigkeitszeiträumen"""
        product = data.get('product') or (self.instance.product if self.instance else None)
        valid_from = data.get('valid_from') or (self.instance.valid_from if self.instance else None)
        valid_until = data.get('valid_until', None)
        
        if not product or not valid_from:
            return data
        
        # Alle bestehenden Preise für dieses Produkt
        overlapping = VisiViewProductPrice.objects.filter(product=product)
        
        if self.instance:
            overlapping = overlapping.exclude(pk=self.instance.pk)
        
        for price in overlapping:
            # Überlappungsprüfung
            if not valid_until and not price.valid_until:
                # Beide ohne Enddatum - überlappen immer
                raise serializers.ValidationError({
                    'valid_from': f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                })
            elif not valid_until:
                # Neuer Preis ohne Enddatum
                if price.valid_until and price.valid_until >= valid_from:
                    raise serializers.ValidationError({
                        'valid_from': f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                    })
                if not price.valid_until and price.valid_from <= valid_from:
                    raise serializers.ValidationError({
                        'valid_from': f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    })
            elif not price.valid_until:
                # Bestehender Preis ohne Enddatum
                if price.valid_from <= valid_until:
                    raise serializers.ValidationError({
                        'valid_until': f'Überlappung mit bestehendem Preis ab {price.valid_from}'
                    })
            else:
                # Beide mit Enddatum
                if not (valid_until < price.valid_from or valid_from > price.valid_until):
                    raise serializers.ValidationError({
                        'valid_from': f'Überlappung mit bestehendem Preis ({price.valid_from} - {price.valid_until})'
                    })
        
        return data


class VisiViewProductListSerializer(serializers.ModelSerializer):
    """Serializer für Produktliste (kompakt)"""
    current_purchase_price = serializers.SerializerMethodField()
    current_list_price = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VisiViewProduct
        fields = [
            'id', 'article_number', 'name', 'description', 'description_en',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'current_purchase_price', 'current_list_price',
            'created_at', 'updated_at'
        ]
    
    def get_current_purchase_price(self, obj):
        return obj.get_current_purchase_price()
    
    def get_current_list_price(self, obj):
        return obj.get_current_sales_price()


class VisiViewProductDetailSerializer(serializers.ModelSerializer):
    """Serializer für Produktdetails mit allen Preisen"""
    prices = VisiViewProductPriceSerializer(many=True, read_only=True)
    current_purchase_price = serializers.SerializerMethodField()
    current_list_price = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewProduct
        fields = [
            'id', 'article_number', 'name', 'description', 'description_en',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'prices', 'current_purchase_price', 'current_list_price',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
    
    def get_current_purchase_price(self, obj):
        return obj.get_current_purchase_price()
    
    def get_current_list_price(self, obj):
        return obj.get_current_sales_price()
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class VisiViewProductCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Produkt erstellen/bearbeiten"""
    
    class Meta:
        model = VisiViewProduct
        fields = [
            'id', 'article_number', 'name', 'description', 'description_en',
            'product_category', 'unit', 'is_active'
        ]
        read_only_fields = ['article_number']


# ============================================================
# VisiView Options
# ============================================================

class VisiViewOptionSerializer(serializers.ModelSerializer):
    """Serializer für VisiView Optionen"""
    
    class Meta:
        model = VisiViewOption
        fields = [
            'id', 'bit_position', 'name', 'price', 'description', 'is_active'
        ]


# ============================================================
# VisiView Licenses
# ============================================================

class VisiViewLicenseListSerializer(serializers.ModelSerializer):
    """Kompakter Serializer für Lizenzliste"""
    customer_name = serializers.SerializerMethodField()
    customer_number = serializers.CharField(source='customer.customer_number', read_only=True)
    options_count = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    is_maintenance_valid = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewLicense
        fields = [
            'id', 'license_number', 'serial_number', 'internal_serial',
            'customer', 'customer_name', 'customer_number', 'customer_name_legacy',
            'version', 'delivery_date', 'expire_date', 'maintenance_date',
            'status', 'status_display', 'is_demo', 'is_loaner', 'is_active', 'is_maintenance_valid',
            'options_count', 'distributor',
            'created_at', 'updated_at'
        ]
    
    def get_customer_name(self, obj):
        if obj.customer:
            return f"{obj.customer.title} {obj.customer.first_name} {obj.customer.last_name}".strip()
        return obj.customer_name_legacy or '-'
    
    def get_options_count(self, obj):
        count = 0
        # Lower 32-bit
        count += bin(obj.options_bitmask).count('1')
        # Upper 32-bit
        count += bin(obj.options_upper_32bit).count('1')
        return count
    
    def get_status_display(self, obj):
        return obj.get_status_display()
    
    def get_is_active(self, obj):
        return obj.status == 'active'
    
    def get_is_maintenance_valid(self, obj):
        if obj.maintenance_date:
            from datetime import date
            return obj.maintenance_date >= date.today()
        return False


class VisiViewLicenseDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für Lizenzanzeige"""
    customer_name = serializers.SerializerMethodField()
    customer_number = serializers.CharField(source='customer.customer_number', read_only=True)
    active_options = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewLicense
        fields = [
            'id', 'license_number', 'serial_number', 'internal_serial',
            'customer', 'customer_name', 'customer_number',
            'customer_name_legacy', 'customer_address_legacy',
            'distributor', 'version',
            'options_bitmask', 'options_upper_32bit', 'active_options',
            'delivery_date', 'expire_date', 'maintenance_date',
            'purchase_order',
            'status', 'status_display',
            'is_demo', 'is_loaner', 'is_defect', 'is_returned',
            'is_cancelled', 'is_lost', 'is_outdated',
            'return_date',
            'demo_options', 'demo_options_expire_date',
            'dongle_batch_id', 'dongle_version', 'dongle_mod_count',
            'support_end', 'support_warning',
            'info', 'todo', 'legacy_id',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
    
    def get_customer_name(self, obj):
        if obj.customer:
            return f"{obj.customer.title} {obj.customer.first_name} {obj.customer.last_name}".strip()
        return obj.customer_name_legacy or '-'
    
    def get_active_options(self, obj):
        options = obj.get_active_options()
        return VisiViewOptionSerializer(options, many=True).data
    
    def get_status_display(self, obj):
        return obj.get_status_display()
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class VisiViewLicenseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Lizenz erstellen/bearbeiten"""
    
    class Meta:
        model = VisiViewLicense
        fields = [
            'id', 'license_number', 'serial_number', 'internal_serial',
            'customer', 'customer_name_legacy', 'customer_address_legacy',
            'distributor', 'version',
            'options_bitmask', 'options_upper_32bit',
            'delivery_date', 'expire_date', 'maintenance_date',
            'purchase_order',
            'status', 'is_demo', 'is_loaner', 'is_defect', 'is_returned',
            'is_cancelled', 'is_lost', 'is_outdated',
            'return_date',
            'demo_options', 'demo_options_expire_date',
            'dongle_batch_id', 'dongle_version', 'dongle_mod_count',
            'support_end', 'support_warning',
            'info', 'todo'
        ]
        read_only_fields = ['license_number']


class CustomerVisiViewLicenseSerializer(serializers.ModelSerializer):
    """Kompakter Serializer für Lizenzen in Kundenansicht"""
    options_count = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewLicense
        fields = [
            'id', 'license_number', 'serial_number', 'version',
            'status', 'status_display', 'is_demo', 'is_loaner',
            'delivery_date', 'maintenance_date', 'options_count'
        ]
    
    def get_options_count(self, obj):
        count = bin(obj.options_bitmask).count('1')
        count += bin(obj.options_upper_32bit).count('1')
        return count
    
    def get_status_display(self, obj):
        return obj.get_status_display()


# ============================================================
# VisiView Tickets
# ============================================================

class VisiViewTicketCommentSerializer(serializers.ModelSerializer):
    """Serializer für Ticket Kommentare"""
    created_by_display = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewTicketComment
        fields = [
            'id', 'ticket', 'comment', 'is_imported',
            'created_by', 'created_by_name', 'created_by_display',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'created_by']
    
    def get_created_by_display(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return obj.created_by_name or 'Unbekannt'


class VisiViewTicketChangeLogSerializer(serializers.ModelSerializer):
    """Serializer für Ticket Änderungsprotokoll"""
    changed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewTicketChangeLog
        fields = [
            'id', 'ticket', 'field_name', 'old_value', 'new_value',
            'changed_by', 'changed_by_name', 'changed_at'
        ]
        read_only_fields = ['id', 'changed_at']
    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip() or obj.changed_by.username
        return None


class VisiViewTicketAttachmentSerializer(serializers.ModelSerializer):
    """Serializer für VisiView-Ticket Anhänge"""
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewTicketAttachment
        fields = ['id', 'file', 'file_url', 'filename', 'file_size', 'content_type', 
                  'is_image', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at', 'file_size', 'content_type', 'is_image']
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return None
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class VisiViewTicketTimeEntrySerializer(serializers.ModelSerializer):
    """Serializer für VisiView-Ticket Zeiteinträge"""
    employee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewTicketTimeEntry
        fields = ['id', 'ticket', 'date', 'time', 'employee', 'employee_name', 
                  'hours_spent', 'description', 'created_by', 'created_by_name', 
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip() or obj.employee.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class VisiViewTicketListSerializer(serializers.ModelSerializer):
    """Serializer für VisiView Ticket Liste"""
    subject = serializers.CharField(source='title', read_only=True)  # Alias für Frontend-Kompatibilität
    tracker_display = serializers.CharField(source='get_tracker_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    assigned_to_display = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    comment_count = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewTicket
        fields = [
            'id', 'ticket_number', 'tracker', 'tracker_display',
            'title', 'subject', 'status', 'status_display',
            'priority', 'priority_display',
            'category', 'category_display',
            'author', 'assigned_to', 'assigned_to_name', 'assigned_to_display',
            'target_version', 'affected_version',
            'percent_done', 'is_open', 'is_private',
            'customers', 'comment_count',
            'created_at', 'updated_at', 'imported_created_at', 'imported_updated_at'
        ]
    
    def get_assigned_to_display(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return obj.assigned_to_name or None
    
    def get_comment_count(self, obj):
        return obj.comments.count()


class VisiViewTicketDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für VisiView Ticket"""
    tracker_display = serializers.CharField(source='get_tracker_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    assigned_to_display = serializers.SerializerMethodField()
    author_user_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    comments = VisiViewTicketCommentSerializer(many=True, read_only=True)
    change_logs = VisiViewTicketChangeLogSerializer(many=True, read_only=True)
    attachments = VisiViewTicketAttachmentSerializer(many=True, read_only=True)
    time_entries = VisiViewTicketTimeEntrySerializer(many=True, read_only=True)
    total_hours_spent = serializers.SerializerMethodField()
    parent_ticket_display = serializers.SerializerMethodField()
    child_tickets = serializers.SerializerMethodField()
    watchers_list = serializers.SerializerMethodField()
    visiview_license_display = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewTicket
        fields = [
            'id', 'ticket_number', 'tracker', 'tracker_display',
            'parent_ticket', 'parent_ticket_display', 'child_tickets',
            'title', 'description',
            'status', 'status_display',
            'priority', 'priority_display',
            'category', 'category_display',
            'author', 'author_user', 'author_user_name',
            'assigned_to', 'assigned_to_name', 'assigned_to_display',
            'last_changed_by',
            'target_version', 'affected_version', 'visiview_id', 'visiview_license', 'visiview_license_display',
            'start_date', 'due_date',
            'estimated_hours', 'total_estimated_hours', 'spent_hours',
            'percent_done',
            'customers', 'attachment_notes', 'related_tickets',
            'is_private', 'add_to_worklist', 'rank',
            'is_open',
            'created_at', 'updated_at', 'closed_at',
            'imported_created_at', 'imported_updated_at',
            'created_by', 'created_by_name',
            'watchers', 'watchers_list',
            'comments', 'change_logs', 'attachments', 'time_entries', 'total_hours_spent'
        ]
    
    def get_assigned_to_display(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return obj.assigned_to_name or None
    
    def get_author_user_name(self, obj):
        if obj.author_user:
            return f"{obj.author_user.first_name} {obj.author_user.last_name}".strip() or obj.author_user.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_total_hours_spent(self, obj):
        from django.db.models import Sum
        total = obj.time_entries.aggregate(Sum('hours_spent'))['hours_spent__sum']
        return float(total) if total else 0.0
    
    def get_parent_ticket_display(self, obj):
        if obj.parent_ticket:
            return f"#{obj.parent_ticket.ticket_number} - {obj.parent_ticket.title}"
        return None
    
    def get_child_tickets(self, obj):
        children = obj.child_tickets.all()
        return [
            {
                'id': child.id,
                'ticket_number': child.ticket_number,
                'title': child.title,
                'status': child.status,
                'status_display': child.get_status_display()
            }
            for child in children
        ]
    
    def get_watchers_list(self, obj):
        return [
            {
                'id': user.id,
                'name': f"{user.first_name} {user.last_name}".strip() or user.username
            }
            for user in obj.watchers.all()
        ]

    def get_visiview_license_display(self, obj):
        if obj.visiview_license:
            lic = obj.visiview_license
            customer = getattr(lic, 'customer', None)
            return {
                'id': lic.id,
                'license_number': lic.license_number,
                'serial_number': lic.serial_number,
                'customer_name': getattr(customer, 'company_name', None) if customer else lic.customer_name_legacy
            }
        return None


class VisiViewTicketCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von VisiView Tickets"""
    attachments = VisiViewTicketAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = VisiViewTicket
        fields = [
            'id', 'ticket_number', 'tracker', 'parent_ticket',
            'title', 'description',
            'status', 'priority', 'category',
            'author', 'author_user', 'assigned_to', 'assigned_to_name',
            'target_version', 'affected_version', 'visiview_id', 'visiview_license',
            'start_date', 'due_date',
            'estimated_hours', 'total_estimated_hours', 'spent_hours',
            'percent_done',
            'customers', 'attachments', 'related_tickets', 'watchers',
            'is_private', 'add_to_worklist', 'rank',
            'closed_at'
        ]
        read_only_fields = ['id']
    
    def validate_ticket_number(self, value):
        """Prüft ob die Ticket-Nummer bereits existiert"""
        instance = self.instance
        if VisiViewTicket.objects.filter(ticket_number=value).exclude(pk=instance.pk if instance else None).exists():
            raise serializers.ValidationError('Diese Ticket-Nummer existiert bereits.')
        return value


# ==================== VisiView Macro Serializers ====================

from .models import VisiViewMacro, VisiViewMacroExampleImage, VisiViewMacroChangeLog


class VisiViewMacroExampleImageSerializer(serializers.ModelSerializer):
    """Serializer für Macro Beispielbilder"""
    
    class Meta:
        model = VisiViewMacroExampleImage
        fields = ['id', 'macro', 'image', 'description', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class VisiViewMacroChangeLogSerializer(serializers.ModelSerializer):
    """Serializer für Macro Änderungsprotokoll"""
    changed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewMacroChangeLog
        fields = ['id', 'macro', 'version', 'description', 'changed_by', 'changed_by_name', 'changed_at']
        read_only_fields = ['changed_at', 'changed_by']
    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip() or obj.changed_by.username
        return None


class VisiViewMacroListSerializer(serializers.ModelSerializer):
    """Serializer für Macro-Liste (kompakt)"""
    author_user_name = serializers.SerializerMethodField()
    dependency_count = serializers.SerializerMethodField()
    
    class Meta:
        model = VisiViewMacro
        fields = [
            'id', 'macro_id', 'title', 'author', 'author_user', 'author_user_name',
            'visiview_version', 'category', 'keywords', 'status',
            'dependency_count', 'created_at', 'updated_at'
        ]
    
    def get_author_user_name(self, obj):
        if obj.author_user:
            return f"{obj.author_user.first_name} {obj.author_user.last_name}".strip() or obj.author_user.username
        return None
    
    def get_dependency_count(self, obj):
        return obj.dependencies.count()


class VisiViewMacroDetailSerializer(serializers.ModelSerializer):
    """Serializer für Macro-Details (vollständig)"""
    author_user_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    example_images = VisiViewMacroExampleImageSerializer(many=True, read_only=True)
    change_logs = VisiViewMacroChangeLogSerializer(many=True, read_only=True)
    dependencies_list = serializers.SerializerMethodField()
    dependent_macros_list = serializers.SerializerMethodField()
    filename = serializers.ReadOnlyField()
    
    class Meta:
        model = VisiViewMacro
        fields = [
            'id', 'macro_id', 'title', 'author', 'author_user', 'author_user_name',
            'visiview_version', 'purpose', 'usage', 'code',
            'keywords', 'category', 'status', 'changelog',
            'dependencies', 'dependencies_list', 'dependent_macros_list',
            'original_filename', 'filename',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'example_images', 'change_logs'
        ]
    
    def get_author_user_name(self, obj):
        if obj.author_user:
            return f"{obj.author_user.first_name} {obj.author_user.last_name}".strip() or obj.author_user.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_dependencies_list(self, obj):
        return [
            {
                'id': dep.id,
                'macro_id': dep.macro_id,
                'title': dep.title
            }
            for dep in obj.dependencies.all()
        ]
    
    def get_dependent_macros_list(self, obj):
        """Macros die von diesem Macro abhängig sind"""
        return [
            {
                'id': dep.id,
                'macro_id': dep.macro_id,
                'title': dep.title
            }
            for dep in obj.dependent_macros.all()
        ]


class VisiViewMacroCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von Macros"""
    
    class Meta:
        model = VisiViewMacro
        fields = [
            'id', 'macro_id', 'title', 'author', 'author_user',
            'visiview_version', 'purpose', 'usage', 'code',
            'keywords', 'category', 'status', 'changelog',
            'dependencies', 'original_filename'
        ]
        read_only_fields = ['id', 'macro_id']


# ============================================================
# Maintenance Time Credits & Expenditures
# ============================================================

class MaintenanceTimeCreditSerializer(serializers.ModelSerializer):
    """Serializer für Wartungs-Zeitgutschriften"""
    user_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    
    class Meta:
        model = MaintenanceTimeCredit
        fields = [
            'id', 'license', 'start_date', 'end_date',
            'credit_hours', 'remaining_hours',
            'user', 'user_name',
            'is_active', 'is_expired',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']
    
    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_is_active(self, obj):
        return obj.is_active
    
    def get_is_expired(self, obj):
        return obj.is_expired


class MaintenanceTimeCreditDeductionSerializer(serializers.ModelSerializer):
    """Serializer für Gutschrift-Abzüge"""
    credit_start = serializers.DateField(source='credit.start_date', read_only=True)
    credit_end = serializers.DateField(source='credit.end_date', read_only=True)
    credit_id = serializers.IntegerField(source='credit.id', read_only=True)

    class Meta:
        model = MaintenanceTimeCreditDeduction
        fields = ['id', 'credit_id', 'credit_start', 'credit_end', 'hours_deducted']


class MaintenanceTimeExpenditureSerializer(serializers.ModelSerializer):
    """Serializer für Wartungs-Zeitaufwendungen"""
    user_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    activity_display = serializers.SerializerMethodField()
    task_type_display = serializers.SerializerMethodField()
    deductions = MaintenanceTimeCreditDeductionSerializer(many=True, read_only=True)

    class Meta:
        model = MaintenanceTimeExpenditure
        fields = [
            'id', 'license', 'date', 'time',
            'user', 'user_name',
            'activity', 'activity_display',
            'task_type', 'task_type_display',
            'hours_spent', 'comment', 'is_goodwill',
            'created_debt',
            'deductions',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'created_debt']

    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_activity_display(self, obj):
        return obj.get_activity_display()

    def get_task_type_display(self, obj):
        return obj.get_task_type_display()

class MaintenanceSummarySerializer(serializers.Serializer):
    """Serializer für die Maintenance-Zusammenfassung einer Lizenz"""
    total_expenditures = serializers.DecimalField(max_digits=8, decimal_places=2)
    total_credits = serializers.DecimalField(max_digits=8, decimal_places=2)
    current_balance = serializers.DecimalField(max_digits=8, decimal_places=2)
    time_credits = MaintenanceTimeCreditSerializer(many=True)
    time_expenditures = MaintenanceTimeExpenditureSerializer(many=True)


def calculate_interim_settlements(license_id):
    """
    Berechnet Zwischenabrechnungen für eine Lizenz.
    
    NEUE Abrechnungslogik:
    1. Pro Zeitgutschrift gibt es eine Zwischenabrechnung (sortiert nach start_date)
    2. Haben-Seite: Die jeweilige Zeitgutschrift (credit_hours) + Übertrag (wenn negativ)
    3. Soll-Seite: Alle Zeitaufwendungen mit Datum <= Ende-Datum dieser Gutschrift
       (die noch nicht in vorherigen Abrechnungen enthalten waren)
    4. Saldo-Berechnung:
       - Negativ → Übertrag zur nächsten Abrechnung
       - Positiv → Übertrag von 0 (Rest verfällt!)
    5. Die letzte Zwischenabrechnung ist die Endabrechnung
    
    Returns:
        Liste von Zwischenabrechnungen mit:
        - credit: Die Zeitgutschrift für diese Abrechnung
        - expenditures: Liste der zugeordneten Aufwendungen
        - credit_amount: Gutschriftsbetrag
        - carry_over_in: Übertrag aus vorheriger Abrechnung (0 oder negativ)
        - expenditure_total: Summe der Aufwendungen
        - balance: Saldo dieser Abrechnung
        - carry_over_out: Übertrag zur nächsten Abrechnung (0 oder negativ)
        - is_final: True wenn letzte Abrechnung
    """
    # Alle Zeitgutschriften für diese Lizenz (sortiert nach Beginn-Datum)
    credits = list(MaintenanceTimeCredit.objects.filter(
        license_id=license_id
    ).order_by('start_date', 'end_date'))
    
    # Alle Zeitaufwendungen für diese Lizenz (nicht-Kulanz, sortiert nach Datum)
    all_expenditures = list(MaintenanceTimeExpenditure.objects.filter(
        license_id=license_id,
        is_goodwill=False
    ).order_by('date', 'time'))
    
    settlements = []
    carry_over = Decimal('0')  # Übertrag (0 oder negativ)
    processed_expenditure_ids = set()
    
    for i, credit in enumerate(credits):
        is_final = (i == len(credits) - 1)
        
        # Finde alle Aufwendungen mit Datum <= Ende-Datum dieser Gutschrift
        # die noch nicht in vorherigen Abrechnungen waren
        settlement_expenditures = []
        for exp in all_expenditures:
            if exp.id not in processed_expenditure_ids and exp.date <= credit.end_date:
                settlement_expenditures.append(exp)
                processed_expenditure_ids.add(exp.id)
        
        # Berechnung
        credit_amount = Decimal(str(credit.credit_hours))
        expenditure_total = sum(Decimal(str(e.hours_spent)) for e in settlement_expenditures)
        
        # Saldo = Übertrag + Gutschrift - Aufwendungen
        balance = carry_over + credit_amount - expenditure_total
        
        # Übertrag für nächste Abrechnung
        if balance < 0:
            # Negativer Saldo wird übertragen
            carry_over_out = balance
        else:
            # Positiver Saldo verfällt → Übertrag ist 0
            carry_over_out = Decimal('0')
        
        settlements.append({
            'credit': credit,
            'expenditures': settlement_expenditures,
            'credit_amount': credit_amount,
            'carry_over_in': carry_over,
            'expenditure_total': expenditure_total,
            'balance': balance,
            'carry_over_out': carry_over_out,
            'is_final': is_final,
        })
        
        # Übertrag für nächste Runde
        carry_over = carry_over_out
    
    # Falls es Aufwendungen gibt, die keiner Gutschrift zugeordnet wurden
    # (Datum nach Ende aller Gutschriften), erstelle eine finale Abrechnung ohne Gutschrift
    remaining_expenditures = [
        exp for exp in all_expenditures 
        if exp.id not in processed_expenditure_ids
    ]
    
    if remaining_expenditures:
        expenditure_total = sum(Decimal(str(e.hours_spent)) for e in remaining_expenditures)
        balance = carry_over - expenditure_total
        
        # Markiere vorherige als nicht-final
        if settlements:
            settlements[-1]['is_final'] = False
        
        settlements.append({
            'credit': None,  # Keine Gutschrift
            'expenditures': remaining_expenditures,
            'credit_amount': Decimal('0'),
            'carry_over_in': carry_over,
            'expenditure_total': expenditure_total,
            'balance': balance,
            'carry_over_out': balance if balance < 0 else Decimal('0'),
            'is_final': True,
        })
    
    return settlements


def calculate_maintenance_balance(license_id):
    """
    Berechnet das Zeitguthaben für eine Lizenz basierend auf Zwischenabrechnungen.
    
    Das aktuelle Guthaben ergibt sich aus der letzten Zwischenabrechnung.
    """
    settlements = calculate_interim_settlements(license_id)
    
    # Hole alle Daten für die Zusammenfassung
    credits = MaintenanceTimeCredit.objects.filter(license_id=license_id).order_by('start_date', 'end_date')
    expenditures = MaintenanceTimeExpenditure.objects.filter(
        license_id=license_id,
        is_goodwill=False
    ).order_by('date', 'time')
    
    total_credit_hours = credits.aggregate(total=Sum('credit_hours'))['total'] or Decimal('0')
    total_expenditure_hours = expenditures.aggregate(total=Sum('hours_spent'))['total'] or Decimal('0')
    
    # Das aktuelle Guthaben ist der Saldo der letzten Abrechnung
    # Aber nur wenn positiv (sonst ist es Schuld)
    if settlements:
        final_balance = settlements[-1]['balance']
        # Wenn der finale Saldo positiv ist, ist das das aktuelle Guthaben
        # Wenn negativ, ist es Zeitschuld
        current_balance = final_balance
    else:
        current_balance = Decimal('0')
    
    return {
        'total_expenditures': total_expenditure_hours,
        'total_credits': total_credit_hours,
        'current_balance': current_balance,
        'settlements': settlements,  # Zwischenabrechnungen für detaillierte Ansicht
    }


def process_expenditure_deduction(expenditure):
    """
    Verarbeitet eine neue Zeitaufwendung.
    
    Mit der neuen Zwischenabrechnungs-Logik werden keine MaintenanceTimeCreditDeduction
    Einträge mehr benötigt, da die Zuordnung dynamisch über das Datum erfolgt.
    
    Diese Funktion ist jetzt vereinfacht und setzt nur noch created_debt basierend
    auf der aktuellen Berechnung.
    """
    if expenditure.is_goodwill:
        # Kulanz wird nicht abgezogen
        expenditure.created_debt = Decimal('0')
        expenditure.save()
        return
    
    # Mit der neuen Logik wird created_debt nicht mehr pro Aufwendung gespeichert,
    # sondern die Berechnung erfolgt dynamisch über calculate_interim_settlements.
    # Wir setzen created_debt auf 0, da die eigentliche Schuld über die 
    # Zwischenabrechnungen berechnet wird.
    expenditure.created_debt = Decimal('0')
    expenditure.save()


def apply_new_credit_to_debt(credit):
    """
    Wird aufgerufen, wenn eine neue Zeitgutschrift hinzugefügt wird.
    
    Mit der neuen Zwischenabrechnungs-Logik wird die Zuordnung dynamisch berechnet.
    Diese Funktion setzt nur remaining_hours = credit_hours, da die eigentliche
    Berechnung in calculate_interim_settlements erfolgt.
    """
    # Bei der neuen Logik wird remaining_hours nicht mehr zur Laufzeit aktualisiert
    # Die Gutschrift behält ihren vollen Wert und die Berechnung erfolgt dynamisch
    credit.remaining_hours = credit.credit_hours
    credit.save()


class MaintenanceInvoiceSerializer(serializers.ModelSerializer):
    """Serializer für Maintenance-Abrechnungen"""
    created_by_name = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    
    class Meta:
        model = MaintenanceInvoice
        fields = [
            'id', 'license', 'invoice_number', 'start_date', 'end_date',
            'pdf_file', 'pdf_url', 'total_credits', 'total_expenditures', 'balance',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['pdf_file', 'total_credits', 'total_expenditures', 'balance', 'created_at', 'created_by']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
        return None
