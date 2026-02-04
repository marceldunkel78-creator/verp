import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Route-Komponente die eine bestimmte Berechtigung erfordert.
 * Leitet auf Dashboard um wenn der User nicht die erforderliche Berechtigung hat.
 * 
 * @param {string} permission - Der Name des Berechtigungsfelds (z.B. 'can_read_hr')
 * @param {React.ReactNode} children - Die zu rendernde Komponente
 */
const PermissionRoute = ({ permission, children }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Nicht eingeloggt -> Login
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Superuser hat immer Zugriff
  if (user?.is_superuser) {
    return children;
  }

  // Prüfe spezifische Berechtigung
  if (permission && !user?.[permission]) {
    // Keine Berechtigung -> Dashboard mit Fehlermeldung
    console.warn(`Zugriff verweigert: Berechtigung '${permission}' fehlt`);
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PermissionRoute;
