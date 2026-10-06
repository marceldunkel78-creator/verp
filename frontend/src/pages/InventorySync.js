import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CubeIcon,
  PlayIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

const ACTION_LABELS = {
  create: 'Neu angelegt',
  skip: 'Bereits vorhanden',
  skip_empty: 'Leere Zeile übersprungen',
  duplicate: 'Dublette',
  ambiguous: 'Mehrdeutig',
  locked: 'Datei gesperrt',
  no_header: 'Blatt ohne Lagerartikel',
  error: 'Fehler',
};

const ACTION_COLORS = {
  create: 'text-green-700',
  skip: 'text-gray-500',
  skip_empty: 'text-amber-600',
  duplicate: 'text-amber-600',
  ambiguous: 'text-orange-600',
  locked: 'text-gray-500',
  no_header: 'text-gray-400',
  error: 'text-red-700',
};

/**
 * Lager-Abgleich (Excel) - manueller Start des sync_inventory_from_excel.
 * Analog zum Legacy-Procurement-Import: Vorschau (Dry-Run) und Ausführen.
 * Der Lauf dauert je nach Datenbestand 1-2 Minuten und läuft synchron.
 */
const InventorySync = () => {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(null); // 'preview' | 'execute' | null
  // Schnelltest: nur die ersten N Dateien. Leer = alle Dateien.
  const [maxFiles, setMaxFiles] = useState('');

  const run = async (mode) => {
    const limit = parseInt(maxFiles, 10);
    const fileLimit = Number.isFinite(limit) && limit > 0 ? limit : null;
    if (mode === 'execute') {
      const warnLimit = fileLimit
        ? ` ACHTUNG: Auf ${fileLimit} Dateien begrenzt - es wird auch nur DIESER TEIL importiert!`
        : '';
      if (!window.confirm(
        'Lager-Abgleich jetzt ausführen? Es werden NUR neue Artikel angelegt - '
        + 'bestehende bleiben unverändert. Der Lauf kann mehrere Minuten dauern.' + warnLimit
      )) return;
    }
    setRunning(mode);
    setResult(null);
    try {
      const response = mode === 'preview'
        ? await api.get('/inventory/inventory-sync/preview/', {
            params: fileLimit ? { max_files: fileLimit } : {},
          })
        : await api.post('/inventory/inventory-sync/execute/', {
            dry_run: false,
            ...(fileLimit ? { max_files: fileLimit } : {}),
          });
      setResult(response.data);
    } catch (error) {
      setResult({ error: error.response?.data?.error || error.message });
    } finally {
      setRunning(null);
    }
  };

  const stats = result?.stats || {};
  const rows = result?.sample_rows || [];
  const filesLimited = (result?.files_total ?? result?.files ?? 0) > (result?.files ?? 0);

  return (
    <div className="max-w-7xl mx-auto">
      <Link to="/settings" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeftIcon className="h-4 w-4 mr-1" /> Zurück zu Settings
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <CubeIcon className="h-8 w-8 text-emerald-600" /> Lager-Abgleich (Excel)
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Warenlager manuell aus den Excel-Lagerlisten abgleichen. Es werden nur
            neue Artikel angelegt, bestehende bleiben unverändert. Leere Zeilen
            (ohne Seriennummer, Kunde und Bestellnummer) werden übersprungen,
            neue Lieferanten werden nicht mehr angelegt.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => run('preview')}
            disabled={!!running}
            className="inline-flex items-center px-4 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${running === 'preview' ? 'animate-spin' : ''}`} />
            {running === 'preview' ? 'Läuft …' : 'Probelauf (Dry-Run)'}
          </button>
          <button
            onClick={() => run('execute')}
            disabled={!!running}
            className="inline-flex items-center px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <PlayIcon className="h-4 w-4 mr-2" />
            {running === 'execute' ? 'Läuft …' : 'Jetzt importieren'}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900 flex items-start gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-blue-700" />
        <span>
          Der Abgleich liest alle Lagerlisten aus dem eingestellten Verzeichnis.
          Ein vollständiger Lauf über alle Dateien kann je nach Anzahl der Listen
          mehrere Minuten dauern (74 Listen ≈ 5 Minuten) - bitte warten, bis die
          Auswertung erscheint. Für einen schnellen Test oben die Dateizahl begrenzen.
          Ein Dry-Run ändert nichts - er zeigt nur, was beim echten Lauf passieren würde.
        </span>
      </div>

      {/* Schnelltest: nur die ersten N Dateien */}
      <div className="mb-6 bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Schnelltest: nur die ersten N Dateien
          </label>
          <input
            type="number"
            min="1"
            value={maxFiles}
            onChange={(e) => setMaxFiles(e.target.value)}
            placeholder="alle"
            className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <p className="text-xs text-gray-500 max-w-md">
          Leer = alle Dateien (voller Abgleich, 1-2 Minuten). Zum schnellen Testen
          z.B. <span className="font-mono">5</span> eintragen - dann laufen nur die
          ersten 5 Dateien (wenige Sekunden). Achtung: ein begrenzter{' '}
          <em>Import</em> legt auch nur den Teil an; der Rest kommt beim nächsten
          vollständigen Lauf nach.
        </p>
      </div>

      {result?.error && (
        <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-red-800">
          {result.error}
        </div>
      )}

      {result && !result.error && (
        <div className={`mb-6 rounded-md border p-4 ${
          result.dry_run
            ? 'bg-blue-50 border-blue-200 text-blue-900'
            : 'bg-green-50 border-green-200 text-green-900'
        }`}>
          <p className="font-medium mb-2">
            {result.dry_run
              ? 'Probelauf abgeschlossen (es wurde nichts geändert).'
              : 'Import abgeschlossen.'}
          </p>
          <p className="text-xs mt-1 mb-2 opacity-80 font-mono">
            Quelle: {result.base_path || '-'} · Pattern: {result.pattern || '-'} (inkl. Unterordner)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
            <span>
              Dateien: {result.files ?? '-'}
              {filesLimited && (
                <span className="text-amber-700 font-medium">
                  {' '}von {result.files_total} (begrenzt)
                </span>
              )}
            </span>
            <span>Zeilen gelesen: {stats.rows ?? 0}</span>
            <span>Neu angelegt: {stats.create ?? 0}</span>
            <span>Bereits vorhanden: {stats.skip ?? 0}</span>
            <span>Leere Zeilen übersprungen: {stats.empty ?? 0}</span>
            <span>Dubletten: {stats.duplicate ?? 0}</span>
            <span>Mehrdeutig: {stats.ambiguous ?? 0}</span>
            <span>Fehler: {stats.error ?? 0}</span>
          </div>
          {(result.files ?? 0) === 0 && (
            <div className="mt-3 rounded bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              Keine passenden Dateien gefunden. Geprüft wurde{' '}
              <span className="font-mono">{result.base_path || '?'}</span> mit Pattern{' '}
              <span className="font-mono">{result.pattern || '?'}</span>.
              Ohne Eintrag in <span className="font-mono">backend/.env</span> gilt der
              Fallback-Ordner <span className="font-mono">Datenvorlagen/</span> neben dem
              Backend und das Default-Pattern <span className="font-mono">*.xlsx</span>.
              Für alte <span className="font-mono">.xls</span>-Listen oder{' '}
              <span className="font-mono">.csv</span> in der .env setzen:{' '}
              <span className="font-mono">INVENTORY_EXCEL_PATTERN=*.xls*</span> bzw.{' '}
              <span className="font-mono">*.csv</span>. Dateien werden rekursiv gesucht.
            </div>
          )}
          <p className="text-xs mt-2 opacity-80">
            Dauer: {result.duration_seconds ?? '-'}s · Report: {result.report_path || '-'}
          </p>
          {result.warnings?.length > 0 && (
            <ul className="text-xs mt-2 list-disc list-inside opacity-90">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between text-sm text-gray-700">
            <span>Report-Auszug ({rows.length} von {rows.length + (result.sample_truncated || 0)} Zeilen)</span>
            <span className="text-xs text-gray-500">
              Vollständige Liste in {result.report_path}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Quelle', 'Zeile', 'Aktion', 'Inventarnr.', 'S/N', 'Name', 'Meldung'].map(label => (
                    <th key={label} className="px-4 py-3 text-left font-medium text-gray-500">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((row, i) => (
                  <tr key={`${row.source_file}-${row.source_sheet}-${row.source_row}-${i}`}>
                    <td className="px-4 py-2 font-mono text-xs">{row.source_file}{row.source_sheet ? ` / ${row.source_sheet}` : ''}</td>
                    <td className="px-4 py-2">{row.source_row || '-'}</td>
                    <td className={`px-4 py-2 font-medium ${ACTION_COLORS[row.action] || 'text-gray-700'}`}>
                      {ACTION_LABELS[row.action] || row.action}
                    </td>
                    <td className="px-4 py-2 font-mono">{row.inventory_number || '-'}</td>
                    <td className="px-4 py-2 font-mono">{row.serial_number || '-'}</td>
                    <td className="px-4 py-2">{row.name || '-'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Zuerst einen Probelauf starten, um zu sehen, was der Abgleich tun würde.
        </div>
      )}
    </div>
  );
};

export default InventorySync;
