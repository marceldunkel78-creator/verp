import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import SortableHeader from '../components/SortableHeader';
import { useAuth } from '../context/AuthContext';

const SQLAngebote = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [angebote, setAngebote] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState(searchParams.get('ordering') || '-datum');

  // Default Verkäufer from URL params or current user's sql_verkaeufer_id
  const defaultVerkaeufer = searchParams.get('verkaeufer') || (user?.sql_verkaeufer_id ? String(user.sql_verkaeufer_id) : '');

  // Filter state from URL params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [verkaeufer, setVerkaeufer] = useState(defaultVerkaeufer);
  const [zeitraum, setZeitraum] = useState(searchParams.get('zeitraum') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [showFilters, setShowFilters] = useState(
    !!(defaultVerkaeufer || searchParams.get('zeitraum'))
  );

  // Load Mitarbeiter list
  useEffect(() => {
    api.get('/sql-angebote/mitarbeiter/')
      .then(res => setMitarbeiter(res.data))
      .catch(() => {});
  }, []);

  const fetchAngebote = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: 50, ordering: sortBy };
      if (search) params.search = search;
      if (verkaeufer) params.verkaeufer = verkaeufer;
      if (zeitraum) {
        const now = new Date();
        const months = parseInt(zeitraum, 10);
        const von = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
        params.datum_von = von.toISOString().slice(0, 10);
      }

      const res = await api.get('/sql-angebote/angebote/', { params });
      setAngebote(res.data.results);
      setTotalCount(res.data.count);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Laden der Angebote');
    } finally {
      setLoading(false);
    }
  }, [search, verkaeufer, zeitraum, page, sortBy]);

  // Re-fetch when page or sorting changes (but only if user has searched)
  useEffect(() => {
    if (hasSearched) fetchAngebote();
  }, [page, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-search if URL already has search params on mount
  useEffect(() => {
    if (searchParams.get('search') || searchParams.get('verkaeufer') || searchParams.get('zeitraum')) {
      setHasSearched(true);
      fetchAngebote();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state to URL
  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (verkaeufer) params.verkaeufer = verkaeufer;
    if (zeitraum) params.zeitraum = zeitraum;
    if (page > 1) params.page = page.toString();
    if (sortBy && sortBy !== '-datum') params.ordering = sortBy;
    setSearchParams(params, { replace: true });
  }, [search, verkaeufer, zeitraum, page, sortBy, setSearchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setHasSearched(true);
    fetchAngebote();
  };

  const clearFilters = () => {
    setSearch('');
    setVerkaeufer('');
    setZeitraum('');
    setPage(1);
    setHasSearched(false);
    setAngebote([]);
    setTotalCount(0);
    setTotalPages(0);
  };

  const hasActiveFilters = search || verkaeufer || zeitraum;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('de-DE');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    if (!val || val === '0') return '-';
    try {
      const num = parseFloat(val);
      return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    } catch {
      return val;
    }
  };

  const zustandLabels = {
    1: { label: 'Entwurf', color: 'bg-gray-100 text-gray-700' },
    2: { label: 'Erstellt', color: 'bg-blue-100 text-blue-700' },
    3: { label: 'Versendet', color: 'bg-green-100 text-green-700' },
    4: { label: 'Abgelehnt', color: 'bg-red-100 text-red-700' },
    5: { label: 'Angenommen', color: 'bg-emerald-100 text-emerald-700' },
    6: { label: 'Auftrag', color: 'bg-purple-100 text-purple-700' },
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">SQL-Angebote</h1>
        <p className="mt-2 text-sm text-gray-600">
          Legacy-Angebote aus der SQL Server Datenbank (read-only)
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kundenname, Firma oder AdressenID..."
                className="pl-10 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Suchen
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-md text-sm font-medium ${
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'
            } hover:bg-gray-50`}
          >
            <FunnelIcon className="h-4 w-4" />
            Filter
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:text-red-800"
            >
              <XMarkIcon className="h-4 w-4" />
              Zurücksetzen
            </button>
          )}
        </form>

        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verkäufer</label>
              <select
                value={verkaeufer}
                onChange={(e) => setVerkaeufer(e.target.value)}
                className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">Alle</option>
                {mitarbeiter.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zeitraum</label>
              <div className="flex gap-2">
                {[{ value: '', label: 'Alle' }, { value: '1', label: '1 Monat' }, { value: '3', label: '3 Monate' }, { value: '12', label: '12 Monate' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setZeitraum(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                      zeitraum === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results count */}
      {!loading && !error && hasSearched && (
        <p className="mb-3 text-sm text-gray-500">
          {totalCount} Angebot{totalCount !== 1 ? 'e' : ''} gefunden
        </p>
      )}

      {/* Initial state - no search yet */}
      {!hasSearched && !loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">Angebote durchsuchen</h3>
          <p className="mt-1 text-sm text-gray-500">
            Geben Sie einen Suchbegriff ein oder setzen Sie Filter und klicken Sie auf &quot;Suchen&quot;.
          </p>
        </div>
      )}

      {/* Table */}
      {hasSearched && (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] md:max-h-none" style={{ transform: 'scaleY(-1)' }}>
          <div style={{ transform: 'scaleY(-1)' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader field="angebot_nummer" label="Angebotsnummer" sortBy={sortBy} setSortBy={setSortBy} className="px-4 py-3" />
                <SortableHeader field="datum" label="Datum" sortBy={sortBy} setSortBy={setSortBy} className="px-4 py-3" />
                <SortableHeader field="kunde" label="Kunde" sortBy={sortBy} setSortBy={setSortBy} className="px-4 py-3" />
                <SortableHeader field="kurzbeschreibung" label="Kurzbeschreibung" sortBy={sortBy} setSortBy={setSortBy} className="px-4 py-3" />
                <SortableHeader field="verkaeufer" label="Verkäufer" sortBy={sortBy} setSortBy={setSortBy} className="px-4 py-3" />
                <SortableHeader field="gesamtpreis" label="Gesamtpreis" sortBy={sortBy} setSortBy={setSortBy} className="px-4 py-3" align="right" />
                <SortableHeader field="zustand" label="Status" sortBy={sortBy} setSortBy={setSortBy} className="px-4 py-3" align="center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Lade Angebote...
                    </div>
                  </td>
                </tr>
              ) : angebote.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    Keine Angebote gefunden
                  </td>
                </tr>
              ) : (
                angebote.map((a) => {
                  const zst = zustandLabels[a.zustand_id] || { label: `Zustand ${a.zustand_id}`, color: 'bg-gray-100 text-gray-700' };
                  const kundenDisplay = a.firma || `${a.kunde_vorname} ${a.kunde_name}`.trim() || `Adr. ${a.adressen_id}`;
                  return (
                    <tr
                      key={a.angebot_id}
                      onClick={() => navigate(`/sales/sql-angebote/${a.angebot_id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        Q-{a.angebot_nummer}-{a.versions_nummer}-{a.datum ? String(new Date(a.datum).getMonth() + 1).padStart(2, '0') : '00'}/{a.jahr ? String(a.jahr).slice(-2) : '00'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(a.datum)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{kundenDisplay}</div>
                        {a.firma && a.kunde_name && <div className="text-xs text-gray-500">{a.kunde_vorname ? `${a.kunde_vorname} ${a.kunde_name}` : a.kunde_name}</div>}
                        {a.institut && <div className="text-xs text-gray-400">{a.institut}</div>}
                        {a.ort && <div className="text-xs text-gray-400">{a.ort}</div>}
                        {a.verp_customer_id && (
                          <Link
                            to={`/sales/customers/${a.verp_customer_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            → {a.verp_customer_number}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[250px] truncate">
                        {a.kurzbeschreibung}
                        {a.verp_order_id && (
                          <div>
                            <Link
                              to={`/sales/order-processing/${a.verp_order_id}?tab=basisinfos`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
                            >
                              → {a.verp_order_number}
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{a.verkaeufer_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                        {formatCurrency(a.gesamtpreis)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${zst.color}`}>
                          {zst.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Seite {page} von {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zurück
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Weiter
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default SQLAngebote;
