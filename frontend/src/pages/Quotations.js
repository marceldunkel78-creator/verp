import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import storage from '../utils/sessionStore';
import { 
  PlusIcon, EyeIcon, PencilIcon, TrashIcon, 
  DocumentArrowDownIcon, DocumentIcon, DocumentTextIcon,
  UserIcon, CalendarIcon, ClockIcon, CurrencyEuroIcon
} from '@heroicons/react/24/outline';

const Quotations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    year: '',
    created_by: ''
  });
  
  const SESSION_KEY = 'quotations_search_state';
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.filters) setFilters(st.filters);
      if (st.currentPage) setCurrentPage(st.currentPage);
      if (st.quotations) setQuotations(st.quotations);
      if (st.totalPages) setTotalPages(st.totalPages);
      if (st.hasSearched) setHasSearched(true);
      return { page: st.currentPage || 1, filters: st.filters || null };
    } catch (e) {
      console.warn('Failed to load quotations search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { filters, currentPage, quotations, totalPages, hasSearched };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save quotations search state', e);
    }
  };

  useEffect(() => {
    // On mount prefer URL params; otherwise restore from localStorage and populate URL
    const urlParams = Object.fromEntries([...searchParams]);
    if (Object.keys(urlParams).length > 0) {
      // let the searchParams effect handle fetching
      return;
    }

    const restored = loadSearchState();
    if (restored && restored.page) {
      const params = {};
      if (restored.filters) {
        if (restored.filters.search) params.search = restored.filters.search;
        if (restored.filters.status) params.status = restored.filters.status;
        if (restored.filters.year) params.year = restored.filters.year;
        if (restored.filters.created_by) params.created_by = restored.filters.created_by;
      }
      params.page = String(restored.page);
      setSearchParams(params);
    } else if (!restored && hasSearched) {
      fetchQuotations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hasSearched) {
      fetchQuotations();
    }
  }, [currentPage]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // persist state whenever relevant parts change
    saveSearchState();
  }, [filters, currentPage, quotations, totalPages, hasSearched]);

  // React to URL query param changes (back/forward navigation)
  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newFilters = {
        search: params.search || '',
        status: params.status || '',
        year: params.year || '',
        created_by: params.created_by || ''
      };
      setFilters(newFilters);
      const page = params.page ? parseInt(params.page, 10) : 1;
      setCurrentPage(page);
      setHasSearched(true);
      // fetch to restore the list immediately when navigating back/forward
      fetchQuotations(page, newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const canWrite = user?.is_staff || user?.is_superuser || user?.can_write_sales;

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Benutzer:', error);
      setUsers([]);
    }
  };

  // Load users once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchUsers();
  }, []);
  const fetchQuotations = async (pageArg = null, filtersArg = null) => {
    const page = pageArg || currentPage;
    const useFilters = filtersArg || filters;

    setLoading(true);
    try {
      let url = '/sales/quotations/';
      const params = new URLSearchParams();
      
      if (useFilters.search) params.append('search', useFilters.search);
      if (useFilters.status) params.append('status', useFilters.status);
      if (useFilters.year) params.append('year', useFilters.year);
      if (useFilters.created_by) params.append('created_by', useFilters.created_by);
      
      // Pagination
      params.append('page', page);
      params.append('page_size', '9');
      
      url += `?${params.toString()}`;
      
      const response = await api.get(url);
      const data = response.data;
      
      let quotationsData = [];
      if (Array.isArray(data)) {
        quotationsData = data;
      } else if (data && Array.isArray(data.results)) {
        quotationsData = data.results;
      }
      
      setQuotations(quotationsData);
      setTotalPages(Math.ceil((data.count || quotationsData.length) / 9));
      setHasSearched(true);

      // Persist immediately so localStorage is updated even if React effects are delayed
      try {
        saveSearchState();
      } catch (e) { console.warn('Could not persist quotations search state', e); }

      if (pageArg) setCurrentPage(page);
    } catch (error) {
      console.error('Fehler beim Laden der Angebote:', error);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.year) params.year = filters.year;
    if (filters.created_by) params.created_by = filters.created_by;
    params.page = '1';
    setSearchParams(params);
    setCurrentPage(1);
    setHasSearched(true);
  };

  const handleReset = () => {
    setFilters({
      search: '',
      status: '',
      year: '',
      created_by: ''
    });
    setQuotations([]);
    setCurrentPage(1);
    setHasSearched(false);
    try { storage.remove(SESSION_KEY); } catch (e) { /* ignore */ }
    setSearchParams({});
  };
  
  const handleDelete = async (id) => {
    if (window.confirm('Möchten Sie dieses Angebot wirklich löschen?')) {
      try {
        await api.delete(`/sales/quotations/${id}/`);
        fetchQuotations();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen des Angebots');
      }
    }
  };
  
  const handleDownloadPDF = async (quotationId, quotationNumber) => {
    try {
      const response = await api.get(`/sales/quotations/${quotationId}/download_pdf/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Angebot_${quotationNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim PDF-Download:', error);
      alert('Fehler beim Herunterladen des PDFs');
    }
  };
  
  const handleViewPDF = async (quotationId) => {
    try {
      const response = await api.get(`/sales/quotations/${quotationId}/download_pdf/`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Fehler beim PDF-Anzeigen:', error);
      alert('Fehler beim Anzeigen des PDFs');
    }
  };
  
  const getStatusBadge = (status, statusDisplay) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-red-100 text-red-800',
      ORDERED: 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusDisplay}
      </span>
    );
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }
  
  // Generiere Jahre für Filter (aktuelle Jahr +/- 5 Jahre)
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 11}, (_, i) => currentYear - 5 + i);
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <nav className="text-sm text-gray-500 mb-2">
            <Link to="/sales" className="hover:text-gray-700">Sales & Order Management</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Angebote</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <DocumentTextIcon className="h-8 w-8 mr-3 text-green-600" />
            Angebotsverwaltung
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Kundenangebote verwalten und generieren
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => navigate('/sales/quotations/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neues Angebot
          </button>
        )}
      </div>
      
      {/* Suchfilter */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Angebote suchen</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Suche (Nummer, Kunde)
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Suche nach Nummer oder Kunde..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">Alle Status</option>
              <option value="DRAFT">In Arbeit</option>
              <option value="ACTIVE">Aktiv</option>
              <option value="EXPIRED">Abgelaufen</option>
              <option value="ORDERED">Bestellt</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jahr</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">Alle Jahre</option>
              {years.reverse().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ersteller</label>
            <select
              value={filters.created_by}
              onChange={(e) => setFilters({ ...filters, created_by: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">Alle Ersteller</option>
              {users && users.map(user => (
                <option key={user.id} value={user.id}>{user.first_name} {user.last_name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleSearch}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Suchen
            </button>
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Zurücksetzen
            </button>
          </div>
        </div>
        {hasSearched && (
          <div className="text-sm text-gray-600">
            {quotations.length} Angebot(e) gefunden (Seite {currentPage} von {totalPages})
          </div>
        )}
      </div>

      {/* Angebote Kacheln */}
      {!hasSearched ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Angebote angezeigt</h3>
          <p className="text-gray-500 mb-4">
            Verwenden Sie die Suchfilter oben, um Angebote anzuzeigen.
          </p>
        </div>
      ) : quotations.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Angebote gefunden</h3>
          <p className="text-gray-500">
            Es wurden keine Angebote mit den angegebenen Filtern gefunden.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quotations.map((quotation) => (
              <div key={quotation.id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 font-mono mb-1">
                        {quotation.quotation_number}
                      </h3>
                      <div className="flex items-center text-sm text-gray-600">
                        <UserIcon className="h-4 w-4 mr-1 text-gray-400" />
                        <span className="truncate">{quotation.customer_name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{quotation.customer_number}</p>
                    </div>
                    <div>
                      {getStatusBadge(quotation.status, quotation.status_display)}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>Datum: {new Date(quotation.date).toLocaleDateString('de-DE')}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>Gültig bis: {new Date(quotation.valid_until).toLocaleDateString('de-DE')}</span>
                    </div>
                    {quotation.reference && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Ref:</span> {quotation.reference}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-gray-500">
                        {quotation.items_count} Position(en)
                      </span>
                      <div className="flex items-center text-lg font-bold text-green-600">
                        <CurrencyEuroIcon className="h-5 w-5 mr-1" />
                        {quotation.total_amount?.toLocaleString('de-DE', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        }) || '0,00'}
                      </div>
                    </div>
                  </div>

                  {/* Aktionen */}
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewPDF(quotation.id)}
                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                        title="PDF anzeigen"
                      >
                        <DocumentIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(quotation.id, quotation.quotation_number)}
                        className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded"
                        title="PDF herunterladen"
                      >
                        <DocumentArrowDownIcon className="h-5 w-5" />
                      </button>
                      <Link
                        to={`/sales/quotations/${quotation.id}`}
                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                        title="Details anzeigen"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </Link>
                    </div>
                    {canWrite && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => navigate(`/sales/quotations/${quotation.id}/edit`)}
                          className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                          title="Bearbeiten"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(quotation.id)}
                          className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                          title="Löschen"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zurück
              </button>
              <span className="text-sm text-gray-700">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default Quotations;
