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
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

const OrderImport = () => {
  // Verbindungseinstellungen
  const [connectionMode, setConnectionMode] = useState('direct');
  const [server, setServer] = useState('localhost\\SQLEXPRESS,1433');
  const [database, setDatabase] = useState('VSDB');
  const [dsnName, setDsnName] = useState('VSDB');

  // Status
  const [importStatus, setImportStatus] = useState(null);
  const [connectionResult, setConnectionResult] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Loading States
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  // Preview Limit
  const [previewLimit, setPreviewLimit] = useState(50);

  // Confirmation
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Nummernkorrektur
  const [renumberPreviewResult, setRenumberPreviewResult] = useState(null);
  const [renumberResult, setRenumberResult] = useState(null);
  const [loadingRenumberPreview, setLoadingRenumberPreview] = useState(false);
  const [renumbering, setRenumbering] = useState(false);
  const [showRenumberConfirmDialog, setShowRenumberConfirmDialog] = useState(false);

  const loadImportStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const response = await api.get('/settings/order-import/status/');
      setImportStatus(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Import-Status:', error);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadImportStatus();
  }, [loadImportStatus]);

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
      const response = await api.post('/settings/order-import/test-connection/', getConnectionParams());
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
      const response = await api.post('/settings/order-import/preview/', {
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

  const handleImport = async () => {
    try {
      setImporting(true);
      setImportResult(null);
      setShowConfirmDialog(false);
      const response = await api.post('/settings/order-import/execute/', {
        ...getConnectionParams(),
        dry_run: false,
      });
      setImportResult(response.data);
      loadImportStatus();
    } catch (error) {
      setImportResult({
        error: error.response?.data?.error || error.message || 'Import fehlgeschlagen',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleRenumberPreview = async () => {
    try {
      setLoadingRenumberPreview(true);
      setRenumberPreviewResult(null);
      const response = await api.post('/settings/order-import/renumber/', {
        ...getConnectionParams(),
        dry_run: true,
      }, { timeout: 300000 });
      setRenumberPreviewResult(response.data);
    } catch (error) {
      setRenumberPreviewResult({
        error: error.response?.data?.error || error.message || 'Vorschau fehlgeschlagen',
      });
    } finally {
      setLoadingRenumberPreview(false);
    }
  };

  const handleRenumber = async () => {
    try {
      setRenumbering(true);
      setRenumberResult(null);
      setShowRenumberConfirmDialog(false);
      const response = await api.post('/settings/order-import/renumber/', {
        ...getConnectionParams(),
        dry_run: false,
      }, { timeout: 300000 });
      setRenumberResult(response.data);
    } catch (error) {
      setRenumberResult({
        error: error.response?.data?.error || error.message || 'Nummernkorrektur fehlgeschlagen',
      });
    } finally {
      setRenumbering(false);
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'import':
        return (
          <span className="inline-flex items-center gap-1 text-green-700 font-medium text-xs bg-green-100 px-2 py-0.5 rounded-full">
            <CheckCircleIcon className="h-3 w-3" /> Import
          </span>
        );
      case 'import_no_customer':
        return (
          <span className="inline-flex items-center gap-1 text-amber-700 font-medium text-xs bg-amber-100 px-2 py-0.5 rounded-full">
            <ExclamationTriangleIcon className="h-3 w-3" /> Import (Legacy-Kunde)
          </span>
        );
      case 'exists':
        return (
          <span className="inline-flex items-center gap-1 text-gray-500 font-medium text-xs bg-gray-100 px-2 py-0.5 rounded-full">
            Existiert
          </span>
        );
      case 'duplicate':
        return (
          <span className="inline-flex items-center gap-1 text-purple-700 font-medium text-xs bg-purple-100 px-2 py-0.5 rounded-full">
            <ExclamationTriangleIcon className="h-3 w-3" /> Duplikat
          </span>
        );
      case 'no_items':
        return (
          <span className="inline-flex items-center gap-1 text-red-700 font-medium text-xs bg-red-100 px-2 py-0.5 rounded-full">
            <XCircleIcon className="h-3 w-3" /> Keine Pos.
          </span>
        );
      default:
        return <span className="text-xs text-gray-400">{action}</span>;
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
              <ArchiveBoxIcon className="h-8 w-8 text-teal-600" />
              Legacy-Auftragsimport
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Kundenaufträge (O-xxx-MM/YY) aus der SQL Server Datenbank importieren
            </p>
          </div>
        </div>
      </div>

      {/* Import-Status */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-5 w-5 text-gray-500" />
            Aktueller Status
          </h2>
          <button
            onClick={loadImportStatus}
            disabled={loadingStatus}
            className="text-sm text-teal-600 hover:text-teal-800 flex items-center gap-1"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loadingStatus ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>
        {importStatus ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700">{importStatus.total_orders}</div>
              <div className="text-sm text-blue-600">Aufträge gesamt (VERP)</div>
            </div>
            <div className="bg-teal-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-teal-700">{importStatus.legacy_orders}</div>
              <div className="text-sm text-teal-600">Legacy-Aufträge (O-xxx-MM/YY)</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-700">{importStatus.non_legacy_orders}</div>
              <div className="text-sm text-gray-600">Neue Aufträge (O-xxx-MM-YY)</div>
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

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Verbindungsmodus</label>
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio text-teal-600"
                checked={connectionMode === 'direct'}
                onChange={() => setConnectionMode('direct')}
              />
              <span className="ml-2 text-sm text-gray-700">Direkte Verbindung</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio text-teal-600"
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
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
                  placeholder="localhost\SQLEXPRESS,1433"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datenbank</label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
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
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
                placeholder="VSDB"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleTestConnection}
          disabled={testingConnection}
          className="inline-flex items-center px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
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
                    {connectionResult.summary && (
                      <p className="text-sm text-green-700 mt-1">{connectionResult.summary}</p>
                    )}
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-green-700">
                      {connectionResult.tables && Object.entries(connectionResult.tables).map(([name, info]) => (
                        <div key={name} className={`flex items-center gap-1 ${info.exists ? '' : 'text-red-600'}`}>
                          {info.exists ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-4 w-4 text-red-500" />
                          )}
                          <span>{name}: {info.exists ? <strong>{info.count}</strong> : 'nicht gefunden'}</span>
                          {info.optional && <span className="text-xs text-gray-400">(optional)</span>}
                        </div>
                      ))}
                    </div>
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
          Import-Vorschau (Dry-Run)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Zeigt die <strong>letzten N Aufträge</strong> (neueste) aus der SQL-Datenbank. Die Statistiken beziehen sich auf alle Aufträge. Noch keine Daten werden geschrieben.
        </p>

        <div className="flex items-end gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Aufträge</label>
            <select
              value={previewLimit}
              onChange={(e) => setPreviewLimit(Number(e.target.value))}
              className="px-3 py-2 border rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
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
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-700">{previewResult.stats?.total_in_sql || 0}</div>
                  <div className="text-xs text-gray-500">In SQL-DB</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-700">{(previewResult.stats?.would_import || 0) + (previewResult.stats?.would_import_no_customer || 0)}</div>
                  <div className="text-xs text-green-600">Zu importieren</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-500">{previewResult.stats?.would_skip_exists || 0}</div>
                  <div className="text-xs text-gray-400">Bereits vorhanden</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-amber-700">{previewResult.stats?.would_import_no_customer || 0}</div>
                  <div className="text-xs text-amber-600">Ohne VERP-Kunde</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-purple-700">{previewResult.stats?.would_skip_duplicate || 0}</div>
                  <div className="text-xs text-purple-600">Duplikate</div>
                </div>
                <div className="bg-teal-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-teal-700">{previewResult.stats?.total_items || 0}</div>
                  <div className="text-xs text-teal-600">Positionen gesamt</div>
                </div>
              </div>

              {/* Detail-Tabelle */}
              {previewResult.preview_items && previewResult.preview_items.length > 0 && (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Auftragsnr.</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Datum</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Kunde</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">VERP-Nr.</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Beschreibung</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Positionen</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Gesamtpreis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewResult.preview_items.map((item, idx) => (
                        <tr
                          key={idx}
                          className={
                            item.action === 'import' ? 'bg-green-50' :
                            item.action === 'import_no_customer' ? 'bg-amber-50' :
                            item.action === 'exists' ? 'bg-gray-50' :
                            item.action === 'duplicate' ? 'bg-purple-50' :
                            'bg-red-50'
                          }
                        >
                          <td className="px-3 py-2">{getActionBadge(item.action)}</td>
                          <td className="px-3 py-2 font-mono text-xs font-medium">{item.order_number}</td>
                          <td className="px-3 py-2 text-gray-600">{item.order_date}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={item.customer_name}>
                            {item.customer_name}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{item.customer_number}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[150px] truncate" title={item.kurzbeschreibung}>
                            {item.kurzbeschreibung}
                          </td>
                          <td className="px-3 py-2 text-right">{item.item_count}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {parseFloat(item.gesamtpreis || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
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

      {/* Import ausfuehren */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <PlayIcon className="h-5 w-5 text-gray-500" />
          Import ausführen
        </h2>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Achtung</p>
              <p className="text-sm text-amber-700 mt-1">
                Der Import liest alle Aufträge aus der SQL-Datenbank und legt sie als Legacy-Kundenaufträge
                (Format O-xxx-MM/YY) in VERP an. Bereits importierte Aufträge (gleiche Auftragsnummer)
                werden übersprungen. Aufträge ohne zugeordneten VERP-Kunden werden ebenfalls übersprungen
                — führen Sie zuerst die Kundendaten-Synchronisation durch!
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowConfirmDialog(true)}
          disabled={importing}
          className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {importing ? (
            <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PlayIcon className="h-4 w-4 mr-2" />
          )}
          {importing ? 'Import läuft...' : 'Import starten'}
        </button>

        {/* Bestaetigungsdialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
                <h3 className="text-lg font-semibold text-gray-900">Import bestätigen</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Sind Sie sicher, dass Sie die Legacy-Aufträge aus der SQL-Datenbank importieren möchten?
                Dies kann mehrere Minuten dauern.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Ja, importieren
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import-Ergebnis */}
        {importResult && (
          <div className={`mt-4 p-4 rounded-lg ${importResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            {importResult.error ? (
              <div className="flex items-start gap-2">
                <XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Import fehlgeschlagen</p>
                  <p className="mt-1 text-sm text-red-700">{importResult.error}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Import {importResult.dry_run ? '(Dry-Run) ' : ''}abgeschlossen!
                  </p>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-green-700">
                    <div>Gesamt: <strong>{importResult.stats?.total || 0}</strong></div>
                    <div>Importiert: <strong>{importResult.stats?.imported || 0}</strong></div>
                    <div>Positionen: <strong>{importResult.stats?.items_created || 0}</strong></div>
                    <div>Übersprungen: <strong>{(importResult.stats?.skipped_exists || 0) + (importResult.stats?.skipped_no_items || 0)}</strong></div>
                  </div>
                  {importResult.stats?.imported_no_customer > 0 && (
                    <div className="mt-2 text-xs text-amber-600">
                      Davon ohne VERP-Kunde (Legacy-Kundeninfos gespeichert): <strong>{importResult.stats.imported_no_customer}</strong>
                    </div>
                  )}
                  {importResult.stats?.skipped_no_items > 0 && (
                    <div className="mt-2 text-xs text-amber-600">
                      Übersprungen (keine Positionen): {importResult.stats.skipped_no_items}
                    </div>
                  )}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-sm text-amber-700 cursor-pointer font-medium">
                        {importResult.errors.length} Fehler aufgetreten
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {importResult.errors.map((err, idx) => (
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

      {/* Nummernkorrektur */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-purple-800 mb-2 flex items-center gap-2">
          <ClipboardDocumentListIcon className="h-5 w-5" />
          Auftragsnummern korrigieren
        </h3>
        <p className="text-sm text-purple-700 mb-4">
          Korrigiert alle Legacy-Auftragsnummern, Bestätigungsdaten und Kundenzuordnungen.
          Die Nummer wird direkt aus der SQL-Spalte <strong>AngebotNummer</strong> + Datum gelesen
          (Access-Formel: O-[AngebotNummer]-MM/YY). Führt vorher automatisch den Backfill
          der legacy_auftrags_id durch.
        </p>

        <div className="flex gap-3 mb-4">
          <button
            onClick={handleRenumberPreview}
            disabled={loadingRenumberPreview}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 disabled:opacity-50 text-sm font-medium"
          >
            <EyeIcon className="h-4 w-4" />
            {loadingRenumberPreview ? 'Prüfe...' : 'Vorschau (Dry-Run)'}
          </button>
          <button
            onClick={() => setShowRenumberConfirmDialog(true)}
            disabled={renumbering || !renumberPreviewResult || renumberPreviewResult.error || ((renumberPreviewResult.stats?.renamed || 0) === 0 && (renumberPreviewResult.stats?.dates_corrected || 0) === 0 && (renumberPreviewResult.stats?.customers_corrected || 0) === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
          >
            <PlayIcon className="h-4 w-4" />
            {renumbering ? 'Korrigiere...' : 'Korrektur ausführen'}
          </button>
        </div>

        {/* Bestätigungsdialog */}
        {showRenumberConfirmDialog && (
          <div className="mb-4 bg-purple-100 border border-purple-300 rounded-lg p-4">
            <p className="text-sm font-medium text-purple-900 mb-3">
              Sollen die Auftragsnummern wirklich korrigiert werden?
              {renumberPreviewResult?.stats && (
                <span className="block mt-1">
                  {renumberPreviewResult.stats.renamed || 0} Aufträge werden umbenannt, {renumberPreviewResult.stats.dates_corrected || 0} Daten korrigiert, {renumberPreviewResult.stats.customers_corrected || 0} Kunden korrigiert.
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRenumber}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                Ja, korrigieren
              </button>
              <button
                onClick={() => setShowRenumberConfirmDialog(false)}
                className="px-4 py-2 bg-white text-purple-800 border border-purple-300 rounded-lg hover:bg-purple-50 text-sm font-medium"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Vorschau-Ergebnis */}
        {renumberPreviewResult && !renumberPreviewResult.error && (
          <div className="mb-4">
            {renumberPreviewResult.backfill_auftrags_id_stats && (
              <div className="mb-3 text-sm text-purple-600 space-y-0.5">
                <div>
                  Backfill: <strong>{renumberPreviewResult.backfill_auftrags_id_stats.auftrags_id_filled || 0}</strong> AuftragsIDs nachgetragen
                  (von {renumberPreviewResult.backfill_auftrags_id_stats.total_legacy || 0} Legacy-Aufträgen)
                </div>
                <div className="text-xs text-purple-500">
                  Bereits zugeordnet: {renumberPreviewResult.backfill_auftrags_id_stats.already_has_auftrags_id || 0} |
                  Per Nummer (korrekt): {renumberPreviewResult.backfill_auftrags_id_stats.matched_by_number || 0} |
                  Per Nummer (alt): {renumberPreviewResult.backfill_auftrags_id_stats.matched_by_old_number || 0} |
                  Per Felder: {renumberPreviewResult.backfill_auftrags_id_stats.matched_by_fields || 0} |
                  Nicht zugeordnet: {renumberPreviewResult.backfill_auftrags_id_stats.not_matched || 0}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-purple-700 mb-3">
              <div>Geprüft: <strong>{renumberPreviewResult.stats?.total_checked || 0}</strong></div>
              <div>Korrekt: <strong>{renumberPreviewResult.stats?.already_correct || 0}</strong></div>
              <div>Umbenennen: <strong>{renumberPreviewResult.stats?.renamed || 0}</strong></div>
              <div>Daten korrigieren: <strong>{renumberPreviewResult.stats?.dates_corrected || 0}</strong></div>
              <div>Kunden korrigieren: <strong>{renumberPreviewResult.stats?.customers_corrected || 0}</strong></div>
              <div>Blockiert: <strong>{renumberPreviewResult.blocked || 0}</strong></div>
            </div>
            {renumberPreviewResult.stats?.errors?.length > 0 && (
              <div className="mb-3 text-sm text-red-600">
                {renumberPreviewResult.stats.errors.length} Konflikte:
                <ul className="mt-1 space-y-0.5 text-xs font-mono">
                  {renumberPreviewResult.stats.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {renumberPreviewResult.details && renumberPreviewResult.details.length > 0 && (
              <details>
                <summary className="text-sm text-purple-700 cursor-pointer font-medium mb-2">
                  {renumberPreviewResult.details.length} Umbenennungen anzeigen
                </summary>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="min-w-full text-xs border border-purple-200">
                    <thead className="bg-purple-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Alte Nummer</th>
                        <th className="px-2 py-1 text-left">→</th>
                        <th className="px-2 py-1 text-left">Neue Nummer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renumberPreviewResult.details.map((d, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-purple-50'}>
                          <td className="px-2 py-1 font-mono">{d.old_number}</td>
                          <td className="px-2 py-1">→</td>
                          <td className="px-2 py-1 font-mono">{d.new_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
            {renumberPreviewResult.customer_details && renumberPreviewResult.customer_details.length > 0 && (
              <details className="mt-2">
                <summary className="text-sm text-purple-700 cursor-pointer font-medium mb-2">
                  {renumberPreviewResult.customer_details.length} Kunden-Korrekturen anzeigen
                </summary>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="min-w-full text-xs border border-purple-200">
                    <thead className="bg-purple-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Alter Kunde</th>
                        <th className="px-2 py-1 text-left">→</th>
                        <th className="px-2 py-1 text-left">Neuer Kunde</th>
                        <th className="px-2 py-1 text-left">AdressenID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renumberPreviewResult.customer_details.map((d, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-purple-50'}>
                          <td className="px-2 py-1">{d.old_customer}</td>
                          <td className="px-2 py-1">→</td>
                          <td className="px-2 py-1">{d.new_customer}</td>
                          <td className="px-2 py-1 font-mono">{d.adressen_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}

        {renumberPreviewResult?.error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{renumberPreviewResult.error}</p>
          </div>
        )}

        {/* Ergebnis */}
        {renumberResult && !renumberResult.error && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
              <CheckCircleIcon className="h-5 w-5" />
              Nummernkorrektur abgeschlossen
            </div>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-green-700">
              <div>Geprüft: <strong>{renumberResult.stats?.total_checked || 0}</strong></div>
              <div>Korrekt: <strong>{renumberResult.stats?.already_correct || 0}</strong></div>
              <div>Umbenannt: <strong>{renumberResult.stats?.renamed || 0}</strong></div>
              <div>Daten korrigiert: <strong>{renumberResult.stats?.dates_corrected || 0}</strong></div>
              <div>Kunden korrigiert: <strong>{renumberResult.stats?.customers_corrected || 0}</strong></div>
              <div>Fehler: <strong>{renumberResult.stats?.errors?.length || 0}</strong></div>
            </div>
          </div>
        )}

        {renumberResult?.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{renumberResult.error}</p>
          </div>
        )}
      </div>

      {/* Info-Box */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <InformationCircleIcon className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-teal-800">
            <p className="font-medium mb-2">Wie funktioniert der Import?</p>
            <ul className="space-y-1 text-teal-700">
              <li>• Aufträge werden aus den SQL-Tabellen "Aufträge", "AuftragsPositionen", "Angebote" und "Adressen" gelesen</li>
              <li>• Die Auftragsnummer wird aus der SQL-Spalte <strong>AngebotNummer</strong> + Datum gebildet: <strong>O-[AngebotNummer]-MM/YY</strong> (entspricht der Access-Formel)</li>
              <li>• Kunden werden über die Legacy-ID (AdressenID) aus der Kundensynchronisation verknüpft</li>
              <li>• <strong>Voraussetzung:</strong> Kundendaten-Synchronisation sollte vorher durchgeführt worden sein</li>
              <li>• Angebote mit mehreren Versionen: Nur die zum Auftrag gehörende Version wird berücksichtigt</li>
              <li>• AuftragsPositionen werden über AngebotID = AuftragsID verknüpft</li>
              <li>• Bereits importierte Aufträge (gleiche Nummer) werden übersprungen</li>
              <li>• Alle Legacy-Aufträge erhalten den Status "Abgeschlossen"</li>
              <li>• Währung: DEM (Deutsche Mark) für historische Aufträge</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderImport;
