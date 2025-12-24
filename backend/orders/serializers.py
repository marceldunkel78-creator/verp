from rest_framework import serializers
from .models import Order, OrderItem
from suppliers.models import Supplier


class OrderItemSerializer(serializers.ModelSerializer):
    """Serializer für Bestellpositionen"""
    total_price = serializers.ReadOnlyField()
    confirmed_price = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True, required=False)
    controlling_checked = serializers.BooleanField(default=False)
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'trading_product', 'material_supply',
            'customer_order_number',
            'article_number', 'name', 'description', 'management_info',
            'quantity', 'unit', 'list_price', 'discount_percent',
            'final_price', 'currency', 'position', 'confirmed_price', 'controlling_checked', 'total_price'
        ]


class OrderListSerializer(serializers.ModelSerializer):
    """Serializer für Bestellübersicht (reduzierte Daten)"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    items_count = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    confirmed_total = serializers.ReadOnlyField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number',
            'order_type', 'status', 'status_display', 'supplier', 'supplier_name',
            'order_date', 'delivery_date', 'payment_date',
            'items_count', 'total_amount', 'confirmed_total',
            'created_by_name', 'created_at', 'updated_at'
        ]
    
    def get_items_count(self, obj):
        return obj.items.count()
    
    def get_total_amount(self, obj):
        total = sum(item.total_price for item in obj.items.all())
        return float(total)


class OrderDetailSerializer(serializers.ModelSerializer):
    """Serializer für Bestelldetails (alle Daten)"""
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    total_amount = serializers.SerializerMethodField()
    
    # Display-Felder für Konditionen
    payment_term_display = serializers.SerializerMethodField()
    delivery_term_display = serializers.SerializerMethodField()
    delivery_instruction_display = serializers.SerializerMethodField()
    
    # Lieferanten-Informationen für Bestelldokumente
    supplier_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number',
            'order_type',
            'status', 'status_display', 'supplier', 'supplier_name',
            'supplier_details',
            'order_date', 'confirmation_date', 'expected_delivery_date', 'delivery_date', 'payment_date',
            'payment_term', 'payment_term_display',
            'delivery_term', 'delivery_term_display',
            'delivery_instruction', 'delivery_instruction_display',
            'offer_reference', 'custom_text', 'order_document', 'supplier_confirmation_document',
            'notes', 'items', 'total_amount', 'confirmed_total',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'order_number', 'created_by', 'created_at', 'updated_at']
    
    def get_total_amount(self, obj):
        total = sum(item.total_price for item in obj.items.all())
        return float(total)
    
    def get_payment_term_display(self, obj):
        try:
            if obj.payment_term:
                return obj.payment_term.get_formatted_terms()
        except Exception as e:
            print(f"Error getting payment_term_display: {e}")
        return None
    
    def get_delivery_term_display(self, obj):
        try:
            if obj.delivery_term:
                return obj.delivery_term.get_incoterm_display()
        except Exception as e:
            print(f"Error getting delivery_term_display: {e}")
        return None
    
    def get_delivery_instruction_display(self, obj):
        try:
            if obj.delivery_instruction:
                return obj.delivery_instruction.name
        except Exception as e:
            print(f"Error getting delivery_instruction_display: {e}")
        return None
        read_only_fields = ['id', 'order_number', 'created_by', 'created_at', 'updated_at']
    
    def get_total_amount(self, obj):
        total = sum(item.total_price for item in obj.items.all())
        return float(total)
    
    def get_supplier_details(self, obj):
        """Lieferanten-Details für Bestelldokumente"""
        supplier = obj.supplier
        return {
            'company_name': supplier.company_name,
            'street': supplier.street,
            'house_number': supplier.house_number,
            'postal_code': supplier.postal_code,
            'city': supplier.city,
            'state': supplier.state,
            'country': supplier.country,
            'email': supplier.email,
            'phone': supplier.phone,
            'website': supplier.website,
            'customer_number': supplier.customer_number,
        }


class OrderCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer für Erstellung/Aktualisierung mit verschachtelten Items"""
    items = OrderItemSerializer(many=True, required=False)
    
    class Meta:
        model = Order
        fields = [
            'order_type',
            'status', 'supplier',
            'order_date', 'confirmation_date', 'expected_delivery_date', 'delivery_date', 'payment_date',
            'payment_term', 'delivery_term', 'delivery_instruction',
            'offer_reference', 'custom_text', 'order_document', 'supplier_confirmation_document',
            'notes', 'items'
        ]

    def validate(self, data):
        """Validierung: Status darf nur auf 'bestaetigt' gesetzt werden, wenn Bestätigungsdatum vorhanden ist
        und alle Items die `controlling_checked` gesetzt haben."""
        import json
        status = data.get('status')
        confirmation_date = data.get('confirmation_date')
        items = data.get('items', None)

        # On update, if items not provided, inspect existing instance items
        parsed_items = None
        if isinstance(items, str):
            try:
                parsed_items = json.loads(items)
            except Exception:
                parsed_items = None
        elif isinstance(items, list):
            parsed_items = items

        if status == 'bestaetigt':
            # Only enforce the controlling checks when the status is being set to 'bestaetigt'
            # (i.e., on create, or when changing from a different status to 'bestaetigt').
            if self.instance is None or (self.instance is not None and getattr(self.instance, 'status', None) != 'bestaetigt'):
                if not confirmation_date and getattr(self, 'instance', None) is None:
                    raise serializers.ValidationError({'status': 'Auftragsbestätigung-Datum erforderlich, um Status auf bestätigt zu setzen.'})

                # determine items to check
                # Helper to coerce different possible representations into booleans
                def _is_checked(v):
                    if isinstance(v, bool):
                        return v
                    if isinstance(v, (int, float)):
                        return bool(v)
                    if isinstance(v, str):
                        return v.lower() in ('true', '1', 'yes', 'on')
                    return False

                if parsed_items is None and self.instance is not None:
                    # use existing items from DB
                    existing = list(self.instance.items.values('controlling_checked'))
                    all_checked = all(_is_checked(i.get('controlling_checked')) for i in existing)
                elif parsed_items is not None:
                    all_checked = all(_is_checked(item.get('controlling_checked')) for item in parsed_items)
                else:
                    # no items provided and no instance -> cannot verify
                    all_checked = False

                if not all_checked:
                    # helpful debug information
                    print('Validation failed: not all controlling_checked true. Parsed items:', parsed_items)
                    raise serializers.ValidationError({'status': 'Alle Controlling-Checkboxen müssen gesetzt sein, um Status auf bestätigt zu setzen.'})
            else:
                # instance already 'bestaetigt': skip the controlling checks on update to allow other fields to be saved
                print('Skipping controlling checks: instance already in status bestaetigt')

        return data    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        # If items were submitted as JSON string (multipart/form-data), parse them
        import json
        if isinstance(items_data, str):
            try:
                items_data = json.loads(items_data)
            except Exception:
                items_data = []

        order = Order.objects.create(**validated_data)

        # helper to coerce booleans
        def _to_bool(v):
            if isinstance(v, bool):
                return v
            if isinstance(v, (int, float)):
                return bool(v)
            if isinstance(v, str):
                return v.lower() in ('true', '1', 'yes', 'on')
            return False

        # Create items; set confirmed_price and controlling_checked correctly
        for item_data in items_data:
            # coerce controlling_checked
            if 'controlling_checked' in item_data:
                item_data['controlling_checked'] = _to_bool(item_data.get('controlling_checked'))

            confirmed = item_data.get('confirmed_price')
            item = OrderItem.objects.create(order=order, **item_data)
            if order.status == 'bestaetigt' and confirmed is None:
                # default confirmed price to the current final_price
                item.confirmed_price = item.final_price
                item.save()

        # Compute and store confirmed_total based on item confirmed_price (or final_price fallback)
        total = 0
        for it in order.items.all():
            cp = it.confirmed_price if it.confirmed_price is not None else it.final_price
            total += (cp * it.quantity)
        order.confirmed_total = total
        order.save()

        return order
    
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        import json
        if isinstance(items_data, str):
            try:
                items_data = json.loads(items_data)
            except Exception:
                items_data = None

        # Update Order fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update Items: smarter merge to preserve confirmed_price when appropriate
        if items_data is not None:
            existing = {it.id: it for it in instance.items.all()}
            processed_ids = set()

            # helper to coerce booleans
            def _to_bool(v):
                if isinstance(v, bool):
                    return v
                if isinstance(v, (int, float)):
                    return bool(v)
                if isinstance(v, str):
                    return v.lower() in ('true', '1', 'yes', 'on')
                return False

            for item_data in items_data:
                # allow id as str or int and coerce
                raw_id = item_data.get('id')
                try:
                    item_id = int(raw_id) if raw_id is not None else None
                except (TypeError, ValueError):
                    item_id = None

                if item_id and item_id in existing:
                    item = existing[item_id]

                    # apply changes but do NOT overwrite the primary key
                    for key, val in item_data.items():
                        if key == 'id':
                            continue
                        if key == 'controlling_checked':
                            setattr(item, key, _to_bool(val))
                        else:
                            setattr(item, key, val)

                    # If order already confirmed and no confirmed_price provided, preserve existing
                    if instance.status == 'bestaetigt' and item_data.get('confirmed_price') is None and item.confirmed_price is not None:
                        pass
                    elif instance.status == 'bestaetigt' and item.confirmed_price is None:
                        item.confirmed_price = item.final_price
                    item.save()
                    processed_ids.add(item_id)
                else:
                    # new item
                    # avoid passing 'id' into create() (may cause PK confusion)
                    new_item_data = dict(item_data)
                    new_item_data.pop('id', None)

                    # coerce controlling_checked on new items
                    if 'controlling_checked' in new_item_data:
                        new_item_data['controlling_checked'] = _to_bool(new_item_data.get('controlling_checked'))
                    new_item = OrderItem.objects.create(order=instance, **new_item_data)
                    if instance.status == 'bestaetigt' and new_item.confirmed_price is None:
                        new_item.confirmed_price = new_item.final_price
                        new_item.save()

            # delete items removed in payload
            for existing_id, existing_item in existing.items():
                if existing_id not in processed_ids:
                    if instance.status == 'bestaetigt':
                        # keep historical confirmed items; set quantity to 0 to mark removal
                        existing_item.quantity = 0
                        existing_item.save()
                    else:
                        existing_item.delete()

        # Recompute confirmed_total based on current items (confirmed_price fallback to final_price)
        total = 0
        for it in instance.items.all():
            cp = it.confirmed_price if it.confirmed_price is not None else it.final_price
            total += (cp * it.quantity)
        instance.confirmed_total = total
        instance.save()

        return instance
