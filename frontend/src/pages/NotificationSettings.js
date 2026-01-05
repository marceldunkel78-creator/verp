import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BellIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  UsersIcon,
  ChevronRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

const NotificationSettings = () => {
  const [tasks, setTasks] = useState([]);
  const [modules, setModules] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    content_type: '',
    status_field: 'status',
    trigger_status: '',
    message_template: '',
    is_active: true,
    recipient_ids: [],
    notify_hr_approvers: false
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, modulesRes, usersRes] = await Promise.all([
        api.get('/notifications/tasks/'),
        api.get('/notifications/tasks/available_modules/'),
        api.get('/users/')
      ]);
      setTasks(tasksRes.data.results || tasksRes.data);
      setModules(modulesRes.data);
      setUsers(usersRes.data.results || usersRes.data);
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleModuleChange = (contentTypeId) => {
    const module = modules.find(m => m.content_type_id === parseInt(contentTypeId));
    setSelectedModule(module);
    setFormData(prev => ({
      ...prev,
      content_type: contentTypeId,
      status_field: module?.status_field || 'status',
      trigger_status: ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await api.put(`/notifications/tasks/${editingTask.id}/`, formData);
      } else {
        await api.post('/notifications/tasks/', formData);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Fehler beim Speichern');
    }
  };

  const handleEdit = (task) => {
    console.log('handleEdit - task:', task);
    setEditingTask(task);
    const module = modules.find(m => m.content_type_id === task.content_type);
    console.log('handleEdit - found module:', module);
    setSelectedModule(module);
    // Prüfe ob ein Empfänger notify_hr_approvers aktiviert hat
    const hasHrApprovers = task.recipients?.some(r => r.notify_hr_approvers) || false;
    console.log('handleEdit - hasHrApprovers:', hasHrApprovers);
    console.log('handleEdit - recipients:', task.recipients);
    setFormData({
      name: task.name,
      content_type: task.content_type,
      status_field: task.status_field,
      trigger_status: task.trigger_status,
      message_template: task.message_template || '',
      is_active: task.is_active,
      recipient_ids: task.recipients?.filter(r => !r.notify_hr_approvers).map(r => r.user) || [],
      notify_hr_approvers: hasHrApprovers
    });
    console.log('handleEdit - formData set');
    setShowModal(true);
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Möchten Sie diese Mitteilungsaufgabe wirklich löschen?')) {
      return;
    }
    try {
      await api.delete(`/notifications/tasks/${taskId}/`);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Fehler beim Löschen');
    }
  };

  const handleToggleActive = async (task) => {
    try {
      await api.patch(`/notifications/tasks/${task.id}/`, {
        is_active: !task.is_active
      });
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Fehler beim Ändern des Status');
    }
  };

  const resetForm = () => {
    setEditingTask(null);
    setSelectedModule(null);
    setFormData({
      name: '',
      content_type: '',
      status_field: 'status',
      trigger_status: '',
      message_template: '',
      is_active: true,
      recipient_ids: [],
      notify_hr_approvers: false
    });
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link to="/settings" className="text-gray-500 hover:text-gray-700">Settings</Link>
            </li>
            <li>
              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            </li>
            <li className="text-gray-900 font-medium">Mitteilungen</li>
          </ol>
        </nav>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <BellIcon className="h-8 w-8 mr-3 text-blue-600" />
              Mitteilungseinstellungen
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Konfigurieren Sie, wer bei welchen Statusänderungen benachrichtigt wird
            </p>
          </div>
          <button
            onClick={openNewModal}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neue Mitteilungsaufgabe
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Task List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bezeichnung
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Modul
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Auslösender Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Empfänger
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  <BellIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Keine Mitteilungsaufgaben vorhanden</p>
                  <p className="mt-1">Erstellen Sie Ihre erste Mitteilungsaufgabe</p>
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className={!task.is_active ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{task.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      {task.module_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      {task.trigger_status_display}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <UsersIcon className="h-4 w-4 mr-1" />
                      {task.recipient_count} Empfänger
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(task)}
                      className={`flex items-center text-sm ${
                        task.is_active
                          ? 'text-green-600 hover:text-green-800'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {task.is_active ? (
                        <>
                          <CheckCircleIcon className="h-5 w-5 mr-1" />
                          Aktiv
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-5 w-5 mr-1" />
                          Inaktiv
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(task)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingTask ? 'Mitteilungsaufgabe bearbeiten' : 'Neue Mitteilungsaufgabe'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bezeichnung *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="z.B. Benachrichtigung bei Auftragsbestätigung"
                  required
                />
              </div>

              {/* Modul */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modul *
                </label>
                <select
                  value={formData.content_type}
                  onChange={(e) => handleModuleChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Modul auswählen...</option>
                  {modules.map((module) => (
                    <option key={module.content_type_id} value={module.content_type_id}>
                      {module.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              {selectedModule && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auslösender Status *
                  </label>
                  <select
                    value={formData.trigger_status}
                    onChange={(e) => setFormData({ ...formData, trigger_status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Status auswählen...</option>
                    {selectedModule.status_choices.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Die Mitteilung wird ausgelöst, wenn ein {selectedModule.display_name}-Eintrag diesen Status erhält.
                  </p>
                </div>
              )}

              {/* Empfänger */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Empfänger *
                </label>
                
                {/* Option für HR-Genehmiger bei Urlaubsanträgen */}
                {selectedModule && selectedModule.display_name === 'Urlaubsanträge' && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.notify_hr_approvers}
                        onChange={(e) => setFormData({
                          ...formData,
                          notify_hr_approvers: e.target.checked
                        })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm font-medium text-blue-700">
                        Alle HR-Genehmiger automatisch benachrichtigen
                      </span>
                    </label>
                    <p className="mt-1 ml-6 text-xs text-blue-600">
                      Alle Benutzer mit HR-Schreibberechtigung werden bei neuen Urlaubsanträgen benachrichtigt.
                    </p>
                  </div>
                )}
                
                {/* Individuelle Empfänger */}
                {(!formData.notify_hr_approvers || selectedModule?.display_name !== 'Urlaubsanträge') && (
                  <>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {users.map((user) => (
                        <label key={user.id} className="flex items-center py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.recipient_ids.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  recipient_ids: [...formData.recipient_ids, user.id]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  recipient_ids: formData.recipient_ids.filter(id => id !== user.id)
                                });
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {user.first_name && user.last_name
                              ? `${user.first_name} ${user.last_name}`
                              : user.username}
                            <span className="text-gray-400 ml-1">({user.email})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {formData.recipient_ids.length === 0 && !formData.notify_hr_approvers && (
                      <p className="mt-1 text-xs text-red-500">
                        Mindestens ein Empfänger muss ausgewählt werden
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Nachrichtenvorlage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nachrichtenvorlage (optional)
                </label>
                <textarea
                  value={formData.message_template}
                  onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Verfügbare Variablen: {object}, {old_status}, {new_status}, {changed_by}"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Lassen Sie das Feld leer für die Standard-Nachricht.
                </p>
              </div>

              {/* Aktiv */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Mitteilungsaufgabe ist aktiv
                </label>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={formData.recipient_ids.length === 0 && !formData.notify_hr_approvers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingTask ? 'Speichern' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
