import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  TrashIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';

const AdminDelete = () => {
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [searchId, setSearchId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      const response = await api.get('/core/admin-delete/types/');
      setTypes(response.data.types || []);
    } catch (err) {
      setError('Fehler beim Laden der Typen: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!selectedType || !searchId.trim()) {
      setError('Bitte Typ und ID/Nummer eingeben');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setPreview(null);
    setConfirmText('');

    try {
      const response = await api.get('/core/admin-delete/preview/', {
        params: { type: selectedType, id: searchId.trim() }
      });
      setPreview(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler bei der Suche');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!preview) return;
    
    const expectedText = `LÖSCHEN ${preview.identifier || preview.id}`;
    if (confirmText !== expectedText) {
      setError(`Bitte geben Sie "${expectedText}" ein um zu bestätigen.`);
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await api.post('/core/admin-delete/execute/', {
        type: preview.type,
        id: preview.id,
        confirm: true
      });
      setSuccess(response.data.message);
      setPreview(null);
      setSearchId('');
      setConfirmText('');
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Löschen');
      if (err.response?.data?.detail) {
        setError(prev => prev + ' - ' + err.response.data.detail);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const getSelectedTypeName = () => {
    const type = types.find(t => t.key === selectedType);
    return type?.name || selectedType;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <ShieldExclamationIcon className="h-8 w-8 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Löschmodul</h1>
            <p className="text-sm text-gray-600">
              Datenbankeinträge nach Typ und ID löschen (nur für VERP Super User)
            </p>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-red-800 font-medium">Achtung!</h3>
            <p className="text-red-700 text-sm mt-1">
              Das Löschen von Datenbankeinträgen kann nicht rückgängig gemacht werden.
              Verknüpfte Daten könnten ebenfalls betroffen sein. Bitte prüfen Sie sorgfältig vor dem Löschen.
            </p>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Eintrag suchen</h2>
        
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Typ
              </label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setPreview(null);
                  setError(null);
                  setSuccess(null);
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">Typ auswählen...</option>
                {types.map(type => (
                  <option key={type.key} value={type.key}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID oder Nummer
              </label>
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder={selectedType ? `z.B. ${types.find(t => t.key === selectedType)?.identifier_field || 'ID'}` : 'ID eingeben...'}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || !selectedType || !searchId.trim()}
                className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
                Suchen
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-5 w-5 text-red-500" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Gefundener Eintrag
          </h2>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Typ</dt>
                <dd className="text-lg font-semibold text-gray-900">{preview.type_display}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">ID</dt>
                <dd className="text-lg font-mono text-gray-900">{preview.id}</dd>
              </div>
              {preview.identifier && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">{preview.identifier_field}</dt>
                  <dd className="text-lg font-mono text-blue-600">{preview.identifier}</dd>
                </div>
              )}
              {preview.display_name && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name/Bezeichnung</dt>
                  <dd className="text-lg text-gray-900">{preview.display_name}</dd>
                </div>
              )}
              {preview.created_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Erstellt am</dt>
                  <dd className="text-gray-900">{new Date(preview.created_at).toLocaleString('de-DE')}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Related Objects Warning */}
          {preview.has_related_objects && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-yellow-800 font-medium">Verknüpfte Objekte vorhanden</h3>
                  <p className="text-yellow-700 text-sm mt-1 mb-2">
                    Folgende verknüpfte Einträge könnten beim Löschen betroffen sein:
                  </p>
                  <ul className="list-disc list-inside text-yellow-700 text-sm">
                    {preview.related_objects.map((rel, idx) => (
                      <li key={idx}>{rel.name}: {rel.count} Einträge</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-red-600 mb-4">
              <TrashIcon className="h-5 w-5 inline mr-2" />
              Eintrag unwiderruflich löschen
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Um den Eintrag zu löschen, geben Sie bitte folgenden Text ein:
              <br />
              <code className="bg-gray-100 px-2 py-1 rounded font-mono text-red-600">
                LÖSCHEN {preview.identifier || preview.id}
              </code>
            </p>

            <div className="flex gap-4">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Bestätigung eingeben..."
                className="flex-1 px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <button
                onClick={handleDelete}
                disabled={isDeleting || confirmText !== `LÖSCHEN ${preview.identifier || preview.id}`}
                className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <TrashIcon className="h-5 w-5" />
                )}
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!preview && !loading && (
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <TrashIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            Wählen Sie einen Typ und geben Sie die ID oder Nummer des zu löschenden Eintrags ein.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Sie können nach Datenbank-ID (Zahl) oder nach dem jeweiligen Identifikator suchen
            (z.B. Kundennummer, Auftragsnummer, etc.)
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminDelete;
