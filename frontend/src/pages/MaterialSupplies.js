import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
/* eslint-disable react-hooks/exhaustive-deps */
import storage from '../utils/sessionStore';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SortableHeader from '../components/SortableHeader';

const MaterialSupplies = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [sortBy, setSortBy] = useState('visitron_part_number');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [calculatedPurchasePrice, setCalculatedPurchasePrice] = useState(0);
  
  const canWrite = user?.is_staff || user?.is_superuser || user?.can_write_material_supplies || user?.can_write_manufacturing;

  const SESSION_KEY = 'material_supplies_search_state';
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.filters) {
        setSortBy(st.filters.sortBy || 'visitron_part_number');
        setFilterSupplier(st.filters.filterSupplier || '');
        setFilterActive(st.filters.filterActive || 'all');
      }
      if (st.hasSearched) setRefreshKey(prev => prev + 1);
      return { filters: st.filters || null };
    } catch (e) {
      console.warn('Failed to load material supplies search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { filters: { sortBy, filterSupplier, filterActive } };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save material supplies search state', e);
    }
  };

  useEffect(() => {
    const urlParams = Object.fromEntries([...searchParams]);
    if (Object.keys(urlParams).length > 0) {
      return;
    }

    const restored = loadSearchState();
    if (restored && restored.filters) {
      const params = {};
      if (restored.filters.sortBy) params.ordering = restored.filters.sortBy;
      if (restored.filters.filterSupplier) params.supplier = restored.filters.filterSupplier;
      if (restored.filters.filterActive) params.is_active = restored.filters.filterActive;
      setSearchParams(params);
    } else if (!restored) {
      setRefreshKey(prev => prev + 1);
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newSort = params.ordering || 'visitron_part_number';
      const newSupplier = params.supplier || '';
      const newActive = params.is_active || 'all';
      setSortBy(newSort);
      setFilterSupplier(newSupplier);
      setFilterActive(newActive);
      setRefreshKey(prev => prev + 1);
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // persist state whenever relevant parts change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    saveSearchState();
  }, [sortBy, filterSupplier, filterActive]);

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
    fetchProducts();
    fetchSuppliers();
    fetchExchangeRates();
  }, [sortBy, filterSupplier, filterActive, refreshKey]);

  // Berechne Einkaufspreis live bei Formular-Änderungen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    calculatePurchasePrice();
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
    formData.storage_cost_is_percent
  ]);

  const calculatePurchasePrice = () => {
    const listPrice = parseFloat(formData.list_price) || 0;
    const exchangeRate = parseFloat(formData.exchange_rate) || 1.0;
    const discountPercent = parseFloat(formData.discount_percent) || 0;
    
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
    
    setCalculatedPurchasePrice(purchasePrice);
  };

  const fetchProducts = async () => {
    try {
      let url = '/suppliers/material-supplies/';
      const params = new URLSearchParams();
      
      if (sortBy) params.append('ordering', sortBy);
      if (filterSupplier) params.append('supplier', filterSupplier);
      if (filterActive !== 'all') params.append('is_active', filterActive === 'active');
      
      // Cache-Buster
      params.append('_t', `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      url += '?' + params.toString();
      
      const response = await api.get(url);
      const data = response.data.results || response.data;
      setProducts(Array.isArray(data) ? data : []);

      // Persist immediately
      try { saveSearchState(); } catch (e) { console.warn('Could not persist material supplies search state', e); }
    } catch (error) {
      console.error('Fehler beim Laden der Material & Supplies:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers/suppliers/?page_size=1000');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Bereite Daten vor: Leere Strings für optionale Felder zu null
      const submitData = {
        ...formData,
        price_valid_until: formData.price_valid_until || null,
        product_group: formData.product_group || null,
        price_list: formData.price_list || null,
        category: formData.category || null,
        description: formData.description || ''
      };
      
      if (editingProduct) {
        await api.put(`/suppliers/material-supplies/${editingProduct.id}/`, submitData);
      } else {
        await api.post('/suppliers/material-supplies/', submitData);
      }
      setShowModal(false);
      setRefreshKey(prev => prev + 1);
      resetForm();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      console.error('Error response:', error.response?.data);
      console.error('Form data:', formData);
      const errorMessage = error.response?.data 
        ? JSON.stringify(error.response.data, null, 2)
        : error.message || 'Unbekannter Fehler';
      alert('Fehler beim Speichern:\n' + errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Möchten Sie dieses Material wirklich löschen?')) return;
    
    try {
      await api.delete(`/suppliers/material-supplies/${id}/`);
      setRefreshKey(prev => prev + 1);
      alert('Material erfolgreich gelöscht.');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      
      // Prüfe ob es ein PROTECT constraint error ist
      if (error.response?.status === 500 || error.response?.status === 400) {
        const errorMsg = error.response?.data?.detail || error.response?.data?.error || '';
        if (errorMsg.toLowerCase().includes('protect') || errorMsg.toLowerCase().includes('constraint') || errorMsg.toLowerCase().includes('referenced')) {
          alert('Dieses Material kann nicht gelöscht werden, da es bereits in VS-Hardware, Entwicklungsprojekten oder anderen Bereichen verwendet wird.\n\nBitte deaktivieren Sie das Material stattdessen, um es aus der aktiven Liste zu entfernen.');
        } else {
          alert('Fehler beim Löschen:\n' + (errorMsg || 'Unbekannter Fehler'));
        }
      } else {
        alert('Fehler beim Löschen:\n' + (error.response?.data?.detail || error.message || 'Unbekannter Fehler'));
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
      const response = await api.get(`/suppliers/material-supplies/${product.id}/`);
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

  // Client-side search filtering
  const filteredProducts = React.useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) =>
      (p.visitron_part_number || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.supplier_part_number || '').toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Lade...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Material & Supplies</h1>
          <p className="mt-2 text-sm text-gray-600">
            Roh-, Hilfs- und Betriebsstoffe - {searchQuery ? `${filteredProducts.length} von ${products.length}` : products.length} Einträge
          </p>
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
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neues Material
          </button>
        )}
      </div>

      {/* Suche und Filter */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Suche
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Artikelnr. / Name / Lief.-Artikelnr."
                className="pl-9 w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieferant
            </label>
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="all">Alle</option>
              <option value="active">Nur Aktive</option>
              <option value="inactive">Nur Inaktive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Produktliste */}
      <div className="bg-white shadow overflow-hidden rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="visitron_part_number" label="Visitron-Nr." sortBy={sortBy} setSortBy={setSortBy} />
              <SortableHeader field="name" label="Name" sortBy={sortBy} setSortBy={setSortBy} style={{maxWidth: '250px'}} />
              <SortableHeader field="supplier_part_number" label="Lief.-Artikelnr." sortBy={sortBy} setSortBy={setSortBy} />
              <SortableHeader field="supplier__company_name" label="Lieferant" sortBy={sortBy} setSortBy={setSortBy} style={{maxWidth: '150px'}} />
              <SortableHeader field="category" label="Kategorie" sortBy={sortBy} setSortBy={setSortBy} />
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Einkaufspreis
              </th>
              <SortableHeader field="is_active" label="Status" sortBy={sortBy} setSortBy={setSortBy} />
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map((product) => (
              <tr 
                key={product.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => canWrite && openEditModal(product)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {product.visitron_part_number}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900" style={{maxWidth: '250px'}}>
                  <div className="truncate" title={product.name}>
                    {product.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.supplier_part_number || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500" style={{maxWidth: '150px'}}>
                  <div className="truncate" title={product.supplier_name || '-'}>
                    {product.supplier_name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.category_display || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-900">
                  {Number(product.purchase_price_eur).toFixed(2)} EUR
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(product.id);
                      }}
                      className="text-red-600 hover:text-red-900"
                      title="Löschen"
                    >
                      <TrashIcon className="h-5 w-5 inline" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal für Erstellen/Bearbeiten */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowModal(false)}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      {editingProduct ? 'Material bearbeiten' : 'Neues Material'}
                    </h3>
                    
                    {/* Preisanzeige */}
                    <div className="flex gap-4 bg-green-600 text-white rounded-lg px-6 py-3">
                      <div className="bg-white bg-opacity-30 rounded-lg px-4 py-2 text-center min-w-[120px]">
                        <div className="text-green-100 text-xs font-medium">Einkaufspreis</div>
                        <div className="text-white text-2xl font-bold">
                          {calculatedPurchasePrice.toFixed(2)} €
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Grundinformationen */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Lieferanten-Partnummer
                      </label>
                      <input
                        type="text"
                        value={formData.supplier_part_number}
                        onChange={(e) => setFormData({ ...formData, supplier_part_number: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Lieferant *
                      </label>
                      <select
                        required
                        value={formData.supplier}
                        onChange={(e) => {
                          const supplierId = e.target.value;
                          setFormData({ ...formData, supplier: supplierId });
                          if (supplierId) {
                            fetchProductGroups(supplierId);
                            fetchPriceLists(supplierId);
                          }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        style={{ color: '#111827', backgroundColor: '#ffffff' }}
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
                              setFormData({ 
                                ...formData, 
                                product_group: groupId,
                                discount_percent: group.discount_percent 
                              });
                            }
                          }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                        Kategorie *
                      </label>
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      >
                        <option value="">Bitte wählen...</option>
                        <option value="ROHSTOFF">Rohstoff</option>
                        <option value="HILFSSTOFF">Hilfsstoff</option>
                        <option value="BETRIEBSSTOFF">Betriebsstoff</option>
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        />
                        <label className="flex items-center mt-1">
                          <input
                            type="checkbox"
                            checked={formData.shipping_cost_is_percent}
                            onChange={(e) => setFormData({ ...formData, shipping_cost_is_percent: e.target.checked })}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
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
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        />
                        <label className="flex items-center mt-1">
                          <input
                            type="checkbox"
                            checked={formData.import_cost_is_percent}
                            onChange={(e) => setFormData({ ...formData, import_cost_is_percent: e.target.checked })}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
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
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        />
                        <label className="flex items-center mt-1">
                          <input
                            type="checkbox"
                            checked={formData.handling_cost_is_percent}
                            onChange={(e) => setFormData({ ...formData, handling_cost_is_percent: e.target.checked })}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
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
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        />
                        <label className="flex items-center mt-1">
                          <input
                            type="checkbox"
                            checked={formData.storage_cost_is_percent}
                            onChange={(e) => setFormData({ ...formData, storage_cost_is_percent: e.target.checked })}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
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
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          Aktiv (für Bestellungen verwendbar)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:w-auto sm:text-sm"
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

export default MaterialSupplies;
