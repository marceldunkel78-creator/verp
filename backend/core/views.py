from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import viewsets, status
from rest_framework.decorators import action
from django.contrib.auth import get_user_model
from django.conf import settings
from django.http import FileResponse, Http404
from django.apps import apps
from suppliers.models import Supplier, TradingProduct
from customers.models import Customer
from visiview.models import VisiViewProduct
from manufacturing.models import VSHardware
from service.models import VSService
import os
from pathlib import Path
import mimetypes

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Gibt Statistiken für das Dashboard zurück
    """
    user = request.user
    
    # Produktzählung: Trading + VS-Hardware + VisiView + VS-Service
    trading_total = TradingProduct.objects.count()
    trading_active = TradingProduct.objects.filter(is_active=True).count()
    vshardware_total = VSHardware.objects.count()
    vshardware_active = VSHardware.objects.filter(is_active=True).count()
    visiview_total = VisiViewProduct.objects.count()
    visiview_active = VisiViewProduct.objects.filter(is_active=True).count()
    vsservice_total = VSService.objects.count()
    vsservice_active = VSService.objects.filter(is_active=True).count()
    
    total_products = trading_total + vshardware_total + visiview_total + vsservice_total
    active_products = trading_active + vshardware_active + visiview_active + vsservice_active
    
    # Sammle Statistiken
    stats = {
        'total_customers': Customer.objects.count(),
        'active_customers': Customer.objects.filter(is_active=True).count(),
        'total_suppliers': Supplier.objects.count(),
        'active_suppliers': Supplier.objects.filter(is_active=True).count(),
        'total_products': total_products,
        'active_products': active_products,
        # Einzelne Produktkategorien für Details
        'trading_products': trading_total,
        'vshardware_products': vshardware_total,
        'visiview_products': visiview_total,
        'vsservice_products': vsservice_total,
    }
    
    # Module zu denen der Benutzer Zugang hat
    modules = []
    
    if user.is_staff or user.is_superuser:
        modules = [
            {'id': 'users', 'name': 'Benutzerverwaltung', 'icon': 'users', 'color': 'blue'},
            {'id': 'suppliers', 'name': 'Lieferanten', 'icon': 'truck', 'color': 'green'},
            {'id': 'customers', 'name': 'Kunden', 'icon': 'user-group', 'color': 'purple'},
            {'id': 'accounting', 'name': 'Buchhaltung', 'icon': 'calculator', 'color': 'yellow'},
            {'id': 'financial', 'name': 'Financial Reporting', 'icon': 'chart-bar', 'color': 'indigo'},
            {'id': 'hr', 'name': 'HR', 'icon': 'briefcase', 'color': 'pink'},
            {'id': 'dealers', 'name': 'Händler', 'icon': 'building-storefront', 'color': 'cyan'},
            {'id': 'trading', 'name': 'Handelswaren', 'icon': 'shopping-cart', 'color': 'orange'},
            {'id': 'products', 'name': 'Eigenprodukte', 'icon': 'cube', 'color': 'red'},
            {'id': 'manufacturing', 'name': 'Manufacturing', 'icon': 'cog', 'color': 'gray'},
            {'id': 'service', 'name': 'Service/Support', 'icon': 'wrench', 'color': 'teal'},
            {'id': 'marketing', 'name': 'Marketing', 'icon': 'megaphone', 'color': 'rose'},
            {'id': 'email', 'name': 'Email', 'icon': 'envelope', 'color': 'sky'},
            {'id': 'projects', 'name': 'Projekt/Auftragsabwicklung', 'icon': 'clipboard-list', 'color': 'violet'},
            {'id': 'materials', 'name': 'Materialwirtschaft', 'icon': 'cube-transparent', 'color': 'amber'},
            {'id': 'settings', 'name': 'Einstellungen', 'icon': 'cog-6-tooth', 'color': 'slate'},
        ]
    else:
        # Füge Module basierend auf Berechtigungen hinzu
        if user.can_read_suppliers or user.can_write_suppliers:
            modules.append({'id': 'suppliers', 'name': 'Lieferanten', 'icon': 'truck', 'color': 'green'})
        if user.can_read_customers or user.can_write_customers:
            modules.append({'id': 'customers', 'name': 'Kunden', 'icon': 'user-group', 'color': 'purple'})
        if user.can_read_accounting or user.can_write_accounting:
            modules.append({'id': 'accounting', 'name': 'Buchhaltung', 'icon': 'calculator', 'color': 'yellow'})
        if user.can_read_hr or user.can_write_hr:
            modules.append({'id': 'hr', 'name': 'HR', 'icon': 'briefcase', 'color': 'pink'})
        if user.can_read_manufacturing or user.can_write_manufacturing:
            modules.append({'id': 'manufacturing', 'name': 'Manufacturing', 'icon': 'cog', 'color': 'gray'})
        if user.can_read_service or user.can_write_service:
            modules.append({'id': 'service', 'name': 'Service/Support', 'icon': 'wrench', 'color': 'teal'})
        if user.can_read_settings or user.can_write_settings:
            modules.append({'id': 'settings', 'name': 'Einstellungen', 'icon': 'cog-6-tooth', 'color': 'slate'})
    
    return Response({
        'stats': stats,
        'modules': modules,
        'user': {
            'username': user.username,
            'full_name': user.get_full_name(),
            'email': user.email,
            'is_staff': user.is_staff,
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def module_list(request):
    """
    Gibt eine Liste aller verfügbaren Module zurück
    """
    user = request.user
    
    all_modules = [
        {
            'id': 'users',
            'name': 'Benutzerverwaltung',
            'description': 'Verwaltung von Benutzern und Berechtigungen',
            'icon': 'users',
            'color': 'blue',
            'available': user.is_staff or user.is_superuser,
            'implemented': True
        },
        {
            'id': 'suppliers',
            'name': 'Lieferanten',
            'description': 'Verwaltung von Lieferanten und Kontakten',
            'icon': 'truck',
            'color': 'green',
            'available': user.is_staff or user.is_superuser or user.can_read_suppliers or user.can_write_suppliers,
            'implemented': True
        },
        {
            'id': 'customers',
            'name': 'Kunden',
            'description': 'Verwaltung von Kunden',
            'icon': 'user-group',
            'color': 'purple',
            'available': user.is_staff or user.is_superuser or user.can_read_customers or user.can_write_customers,
            'implemented': False
        },
        {
            'id': 'accounting',
            'name': 'Buchhaltung',
            'description': 'Buchhaltung und Finanzverwaltung',
            'icon': 'calculator',
            'color': 'yellow',
            'available': user.is_staff or user.is_superuser or user.can_read_accounting or user.can_write_accounting,
            'implemented': False
        },
        {
            'id': 'financial',
            'name': 'Financial Reporting',
            'description': 'Finanzberichte und Analysen',
            'icon': 'chart-bar',
            'color': 'indigo',
            'available': user.is_staff or user.is_superuser,
            'implemented': False
        },
        {
            'id': 'hr',
            'name': 'HR',
            'description': 'Personalverwaltung',
            'icon': 'briefcase',
            'color': 'pink',
            'available': user.is_staff or user.is_superuser or user.can_read_hr or user.can_write_hr,
            'implemented': False
        },
        {
            'id': 'dealers',
            'name': 'Händler',
            'description': 'Verwaltung von Händlern und Partnern',
            'icon': 'building-storefront',
            'color': 'cyan',
            'available': user.is_staff or user.is_superuser,
            'implemented': False
        },
        {
            'id': 'trading',
            'name': 'Handelswaren',
            'description': 'Verwaltung von Handelswaren',
            'icon': 'shopping-cart',
            'color': 'orange',
            'available': user.is_staff or user.is_superuser,
            'implemented': True
        },
        {
            'id': 'products',
            'name': 'Eigenprodukte',
            'description': 'Verwaltung eigener Produkte',
            'icon': 'cube',
            'color': 'red',
            'available': user.is_staff or user.is_superuser,
            'implemented': False
        },
        {
            'id': 'manufacturing',
            'name': 'Manufacturing',
            'description': 'Produktionsverwaltung',
            'icon': 'cog',
            'color': 'gray',
            'available': user.is_staff or user.is_superuser or user.can_read_manufacturing or user.can_write_manufacturing,
            'implemented': False
        },
        {
            'id': 'service',
            'name': 'Service/Support',
            'description': 'Service und Kundensupport',
            'icon': 'wrench',
            'color': 'teal',
            'available': user.is_staff or user.is_superuser or user.can_read_service or user.can_write_service,
            'implemented': False
        },
        {
            'id': 'marketing',
            'name': 'Marketing',
            'description': 'Marketing und Kampagnen',
            'icon': 'megaphone',
            'color': 'rose',
            'available': user.is_staff or user.is_superuser,
            'implemented': False
        },
        {
            'id': 'email',
            'name': 'Email',
            'description': 'E-Mail Verwaltung',
            'icon': 'envelope',
            'color': 'sky',
            'available': user.is_staff or user.is_superuser,
            'implemented': False
        },
        {
            'id': 'projects',
            'name': 'Projekt/Auftragsabwicklung',
            'description': 'Projekt- und Auftragsverwaltung',
            'icon': 'clipboard-list',
            'color': 'violet',
            'available': user.is_staff or user.is_superuser,
            'implemented': False
        },
        {
            'id': 'materials',
            'name': 'Materialwirtschaft',
            'description': 'Materialverwaltung und Lagerbestand',
            'icon': 'cube-transparent',
            'color': 'amber',
            'available': user.is_staff or user.is_superuser,
            'implemented': False
        },
    ]
    
    return Response({'modules': all_modules})


class MediaBrowserViewSet(viewsets.ViewSet):
    """
    ViewSet for browsing media files and folders
    """
    permission_classes = [IsAuthenticated]
    
    def _get_safe_path(self, path_param):
        """
        Validate and return safe path within MEDIA_ROOT
        """
        if not path_param:
            return settings.MEDIA_ROOT
        
        # Remove leading/trailing slashes and normalize
        path_param = path_param.strip('/\\')
        
        # Build full path
        full_path = os.path.join(settings.MEDIA_ROOT, path_param)
        full_path = os.path.normpath(full_path)
        
        # Security check: ensure path is within MEDIA_ROOT
        if not full_path.startswith(os.path.normpath(settings.MEDIA_ROOT)):
            raise Http404("Invalid path")
        
        return full_path
    
    def _get_file_info(self, file_path, relative_path):
        """
        Get file information
        """
        stats = os.stat(file_path)
        file_size = stats.st_size
        modified_time = stats.st_mtime
        
        # Get MIME type
        mime_type, _ = mimetypes.guess_type(file_path)
        
        # Determine file type category
        file_type = 'unknown'
        if mime_type:
            if mime_type.startswith('image/'):
                file_type = 'image'
            elif mime_type.startswith('video/'):
                file_type = 'video'
            elif mime_type.startswith('audio/'):
                file_type = 'audio'
            elif mime_type == 'application/pdf':
                file_type = 'pdf'
            elif mime_type in ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']:
                file_type = 'document'
            elif mime_type in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']:
                file_type = 'spreadsheet'
            elif mime_type.startswith('text/'):
                file_type = 'text'
        
        return {
            'name': os.path.basename(file_path),
            'path': relative_path.replace('\\', '/'),
            'type': 'file',
            'file_type': file_type,
            'mime_type': mime_type,
            'size': file_size,
            'modified': modified_time,
            'extension': os.path.splitext(file_path)[1].lower()
        }
    
    def _get_folder_info(self, folder_path, relative_path):
        """
        Get folder information
        """
        stats = os.stat(folder_path)
        modified_time = stats.st_mtime
        
        # Count items in folder
        try:
            items = os.listdir(folder_path)
            item_count = len(items)
        except PermissionError:
            item_count = 0
        
        return {
            'name': os.path.basename(folder_path) or 'media',
            'path': relative_path.replace('\\', '/'),
            'type': 'folder',
            'modified': modified_time,
            'item_count': item_count
        }
    
    @action(detail=False, methods=['get'])
    def browse(self, request):
        """
        Browse media folder structure
        GET /core/media-browser/browse/?path=some/folder
        """
        path_param = request.query_params.get('path', '')
        
        try:
            full_path = self._get_safe_path(path_param)
            
            if not os.path.exists(full_path):
                return Response({'error': 'Path does not exist'}, status=status.HTTP_404_NOT_FOUND)
            
            if not os.path.isdir(full_path):
                return Response({'error': 'Path is not a directory'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get current folder info
            current_folder = self._get_folder_info(full_path, path_param)
            
            # Get parent folder path
            parent_path = None
            if path_param:
                parent_path = str(Path(path_param).parent)
                if parent_path == '.':
                    parent_path = ''
            
            # List contents
            items = []
            try:
                for item_name in sorted(os.listdir(full_path)):
                    item_path = os.path.join(full_path, item_name)
                    relative_item_path = os.path.join(path_param, item_name) if path_param else item_name
                    
                    # Skip hidden files and special folders
                    if item_name.startswith('.'):
                        continue
                    
                    try:
                        if os.path.isdir(item_path):
                            items.append(self._get_folder_info(item_path, relative_item_path))
                        else:
                            items.append(self._get_file_info(item_path, relative_item_path))
                    except (PermissionError, OSError):
                        # Skip items we can't access
                        continue
                        
            except PermissionError:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
            
            # Sort: folders first, then files, alphabetically
            folders = [item for item in items if item['type'] == 'folder']
            files = [item for item in items if item['type'] == 'file']
            sorted_items = sorted(folders, key=lambda x: x['name'].lower()) + sorted(files, key=lambda x: x['name'].lower())
            
            return Response({
                'current_folder': current_folder,
                'parent_path': parent_path,
                'items': sorted_items,
                'total_items': len(sorted_items)
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def download(self, request):
        """
        Download a file
        GET /core/media-browser/download/?path=some/file.pdf
        """
        path_param = request.query_params.get('path', '')
        
        if not path_param:
            return Response({'error': 'Path parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            full_path = self._get_safe_path(path_param)
            
            if not os.path.exists(full_path):
                return Response({'error': 'File does not exist'}, status=status.HTTP_404_NOT_FOUND)
            
            if not os.path.isfile(full_path):
                return Response({'error': 'Path is not a file'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get MIME type
            mime_type, _ = mimetypes.guess_type(full_path)
            
            # Open and return file
            response = FileResponse(open(full_path, 'rb'), content_type=mime_type)
            response['Content-Disposition'] = f'attachment; filename="{os.path.basename(full_path)}"'
            return response
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def view(self, request):
        """
        View a file inline (for images, PDFs, etc.)
        GET /core/media-browser/view/?path=some/image.jpg
        """
        path_param = request.query_params.get('path', '')
        
        if not path_param:
            return Response({'error': 'Path parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            full_path = self._get_safe_path(path_param)
            
            if not os.path.exists(full_path):
                return Response({'error': 'File does not exist'}, status=status.HTTP_404_NOT_FOUND)
            
            if not os.path.isfile(full_path):
                return Response({'error': 'Path is not a file'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get MIME type
            mime_type, _ = mimetypes.guess_type(full_path)
            
            # Open and return file for inline viewing
            response = FileResponse(open(full_path, 'rb'), content_type=mime_type)
            response['Content-Disposition'] = f'inline; filename="{os.path.basename(full_path)}"'
            return response
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get statistics about media storage
        GET /core/media-browser/stats/
        """
        try:
            media_root = settings.MEDIA_ROOT
            
            total_size = 0
            file_count = 0
            folder_count = 0
            file_types = {}
            
            # Walk through all files
            for root, dirs, files in os.walk(media_root):
                folder_count += len(dirs)
                for file in files:
                    if file.startswith('.'):
                        continue
                    
                    file_path = os.path.join(root, file)
                    try:
                        file_size = os.path.getsize(file_path)
                        total_size += file_size
                        file_count += 1
                        
                        # Track file types
                        _, ext = os.path.splitext(file)
                        ext = ext.lower()
                        if ext:
                            file_types[ext] = file_types.get(ext, 0) + 1
                    except (OSError, PermissionError):
                        continue
            
            # Get top file types
            top_file_types = sorted(file_types.items(), key=lambda x: x[1], reverse=True)[:10]
            
            return Response({
                'total_size': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'total_size_gb': round(total_size / (1024 * 1024 * 1024), 2),
                'file_count': file_count,
                'folder_count': folder_count,
                'top_file_types': [{'extension': ext, 'count': count} for ext, count in top_file_types]
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============ Admin Delete Module ============
# Ermöglicht Superusern das Löschen von Datenbankeinträgen nach Typ und ID

DELETABLE_MODELS = {
    'customer': ('customers', 'Customer', 'customer_number', 'Kunde'),
    'supplier': ('suppliers', 'Supplier', 'supplier_number', 'Lieferant'),
    'order': ('orders', 'Order', 'order_number', 'Lieferantenbestellung'),
    'customer_order': ('customer_orders', 'CustomerOrder', 'order_number', 'Kundenauftrag'),
    'quotation': ('quotations', 'Quotation', 'quotation_number', 'Angebot'),
    'dealer': ('dealers', 'Dealer', 'name', 'Händler'),
    'system': ('systems', 'System', 'system_number', 'System'),
    'project': ('projects', 'Project', 'project_number', 'Projekt'),
    'service_ticket': ('service', 'ServiceTicket', 'ticket_number', 'Service-Ticket'),
    'visiview_ticket': ('visiview', 'VisiViewTicket', 'ticket_number', 'VisiView-Ticket'),
    'visiview_license': ('visiview', 'VisiViewLicense', 'serial_number', 'VisiView-Lizenz'),
    'trading_product': ('suppliers', 'TradingProduct', 'vs_article_number', 'Handelsware'),
    'inventory_item': ('inventory', 'InventoryItem', 'inventory_number', 'Warenlager-Eintrag'),
}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_delete_types(request):
    """
    Gibt die verfügbaren Typen zum Löschen zurück.
    Nur für Superuser.
    """
    if not request.user.is_superuser:
        return Response({'error': 'Nur für VERP Super User'}, status=status.HTTP_403_FORBIDDEN)
    
    types = []
    for key, (app_label, model_name, identifier_field, display_name) in DELETABLE_MODELS.items():
        types.append({
            'key': key,
            'name': display_name,
            'identifier_field': identifier_field
        })
    
    return Response({'types': types})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_delete_preview(request):
    """
    Vorschau eines zu löschenden Eintrags.
    GET /core/admin-delete/preview/?type=customer&id=123
    Nur für Superuser.
    """
    if not request.user.is_superuser:
        return Response({'error': 'Nur für VERP Super User'}, status=status.HTTP_403_FORBIDDEN)
    
    model_type = request.query_params.get('type')
    item_id = request.query_params.get('id')
    
    if not model_type or not item_id:
        return Response({'error': 'type und id Parameter erforderlich'}, status=status.HTTP_400_BAD_REQUEST)
    
    if model_type not in DELETABLE_MODELS:
        return Response({'error': f'Unbekannter Typ: {model_type}'}, status=status.HTTP_400_BAD_REQUEST)
    
    app_label, model_name, identifier_field, display_name = DELETABLE_MODELS[model_type]
    
    try:
        Model = apps.get_model(app_label, model_name)
    except LookupError:
        return Response({'error': f'Model {model_name} nicht gefunden'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Suche nach ID oder Identifier-Feld
    try:
        # Erst versuchen nach ID
        try:
            item = Model.objects.get(pk=int(item_id))
        except (ValueError, Model.DoesNotExist):
            # Falls keine numerische ID, nach Identifier-Feld suchen
            filter_kwargs = {identifier_field: item_id}
            item = Model.objects.get(**filter_kwargs)
    except Model.DoesNotExist:
        return Response({'error': f'{display_name} mit ID/Nummer {item_id} nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)
    
    # Sammle Informationen über den Eintrag
    item_info = {
        'id': item.pk,
        'type': model_type,
        'type_display': display_name,
    }
    
    # Identifier-Feld hinzufügen
    if hasattr(item, identifier_field):
        item_info['identifier'] = getattr(item, identifier_field)
        item_info['identifier_field'] = identifier_field
    
    # Namen/Titel hinzufügen
    name_fields = ['name', 'title', 'system_name', 'first_name', 'last_name', 'description']
    for field in name_fields:
        if hasattr(item, field):
            value = getattr(item, field)
            if value:
                if field in ['first_name', 'last_name']:
                    if 'display_name' not in item_info:
                        item_info['display_name'] = ''
                    item_info['display_name'] += ((' ' if item_info['display_name'] else '') + str(value))
                else:
                    item_info['display_name'] = str(value)
                    break
    
    # Erstellt/Geändert-Datum
    if hasattr(item, 'created_at'):
        item_info['created_at'] = item.created_at.isoformat() if item.created_at else None
    
    # Verknüpfte Objekte zählen (für Warnung)
    related_counts = []
    for rel in item._meta.related_objects:
        try:
            related_manager = getattr(item, rel.get_accessor_name())
            count = related_manager.count()
            if count > 0:
                related_counts.append({
                    'name': rel.related_model._meta.verbose_name_plural,
                    'count': count
                })
        except Exception:
            pass
    
    item_info['related_objects'] = related_counts
    item_info['has_related_objects'] = len(related_counts) > 0
    
    return Response(item_info)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_delete_execute(request):
    """
    Führt das Löschen eines Eintrags durch.
    POST /core/admin-delete/execute/
    Body: { "type": "customer", "id": 123, "confirm": true }
    Nur für Superuser.
    """
    if not request.user.is_superuser:
        return Response({'error': 'Nur für VERP Super User'}, status=status.HTTP_403_FORBIDDEN)
    
    model_type = request.data.get('type')
    item_id = request.data.get('id')
    confirm = request.data.get('confirm', False)
    
    if not model_type or not item_id:
        return Response({'error': 'type und id Parameter erforderlich'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not confirm:
        return Response({'error': 'confirm=true erforderlich um zu löschen'}, status=status.HTTP_400_BAD_REQUEST)
    
    if model_type not in DELETABLE_MODELS:
        return Response({'error': f'Unbekannter Typ: {model_type}'}, status=status.HTTP_400_BAD_REQUEST)
    
    app_label, model_name, identifier_field, display_name = DELETABLE_MODELS[model_type]
    
    try:
        Model = apps.get_model(app_label, model_name)
    except LookupError:
        return Response({'error': f'Model {model_name} nicht gefunden'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Suche nach ID oder Identifier-Feld
    try:
        try:
            item = Model.objects.get(pk=int(item_id))
        except (ValueError, Model.DoesNotExist):
            filter_kwargs = {identifier_field: item_id}
            item = Model.objects.get(**filter_kwargs)
    except Model.DoesNotExist:
        return Response({'error': f'{display_name} mit ID/Nummer {item_id} nicht gefunden'}, status=status.HTTP_404_NOT_FOUND)
    
    # Speichere Info für Log
    deleted_id = item.pk
    deleted_identifier = getattr(item, identifier_field, str(item.pk))
    
    try:
        item.delete()
        return Response({
            'success': True,
            'message': f'{display_name} "{deleted_identifier}" (ID: {deleted_id}) wurde gelöscht.',
            'deleted_id': deleted_id,
            'deleted_identifier': deleted_identifier
        })
    except Exception as e:
        return Response({
            'error': f'Fehler beim Löschen: {str(e)}',
            'detail': 'Möglicherweise gibt es noch verknüpfte Einträge die das Löschen verhindern.'
        }, status=status.HTTP_400_BAD_REQUEST)
