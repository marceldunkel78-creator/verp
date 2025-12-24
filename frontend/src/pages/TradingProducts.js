import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import storage from '../utils/sessionStore';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, PencilIcon, TrashIcon, CubeIcon } from '@heroicons/react/24/outline';

const TradingProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [sortBy, setSortBy] = useState('visitron_part_number');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [calculatedPrices, setCalculatedPrices] = useState({
    purchasePrice: 0,
    visitronListPrice: 0
  });
  
  const canWrite = user?.is_staff || user?.is_superuser || user?.can_write_trading || user?.can_write_suppliers;

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
      setSortBy(newSort);
      setFilterSupplier(newSupplier);
      setFilterActive(newActive);
      setSearch(newSearch);
      setHasSearched(true);
      setRefreshKey(prev => prev + 1);
      // fetch to restore the list immediately when navigating back/forward
      fetchProducts();
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
      fetchProducts();
    } else {
      setLoading(false);
    }
  }, [sortBy, filterSupplier, filterActive, refreshKey, hasSearched]);

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

  const fetchProducts = async () => {
    try {
      let url = '/suppliers/products/';
      const params = new URLSearchParams();
      
      if (sortBy) params.append('ordering', sortBy);
      if (filterSupplier) params.append('supplier', filterSupplier);
      if (search) params.append('search', search);
      if (filterActive !== 'all') params.append('is_active', filterActive === 'active');
      
      // Cache-Buster mit zufälligem Wert
      params.append('_t', `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      url += '?' + params.toString();
      
      const response = await api.get(url);
      const data = response.data.results || response.data;
      setProducts(Array.isArray(data) ? data : []);

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
      const response = await api.get('/suppliers/suppliers/');
      const data = response.data.results || response.data;
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Lieferanten:', error);
    }
  };

  const fetchProductGroups = async (supplierId = null) => {
    try {
      let url = '/suppliers/product-groups/';
      if (supplierId) {
        url += `?supplier=${supplierId}`;
      }
      const response = await api.get(url);
      const data = response.data.results || response.data;
      setProductGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Warengruppen:', error);
      setProductGroups([]);
    }
  };

  const fetchPriceLists = async (supplierId = null) => {
    try {
      let url = '/suppliers/price-lists/';
      if (supplierId) {
        url += `?supplier=${supplierId}&is_active=true`;
      }
      const response = await api.get(url);
      const data = response.data.results || response.data;
      setPriceLists(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Preislisten:', error);
      setPriceLists([]);
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare data - convert empty strings to null for foreign keys and dates
      const submitData = {
        ...formData,
        supplier: formData.supplier || null,
        product_group: formData.product_group || null,
        price_list: formData.price_list || null,
        category: formData.category || null,
        price_valid_until: formData.price_valid_until || null,
      };
      
      if (editingProduct) {
        await api.put(`/suppliers/products/${editingProduct.id}/`, submitData);
;
      } else {
        await api.post('/suppliers/products/', submitData);
      }
      setShowModal(false);
      resetForm();
      // Warte kurz, damit das Backend die Berechnung durchführen kann
      await new Promise(resolve => setTimeout(resolve, 150));
      // Erzwinge einen kompletten Neuaufbau der Liste
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      const errorMsg = error.response?.data 
        ? JSON.stringify(error.response.data) 
        : (error.response?.data?.detail || 'Unbekannter Fehler');
      alert('Fehler beim Speichern der Handelsware: ' + errorMsg);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Möchten Sie diese Handelsware wirklich löschen?')) {
      try {
        await api.delete(`/suppliers/products/${id}/`);
        fetchProducts();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen der Handelsware');
      }
    }
  };

  const resetForm = () => {
    setFormData({
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
    setEditingProduct(null);
  };

  const openEditModal = async (product) => {
    setEditingProduct(product);
    
    // Lade die vollständigen Produktdetails vom Backend
    try {
      const response = await api.get(`/suppliers/products/${product.id}/`);
      const fullProduct = response.data;
      
      // Aktuellen Wechselkurs laden
      const currency = fullProduct.list_price_currency || 'EUR';
      let currentRate = 1.0;
      if (currency !== 'EUR' && Array.isArray(exchangeRates)) {
        const rate = exchangeRates.find(r => r.currency === currency);
        if (rate) {
          currentRate = parseFloat(rate.rate_to_eur);
        }
      }
      
      // Lade Warengruppen und Preislisten des Lieferanten
      await fetchProductGroups(fullProduct.supplier);
      await fetchPriceLists(fullProduct.supplier);
      
      setFormData({
        name: fullProduct.name,
        visitron_part_number: fullProduct.visitron_part_number,
        supplier_part_number: fullProduct.supplier_part_number || '',
        supplier: fullProduct.supplier,
        product_group: fullProduct.product_group || '',
        price_list: fullProduct.price_list || '',
        category: fullProduct.category || '',
        description: fullProduct.description || '',
        unit: fullProduct.unit,
        list_price: fullProduct.list_price,
        list_price_currency: currency,
        exchange_rate: currentRate,
        price_valid_from: fullProduct.price_valid_from,
        price_valid_until: fullProduct.price_valid_until || '',
        discount_percent: fullProduct.discount_percent || 0,
        margin_percent: fullProduct.margin_percent || 0,
        shipping_cost: fullProduct.shipping_cost || 0,
        shipping_cost_is_percent: fullProduct.shipping_cost_is_percent || false,
        import_cost: fullProduct.import_cost || 0,
        import_cost_is_percent: fullProduct.import_cost_is_percent || false,
        handling_cost: fullProduct.handling_cost || 0,
        handling_cost_is_percent: fullProduct.handling_cost_is_percent || false,
        storage_cost: fullProduct.storage_cost || 0,
        storage_cost_is_percent: fullProduct.storage_cost_is_percent || false,
        costs_currency: fullProduct.costs_currency || 'EUR',
        minimum_stock: fullProduct.minimum_stock || 0,
        is_active: fullProduct.is_active,
      });
      setShowModal(true);
    } catch (error) {
      console.error('Fehler beim Laden der Produktdetails:', error);
      alert('Fehler beim Laden der Produktdetails');
    }
  };

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
        {canWrite && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neue Handelsware
          </button>
        )}
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
              onChange={(e) => setFilterSupplier(e.target.value)}
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
      <div className="bg-white shadow overflow-hidden rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Visitron-Nr.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lieferant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategorie
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Einkaufspreis
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preisgültigkeit bis
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {product.visitron_part_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.supplier_name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.category_display || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-900">
                  {Number(product.purchase_price_eur).toFixed(2)} EUR
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex flex-col">
                    <span>
                      Bis: {product.price_valid_until 
                        ? new Date(product.price_valid_until).toLocaleDateString('de-DE')
                        : 'unbeschränkt'}
                    </span>
                    {!isPriceValid(product) && (
                      <span className="text-red-600 text-xs">Ungültig</span>
                    )}
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {canWrite && (
                    <>
                      <button
                        onClick={() => openEditModal(product)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                        title="Bearbeiten"
                      >
                        <PencilIcon className="h-5 w-5 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Löschen"
                      >
                        <TrashIcon className="h-5 w-5 inline" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

      {/* Modal */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <form onSubmit={handleSubmit}>
                {/* Header mit Preisinformationen */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {editingProduct ? 'Handelsware bearbeiten' : 'Neue Handelsware'}
                      </h3>
                      {formData.supplier && suppliers.find(s => s.id === parseInt(formData.supplier)) && (
                        <p className="text-orange-100 text-sm">
                          Lieferant: {suppliers.find(s => s.id === parseInt(formData.supplier))?.company_name}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 text-center min-w-[120px]">
                        <div className="text-orange-100 text-xs font-medium">Einkaufspreis</div>
                        <div className="text-white text-2xl font-bold">
                          {calculatedPrices.purchasePrice.toFixed(2)} €
                        </div>
                      </div>
                      <div className="bg-white bg-opacity-30 rounded-lg px-4 py-2 text-center min-w-[120px]">
                        <div className="text-orange-100 text-xs font-medium">Visitron-LP</div>
                        <div className="text-white text-2xl font-bold">
                          {calculatedPrices.visitronListPrice.toFixed(0)} €
                        </div>
                        {formData.margin_percent > 0 && (
                          <div className="text-orange-100 text-xs">{formData.margin_percent}% Marge</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Grundinformationen */}
                    <div className="col-span-2">
                      <h4 className="text-md font-semibold text-gray-700 mb-2">Grundinformationen</h4>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Visitron-Partnummer
                      </label>
                      <input
                        type="text"
                        value={formData.visitron_part_number || 'Wird automatisch generiert'}
                        readOnly
                        disabled
                        className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 text-gray-500 shadow-sm cursor-not-allowed"
                        title="Wird automatisch beim Speichern generiert: Lieferantennummer-laufende Nummer (z.B. 100-0001)"
                      />
                      <p className="mt-1 text-xs text-gray-500">Wird automatisch generiert basierend auf Lieferant</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Händler-Partnummer
                      </label>
                      <input
                        type="text"
                        value={formData.supplier_part_number}
                        onChange={(e) => setFormData({ ...formData, supplier_part_number: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Lieferant *
                      </label>
                      <select
                        required
                        value={formData.supplier}
                        onChange={async (e) => {
                          const supplierId = e.target.value;
                          setFormData({ ...formData, supplier: supplierId, product_group: '', price_list: '', discount_percent: 0 });
                          if (supplierId) {
                            await fetchProductGroups(supplierId);
                            await fetchPriceLists(supplierId);
                          } else {
                            setProductGroups([]);
                            setPriceLists([]);
                          }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="">Bitte wählen...</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.company_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Warengruppe
                      </label>
                      <select
                        value={formData.product_group}
                        onChange={(e) => {
                          const groupId = e.target.value;
                          setFormData({ ...formData, product_group: groupId });
                          if (groupId) {
                            const group = productGroups.find(g => g.id === parseInt(groupId));
                            if (group) {
                              setFormData({ ...formData, product_group: groupId, discount_percent: group.discount_percent });
                            }
                          }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        disabled={!formData.supplier}
                      >
                        <option value="">Bitte wählen...</option>
                        {productGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name} ({group.discount_percent}%)
                          </option>
                        ))}
                      </select>
                      {!formData.supplier && (
                        <p className="mt-1 text-sm text-gray-500">Bitte zuerst Lieferant auswählen</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Preisliste
                      </label>
                      <select
                        value={formData.price_list}
                        onChange={(e) => {
                          const priceListId = e.target.value;
                          setFormData({ ...formData, price_list: priceListId });
                          if (priceListId) {
                            const priceList = priceLists.find(pl => pl.id === parseInt(priceListId));
                            if (priceList) {
                              setFormData({ 
                                ...formData, 
                                price_list: priceListId,
                                price_valid_from: priceList.valid_from,
                                price_valid_until: priceList.valid_until || ''
                              });
                            }
                          }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        disabled={!formData.supplier}
                      >
                        <option value="">Bitte wählen...</option>
                        {priceLists.map((priceList) => (
                          <option key={priceList.id} value={priceList.id}>
                            {priceList.name} ({new Date(priceList.valid_from).toLocaleDateString('de-DE')} - {priceList.valid_until ? new Date(priceList.valid_until).toLocaleDateString('de-DE') : 'unbegrenzt'})
                          </option>
                        ))}
                      </select>
                      {!formData.supplier && (
                        <p className="mt-1 text-sm text-gray-500">Bitte zuerst Lieferant auswählen</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Kategorie
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="">Bitte wählen...</option>
                        <option value="SOFTWARE">Software</option>
                        <option value="MIKROSKOPE">Mikroskope</option>
                        <option value="BELEUCHTUNG">Beleuchtung</option>
                        <option value="KAMERAS">Kameras</option>
                        <option value="DIENSTLEISTUNG">Dienstleistung</option>
                        <option value="LICHTQUELLEN">Lichtquellen</option>
                        <option value="SCANNING_BELEUCHTUNG">Scanning- und Beleuchtungsmodule</option>
                        <option value="PERIPHERALS">Peripherals</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Einheit
                      </label>
                      <input
                        type="text"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Beschreibung
                      </label>
                      <textarea
                        rows="2"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    {/* Preisinformationen */}
                    <div className="col-span-2 mt-4">
                      <h4 className="text-md font-semibold text-gray-700 mb-2">Preisinformationen</h4>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Lieferanten-Listenpreis *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.list_price}
                        onChange={(e) => setFormData({ ...formData, list_price: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Listenpreis Währung *
                      </label>
                      <select
                        required
                        value={formData.list_price_currency}
                        onChange={(e) => {
                          const newCurrency = e.target.value;
                          setFormData({ ...formData, list_price_currency: newCurrency });
                          // Auto-load exchange rate when currency changes
                          setTimeout(() => {
                            if (newCurrency === 'EUR') {
                              setFormData(prev => ({ ...prev, exchange_rate: 1.0 }));
                            } else if (Array.isArray(exchangeRates)) {
                              const rate = exchangeRates.find(r => r.currency === newCurrency);
                              if (rate) {
                                setFormData(prev => ({ ...prev, exchange_rate: rate.rate_to_eur }));
                              }
                            }
                          }, 100);
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="CHF">CHF</option>
                        <option value="GBP">GBP</option>
                        <option value="JPY">JPY</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Wechselkurs zu EUR
                      </label>
                      <input
                        type="text"
                        value={formData.exchange_rate ? parseFloat(formData.exchange_rate).toFixed(6) : '1.000000'}
                        readOnly
                        className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 text-gray-700 font-mono"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Wird automatisch aus Einstellungen geladen (EUR = 1.0)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Preis gültig ab *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.price_valid_from}
                        onChange={(e) => setFormData({ ...formData, price_valid_from: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Preis gültig bis (optional)
                      </label>
                      <input
                        type="date"
                        value={formData.price_valid_until}
                        onChange={(e) => setFormData({ ...formData, price_valid_until: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Rabatt (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.discount_percent}
                        onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Marge für Visitron-Listenpreis (%) - VLP = EK / (1 - Marge/100)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="99.9"
                        value={formData.margin_percent}
                        onChange={(e) => setFormData({ ...formData, margin_percent: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    {/* Zusätzliche Kosten */}
                    <div className="col-span-2 mt-4">
                      <h4 className="text-md font-semibold text-gray-700 mb-2">Zusätzliche Kosten</h4>
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Kosten Währung
                      </label>
                      <select
                        value={formData.costs_currency}
                        onChange={(e) => setFormData({ ...formData, costs_currency: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="CHF">CHF</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Versandkosten
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.shipping_cost}
                          onChange={(e) => setFormData({ ...formData, shipping_cost: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        />
                        <label className="flex items-center mt-1">
                          <input
                            type="checkbox"
                            checked={formData.shipping_cost_is_percent}
                            onChange={(e) => setFormData({ ...formData, shipping_cost_is_percent: e.target.checked })}
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="ml-2 text-sm text-gray-600">%</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Importkosten
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.import_cost}
                          onChange={(e) => setFormData({ ...formData, import_cost: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        />
                        <label className="flex items-center mt-1">
                          <input
                            type="checkbox"
                            checked={formData.import_cost_is_percent}
                            onChange={(e) => setFormData({ ...formData, import_cost_is_percent: e.target.checked })}
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="ml-2 text-sm text-gray-600">%</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Handlingkosten
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.handling_cost}
                          onChange={(e) => setFormData({ ...formData, handling_cost: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        />
                        <label className="flex items-center mt-1">
                          <input
                            type="checkbox"
                            checked={formData.handling_cost_is_percent}
                            onChange={(e) => setFormData({ ...formData, handling_cost_is_percent: e.target.checked })}
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="ml-2 text-sm text-gray-600">%</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Lagerkosten
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.storage_cost}
                          onChange={(e) => setFormData({ ...formData, storage_cost: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        />
                        <label className="flex items-center mt-1">
                          <input
                            type="checkbox"
                            checked={formData.storage_cost_is_percent}
                            onChange={(e) => setFormData({ ...formData, storage_cost_is_percent: e.target.checked })}
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="ml-2 text-sm text-gray-600">%</span>
                        </label>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 mt-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          Aktiv (für Angebote verwendbar)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingProducts;
