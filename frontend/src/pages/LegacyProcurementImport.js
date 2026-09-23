import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ArrowPathIcon, ArchiveBoxIcon, PlayIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

const LegacyProcurementImport = () => {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await api.get('/settings/legacy-procurement-import/preview/');
      setPreview(response.data);
    } catch (error) {
      setResult({ error: error.response?.data?.error || error.message });
    } finally {
      setLoading(false);
    }
  };

  const executeImport = async () => {
    if (!window.confirm('Legacy-Bestellungen jetzt importieren? Bereits vorhandene Bestellnummern werden übersprungen.')) return;
    setExecuting(true);
    try {
      const response = await api.post('/settings/legacy-procurement-import/execute/', { dry_run: false });
      await loadPreview();
      setResult(response.data);
    } catch (error) {
      setResult({ error: error.response?.data?.error || error.message });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Link to="/settings" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeftIcon className="h-4 w-4 mr-1" /> Zurück zu Settings
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ArchiveBoxIcon className="h-8 w-8 text-teal-600" /> Legacy Procurement-Import
          </h1>
          <p className="mt-2 text-sm text-gray-600">Import aus Datenvorlagen/bestlist.csv mit automatischer Dokumentverknüpfung</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadPreview} disabled={loading} className="inline-flex items-center px-4 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50">
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Vorschau
          </button>
          <button onClick={executeImport} disabled={executing || !preview} className="inline-flex items-center px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
            <PlayIcon className="h-4 w-4 mr-2" /> Importieren
          </button>
        </div>
      </div>

      {result?.error && <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-red-800">{result.error}</div>}
      {result?.stats && <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4 text-green-800">Import abgeschlossen: {result.stats.imported} importiert, {result.stats.exists} bereits vorhanden, {result.stats.skipped_supplier} ohne passenden Lieferanten, {result.stats.documents_linked} Dokumente verknüpft.</div>}

      {!preview && <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">Vorschau laden, um die CSV-Zeilen und Supplier-Matches zu prüfen.</div>}
      {preview && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between text-sm text-gray-700">
            <span>{preview.total} CSV-Zeilen</span>
            <span>{preview.would_import} importierbar, {preview.skipped} übersprungen</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50"><tr>{['Bestellung', 'Lieferant', 'Match', 'Datum', 'Summe', 'Dokumente', 'Positionen', 'Aktion'].map(label => <th key={label} className="px-4 py-3 text-left font-medium text-gray-500">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-200">
                {preview.rows.map(row => (
                  <tr key={`${row.legacy_number}-${row.order_number}`}>
                    <td className="px-4 py-3 font-mono">{row.order_number || row.legacy_number}</td>
                    <td className="px-4 py-3">{row.supplier_name || '-'}</td>
                    <td className="px-4 py-3">{row.supplier_match}</td>
                    <td className="px-4 py-3">{row.order_date || '-'}</td>
                    <td className="px-4 py-3">{row.total ? `${row.total} ${row.currency}` : '-'}</td>
                    <td className="px-4 py-3">{row.document_names.join(', ') || '-'}</td>
                    <td className="px-4 py-3">{row.item_count}</td>
                    <td className={`px-4 py-3 font-medium ${row.action === 'import' ? 'text-green-700' : 'text-red-700'}`}>{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegacyProcurementImport;
