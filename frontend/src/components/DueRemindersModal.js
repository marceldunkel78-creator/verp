import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Modal das beim Einloggen fällige Erinnerungen anzeigt
 * Zeigt nur Erinnerungen die heute fällig sind oder überfällig
 */
const DueRemindersModal = ({ onClose }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDueReminders();
  }, []);

  const fetchDueReminders = async () => {
    try {
      const response = await api.get('/users/reminders/due_today/');
      const data = response.data?.results || response.data || [];
      setReminders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der fälligen Erinnerungen:', error);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.post(`/users/reminders/${id}/dismiss/`);
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Fehler beim Ausblenden:', error);
    }
  };

  const handleToggleComplete = async (id) => {
    try {
      await api.post(`/users/reminders/${id}/toggle_complete/`);
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Fehler beim Ändern des Status:', error);
    }
  };

  const handleNavigate = (url) => {
    onClose?.();
    navigate(url);
  };

  const handleClose = () => {
    setDismissed(true);
    onClose?.();
  };

  if (dismissed || (loading === false && reminders.length === 0)) {
    return null;
  }

  if (loading) {
    return null;
  }

  const isOverdue = (dueDate) => {
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <BellIcon className="h-8 w-8" />
              <div>
                <h2 className="text-xl font-bold">Erinnerungen</h2>
                <p className="text-sm text-yellow-100">
                  {reminders.length} {reminders.length === 1 ? 'Erinnerung' : 'Erinnerungen'} fällig
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-yellow-100 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          <ul className="divide-y divide-gray-100">
            {reminders.map((reminder) => {
              const overdue = isOverdue(reminder.due_date);
              return (
                <li 
                  key={reminder.id} 
                  className={`px-6 py-4 ${overdue ? 'bg-red-50' : 'bg-yellow-50'} hover:bg-opacity-80`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg ${overdue ? 'text-red-600' : 'text-yellow-600'}`}>
                          {overdue ? '⚠️' : '📅'}
                        </span>
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {reminder.title}
                        </h3>
                      </div>
                      {reminder.description && (
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                          {reminder.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          overdue 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {overdue ? 'Überfällig' : 'Heute fällig'}: {new Date(reminder.due_date).toLocaleDateString('de-DE')}
                        </span>
                        {reminder.related_object_type && (
                          <span className="text-xs text-gray-400 capitalize">
                            {reminder.related_object_type}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleToggleComplete(reminder.id)}
                        className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                        title="Als erledigt markieren"
                      >
                        ✓ Erledigt
                      </button>
                      {reminder.related_url && (
                        <button
                          onClick={() => handleNavigate(reminder.related_url)}
                          className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                          title="Zum Element"
                        >
                          → Öffnen
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(reminder.id)}
                        className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300 transition-colors"
                        title="Für heute ausblenden"
                      >
                        Später
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
          <button
            onClick={() => handleNavigate('/myverp?tab=reminders')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Alle Erinnerungen anzeigen →
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default DueRemindersModal;
