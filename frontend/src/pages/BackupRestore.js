import React, { useState, useEffect } from 'react';
import { 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon, 
  CircleStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

const BackupRestore = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  const [message, setMessage] = useState(null);
  const [importDetails, setImportDetails] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings/database-stats/');
      setStats(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Datenbankstatistiken' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setMessage(null);
      
      const response = await api.get('/settings/backup/', {
        responseType: 'blob'
      });
      
      // Download der Datei
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      link.setAttribute('download', `verp_backup_${date}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: 'Backup erfolgreich erstellt und heruntergeladen!' });
    } catch (error) {
      console.error('Export-Fehler:', error);
      setMessage({ type: 'error', text: 'Fehler beim Erstellen des Backups' });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Bestätigung wenn clearExisting aktiviert ist
    if (clearExisting) {
      const confirmed = window.confirm(
        'ACHTUNG: Sie haben "Bestehende Daten löschen" aktiviert!\n\n' +
        'Alle vorhandenen Daten werden vor dem Import gelöscht.\n\n' +
        'Sind Sie sicher, dass Sie fortfahren möchten?'
      );
      if (!confirmed) {
        event.target.value = '';
        return;
      }
    }

    try {
      setImporting(true);
      setMessage(null);
      setImportDetails(null);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clear_existing', clearExisting.toString());
      
      const response = await api.post('/settings/restore/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setMessage({ type: 'success', text: response.data.message });
      setImportDetails(response.data.details);
      
      // Statistiken neu laden
      await loadStats();
    } catch (error) {
      console.error('Import-Fehler:', error);
      const errorMsg = error.response?.data?.error || 'Fehler beim Import';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Datenbank Backup & Restore</h1>
        <p className="mt-2 text-sm text-gray-600">
          Exportieren und importieren Sie die gesamte Datenbank als JSON-Datei
        </p>
      </div>

      {/* Nachricht */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 
          message.type === 'error' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
          ) : message.type === 'error' ? (
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
          ) : (
            <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${
              message.type === 'success' ? 'text-green-800' :
              message.type === 'error' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* Import Details */}
      {importDetails && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="font-semibold text-gray-900 mb-2">Import Details</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Erstellt: {importDetails.created} Datensätze</p>
            <p>Aktualisiert: {importDetails.updated} Datensätze</p>
            {importDetails.models_processed?.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">Verarbeitete Modelle:</p>
                <ul className="list-disc list-inside ml-2 mt-1">
                  {importDetails.models_processed.map((model, idx) => (
                    <li key={idx}>{model}</li>
                  ))}
                </ul>
              </div>
            )}
            {importDetails.errors?.length > 0 && (
              <div className="mt-2 text-red-600">
                <p className="font-medium">Fehler:</p>
                <ul className="list-disc list-inside ml-2 mt-1">
                  {importDetails.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Sektion */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <ArrowDownTrayIcon className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Export / Backup</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Erstellen Sie ein vollständiges Backup Ihrer Datenbank. 
            Alle Tabellen werden als JSON-Datei exportiert.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {exporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exportiere...
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Backup erstellen & herunterladen
              </>
            )}
          </button>
        </div>

        {/* Import Sektion */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <ArrowUpTrayIcon className="h-8 w-8 text-green-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Import / Restore</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Stellen Sie die Datenbank aus einer Backup-Datei wieder her.
          </p>
          
          {/* Clear existing checkbox */}
          <label className="flex items-center mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="h-4 w-4 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
            />
            <div className="ml-3">
              <span className="text-sm font-medium text-yellow-800">
                Bestehende Daten vor Import löschen
              </span>
              <p className="text-xs text-yellow-600 mt-0.5">
                ⚠️ Alle vorhandenen Daten werden gelöscht!
              </p>
            </div>
          </label>

          <label className={`w-full border-2 border-dashed rounded-lg py-6 px-4 flex flex-col items-center justify-center cursor-pointer ${
            importing ? 'border-gray-300 bg-gray-50' : 'border-green-300 hover:border-green-400 hover:bg-green-50'
          }`}>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
            {importing ? (
              <>
                <svg className="animate-spin h-8 w-8 text-green-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-green-600 font-medium">Importiere...</span>
              </>
            ) : (
              <>
                <ArrowUpTrayIcon className="h-8 w-8 text-green-600 mb-2" />
                <span className="text-green-600 font-medium">JSON-Datei auswählen</span>
                <span className="text-xs text-gray-500 mt-1">Klicken um Datei auszuwählen</span>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Datenbankstatistiken */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center">
            <CircleStackIcon className="h-6 w-6 text-gray-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Datenbankstatistiken</h2>
            <span className="ml-auto text-sm text-gray-500">
              {stats ? `${stats.total_records.toLocaleString()} Datensätze gesamt` : ''}
            </span>
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-gray-500">Lade Statistiken...</p>
          </div>
        ) : stats && Object.keys(stats.apps).length > 0 ? (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(stats.apps).map(([appName, models]) => (
              <div key={appName} className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 capitalize mb-2">
                  {appName.replace('_', ' ')}
                </h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  {Object.entries(models).map(([modelName, count]) => (
                    <li key={modelName} className="flex justify-between">
                      <span>{modelName}</span>
                      <span className="font-medium text-gray-900">{count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <CircleStackIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p>Keine Daten in der Datenbank vorhanden</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupRestore;
