import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import storage from '../utils/sessionStore';
import { 
  PlusIcon, PencilIcon, TrashIcon,
  BuildingStorefrontIcon, UserGroupIcon,
  PhoneIcon, EnvelopeIcon, GlobeAltIcon,
  ComputerDesktopIcon, DocumentTextIcon
} from '@heroicons/react/24/outline';

const Dealers = () => {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    country: '',
    status: ''
  });

  const SESSION_KEY = 'dealers_search_state';
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.filters) setFilters(st.filters);
      const page = st.currentPage || 1;
      if (st.currentPage) setCurrentPage(st.currentPage);
      if (st.dealers) setDealers(st.dealers);
      if (st.totalPages) setTotalPages(st.totalPages);
      if (st.hasSearched) setHasSearched(true);
      return { page, filters: st.filters || null };
    } catch (e) {
      console.warn('Failed to load dealers search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { filters, currentPage, dealers, totalPages, hasSearched };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save dealers search state', e);
    }
  };

  useEffect(() => {
    const urlParams = Object.fromEntries([...searchParams]);
    if (Object.keys(urlParams).length > 0) {
      return;
    }

    const restored = loadSearchState();
    if (restored && restored.page) {
      const params = {};
      if (restored.filters) {
        if (restored.filters.search) params.search = restored.filters.search;
        if (restored.filters.city) params.city = restored.filters.city;
        if (restored.filters.country) params.country = restored.filters.country;
        if (restored.filters.status) params.status = restored.filters.status;
      }
      params.page = String(restored.page);
      setSearchParams(params);
    } else if (!restored && hasSearched) {
      fetchDealers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasSearched) {
      fetchDealers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  useEffect(() => {
    saveSearchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage, dealers, totalPages, hasSearched]);

  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newFilters = {
        search: params.search || '',
        city: params.city || '',
        country: params.country || '',
        status: params.status || ''
      };
      setFilters(newFilters);
      const page = params.page ? parseInt(params.page, 10) : 1;
      setCurrentPage(page);
      setHasSearched(true);
      fetchDealers(page, newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchDealers = async (pageArg = null, filtersArg = null) => {
    const page = pageArg || currentPage;
    const useFilters = filtersArg || filters;

    setLoading(true);
    try {
      let url = '/dealers/dealers/';
      const params = new URLSearchParams();
      
      if (useFilters.search) params.append('search', useFilters.search);
      if (useFilters.city) params.append('city', useFilters.city);
      if (useFilters.country) params.append('country', useFilters.country);
      if (useFilters.status) params.append('status', useFilters.status);
      
      params.append('page', page);
      params.append('page_size', '9');
      
      url += `?${params.toString()}`;
      
      const response = await api.get(url);
      const results = response.data.results || [];
      setDealers(results);
      setTotalPages(Math.ceil((response.data.count || 0) / 9));
      setHasSearched(true);

      try {
        saveSearchState();
      } catch (e) { console.warn('Could not persist dealers search state', e); }

      if (pageArg) setCurrentPage(page);
    } catch (error) {
      console.error('Fehler beim Laden der Händler:', error);
      setDealers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.city) params.city = filters.city;
    if (filters.country) params.country = filters.country;
    if (filters.status) params.status = filters.status;
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
      status: ''
    });
    setDealers([]);
    setCurrentPage(1);
    setHasSearched(false);
    try { storage.remove(SESSION_KEY); } catch (e) { /* ignore */ }
  };

  const openCreatePage = () => {
    navigate('/sales/dealers/new');
  };

  const openEditPage = (dealer) => {
    navigate(`/sales/dealers/${dealer.id}`);
  };

  const handleDelete = async (dealerId) => {
    if (!window.confirm('Möchten Sie diesen Händler wirklich löschen?')) return;
    
    try {
      await api.delete(`/dealers/dealers/${dealerId}/`);
      fetchDealers();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen des Händlers');
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
            <BuildingStorefrontIcon className="h-8 w-8 mr-3 text-blue-600" />
            Händlerverwaltung
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verwaltung von Händlerstammdaten, Ansprechpartnern und Preislisten
          </p>
        </div>
        <button
          onClick={openCreatePage}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Neuer Händler
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Händlersuche</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche (Name, Nummer)</label>
            <input
              type="text"
              placeholder="Firmenname oder Händlernummer..."
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
              <option value="NL">Niederlande</option>
              <option value="BE">Belgien</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Status</option>
              <option value="active">Aktiv</option>
              <option value="inactive">Inaktiv</option>
            </select>
          </div>
          <div className="flex items-end space-x-2 md:col-span-2">
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
            {dealers.length} Händler gefunden (Seite {currentPage} von {totalPages})
          </div>
        )}
      </div>

      {/* Dealer Cards */}
      {!hasSearched ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <BuildingStorefrontIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Händler angezeigt</h3>
          <p className="text-gray-500 mb-4">
            Verwenden Sie die Suchfilter oben, um Händler anzuzeigen.
          </p>
        </div>
      ) : dealers.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <BuildingStorefrontIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Händler gefunden</h3>
          <p className="text-gray-500">
            Es wurden keine Händler mit den angegebenen Filtern gefunden.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dealers.map((dealer) => (
              <div 
                key={dealer.id} 
                className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => openEditPage(dealer)}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {dealer.company_name}
                        </h3>
                        {dealer.status === 'inactive' && (
                          <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                            Inaktiv
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{dealer.dealer_number}</p>
                      <div className="flex items-center mt-1">
                        <GlobeAltIcon className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-600">
                          {dealer.city && `${dealer.city}, `}{dealer.country}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditPage(dealer)}
                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(dealer.id)}
                        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Discount & Payment Terms */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Händlerrabatt:</span>
                      <span className="font-medium text-green-600">{dealer.dealer_discount}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Zahlungskond.:</span>
                      <span className="text-gray-900">{dealer.payment_terms_display}</span>
                    </div>
                  </div>

                  {/* Primary Contact */}
                  {dealer.primary_contact && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500 mb-1">Hauptansprechpartner:</p>
                      <p className="text-sm font-medium text-gray-900">{dealer.primary_contact.name}</p>
                      {dealer.primary_contact.email && (
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <EnvelopeIcon className="h-3 w-3 mr-1 text-gray-400" />
                          <span className="truncate">{dealer.primary_contact.email}</span>
                        </div>
                      )}
                      {dealer.primary_contact.phone && (
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <PhoneIcon className="h-3 w-3 mr-1 text-gray-400" />
                          <span>{dealer.primary_contact.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span className="flex items-center" title="Mitarbeiter">
                        <UserGroupIcon className="h-4 w-4 mr-1" />
                        <span className="font-semibold text-blue-600">{dealer.employee_count || 0}</span>
                      </span>
                      <span className="flex items-center" title="Kundensysteme">
                        <ComputerDesktopIcon className="h-4 w-4 mr-1" />
                        <span className="font-semibold text-orange-600">{dealer.customer_system_count || 0}</span>
                      </span>
                      <span className="flex items-center" title="Sprache">
                        <DocumentTextIcon className="h-4 w-4 mr-1" />
                        <span className="font-semibold text-green-600">{dealer.language_display}</span>
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
                  setSearchParams({ 
                    ...(filters.search ? { search: filters.search } : {}), 
                    ...(filters.city ? { city: filters.city } : {}), 
                    ...(filters.country ? { country: filters.country } : {}), 
                    ...(filters.status ? { status: filters.status } : {}), 
                    page: String(np) 
                  });
                  fetchDealers(np, filters);
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
                  setSearchParams({ 
                    ...(filters.search ? { search: filters.search } : {}), 
                    ...(filters.city ? { city: filters.city } : {}), 
                    ...(filters.country ? { country: filters.country } : {}), 
                    ...(filters.status ? { status: filters.status } : {}), 
                    page: String(np) 
                  });
                  fetchDealers(np, filters);
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

export default Dealers;
