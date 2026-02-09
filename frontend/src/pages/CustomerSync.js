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
  UserGroupIcon,
  ArrowsRightLeftIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  NoSymbolIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

const CustomerSync = () => {
  // Verbindungseinstellungen
  const [connectionMode, setConnectionMode] = useState('direct'); // 'direct' oder 'dsn'
  const [server, setServer] = useState('localhost\\SQLEXPRESS,1433');
  const [database, setDatabase] = useState('VSDB');
  const [dsnName, setDsnName] = useState('VSDB');

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

  // Preview Limit
  const [previewLimit, setPreviewLimit] = useState(50);

  // Confirmation
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const loadSyncStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const response = await api.get('/settings/customer-sync/status/');
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

  const getConnectionParams = () => ({
    server,
    database,
    use_dsn: connectionMode === 'dsn',
    dsn_name: dsnName,
  });

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionResult(null);
      const response = await api.post('/settings/customer-sync/test-connection/', getConnectionParams());
      setConnectionResult(response.data);
    } catch (error) {
      setConnectionResult({
        success: false,
        error: error.response?.data?.error || error.message || 'Verbindung fehlgeschlagen',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handlePreview = async () => {
    try {
      setLoadingPreview(true);
      setPreviewResult(null);
      const response = await api.post('/settings/customer-sync/preview/', {
        ...getConnectionParams(),
        limit: previewLimit,
      });
      setPreviewResult(response.data);
    } catch (error) {
      setPreviewResult({
        error: error.response?.data?.error || error.message || 'Vorschau fehlgeschlagen',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      setShowConfirmDialog(false);
      const response = await api.post('/settings/customer-sync/execute/', {
        ...getConnectionParams(),
        dry_run: false,
      });
      setSyncResult(response.data);
      // Status neu laden
      loadSyncStatus();
    } catch (error) {
      setSyncResult({
        error: error.response?.data?.error || error.message || 'Synchronisation fehlgeschlagen',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/settings" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zu Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <ArrowsRightLeftIcon className="h-8 w-8 text-indigo-600" />
              Kundendaten-Synchronisation
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Abgleich der Kundendaten mit der externen SQL Server Datenbank (VSDB)
            </p>
          </div>
        </div>
      </div>

      {/* Sync-Status Karte */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-gray-500" />
            Aktueller Status
          </h2>
          <button
            onClick={loadSyncStatus}
            disabled={loadingStatus}
            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loadingStatus ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>
        {syncStatus ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700">{syncStatus.total_customers}</div>
              <div className="text-sm text-blue-600">Kunden gesamt (VERP)</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700">{syncStatus.linked_to_sql}</div>
              <div className="text-sm text-green-600">Verknüpfte Kunden</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-700">{syncStatus.total_mappings || 0}</div>
              <div className="text-sm text-purple-600">Legacy-Mappings gesamt</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-700">{syncStatus.unlinked}</div>
              <div className="text-sm text-gray-600">Ohne SQL-Verknüpfung</div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">Status wird geladen...</div>
        )}
      </div>

      {/* Verbindungseinstellungen */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <ServerIcon className="h-5 w-5 text-gray-500" />
          Verbindung zur SQL Server Datenbank
        </h2>

        {/* Verbindungsmodus */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Verbindungsmodus</label>
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio text-indigo-600"
                checked={connectionMode === 'direct'}
                onChange={() => setConnectionMode('direct')}
              />
              <span className="ml-2 text-sm text-gray-700">Direkte Verbindung</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio text-indigo-600"
                checked={connectionMode === 'dsn'}
                onChange={() => setConnectionMode('dsn')}
              />
              <span className="ml-2 text-sm text-gray-700">System-DSN (ODBC)</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {connectionMode === 'direct' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SQL Server</label>
                <input
                  type="text"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="localhost\SQLEXPRESS,1433"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datenbank</label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="VSDB"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System-DSN Name</label>
              <input
                type="text"
                value={dsnName}
                onChange={(e) => setDsnName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="VSDB"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleTestConnection}
          disabled={testingConnection}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
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
            <div className="flex items-start gap-2">
              {connectionResult.success ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                {connectionResult.success ? (
                  <>
                    <p className="text-sm font-medium text-green-800">Verbindung erfolgreich!</p>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-green-700">
                      <div>Adressen gesamt: <strong>{connectionResult.total_addresses}</strong></div>
                      <div>Synchronisierbar: <strong>{connectionResult.sync_eligible}</strong></div>
                      <div>Veraltet (übersprungen): <strong>{connectionResult.outdated}</strong></div>
                      <div>Lieferanten (übersprungen): <strong>{connectionResult.suppliers}</strong></div>
                      <div>Newsletter-Abonnenten: <strong>{connectionResult.newsletter}</strong></div>
                      <div>Ohne Nachname (übersprungen): <strong>{connectionResult.no_lastname}</strong></div>
                    </div>
                    {connectionResult.tables && connectionResult.tables.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-green-600 cursor-pointer">Verfügbare Tabellen ({connectionResult.tables.length})</summary>
                        <div className="mt-1 text-xs text-green-600">{connectionResult.tables.join(', ')}</div>
                      </details>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-red-800">Verbindung fehlgeschlagen</p>
                    <p className="mt-1 text-sm text-red-700">{connectionResult.error}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vorschau */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <EyeIcon className="h-5 w-5 text-gray-500" />
          Synchronisations-Vorschau (Dry-Run)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Zeigt eine Vorschau der Änderungen ohne diese tatsächlich durchzuführen.
        </p>

        <div className="flex items-end gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Datensätze</label>
            <select
              value={previewLimit}
              onChange={(e) => setPreviewLimit(Number(e.target.value))}
              className="px-3 py-2 border rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={0}>Alle</option>
            </select>
          </div>
          <button
            onClick={handlePreview}
            disabled={loadingPreview}
            className="inline-flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 disabled:opacity-50"
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
          previewResult.error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{previewResult.error}</p>
            </div>
          ) : (
            <div>
              {/* Zusammenfassung */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-700">{previewResult.total_fetched}</div>
                  <div className="text-xs text-gray-500">Gelesen</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-700">{previewResult.would_create}</div>
                  <div className="text-xs text-green-600 flex items-center justify-center gap-1">
                    <PlusCircleIcon className="h-3 w-3" /> Neu anlegen
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-purple-700">{previewResult.would_link || 0}</div>
                  <div className="text-xs text-purple-600 flex items-center justify-center gap-1">
                    <LinkIcon className="h-3 w-3" /> Verknüpfen
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-blue-700">{previewResult.would_update}</div>
                  <div className="text-xs text-blue-600 flex items-center justify-center gap-1">
                    <PencilSquareIcon className="h-3 w-3" /> Aktualisieren
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-500">{previewResult.would_skip}</div>
                  <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <NoSymbolIcon className="h-3 w-3" /> Übersprungen
                  </div>
                </div>
              </div>

              {/* Detail-Tabelle */}
              {previewResult.preview_items && previewResult.preview_items.length > 0 && (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Aktion</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">SQL-ID</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">VERP-Nr.</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Anrede</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Titel</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Vorname</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Nachname</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Firma/Uni</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Ort</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Land</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Newsletter</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewResult.preview_items.map((item, idx) => (
                        <tr key={idx} className={item.action === 'create' ? 'bg-green-50' : item.action === 'link' ? 'bg-purple-50' : 'bg-blue-50'}>
                          <td className="px-3 py-2">
                            {item.action === 'create' ? (
                              <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                <PlusCircleIcon className="h-4 w-4" /> Neu
                              </span>
                            ) : item.action === 'link' ? (
                              <span className="inline-flex items-center gap-1 text-purple-700 font-medium" title={`Gefunden via: ${item.match_method}`}>
                                <LinkIcon className="h-4 w-4" /> Verkn.
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                                <PencilSquareIcon className="h-4 w-4" /> Update
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{item.adressen_id}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.verp_customer_number}</td>
                          <td className="px-3 py-2">{item.salutation}</td>
                          <td className="px-3 py-2">{item.title}</td>
                          <td className="px-3 py-2">{item.vorname}</td>
                          <td className="px-3 py-2 font-medium">{item.nachname}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">{item.firma}</td>
                          <td className="px-3 py-2">{item.ort}</td>
                          <td className="px-3 py-2">
                            <span className="inline-block bg-gray-100 rounded px-1.5 py-0.5 text-xs font-medium">{item.land}</span>
                          </td>
                          <td className="px-3 py-2">
                            {item.newsletter ? (
                              <CheckCircleIcon className="h-4 w-4 text-green-600" />
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Synchronisation ausführen */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <PlayIcon className="h-5 w-5 text-gray-500" />
          Synchronisation ausführen
        </h2>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Achtung</p>
              <p className="text-sm text-amber-700 mt-1">
                Die Synchronisation wird alle zulässigen Adressen aus der SQL-Datenbank lesen und mit den
                VERP-Kundendaten abgleichen. Neue Kunden werden angelegt, bestehende (über Legacy-ID verknüpfte)
                Kunden werden aktualisiert. Veraltete Adressen, Lieferanten und Adressen ohne Nachnamen werden übersprungen.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowConfirmDialog(true)}
          disabled={syncing}
          className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {syncing ? (
            <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PlayIcon className="h-4 w-4 mr-2" />
          )}
          {syncing ? 'Synchronisation läuft...' : 'Synchronisation starten'}
        </button>

        {/* Bestätigungsdialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
                <h3 className="text-lg font-semibold text-gray-900">Synchronisation bestätigen</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Sind Sie sicher, dass Sie die Kundendaten-Synchronisation mit der SQL-Datenbank durchführen möchten?
                Dies kann mehrere Minuten dauern und wird Kundendaten erstellen oder aktualisieren.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSync}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Ja, synchronisieren
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync-Ergebnis */}
        {syncResult && (
          <div className={`mt-4 p-4 rounded-lg ${syncResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            {syncResult.error ? (
              <div className="flex items-start gap-2">
                <XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Synchronisation fehlgeschlagen</p>
                  <p className="mt-1 text-sm text-red-700">{syncResult.error}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Synchronisation abgeschlossen!</p>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm text-green-700">
                    <div>Gelesen: <strong>{syncResult.total_fetched}</strong></div>
                    <div>Neu erstellt: <strong>{syncResult.created}</strong></div>
                    <div>Verknüpft: <strong>{syncResult.linked || 0}</strong></div>
                    <div>Aktualisiert: <strong>{syncResult.updated}</strong></div>
                    <div>Übersprungen: <strong>{syncResult.skipped}</strong></div>
                  </div>
                  {syncResult.errors && syncResult.errors.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-sm text-amber-700 cursor-pointer font-medium">
                        {syncResult.errors.length} Fehler aufgetreten
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {syncResult.errors.map((err, idx) => (
                          <li key={idx} className="text-xs text-red-600 font-mono">{err}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info-Box */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <InformationCircleIcon className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-800">
            <p className="font-medium mb-2">Wie funktioniert die Synchronisation?</p>
            <ul className="space-y-1 text-indigo-700">
              <li>• Adressen werden aus der SQL-Tabelle "Adressen" gelesen (VSDB)</li>
              <li>• Veraltete Adressen, Lieferanten und Einträge ohne Nachnamen werden übersprungen</li>
              <li>• Die AdressenID wird als Legacy-ID im VERP-Kundendatensatz gespeichert</li>
              <li>• Anrede wird getrennt: z.B. "Herr Professor" + "Dr." → Anrede "Herr", Titel "Prof. Dr."</li>
              <li>• Land-IDs werden in ISO-Ländercodes umgewandelt (z.B. Deutschland → DE)</li>
              <li>• Bei erneutem Sync werden bestehende Kunden über die Legacy-ID erkannt und aktualisiert</li>
              <li>• Firma/Uni, Institut, Lehrstuhl werden als Universität/Institut/Abteilung gespeichert</li>
              <li>• Newsletter-Status wird als Newsletter-Zustimmung übernommen</li>
              <li>• Englischsprachig-Flag bestimmt die Sprache (EN/DE)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerSync;
