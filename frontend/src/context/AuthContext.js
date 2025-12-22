import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
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
      console.error('Fehler beim Laden der Benutzerdaten:', error);
      // Bei Fehler: sicherstellen, dass kein veralteter Zustand bleibt
      try {
        // Force logout on server side to clear cookies
        await api.post('/auth/logout/');
      } catch (e) {}
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
