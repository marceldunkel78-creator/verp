from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from core.permissions import ModulePermission
from .models import (
    DemoSystem,
    DemoDevice,
    DemoConnection,
    DemoDeviceComponent,
    DemoChangeLog,
    DemoBooking,
    DemoConfigTemplate,
)
from .serializers import (
    DemoSystemListSerializer,
    DemoSystemDetailSerializer,
    DemoSystemCreateUpdateSerializer,
    DemoDeviceSerializer,
    DemoDeviceCreateUpdateSerializer,
    DemoConnectionSerializer,
    DemoDeviceComponentSerializer,
    DemoChangeLogSerializer,
    DemoChangeLogCommentSerializer,
    DemoBookingSerializer,
    DemoConfigTemplateSerializer,
    DemoConfigTemplateListSerializer,
)
from .audit import log_change, log_field_changes


class DemoSystemPermission(ModulePermission):
    """Berechtigungen für Demo-Systeme (Untermodul Warenlager)"""
    def has_permission(self, request, view):
        view.read_permission = 'can_read_inventory_demo_systems'
        view.write_permission = 'can_write_inventory_demo_systems'
        view.main_read_permission = 'can_read_inventory'
        view.main_write_permission = 'can_write_inventory'
        return super().has_permission(request, view)


# ---------------------------------------------------------------------------
# Feld-Labels für das Änderungsprotokoll
# ---------------------------------------------------------------------------

SYSTEM_FIELD_LABELS = {
    'name': 'Name',
    'description': 'Beschreibung',
    'location': 'Standort',
    'responsible_employee': 'Zuständiger Mitarbeiter',
    'is_active': 'Aktiv',
}

DEVICE_FIELD_LABELS = {
    'inventory_item': 'Lagerartikel',
    'device_type': 'Gerätetyp',
    'name': 'Bezeichnung',
    'manufacturer': 'Hersteller',
    'serial_number': 'Seriennummer',
    'properties': 'Grundeigenschaften',
    'notes': 'Notizen',
    'position_x': 'Position X',
    'position_y': 'Position Y',
}

COMPONENT_FIELD_LABELS = {
    'component_type': 'Komponententyp',
    'name': 'Bezeichnung',
    'position': 'Position',
    'slots': 'Belegung',
    'value': 'Wert',
    'comment': 'Kommentar',
}

BOOKING_FIELD_LABELS = {
    'title': 'Zweck/Titel',
    'customer': 'Kunde',
    'reserved_by': 'Gebucht von',
    'start_date': 'Beginn',
    'end_date': 'Ende',
    'notes': 'Notizen',
    'is_cancelled': 'Storniert',
}

# Felder, deren Werte als Text protokolliert werden (Diff-Tracking)
TRACKED_FIELDS = {
    'system': list(SYSTEM_FIELD_LABELS.keys()),
    'device': list(DEVICE_FIELD_LABELS.keys()),
    'component': list(COMPONENT_FIELD_LABELS.keys()),
    'booking': list(BOOKING_FIELD_LABELS.keys()),
}


def _snapshot(instance, entity_type):
    """Liest die zu trackenden Felder eines Objekts als Dict aus."""
    values = {}
    for field in TRACKED_FIELDS[entity_type]:
        values[field] = getattr(instance, field)
    return values


def _entity_label(instance, entity_type):
    if entity_type == 'system':
        return f"{instance.demo_number} {instance.name}"
    if entity_type == 'device':
        return f"{instance.get_device_type_display()} {instance.name}"
    if entity_type == 'component':
        return f"{instance.name} ({instance.get_component_type_display()})"
    if entity_type == 'booking':
        return instance.title
    return str(instance)


# ---------------------------------------------------------------------------
# Demo-System
# ---------------------------------------------------------------------------

class DemoSystemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DemoSystemPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'status', 'responsible_employee']
    search_fields = ['demo_number', 'name', 'description', 'location']
    ordering_fields = ['demo_number', 'name', 'created_at', 'updated_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return DemoSystem.objects.select_related(
            'responsible_employee', 'created_by', 'updated_by'
        ).prefetch_related('devices', 'connections', 'bookings', 'change_logs')

    def get_serializer_class(self):
        if self.action == 'list':
            return DemoSystemListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return DemoSystemCreateUpdateSerializer
        return DemoSystemDetailSerializer

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_change(
            demo_system=instance, entity_type='system', entity_id=instance.id,
            entity_label=_entity_label(instance, 'system'), action='created',
            user=self.request.user,
        )

    def perform_update(self, serializer):
        old = _snapshot(self.get_object(), 'system')
        instance = serializer.save(updated_by=self.request.user)
        log_field_changes(
            demo_system=instance, entity_type='system', entity_id=instance.id,
            entity_label=_entity_label(instance, 'system'), user=self.request.user,
            old_values=old, new_values=_snapshot(instance, 'system'),
            field_labels=SYSTEM_FIELD_LABELS,
            status_field='__none__',  # Status wird über set_status gesondert protokolliert
        )

    def perform_destroy(self, instance):
        label = _entity_label(instance, 'system')
        log_change(
            demo_system=instance, entity_type='system', entity_id=instance.id,
            entity_label=label, action='deleted', user=self.request.user,
        )
        instance.delete()

    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        """Setzt den Gesamt-Status des Demo-Systems mit Protokolleintrag."""
        demo_system = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(DemoSystem.STATUS_CHOICES):
            return Response(
                {'detail': 'Ungültiger Status.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        old_status = demo_system.status
        if old_status != new_status:
            demo_system.status = new_status
            demo_system.updated_by = request.user
            demo_system.save(update_fields=['status', 'updated_by', 'updated_at'])
            status_labels = dict(DemoSystem.STATUS_CHOICES)
            log_change(
                demo_system=demo_system, entity_type='system',
                entity_id=demo_system.id,
                entity_label=_entity_label(demo_system, 'system'),
                action='status_changed', user=request.user,
                field_name='Status',
                old_value=status_labels.get(old_status, old_status),
                new_value=status_labels.get(new_status, new_status),
            )
        return Response(DemoSystemDetailSerializer(demo_system).data)

    @action(detail=True, methods=['get'])
    def change_log(self, request, pk=None):
        """Änderungsprotokoll dieses Demo-Systems (max. 200 Einträge)."""
        demo_system = self.get_object()
        logs = demo_system.change_logs.select_related(
            'changed_by', 'comment_by'
        ).order_by('-changed_at', '-id')[:200]
        serializer = DemoChangeLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def save_as_template(self, request, pk=None):
        """Speichert die aktuelle Konfiguration als benannte Vorlage."""
        demo_system = self.get_object()
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response(
                {'detail': 'Name der Vorlage ist erforderlich.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if DemoConfigTemplate.objects.filter(name=name).exists():
            return Response(
                {'detail': f'Eine Vorlage mit dem Namen "{name}" existiert bereits.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = build_config_snapshot(demo_system)
        template = DemoConfigTemplate.objects.create(
            name=name,
            description=request.data.get('description', ''),
            is_default=bool(request.data.get('is_default', False)),
            data=data,
            created_by=request.user,
            updated_by=request.user,
        )
        log_change(
            demo_system=demo_system, entity_type='system', entity_id=demo_system.id,
            entity_label=_entity_label(demo_system, 'system'), action='created',
            user=request.user, field_name='Konfigurationsvorlage',
            new_value=f'Vorlage "{name}" gespeichert',
        )
        return Response(DemoConfigTemplateSerializer(template).data)

    @action(detail=True, methods=['post'])
    def restore_template(self, request, pk=None):
        """Stellt eine gespeicherte Vorlage auf diesem Demo-System wieder her."""
        demo_system = self.get_object()
        template_id = request.data.get('template')
        try:
            template = DemoConfigTemplate.objects.get(pk=template_id)
        except DemoConfigTemplate.DoesNotExist:
            return Response(
                {'detail': 'Vorlage nicht gefunden.'},
                status=status.HTTP_404_NOT_FOUND
            )

        apply_config_snapshot(demo_system, template.data, request.user)
        log_change(
            demo_system=demo_system, entity_type='system', entity_id=demo_system.id,
            entity_label=_entity_label(demo_system, 'system'), action='updated',
            user=request.user, field_name='Konfiguration',
            new_value=f'Vorlage "{template.name}" wiederhergestellt',
        )
        # Aktualisierte Konfiguration zurückgeben
        demo_system = self.get_queryset().get(pk=demo_system.pk)
        return Response(DemoSystemDetailSerializer(demo_system).data)


# ---------------------------------------------------------------------------
# Snapshot-Helfer für Konfigurationsvorlagen
# ---------------------------------------------------------------------------

def build_config_snapshot(demo_system):
    """Erzeugt einen JSON-Snapshot der kompletten Setup-Konfiguration."""
    devices = []
    components = []
    for device in demo_system.devices.all():
        devices.append({
            'device_type': device.device_type,
            'name': device.name,
            'manufacturer': device.manufacturer,
            'serial_number': device.serial_number,
            'properties': device.properties,
            'notes': device.notes,
            'status': device.status,
            'position_x': device.position_x,
            'position_y': device.position_y,
            'inventory_item_number': (
                device.inventory_item.inventory_number if device.inventory_item else None
            ),
        })
        for comp in device.components.all():
            components.append({
                'device_name': device.name,
                'component_type': comp.component_type,
                'name': comp.name,
                'position': comp.position,
                'slots': comp.slots,
                'value': comp.value,
                'comment': comp.comment,
            })

    connections = []
    for conn in demo_system.connections.all():
        connections.append({
            'from_device_name': conn.from_device.name,
            'from_side': conn.from_side,
            'to_device_name': conn.to_device.name,
            'to_side': conn.to_side,
        })

    return {
        'system': {
            'name': demo_system.name,
            'description': demo_system.description,
            'location': demo_system.location,
        },
        'devices': devices,
        'components': components,
        'connections': connections,
    }


def apply_config_snapshot(demo_system, data, user):
    """
    Stellt einen Snapshot wieder her. Vorhandene Geräte/Verbindungen/Komponenten
    werden ersetzt (Löschen + Neu-Anlegen), damit die Konfiguration exakt der
    Vorlage entspricht. Lagerartikel-Verknüpfungen werden über die
    Lagerartikelnummer wiederhergestellt (falls noch vorhanden).
    """
    from inventory.models import InventoryItem

    # Alte Struktur löschen (wird protokolliert)
    for conn in demo_system.connections.all():
        log_change(
            demo_system=demo_system, entity_type='connection', entity_id=conn.id,
            entity_label=str(conn), action='disconnected', user=user,
        )
    demo_system.connections.all().delete()

    for device in demo_system.devices.all():
        log_change(
            demo_system=demo_system, entity_type='device', entity_id=device.id,
            entity_label=_entity_label(device, 'device'), action='deleted', user=user,
        )
    demo_system.devices.all().delete()

    # System-Felder aus Vorlage
    sys_data = (data or {}).get('system', {})
    for field in ['name', 'description', 'location']:
        if field in sys_data:
            setattr(demo_system, field, sys_data[field])
    demo_system.updated_by = user
    demo_system.save()

    # Geräte + Komponenten neu anlegen
    device_map = {}
    for dev_data in (data or {}).get('devices', []):
        inventory_item = None
        inv_number = dev_data.get('inventory_item_number')
        if inv_number:
            inventory_item = InventoryItem.objects.filter(
                inventory_number=inv_number
            ).first()

        device = DemoDevice.objects.create(
            demo_system=demo_system,
            inventory_item=inventory_item,
            device_type=dev_data.get('device_type', 'custom'),
            name=dev_data.get('name', ''),
            manufacturer=dev_data.get('manufacturer', ''),
            serial_number=dev_data.get('serial_number', ''),
            properties=dev_data.get('properties', {}) or {},
            notes=dev_data.get('notes', ''),
            status=dev_data.get('status', 'active'),
            position_x=dev_data.get('position_x', 0),
            position_y=dev_data.get('position_y', 0),
            created_by=user,
            updated_by=user,
        )
        device_map[device.name] = device
        log_change(
            demo_system=demo_system, entity_type='device', entity_id=device.id,
            entity_label=_entity_label(device, 'device'), action='created', user=user,
        )

    for comp_data in (data or {}).get('components', []):
        device = device_map.get(comp_data.get('device_name'))
        if not device:
            continue
        comp = DemoDeviceComponent.objects.create(
            device=device,
            component_type=comp_data.get('component_type', 'custom'),
            name=comp_data.get('name', ''),
            position=comp_data.get('position', 1),
            slots=comp_data.get('slots', {}) or {},
            value=comp_data.get('value', ''),
            comment=comp_data.get('comment', ''),
            created_by=user,
            updated_by=user,
        )
        log_change(
            demo_system=demo_system, entity_type='component', entity_id=comp.id,
            entity_label=_entity_label(comp, 'component'), action='created', user=user,
        )

    for conn_data in (data or {}).get('connections', []):
        from_device = device_map.get(conn_data.get('from_device_name'))
        to_device = device_map.get(conn_data.get('to_device_name'))
        if not from_device or not to_device:
            continue
        conn = DemoConnection.objects.create(
            demo_system=demo_system,
            from_device=from_device,
            from_side=conn_data.get('from_side', 'north'),
            to_device=to_device,
            to_side=conn_data.get('to_side', 'south'),
            created_by=user,
        )
        log_change(
            demo_system=demo_system, entity_type='connection', entity_id=conn.id,
            entity_label=str(conn), action='connected', user=user,
        )


# ---------------------------------------------------------------------------
# Geräte
# ---------------------------------------------------------------------------

class DemoDeviceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DemoSystemPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['demo_system', 'device_type', 'status', 'inventory_item']
    search_fields = ['name', 'manufacturer', 'serial_number']
    ordering_fields = ['id', 'name', 'device_type', 'status']
    ordering = ['id']

    def get_queryset(self):
        return DemoDevice.objects.select_related(
            'demo_system', 'inventory_item', 'created_by', 'updated_by'
        ).prefetch_related('components')

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DemoDeviceCreateUpdateSerializer
        return DemoDeviceSerializer

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_change(
            demo_system=instance.demo_system, entity_type='device',
            entity_id=instance.id, entity_label=_entity_label(instance, 'device'),
            action='created', user=self.request.user,
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        old = _snapshot(instance, 'device')
        instance = serializer.save(updated_by=self.request.user)
        log_field_changes(
            demo_system=instance.demo_system, entity_type='device',
            entity_id=instance.id, entity_label=_entity_label(instance, 'device'),
            user=self.request.user,
            old_values=old, new_values=_snapshot(instance, 'device'),
            field_labels=DEVICE_FIELD_LABELS,
            status_field='__none__',  # Status wird über set_status gesondert protokolliert
        )

    def perform_destroy(self, instance):
        log_change(
            demo_system=instance.demo_system, entity_type='device',
            entity_id=instance.id, entity_label=_entity_label(instance, 'device'),
            action='deleted', user=self.request.user,
        )
        instance.delete()

    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        """Setzt den Geräte-Status (aktiv/defekt/verliehen/abgebaut) mit Protokolleintrag."""
        device = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(DemoDevice.STATUS_CHOICES):
            return Response(
                {'detail': 'Ungültiger Status.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        old_status = device.status
        if old_status != new_status:
            device.status = new_status
            device.updated_by = request.user
            device.save(update_fields=['status', 'updated_by', 'updated_at'])
            status_labels = dict(DemoDevice.STATUS_CHOICES)
            log_change(
                demo_system=device.demo_system, entity_type='device',
                entity_id=device.id, entity_label=_entity_label(device, 'device'),
                action='status_changed', user=request.user,
                field_name='Status',
                old_value=status_labels.get(old_status, old_status),
                new_value=status_labels.get(new_status, new_status),
            )
        return Response(DemoDeviceSerializer(device).data)


# ---------------------------------------------------------------------------
# Verbindungen
# ---------------------------------------------------------------------------

class DemoConnectionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DemoSystemPermission]
    serializer_class = DemoConnectionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['demo_system', 'from_device', 'to_device']

    def get_queryset(self):
        return DemoConnection.objects.select_related(
            'demo_system', 'from_device', 'to_device', 'created_by'
        )

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_change(
            demo_system=instance.demo_system, entity_type='connection',
            entity_id=instance.id, entity_label=str(instance),
            action='connected', user=self.request.user,
        )

    def perform_destroy(self, instance):
        log_change(
            demo_system=instance.demo_system, entity_type='connection',
            entity_id=instance.id, entity_label=str(instance),
            action='disconnected', user=self.request.user,
        )
        instance.delete()


# ---------------------------------------------------------------------------
# Komponenten
# ---------------------------------------------------------------------------

class DemoDeviceComponentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DemoSystemPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['device', 'component_type']
    search_fields = ['name', 'value', 'comment']
    ordering_fields = ['position', 'id', 'name']
    ordering = ['position', 'id']

    def get_queryset(self):
        return DemoDeviceComponent.objects.select_related(
            'device', 'device__demo_system', 'created_by', 'updated_by'
        )

    def get_serializer_class(self):
        return DemoDeviceComponentSerializer

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_change(
            demo_system=instance.device.demo_system, entity_type='component',
            entity_id=instance.id, entity_label=_entity_label(instance, 'component'),
            action='created', user=self.request.user,
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        old = _snapshot(instance, 'component')
        instance = serializer.save(updated_by=self.request.user)
        log_field_changes(
            demo_system=instance.device.demo_system, entity_type='component',
            entity_id=instance.id, entity_label=_entity_label(instance, 'component'),
            user=self.request.user,
            old_values=old, new_values=_snapshot(instance, 'component'),
            field_labels=COMPONENT_FIELD_LABELS,
            status_field='__none__',
        )

    def perform_destroy(self, instance):
        log_change(
            demo_system=instance.device.demo_system, entity_type='component',
            entity_id=instance.id, entity_label=_entity_label(instance, 'component'),
            action='deleted', user=self.request.user,
        )
        instance.delete()


# ---------------------------------------------------------------------------
# Buchungen
# ---------------------------------------------------------------------------

class DemoBookingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DemoSystemPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['demo_system', 'customer', 'is_cancelled']
    search_fields = ['title', 'notes']
    ordering_fields = ['start_date', 'end_date', 'id']
    ordering = ['start_date', 'id']

    def get_queryset(self):
        return DemoBooking.objects.select_related(
            'demo_system', 'customer', 'reserved_by', 'created_by', 'updated_by'
        )

    def get_serializer_class(self):
        return DemoBookingSerializer

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_change(
            demo_system=instance.demo_system, entity_type='booking',
            entity_id=instance.id, entity_label=_entity_label(instance, 'booking'),
            action='created', user=self.request.user,
            new_value=f"{instance.start_date} - {instance.end_date}",
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        old = _snapshot(instance, 'booking')
        instance = serializer.save(updated_by=self.request.user)
        log_field_changes(
            demo_system=instance.demo_system, entity_type='booking',
            entity_id=instance.id, entity_label=_entity_label(instance, 'booking'),
            user=self.request.user,
            old_values=old, new_values=_snapshot(instance, 'booking'),
            field_labels=BOOKING_FIELD_LABELS,
            status_field='__none__',
        )

    def perform_destroy(self, instance):
        log_change(
            demo_system=instance.demo_system, entity_type='booking',
            entity_id=instance.id, entity_label=_entity_label(instance, 'booking'),
            action='deleted', user=self.request.user,
        )
        instance.delete()


# ---------------------------------------------------------------------------
# Änderungsprotokoll (read-only + Kommentar)
# ---------------------------------------------------------------------------

class DemoChangeLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, DemoSystemPermission]
    serializer_class = DemoChangeLogSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['demo_system', 'entity_type', 'action', 'changed_by']
    ordering_fields = ['changed_at', 'id']
    ordering = ['-changed_at', '-id']

    def get_queryset(self):
        # Auf die letzten 200 Änderungen begrenzen (Performance/Übersichtlichkeit)
        return DemoChangeLog.objects.select_related(
            'demo_system', 'changed_by', 'comment_by'
        ).order_by('-changed_at', '-id')[:200]

    @action(detail=True, methods=['post', 'patch'])
    def add_comment(self, request, pk=None):
        """Kommentar zu einem Protokolleintrag hinzufügen oder ändern."""
        log_entry = self.get_object()
        serializer = DemoChangeLogCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.validated_data.get('comment', '')

        old_comment = log_entry.comment
        log_entry.comment = comment
        log_entry.comment_by = request.user
        log_entry.comment_updated_at = timezone.now()
        log_entry.save(update_fields=['comment', 'comment_by', 'comment_updated_at'])

        # Kommentar-Änderung selbst protokollieren
        log_change(
            demo_system=log_entry.demo_system, entity_type=log_entry.entity_type,
            entity_id=log_entry.entity_id,
            entity_label=log_entry.entity_label or 'Protokolleintrag',
            action='comment', user=request.user,
            field_name='Kommentar',
            old_value=old_comment, new_value=comment,
        )
        return Response(DemoChangeLogSerializer(log_entry).data)


# ---------------------------------------------------------------------------
# Konfigurationsvorlagen
# ---------------------------------------------------------------------------

class DemoConfigTemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DemoSystemPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_default']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['-is_default', 'name']

    def get_queryset(self):
        return DemoConfigTemplate.objects.select_related('created_by', 'updated_by')

    def get_serializer_class(self):
        if self.action == 'list':
            return DemoConfigTemplateListSerializer
        return DemoConfigTemplateSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        if not (self.request.user.is_superuser or self.request.user.is_staff):
            raise PermissionDenied('Vorlagen können nur von Administratoren gelöscht werden.')
        instance.delete()