from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from suppliers.models import Supplier, TradingProduct

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Gibt Statistiken für das Dashboard zurück
    """
    user = request.user
    
    # Sammle Statistiken
    stats = {
        'total_users': User.objects.count(),
        'active_users': User.objects.filter(is_active=True).count(),
        'total_suppliers': Supplier.objects.count(),
        'active_suppliers': Supplier.objects.filter(is_active=True).count(),
        'total_products': TradingProduct.objects.count(),
        'active_products': TradingProduct.objects.filter(is_active=True).count(),
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
