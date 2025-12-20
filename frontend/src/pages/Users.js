import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    phone: '',
    position: '',
    department: '',
    is_active: true,
    can_read_accounting: false,
    can_read_hr: false,
    can_read_suppliers: false,
    can_read_customers: false,
    can_read_manufacturing: false,
    can_read_service: false,
    can_write_accounting: false,
    can_write_hr: false,
    can_write_suppliers: false,
    can_write_customers: false,
    can_write_manufacturing: false,
    can_write_service: false,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');
      // Handle paginated response
      const data = response.data.results || response.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Benutzer:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update - ohne Passwort
        const { password, password_confirm, ...updateData } = formData;
        await api.put(`/users/${editingUser.id}/`, updateData);
      } else {
        // Create - mit Passwort
        if (formData.password !== formData.password_confirm) {
          alert('Passwörter stimmen nicht überein');
          return;
        }
        await api.post('/users/', formData);
      }
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert(error.response?.data?.detail || 'Fehler beim Speichern des Benutzers');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Möchten Sie diesen Benutzer wirklich löschen?')) {
      try {
        await api.delete(`/users/${id}/`);
        fetchUsers();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen des Benutzers');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      password_confirm: '',
      first_name: '',
      last_name: '',
      phone: '',
      position: '',
      department: '',
      is_active: true,
      can_read_accounting: false,
      can_read_hr: false,
      can_read_suppliers: false,
      can_read_customers: false,
      can_read_manufacturing: false,
      can_read_service: false,
      can_write_accounting: false,
      can_write_hr: false,
      can_write_suppliers: false,
      can_write_customers: false,
      can_write_manufacturing: false,
      can_write_service: false,
    });
    setEditingUser(null);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      password_confirm: '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      position: user.position || '',
      department: user.department || '',
      is_active: user.is_active,
      can_read_accounting: user.can_read_accounting,
      can_read_hr: user.can_read_hr,
      can_read_suppliers: user.can_read_suppliers,
      can_read_customers: user.can_read_customers,
      can_read_manufacturing: user.can_read_manufacturing,
      can_read_service: user.can_read_service,
      can_write_accounting: user.can_write_accounting,
      can_write_hr: user.can_write_hr,
      can_write_suppliers: user.can_write_suppliers,
      can_write_customers: user.can_write_customers,
      can_write_manufacturing: user.can_write_manufacturing,
      can_write_service: user.can_write_service,
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <nav className="text-sm text-gray-500 mb-2">
            <Link to="/settings" className="hover:text-gray-700">Settings</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Users</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-600">Benutzerverwaltung und Berechtigungen</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Neuer Benutzer
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Benutzername
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                E-Mail
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position
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
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.first_name} {user.last_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.position || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openEditModal(user)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    <PencilIcon className="h-5 w-5 inline" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-5 w-5 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Keine Benutzer gefunden</p>
        </div>
      )}

      {/* Modal für Benutzer erstellen/bearbeiten */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Basis-Informationen */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Benutzername *</label>
                      <input
                        type="text"
                        required
                        disabled={!!editingUser}
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">E-Mail *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    {!editingUser && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Passwort *</label>
                          <input
                            type="password"
                            required={!editingUser}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Passwort bestätigen *</label>
                          <input
                            type="password"
                            required={!editingUser}
                            value={formData.password_confirm}
                            onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vorname</label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nachname</label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Telefon</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Position</label>
                      <input
                        type="text"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Abteilung</label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">Aktiv</label>
                    </div>
                  </div>

                  {/* Berechtigungen */}
                  <div className="mt-6 border-t pt-4">
                    <h4 className="text-md font-medium text-gray-900 mb-4">App-Berechtigungen</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { key: 'accounting', label: 'Buchhaltung' },
                        { key: 'hr', label: 'HR' },
                        { key: 'suppliers', label: 'Lieferanten' },
                        { key: 'customers', label: 'Kunden' },
                        { key: 'manufacturing', label: 'Produktion' },
                        { key: 'service', label: 'Service' },
                      ].map((module) => (
                        <div key={module.key} className="border rounded-lg p-3 bg-gray-50">
                          <div className="font-medium text-sm text-gray-900 mb-2">{module.label}</div>
                          <div className="space-y-2">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formData[`can_read_${module.key}`]}
                                onChange={(e) => setFormData({ ...formData, [`can_read_${module.key}`]: e.target.checked })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Lesen</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formData[`can_write_${module.key}`]}
                                onChange={(e) => setFormData({ ...formData, [`can_write_${module.key}`]: e.target.checked })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Schreiben</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
