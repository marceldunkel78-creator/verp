import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import SortableHeader from '../components/SortableHeader';
import { useAuth } from '../context/AuthContext';

const SQLProjekte = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [projekte, setProjekte] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [lookups, setLookups] = useState({});
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState(searchParams.get('ordering') || '-auftragsdatum');

  // Default Verkäufer from URL or current user
  const defaultVerkaeufer = searchParams.get('verkaeufer') || (user?.sql_verkaeufer_id ? String(user.sql_verkaeufer_id) : '');

  // Filter state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [verkaeufer, setVerkaeufer] = useState(defaultVerkaeufer);
  const [systemGruppe, setSystemGruppe] = useState(searchParams.get('system_gruppe') || '');
  const [prioritaet, setPrioritaet] = useState(
    searchParams.get('prioritaet') ? searchParams.get('prioritaet').split(',').map(Number) : []
  );
  const [aktionVon, setAktionVon] = useState(searchParams.get('aktion_von') || '');
  const [aktionBis, setAktionBis] = useState(searchParams.get('aktion_bis') || '');
  const [auftragVon, setAuftragVon] = useState(searchParams.get('auftrag_von') || '');
  const [auftragBis, setAuftragBis] = useState(searchParams.get('auftrag_bis') || '');
  const [aktivFilter, setAktivFilter] = useState(searchParams.get('aktiv') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [showFilters, setShowFilters] = useState(
    !!(defaultVerkaeufer || searchParams.get('system_gruppe') || searchParams.get('prioritaet') || searchParams.get('aktion_von') || searchParams.get('auftrag_von') || searchParams.get('aktiv'))
  );

  // Load lookups
  useEffect(() => {
    api.get('/sql-projekte/lookups/')
      .then(res => setLookups(res.data))
      .catch(() => {});
  }, []);

  const fetchProjekte = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: 50, ordering: sortBy };
      if (search) params.search = search;
      if (verkaeufer) params.verkaeufer = verkaeufer;
      if (systemGruppe) params.system_gruppe = systemGruppe;
      if (prioritaet.length > 0) params.prioritaet = prioritaet.join(',');
      if (aktionVon) params.aktion_von = aktionVon;
      if (aktionBis) params.aktion_bis = aktionBis;
      if (auftragVon) params.auftrag_von = auftragVon;
      if (auftragBis) params.auftrag_bis = auftragBis;
      if (aktivFilter) params.aktiv = aktivFilter;

      const res = await api.get('/sql-projekte/projekte/', { params });
      setProjekte(res.data.results);
      setTotalCount(res.data.count);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Laden der Projekte');
    } finally {
      setLoading(false);
    }
  }, [search, verkaeufer, systemGruppe, prioritaet, aktionVon, aktionBis, auftragVon, auftragBis, aktivFilter, page, sortBy]);

  useEffect(() => {
    if (hasSearched) fetchProjekte();
  }, [page, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-search if URL has params
  useEffect(() => {
    if (searchParams.get('search') || searchParams.get('verkaeufer') || searchParams.get('system_gruppe') || searchParams.get('prioritaet') || searchParams.get('aktion_von') || searchParams.get('auftrag_von') || searchParams.get('aktiv')) {
      setHasSearched(true);
      fetchProjekte();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state to URL
  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (verkaeufer) params.verkaeufer = verkaeufer;
    if (systemGruppe) params.system_gruppe = systemGruppe;
    if (prioritaet.length > 0) params.prioritaet = prioritaet.join(',');
    if (aktionVon) params.aktion_von = aktionVon;
    if (aktionBis) params.aktion_bis = aktionBis;
    if (auftragVon) params.auftrag_von = auftragVon;
    if (auftragBis) params.auftrag_bis = auftragBis;
    if (aktivFilter) params.aktiv = aktivFilter;
    if (page > 1) params.page = page.toString();
    if (sortBy && sortBy !== '-auftragsdatum') params.ordering = sortBy;
    setSearchParams(params, { replace: true });
  }, [search, verkaeufer, systemGruppe, prioritaet, aktionVon, aktionBis, auftragVon, auftragBis, aktivFilter, page, sortBy, setSearchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setHasSearched(true);
    fetchProjekte();
  };

  const clearFilters = () => {
    setSearch('');
    setVerkaeufer('');
    setSystemGruppe('');
    setPrioritaet([]);
    setAktionVon('');
    setAktionBis('');
    setAuftragVon('');
    setAuftragBis('');
    setAktivFilter('');
    setPage(1);
    setHasSearched(false);
    setProjekte([]);
    setTotalCount(0);
    setTotalPages(0);
  };

  const hasActiveFilters = search || verkaeufer || systemGruppe || prioritaet.length > 0 || aktionVon || aktionBis || auftragVon || auftragBis || aktivFilter;

  const togglePrioritaet = (id) => {
    setPrioritaet(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

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

  const prioritaetColors = {
    1: 'bg-emerald-100 text-emerald-700',  // VS-Kauf
    2: 'bg-red-100 text-red-700',          // Konkurrenzkauf
    3: 'bg-gray-100 text-gray-600',        // kein Interesse
    4: 'bg-blue-100 text-blue-700',        // neu/unbekannt
    5: 'bg-gray-100 text-gray-500',        // Prospektsammler
    6: 'bg-yellow-100 text-yellow-700',    // geringes Interesse
    7: 'bg-amber-100 text-amber-700',      // mittleres Interesse
    8: 'bg-orange-100 text-orange-700',    // starkes Interesse
    9: 'bg-purple-100 text-purple-700',    // Geld beantragt
    10: 'bg-green-100 text-green-700',     // will in Kürze kaufen
  };

  // --- Create Modal State ---
  const canWrite = user?.is_superuser || user?.can_write_sales_sql_projekte;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newProjekt, setNewProjekt] = useState({
    projekt_name: '',
    system_gruppe_id: '',
    produkt_untergruppe: '',
    prioritaet_id: '4',
    verkaeufer_id: user?.sql_verkaeufer_id ? String(user.sql_verkaeufer_id) : '',
    auftragswahrscheinlichkeit: '',
    auftragssumme: '',
    interessen_beschreibung: '',
  });

  const searchCustomers = useCallback(async (q) => {
    if (q.length < 2) { setCustomerResults([]); return; }
    setCustomerSearching(true);
    try {
      const res = await api.get('/customers/customers/', { params: { search: q, page_size: 10 } });
      setCustomerResults(res.data.results || []);
    } catch { setCustomerResults([]); }
    finally { setCustomerSearching(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (customerSearch) searchCustomers(customerSearch); }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, searchCustomers]);

  const handleCreateProjekt = async () => {
    if (!selectedCustomer) { setCreateError('Bitte wählen Sie einen VERP-Kunden aus.'); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await api.post('/sql-projekte/projekte/create/', {
        customer_id: selectedCustomer.id,
        ...newProjekt,
      });
      setShowCreateModal(false);
      navigate(`/sales/sql-projekte/${res.data.id}`);
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Fehler beim Erstellen');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerResults([]);
    setCreateError(null);
    setNewProjekt({
      projekt_name: '',
      system_gruppe_id: '',
      produkt_untergruppe: '',
      prioritaet_id: '4',
      verkaeufer_id: user?.sql_verkaeufer_id ? String(user.sql_verkaeufer_id) : '',
      auftragswahrscheinlichkeit: '',
      auftragssumme: '',
      interessen_beschreibung: '',
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SQL-Projekte</h1>
          <p className="mt-2 text-sm text-gray-600">
            Interessen/Projekte aus der SQL Server Datenbank
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => { resetCreateForm(); setShowCreateModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-5 w-5" />
            Neues Projekt
          </button>
        )}
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
                placeholder="Beschreibung, Kunde, Ort oder InteressenID..."
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
          <div className="mt-4 pt-4 border-t space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verkäufer</label>
                <select
                  value={verkaeufer}
                  onChange={(e) => setVerkaeufer(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Alle</option>
                  {(lookups.verkaeufer || []).map(v => (
                    <option key={v.id} value={v.id}>{v.text}{v.kuerzel ? ` (${v.kuerzel})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Systemgruppe</label>
                <select
                  value={systemGruppe}
                  onChange={(e) => setSystemGruppe(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Alle</option>
                  {(lookups.system_gruppen || []).map(sg => (
                    <option key={sg.id} value={sg.id}>{sg.text}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Einstufung Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Einstufung (Mehrfachauswahl)</label>
              <div className="flex flex-wrap gap-2">
                {(lookups.prioritaeten || []).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePrioritaet(p.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      prioritaet.includes(p.id)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {p.text}
                  </button>
                ))}
                {prioritaet.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPrioritaet([])}
                    className="px-3 py-1.5 rounded-full text-sm text-red-600 border border-red-300 hover:bg-red-50"
                  >
                    ✕ Zurücksetzen
                  </button>
                )}
              </div>
            </div>

            {/* Aktiv-Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={aktivFilter}
                onChange={(e) => setAktivFilter(e.target.value)}
                className="block w-48 rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">Alle</option>
                <option value="1">Nur aktive</option>
                <option value="0">Nur inaktive</option>
              </select>
            </div>

            {/* Datumsfilter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nächste Aktion</label>
                <div className="flex gap-2 items-center">
                  <input type="date" value={aktionVon} onChange={(e) => setAktionVon(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                  <span className="text-gray-400 text-sm">bis</span>
                  <input type="date" value={aktionBis} onChange={(e) => setAktionBis(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auftragsdatum</label>
                <div className="flex gap-2 items-center">
                  <input type="date" value={auftragVon} onChange={(e) => setAuftragVon(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                  <span className="text-gray-400 text-sm">bis</span>
                  <input type="date" value={auftragBis} onChange={(e) => setAuftragBis(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
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
          {totalCount} Projekt{totalCount !== 1 ? 'e' : ''} gefunden
        </p>
      )}

      {/* Initial state */}
      {!hasSearched && !loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">Projekte durchsuchen</h3>
          <p className="mt-1 text-sm text-gray-500">
            Geben Sie einen Suchbegriff ein oder wählen Sie Filter, um Projekte anzuzeigen.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Results Table */}
      {!loading && hasSearched && projekte.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto" style={{ transform: 'rotateX(180deg)' }}>
            <table className="min-w-full divide-y divide-gray-200" style={{ transform: 'rotateX(180deg)' }}>
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label="ID" field="id" sortBy={sortBy} setSortBy={setSortBy} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde/Firma</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projektname</th>
                  <SortableHeader label="Verkäufer" field="verkaeufer" sortBy={sortBy} setSortBy={setSortBy} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Einstufung</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summe</th>
                  <SortableHeader label="Nächste Aktion" field="naechste_aktion" sortBy={sortBy} setSortBy={setSortBy} className="whitespace-nowrap" />
                  <SortableHeader label="Auftragsdatum" field="auftragsdatum" sortBy={sortBy} setSortBy={setSortBy} className="whitespace-nowrap" />
                  <SortableHeader label="Erstellt" field="datum" sortBy={sortBy} setSortBy={setSortBy} className="whitespace-nowrap" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projekte.map((p) => {
                  const isOverdue = p.naechste_aktion && new Date(p.naechste_aktion) < new Date();
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/sales/sql-projekte/${p.id}`)}
                      className={`hover:bg-gray-50 cursor-pointer ${isOverdue ? 'bg-red-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">{p.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="max-w-[200px]">
                          <div className="font-medium truncate" title={p.adresse?.firma || '-'}>
                            {p.adresse?.firma || '-'}
                          </div>
                          {p.adresse?.name && (
                            <div className="text-xs text-gray-600 truncate" title={p.adresse.name}>{p.adresse.name}</div>
                          )}
                          {p.adresse?.ort && (
                            <div className="text-xs text-gray-500">{p.adresse.ort}</div>
                          )}
                          {p.verp_customer && (
                            <Link
                              to={`/sales/customers/${p.verp_customer.customer_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-500 hover:text-blue-700"
                            >
                              → {p.verp_customer.customer_number}
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="max-w-[160px] break-words" title={p.projekt_name || ''}>
                          {p.projekt_name || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.verkaeufer || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {p.prioritaet ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${prioritaetColors[p.prioritaet_id] || 'bg-gray-100 text-gray-700'}`}>
                            {p.prioritaet}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(p.auftragssumme)}</td>
                      <td className={`px-2 py-3 text-sm whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                        {formatDate(p.naechste_aktion)}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(p.auftragsdatum)}</td>
                      <td className="px-2 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(p.datum)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-700">
                Seite {page} von {totalPages} ({totalCount} Ergebnisse)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Zurück
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Weiter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No results */}
      {!loading && hasSearched && projekte.length === 0 && !error && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">Keine Projekte gefunden.</p>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowCreateModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Neues SQL-Projekt erstellen</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{createError}</div>
              )}

              {/* Kundensuche */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VERP-Kunde <span className="text-red-500">*</span>
                </label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div>
                      <div className="font-medium text-sm">{selectedCustomer.customer_number} - {selectedCustomer.full_name || `${selectedCustomer.first_name} ${selectedCustomer.last_name}`}</div>
                      {selectedCustomer.company_name && <div className="text-xs text-gray-600">{selectedCustomer.company_name}</div>}
                    </div>
                    <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-red-500 hover:text-red-700 text-sm">
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Kunde suchen (Name, Nummer, E-Mail, Ort)..."
                      className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      autoFocus
                    />
                    {customerSearching && <div className="absolute right-3 top-2.5 text-xs text-gray-400">Suche...</div>}
                    {customerResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {customerResults.map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCustomer(c); setCustomerResults([]); setCustomerSearch(''); }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          >
                            <div className="text-sm font-medium">{c.customer_number} - {c.full_name || `${c.first_name} ${c.last_name}`}</div>
                            {c.company_name && <div className="text-xs text-gray-500">{c.company_name}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Projektname */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Projektname</label>
                <input
                  type="text"
                  value={newProjekt.projekt_name}
                  onChange={(e) => setNewProjekt(p => ({ ...p, projekt_name: e.target.value }))}
                  placeholder="z.B. Konfokalmikroskop für Zellbiologie..."
                  className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Systemgruppe */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Systemgruppe</label>
                  <select
                    value={newProjekt.system_gruppe_id}
                    onChange={(e) => setNewProjekt(p => ({ ...p, system_gruppe_id: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">- wählen -</option>
                    {(lookups.system_gruppen || []).map(sg => (
                      <option key={sg.id} value={sg.id}>{sg.text}</option>
                    ))}
                  </select>
                </div>
                {/* Verkäufer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verkäufer</label>
                  <select
                    value={newProjekt.verkaeufer_id}
                    onChange={(e) => setNewProjekt(p => ({ ...p, verkaeufer_id: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">- keiner -</option>
                    {(lookups.verkaeufer || []).map(v => (
                      <option key={v.id} value={v.id}>{v.text}{v.kuerzel ? ` (${v.kuerzel})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Einstufung */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Einstufung</label>
                  <select
                    value={newProjekt.prioritaet_id}
                    onChange={(e) => setNewProjekt(p => ({ ...p, prioritaet_id: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    {(lookups.prioritaeten || []).map(p => (
                      <option key={p.id} value={p.id}>{p.text}</option>
                    ))}
                  </select>
                </div>
                {/* Untergruppe */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Untergruppe</label>
                  <input
                    type="text"
                    value={newProjekt.produkt_untergruppe}
                    onChange={(e) => setNewProjekt(p => ({ ...p, produkt_untergruppe: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auftragssumme (€)</label>
                  <input
                    type="number" step="0.01"
                    value={newProjekt.auftragssumme}
                    onChange={(e) => setNewProjekt(p => ({ ...p, auftragssumme: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wahrscheinlichkeit (%)</label>
                  <input
                    type="number" min="0" max="100"
                    value={newProjekt.auftragswahrscheinlichkeit}
                    onChange={(e) => setNewProjekt(p => ({ ...p, auftragswahrscheinlichkeit: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Beschreibung */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  value={newProjekt.interessen_beschreibung}
                  onChange={(e) => setNewProjekt(p => ({ ...p, interessen_beschreibung: e.target.value }))}
                  rows={3}
                  className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateProjekt}
                  disabled={creating || !selectedCustomer}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  {creating ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SQLProjekte;
