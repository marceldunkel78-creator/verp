from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    VisiViewProduct, VisiViewProductPrice, VisiViewLicense, VisiViewOption,
    VisiViewTicket, VisiViewTicketComment, VisiViewTicketChangeLog
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
    parent_ticket_display = serializers.SerializerMethodField()
    child_tickets = serializers.SerializerMethodField()
    watchers_list = serializers.SerializerMethodField()
    
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
            'target_version', 'affected_version', 'visiview_id',
            'start_date', 'due_date',
            'estimated_hours', 'total_estimated_hours', 'spent_hours',
            'percent_done',
            'customers', 'attachments', 'related_tickets',
            'is_private', 'add_to_worklist', 'rank',
            'is_open',
            'created_at', 'updated_at', 'closed_at',
            'imported_created_at', 'imported_updated_at',
            'created_by', 'created_by_name',
            'watchers', 'watchers_list',
            'comments', 'change_logs'
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


class VisiViewTicketCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Aktualisieren von VisiView Tickets"""
    
    class Meta:
        model = VisiViewTicket
        fields = [
            'id', 'ticket_number', 'tracker', 'parent_ticket',
            'title', 'description',
            'status', 'priority', 'category',
            'author', 'author_user', 'assigned_to', 'assigned_to_name',
            'target_version', 'affected_version', 'visiview_id',
            'start_date', 'due_date',
            'estimated_hours', 'total_estimated_hours', 'spent_hours',
            'percent_done',
            'customers', 'attachments', 'related_tickets',
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
