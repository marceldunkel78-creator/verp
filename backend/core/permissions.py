from rest_framework import permissions


class ModulePermission(permissions.BasePermission):
    """
    Generische modulbasierte Berechtigungsprüfung.
    
    Muss in der View-Klasse folgende Attribute haben:
    - read_permission: Name des Leserechts (z.B. 'can_read_visiview_licenses')
    - write_permission: Name des Schreibrechts (z.B. 'can_write_visiview_licenses')
    
    Alternativ können auch Hauptmodul-Berechtigungen verwendet werden:
    - main_read_permission: Hauptmodul-Leserecht (z.B. 'can_read_visiview')
    - main_write_permission: Hauptmodul-Schreibrecht (z.B. 'can_write_visiview')
    """
    
    def has_permission(self, request, view):
        user = request.user
        
        # Superuser und Staff haben immer Zugriff
        if user.is_superuser or user.is_staff:
            return True
        
        # Hole Berechtigungsattribute von der View
        read_perm = getattr(view, 'read_permission', None)
        write_perm = getattr(view, 'write_permission', None)
        main_read_perm = getattr(view, 'main_read_permission', None)
        main_write_perm = getattr(view, 'main_write_permission', None)
        
        # Für GET, HEAD, OPTIONS (sichere Methoden) reichen Leserechte
        if request.method in permissions.SAFE_METHODS:
            # Prüfe Submodul-Leserecht
            if read_perm and getattr(user, read_perm, False):
                return True
            # Prüfe Submodul-Schreibrecht (impliziert Leserecht)
            if write_perm and getattr(user, write_perm, False):
                return True
            # Prüfe Hauptmodul-Leserecht als Fallback
            if main_read_perm and getattr(user, main_read_perm, False):
                return True
            # Prüfe Hauptmodul-Schreibrecht als Fallback
            if main_write_perm and getattr(user, main_write_perm, False):
                return True
            return False
        
        # Für POST, PUT, PATCH, DELETE benötigt man Schreibrechte
        if write_perm and getattr(user, write_perm, False):
            return True
        if main_write_perm and getattr(user, main_write_perm, False):
            return True
        return False


class VisiViewProductPermission(ModulePermission):
    """Berechtigungen für VisiView Produkte"""
    def has_permission(self, request, view):
        view.read_permission = 'can_read_visiview_products'
        view.write_permission = 'can_write_visiview_products'
        view.main_read_permission = 'can_read_visiview'
        view.main_write_permission = 'can_write_visiview'
        return super().has_permission(request, view)


class VisiViewLicensePermission(ModulePermission):
    """Berechtigungen für VisiView Lizenzen"""
    def has_permission(self, request, view):
        view.read_permission = 'can_read_visiview_licenses'
        view.write_permission = 'can_write_visiview_licenses'
        view.main_read_permission = 'can_read_visiview'
        view.main_write_permission = 'can_write_visiview'
        return super().has_permission(request, view)


class VisiViewTicketPermission(ModulePermission):
    """Berechtigungen für VisiView Tickets"""
    def has_permission(self, request, view):
        view.read_permission = 'can_read_visiview_tickets'
        view.write_permission = 'can_write_visiview_tickets'
        view.main_read_permission = 'can_read_visiview'
        view.main_write_permission = 'can_write_visiview'
        return super().has_permission(request, view)


class VisiViewMacroPermission(ModulePermission):
    """Berechtigungen für VisiView Macros"""
    def has_permission(self, request, view):
        view.read_permission = 'can_read_visiview_macros'
        view.write_permission = 'can_write_visiview_macros'
        view.main_read_permission = 'can_read_visiview'
        view.main_write_permission = 'can_write_visiview'
        return super().has_permission(request, view)


class VisiViewMaintenanceTimePermission(ModulePermission):
    """Berechtigungen für VisiView Maintenance Zeiterfassung"""
    def has_permission(self, request, view):
        view.read_permission = 'can_read_visiview_maintenance_time'
        view.write_permission = 'can_write_visiview_maintenance_time'
        view.main_read_permission = 'can_read_visiview'
        view.main_write_permission = 'can_write_visiview'
        return super().has_permission(request, view)


class DevelopmentPermission(ModulePermission):
    """Berechtigungen für Entwicklung"""
    def has_permission(self, request, view):
        view.read_permission = 'can_read_development'
        view.write_permission = 'can_write_development'
        return super().has_permission(request, view)


class DevelopmentProjectPermission(ModulePermission):
    """Berechtigungen für Entwicklungsprojekte"""
    def has_permission(self, request, view):
        view.read_permission = 'can_read_development_projects'
        view.write_permission = 'can_write_development_projects'
        view.main_read_permission = 'can_read_development'
        view.main_write_permission = 'can_write_development'
        return super().has_permission(request, view)
