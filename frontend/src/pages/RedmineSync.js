import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowPathIcon,
  ServerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  EyeIcon,
  PlayIcon,
  InformationCircleIcon,
  TicketIcon,
  ClockIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
  BugAntIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

const MODULE_INFO = {
  visiview_tickets: {
    label: 'VisiView Tickets',
    icon: BugAntIcon,
    color: 'blue',
    project: 'Visiview',
  },
  sales_tickets: {
    label: 'Sales Tickets',
    icon: DocumentTextIcon,
    color: 'green',
    project: 'Dokumentation',
  },
  service_tickets: {
    label: 'Service Tickets',
    icon: WrenchScrewdriverIcon,
    color: 'orange',
    project: 'Service & Support',
  },
  troubleshooting_tickets: {
    label: 'Troubleshooting',
    icon: TicketIcon,
    color: 'purple',
    project: 'Troubleshooting Guide',
  },
  maintenance: {
    label: 'VisiView Maintenance',
    icon: ClockIcon,
    color: 'teal',
    project: 'Zeiterfassung',
  },
};

const RedmineSync = () => {
  // Verbindungseinstellungen
  const [redmineUrl, setRedmineUrl] = useState('http://192.168.0.1:32768');
  const [apiKey, setApiKey] = useState('d5a35c41fc5cdd3cd7942c0c83865b08087613eb');

  // Modul-Auswahl
  const [selectedModules, setSelectedModules] = useState([
    'visiview_tickets', 'sales_tickets', 'service_tickets',
    'troubleshooting_tickets', 'maintenance',
  ]);

  // Status
  const [syncStatus, setSyncStatus] = useState(null);
  const [connectionResult, setConnectionResult] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  // Loading States
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Optionen
  const [previewLimit, setPreviewLimit] = useState(100);
  const [fullSync, setFullSync] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // --- Status laden ---
  const loadSyncStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const response = await api.get('/settings/redmine-sync/status/');
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Sync-Status:', error);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadSyncStatus();
  }, [loadSyncStatus]);

  // --- Verbindung testen ---
  const testConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionResult(null);
      const response = await api.post('/settings/redmine-sync/test-connection/', {
        url: redmineUrl,
        api_key: apiKey,
      });
      setConnectionResult(response.data);
    } catch (error) {
      setConnectionResult({
        success: false,
        error: error.response?.data?.error || 'Verbindung fehlgeschlagen',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // --- Vorschau ---
  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      setPreviewResult(null);
      const response = await api.post('/settings/redmine-sync/preview/', {
        url: redmineUrl,
        api_key: apiKey,
        modules: selectedModules,
        limit: previewLimit,
      });
      setPreviewResult(response.data);
    } catch (error) {
      console.error('Preview-Fehler:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  // --- Sync ausführen ---
  const executeSync = async () => {
    try {
      setSyncing(true);
      setShowConfirmDialog(false);
      setSyncResult(null);
      const response = await api.post('/settings/redmine-sync/execute/', {
        url: redmineUrl,
        api_key: apiKey,
        modules: selectedModules,
        limit: 500,
        full_sync: fullSync,
      });
      setSyncResult(response.data);
      loadSyncStatus();
    } catch (error) {
      console.error('Sync-Fehler:', error);
      setSyncResult({ error: error.response?.data?.error || 'Synchronisation fehlgeschlagen' });
    } finally {
      setSyncing(false);
    }
  };

  // --- Modul-Toggle ---
  const toggleModule = (mod) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zu Settings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Redmine Ticket-Sync</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tickets und Zeitaufwendungen aus dem Redmine-Ticketsystem synchronisieren.
          Inkrementelle Sync: nur geänderte Einträge seit der letzten Synchronisation werden übertragen.
        </p>
      </div>

      {/* ========================================================= */}
      {/* 1. Sync-Status */}
      {/* ========================================================= */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            <InformationCircleIcon className="h-5 w-5 inline mr-2 text-blue-500" />
            Synchronisationsstatus
          </h2>
          <button
            onClick={loadSyncStatus}
            disabled={loadingStatus}
            className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-1 ${loadingStatus ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>

        {syncStatus && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(MODULE_INFO).map(([key, info]) => {
              const moduleStatus = key === 'maintenance'
                ? syncStatus.maintenance_credits
                : syncStatus[key];
              if (!moduleStatus) return null;
              const Icon = info.icon;
              return (
                <div key={key} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <Icon className="h-5 w-5 text-gray-500 mr-2" />
                    <span className="text-sm font-medium text-gray-700">{info.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{moduleStatus.total}</div>
                  <div className="text-xs text-gray-500">
                    {moduleStatus.synced} synced
                    {moduleStatus.unsynced != null && ` · ${moduleStatus.unsynced} lokal`}
                  </div>
                  {moduleStatus.last_sync && (
                    <div className="text-xs text-green-600 mt-1">
                      Letzter Sync: {new Date(moduleStatus.last_sync).toLocaleString('de-DE')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. Verbindungseinstellungen */}
      {/* ========================================================= */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <ServerIcon className="h-5 w-5 inline mr-2 text-blue-500" />
          Redmine-Verbindung
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Redmine URL
            </label>
            <input
              type="text"
              value={redmineUrl}
              onChange={(e) => setRedmineUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="http://192.168.0.1:32768"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Redmine API Key"
            />
          </div>
        </div>

        <button
          onClick={testConnection}
          disabled={testingConnection}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {testingConnection ? (
            <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ServerIcon className="h-4 w-4 mr-2" />
          )}
          Verbindung testen
        </button>

        {/* Verbindungsergebnis */}
        {connectionResult && (
          <div className={`mt-4 p-4 rounded-lg ${connectionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center mb-2">
              {connectionResult.success ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
              )}
              <span className={`font-medium ${connectionResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {connectionResult.success ? 'Verbindung erfolgreich' : 'Verbindung fehlgeschlagen'}
              </span>
            </div>

            {connectionResult.success && connectionResult.projects && (
              <div className="mt-3">
                <div className="text-sm text-gray-600 mb-2">
                  Eingeloggt als: <strong>{connectionResult.user}</strong>
                </div>
                <div className="text-sm font-medium text-gray-700 mb-2">Redmine-Projekte:</div>
                <div className="space-y-1">
                  {Object.entries(connectionResult.projects).map(([key, proj]) => (
                    <div key={key} className="flex items-center text-sm">
                      {proj.found ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      ) : (
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-2 flex-shrink-0" />
                      )}
                      <span className={proj.found ? 'text-gray-700' : 'text-yellow-700'}>
                        <strong>{proj.name}</strong>
                        {proj.found && ` — ${proj.issue_count} Issues`}
                        {!proj.found && ' — nicht gefunden'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {connectionResult.error && (
              <div className="text-sm text-red-600 mt-1">{connectionResult.error}</div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. Modul-Auswahl + Vorschau */}
      {/* ========================================================= */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <EyeIcon className="h-5 w-5 inline mr-2 text-blue-500" />
          Module & Vorschau
        </h2>

        {/* Modul-Checkboxen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {Object.entries(MODULE_INFO).map(([key, info]) => {
            const Icon = info.icon;
            const checked = selectedModules.includes(key);
            return (
              <label
                key={key}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  checked
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleModule(key)}
                  className="mr-2"
                />
                <Icon className="h-4 w-4 mr-1" />
                <span className="text-xs font-medium">{info.label}</span>
              </label>
            );
          })}
        </div>

        {/* Vorschau-Optionen */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Limit:</label>
            <select
              value={previewLimit}
              onChange={(e) => setPreviewLimit(parseInt(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
          <button
            onClick={loadPreview}
            disabled={loadingPreview || selectedModules.length === 0}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loadingPreview ? (
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <EyeIcon className="h-4 w-4 mr-2" />
            )}
            Vorschau laden
          </button>
        </div>

        {/* Vorschau-Ergebnis */}
        {previewResult && (
          <div className="space-y-4">
            {Object.entries(previewResult).map(([moduleKey, data]) => {
              const info = MODULE_INFO[moduleKey];
              if (!info || !data) return null;
              const items = data.preview_items || [];
              const creates = items.filter((i) => i.action === 'create').length;
              const updates = items.filter((i) => i.action === 'update').length;

              return (
                <div key={moduleKey} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">{info.label}</h3>
                    <div className="flex gap-3 text-xs">
                      <span className="text-blue-600">
                        {data.fetched || data.credits_fetched || 0} von Redmine
                      </span>
                      <span className="text-green-600">{creates} neu</span>
                      <span className="text-yellow-600">{updates} aktualisiert</span>
                      <span className="text-gray-400">
                        {data.skipped || data.credits_skipped || 0} übersprungen
                      </span>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="py-1 pr-2 w-16">Redmine#</th>
                            <th className="py-1 pr-2">Titel</th>
                            <th className="py-1 pr-2 w-20">Status</th>
                            <th className="py-1 w-16">Aktion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.slice(0, 20).map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                              <td className="py-1 pr-2 text-gray-600">
                                {item.redmine_id}
                              </td>
                              <td className="py-1 pr-2 text-gray-800 truncate max-w-xs">
                                {item.title || item.ticket_number}
                              </td>
                              <td className="py-1 pr-2 text-gray-500">
                                {item.status || item.type || ''}
                              </td>
                              <td className="py-1">
                                <span
                                  className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                                    item.action === 'create'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  {item.action === 'create' ? 'Neu' : 'Update'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {items.length > 20 && (
                        <div className="text-xs text-gray-400 mt-1">
                          ... und {items.length - 20} weitere
                        </div>
                      )}
                    </div>
                  )}

                  {data.errors && data.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600">
                      {data.errors.length} Fehler: {data.errors[0]?.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. Synchronisation ausführen */}
      {/* ========================================================= */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <PlayIcon className="h-5 w-5 inline mr-2 text-green-500" />
          Synchronisation ausführen
        </h2>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fullSync}
              onChange={(e) => setFullSync(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-700">
              Vollständiger Sync (statt inkrementell)
            </span>
          </label>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {fullSync
            ? '⚠️ Vollständiger Sync: Alle Tickets werden aus Redmine geladen und abgeglichen. Kann länger dauern.'
            : '🔄 Inkrementeller Sync: Nur seit dem letzten Sync geänderte Tickets werden abgerufen.'
          }
        </p>

        <button
          onClick={() => setShowConfirmDialog(true)}
          disabled={syncing || selectedModules.length === 0}
          className="inline-flex items-center px-6 py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {syncing ? (
            <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <PlayIcon className="h-5 w-5 mr-2" />
          )}
          {syncing ? 'Synchronisiere...' : 'Synchronisation starten'}
        </button>

        {/* Bestätigungsdialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Synchronisation bestätigen
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Folgende Module werden synchronisiert:
              </p>
              <ul className="text-sm text-gray-700 mb-4 space-y-1">
                {selectedModules.map((mod) => (
                  <li key={mod} className="flex items-center">
                    <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                    {MODULE_INFO[mod]?.label}
                    <span className="text-gray-400 ml-1">
                      (Redmine: {MODULE_INFO[mod]?.project})
                    </span>
                  </li>
                ))}
              </ul>
              {fullSync && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-4 text-xs text-yellow-700">
                  ⚠️ Vollständiger Sync — alle Tickets werden neu abgeglichen
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={executeSync}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Bestätigen
                </button>
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync-Ergebnis */}
        {syncResult && (
          <div className="mt-6">
            {syncResult.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <XCircleIcon className="h-5 w-5 text-red-500 inline mr-2" />
                <span className="text-red-700 font-medium">Fehler:</span>
                <span className="text-red-600 ml-1">{syncResult.error}</span>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-green-700 font-medium">Synchronisation abgeschlossen</span>
                </div>

                <div className="space-y-3">
                  {Object.entries(syncResult).map(([moduleKey, data]) => {
                    const info = MODULE_INFO[moduleKey];
                    if (!info || !data) return null;
                    return (
                      <div key={moduleKey} className="flex items-center gap-4 text-sm">
                        <span className="font-medium text-gray-700 w-40">{info.label}:</span>
                        <span className="text-green-600">
                          {data.created || data.credits_created || 0} neu
                        </span>
                        <span className="text-yellow-600">
                          {data.updated || data.credits_updated || 0} aktualisiert
                        </span>
                        <span className="text-gray-400">
                          {data.skipped || data.credits_skipped || 0} übersprungen
                        </span>
                        {data.errors && data.errors.length > 0 && (
                          <span className="text-red-500">
                            {data.errors.length} Fehler
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Fehlerdetails */}
                {Object.values(syncResult).some(
                  (d) => d && d.errors && d.errors.length > 0
                ) && (
                  <details className="mt-3">
                    <summary className="text-sm text-red-600 cursor-pointer">
                      Fehlerdetails anzeigen
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto text-xs bg-red-50 p-2 rounded">
                      {Object.entries(syncResult).map(([key, data]) =>
                        data?.errors?.map((err, idx) => (
                          <div key={`${key}-${idx}`} className="text-red-600 mb-1">
                            [{MODULE_INFO[key]?.label}] #{err.redmine_id}: {err.error}
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. Info-Box: Sync-Strategie */}
      {/* ========================================================= */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">
          ℹ️ So funktioniert die Synchronisation
        </h3>
        <ul className="text-xs text-blue-700 space-y-1.5">
          <li>
            <strong>Inkrementeller Sync:</strong> Über den Redmine-API-Filter{' '}
            <code className="bg-blue-100 px-1 rounded">updated_on&gt;=&lt;timestamp&gt;</code>{' '}
            werden nur seit dem letzten Sync geänderte Issues abgefragt.
          </li>
          <li>
            <strong>Matching:</strong> Bestehende VERP-Tickets werden über die{' '}
            <code className="bg-blue-100 px-1 rounded">redmine_id</code> zugeordnet.
            Bei VisiView-Tickets auch über die <code className="bg-blue-100 px-1 rounded">ticket_number</code>{' '}
            (aus dem früheren CSV-Import).
          </li>
          <li>
            <strong>Benutzer:</strong> Redmine-Benutzer werden automatisch über Vor-/Nachname
            dem VERP-User zugeordnet.
          </li>
          <li>
            <strong>Maintenance:</strong> Redmine-Issues im Projekt „Zeiterfassung" werden als
            Zeitguthaben importiert, Time Entries als Zeitaufwendungen.
          </li>
          <li>
            <strong>Pro Modul Triggermen:</strong> Die Synchronisation kann auch selektiv für
            einzelne Module ausgeführt werden — z.B. nur VisiView Tickets beim Öffnen des VisiView-Moduls.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default RedmineSync;
