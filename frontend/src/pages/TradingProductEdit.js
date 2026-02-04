import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  CurrencyEuroIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basic', name: 'Basisinformationen', icon: InformationCircleIcon },
  { id: 'prices', name: 'Preise', icon: CurrencyEuroIcon }
];

const CATEGORY_CHOICES = [
  { value: '', label: '-- Keine Kategorie --' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'MIKROSKOPE', label: 'Mikroskope' },
  { value: 'BELEUCHTUNG', label: 'Beleuchtung' },
  { value: 'KAMERAS', label: 'Kameras' },
  { value: 'DIENSTLEISTUNG', label: 'Dienstleistung' },
  { value: 'LICHTQUELLEN', label: 'Lichtquellen' },
  { value: 'SCANNING_BELEUCHTUNG', label: 'Scanning- und Beleuchtungsmodule' },
  { value: 'PERIPHERALS', label: 'Peripherals' }
];

const CURRENCY_OPTIONS = ['EUR', 'USD', 'CHF', 'GBP', 'JPY'];

const TradingProductEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basic');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Suppliers, Product Groups, Price Lists for dropdowns
  const [suppliers, setSuppliers] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);

  // Basic Info Form
  const [formData, setFormData] = useState({
    name: '',
    supplier: '',
    supplier_part_number: '',
    category: '',
    product_group: '',
    price_list: '',
    description: '',
    description_en: '',
    short_description: '',
    short_description_en: '',
    unit: 'Stück',
    minimum_stock: 0,
    is_active: true,
    // Legacy price fields (still needed for backward compatibility)
    list_price: 0,
    list_price_currency: 'EUR',
    exchange_rate: 1,
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
    price_valid_from: new Date().toISOString().split('T')[0]
  });

  // Price History State
  const [priceHistory, setPriceHistory] = useState([]);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [calculatedPrices, setCalculatedPrices] = useState({
    purchasePrice: 0,
    listPrice: 0
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // If this is an edit of an existing product (id present and not 'new'), fetch the product
      let productData = null;
      if (id && id !== 'new') {
        try {
          const productRes = await api.get(`/suppliers/products/${id}/`);
          productData = productRes.data;
        } catch (err) {
          console.warn('Could not load product data:', err);
        }
      }

      // Fetch reference data (suppliers, groups, price lists, exchange rates)
      const [suppliersRes, groupsRes, listsRes, ratesRes] = await Promise.all([
        api.get('/suppliers/suppliers/?is_active=true&page_size=500'),
        api.get('/suppliers/product-groups/?page_size=500'),
        api.get('/suppliers/price-lists/?page_size=500'),
        api.get('/settings/exchange-rates/')
      ]);

      // Apply product data if available, otherwise keep defaults
      if (productData) {
        setProduct(productData);
        setFormData({
          name: productData.name || '',
          supplier: productData.supplier || '',
          supplier_part_number: productData.supplier_part_number || '',
          category: productData.category || '',
          product_group: productData.product_group || '',
          price_list: productData.price_list || '',
          description: productData.description || '',
          description_en: productData.description_en || '',
          short_description: productData.short_description || '',
          short_description_en: productData.short_description_en || '',
          unit: productData.unit || 'Stück',
          minimum_stock: productData.minimum_stock || 0,
          is_active: productData.is_active !== false,
          list_price: productData.list_price || 0,
          list_price_currency: productData.list_price_currency || 'EUR',
          exchange_rate: productData.exchange_rate || 1,
          discount_percent: productData.discount_percent || 0,
          margin_percent: productData.margin_percent || 0,
          shipping_cost: productData.shipping_cost || 0,
          shipping_cost_is_percent: productData.shipping_cost_is_percent || false,
          import_cost: productData.import_cost || 0,
          import_cost_is_percent: productData.import_cost_is_percent || false,
          handling_cost: productData.handling_cost || 0,
          handling_cost_is_percent: productData.handling_cost_is_percent || false,
          storage_cost: productData.storage_cost || 0,
          storage_cost_is_percent: productData.storage_cost_is_percent || false,
          price_valid_from: productData.price_valid_from || new Date().toISOString().split('T')[0]
        });
        setPriceHistory(productData.price_history || []);
      } else {
        // New product - keep defaults but ensure exchange rates/suppliers loaded
        setPriceHistory([]);
      }

      setSuppliers(suppliersRes.data.results || suppliersRes.data);
      setProductGroups(groupsRes.data.results || groupsRes.data);
      setPriceLists(listsRes.data.results || listsRes.data);
      setExchangeRates(ratesRes.data.results || ratesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Fehler beim Laden der Produktdaten');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (id && id !== 'new') {
        await api.patch(`/suppliers/products/${id}/`, formData);
        setSaveMessage({ type: 'success', text: 'Änderungen gespeichert!' });
      } else {
        const resp = await api.post('/suppliers/products/', formData);
        setSaveMessage({ type: 'success', text: 'Produkt erstellt!' });
        // Navigate to the newly created product edit page
        if (resp?.data?.id) {
          navigate(`/procurement/trading-goods/${resp.data.id}`);
        } else {
          // fallback: go back to list
          navigate('/procurement/trading-goods');
        }
      }
      setHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setSaveMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  const handleManualUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('release_manual', file);

    try {
      await api.patch(`/suppliers/products/${id}/`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchData();
      setSaveMessage({ type: 'success', text: 'Release-Manual hochgeladen' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error uploading manual:', error);
      alert('Fehler beim Hochladen');
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  // Get filtered product groups and price lists based on selected supplier
  const filteredProductGroups = productGroups.filter(g => g.supplier === formData.supplier);
  const filteredPriceLists = priceLists.filter(l => l.supplier === formData.supplier);

  // Get exchange rate for selected currency
  const getExchangeRateForCurrency = (currency) => {
    if (currency === 'EUR') return 1;
    const rate = exchangeRates.find(r => r.currency === currency);
    return rate ? parseFloat(rate.rate_to_eur) : 1;
  };

  // Helpers to fetch product groups / price lists for a specific supplier (used in selects)
  const fetchProductGroups = async (supplierId = null) => {
    try {
      const params = new URLSearchParams();
      if (supplierId) params.append('supplier', supplierId);
      params.append('page_size', '500');
      const res = await api.get(`/suppliers/product-groups/?${params.toString()}`);
      const data = res.data.results || res.data;
      setProductGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Could not load product groups', err);
      setProductGroups([]);
    }
  };

  const fetchPriceLists = async (supplierId = null) => {
    try {
      const params = new URLSearchParams();
      if (supplierId) params.append('supplier', supplierId);
      params.append('is_active', 'true');
      params.append('page_size', '500');
      const res = await api.get(`/suppliers/price-lists/?${params.toString()}`);
      const data = res.data.results || res.data;
      setPriceLists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Could not load price lists', err);
      setPriceLists([]);
    }
  };

  // =====================
  // PRICE CALCULATION
  // =====================
  const calculatePricesFromModal = (priceData) => {
    const supplierPrice = parseFloat(priceData.supplier_list_price) || 0;
    const discount = parseFloat(priceData.discount_percent) || 0;
    const exchangeRate = parseFloat(priceData.exchange_rate) || 1;
    const margin = parseFloat(priceData.margin_percent) || 0;

    // Base price after discount
    const baseAfterDiscount = supplierPrice * (1 - discount / 100);

    // Calculate additional costs
    const calcCost = (cost, isPercent) => {
      const c = parseFloat(cost) || 0;
      return isPercent ? baseAfterDiscount * (c / 100) : c;
    };

    const shipping = calcCost(priceData.shipping_cost, priceData.shipping_cost_is_percent);
    const importCost = calcCost(priceData.import_cost, priceData.import_cost_is_percent);
    const handling = calcCost(priceData.handling_cost, priceData.handling_cost_is_percent);
    const storage = calcCost(priceData.storage_cost, priceData.storage_cost_is_percent);

    // Purchase price in EUR
    const purchasePrice = (baseAfterDiscount + shipping + importCost + handling + storage) * exchangeRate;

    // List price with margin (rounded up to whole euros)
    let listPrice = 0;
    if (margin < 100) {
      listPrice = purchasePrice / (1 - margin / 100);
      listPrice = Math.ceil(listPrice);
    } else {
      listPrice = purchasePrice * 10;
    }

    return { purchasePrice: purchasePrice.toFixed(2), listPrice: listPrice.toFixed(0) };
  };

  // =====================
  // PRICES HANDLERS
  // =====================
  const openPriceModal = (price = null) => {
    if (price) {
      setEditingPrice({
        ...price,
        supplier_list_price: price.supplier_list_price || formData.list_price,
        supplier_currency: price.supplier_currency || formData.list_price_currency,
        exchange_rate: price.exchange_rate || formData.exchange_rate,
        discount_percent: price.discount_percent || 0,
        shipping_cost: price.shipping_cost || 0,
        shipping_cost_is_percent: price.shipping_cost_is_percent || false,
        import_cost: price.import_cost || 0,
        import_cost_is_percent: price.import_cost_is_percent || false,
        handling_cost: price.handling_cost || 0,
        handling_cost_is_percent: price.handling_cost_is_percent || false,
        storage_cost: price.storage_cost || 0,
        storage_cost_is_percent: price.storage_cost_is_percent || false,
        margin_percent: price.margin_percent || 0,
        valid_from: price.valid_from || new Date().toISOString().split('T')[0],
        valid_until: price.valid_until || '',
        notes: price.notes || ''
      });
      const calc = calculatePricesFromModal(price);
      setCalculatedPrices(calc);
    } else {
      // New price - use current product values as defaults
      const newPrice = {
        supplier_list_price: formData.list_price,
        supplier_currency: formData.list_price_currency,
        exchange_rate: formData.exchange_rate,
        discount_percent: formData.discount_percent,
        shipping_cost: formData.shipping_cost,
        shipping_cost_is_percent: formData.shipping_cost_is_percent,
        import_cost: formData.import_cost,
        import_cost_is_percent: formData.import_cost_is_percent,
        handling_cost: formData.handling_cost,
        handling_cost_is_percent: formData.handling_cost_is_percent,
        storage_cost: formData.storage_cost,
        storage_cost_is_percent: formData.storage_cost_is_percent,
        margin_percent: formData.margin_percent,
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: '',
        notes: ''
      };
      setEditingPrice(newPrice);
      const calc = calculatePricesFromModal(newPrice);
      setCalculatedPrices(calc);
    }
    setShowPriceModal(true);
  };

  const handlePriceFieldChange = (field, value) => {
    const updated = { ...editingPrice, [field]: value };
    setEditingPrice(updated);
    
    // Update exchange rate when currency changes
    if (field === 'supplier_currency') {
      updated.exchange_rate = getExchangeRateForCurrency(value);
    }
    
    // Recalculate prices
    const calc = calculatePricesFromModal(updated);
    setCalculatedPrices(calc);
  };

  const savePrice = async () => {
    try {
      const payload = {
        ...editingPrice,
        product: id,
        valid_until: editingPrice.valid_until || null
      };

      if (editingPrice.id) {
        await api.put(`/suppliers/product-prices/${editingPrice.id}/`, payload);
      } else {
        await api.post('/suppliers/product-prices/', payload);
      }
      setShowPriceModal(false);
      fetchData();
      setSaveMessage({ type: 'success', text: 'Preis gespeichert!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving price:', error);
      const errorMsg = error.response?.data?.non_field_errors?.[0] 
        || error.response?.data?.valid_from?.[0]
        || error.response?.data?.detail
        || 'Fehler beim Speichern';
      alert('Fehler: ' + errorMsg);
    }
  };

  const deletePrice = async (priceId) => {
    if (!window.confirm('Preis wirklich löschen?')) return;
    try {
      await api.delete(`/suppliers/product-prices/${priceId}/`);
      fetchData();
    } catch (error) {
      console.error('Error deleting price:', error);
    }
  };

  // =====================
  // RENDER
  // =====================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  // When creating a new product there is no `product` yet — only show "not found"
  // if we expected to load an existing product (i.e. `id` param is present and not 'new').
  if (id && id !== 'new' && !product) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Produkt nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/procurement/trading-goods')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <div className="text-sm text-gray-500">{id === 'new' ? 'Neue Handelsware' : 'Handelsware bearbeiten'}</div>
            <h1 className="text-2xl font-bold">
              {product ? (
                <>
                  <span className="font-mono text-blue-600">{product.visitron_part_number}</span>
                  {' '}{product.name}
                </>
              ) : (
                <>{formData.name || 'Neue Handelsware'}</>
              )}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {saveMessage.text}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`px-4 py-2 rounded-lg ${
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="tab-scroll flex -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* ===================== BASIC INFO TAB ===================== */}
          {activeTab === 'basic' && (
            <div className="space-y-6 max-w-4xl">
              {/* Supplier Info (readonly) */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Lieferant</h3>
                {(!product || id === 'new') ? (
                  <select
                    required
                    value={formData.supplier || ''}
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
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.company_name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-lg font-semibold">
                    {product?.supplier_name || '-'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produktname *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Distributor part number
                  </label>
                  <input
                    type="text"
                    value={formData.supplier_part_number}
                    onChange={(e) => handleInputChange('supplier_part_number', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorie
                  </label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => handleInputChange('category', e.target.value || null)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORY_CHOICES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warengruppe
                  </label>
                  <select
                    value={formData.product_group || ''}
                    onChange={(e) => handleInputChange('product_group', e.target.value || null)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Keine Warengruppe --</option>
                    {filteredProductGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.discount_percent}%)</option>
                    ))}
                  </select>
                </div>

                {/* Preisliste entfernt - Feld entfällt */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Einheit
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => handleInputChange('unit', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mindestbestand
                  </label>
                  <input
                    type="number"
                    value={formData.minimum_stock}
                    onChange={(e) => handleInputChange('minimum_stock', parseFloat(e.target.value) || 0)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kurzbeschreibung (Deutsch)
                  </label>
                  <input
                    type="text"
                    value={formData.short_description}
                    onChange={(e) => handleInputChange('short_description', e.target.value)}
                    maxLength={200}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kurzbeschreibung (Englisch)
                  </label>
                  <input
                    type="text"
                    value={formData.short_description_en}
                    onChange={(e) => handleInputChange('short_description_en', e.target.value)}
                    maxLength={200}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung (Deutsch)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung (Englisch)
                  </label>
                  <textarea
                    value={formData.description_en}
                    onChange={(e) => handleInputChange('description_en', e.target.value)}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Aktiv</span>
                  </label>
                </div>
              </div>

              {/* Manual Upload Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Dokumentation</h3>
                <div className="border rounded-lg p-4 max-w-md">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">Release-Manual</span>
                    <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm">
                      <ArrowUpTrayIcon className="h-5 w-5 inline mr-1" />
                      Hochladen
                      <input
                        type="file"
                        onChange={handleManualUpload}
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                      />
                    </label>
                  </div>
                  {product?.release_manual ? (
                    <a
                      href={product.release_manual}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                    >
                      <DocumentArrowDownIcon className="h-5 w-5" />
                      Release-Manual herunterladen
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">Kein Dokument</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== PRICES TAB ===================== */}
          {activeTab === 'prices' && (
            <div className="space-y-6">
              {/* Current Price Summary */}
              {product?.current_price && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-800 mb-2">Aktueller Preis</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs text-green-600">Gültig ab</span>
                      <p className="font-mono">{formatDate(product.current_price.valid_from)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-green-600">Gültig bis</span>
                      <p className="font-mono">{product.current_price.valid_until ? formatDate(product.current_price.valid_until) : 'unbegrenzt'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-green-600">Einkaufspreis (EK)</span>
                      <p className="font-mono font-bold text-lg">{formatCurrency(product.current_price.purchase_price)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-green-600">Listenpreis (LP/VK)</span>
                      <p className="font-mono font-bold text-lg">{formatCurrency(product.current_price.list_price)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Legacy Price Info */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Produkt-Preisfelder (Legacy)</h3>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Lieferanten-LP</span>
                    <p className="font-mono">{parseFloat(formData.list_price || 0).toFixed(2)} {formData.list_price_currency}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Rabatt</span>
                    <p className="font-mono">{formData.discount_percent}%</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Berechneter EK</span>
                    <p className="font-mono">{product?.purchase_price_eur ? formatCurrency(product.purchase_price_eur) : '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Berechneter VLP</span>
                    <p className="font-mono">{product?.visitron_list_price ? formatCurrency(product.visitron_list_price) : '-'}</p>
                  </div>
                </div>
              </div>

              {/* Price History Section */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Preishistorie</h3>
                <button
                  onClick={() => openPriceModal()}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="h-5 w-5" />
                  Neuer Preis
                </button>
              </div>

              {priceHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border rounded-lg">
                  Noch keine Preishistorie vorhanden
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gültig von</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gültig bis</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lieferanten-LP</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rabatt</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">EK-Preis</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">LP/VK</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notizen</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {priceHistory.map((price, index) => {
                        const isCurrentPrice = product?.current_price && product.current_price.id === price.id;
                        return (
                          <tr 
                            key={price.id} 
                            className={`hover:bg-gray-50 ${isCurrentPrice ? 'bg-green-50' : ''}`}
                          >
                            <td className="px-4 py-3">{formatDate(price.valid_from)}</td>
                            <td className="px-4 py-3">{price.valid_until ? formatDate(price.valid_until) : 'unbegrenzt'}</td>
                            <td className="px-4 py-3 text-right font-mono">
                              {parseFloat(price.supplier_list_price).toFixed(2)} {price.supplier_currency}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{price.discount_percent}%</td>
                            <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(price.purchase_price)}</td>
                            <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(price.list_price)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{price.notes || '-'}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => openPriceModal(price)}
                                className="text-blue-600 hover:text-blue-800 mr-3"
                              >
                                Bearbeiten
                              </button>
                              <button
                                onClick={() => deletePrice(price.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <TrashIcon className="h-5 w-5 inline" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================== PRICE MODAL ===================== */}
      {showPriceModal && editingPrice && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowPriceModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-medium">
                  {editingPrice.id ? 'Preis bearbeiten' : 'Neuen Preis anlegen'}
                </h3>
                <button onClick={() => setShowPriceModal(false)} className="text-gray-400 hover:text-gray-500">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Supplier Price Section */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Lieferanten-Preis</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Listenpreis *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingPrice.supplier_list_price}
                        onChange={(e) => handlePriceFieldChange('supplier_list_price', e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Währung</label>
                      <select
                        value={editingPrice.supplier_currency}
                        onChange={(e) => handlePriceFieldChange('supplier_currency', e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      >
                        {CURRENCY_OPTIONS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Wechselkurs zu EUR</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editingPrice.exchange_rate}
                        onChange={(e) => handlePriceFieldChange('exchange_rate', e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Rabatt (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingPrice.discount_percent}
                        onChange={(e) => handlePriceFieldChange('discount_percent', e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Costs Section */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Zusätzliche Kosten</h4>
                  <div className="grid grid-cols-4 gap-4">
                    {/* Shipping */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Versandkosten</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editingPrice.shipping_cost}
                          onChange={(e) => handlePriceFieldChange('shipping_cost', e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editingPrice.shipping_cost_is_percent}
                            onChange={(e) => handlePriceFieldChange('shipping_cost_is_percent', e.target.checked)}
                          />
                          %
                        </label>
                      </div>
                    </div>
                    {/* Import */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Importkosten</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editingPrice.import_cost}
                          onChange={(e) => handlePriceFieldChange('import_cost', e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editingPrice.import_cost_is_percent}
                            onChange={(e) => handlePriceFieldChange('import_cost_is_percent', e.target.checked)}
                          />
                          %
                        </label>
                      </div>
                    </div>
                    {/* Handling */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Handlingkosten</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editingPrice.handling_cost}
                          onChange={(e) => handlePriceFieldChange('handling_cost', e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editingPrice.handling_cost_is_percent}
                            onChange={(e) => handlePriceFieldChange('handling_cost_is_percent', e.target.checked)}
                          />
                          %
                        </label>
                      </div>
                    </div>
                    {/* Storage */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Lagerkosten</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editingPrice.storage_cost}
                          onChange={(e) => handlePriceFieldChange('storage_cost', e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editingPrice.storage_cost_is_percent}
                            onChange={(e) => handlePriceFieldChange('storage_cost_is_percent', e.target.checked)}
                          />
                          %
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Margin & Validity Section */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Marge (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingPrice.margin_percent}
                      onChange={(e) => handlePriceFieldChange('margin_percent', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Gültig von *</label>
                    <input
                      type="date"
                      value={editingPrice.valid_from}
                      onChange={(e) => handlePriceFieldChange('valid_from', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Gültig bis</label>
                    <input
                      type="date"
                      value={editingPrice.valid_until || ''}
                      onChange={(e) => handlePriceFieldChange('valid_until', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notizen</label>
                  <textarea
                    value={editingPrice.notes}
                    onChange={(e) => handlePriceFieldChange('notes', e.target.value)}
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Calculated Prices Preview */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-3">Berechnete Preise</h4>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <span className="text-xs text-blue-600">Einkaufspreis (EK)</span>
                      <p className="text-2xl font-mono font-bold">{formatCurrency(parseFloat(calculatedPrices.purchasePrice))}</p>
                    </div>
                    <div>
                      <span className="text-xs text-blue-600">Visitron-Listenpreis (LP/VK)</span>
                      <p className="text-2xl font-mono font-bold">{formatCurrency(parseFloat(calculatedPrices.listPrice))}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                <button
                  onClick={() => setShowPriceModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                >
                  Abbrechen
                </button>
                <button
                  onClick={savePrice}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingProductEdit;
