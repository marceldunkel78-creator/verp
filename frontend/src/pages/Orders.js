import React, { useState, useEffect, useRef } from 'react';
/* eslint-disable react-hooks/exhaustive-deps */
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { 
  PlusIcon, ShoppingCartIcon, ArrowUturnLeftIcon,
  DocumentTextIcon, BuildingOfficeIcon, CalendarIcon,
  ChevronLeftIcon, ChevronRightIcon, CurrencyEuroIcon,
  Squares2X2Icon, ListBulletIcon
} from '@heroicons/react/24/outline';

const Orders = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewMode, setViewMode] = useState('cards');
  const searchInputRef = useRef(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    year: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sessionExists, setSessionExists] = useState(false);

  const SESSION_KEY = 'orders_search_state';
  importSessionHelpers();

  function importSessionHelpers() {
    // dynamic import helper to avoid issues with SSR/test environments
    try {
      // eslint-disable-next-line global-require, import/no-extraneous-dependencies
      const mod = require('../utils/sessionStore');
      window.__sessionStore = mod.default || mod;
    } catch (e) {
      console.warn('Could not load sessionStore helper', e);
    }
  }

  // Try to restore session state on mount
  useEffect(() => {
    const restored = loadSearchState();
    if (!restored && hasSearched) {
      fetchOrders(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hasSearched) {
      fetchOrders();
    }
  }, [currentPage]);

  // Persist state whenever relevant parts change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    saveSearchState();
  }, [filters, currentPage, orders, totalPages, hasSearched]);

  const loadSearchState = () => {
    try {
      // URL params take precedence for navigation/back/forward behavior
      const urlParams = Object.fromEntries([...searchParams]);
      if (Object.keys(urlParams).length > 0) {
        const newFilters = {
          search: urlParams.search || '',
          status: urlParams.status || '',
          year: urlParams.year || ''
        };
        setFilters(newFilters);
        const p = urlParams.page ? parseInt(urlParams.page, 10) : 1;
        setCurrentPage(p);
        setHasSearched(true);
        // Fetch immediately so results match URL — pass the freshly built filters
        fetchOrders(p, newFilters);
        setSessionExists(true);
        return true;
      }

      // use helper if available
      const st = (window.__sessionStore && window.__sessionStore.get) ? window.__sessionStore.get(SESSION_KEY) : (function(){ try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } })();
      if (!st) return false;
      if (st.filters) setFilters(st.filters);
      if (st.currentPage) setCurrentPage(st.currentPage);
      if (st.orders) setOrders(st.orders);
      if (st.totalPages) setTotalPages(st.totalPages);
      if (st.hasSearched) setHasSearched(true);
      setSessionExists(true);
      return true;
    } catch (e) {
      console.warn('Failed to load orders search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { filters, currentPage, orders, totalPages, hasSearched };
      if (window.__sessionStore && window.__sessionStore.set) {
        window.__sessionStore.set(SESSION_KEY, st);
      } else {
        localStorage.setItem(SESSION_KEY, JSON.stringify(st));
      }
      setSessionExists(true);
    } catch (e) {
      console.warn('Failed to save orders search state', e);
    }
  };

  useEffect(() => {
    // persist state whenever relevant parts change
    saveSearchState();
  }, [filters, currentPage, orders, totalPages, hasSearched]);

  // React to URL query param changes (back/forward navigation)
  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newFilters = {
        search: params.search || '',
        status: params.status || '',
        year: params.year || ''
      };
      setFilters(newFilters);
      const page = params.page ? parseInt(params.page, 10) : 1;
      setCurrentPage(page);
      setHasSearched(true);
      // fetch to restore the list immediately when navigating back/forward — pass the freshly built filters
      fetchOrders(page, newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchOrders = async (pageArg = null, filtersArg = null) => {
    const page = pageArg || currentPage;
    const useFilters = filtersArg || filters;
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        page: page,
        page_size: 9
      });

      if (useFilters.search) params.append('search', useFilters.search);
      if (useFilters.status) params.append('status', useFilters.status);
      if (useFilters.year) params.append('year', useFilters.year);

      const response = await api.get(`/orders/orders/?${params.toString()}`);
      const data = response.data.results || response.data;
      setOrders(Array.isArray(data) ? data : []);

      if (response.data.count) {
        setTotalPages(Math.ceil(response.data.count / 9));
      }
      if (pageArg) setCurrentPage(page);
    } catch (error) {
      console.error('Fehler beim Laden der Bestellungen:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.year) params.year = filters.year;
    params.page = '1';
    setSearchParams(params);
    setCurrentPage(1);
    fetchOrders(1, { search: filters.search || '', status: filters.status || '', year: filters.year || '' });
  };

  const handleRevertCancellation = async (order) => {
    if (window.confirm(`Möchten Sie die Stornierung von ${order.order_number} rückgängig machen?`)) {
      try {
        const response = await api.get(`/orders/orders/${order.id}/`);
        const orderData = response.data;
        
        await api.patch(`/orders/orders/${order.id}/`, {
          status: 'angelegt',
          notes: (orderData.notes || '') + `\n\n[Stornierung rückgängig gemacht am ${new Date().toLocaleString('de-DE')}]`
        });
        
        fetchOrders();
      } catch (error) {
        console.error('Fehler:', error);
        alert('Fehler beim Rückgängigmachen');
      }
    }
  };



  const getStatusColor = (status) => {
    switch (status) {
      case 'storniert':
        return 'bg-red-500 text-white';
      case 'bezahlt':
        return 'bg-green-500 text-white';
      case 'angelegt':
        return 'bg-orange-100 text-orange-800';
      case 'bestellt':
        return 'bg-orange-100 text-orange-800';
      case 'bestaetigt':
        return 'bg-orange-100 text-orange-800';
      case 'geliefert':
        return 'bg-orange-100 text-orange-800';
      case 'zahlung_on_hold':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Generiere Jahre für Dropdown
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <ShoppingCartIcon className="h-8 w-8 mr-3 text-blue-600" />
            Bestellungen
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verwaltung aller Bestellungen und Bestellpositionen
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Kachelansicht"
            >
              <Squares2X2Icon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Listenansicht"
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={() => navigate('/procurement/orders/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neue Bestellung
          </button>
        </div>
      </div>

      {/* Filter/Search */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Bestellnummer, Lieferant..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Status</option>
              <option value="angelegt">Angelegt</option>
              <option value="bestellt">Bestellt</option>
              <option value="bestaetigt">Bestätigt</option>
              <option value="geliefert">Geliefert</option>
              <option value="bezahlt">Bezahlt</option>
              <option value="zahlung_on_hold">Zahlung on hold</option>
              <option value="storniert">Storniert</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jahr</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Jahre</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
            <div className="mt-4 flex items-center space-x-2">
          <button
            onClick={handleSearch}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Suchen
          </button>
          <button
            onClick={() => { setFilters({ search: '', status: '', year: '' }); setOrders([]); setHasSearched(false); setCurrentPage(1); (window.__sessionStore && window.__sessionStore.remove) ? window.__sessionStore.remove('orders_search_state') : localStorage.removeItem('orders_search_state'); setSessionExists(false); setSearchParams({}); }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Filter zurücksetzen
          </button>
          {sessionExists && (
            <div className="mt-2 text-sm text-gray-500">Session: Suchergebnisse werden im Tab gespeichert</div>
          )}
        </div>
      </div>

      {/* Empty State - Before Search */}
      {!hasSearched && orders.length === 0 && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <ShoppingCartIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Bestellungen durchsuchen</h3>
          <p className="text-gray-500">
            Verwenden Sie die Filter oben, um Bestellungen zu suchen.
          </p>
        </div>
      )}

      {/* Empty State - No Results */}
      {hasSearched && orders.length === 0 && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <ShoppingCartIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Bestellungen gefunden</h3>
          <p className="text-gray-500">
            Versuchen Sie, Ihre Suchkriterien anzupassen.
          </p>
        </div>
      )}

      {/* Orders Grid */}
      {orders.length > 0 && (
        <>
          {/* Card View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                  onClick={() => { saveSearchState(); navigate(`/procurement/orders/${order.id}`); }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-5 w-5 text-blue-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900 font-mono">
                        {order.order_number}
                      </h3>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status_display}
                    </span>
                  </div>

                  {/* Supplier */}
                  <div className="mb-3">
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <BuildingOfficeIcon className="h-4 w-4 mr-2" />
                      <span className="font-medium">{order.supplier_name}</span>
                    </div>
                    <div className="text-xs text-gray-500 ml-6">
                      Nr. {order.supplier_number}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="mb-4 space-y-1">
                    <div className="flex items-center text-sm text-gray-600">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      <span>
                        {order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE') : 'Kein Datum'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 ml-6">
                      Erstellt: {new Date(order.created_at).toLocaleDateString('de-DE')}
                    </div>
                  </div>

                  {/* Items Count & Total */}
                  <div className="border-t pt-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Positionen:</span>
                      <span className="font-medium text-gray-900">{order.items_count}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-600">Summe:</span>
                      <span className="font-bold text-gray-900 flex items-center">
                        {(order.confirmed_total ?? order.total_amount) ? (order.confirmed_total ?? order.total_amount).toFixed(2) : '0.00'}
                        <CurrencyEuroIcon className="h-4 w-4 ml-1" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bestell-Nr.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lieferant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Positionen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Summe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => { saveSearchState(); navigate(`/procurement/orders/${order.id}`); }}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono font-medium text-blue-600">{order.order_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{order.supplier_name}</div>
                        <div className="text-xs text-gray-500">Nr. {order.supplier_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.items_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {(order.confirmed_total ?? order.total_amount)?.toFixed(2) || '0.00'} €
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status_display}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white shadow rounded-lg p-4 flex items-center justify-between">
              <button
                onClick={() => {
                  const np = Math.max(1, currentPage - 1);
                  setCurrentPage(np);
                  setSearchParams({ ...(filters.search ? { search: filters.search } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.year ? { year: filters.year } : {}), page: String(np) });
                  fetchOrders(np);
                }}
                disabled={currentPage === 1}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-5 w-5 mr-1" />
                Zurück
              </button>
              <span className="text-sm text-gray-700">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                onClick={() => {
                  const np = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(np);
                  setSearchParams({ ...(filters.search ? { search: filters.search } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.year ? { year: filters.year } : {}), page: String(np) });
                  fetchOrders(np);
                }}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Weiter
                <ChevronRightIcon className="h-5 w-5 ml-1" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Orders;
