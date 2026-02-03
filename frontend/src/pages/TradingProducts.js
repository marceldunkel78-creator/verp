import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
/* eslint-disable react-hooks/exhaustive-deps */
import storage from '../utils/sessionStore';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, CubeIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';

const TradingProducts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [sortBy, setSortBy] = useState('visitron_part_number');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [calculatedPrices, setCalculatedPrices] = useState({
    purchasePrice: 0,
    visitronListPrice: 0
  });
  
  // Paginierung
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const canWrite = user?.is_staff || user?.is_superuser || user?.can_write_trading || user?.can_write_suppliers;
  const [viewMode, setViewMode] = useState('cards');

  const SESSION_KEY = 'trading_products_search_state';
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.filters) {
        setSortBy(st.filters.sortBy || 'visitron_part_number');
        setFilterSupplier(st.filters.filterSupplier || '');
        setFilterActive(st.filters.filterActive || 'all');
        setSearch(st.filters.search || '');
      }
      if (st.hasSearched) setHasSearched(true);
      return { filters: st.filters || null };
    } catch (e) {
      console.warn('Failed to load trading products search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { filters: { sortBy, filterSupplier, filterActive, search }, hasSearched };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save trading products search state', e);
    }
  };

  const handleSearch = () => {
    const params = {};
    if (sortBy) params.ordering = sortBy;
    if (filterSupplier) params.supplier = filterSupplier;
    if (filterActive && filterActive !== 'all') params.is_active = filterActive;
    if (search) params.search = search;
    setSearchParams(params);
    setHasSearched(true);
    setCurrentPage(1); // Zurück zur ersten Seite bei neuer Suche
    setRefreshKey(prev => prev + 1);
  };

  // On mount prefer URL params; otherwise restore from localStorage and populate URL
  useEffect(() => {
    const urlParams = Object.fromEntries([...searchParams]);
    if (Object.keys(urlParams).length > 0) {
      // let the searchParams effect handle fetching
      return;
    }

    const restored = loadSearchState();
    if (restored && restored.filters) {
      const params = {};
      if (restored.filters.sortBy) params.ordering = restored.filters.sortBy;
      if (restored.filters.filterSupplier) params.supplier = restored.filters.filterSupplier;
      if (restored.filters.filterActive) params.is_active = restored.filters.filterActive;
      if (restored.filters.search) params.search = restored.filters.search;
      setSearchParams(params);
    } else if (!restored && hasSearched) {
      setRefreshKey(prev => prev + 1);
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to URL query param changes (back/forward navigation)
  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newSort = params.ordering || 'visitron_part_number';
      const newSupplier = params.supplier || '';
      const newActive = params.is_active || 'all';
      const newSearch = params.search || '';
      const newPage = parseInt(params.page) || 1;
      setSortBy(newSort);
      setFilterSupplier(newSupplier);
      setFilterActive(newActive);
      setSearch(newSearch);
      setCurrentPage(newPage);
      setHasSearched(true);
      setRefreshKey(prev => prev + 1);
      // fetch to restore the list immediately when navigating back/forward
      fetchProducts(newPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    // persist state whenever relevant parts change
    saveSearchState();
  }, [sortBy, filterSupplier, filterActive, search, hasSearched]);

  const [formData, setFormData] = useState({
    name: '',
    visitron_part_number: '',
    supplier_part_number: '',
    supplier: '',
    product_group: '',
    price_list: '',
    category: '',
    description: '',
    unit: 'Stück',
    list_price: '',
    list_price_currency: 'EUR',
    exchange_rate: 1.0,
    price_valid_from: new Date().toISOString().split('T')[0],
    price_valid_until: '',
    discount_percent: 0,
    margin_percent: 0,
    shipping_cost: 0,
    shipping_cost_is_percent: false,
    import_cost: 0,
    import_cost_is_percent: false,
    handling_cost: 0,
    handling_cost_is_percent: false,
    storage_cost: 0,
    storage_cost_is_percent: false,
    costs_currency: 'EUR',
    minimum_stock: 0,
    is_active: true,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Load static helper data always
    fetchSuppliers();
    fetchExchangeRates();

    // Only fetch products after the user initiated a search/filter
    if (hasSearched) {
      setLoading(true);
      fetchProducts(currentPage);
    } else {
      setLoading(false);
    }
  }, [sortBy, filterSupplier, filterActive, refreshKey, hasSearched, currentPage]);

  // Berechne Preise live bei Formular-Änderungen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    calculatePrices();
  }, [
    formData.list_price, 
    formData.exchange_rate,
    formData.discount_percent, 
    formData.shipping_cost, 
    formData.shipping_cost_is_percent,
    formData.import_cost, 
    formData.import_cost_is_percent,
    formData.handling_cost, 
    formData.handling_cost_is_percent,
    formData.storage_cost, 
    formData.storage_cost_is_percent,
    formData.margin_percent
  ]);

  const calculatePrices = () => {
    const listPrice = parseFloat(formData.list_price) || 0;
    const exchangeRate = parseFloat(formData.exchange_rate) || 1.0;
    const discountPercent = parseFloat(formData.discount_percent) || 0;
    const marginPercent = parseFloat(formData.margin_percent) || 0;
    
    // Basispreis nach Rabatt
    const basePrice = listPrice * (1 - discountPercent / 100);
    
    // Zusätzliche Kosten berechnen
    const shipping = formData.shipping_cost_is_percent 
      ? basePrice * (parseFloat(formData.shipping_cost) || 0) / 100 
      : parseFloat(formData.shipping_cost) || 0;
    
    const importCost = formData.import_cost_is_percent 
      ? basePrice * (parseFloat(formData.import_cost) || 0) / 100 
      : parseFloat(formData.import_cost) || 0;
    
    const handling = formData.handling_cost_is_percent 
      ? basePrice * (parseFloat(formData.handling_cost) || 0) / 100 
      : parseFloat(formData.handling_cost) || 0;
    
    const storage = formData.storage_cost_is_percent 
      ? basePrice * (parseFloat(formData.storage_cost) || 0) / 100 
      : parseFloat(formData.storage_cost) || 0;
    
    // Einkaufspreis (mit Wechselkurs)
    const purchasePrice = (basePrice + shipping + importCost + handling + storage) * exchangeRate;
    
    // Visitron-Listenpreis mit Marge: VLP = EK / (1 - Marge/100)
    let visitronListPrice;
    if (marginPercent >= 100) {
      // Bei Marge >= 100% würde Division durch 0 auftreten
      visitronListPrice = Math.ceil(purchasePrice * 10); // 10x als Obergrenze
    } else {
      visitronListPrice = Math.ceil(purchasePrice / (1 - marginPercent / 100));
    }
    
    setCalculatedPrices({
      purchasePrice: purchasePrice,
      visitronListPrice: visitronListPrice
    });
  };

  const fetchProducts = async (page = 1) => {
    try {
      let url = '/suppliers/products/';
      const params = new URLSearchParams();
      
      if (sortBy) params.append('ordering', sortBy);
      if (filterSupplier) params.append('supplier', filterSupplier);
      if (search) params.append('search', search);
      if (filterActive !== 'all') params.append('is_active', filterActive === 'active');
      params.append('page', page);
      
      // Cache-Buster mit zufälligem Wert
      params.append('_t', `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      url += '?' + params.toString();
      
      const response = await api.get(url);
      const data = response.data.results || response.data;
      setProducts(Array.isArray(data) ? data : []);
      
      // Paginierungsinformationen setzen
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 9));
      }
      setCurrentPage(page);

      // Persist immediately so localStorage is updated even if React effects are delayed
      try { saveSearchState(); } catch (e) { console.warn('Could not persist trading products search state', e); }
    } catch (error) {
      console.error('Fehler beim Laden der Handelswaren:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers/suppliers/?page_size=500');
      const data = response.data.results || response.data;
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Lieferanten:', error);
    }
  };

  const fetchProductGroups = async (supplierId = null) => {
    try {
      const params = new URLSearchParams();
      if (supplierId) params.append('supplier', supplierId);
      params.append('page_size', '500');
      const response = await api.get(`/suppliers/product-groups/?${params.toString()}`);
      const data = response.data.results || response.data;
      setProductGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Warengruppen:', error);
      setProductGroups([]);
    }
  };

  // price lists are not used on this page; removed

  const fetchExchangeRates = async () => {
    try {
      const response = await api.get('/settings/exchange-rates/');
      const data = response.data.results || response.data;
      setExchangeRates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Wechselkurse:', error);
      setExchangeRates([]);
    }
  };

  // Load product groups when top-level supplier filter changes
  useEffect(() => {
    if (filterSupplier) {
      fetchProductGroups(filterSupplier);
    } else {
      setProductGroups([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSupplier]);

  // eslint-disable-next-line no-unused-vars
  const loadExchangeRate = () => {
    const currency = formData.list_price_currency;
    if (currency === 'EUR') {
      setFormData({ ...formData, exchange_rate: 1.0 });
      return;
    }
    if (!Array.isArray(exchangeRates)) {
      console.warn('exchangeRates is not an array:', exchangeRates);
      return;
    }
    const rate = exchangeRates.find(r => r.currency === currency);
    if (rate) {
      setFormData({ ...formData, exchange_rate: rate.rate_to_eur });
    } else {
      alert(`Kein Wechselkurs für ${currency} gefunden. Bitte in Einstellungen hinterlegen.`);
    }
  };

  

  // Inline modal-based edit removed; full-page editor is used instead.

  // Modal submit handler removed; creation/editing handled by full-page editor.

  const isPriceValid = (product) => {
    const today = new Date().toISOString().split('T')[0];
    const validFrom = product.price_valid_from;
    const validUntil = product.price_valid_until;
    
    if (!validUntil) return validFrom <= today;
    return validFrom <= today && validUntil >= today;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <nav className="text-sm text-gray-500 mb-2">
            <Link to="/procurement" className="hover:text-gray-700">Procurement</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Trading Goods</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Trading Goods</h1>
          <p className="text-sm text-gray-600">Handelswaren und Preislisten</p>
          {!canWrite && (
            <p className="text-sm text-gray-500 mt-1">
              Sie haben nur Leserechte für dieses Modul
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {/* View Toggle */}
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 text-sm font-medium rounded-l-md border ${
                viewMode === 'cards'
                  ? 'bg-orange-600 text-white border-orange-600'
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
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Listenansicht"
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
          </div>
          {canWrite && (
            <button
              onClick={() => navigate('/procurement/trading-goods/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Neue Handelsware
            </button>
          )}
        </div>
      </div>

      {/* Filter und Sortierung */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <input
              type="text"
              placeholder="Artikelnummer, Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sortieren nach
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
            >
              <option value="visitron_part_number">Visitron-Partnummer</option>
              <option value="name">Name</option>
              <option value="supplier__company_name">Lieferant</option>
              <option value="category">Kategorie</option>
              <option value="price_valid_from">Preis gültig ab</option>
              <option value="-price_valid_from">Preis gültig ab (absteigend)</option>
              <option value="price_valid_until">Preis gültig bis</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieferant
            </label>
            <select
              value={filterSupplier}
              onChange={(e) => {
                const v = e.target.value;
                setFilterSupplier(v);
                if (v) {
                  fetchProductGroups(v);
                } else {
                  setProductGroups([]);
                }
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
            >
              <option value="">Alle Lieferanten</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.company_name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
            >
              <option value="all">Alle</option>
              <option value="active">Nur Aktive</option>
              <option value="inactive">Nur Inaktive</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => handleSearch()}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
          >
            Suchen
          </button>
        </div>
      </div>

      {/* Produktliste */}
      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden cursor-pointer"
              onClick={() => navigate(`/procurement/trading-goods/${product.id}`)}
            >
              <div className="p-4">
                {/* Header mit VS-Nr und Status */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      VS-Nr.
                    </div>
                    <div className="font-bold text-lg text-gray-900">
                      {product.visitron_part_number}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      product.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>

                {/* Produktname */}
                <h3 className="text-base font-semibold text-gray-900 mb-3 line-clamp-2" title={product.name}>
                  {product.name}
                </h3>

                {/* Lieferant und Kategorie */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm">
                    <span className="text-gray-500 w-24 flex-shrink-0">Lieferant:</span>
                    <span className="text-gray-900 font-medium truncate" title={product.supplier_name}>
                      {product.supplier_name || '-'}
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="text-gray-500 w-24 flex-shrink-0">Kategorie:</span>
                    <span className="text-gray-900 truncate" title={product.category_display}>
                      {product.category_display || '-'}
                    </span>
                  </div>
                </div>

                {/* Preisinformationen */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600 uppercase tracking-wide">
                      Einkaufspreis
                    </span>
                    {!isPriceValid(product) && (
                      <span className="text-xs text-red-600 font-semibold">
                        Ungültig
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {Number(product.purchase_price_eur).toFixed(2)} €
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Gültig bis:{' '}
                    {product.price_valid_until 
                      ? new Date(product.price_valid_until).toLocaleDateString('de-DE')
                      : 'unbegrenzt'}
                  </div>
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
                  VS-Nr.
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produktname
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lieferant
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategorie
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Einkaufspreis
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gültig bis
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/procurement/trading-goods/${product.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <CubeIcon className="h-5 w-5 text-orange-600 mr-3" />
                      <div className="text-sm font-medium text-gray-900">
                        {product.visitron_part_number}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 truncate max-w-xs" title={product.name}>
                      {product.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {product.supplier_name || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {product.category_display || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-900">
                      {Number(product.purchase_price_eur).toFixed(2)} €
                    </div>
                    {!isPriceValid(product) && (
                      <span className="text-xs text-red-600">Ungültig</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {product.price_valid_until 
                        ? new Date(product.price_valid_until).toLocaleDateString('de-DE')
                        : 'unbegrenzt'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        product.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginierung */}
      {hasSearched && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 mt-4 rounded-lg shadow">
          <div className="flex justify-between flex-1 sm:hidden">
            <button
              onClick={() => {
                const newPage = Math.max(1, currentPage - 1);
                setCurrentPage(newPage);
                setSearchParams({ ...Object.fromEntries(searchParams), page: newPage });
              }}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Zurück
            </button>
            <button
              onClick={() => {
                const newPage = Math.min(totalPages, currentPage + 1);
                setCurrentPage(newPage);
                setSearchParams({ ...Object.fromEntries(searchParams), page: newPage });
              }}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Weiter
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Zeige <span className="font-medium">{(currentPage - 1) * 9 + 1}</span> bis{' '}
                <span className="font-medium">{Math.min(currentPage * 9, totalCount)}</span> von{' '}
                <span className="font-medium">{totalCount}</span> Ergebnissen
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => {
                    const newPage = Math.max(1, currentPage - 1);
                    setCurrentPage(newPage);
                    setSearchParams({ ...Object.fromEntries(searchParams), page: newPage });
                  }}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Zurück</span>
                  &larr;
                </button>
                
                {/* Seitenzahlen */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => {
                        setCurrentPage(pageNum);
                        setSearchParams({ ...Object.fromEntries(searchParams), page: pageNum });
                      }}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNum === currentPage
                          ? 'z-10 bg-orange-50 border-orange-500 text-orange-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => {
                    const newPage = Math.min(totalPages, currentPage + 1);
                    setCurrentPage(newPage);
                    setSearchParams({ ...Object.fromEntries(searchParams), page: newPage });
                  }}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Weiter</span>
                  &rarr;
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {!hasSearched && (
        <div className="bg-white shadow rounded-lg p-12 text-center mt-4">
          <CubeIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Handelswaren durchsuchen</h3>
          <p className="text-gray-500">Bitte verwenden Sie die Filter oben oder führen Sie eine Suche aus, um Handelswaren anzuzeigen.</p>
        </div>
      )}

      {hasSearched && products.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow mt-4">
          <p className="text-gray-500">Keine Handelswaren gefunden</p>
        </div>
      )}

      {/* Modal removed — full-page editor used instead */}
    </div>
  );
};

export default TradingProducts;
