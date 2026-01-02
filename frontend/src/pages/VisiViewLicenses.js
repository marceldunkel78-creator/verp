import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  KeyIcon,
  UserIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

const VisiViewLicenses = () => {
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showOutdated, setShowOutdated] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(9); // show up to 9 tiles per page
  const [totalCount, setTotalCount] = useState(0);

  // Don't load licenses on mount - only when user searches
  // useEffect removed

  const fetchLicenses = async (searchQuery = '', pageNumber = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (!showOutdated) params.append('is_outdated', 'false');
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

  // Refetch when page changes (but only after an initial search)
  useEffect(() => {
    if (hasSearched) {
      fetchLicenses(searchTerm, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLicenses(searchTerm, 1);
  };

  const handleDelete = async (licenseId, licenseNumber) => {
    if (window.confirm(`Möchten Sie die Lizenz "${licenseNumber}" wirklich löschen?`)) {
      try {
        await api.delete(`/visiview/licenses/${licenseId}/`);
        const filtered = licenses.filter(l => l.id !== licenseId);
        setLicenses(filtered);
        setTotalCount(prev => Math.max(0, prev - 1));
        // If this page became empty after deletion, go back one page
        if (filtered.length === 0 && page > 1) {
          setPage(prev => prev - 1);
        }
      } catch (error) {
        console.error('Error deleting license:', error);
        alert('Fehler beim Löschen der Lizenz.');
      }
    }
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
        <button
          onClick={() => navigate('/visiview/licenses/new')}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Neue Lizenz
        </button>
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
        </form>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {licenses.map((license) => (
            <div
              key={license.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
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
                        onClick={() => navigate(`/customers/${license.customer}`)}
                        className="text-indigo-600 hover:underline text-left"
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
              
              {/* Actions */}
              <div className="px-4 py-3 bg-gray-50 border-t flex justify-between">
                <button
                  onClick={() => navigate(`/visiview/licenses/${license.id}`)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  <PencilIcon className="h-4 w-4" />
                  Bearbeiten
                </button>
                <button
                  onClick={() => handleDelete(license.id, license.serial_number)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <TrashIcon className="h-4 w-4" />
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="mt-6 flex justify-center items-center space-x-2">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className={`px-3 py-1 rounded ${page === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              Zurück
            </button>

            {paginationStart > 1 && (
              <button onClick={() => setPage(1)} className="px-3 py-1 rounded bg-white text-gray-700 hover:bg-gray-100">1</button>
            )}

            {paginationStart > 2 && <span className="px-2">…</span>}

            {paginationPages.map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 rounded ${p === page ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
              >
                {p}
              </button>
            ))}

            {paginationEnd < totalPages - 1 && <span className="px-2">…</span>}

            {paginationEnd < totalPages && (
              <button onClick={() => setPage(totalPages)} className="px-3 py-1 rounded bg-white text-gray-700 hover:bg-gray-100">{totalPages}</button>
            )}

            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
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
