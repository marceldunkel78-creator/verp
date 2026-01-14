from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.http import FileResponse, Http404
from django.db import models as db_models
from .models import Project, ProjectComment, ProjectTodo, ProjectDocument, ProjectOrderPosition
from .serializers import (
    ProjectListSerializer,
    ProjectDetailSerializer,
    ProjectCreateSerializer,
    ProjectCommentSerializer,
    ProjectTodoSerializer,
    ProjectDocumentSerializer,
    ProjectOrderPositionSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Projekte mit automatischer Projektnummer
    """
    queryset = Project.objects.select_related(
        'customer', 'created_by', 'responsible_employee', 'linked_order'
    ).prefetch_related('systems', 'comments', 'todos', 'documents', 'order_positions')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'customer', 'responsible_employee']
    search_fields = ['project_number', 'name', 'description', 'customer__first_name', 'customer__last_name']
    ordering_fields = ['created_at', 'updated_at', 'project_number', 'status', 'tender_submission_deadline', 'planned_delivery_date']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        elif self.action == 'create':
            return ProjectCreateSerializer
        return ProjectDetailSerializer

    def perform_create(self, serializer):
        """Setze created_by beim Erstellen"""
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Projekt-Statistiken"""
        queryset = self.filter_queryset(self.get_queryset())
        
        total = queryset.count()
        by_status = {}
        for choice in Project.STATUS_CHOICES:
            count = queryset.filter(status=choice[0]).count()
            by_status[choice[0]] = {
                'label': choice[1],
                'count': count
            }

        return Response({
            'total': total,
            'by_status': by_status
        })

    # === Comment Actions ===
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Fügt einen Kommentar zum Projekt hinzu"""
        project = self.get_object()
        comment_text = request.data.get('comment', '').strip()
        
        if not comment_text:
            return Response(
                {'error': 'Kommentar darf nicht leer sein'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comment = ProjectComment.objects.create(
            project=project,
            comment=comment_text,
            created_by=request.user
        )
        
        serializer = ProjectCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Gibt alle Kommentare zurück"""
        project = self.get_object()
        comments = project.comments.all().order_by('-created_at')
        serializer = ProjectCommentSerializer(comments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_comment/(?P<comment_id>[^/.]+)')
    def delete_comment(self, request, pk=None, comment_id=None):
        """Löscht einen Kommentar"""
        project = self.get_object()
        try:
            comment = ProjectComment.objects.get(id=comment_id, project=project)
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProjectComment.DoesNotExist:
            raise Http404("Kommentar nicht gefunden")

    # === ToDo Actions ===
    @action(detail=True, methods=['post'])
    def add_todo(self, request, pk=None):
        """Fügt ein ToDo zum Projekt hinzu"""
        project = self.get_object()
        text = request.data.get('text', '').strip()
        
        if not text:
            return Response(
                {'error': 'ToDo-Text darf nicht leer sein'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get next position
        max_position = project.todos.aggregate(db_models.Max('position'))['position__max'] or 0
        
        todo = ProjectTodo.objects.create(
            project=project,
            text=text,
            position=max_position + 1,
            created_by=request.user
        )
        
        serializer = ProjectTodoSerializer(todo)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def todos(self, request, pk=None):
        """Gibt alle ToDos zurück"""
        project = self.get_object()
        todos = project.todos.all().order_by('position', 'created_at')
        serializer = ProjectTodoSerializer(todos, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'], url_path='update_todo/(?P<todo_id>[^/.]+)')
    def update_todo(self, request, pk=None, todo_id=None):
        """Aktualisiert ein ToDo"""
        project = self.get_object()
        try:
            todo = ProjectTodo.objects.get(id=todo_id, project=project)
        except ProjectTodo.DoesNotExist:
            raise Http404("ToDo nicht gefunden")
        
        if 'is_completed' in request.data:
            todo.is_completed = request.data['is_completed']
        if 'text' in request.data:
            todo.text = request.data['text']
        if 'position' in request.data:
            todo.position = request.data['position']
        
        todo.save()
        serializer = ProjectTodoSerializer(todo)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_todo/(?P<todo_id>[^/.]+)')
    def delete_todo(self, request, pk=None, todo_id=None):
        """Löscht ein ToDo"""
        project = self.get_object()
        try:
            todo = ProjectTodo.objects.get(id=todo_id, project=project)
            todo.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProjectTodo.DoesNotExist:
            raise Http404("ToDo nicht gefunden")

    # === Document Actions ===
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_document(self, request, pk=None):
        """Lädt ein Dokument für das Projekt hoch"""
        project = self.get_object()
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({'error': 'Keine Datei hochgeladen'}, status=status.HTTP_400_BAD_REQUEST)
        
        document = ProjectDocument.objects.create(
            project=project,
            file=file_obj,
            filename=file_obj.name,
            file_size=file_obj.size,
            content_type=file_obj.content_type or '',
            description=request.data.get('description', ''),
            uploaded_by=request.user
        )
        
        serializer = ProjectDocumentSerializer(document, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        """Gibt alle Dokumente zurück"""
        project = self.get_object()
        documents = project.documents.all().order_by('-uploaded_at')
        serializer = ProjectDocumentSerializer(documents, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'], url_path='delete_document/(?P<document_id>[^/.]+)')
    def delete_document(self, request, pk=None, document_id=None):
        """Löscht ein Dokument"""
        project = self.get_object()
        try:
            document = ProjectDocument.objects.get(id=document_id, project=project)
            document.file.delete()
            document.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProjectDocument.DoesNotExist:
            raise Http404("Dokument nicht gefunden")
    
    @action(detail=True, methods=['get'], url_path='download_document/(?P<document_id>[^/.]+)')
    def download_document(self, request, pk=None, document_id=None):
        """Lädt ein Dokument herunter"""
        project = self.get_object()
        try:
            document = ProjectDocument.objects.get(id=document_id, project=project)
            return FileResponse(document.file.open('rb'), 
                              as_attachment=True, 
                              filename=document.filename)
        except ProjectDocument.DoesNotExist:
            raise Http404("Dokument nicht gefunden")

    # === Order Processing Actions ===
    @action(detail=True, methods=['get'])
    def order_items(self, request, pk=None):
        """Gibt alle Auftragspositionen des verknüpften Auftrags zurück"""
        project = self.get_object()
        
        if not project.linked_order:
            return Response({'items': [], 'message': 'Kein Auftrag verknüpft'})
        
        from customer_orders.models import CustomerOrderItem
        from customer_orders.serializers import CustomerOrderItemDetailSerializer
        
        items = CustomerOrderItem.objects.filter(order=project.linked_order).order_by('position')
        
        # Group items by product type and manufacturer
        grouped_items = {
            'trading_goods': {},  # Grouped by manufacturer
            'vs_hardware': [],
            'visiview': [],
            'other': []
        }
        
        for item in items:
            # Check if position tracking exists
            position_tracking, created = ProjectOrderPosition.objects.get_or_create(
                project=project,
                order_item=item
            )
            
            item_data = {
                'id': item.id,
                'position': item.position,
                'description': item.description,
                'quantity': str(item.quantity),
                'unit_price': str(item.unit_price),
                'content_type': item.content_type.model if item.content_type else None,
                'object_id': item.object_id,
                'supplier_order_created': position_tracking.supplier_order_created,
                'production_order_created': position_tracking.production_order_created,
                'visiview_order_created': position_tracking.visiview_order_created,
                'supplier_order_id': position_tracking.supplier_order_id,
                'production_order_id': position_tracking.production_order_id,
            }
            
            # Get product details
            if item.content_type:
                if item.content_type.model == 'tradingproduct':
                    from suppliers.models import TradingProduct
                    try:
                        product = TradingProduct.objects.get(id=item.object_id)
                        manufacturer = product.supplier.name if product.supplier else 'Unbekannt'
                        item_data['manufacturer'] = manufacturer
                        item_data['product_name'] = product.name
                        item_data['product_number'] = product.visitron_part_number
                        
                        if manufacturer not in grouped_items['trading_goods']:
                            grouped_items['trading_goods'][manufacturer] = []
                        grouped_items['trading_goods'][manufacturer].append(item_data)
                    except TradingProduct.DoesNotExist:
                        grouped_items['other'].append(item_data)
                
                elif item.content_type.model == 'vshardware':
                    from manufacturing.models import VSHardware
                    try:
                        product = VSHardware.objects.get(id=item.object_id)
                        item_data['product_name'] = product.name
                        item_data['product_number'] = product.visitron_part_number
                        grouped_items['vs_hardware'].append(item_data)
                    except VSHardware.DoesNotExist:
                        grouped_items['other'].append(item_data)
                
                elif item.content_type.model == 'visiviewproduct':
                    from visiview.models import VisiViewProduct
                    try:
                        product = VisiViewProduct.objects.get(id=item.object_id)
                        item_data['product_name'] = product.name
                        item_data['product_number'] = product.visitron_part_number
                        grouped_items['visiview'].append(item_data)
                    except VisiViewProduct.DoesNotExist:
                        grouped_items['other'].append(item_data)
                else:
                    grouped_items['other'].append(item_data)
            else:
                grouped_items['other'].append(item_data)
        
        return Response({
            'order_number': project.linked_order.order_number,
            'order_status': project.linked_order.status,
            'grouped_items': grouped_items
        })

    @action(detail=True, methods=['post'])
    def create_supplier_order(self, request, pk=None):
        """Erstellt eine Lieferantenbestellung für Trading Goods eines Herstellers"""
        project = self.get_object()
        manufacturer = request.data.get('manufacturer')
        item_ids = request.data.get('item_ids', [])
        
        if not manufacturer or not item_ids:
            return Response(
                {'error': 'Hersteller und Positionen müssen angegeben werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from customer_orders.models import CustomerOrderItem
        from orders.models import Order, OrderItem
        from suppliers.models import Supplier, TradingProduct
        
        # Get supplier
        try:
            supplier = Supplier.objects.get(name=manufacturer)
        except Supplier.DoesNotExist:
            return Response(
                {'error': f'Lieferant "{manufacturer}" nicht gefunden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create supplier order
        order = Order.objects.create(
            supplier=supplier,
            status='draft',
            created_by=request.user,
            notes=f'Erstellt aus Projekt {project.project_number}'
        )
        
        # Add items
        for item_id in item_ids:
            try:
                customer_item = CustomerOrderItem.objects.get(id=item_id)
                product = TradingProduct.objects.get(id=customer_item.object_id)
                
                OrderItem.objects.create(
                    order=order,
                    trading_product=product,
                    quantity=customer_item.quantity,
                    unit_price=product.purchase_price or 0,
                    description=customer_item.description
                )
                
                # Update tracking
                position_tracking = ProjectOrderPosition.objects.get(
                    project=project,
                    order_item=customer_item
                )
                position_tracking.supplier_order_created = True
                position_tracking.supplier_order = order
                position_tracking.save()
                
            except (CustomerOrderItem.DoesNotExist, TradingProduct.DoesNotExist):
                continue
        
        return Response({
            'success': True,
            'order_id': order.id,
            'order_number': order.order_number
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def create_production_order(self, request, pk=None):
        """Erstellt einen Fertigungsauftrag für VS-Hardware"""
        project = self.get_object()
        item_id = request.data.get('item_id')
        
        if not item_id:
            return Response(
                {'error': 'Position muss angegeben werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from customer_orders.models import CustomerOrderItem
        from manufacturing.models import ProductionOrder, VSHardware
        
        try:
            customer_item = CustomerOrderItem.objects.get(id=item_id)
            product = VSHardware.objects.get(id=customer_item.object_id)
        except (CustomerOrderItem.DoesNotExist, VSHardware.DoesNotExist):
            return Response(
                {'error': 'Position oder Produkt nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create production order
        production_order = ProductionOrder.objects.create(
            product=product,
            quantity=customer_item.quantity,
            status='planned',
            customer_order=project.linked_order,
            notes=f'Erstellt aus Projekt {project.project_number}',
            created_by=request.user
        )
        
        # Update tracking
        position_tracking = ProjectOrderPosition.objects.get(
            project=project,
            order_item=customer_item
        )
        position_tracking.production_order_created = True
        position_tracking.production_order = production_order
        position_tracking.save()
        
        return Response({
            'success': True,
            'production_order_id': production_order.id,
            'production_number': production_order.production_number
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def manufacturing_status(self, request, pk=None):
        """Gibt den Fertigungs- und Bestellstatus zurück"""
        project = self.get_object()
        from manufacturing.models import ProductionOrder
        from orders.models import Order
        
        result = {
            'production_orders': [],
            'supplier_orders': []
        }
        
        # Get production orders
        production_orders = ProductionOrder.objects.filter(
            project_positions__project=project
        ).distinct()
        
        for po in production_orders:
            result['production_orders'].append({
                'id': po.id,
                'production_number': po.production_number,
                'status': po.status,
                'status_display': po.get_status_display() if hasattr(po, 'get_status_display') else po.status,
                'planned_end_date': po.planned_end_date,
                'product_name': str(po.product) if po.product else None,
            })
        
        # Get supplier orders
        supplier_orders = Order.objects.filter(
            project_positions__project=project
        ).distinct()
        
        for so in supplier_orders:
            result['supplier_orders'].append({
                'id': so.id,
                'order_number': so.order_number,
                'status': so.status,
                'status_display': so.get_status_display() if hasattr(so, 'get_status_display') else so.status,
                'order_date': so.order_date,
                'supplier_name': str(so.supplier) if so.supplier else None,
                'supplier_confirmation_date': getattr(so, 'supplier_confirmation_date', None),
                'expected_delivery_date': getattr(so, 'expected_delivery_date', None),
            })
        
        return Response(result)

    @action(detail=True, methods=['post'])
    def link_order(self, request, pk=None):
        """Verknüpft einen Kundenauftrag mit dem Projekt"""
        project = self.get_object()
        order_id = request.data.get('order_id')
        
        if not order_id:
            return Response(
                {'error': 'Auftrags-ID muss angegeben werden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from customer_orders.models import CustomerOrder
        
        try:
            order = CustomerOrder.objects.get(id=order_id)
        except CustomerOrder.DoesNotExist:
            return Response(
                {'error': 'Auftrag nicht gefunden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        project.linked_order = order
        project.save()
        
        return Response({'success': True, 'order_number': order.order_number})

    @action(detail=True, methods=['get'])
    def calendar_dates(self, request, pk=None):
        """Gibt alle Kalenderdaten für das Projekt zurück"""
        project = self.get_object()
        return Response(project.get_all_dates())
