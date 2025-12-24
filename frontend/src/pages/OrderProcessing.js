import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import storage from '../utils/sessionStore';
import {
  PlusIcon, EyeIcon, PencilIcon, TrashIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const OrderProcessing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    year: ''
  });

  const SESSION_KEY = 'orderprocessing_search_state';
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.filters) setFilters(st.filters);
      if (st.currentPage) setCurrentPage(st.currentPage);
      if (st.orders) setOrders(st.orders);
      if (st.totalPages) setTotalPages(st.totalPages);
      if (st.hasSearched) setHasSearched(true);
      return { page: st.currentPage || 1, filters: st.filters || null };
    } catch (e) {
      console.warn('Failed to load orderprocessing search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { filters, currentPage, orders, totalPages, hasSearched };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save orderprocessing search state', e);
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
        if (restored.filters.status) params.status = restored.filters.status;
        if (restored.filters.year) params.year = restored.filters.year;
      }
      params.page = String(restored.page);
      setSearchParams(params);
    } else if (!restored && hasSearched) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hasSearched) fetchOrders();
  }, [currentPage]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    saveSearchState();
  }, [filters, currentPage, orders, totalPages, hasSearched]);

  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    if (Object.keys(params).length > 0) {
      const newFilters = {
        search: params.search || '',
        status: params.status || '',
        year: params.year || ''
      };
      setFilters(newFilters);
      const page = params.page ? parseInt(params.page, 10) : 1;
      setCurrentPage(page);
      setHasSearched(true);
      fetchOrders(page, newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const canWrite = user?.is_staff || user?.is_superuser || user?.can_write_sales;

  useEffect(() => {
    if (hasSearched) fetchOrders();
  }, [currentPage]);

  const fetchOrders = async (pageArg = null, filtersArg = null) => {
    const page = pageArg || currentPage;
    const useFilters = filtersArg || filters;

    setLoading(true);
    try {
      let url = '/orders/orders/';
      const params = new URLSearchParams();

      if (useFilters.search) params.append('search', useFilters.search);
      if (useFilters.status) params.append('status', useFilters.status);
      if (useFilters.year) params.append('year', useFilters.year);
      // Only fetch customer orders (Kundenaufträge), not supplier/online orders
      params.append('order_type', 'customer_order');

      params.append('page', page);
      params.append('page_size', '9');

      url += `?${params.toString()}`;

      const response = await api.get(url);
      const data = response.data;

      let ordersData = [];
      if (Array.isArray(data)) {
        ordersData = data;
      } else if (data && Array.isArray(data.results)) {
        ordersData = data.results;
      }

      setOrders(ordersData);
      setTotalPages(Math.ceil((data.count || ordersData.length) / 9));
      setHasSearched(true);

      try { saveSearchState(); } catch (e) { console.warn('Could not persist orderprocessing search state', e); }
      if (pageArg) setCurrentPage(page);
    } catch (error) {
      console.error('Fehler beim Laden der Aufträge:', error);
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
    setHasSearched(true);
  };

  const handleReset = () => {
    setFilters({ search: '', status: '', year: '' });
    setOrders([]);
    setCurrentPage(1);
    setHasSearched(false);
    try { storage.remove(SESSION_KEY); } catch (e) { /* ignore */ }
    setSearchParams({});
  };

  const handleDelete = async (id) => {
    if (window.confirm('Möchten Sie diesen Auftrag wirklich löschen?')) {
      try {
        await api.delete(`/orders/orders/${id}/`);
        fetchOrders();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen des Auftrags');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <nav className="text-sm text-gray-500 mb-2">
            <Link to="/sales" className="hover:text-gray-700">Sales & Order Management</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Auftragsabwicklung</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <DocumentTextIcon className="h-8 w-8 mr-3 text-blue-600" />
            Auftragsverwaltung
          </h1>
          <p className="mt-2 text-sm text-gray-600">Kundenaufträge anzeigen und verwalten</p>
        </div>
        {canWrite && (
          <button
            onClick={() => navigate('/sales/order-processing/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neuer Auftrag
          </button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Aufträge suchen</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche (Nummer, Kunde)</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Suche nach Nummer oder Kunde..."
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
              {years.reverse().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleSearch}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Suchen
            </button>
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
            >
              Zurücksetzen
            </button>
          </div>
        </div>
        {hasSearched && (
          <div className="text-sm text-gray-600">{orders.length} Auftrag/Aufträge gefunden (Seite {currentPage} von {totalPages})</div>
        )}
      </div>

      {!hasSearched ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Aufträge angezeigt</h3>
          <p className="text-gray-500 mb-4">Verwenden Sie die Suchfilter oben, um Aufträge anzuzeigen.</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Aufträge gefunden</h3>
          <p className="text-gray-500">Versuchen Sie, Ihre Suchkriterien anzupassen.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer" onClick={() => navigate(`/sales/order-processing/${order.id}`)}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 font-mono">{order.order_number}</h3>
                    <div className="text-sm text-gray-600 mt-1">{order.supplier_name || order.customer_name || ''}</div>
                  </div>
                  <div className="text-sm text-gray-500">{order.status_display}</div>
                </div>

                <div className="border-t pt-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Positionen:</span>
                    <span className="font-medium text-gray-900">{order.items_count}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-600">Summe:</span>
                    <span className="font-bold text-gray-900">{order.total_amount ? order.total_amount.toFixed(2) : '0.00'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 border-t pt-3">
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/order-processing/${order.id}`); }} className="text-blue-600 hover:text-blue-900 p-1" title="Details"><EyeIcon className="h-5 w-5" /></button>
                  {canWrite && <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/order-processing/${order.id}/edit`); }} className="text-green-600 hover:text-green-900 p-1" title="Bearbeiten"><PencilIcon className="h-5 w-5" /></button>}
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }} className="text-red-600 hover:text-red-900 p-1" title="Löschen"><TrashIcon className="h-5 w-5" /></button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="bg-white shadow rounded-lg p-4 flex items-center justify-between">
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Zurück</button>
              <span className="text-sm text-gray-700">Seite {currentPage} von {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Weiter</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OrderProcessing;
