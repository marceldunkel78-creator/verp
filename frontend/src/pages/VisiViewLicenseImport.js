import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

const VisiViewLicenseImport = () => {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [relink, setRelink] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [message, setMessage] = useState(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.csv')) {
      setFile(droppedFile);
      setPreview(null);
      setImportResult(null);
      setMessage(null);
    } else {
      setMessage({ type: 'error', text: 'Nur CSV-Dateien werden akzeptiert.' });
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(null);
      setImportResult(null);
      setMessage(null);
    }
  }, []);

  const handlePreview = async () => {
    if (!file) return;

    try {
      setLoading(true);
      setMessage(null);
      setImportResult(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('relink', relink.toString());

      const response = await api.post('/settings/visiview-license-import/preview/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreview(response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Fehler bei der Vorschau.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const confirmed = window.confirm(
      `Möchten Sie den Import wirklich durchführen?\n\n` +
      `${preview.stats.create} neue Lizenzen werden erstellt.\n` +
      `${preview.stats.update} bestehende Lizenzen werden aktualisiert.`
    );
    if (!confirmed) return;

    try {
      setImporting(true);
      setMessage(null);

      const response = await api.post('/settings/visiview-license-import/execute/', {
        relink,
      });

      setImportResult(response.data);
      setMessage({ type: 'success', text: response.data.message });
      setPreview(null);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Fehler beim Import.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setMessage(null);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/settings" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Zurück zu Settings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">VisiView Lizenz-Import</h1>
        <p className="mt-2 text-sm text-gray-600">
          VisiView-Lizenzen aus einer CSV-Datei (Licenses.csv) importieren. Kunden werden automatisch zugeordnet.
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' 
            ? <CheckCircleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            : <ExclamationTriangleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          }
          <span>{message.text}</span>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">1. CSV-Datei hochladen</h2>

        {/* Drag-and-Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : file
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }`}
          onClick={() => document.getElementById('csv-file-input').click()}
        >
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {file ? (
            <div className="flex flex-col items-center">
              <DocumentTextIcon className="h-12 w-12 text-green-500 mb-3" />
              <p className="text-lg font-medium text-green-700">{file.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
              >
                Andere Datei wählen
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <ArrowUpTrayIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-lg font-medium text-gray-700">
                CSV-Datei hierher ziehen
              </p>
              <p className="text-sm text-gray-500 mt-1">
                oder klicken zum Auswählen
              </p>
              <p className="text-xs text-gray-400 mt-3">
                Erwartet: Licenses.csv mit Spalten Serialnum, CustomerName, Options, etc.
              </p>
            </div>
          )}
        </div>

        {/* Options  */}
        <div className="mt-4 flex items-center space-x-6">
          <label className="flex items-center space-x-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={relink}
              onChange={(e) => setRelink(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Relink erlauben</span>
            <span className="text-xs text-gray-400" title="Ermöglicht die Neuzuordnung von Lizenzen zu anderen Kunden">
              (ℹ️)
            </span>
          </label>
        </div>

        {/* Preview Button */}
        <div className="mt-4">
          <button
            onClick={handlePreview}
            disabled={!file || loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                Vorschau wird geladen...
              </>
            ) : (
              <>
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Vorschau (Dry-Run)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">2. Vorschau</h2>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p>
                  Datei: <strong>{preview.file_name}</strong> — {preview.total_rows} Zeilen erkannt
                </p>
                <p className="mt-1">
                  Spalten: {preview.columns?.join(', ')}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{preview.stats.total}</div>
              <div className="text-xs text-gray-500">Gesamt</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{preview.stats.create}</div>
              <div className="text-xs text-green-600">Neu erstellen</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{preview.stats.update}</div>
              <div className="text-xs text-blue-600">Aktualisieren</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{preview.stats.skipped}</div>
              <div className="text-xs text-yellow-600">Übersprungen</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-700">{preview.stats.customer_matched}</div>
              <div className="text-xs text-purple-600">Kunden zugeordnet</div>
            </div>
          </div>

          {/* Match Method Stats */}
          {preview.stats.customer_matched > 0 && Object.keys(preview.stats.match_methods).length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Kundenzuordnung nach Methode:</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(preview.stats.match_methods).map(([method, count]) => (
                  <span key={method} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {method}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Zeile</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Seriennr.</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Kundenname (CSV)</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Version</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Zugeordneter Kunde</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Methode</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Aktion</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.preview.map((row, idx) => (
                  <tr key={idx} className={row.status === 'skipped' ? 'bg-yellow-50' : ''}>
                    <td className="px-3 py-1.5 text-gray-500">{row.row}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-900">{row.serial_number || '-'}</td>
                    <td className="px-3 py-1.5 text-gray-700">{row.customer_name || '-'}</td>
                    <td className="px-3 py-1.5 text-gray-500">{row.version || '-'}</td>
                    <td className="px-3 py-1.5">
                      {row.status === 'create' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Neu</span>
                      )}
                      {row.status === 'update' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Update</span>
                      )}
                      {row.status === 'skipped' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Übersprungen</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-700">{row.matched_customer || row.existing_customer || '-'}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{row.match_method || '-'}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{row.action || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total_rows > 200 && (
            <p className="text-xs text-gray-400 mt-2">
              Vorschau zeigt die ersten 200 von {preview.total_rows} Zeilen.
            </p>
          )}

          {/* Import Button */}
          <div className="mt-6 flex items-center space-x-4">
            <button
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {importing ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Import läuft...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Import durchführen
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import-Ergebnis</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{importResult.stats.created}</div>
              <div className="text-xs text-green-600">Erstellt</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{importResult.stats.updated}</div>
              <div className="text-xs text-blue-600">Aktualisiert</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{importResult.stats.skipped}</div>
              <div className="text-xs text-yellow-600">Übersprungen</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-700">{importResult.stats.customer_matched}</div>
              <div className="text-xs text-purple-600">Kunden zugeordnet</div>
            </div>
          </div>

          {importResult.stats.preserved_links > 0 && (
            <p className="text-sm text-gray-600 mb-2">
              Beibehaltene Verknüpfungen: {importResult.stats.preserved_links}
            </p>
          )}
          {importResult.stats.relinked > 0 && (
            <p className="text-sm text-gray-600 mb-2">
              Neu zugeordnete Lizenzen: {importResult.stats.relinked}
            </p>
          )}

          {importResult.errors?.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                Fehler ({importResult.errors.length}):
              </h4>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                {importResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={handleReset}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Neuer Import
            </button>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">CSV-Format</h3>
        <p className="text-xs text-gray-500 mb-2">
          Die CSV-Datei sollte folgende Spalten enthalten (Trennzeichen: Semikolon oder Komma):
        </p>
        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border">
          ID;Serialnum;InternalSN;CustomerName;CustomerAddress;Options;OptionsUpper32bit;Hardware;Version;DeliveryDate;ExpireDate;Maintenance
        </code>
        <p className="text-xs text-gray-500 mt-2">
          <strong>Options</strong> enthält die unteren 32 Bit (Bit 0–30). <strong>OptionsUpper32bit</strong> enthält die oberen 32 Bit (ab Bit 32, z.B. SerialIO).
        </p>
        <p className="text-xs text-gray-500 mt-3">
          Die Datei wird unter <strong>VERP-Media/Settings/Licenses.csv</strong> gespeichert. 
          Kodierung (UTF-8, Latin-1, CP1252) und Trennzeichen werden automatisch erkannt.
        </p>
      </div>
    </div>
  );
};

export default VisiViewLicenseImport;
