import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
/* eslint-disable react-hooks/exhaustive-deps */
import api from '../services/api';
import storage from '../utils/sessionStore';
import { 
  PlusIcon, PencilIcon, TrashIcon, UserIcon,
  PhoneIcon, EnvelopeIcon, GlobeAltIcon,
  BuildingOfficeIcon, WrenchScrewdriverIcon, BeakerIcon
} from '@heroicons/react/24/outline';
const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    country: '',
    language: '',
    is_active: ''
  });

  const SESSION_KEY = 'customers_search_state';
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.filters) setFilters(st.filters);
      const page = st.currentPage || 1;
      if (st.currentPage) setCurrentPage(st.currentPage);
      if (st.customers) setCustomers(st.customers);
      if (st.totalPages) setTotalPages(st.totalPages);
      if (st.hasSearched) setHasSearched(true);

      // Do NOT call fetch here (fetchCustomers may not be declared yet); return object
      return { page, filters: st.filters || null };
    } catch (e) {
      console.warn('Failed to load customers search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { filters, currentPage, customers, totalPages, hasSearched };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save customers search state', e);
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
      // populate URL so back/forward works and trigger fetch via effect
      const params = {};
      if (restored.filters) {
        if (restored.filters.search) params.search = restored.filters.search;
        if (restored.filters.city) params.city = restored.filters.city;
        if (restored.filters.country) params.country = restored.filters.country;
        if (restored.filters.language) params.language = restored.filters.language;
        if (restored.filters.is_active) params.is_active = restored.filters.is_active;
      }
      params.page = String(restored.page);
      setSearchParams(params);
    } else if (!restored && hasSearched) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hasSearched) {
      fetchCustomers();
    }
  }, [currentPage]);

  // Persist state whenever relevant parts change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    saveSearchState();
  }, [filters, currentPage, customers, totalPages, hasSearched]);

  // React to URL query param changes (back/forward navigation)
  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newFilters = {
        search: params.search || '',
        city: params.city || '',
        country: params.country || '',
        language: params.language || '',
        is_active: params.is_active || ''
      };
      setFilters(newFilters);
      const page = params.page ? parseInt(params.page, 10) : 1;
      setCurrentPage(page);
      setHasSearched(true);
      // fetch to restore the list immediately when navigating back/forward
      fetchCustomers(page, newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Make fetchCustomers accept filters/page so restoration can call it with saved values
  const fetchCustomers = async (pageArg = null, filtersArg = null) => {
    const page = pageArg || currentPage;
    const useFilters = filtersArg || filters;

    setLoading(true);
    try {
      let url = '/customers/customers/';
      const params = new URLSearchParams();
      
      if (useFilters.search) params.append('search', useFilters.search);
      if (useFilters.city) params.append('city', useFilters.city);
      if (useFilters.country) params.append('country', useFilters.country);
      if (useFilters.language) params.append('language', useFilters.language);
      if (useFilters.is_active) params.append('is_active', useFilters.is_active);
      
      // Pagination
      params.append('page', page);
      params.append('page_size', '9');
      
      url += `?${params.toString()}`;
      
      const response = await api.get(url);
      const results = response.data.results || [];
      setCustomers(results);
      setTotalPages(Math.ceil((response.data.count || 0) / 9));
      setHasSearched(true);

      // Persist immediately so localStorage is updated even if React effects are delayed
      try {
        saveSearchState();
      } catch (e) { console.warn('Could not persist customers search state', e); }

      if (pageArg) setCurrentPage(page);
    } catch (error) {
      console.error('Fehler beim Laden der Kunden:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    // update URL params and let the searchParams effect perform the fetch
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.city) params.city = filters.city;
    if (filters.country) params.country = filters.country;
    if (filters.language) params.language = filters.language;
    if (filters.is_active) params.is_active = filters.is_active;
    params.page = '1';
    setSearchParams(params);
    setCurrentPage(1);
    setHasSearched(true);
  };

  const handleReset = () => {
    setFilters({
      search: '',
      city: '',
      country: '',
      language: '',
      is_active: ''
    });
    setCustomers([]);
    setCurrentPage(1);
    setHasSearched(false);
    try { storage.remove(SESSION_KEY); } catch (e) { /* ignore */ }
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm('Möchten Sie diesen Kunden wirklich löschen?')) return;
    
    try {
      await api.delete(`/customers/customers/${customerId}/`);
      fetchCustomers();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen des Kunden');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <UserIcon className="h-8 w-8 mr-3 text-blue-600" />
            Kundenverwaltung
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verwaltung von Kundenstammdaten mit Adressen und Kontaktdaten
          </p>
        </div>
        <button
          onClick={() => navigate('/sales/customers/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Neuer Kunde
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Kundensuche</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche (Name, Nummer)</label>
            <input
              type="text"
              placeholder="Name oder Kundennummer..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
            <input
              type="text"
              placeholder="Stadt..."
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
            <select
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Länder</option>
              <option value="DE">Deutschland</option>
              <option value="AT">Österreich</option>
              <option value="CH">Schweiz</option>
              <option value="FR">Frankreich</option>
              <option value="IT">Italien</option>
              <option value="ES">Spanien</option>
              <option value="GB">Großbritannien</option>
              <option value="US">USA</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sprache</label>
            <select
              value={filters.language}
              onChange={(e) => setFilters({ ...filters, language: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Sprachen</option>
              <option value="DE">Deutsch</option>
              <option value="EN">English</option>
              <option value="FR">Français</option>
              <option value="ES">Español</option>
              <option value="IT">Italiano</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.is_active}
              onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Status</option>
              <option value="true">Aktiv</option>
              <option value="false">Inaktiv</option>
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleSearch}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Suchen
            </button>
            <button
              onClick={() => { handleReset(); storage.remove(SESSION_KEY); }}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Zurücksetzen
            </button>
          </div>
        </div>
        {hasSearched && (
          <div className="text-sm text-gray-600">
            {customers.length} Kunde(n) gefunden (Seite {currentPage} von {totalPages})
          </div>
        )}
      </div>

      {/* Customer Cards */}
      {!hasSearched ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Kunden angezeigt</h3>
          <p className="text-gray-500 mb-4">
            Verwenden Sie die Suchfilter oben, um Kunden anzuzeigen.
          </p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Kunden gefunden</h3>
          <p className="text-gray-500">
            Es wurden keine Kunden mit den angegebenen Filtern gefunden.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.map((customer) => (
          <div key={customer.id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {customer.full_name}
                    </h3>
                    {!customer.is_active && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{customer.customer_number}</p>
                  <div className="flex items-center mt-1">
                    <GlobeAltIcon className="h-4 w-4 text-gray-400 mr-1" />
                    <span className="text-sm text-gray-600">{customer.language_display}</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigate(`/sales/customers/${customer.id}`)}
                    className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 border-t pt-4">
                {customer.primary_email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="truncate">{customer.primary_email}</span>
                  </div>
                )}
                {customer.primary_phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <PhoneIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{customer.primary_phone}</span>
                  </div>
                )}
              </div>

              {/* Future Modules Placeholder */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="flex items-center" title="Systeme">
                    <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                    <span className="font-semibold text-blue-600">{customer.system_count || 0}</span>
                  </span>
                  <span className="flex items-center" title="Offene Service-Tickets">
                    <WrenchScrewdriverIcon className="h-4 w-4 mr-1" />
                    <span className="font-semibold text-orange-600">{customer.open_ticket_count || 0}</span>
                  </span>
                  <span className="flex items-center" title="Projekte">
                    <BeakerIcon className="h-4 w-4 mr-1" />
                    <span className="font-semibold text-green-600">{customer.project_count || 0}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <button
                onClick={() => {
                  const np = Math.max(1, currentPage - 1);
                  setCurrentPage(np);
                  setSearchParams({ ...(filters.search ? { search: filters.search } : {}), ...(filters.city ? { city: filters.city } : {}), ...(filters.country ? { country: filters.country } : {}), ...(filters.language ? { language: filters.language } : {}), ...(filters.is_active ? { is_active: filters.is_active } : {}), page: String(np) });
                  fetchCustomers(np, filters);
                }}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zurück
              </button>
              <span className="text-sm text-gray-700">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                onClick={() => {
                  const np = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(np);
                  setSearchParams({ ...(filters.search ? { search: filters.search } : {}), ...(filters.city ? { city: filters.city } : {}), ...(filters.country ? { country: filters.country } : {}), ...(filters.language ? { language: filters.language } : {}), ...(filters.is_active ? { is_active: filters.is_active } : {}), page: String(np) });
                  fetchCustomers(np, filters);
                }}
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

export default Customers;
