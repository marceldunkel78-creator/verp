import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Versuche Benutzer vom Backend zu laden (Cookies werden mitgesendet)
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/users/me/');
      setUser(response.data);
    } catch (error) {
      // 401 = nicht authentifiziert - das ist normal wenn keine Session existiert
      if (error.response?.status !== 401) {
        console.error('Fehler beim Laden der Benutzerdaten:', error);
      }
      setUser(null);
      // Wenn der Benutzer nicht authentifiziert ist, weiterleiten zur Login-Seite
      // und verhindern, dass mehrere Redirects/Requests entstehen.
      if (error.response?.status === 401) {
        if (!sessionStorage.getItem('logoutRedirect') && window.location.pathname !== '/login') {
          sessionStorage.setItem('logoutRedirect', '1');
          window.location.href = '/login';
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      // Send credentials; server sets HttpOnly cookies
      await api.post('/auth/login/', { username, password });
      // Now try to load user
      await fetchUser();
      // Clear any previous logout redirect flag after successful login
      sessionStorage.removeItem('logoutRedirect');
      return { success: true };
    } catch (error) {
      // Normalize error to a string for rendering
      const respData = error.response?.data;
      let message = 'Login fehlgeschlagen';
      if (respData) {
        if (typeof respData === 'string') {
          message = respData;
        } else if (respData.detail) {
          message = respData.detail;
        } else if (typeof respData === 'object') {
          try {
            // Try to extract first field message
            const firstKey = Object.keys(respData)[0];
            const val = respData[firstKey];
            if (Array.isArray(val)) {
              message = val.join(' ');
            } else if (typeof val === 'string') {
              message = val;
            } else {
              message = JSON.stringify(respData);
            }
          } catch (e) {
            message = 'Login fehlgeschlagen';
          }
        }
      }
      return { success: false, error: message };
    }
  };

  const logout = () => {
    api.post('/auth/logout/').catch(() => {});
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  }
  return context;
};
