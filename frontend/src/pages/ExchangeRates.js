import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, PencilIcon, TrashIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

const ExchangeRates = () => {
  const { user } = useAuth();
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState(null);

  const canWrite = user?.can_write_settings || user?.is_superuser;
  const canRead = user?.can_read_settings || user?.is_superuser;

  const [formData, setFormData] = useState({
    currency: '',
    rate_to_eur: '',
  });

  useEffect(() => {
    if (canRead) {
      fetchRates();
    }
  }, [canRead]);

  const fetchRates = async () => {
    try {
      const response = await api.get('/settings/exchange-rates/');
      const data = response.data.results || response.data;
      setRates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Wechselkurse:', error);
      alert('Fehler beim Laden der Wechselkurse');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRate) {
        await api.put(`/settings/exchange-rates/${editingRate.id}/`, formData);
      } else {
        await api.post('/settings/exchange-rates/', formData);
      }
      setShowModal(false);
      resetForm();
      fetchRates();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      const errorMsg = error.response?.data 
        ? JSON.stringify(error.response.data) 
        : 'Unbekannter Fehler';
      alert('Fehler beim Speichern des Wechselkurses: ' + errorMsg);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Möchten Sie diesen Wechselkurs wirklich löschen?')) {
      try {
        await api.delete(`/settings/exchange-rates/${id}/`);
        fetchRates();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen des Wechselkurses');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      currency: '',
      rate_to_eur: '',
    });
    setEditingRate(null);
  };

  const openEditModal = (rate) => {
    setEditingRate(rate);
    setFormData({
      currency: rate.currency,
      rate_to_eur: rate.rate_to_eur,
    });
    setShowModal(true);
  };

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Keine Berechtigung</h3>
          <p className="mt-1 text-sm text-gray-500">
            Sie haben keine Berechtigung zum Anzeigen von Einstellungen.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wechselkurse</h1>
          <p className="mt-1 text-sm text-gray-500">
            Verwaltung der Wechselkurse für Fremdwährungen
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Wechselkurs hinzufügen
          </button>
        )}
      </div>

      {/* Wechselkursliste */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Währung
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kurs zu EUR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Letzte Aktualisierung
              </th>
              {canWrite && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aktionen
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rates.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                  Keine Wechselkurse vorhanden
                </td>
              </tr>
            ) : (
              rates.map((rate) => (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{rate.currency}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {parseFloat(rate.rate_to_eur).toFixed(6)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(rate.last_updated).toLocaleString('de-DE')}
                  </td>
                  {canWrite && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(rate)}
                        className="text-orange-600 hover:text-orange-900 mr-4"
                        title="Bearbeiten"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rate.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Löschen"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal für Erstellen/Bearbeiten */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => {
              setShowModal(false);
              resetForm();
            }}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                  <h3 className="text-lg leading-6 font-medium text-white">
                    {editingRate ? 'Wechselkurs bearbeiten' : 'Neuer Wechselkurs'}
                  </h3>
                </div>

                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Währung (3-stelliger Code) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength="3"
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        placeholder="z.B. USD, CHF, GBP"
                        disabled={editingRate !== null}
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        ISO 4217 Währungscode (z.B. USD, CHF, GBP)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Kurs zu EUR *
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={formData.rate_to_eur}
                        onChange={(e) => setFormData({ ...formData, rate_to_eur: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        placeholder="z.B. 1.08 für USD"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Wechselkurs von der Fremdwährung zu EUR
                      </p>
                    </div>

                    {editingRate && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <p className="text-sm text-blue-800">
                          <strong>Letzte Aktualisierung:</strong><br />
                          {new Date(editingRate.last_updated).toLocaleString('de-DE')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {editingRate ? 'Aktualisieren' : 'Erstellen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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

export default ExchangeRates;
