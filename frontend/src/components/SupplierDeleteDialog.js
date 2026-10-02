import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  TrashIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

/**
 * Loeschen-Dialog fuer Lieferanten (nur fuer Admins/Superuser sichtbar).
 *
 * Ablauf:
 *  1. Beim Oeffnen wird `link_summary` geladen - man sieht also VOR dem
 *     Loeschen, welche Verknuepfungen existieren (Lagerartikel, Bestellungen,
 *     Warengruppen, ...) und ob ueberhaupt etwas blockiert.
 *  2. Es wird gefragt, ob die Verknuepfungen auf einen anderen Lieferanten
 *     gelegt werden sollen. Bejahen -> Ziellieferant per Suche waehlen
 *     (inkl. Vorschlaegen aus `duplicates`, also erkannte Namensdubletten).
 *  3. Bestaetigen -> POST delete_with_reassign.
 *
 * Ohne Ziel-Lieferant wird nur das geloescht, was dem Lieferanten gehoert.
 * Externe Verknuepfungen blockieren dann (cleartext-Meldung vom Backend).
 */
const SupplierDeleteDialog = ({ supplier, open, onClose, onDeleted }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Umhaengen ja/nein
  const [reassign, setReassign] = useState(false);
  const [renumber, setRenumber] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [targets, setTargets] = useState([]);
  const [confirmText, setConfirmText] = useState('');
  const searchTimer = useRef(null);

  const reset = useCallback(() => {
    setSummary(null);
    setLoading(false);
    setDeleting(false);
    setError(null);
    setResult(null);
    setReassign(false);
    setRenumber(false);
    setTargetId('');
    setTargetSearch('');
    setTargets([]);
    setConfirmText('');
  }, []);

  const loadSummary = useCallback(async () => {
    if (!supplier) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/suppliers/suppliers/${supplier.id}/link_summary/`);
      setSummary(response.data);
      // Wenn es sofort sichtbare Namensdubletten gibt, Umhaengen vorbelegen.
      if (response.data.duplicates?.length) setReassign(true);
    } catch (err) {
      setError(
        'Verknüpfungen konnten nicht geladen werden: ' +
        (err.response?.data?.error || err.message)
      );
    } finally {
      setLoading(false);
    }
  }, [supplier]);

  useEffect(() => {
    if (open && supplier) {
      reset();
      loadSummary();
    }
    if (!open) reset();
  }, [open, supplier, reset, loadSummary]);

  // Ziellieferanten-Suche (debounced)
  useEffect(() => {
    if (!reassign || targetSearch.trim().length < 2) {
      setTargets([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const response = await api.get('/suppliers/suppliers/', {
          params: { search: targetSearch.trim(), page_size: 20 }
        });
        const data = response.data.results || response.data || [];
        setTargets(
          (Array.isArray(data) ? data : [])
            .filter((s) => !supplier || s.id !== supplier.id)
            .map((s) => ({
              id: s.id,
              supplier_number: s.supplier_number,
              company_name: s.company_name,
              is_active: s.is_active,
            }))
        );
      } catch (err) {
        console.error('Ziellieferant-Suche fehlgeschlagen:', err);
        setTargets([]);
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [reassign, targetSearch, supplier]);

  // ---------------------------------------------------------------------
  // Abgeleitete Werte.
  //
  // WICHTIG: `supplier` kann null sein, während der Dialog schon geschlossen
  // wird - der Parent setzt `deleteTarget = null`, diese Komponente rendert
  // aber noch einmal. Deshalb wird JEDER abgeleitete Wert null-sicher
  // berechnet. Sonst greift die Schutzabfrage `if (!open || !supplier)`
  // unten zu spaet und es knallt bei `supplier.supplier_number`.
  // ---------------------------------------------------------------------
  const supplierNumber = supplier?.supplier_number || '';
  const supplierId = supplier?.id;
  const links = summary?.links || [];
  const activeLinks = links.filter((l) => l.count > 0);
  const blockCount = activeLinks.filter((l) => !l.owned).reduce((sum, l) => sum + l.count, 0);
  const renumberable = links.some((l) => l.key === 'trading_products' || l.key === 'material_supplies');
  const canDelete = Boolean(supplierId) && confirmText.trim() === `LÖSCHEN ${supplierNumber}`;
  const needsTarget = reassign && Boolean(targetId);

  // Ziel-Lieferant für die Vorschauzeile. Nur aus einer Liste zusammenbauen,
  // wenn es tatsächlich eine Ziel-ID gibt - sonst bleibt es null.
  const finalTarget = needsTarget
    ? (summary?.duplicates || []).concat(targets || []).find(
        (t) => String(t.id) === String(targetId)
      ) || null
    : null;

  const handleDryRun = async () => {
    if (!supplierId) return;
    setError(null);
    setLoading(true);
    try {
      const response = await api.post(`/suppliers/suppliers/${supplierId}/delete_with_reassign/`, {
        reassign_to: needsTarget ? targetId : null,
        renumber,
        dry_run: true,
        confirm: true,
      });
      setResult({ dryRun: true, ...response.data });
    } catch (err) {
      setError(err.response?.data?.error || 'Probelauf fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!supplierId || !canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await api.post(`/suppliers/suppliers/${supplierId}/delete_with_reassign/`, {
        reassign_to: needsTarget ? targetId : null,
        renumber,
        dry_run: false,
        confirm: true,
      });
      setResult({ dryRun: false, ...response.data });
      if (onDeleted) onDeleted(response.data);
    } catch (err) {
      const data = err.response?.data || {};
      setError(data.error || 'Löschen fehlgeschlagen');
      // Bei Blockern die frischen Verknüpfungen nachladen.
      if (data.links) loadSummary();
    } finally {
      setDeleting(false);
    }
  };

  if (!open || !supplierId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-start gap-3 min-w-0">
            <TrashIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900">Lieferant löschen</h3>
              <p className="text-sm text-gray-600 truncate">
                <span className="font-mono font-medium text-gray-900">
                  Nr. {supplierNumber || '—'}
                </span>
                {' · ID '}{supplierId}
                {' · '}{supplier.company_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
            title="Schließen"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Erfolg */}
          {result && !result.dryRun && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-green-800 font-medium">{result.message}</p>
                  {result.warnings?.length > 0 && (
                    <ul className="list-disc list-inside text-green-700 text-sm mt-2">
                      {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Probelauf */}
          {result?.dryRun && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-900 font-medium mb-2">
                Probelauf (es wurde nichts geändert)
              </p>
              <ul className="space-y-1 text-sm text-blue-800">
                {(result.moved || []).map((m, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{m.label}</span>
                    <span className="font-mono">
                      {m.count} → {m.action}
                    </span>
                  </li>
                ))}
              </ul>
              {result.warnings?.length > 0 && (
                <ul className="list-disc list-inside text-blue-700 text-sm mt-2">
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Fehler */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Verknüpfungen */}
          {!result || result.dryRun ? (
            <>
              {loading && !summary ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
                </div>
              ) : summary && (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Verknüpfungen ({activeLinks.length} Arten, {blockCount} Einträge)
                    </h4>
                    <button
                      onClick={loadSummary}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                    >
                      <ArrowPathIcon className="h-4 w-4" /> Neu laden
                    </button>
                  </div>

                  {activeLinks.length === 0 ? (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      Dieser Lieferant hat keine Verknüpfungen. Er kann gefahrlos gelöscht werden.
                    </p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 overflow-hidden">
                      {activeLinks.map((link) => (
                        <div
                          key={link.key}
                          className={`px-3 py-2 flex items-start justify-between gap-3 text-sm ${
                            link.owned ? 'bg-white' : 'bg-amber-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900">{link.label}</div>
                            <div className="text-xs text-gray-500">
                              {link.owned
                                ? 'gehört dem Lieferanten — wird mitgelöscht bzw. umgehängt'
                                : link.blocks_delete
                                  ? 'fremd, blockiert das Löschen — muss umgehängt werden'
                                  : 'fremd — würde ohne Umhängen still verschwinden'}
                            </div>
                            {link.samples?.length > 0 && (
                              <div className="text-xs text-gray-400 font-mono mt-1 truncate">
                                z.B. {link.samples.join(', ')}
                              </div>
                            )}
                          </div>
                          <span className="font-mono font-semibold text-gray-900 flex-shrink-0">
                            {link.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dubletten-Hinweis */}
                  {summary.duplicates?.length > 0 && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 rounded p-3">
                      <p className="text-amber-900 font-medium text-sm mb-2">
                        Ähnliche Lieferanten gefunden
                      </p>
                      <div className="space-y-1">
                        {summary.duplicates.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => { setReassign(true); setTargetId(String(d.id)); }}
                            className="w-full flex items-center justify-between gap-2 text-left text-sm px-2 py-1 rounded hover:bg-amber-100"
                          >
                            <span className="font-mono text-xs text-amber-700">
                              Nr. {d.supplier_number || '—'}
                            </span>
                            <span className="flex-1 text-gray-900 truncate">{d.company_name}</span>
                            <span className="text-xs text-amber-700 flex-shrink-0">
                              als Ziel wählen
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Umhängen ja/nein */}
                  {blockCount > 0 && (
                    <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
                      <p className="text-sm text-blue-900 font-medium mb-3">
                        Sollen die Verknüpfungen auf einen anderen Lieferanten gelegt werden?
                      </p>
                      <div className="space-y-2 mb-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="reassign-mode"
                            checked={!reassign}
                            onChange={() => { setReassign(false); setTargetId(''); }}
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-800">
                            <span className="font-medium">Nein, nur dieser Lieferant wird gelöscht.</span>
                            <span className="block text-xs text-gray-600">
                              Eigene Daten (Kontakte, Warengruppen, …) entfallen. Die
                              {blockCount} verknüpften Einträge{' '}
                              {summary.can_delete
                                ? 'werden ebenfalls gelöscht bzw. bleiben erhalten — das kann Datenverlust bedeuten!'
                                : 'bleiben erhalten, der Lieferant lässt sich aber ohne Umhängen nicht löschen.'}
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="reassign-mode"
                            checked={reassign}
                            onChange={() => setReassign(true)}
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-800">
                            <span className="font-medium">Ja, auf einen anderen Lieferanten umhängen.</span>
                            <span className="block text-xs text-gray-600">
                              Alle Verknüpfungen wandern auf den unten gewählten Lieferanten,
                              danach wird gelöscht.
                            </span>
                          </span>
                        </label>
                      </div>

                      {reassign && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Ziellieferant suchen (Firmenname oder Nr.)
                            </label>
                            <input
                              type="text"
                              value={targetSearch}
                              onChange={(e) => setTargetSearch(e.target.value)}
                              placeholder="z.B. Excelitas-PCO"
                              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {targets.length > 0 && (
                              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                {targets.map((t) => (
                                  <button
                                    key={t.id}
                                    onClick={() => setTargetId(String(t.id))}
                                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${
                                      String(targetId) === String(t.id) ? 'bg-blue-50' : ''
                                    }`}
                                  >
                                    <span className="font-mono text-xs text-gray-500 flex-shrink-0">
                                      {t.supplier_number || '—'}
                                    </span>
                                    <span className="flex-1 truncate text-gray-900">{t.company_name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {finalTarget && (
                            <div className="flex items-center gap-2 text-sm bg-white border border-blue-200 rounded p-2">
                              <ArrowUturnLeftIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <span className="truncate">
                                <span className="line-through text-gray-400">{supplier.company_name}</span>
                                <span className="mx-1 text-gray-400">→</span>
                                <span className="font-medium text-gray-900">{finalTarget.company_name}</span>
                                <span className="font-mono text-xs text-gray-500 ml-1">
                                  Nr. {finalTarget.supplier_number || '—'}
                                </span>
                              </span>
                            </div>
                          )}
                          {renumberable && (
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={renumber}
                                onChange={(e) => setRenumber(e.target.checked)}
                                className="mt-1"
                              />
                              <span className="text-xs text-gray-700">
                                <span className="font-medium">Artikelnummern neu vergeben</span>
                                <span className="block">
                                  Die VS-Artikelnummern der umgehängten Handelswaren und
                                  M&amp;S-Positionen enthalten die Lieferantennummer. Beim Umhängen
                                  würden sie sonst auf den alten Lieferanten zeigen. Achtung:
                                  Nummern können in Bestell- und Angebotsdokumenten zitiert sein.
                                </span>
                              </span>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bestätigung */}
                  {!result?.dryRun && (
                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Um den Bestätigungstext einzugeben:
                        <br />
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono text-red-600">
                          LÖSCHEN {supplierNumber || supplierId}
                        </code>
                      </label>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Bestätigung eingeben..."
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            onClick={handleDryRun}
            disabled={loading || deleting || (reassign && !targetId)}
            className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zeigt an, was passieren würde, ohne etwas zu ändern"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Probelauf
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={deleting}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {result && !result.dryRun ? 'Schließen' : 'Abbrechen'}
            </button>
            {(!result || result.dryRun) && (
              <button
                onClick={handleDelete}
                disabled={deleting || !canDelete || (reassign && !targetId)}
                className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <TrashIcon className="h-4 w-4" />
                )}
                Endgültig löschen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierDeleteDialog;
