import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import storage from '../utils/sessionStore';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  KeyIcon,
  UserIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline';

const VisiViewLicenses = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showOutdated, setShowOutdated] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(9); // show up to 9 tiles per page
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState('cards');

  const SESSION_KEY = 'visiview_licenses_search_state';

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.searchTerm !== undefined) setSearchTerm(st.searchTerm);
      if (st.statusFilter !== undefined) setStatusFilter(st.statusFilter);
      if (st.showOutdated !== undefined) setShowOutdated(st.showOutdated);
      if (st.viewMode) setViewMode(st.viewMode);
      if (st.page) setPage(st.page);
      if (st.licenses) setLicenses(st.licenses);
      if (st.totalCount !== undefined) setTotalCount(st.totalCount);
      if (st.hasSearched) setHasSearched(true);
      return { page: st.page || 1, filters: st };
    } catch (e) {
      console.warn('Failed to load visiview licenses search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { searchTerm, statusFilter, showOutdated, viewMode, page, licenses, totalCount, hasSearched };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save visiview licenses search state', e);
    }
  };

  // On mount: prefer URL params, else restore from session storage
  useEffect(() => {
    const urlParams = Object.fromEntries([...searchParams]);
    if (Object.keys(urlParams).length > 0) {
      // URL has params - let the searchParams effect handle it
      return;
    }

    const restored = loadSearchState();
    if (restored && restored.filters && restored.filters.hasSearched) {
      // Restore URL params from session
      const params = {};
      if (restored.filters.searchTerm) params.search = restored.filters.searchTerm;
      if (restored.filters.statusFilter) params.status = restored.filters.statusFilter;
      if (restored.filters.showOutdated) params.outdated = 'true';
      if (restored.filters.page) params.page = String(restored.filters.page);
      setSearchParams(params);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state from URL params
  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newSearchTerm = params.search || '';
      const newStatusFilter = params.status || '';
      const newShowOutdated = params.outdated === 'true';
      const newPage = params.page ? parseInt(params.page, 10) : 1;

      setSearchTerm(newSearchTerm);
      setStatusFilter(newStatusFilter);
      setShowOutdated(newShowOutdated);
      setPage(newPage);
      setHasSearched(true);
      fetchLicenses(newSearchTerm, newPage, newStatusFilter, newShowOutdated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Save state whenever relevant values change
  useEffect(() => {
    saveSearchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, showOutdated, viewMode, page, licenses, totalCount, hasSearched]);

  const fetchLicenses = async (searchQuery = '', pageNumber = 1, status = statusFilter, outdated = showOutdated) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (!outdated) params.append('is_outdated', 'false');
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('page_size', String(pageSize));
      params.append('page', String(pageNumber));

      const response = await api.get(`/visiview/licenses/?${params.toString()}`);
      // DRF style paginated response: { count, next, previous, results }
      if (response.data && response.data.results) {
        setLicenses(response.data.results);
        setTotalCount(response.data.count || response.data.results.length);
      } else {
        // Fallback if API returns non-paginated list
        setLicenses(response.data || []);
        setTotalCount((response.data && response.data.length) ? response.data.length : 0);
      }
      setHasSearched(true);
    } catch (error) {
      console.error('Error fetching licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (statusFilter) params.status = statusFilter;
    if (showOutdated) params.outdated = 'true';
    params.page = '1';
    setSearchParams(params);
    setPage(1);
    setHasSearched(true);
  };

  const handleReset = () => {
    setSearchTerm('');
    setStatusFilter('');
    setShowOutdated(false);
    setLicenses([]);
    setPage(1);
    setTotalCount(0);
    setHasSearched(false);
    setSearchParams({});
    try { storage.remove(SESSION_KEY); } catch (e) { /* ignore */ }
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'demo': 'bg-blue-100 text-blue-800',
      'loaner': 'bg-yellow-100 text-yellow-800',
      'returned': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800',
      'defect': 'bg-orange-100 text-orange-800',
      'lost': 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // No client-side filtering needed anymore - server handles search

  // Pagination helpers (computed outside JSX to avoid IIFEs in render)
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 0;
  let paginationStart = 1;
  let paginationEnd = 1;
  let paginationPages = [];
  if (totalPages > 0) {
    paginationStart = Math.max(1, page - 2);
    paginationEnd = Math.min(totalPages, page + 2);
    for (let p = paginationStart; p <= paginationEnd; p++) paginationPages.push(p);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <KeyIcon className="h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">VisiView Lizenzen</h1>
        </div>
        <div className="flex items-center space-x-2">
          {/* View Toggle */}
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 text-sm font-medium rounded-l-md border ${
                viewMode === 'cards'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Kachelansicht"
            >
              <Squares2X2Icon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Listenansicht"
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={() => navigate('/visiview/licenses/new')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Neue Lizenz
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Lizenznummer, Seriennummer, Kunde..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>
          
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Alle Status</option>
              <option value="active">Aktiv</option>
              <option value="demo">Demo</option>
              <option value="loaner">Leihgerät</option>
              <option value="returned">Zurückgegeben</option>
              <option value="cancelled">Storniert</option>
              <option value="defect">Defekt</option>
              <option value="lost">Verloren</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOutdated}
                onChange={(e) => setShowOutdated(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Veraltete anzeigen</span>
            </label>
          </div>
          
          <button
            type="submit"
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Suchen
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Zurücksetzen
          </button>
        </form>
        {hasSearched && (
          <div className="mt-3 text-sm text-gray-600">
            {totalCount} Lizenzen gefunden (Seite {page} von {totalPages || 1})
          </div>
        )}
      </div>

      {/* Stats */}
      {hasSearched && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-indigo-600">{totalCount}</div>
            <div className="text-sm text-gray-600">Gefunden</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {licenses.filter(l => l.status === 'active').length}
            </div>
            <div className="text-sm text-gray-600">Aktiv</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">
              {licenses.filter(l => l.is_demo).length}
            </div>
            <div className="text-sm text-gray-600">Demo</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">
              {licenses.filter(l => l.is_loaner).length}
            </div>
            <div className="text-sm text-gray-600">Leihgeräte</div>
          </div>
        </div>
      )}

      {/* License Cards */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laden...</p>
        </div>
      ) : !hasSearched ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
          <MagnifyingGlassIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Bitte suchen Sie nach einer Lizenz</p>
          <p className="text-sm mt-2">Geben Sie eine Lizenznummer, Seriennummer oder einen Kundennamen ein</p>
        </div>
      ) : licenses.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <KeyIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Keine Lizenzen gefunden</p>
        </div>
      ) : (
        <>
          {/* Card View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {licenses.map((license) => (
                <div
                  key={license.id}
                  onClick={() => navigate(`/visiview/licenses/${license.id}`)}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden cursor-pointer hover:bg-gray-50"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center group-hover:bg-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-indigo-600">
                        {license.serial_number}
                      </span>
                      {license.is_demo && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">Demo</span>
                      )}
                      {license.is_loaner && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">Leih</span>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(license.status)}`}>
                      {license.status_display}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <UserIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        {license.customer ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/customers/${license.customer}`);
                            }}
                            className="text-indigo-600 hover:underline text-left pointer-events-auto"
                          >
                            {license.customer_name}
                          </button>
                        ) : (
                          <span className="text-gray-700">{license.customer_name_legacy || '-'}</span>
                        )}
                        {license.customer_number && (
                          <span className="text-xs text-gray-500 ml-2">({license.customer_number})</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <CalendarIcon className="h-4 w-4" />
                        <span>{license.delivery_date ? new Date(license.delivery_date).toLocaleDateString('de-DE') : '-'}</span>
                      </div>
                      <div className="text-gray-600">
                        <span className="font-medium">v{license.version || '-'}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {license.options_count > 0 ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm text-gray-600">{license.options_count} Optionen</span>
                      </div>
                      {license.distributor && (
                        <span className="text-xs text-gray-500">{license.distributor}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seriennummer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kunde
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lieferdatum
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Version
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Optionen
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Typ
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {licenses.map((license) => (
                    <tr
                      key={license.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/visiview/licenses/${license.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <KeyIcon className="h-5 w-5 text-indigo-600 mr-3" />
                          <span className="font-mono font-medium text-indigo-600">
                            {license.serial_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {license.customer_name || license.customer_name_legacy || '-'}
                        </div>
                        {license.customer_number && (
                          <div className="text-xs text-gray-500">{license.customer_number}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {license.delivery_date ? new Date(license.delivery_date).toLocaleDateString('de-DE') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">v{license.version || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          {license.options_count > 0 ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-4 w-4 text-gray-400" />
                          )}
                          {license.options_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1">
                          {license.is_demo && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">Demo</span>
                          )}
                          {license.is_loaner && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">Leih</span>
                          )}
                          {!license.is_demo && !license.is_loaner && (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(license.status)}`}>
                          {license.status_display}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="mt-6 flex justify-center items-center space-x-2">
            <button
              onClick={() => {
                const newPage = Math.max(1, page - 1);
                setPage(newPage);
                setSearchParams(prev => {
                  const params = Object.fromEntries([...prev]);
                  params.page = String(newPage);
                  return params;
                });
              }}
              disabled={page === 1}
              className={`px-3 py-1 rounded ${page === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              Zurück
            </button>

            {paginationStart > 1 && (
              <button 
                onClick={() => {
                  setPage(1);
                  setSearchParams(prev => {
                    const params = Object.fromEntries([...prev]);
                    params.page = '1';
                    return params;
                  });
                }} 
                className="px-3 py-1 rounded bg-white text-gray-700 hover:bg-gray-100"
              >
                1
              </button>
            )}

            {paginationStart > 2 && <span className="px-2">…</span>}

            {paginationPages.map(p => (
              <button
                key={p}
                onClick={() => {
                  setPage(p);
                  setSearchParams(prev => {
                    const params = Object.fromEntries([...prev]);
                    params.page = String(p);
                    return params;
                  });
                }}
                className={`px-3 py-1 rounded ${p === page ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
              >
                {p}
              </button>
            ))}

            {paginationEnd < totalPages - 1 && <span className="px-2">…</span>}

            {paginationEnd < totalPages && (
              <button 
                onClick={() => {
                  setPage(totalPages);
                  setSearchParams(prev => {
                    const params = Object.fromEntries([...prev]);
                    params.page = String(totalPages);
                    return params;
                  });
                }} 
                className="px-3 py-1 rounded bg-white text-gray-700 hover:bg-gray-100"
              >
                {totalPages}
              </button>
            )}

            <button
              onClick={() => {
                const newPage = Math.min(totalPages, page + 1);
                setPage(newPage);
                setSearchParams(prev => {
                  const params = Object.fromEntries([...prev]);
                  params.page = String(newPage);
                  return params;
                });
              }}
              disabled={page === totalPages}
              className={`px-3 py-1 rounded ${page === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              Weiter
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default VisiViewLicenses;
