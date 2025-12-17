import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, CurrencyEuroIcon } from '@heroicons/react/24/outline';

const TradingProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [sortBy, setSortBy] = useState('visitron_part_number');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [calculatedPrices, setCalculatedPrices] = useState({
    purchasePrice: 0,
    visitronListPrice: 0
  });
  
  const canWrite = user?.is_staff || user?.is_superuser;

  const [formData, setFormData] = useState({
    name: '',
    visitron_part_number: '',
    supplier_part_number: '',
    supplier: '',
    category: '',
    description: '',
    unit: 'Stück',
    list_price: '',
    list_price_currency: 'EUR',
    exchange_rate: 1.0,
    price_valid_from: new Date().toISOString().split('T')[0],
    price_valid_until: '',
    discount_percent: 0,
    markup_percent: 0,
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

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchExchangeRates();
  }, [sortBy, filterSupplier, filterActive, refreshKey]);

  // Berechne Preise live bei Formular-Änderungen
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
    formData.markup_percent
  ]);

  const calculatePrices = () => {
    const listPrice = parseFloat(formData.list_price) || 0;
    const exchangeRate = parseFloat(formData.exchange_rate) || 1.0;
    const discountPercent = parseFloat(formData.discount_percent) || 0;
    const markupPercent = parseFloat(formData.markup_percent) || 0;
    
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
    
    // Visitron-Listenpreis (auf volle Euros gerundet)
    const visitronListPrice = Math.ceil(purchasePrice * (1 + markupPercent / 100));
    
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
      if (filterActive !== 'all') params.append('is_active', filterActive === 'active');
      
      // Cache-Buster mit zufälligem Wert
      params.append('_t', `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      url += '?' + params.toString();
      
      console.log('Fetching products from:', url);
      const response = await api.get(url);
      const data = response.data.results || response.data;
      console.log('Products loaded:', data.length, 'items');
      setProducts(Array.isArray(data) ? data : []);
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
        category: formData.category || null,
        price_valid_until: formData.price_valid_until || null,
      };
      
      if (editingProduct) {
        await api.put(`/suppliers/products/${editingProduct.id}/`, submitData);
        console.log('Product updated successfully');
      } else {
        await api.post('/suppliers/products/', submitData);
        console.log('Product created successfully');
      }
      setShowModal(false);
      resetForm();
      // Warte kurz, damit das Backend die Berechnung durchführen kann
      await new Promise(resolve => setTimeout(resolve, 150));
      // Erzwinge einen kompletten Neuaufbau der Liste
      console.log('Triggering refresh...');
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
      category: '',
      description: '',
      unit: 'Stück',
      list_price: '',
      list_price_currency: 'EUR',
      exchange_rate: 1.0,
      price_valid_from: new Date().toISOString().split('T')[0],
      price_valid_until: '',
      discount_percent: 0,
      markup_percent: 0,
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

  const openEditModal = (product) => {
    setEditingProduct(product);
    
    // Aktuellen Wechselkurs laden
    const currency = product.list_price_currency || 'EUR';
    let currentRate = 1.0;
    if (currency !== 'EUR' && Array.isArray(exchangeRates)) {
      const rate = exchangeRates.find(r => r.currency === currency);
      if (rate) {
        currentRate = parseFloat(rate.rate_to_eur);
      }
    }
    
    setFormData({
      name: product.name,
      visitron_part_number: product.visitron_part_number,
      supplier_part_number: product.supplier_part_number || '',
      supplier: product.supplier,
      category: product.category || '',
      description: product.description || '',
      unit: product.unit,
      list_price: product.list_price,
      list_price_currency: currency,
      exchange_rate: currentRate,
      price_valid_from: product.price_valid_from,
      price_valid_until: product.price_valid_until || '',
      discount_percent: product.discount_percent,
      markup_percent: product.markup_percent || 0,
      shipping_cost: product.shipping_cost,
      shipping_cost_is_percent: product.shipping_cost_is_percent,
      import_cost: product.import_cost,
      import_cost_is_percent: product.import_cost_is_percent,
      handling_cost: product.handling_cost,
      handling_cost_is_percent: product.handling_cost_is_percent,
      storage_cost: product.storage_cost,
      storage_cost_is_percent: product.storage_cost_is_percent,
      costs_currency: product.costs_currency || 'EUR',
      minimum_stock: product.minimum_stock,
      is_active: product.is_active,
    });
    setShowModal(true);
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
          <h1 className="text-3xl font-bold text-gray-900">Handelswaren</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      {/* Produktliste */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
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
                Preisgültigkeit
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
                    <span>Ab: {new Date(product.price_valid_from).toLocaleDateString('de-DE')}</span>
                    {product.price_valid_until && (
                      <span>Bis: {new Date(product.price_valid_until).toLocaleDateString('de-DE')}</span>
                    )}
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

      {products.length === 0 && (
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
                        {formData.markup_percent > 0 && (
                          <div className="text-orange-100 text-xs">+{formData.markup_percent}%</div>
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
                        Visitron-Partnummer *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.visitron_part_number}
                        onChange={(e) => setFormData({ ...formData, visitron_part_number: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
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
                        onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
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
                        <option value="CONFOCALS">Confocals</option>
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
                        Aufschlag für Visitron-Listenpreis (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.markup_percent}
                        onChange={(e) => setFormData({ ...formData, markup_percent: e.target.value })}
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
