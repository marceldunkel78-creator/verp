from rest_framework import permissions


class SupplierPermission(permissions.BasePermission):
    """
    Benutzerdefinierte Berechtigung für Lieferanten-Modul
    - Leserechte: can_read_suppliers oder can_write_suppliers
    - Schreibrechte: can_write_suppliers
    """
    
    def has_permission(self, request, view):
        # Superuser und Staff haben immer Zugriff
        if request.user.is_superuser or request.user.is_staff:
            return True
        
        # Für GET, HEAD, OPTIONS (sichere Methoden) reichen Leserechte
        if request.method in permissions.SAFE_METHODS:
            return (
                request.user.can_read_suppliers or 
                request.user.can_write_suppliers
            )
        
        # Für POST, PUT, PATCH, DELETE benötigt man Schreibrechte
        return request.user.can_write_suppliers
