from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    VSHardware, VSHardwarePrice, VSHardwareMaterialItem,
    VSHardwareCostCalculation, VSHardwareDocument,
    ProductionOrderInbox, ProductionOrder
)

User = get_user_model()


# ============================================
# VS-HARDWARE SERIALIZERS
# ============================================

class VSHardwarePriceSerializer(serializers.ModelSerializer):
    """Serializer für VS-Hardware Preise"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VSHardwarePrice
        fields = [
            'id', 'vs_hardware', 'purchase_price', 'sales_price',
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
        vs_hardware = data.get('vs_hardware') or (self.instance.vs_hardware if self.instance else None)
        valid_from = data.get('valid_from') or (self.instance.valid_from if self.instance else None)
        valid_until = data.get('valid_until', None)
        
        if not vs_hardware or not valid_from:
            return data
        
        # Alle bestehenden Preise für diese VS-Hardware
        overlapping = VSHardwarePrice.objects.filter(vs_hardware=vs_hardware)
        
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


class VSHardwareMaterialItemSerializer(serializers.ModelSerializer):
    """Serializer für Material-Positionen"""
    material_supply_name = serializers.CharField(source='material_supply.name', read_only=True)
    material_supply_part_number = serializers.CharField(source='material_supply.visitron_part_number', read_only=True)
    material_supply_unit = serializers.CharField(source='material_supply.unit', read_only=True)
    item_cost = serializers.SerializerMethodField()
    unit_price = serializers.SerializerMethodField()
    
    class Meta:
        model = VSHardwareMaterialItem
        fields = [
            'id', 'vs_hardware', 'material_supply',
            'material_supply_name', 'material_supply_part_number', 'material_supply_unit',
            'quantity', 'position', 'notes',
            'unit_price', 'item_cost'
        ]
    
    def get_item_cost(self, obj):
        return float(obj.get_item_cost())
    
    def get_unit_price(self, obj):
        if obj.material_supply:
            unit_price = getattr(obj.material_supply, 'calculate_purchase_price', lambda: obj.material_supply.list_price)()
            return float(unit_price) if unit_price else 0
        return 0


class VSHardwareCostCalculationSerializer(serializers.ModelSerializer):
    """Serializer für Kostenkalkulationen"""
    created_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VSHardwareCostCalculation
        fields = [
            'id', 'vs_hardware', 'name', 'is_active',
            'labor_hours', 'labor_rate',
            'development_cost_total', 'expected_sales_volume',
            'material_cost', 'labor_cost', 'development_cost_per_unit',
            'total_purchase_price', 'margin_percent', 'calculated_sales_price',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = [
            'material_cost', 'labor_cost', 'development_cost_per_unit',
            'total_purchase_price', 'calculated_sales_price',
            'created_at', 'updated_at', 'created_by'
        ]
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class VSHardwareDocumentSerializer(serializers.ModelSerializer):
    """Serializer für Fertigungsdokumente"""
    uploaded_by_name = serializers.SerializerMethodField()
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VSHardwareDocument
        fields = [
            'id', 'vs_hardware', 'document_type', 'document_type_display',
            'title', 'description', 'file', 'file_url', 'file_name', 'version',
            'created_at', 'updated_at', 'uploaded_by', 'uploaded_by_name'
        ]
        read_only_fields = ['created_at', 'updated_at', 'uploaded_by']
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return None
    
    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None
    
    def get_file_name(self, obj):
        if obj.file:
            return obj.file.name.split('/')[-1]
        return None


class VSHardwareListSerializer(serializers.ModelSerializer):
    """Kompakter Serializer für Liste"""
    current_purchase_price = serializers.SerializerMethodField()
    current_sales_price = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VSHardware
        fields = [
            'id', 'part_number', 'name', 'model_designation',
            'description', 'description_en',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'current_purchase_price', 'current_sales_price',
            'created_at', 'created_by_name'
        ]
    
    def get_current_purchase_price(self, obj):
        price = obj.get_current_purchase_price()
        return float(price) if price else None
    
    def get_current_sales_price(self, obj):
        price = obj.get_current_sales_price()
        return float(price) if price else None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


class VSHardwareDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer mit allen verschachtelten Daten"""
    prices = VSHardwarePriceSerializer(many=True, read_only=True)
    material_items = VSHardwareMaterialItemSerializer(many=True, read_only=True)
    cost_calculations = VSHardwareCostCalculationSerializer(many=True, read_only=True)
    documents = VSHardwareDocumentSerializer(many=True, read_only=True)
    
    current_purchase_price = serializers.SerializerMethodField()
    current_sales_price = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    
    release_manual_url = serializers.SerializerMethodField()
    draft_manual_url = serializers.SerializerMethodField()
    release_manual_name = serializers.SerializerMethodField()
    draft_manual_name = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VSHardware
        fields = [
            'id', 'part_number', 'name', 'model_designation', 'description', 'description_en',
            'release_manual', 'release_manual_url', 'release_manual_name',
            'draft_manual', 'draft_manual_url', 'draft_manual_name',
            'product_category', 'product_category_name',
            'unit', 'is_active',
            'current_purchase_price', 'current_sales_price',
            'prices', 'material_items', 'cost_calculations', 'documents',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['part_number', 'created_at', 'updated_at', 'created_by']
    
    def get_current_purchase_price(self, obj):
        price = obj.get_current_purchase_price()
        return float(price) if price else None
    
    def get_current_sales_price(self, obj):
        price = obj.get_current_sales_price()
        return float(price) if price else None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_release_manual_url(self, obj):
        if obj.release_manual:
            return obj.release_manual.url
        return None
    
    def get_draft_manual_url(self, obj):
        if obj.draft_manual:
            return obj.draft_manual.url
        return None
    
    def get_release_manual_name(self, obj):
        if obj.release_manual:
            return obj.release_manual.name.split('/')[-1]
        return None
    
    def get_draft_manual_name(self, obj):
        if obj.draft_manual:
            return obj.draft_manual.name.split('/')[-1]
        return None


class VSHardwareCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellen/Bearbeiten"""
    
    class Meta:
        model = VSHardware
        fields = [
            'id', 'part_number', 'name', 'model_designation', 'description',
            'release_manual', 'draft_manual',
            'unit', 'is_active'
        ]
        read_only_fields = ['part_number']


# ============================================
# FERTIGUNGSAUFTRÄGE SERIALIZERS
# ============================================

class ProductionOrderInboxSerializer(serializers.ModelSerializer):
    """Serializer für Fertigungsauftragseingang"""
    vs_hardware_name = serializers.CharField(source='vs_hardware.name', read_only=True)
    vs_hardware_part_number = serializers.CharField(source='vs_hardware.part_number', read_only=True)
    customer_order_number = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    processed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ProductionOrderInbox
        fields = [
            'id', 'customer_order', 'customer_order_item', 'customer_order_number', 'customer_name',
            'vs_hardware', 'vs_hardware_name', 'vs_hardware_part_number',
            'quantity', 'status', 'status_display', 'notes',
            'received_at', 'processed_at', 'processed_by', 'processed_by_name'
        ]
        read_only_fields = ['received_at', 'processed_at', 'processed_by']
    
    def get_customer_order_number(self, obj):
        return obj.customer_order.order_number if obj.customer_order else None
    
    def get_customer_name(self, obj):
        if obj.customer_order and obj.customer_order.customer:
            c = obj.customer_order.customer
            return f"{c.first_name} {c.last_name}".strip() or c.customer_number
        return None
    
    def get_processed_by_name(self, obj):
        if obj.processed_by:
            return f"{obj.processed_by.first_name} {obj.processed_by.last_name}".strip() or obj.processed_by.username
        return None


class ProductionOrderSerializer(serializers.ModelSerializer):
    """Serializer für Fertigungsaufträge"""
    vs_hardware_name = serializers.CharField(source='vs_hardware.name', read_only=True)
    vs_hardware_part_number = serializers.CharField(source='vs_hardware.part_number', read_only=True)
    vs_hardware_description = serializers.CharField(source='vs_hardware.description', read_only=True)
    vs_hardware_category = serializers.CharField(source='vs_hardware.product_category.code', read_only=True)
    customer_order_number = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    product_category_code = serializers.CharField(source='product_category.code', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    project_number = serializers.CharField(source='project.project_number', read_only=True)
    observers_list = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductionOrder
        fields = [
            'id', 'order_number',
            'inbox_item', 'vs_hardware', 'vs_hardware_name', 'vs_hardware_part_number',
            'vs_hardware_description', 'vs_hardware_category',
            'customer_order', 'customer_order_number', 'customer_name',
            'product_category', 'product_category_name', 'product_category_code',
            'project', 'project_name', 'project_number',
            'quantity', 'status', 'status_display',
            'serial_number', 'estimated_completion_date', 'checklist_data',
            'planned_start', 'planned_end', 'actual_start', 'actual_end',
            'notes', 'observers', 'observers_list',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['order_number', 'created_at', 'updated_at', 'created_by']
    
    def get_customer_order_number(self, obj):
        return obj.customer_order.order_number if obj.customer_order else None
    
    def get_customer_name(self, obj):
        if obj.customer_order and obj.customer_order.customer:
            c = obj.customer_order.customer
            return f"{c.first_name} {c.last_name}".strip() or c.customer_number
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_observers_list(self, obj):
        return [
            {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': f"{user.first_name} {user.last_name}".strip() or user.username
            }
            for user in obj.observers.all()
        ]


class ProductionOrderDetailSerializer(serializers.ModelSerializer):
    """Detaillierter Serializer für Fertigungsauftrag mit Material-Informationen"""
    vs_hardware_name = serializers.CharField(source='vs_hardware.name', read_only=True)
    vs_hardware_part_number = serializers.CharField(source='vs_hardware.part_number', read_only=True)
    vs_hardware_description = serializers.CharField(source='vs_hardware.description', read_only=True)
    vs_hardware_category = serializers.CharField(source='vs_hardware.product_category.code', read_only=True)
    vs_hardware_materials = serializers.SerializerMethodField()
    vs_hardware_documents = serializers.SerializerMethodField()
    customer_order_number = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    product_category_code = serializers.CharField(source='product_category.code', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    project_number = serializers.CharField(source='project.project_number', read_only=True)
    observers_list = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductionOrder
        fields = [
            'id', 'order_number',
            'inbox_item', 'vs_hardware', 'vs_hardware_name', 'vs_hardware_part_number',
            'vs_hardware_description', 'vs_hardware_category',
            'vs_hardware_materials', 'vs_hardware_documents',
            'customer_order', 'customer_order_number', 'customer_name',
            'product_category', 'product_category_name', 'product_category_code',
            'project', 'project_name', 'project_number',
            'quantity', 'status', 'status_display',
            'serial_number', 'estimated_completion_date', 'checklist_data',
            'planned_start', 'planned_end', 'actual_start', 'actual_end',
            'notes', 'observers', 'observers_list',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['order_number', 'created_at', 'updated_at', 'created_by']
    
    def get_vs_hardware_materials(self, obj):
        """Gibt die Materialliste der VS-Hardware mit Lagerbestandsinformationen zurück"""
        materials = []
        for item in obj.vs_hardware.material_items.all():
            # Hole Lagerbestand aus inventory
            stock_quantity = 0
            try:
                from inventory.models import InventoryItem
                stock_items = InventoryItem.objects.filter(
                    material_supply=item.material_supply
                )
                stock_quantity = sum(float(si.quantity) for si in stock_items)
            except Exception:
                pass
            
            required_qty = float(item.quantity) * obj.quantity
            materials.append({
                'id': item.id,
                'material_supply_id': item.material_supply.id,
                'material_supply_name': item.material_supply.name,
                'material_supply_part_number': getattr(item.material_supply, 'visitron_part_number', ''),
                'unit': item.material_supply.unit,
                'quantity_per_unit': float(item.quantity),
                'quantity_required': required_qty,
                'stock_quantity': stock_quantity,
                'stock_sufficient': stock_quantity >= required_qty,
                'notes': item.notes
            })
        return materials
    
    def get_vs_hardware_documents(self, obj):
        """Gibt die Fertigungspläne (Dokumente) der VS-Hardware zurück"""
        documents = []
        for doc in obj.vs_hardware.documents.all():
            file_url = doc.file.url if doc.file else None
            
            documents.append({
                'id': doc.id,
                'document_type': doc.document_type,
                'document_type_display': doc.get_document_type_display(),
                'title': doc.title,
                'description': doc.description,
                'version': doc.version,
                'file_url': file_url,
                'file_name': doc.file.name.split('/')[-1] if doc.file else None
            })
        return documents
    
    def get_customer_order_number(self, obj):
        return obj.customer_order.order_number if obj.customer_order else None
    
    def get_customer_name(self, obj):
        if obj.customer_order and obj.customer_order.customer:
            c = obj.customer_order.customer
            return f"{c.first_name} {c.last_name}".strip() or c.customer_number
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None
    
    def get_observers_list(self, obj):
        return [
            {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': f"{user.first_name} {user.last_name}".strip() or user.username
            }
            for user in obj.observers.all()
        ]


# ============================================
# TRANSFER SERIALIZER
# ============================================

class PriceTransferSerializer(serializers.Serializer):
    """Serializer für Preisübertragung aus Kalkulation"""
    valid_from = serializers.DateField(required=True)
    valid_until = serializers.DateField(required=False, allow_null=True)
