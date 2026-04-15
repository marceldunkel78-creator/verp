import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

const ANZEIGETYP_COLORS = {
  0: 'bg-sky-50 text-sky-700',
  1: 'bg-sky-50 text-sky-700',
  2: 'bg-amber-50 text-amber-700',
  3: 'bg-green-50 text-green-700',
  4: 'bg-purple-50 text-purple-700',
  5: 'bg-purple-50 text-purple-700',
  6: 'bg-orange-50 text-orange-700',
};

const SQLAngebotDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [angebot, setAngebot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAngebot = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/sql-angebote/angebote/${id}/`);
        setAngebot(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Fehler beim Laden des Angebots');
      } finally {
        setLoading(false);
      }
    };
    fetchAngebot();
  }, [id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('de-DE');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    if (!val || val === '0' || val === 'None') return '-';
    try {
      const num = parseFloat(val);
      if (isNaN(num)) return '-';
      return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    } catch {
      return val;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          Lade Angebot...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeftIcon className="h-4 w-4" /> Zurück
        </button>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!angebot) return null;

  const kundenDisplay = angebot.firma || `${angebot.kunde_vorname} ${angebot.kunde_name}`.trim() || `Adr. ${angebot.adressen_id}`;

  // Separate system positions and other positions for display
  const systemPositions = angebot.positionen?.filter(p => p.is_system) || [];
  const otherPositions = angebot.positionen?.filter(p => !p.is_system) || [];
  const allPositions = angebot.positionen || [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Zurück zur Liste
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Angebot {angebot.angebot_nummer}/{angebot.jahr ? String(angebot.jahr).slice(-2) : ''}
              <span className="text-lg text-gray-500 ml-2">Version {angebot.versions_nummer}</span>
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              SQL-Angebot ID: {angebot.angebot_id} &middot; {formatDate(angebot.datum)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(angebot.gesamtpreis)}
            </div>
            <div className="text-sm text-gray-500">Gesamtpreis</div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Kundendaten */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Kunde</h2>
          <dl className="space-y-2">
            <div className="flex">
              <dt className="w-32 text-sm text-gray-500">Firma/Uni</dt>
              <dd className="text-sm text-gray-900">{angebot.firma || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-gray-500">Name</dt>
              <dd className="text-sm text-gray-900">
                {[angebot.kunde_vorname, angebot.kunde_name].filter(Boolean).join(' ') || '-'}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-gray-500">Institut</dt>
              <dd className="text-sm text-gray-900">{angebot.institut || '-'}</dd>
            </div>
            {angebot.lehrstuhl && (
              <div className="flex">
                <dt className="w-32 text-sm text-gray-500">Lehrstuhl</dt>
                <dd className="text-sm text-gray-900">{angebot.lehrstuhl}</dd>
              </div>
            )}
            <div className="flex">
              <dt className="w-32 text-sm text-gray-500">Adresse</dt>
              <dd className="text-sm text-gray-900">
                {[angebot.strasse, `${angebot.plz} ${angebot.ort}`.trim()].filter(Boolean).join(', ') || '-'}
              </dd>
            </div>
            {angebot.email && (
              <div className="flex">
                <dt className="w-32 text-sm text-gray-500">E-Mail</dt>
                <dd className="text-sm text-gray-900">{angebot.email}</dd>
              </div>
            )}
            <div className="flex">
              <dt className="w-32 text-sm text-gray-500">AdressenID</dt>
              <dd className="text-sm text-gray-500 font-mono">{angebot.adressen_id}</dd>
            </div>
            {angebot.verp_customer_id && (
              <div className="flex">
                <dt className="w-32 text-sm text-gray-500">VERP-Kunde</dt>
                <dd className="text-sm">
                  <Link
                    to={`/sales/customers/${angebot.verp_customer_id}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {angebot.verp_customer_number || `Kunde #${angebot.verp_customer_id}`}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Angebotsdaten */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Angebotsdaten</h2>
          <dl className="space-y-2">
            <div className="flex">
              <dt className="w-40 text-sm text-gray-500">Verkäufer</dt>
              <dd className="text-sm text-gray-900">{angebot.verkaeufer_name}</dd>
            </div>
            <div className="flex">
              <dt className="w-40 text-sm text-gray-500">Kurzbeschreibung</dt>
              <dd className="text-sm text-gray-900">{angebot.kurzbeschreibung || '-'}</dd>
            </div>
            {angebot.verp_order_id && (
              <div className="flex">
                <dt className="w-40 text-sm text-gray-500">VERP-Auftrag</dt>
                <dd className="text-sm">
                  <Link
                    to={`/sales/order-processing/${angebot.verp_order_id}?tab=basisinfos`}
                    className="text-purple-600 hover:text-purple-800 hover:underline font-medium"
                  >
                    {angebot.verp_order_number}
                  </Link>
                </dd>
              </div>
            )}
            <div className="flex">
              <dt className="w-40 text-sm text-gray-500">Sprache</dt>
              <dd className="text-sm text-gray-900">{angebot.englisch ? 'Englisch' : 'Deutsch'}</dd>
            </div>
            <div className="flex">
              <dt className="w-40 text-sm text-gray-500">Systempreis</dt>
              <dd className="text-sm text-gray-900 font-mono">{formatCurrency(angebot.systempreis)}</dd>
            </div>
            <div className="flex">
              <dt className="w-40 text-sm text-gray-500">Summe</dt>
              <dd className="text-sm text-gray-900 font-mono">{formatCurrency(angebot.summe)}</dd>
            </div>
            <div className="flex">
              <dt className="w-40 text-sm text-gray-500">Gesamtpreis</dt>
              <dd className="text-sm text-gray-900 font-mono font-bold">{formatCurrency(angebot.gesamtpreis)}</dd>
            </div>
            <div className="flex">
              <dt className="w-40 text-sm text-gray-500">Gesamt-EK</dt>
              <dd className="text-sm text-gray-500 font-mono">{formatCurrency(angebot.gesamteinkaufspreis)}</dd>
            </div>
            {angebot.dollarkurs && angebot.dollarkurs !== '0' && (
              <div className="flex">
                <dt className="w-40 text-sm text-gray-500">Dollarkurs</dt>
                <dd className="text-sm text-gray-900">{angebot.dollarkurs}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Konditionen */}
      {(angebot.absprachen || angebot.erweiterungen || angebot.optionen || angebot.systembeschreibung) && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Konditionen & Texte</h2>
          <div className="space-y-3">
            {angebot.systembeschreibung && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Systembeschreibung</h3>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{angebot.systembeschreibung}</p>
              </div>
            )}
            {angebot.absprachen && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Absprachen</h3>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{angebot.absprachen}</p>
              </div>
            )}
            {angebot.erweiterungen && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Erweiterungen</h3>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{angebot.erweiterungen}</p>
              </div>
            )}
            {angebot.optionen && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Optionen</h3>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{angebot.optionen}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Positionen */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Positionen ({allPositions.length})
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            <span className="inline-block w-3 h-3 rounded bg-sky-100 mr-1 align-middle"></span>System (Preis nicht einzeln angezeigt)
            <span className="inline-block w-3 h-3 rounded bg-green-100 mr-1 ml-3 align-middle"></span>Vollpreis
            <span className="inline-block w-3 h-3 rounded bg-amber-100 mr-1 ml-3 align-middle"></span>Aufpreis
            <span className="inline-block w-3 h-3 rounded bg-purple-100 mr-1 ml-3 align-middle"></span>Option
            <span className="inline-block w-3 h-3 rounded bg-orange-100 mr-1 ml-3 align-middle"></span>Systemaufpreis
          </p>
        </div>

        {/* System positions with Systempreis summary */}
        {systemPositions.length > 0 && (
          <div className="border-b border-gray-200">
            <div className="px-5 py-3 bg-sky-50 border-b border-sky-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-sky-800">
                  Systemkomponenten ({systemPositions.length} Positionen)
                </span>
                <span className="text-sm font-bold text-sky-900 font-mono">
                  Systempreis: {formatCurrency(angebot.systempreis)}
                </span>
              </div>
            </div>
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">Pos</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">Menge</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Artikel</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Typ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {systemPositions.map((p) => (
                  <tr key={p.positions_id} className="bg-sky-50/30">
                    <td className="px-4 py-2 text-sm text-gray-900">{p.positions_nr}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{p.stueckzahl}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 font-mono">{p.kennung || p.artikel}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      <div className="max-w-lg">
                        {p.beschreibung ? (
                          <div className="whitespace-pre-wrap text-xs">{p.beschreibung}</div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ANZEIGETYP_COLORS[p.anzeigetyp] || 'bg-gray-100 text-gray-700'}`}>
                        {p.anzeigetyp_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Other positions with prices */}
        {otherPositions.length > 0 && (
          <div>
            {systemPositions.length > 0 && (
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Weitere Positionen</span>
              </div>
            )}
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">Pos</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">Menge</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Artikel</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Typ</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Stückpreis</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Gesamt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {otherPositions.map((p) => (
                  <tr key={p.positions_id} className={p.is_option ? 'bg-purple-50/30' : ''}>
                    <td className="px-4 py-2 text-sm text-gray-900">{p.positions_nr}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{p.stueckzahl}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 font-mono">{p.kennung || p.artikel}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      <div className="max-w-lg">
                        {p.beschreibung ? (
                          <div className="whitespace-pre-wrap text-xs">{p.beschreibung}</div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                        {p.aufpreis_info && (
                          <div className="text-xs text-amber-600 mt-1 italic">{p.aufpreis_info}</div>
                        )}
                        {p.is_option && (
                          <div className="text-xs text-purple-600 mt-1 italic">Option - nicht im Gesamtpreis</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ANZEIGETYP_COLORS[p.anzeigetyp] || 'bg-gray-100 text-gray-700'}`}>
                        {p.anzeigetyp_label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">
                      {p.price_visible && p.display_price ? formatCurrency(p.display_price) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-gray-900 font-medium">
                      {p.price_visible && p.gesamtpreis_position ? formatCurrency(p.gesamtpreis_position) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-end">
            <div className="w-72 space-y-1">
              {angebot.systempreis && angebot.systempreis !== '0' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Systempreis</span>
                  <span className="font-mono text-gray-900">{formatCurrency(angebot.systempreis)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Summe</span>
                <span className="font-mono text-gray-900">{formatCurrency(angebot.summe)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t">
                <span className="text-gray-900">Gesamtpreis</span>
                <span className="font-mono text-gray-900">{formatCurrency(angebot.gesamtpreis)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SQLAngebotDetail;
