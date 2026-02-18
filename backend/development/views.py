from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q, Sum, Max
from django.db import models
from django.utils import timezone
from django.http import Http404, FileResponse
from datetime import datetime, date, timedelta
from decimal import Decimal

from core.permissions import DevelopmentProjectPermission

from .models import (
    DevelopmentProject, DevelopmentProjectTodo, DevelopmentProjectComment,
    DevelopmentProjectMaterialItem, DevelopmentProjectCostCalculation,
    DevelopmentProjectAttachment, DevelopmentProjectTimeEntry
)
from .serializers import (
    DevelopmentProjectListSerializer, DevelopmentProjectDetailSerializer,
    DevelopmentProjectCreateUpdateSerializer, DevelopmentProjectTodoSerializer,
    DevelopmentProjectCommentSerializer, DevelopmentProjectMaterialItemSerializer,
    DevelopmentProjectCostCalculationSerializer, DevelopmentProjectAttachmentSerializer,
    DevelopmentProjectTimeEntrySerializer
)


class DevelopmentProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Entwicklungsprojekte
    """
    queryset = DevelopmentProject.objects.all()
    permission_classes = [IsAuthenticated, DevelopmentProjectPermission]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return DevelopmentProjectListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return DevelopmentProjectCreateUpdateSerializer
        return DevelopmentProjectDetailSerializer
    
    def get_queryset(self):
        queryset = DevelopmentProject.objects.all()
        
        # Filter nach Status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter nach offenen/geschlossenen Projekten
        is_open = self.request.query_params.get('is_open', None)
        if is_open is not None:
            if is_open.lower() == 'true':
                queryset = queryset.exclude(status__in=['completed', 'rejected'])
            else:
                queryset = queryset.filter(status__in=['completed', 'rejected'])
        
        # Filter nach zugewiesenem Benutzer
        assigned_to = self.request.query_params.get('assigned_to', None)
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        
        # Suche
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(project_number__icontains=search) |
                Q(name__icontains=search) |
                Q(description__icontains=search)
            )
        
        # Sortierung
        ordering = self.request.query_params.get('ordering', '-updated_at')
        queryset = queryset.order_by(ordering)
        
        return queryset.select_related('assigned_to', 'created_by')
    
    def perform_create(self, serializer):
        old_assigned_to = None
        project = serializer.save(created_by=self.request.user)
        
        # Notification bei Zuweisung
        if project.assigned_to and project.assigned_to != self.request.user:
            self._create_assignment_notification(project)
    
    def perform_update(self, serializer):
        old_assigned_to = serializer.instance.assigned_to
        project = serializer.save()
        
        # Notification bei Zuweisung an neuen User
        if project.assigned_to and project.assigned_to != old_assigned_to:
            if project.assigned_to != self.request.user:
                self._create_assignment_notification(project)
    
    def _create_assignment_notification(self, project):
        """Erstellt eine Benachrichtigung bei Zuweisung"""
        try:
            from users.models import Notification, Reminder
            
            # Notification erstellen
            Notification.objects.create(
                user=project.assigned_to,
                title=f"Entwicklungsprojekt {project.project_number} zugewiesen",
                message=f"Das Projekt '{project.name}' wurde Ihnen zugewiesen.",
                notification_type='info',
                related_url=f'/development/projects/{project.id}'
            )
            
            # Reminder erstellen
            Reminder.objects.create(
                user=project.assigned_to,
                title=f"Zugewiesen: Entwicklungsprojekt {project.project_number}",
                description=f"Projekt '{project.name}' wurde Ihnen zugewiesen.",
                due_date=timezone.now().date() + timedelta(days=1),
                related_object_type='development_project',
                related_object_id=project.id,
                related_url=f"/development/projects/{project.id}"
            )
        except Exception as e:
            # Fehler bei Notification sollte nicht den Hauptvorgang stoppen
            print(f"Fehler bei Notification-Erstellung: {e}")
    
    # ============================================
    # TODO ACTIONS
    # ============================================
    
    @action(detail=True, methods=['post'])
    def add_todo(self, request, pk=None):
        """Fügt einen ToDo-Eintrag hinzu"""
        project = self.get_object()
        text = request.data.get('text', '').strip()
        
        if not text:
            return Response(
                {'error': 'ToDo-Text darf nicht leer sein'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Position ermitteln
        max_position = project.todos.aggregate(max_pos=Max('position'))['max_pos'] or 0
        
        todo = DevelopmentProjectTodo.objects.create(
            project=project,
            text=text,
            position=max_position + 1,
            created_by=request.user
        )
        
        serializer = DevelopmentProjectTodoSerializer(todo)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['patch'], url_path='update_todo/(?P<todo_id>[^/.]+)')
    def update_todo(self, request, pk=None, todo_id=None):
        """Aktualisiert einen ToDo-Eintrag"""
        project = self.get_object()
        try:
            todo = DevelopmentProjectTodo.objects.get(id=todo_id, project=project)
        except DevelopmentProjectTodo.DoesNotExist:
            raise Http404("ToDo nicht gefunden")
        
        if 'text' in request.data:
            todo.text = request.data['text']
        if 'is_completed' in request.data:
            todo.is_completed = request.data['is_completed']
        if 'position' in request.data:
            todo.position = request.data['position']
        
        todo.save()
        
        serializer = DevelopmentProjectTodoSerializer(todo)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_todo/(?P<todo_id>[^/.]+)')
    def delete_todo(self, request, pk=None, todo_id=None):
        """Löscht einen ToDo-Eintrag"""
        project = self.get_object()
        try:
            todo = DevelopmentProjectTodo.objects.get(id=todo_id, project=project)
            todo.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DevelopmentProjectTodo.DoesNotExist:
            raise Http404("ToDo nicht gefunden")
    
    # ============================================
    # COMMENT ACTIONS
    # ============================================
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Fügt einen Kommentar hinzu"""
        project = self.get_object()
        comment_text = request.data.get('comment', '').strip()
        
        if not comment_text:
            return Response(
                {'error': 'Kommentar darf nicht leer sein'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comment = DevelopmentProjectComment.objects.create(
            project=project,
            comment=comment_text,
            created_by=request.user
        )
        
        serializer = DevelopmentProjectCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='delete_comment/(?P<comment_id>[^/.]+)')
    def delete_comment(self, request, pk=None, comment_id=None):
        """Löscht einen Kommentar"""
        project = self.get_object()
        try:
            comment = DevelopmentProjectComment.objects.get(id=comment_id, project=project)
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DevelopmentProjectComment.DoesNotExist:
            raise Http404("Kommentar nicht gefunden")
    
    # ============================================
    # MATERIAL ITEM ACTIONS
    # ============================================
    
    @action(detail=True, methods=['post'])
    def add_material_item(self, request, pk=None):
        """Fügt eine Material-Position hinzu"""
        project = self.get_object()
        material_supply_id = request.data.get('material_supply')
        quantity = request.data.get('quantity', 1)
        notes = request.data.get('notes', '')
        
        if not material_supply_id:
            return Response(
                {'error': 'Material muss angegeben werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Position ermitteln
        from django.db.models import Max
        max_position = project.material_items.aggregate(max_pos=Max('position'))['max_pos'] or 0
        
        item = DevelopmentProjectMaterialItem.objects.create(
            project=project,
            material_supply_id=material_supply_id,
            quantity=quantity,
            position=max_position + 1,
            notes=notes
        )
        
        serializer = DevelopmentProjectMaterialItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['patch'], url_path='update_material_item/(?P<item_id>[^/.]+)')
    def update_material_item(self, request, pk=None, item_id=None):
        """Aktualisiert eine Material-Position"""
        project = self.get_object()
        try:
            item = DevelopmentProjectMaterialItem.objects.get(id=item_id, project=project)
        except DevelopmentProjectMaterialItem.DoesNotExist:
            raise Http404("Material-Position nicht gefunden")
        
        if 'quantity' in request.data:
            item.quantity = int(request.data['quantity'])
        if 'notes' in request.data:
            item.notes = request.data['notes']
        if 'position' in request.data:
            item.position = request.data['position']
        
        item.save()
        
        serializer = DevelopmentProjectMaterialItemSerializer(item)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_material_item/(?P<item_id>[^/.]+)')
    def delete_material_item(self, request, pk=None, item_id=None):
        """Löscht eine Material-Position"""
        project = self.get_object()
        try:
            item = DevelopmentProjectMaterialItem.objects.get(id=item_id, project=project)
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DevelopmentProjectMaterialItem.DoesNotExist:
            raise Http404("Material-Position nicht gefunden")
    
    # ============================================
    # COST CALCULATION ACTIONS
    # ============================================
    
    @action(detail=True, methods=['post'])
    def add_cost_calculation(self, request, pk=None):
        """Fügt eine Kostenkalkulation hinzu"""
        project = self.get_object()
        
        calc = DevelopmentProjectCostCalculation.objects.create(
            project=project,
            name=request.data.get('name', 'Standard'),
            labor_hours=Decimal(str(request.data.get('labor_hours', 0))),
            labor_rate=Decimal(str(request.data.get('labor_rate', 65))),
            development_cost_total=Decimal(str(request.data.get('development_cost_total', 0))),
            expected_sales_volume=int(request.data.get('expected_sales_volume', 1)),
            notes=request.data.get('notes', ''),
            created_by=request.user
        )
        
        serializer = DevelopmentProjectCostCalculationSerializer(calc)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['patch'], url_path='update_cost_calculation/(?P<calc_id>[^/.]+)')
    def update_cost_calculation(self, request, pk=None, calc_id=None):
        """Aktualisiert eine Kostenkalkulation"""
        project = self.get_object()
        try:
            calc = DevelopmentProjectCostCalculation.objects.get(id=calc_id, project=project)
        except DevelopmentProjectCostCalculation.DoesNotExist:
            raise Http404("Kostenkalkulation nicht gefunden")
        
        updatable_fields = [
            'name', 'is_active', 'labor_hours', 'labor_rate',
            'development_cost_total', 'expected_sales_volume', 'notes'
        ]
        decimal_fields = {'labor_hours', 'labor_rate', 'development_cost_total'}
        int_fields = {'expected_sales_volume'}
        
        for field in updatable_fields:
            if field in request.data:
                value = request.data[field]
                if field in decimal_fields:
                    value = Decimal(str(value))
                elif field in int_fields:
                    value = int(value)
                setattr(calc, field, value)
        
        calc.save()  # Triggers recalculate()
        
        serializer = DevelopmentProjectCostCalculationSerializer(calc)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_cost_calculation/(?P<calc_id>[^/.]+)')
    def delete_cost_calculation(self, request, pk=None, calc_id=None):
        """Löscht eine Kostenkalkulation"""
        project = self.get_object()
        try:
            calc = DevelopmentProjectCostCalculation.objects.get(id=calc_id, project=project)
            calc.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DevelopmentProjectCostCalculation.DoesNotExist:
            raise Http404("Kostenkalkulation nicht gefunden")
    
    @action(detail=True, methods=['post'], url_path='create_vshardware_from_materials')
    def create_vshardware_from_materials(self, request, pk=None):
        """Erstellt eine neue VS-Hardware aus der Materialliste"""
        project = self.get_object()
        
        try:
            from manufacturing.models import VSHardware, VSHardwareMaterialItem
            
            # VS-Hardware erstellen
            vs_hardware = VSHardware.objects.create(
                name=request.data.get('name', f"Aus {project.project_number}"),
                description=request.data.get('description', f"Erstellt aus Entwicklungsprojekt {project.project_number}"),
                created_by=request.user
            )
            
            # Material-Positionen kopieren
            new_items = []
            for item in project.material_items.all():
                new_item = VSHardwareMaterialItem.objects.create(
                    vs_hardware=vs_hardware,
                    material_supply=item.material_supply,
                    quantity=item.quantity,
                    position=item.position,
                    notes=item.notes
                )
                new_items.append(new_item)
            
            return Response({
                'message': f'VS-Hardware {vs_hardware.part_number} erfolgreich erstellt',
                'vs_hardware_id': vs_hardware.id,
                'vs_hardware_part_number': vs_hardware.part_number,
                'material_items_count': len(new_items)
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Fehler beim Erstellen der VS-Hardware: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # ============================================
    # FILE ATTACHMENT ACTIONS
    # ============================================
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_attachment(self, request, pk=None):
        """Lädt einen Dateianhang hoch"""
        project = self.get_object()
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response(
                {'error': 'Keine Datei hochgeladen'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        attachment = DevelopmentProjectAttachment.objects.create(
            project=project,
            file=file_obj,
            filename=file_obj.name,
            file_size=file_obj.size,
            content_type=file_obj.content_type or '',
            uploaded_by=request.user
        )
        
        serializer = DevelopmentProjectAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path='delete_attachment/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Löscht einen Dateianhang"""
        project = self.get_object()
        try:
            attachment = DevelopmentProjectAttachment.objects.get(id=attachment_id, project=project)
            # Datei vom Dateisystem löschen
            if attachment.file:
                attachment.file.delete(save=False)
            attachment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DevelopmentProjectAttachment.DoesNotExist:
            raise Http404("Anhang nicht gefunden")
    
    @action(detail=True, methods=['get'], url_path='download_attachment/(?P<attachment_id>[^/.]+)')
    def download_attachment(self, request, pk=None, attachment_id=None):
        """Lädt einen Dateianhang herunter"""
        project = self.get_object()
        try:
            attachment = DevelopmentProjectAttachment.objects.get(id=attachment_id, project=project)
            if attachment.file:
                response = FileResponse(attachment.file.open('rb'), as_attachment=True)
                response['Content-Disposition'] = f'attachment; filename="{attachment.filename}"'
                return response
            raise Http404("Datei nicht gefunden")
        except DevelopmentProjectAttachment.DoesNotExist:
            raise Http404("Anhang nicht gefunden")
    
    # ============================================
    # TIME ENTRY ACTIONS
    # ============================================
    
    @action(detail=True, methods=['post'])
    def add_time_entry(self, request, pk=None):
        """Fügt einen Zeiteintrag hinzu"""
        project = self.get_object()
        
        entry_date = request.data.get('date') or date.today().isoformat()
        entry_time = request.data.get('time') or datetime.now().strftime('%H:%M:%S')
        employee_id = request.data.get('employee', request.user.id)
        hours_spent = request.data.get('hours_spent')
        description = request.data.get('description', '').strip()
        
        if not hours_spent:
            return Response(
                {'error': 'Aufgewendete Zeit ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not description:
            return Response(
                {'error': 'Beschreibung ist erforderlich'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        time_entry = DevelopmentProjectTimeEntry.objects.create(
            project=project,
            date=entry_date,
            time=entry_time,
            employee_id=employee_id,
            hours_spent=hours_spent,
            description=description,
            created_by=request.user
        )
        
        serializer = DevelopmentProjectTimeEntrySerializer(time_entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['patch'], url_path='update_time_entry/(?P<entry_id>[^/.]+)')
    def update_time_entry(self, request, pk=None, entry_id=None):
        """Aktualisiert einen Zeiteintrag"""
        project = self.get_object()
        try:
            entry = DevelopmentProjectTimeEntry.objects.get(id=entry_id, project=project)
        except DevelopmentProjectTimeEntry.DoesNotExist:
            raise Http404("Zeiteintrag nicht gefunden")
        
        if 'date' in request.data:
            entry.date = request.data['date']
        if 'time' in request.data:
            entry.time = request.data['time']
        if 'employee' in request.data:
            entry.employee_id = request.data['employee']
        if 'hours_spent' in request.data:
            entry.hours_spent = request.data['hours_spent']
        if 'description' in request.data:
            entry.description = request.data['description']
        
        entry.save()
        
        serializer = DevelopmentProjectTimeEntrySerializer(entry)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_time_entry/(?P<entry_id>[^/.]+)')
    def delete_time_entry(self, request, pk=None, entry_id=None):
        """Löscht einen Zeiteintrag"""
        project = self.get_object()
        try:
            entry = DevelopmentProjectTimeEntry.objects.get(id=entry_id, project=project)
            entry.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DevelopmentProjectTimeEntry.DoesNotExist:
            raise Http404("Zeiteintrag nicht gefunden")


class DevelopmentProjectMaterialItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Material-Positionen (für Batch-Operationen)
    """
    queryset = DevelopmentProjectMaterialItem.objects.all()
    serializer_class = DevelopmentProjectMaterialItemSerializer
    permission_classes = [IsAuthenticated, DevelopmentProjectPermission]
    
    def get_queryset(self):
        queryset = DevelopmentProjectMaterialItem.objects.all()
        project_id = self.request.query_params.get('project', None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset.select_related('material_supply', 'project')
    
    @action(detail=False, methods=['post'])
    def batch_update(self, request):
        """Batch-Update für mehrere Material-Positionen"""
        items_data = request.data.get('items', [])
        updated_items = []
        
        for item_data in items_data:
            try:
                if item_data.get('id'):
                    item = DevelopmentProjectMaterialItem.objects.get(pk=item_data.get('id'))
                    for field in ['quantity', 'position', 'notes']:
                        if field in item_data:
                            setattr(item, field, item_data[field])
                    item.save()
                    updated_items.append(item)
            except DevelopmentProjectMaterialItem.DoesNotExist:
                continue
        
        serializer = DevelopmentProjectMaterialItemSerializer(updated_items, many=True)
        return Response(serializer.data)
