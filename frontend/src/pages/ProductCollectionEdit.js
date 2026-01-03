import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  RectangleStackIcon,
  CubeIcon,
  DocumentArrowUpIcon,
  ChartBarIcon,
  LanguageIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const ProductCollectionEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    title: '',
    title_en: '',
    short_description: '',
    short_description_en: '',
    description: '',
    description_en: '',
    product_source: 'TRADING_GOODS',
    supplier: '',
    product_category: '',
    created_by: '',
    quotation_text_short: '',
    quotation_text_short_en: '',
    quotation_text_long: '',
    quotation_text_long_en: '',
    manual: null,
    unit: 'Stück',
    is_active: true,
    items: []
  });

  // Statistics
  const [statistics, setStatistics] = useState({
    quotation_count: 0,
    order_count: 0,
    total_usage: 0
  });

  // Calculated totals
  const [totals, setTotals] = useState({
    total_purchase_price: 0,
    total_list_price: 0,
    price_valid_until: null
  });

  // Tab configuration
  const tabs = [
    { id: 1, name: 'Stammdaten', icon: RectangleStackIcon },
    { id: 2, name: 'Positionen', icon: CubeIcon },
    { id: 3, name: 'Angebotstext', icon: DocumentTextIcon },
    { id: 4, name: 'Dokumente', icon: DocumentArrowUpIcon },
    { id: 5, name: 'Statistik', icon: ChartBarIcon }
  ];

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [suppliersRes, categoriesRes, usersRes] = await Promise.all([
          api.get('/suppliers/suppliers/?is_active=true'),
          api.get('/settings/product-categories/'),
          api.get('/users/')
        ]);
        
        setSuppliers(suppliersRes.data.results || suppliersRes.data || []);
        setCategories(categoriesRes.data.results || categoriesRes.data || []);
        setUsers(usersRes.data.results || usersRes.data || []);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch collection if editing
  useEffect(() => {
    if (id) {
      const fetchCollection = async () => {
        setLoading(true);
        try {
          const response = await api.get(`/procurement/product-collections/${id}/`);
          const data = response.data;
          
          setFormData({
            collection_number: data.collection_number,
            title: data.title || '',
            title_en: data.title_en || '',
            short_description: data.short_description || '',
            short_description_en: data.short_description_en || '',
            description: data.description || '',
            description_en: data.description_en || '',
            product_source: data.product_source || 'TRADING_GOODS',
            supplier: data.supplier || '',
            product_category: data.product_category || '',
            created_by: data.created_by || '',
            quotation_text_short: data.quotation_text_short || '',
            quotation_text_short_en: data.quotation_text_short_en || '',
            quotation_text_long: data.quotation_text_long || '',
            quotation_text_long_en: data.quotation_text_long_en || '',
            manual: data.manual,
            unit: data.unit || 'Stück',
            is_active: data.is_active !== false,
            items: (data.items || []).map(item => {
              // Determine product_type from content_type if possible
              let product_type = item.product_type;
              if (!product_type && item.content_type_data && item.content_type_data.model) {
                const model = item.content_type_data.model;
                if (model === 'tradingproduct') product_type = 'trading_product';
                else if (model === 'vsservice') product_type = 'vs_service';
                else if (model === 'visiviewproduct') product_type = 'visiview';
                else if (model === 'vshardware') product_type = 'vs_hardware';
              }

              return {
                id: item.id,
                position: item.position,
                content_type: item.content_type_data,
                object_id: item.object_id,
                product_type: product_type,
                article_number: item.article_number,
                name: item.name,
                name_en: item.name_en || '',
                description: item.description || '',
                description_en: item.description_en || '',
                quantity: parseFloat(item.quantity) || 1,
                unit: item.unit || 'Stück',
                unit_purchase_price: parseFloat(item.unit_purchase_price) || 0,
                unit_list_price: parseFloat(item.unit_list_price) || 0,
                total_purchase_price: parseFloat(item.total_purchase_price) || 0,
                total_list_price: parseFloat(item.total_list_price) || 0,
                price_valid_until: item.price_valid_until
              };
            })
          });

          setTotals({
            total_purchase_price: parseFloat(data.total_purchase_price) || 0,
            total_list_price: parseFloat(data.total_list_price) || 0,
            price_valid_until: data.price_valid_until
          });

          if (data.usage_statistics) {
            setStatistics(data.usage_statistics);
          }
        } catch (error) {
          console.error('Error fetching collection:', error);
          alert('Fehler beim Laden der Warensammlung');
        } finally {
          setLoading(false);
        }
      };

      fetchCollection();
    }
  }, [id]);

  // Fetch available products when source or supplier changes
  const fetchAvailableProducts = useCallback(async () => {
    if (!formData.product_source) return;
    
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.append('product_source', formData.product_source);
      if (formData.supplier && formData.product_source === 'TRADING_GOODS') {
        params.append('supplier', formData.supplier);
      }
      if (productSearchTerm) {
        params.append('search', productSearchTerm);
      }
      
      const response = await api.get(`/procurement/product-collections/available_products/?${params.toString()}`);
      setAvailableProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setAvailableProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [formData.product_source, formData.supplier, productSearchTerm]);

  useEffect(() => {
    if (activeTab === 2) {
      fetchAvailableProducts();
    }
  }, [activeTab, fetchAvailableProducts]);

  // Calculate totals when items change
  useEffect(() => {
    const totalPurchase = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_purchase_price), 0);
    const totalList = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_list_price), 0);
    
    // Find minimum valid_until date
    const validDates = formData.items
      .filter(item => item.price_valid_until)
      .map(item => new Date(item.price_valid_until));
    const minDate = validDates.length > 0 ? new Date(Math.min(...validDates)) : null;

    setTotals({
      total_purchase_price: totalPurchase,
      total_list_price: totalList,
      price_valid_until: minDate ? minDate.toISOString().split('T')[0] : null
    });
  }, [formData.items]);

  // Add item to collection
  const handleAddItem = (product) => {
    // Check if product already exists
    const existingIndex = formData.items.findIndex(
      item => item.article_number === product.article_number
    );

    if (existingIndex >= 0) {
      // Increase quantity
      const updatedItems = [...formData.items];
      updatedItems[existingIndex].quantity += 1;
      setFormData(prev => ({ ...prev, items: updatedItems }));
    } else {
      // Add new item
      const newItem = {
        position: formData.items.length + 1,
        content_type: null,
        object_id: product.id,
        product_type: product.product_type,
        article_number: product.article_number,
        name: product.name,
        name_en: '',
        description: product.description,
        description_en: '',
        quantity: 1,
        unit: product.unit || 'Stück',
        unit_purchase_price: product.purchase_price || 0,
        unit_list_price: product.list_price || 0,
        total_purchase_price: product.purchase_price || 0,
        total_list_price: product.list_price || 0,
        price_valid_until: product.price_valid_until
      };

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));
    }
  };

  // Remove item from collection
  const handleRemoveItem = (index) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    // Update positions
    const reindexedItems = updatedItems.map((item, i) => ({
      ...item,
      position: i + 1
    }));
    setFormData(prev => ({ ...prev, items: reindexedItems }));
  };

  // Update item quantity
  const handleItemQuantityChange = (index, quantity) => {
    const updatedItems = [...formData.items];
    updatedItems[index].quantity = parseFloat(quantity) || 1;
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  // Translate German text to English (placeholder - could integrate with translation API)
  const handleTranslate = async (field) => {
    const germanText = formData[field];
    if (!germanText) {
      alert('Bitte geben Sie zuerst den deutschen Text ein.');
      return;
    }

    if (!id) {
      alert('Bitte speichern Sie die Warensammlung zuerst, um Übersetzungen zu verwenden.');
      return;
    }

    try {
      const response = await api.post(`/procurement/product-collections/${id}/translate/`, {
        field,
        to: 'EN'
      });
      const translated = response.data.translated || response.data;
      const englishField = `${field}_en`;
      setFormData(prev => ({ ...prev, [englishField]: translated }));
      alert('Übersetzung erfolgreich eingefügt. Bitte prüfen Sie die englische Version.');
    } catch (error) {
      console.error('Translation error:', error);
      alert('Fehler bei der Übersetzung: ' + (error.response?.data?.error || error.message));
    }
  };

  // Generate quotation text
  const handleGenerateQuotationText = async (language, type) => {
    if (!id) {
      alert('Bitte speichern Sie die Warensammlung zuerst.');
      return;
    }

    try {
      const response = await api.post(`/procurement/product-collections/${id}/generate_quotation_text/`, {
        language,
        type
      });

      const field = type === 'short' 
        ? (language === 'EN' ? 'quotation_text_short_en' : 'quotation_text_short')
        : (language === 'EN' ? 'quotation_text_long_en' : 'quotation_text_long');

      setFormData(prev => ({
        ...prev,
        [field]: response.data.text
      }));
    } catch (error) {
      console.error('Error generating quotation text:', error);
      alert('Fehler beim Generieren des Angebotstextes');
    }
  };

  // Save collection
  const handleSave = async () => {
    if (!formData.title) {
      alert('Bitte geben Sie einen Titel ein.');
      return;
    }

    if (formData.product_source === 'TRADING_GOODS' && !formData.supplier) {
      alert('Bitte wählen Sie einen Lieferanten aus.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        title_en: formData.title_en,
        // Copy offer text (Tab 3) into Stammdaten description fields (Tab 1) on save
        short_description: formData.quotation_text_short,
        short_description_en: formData.quotation_text_short_en,
        description: formData.quotation_text_long,
        description_en: formData.quotation_text_long_en,
        product_source: formData.product_source,
        supplier: formData.product_source === 'TRADING_GOODS' ? formData.supplier : null,
        product_category: formData.product_category || null,
        quotation_text_short: formData.quotation_text_short,
        quotation_text_short_en: formData.quotation_text_short_en,
        quotation_text_long: formData.quotation_text_long,
        quotation_text_long_en: formData.quotation_text_long_en,
        unit: formData.unit,
        is_active: formData.is_active,
        items_data: formData.items.map(item => ({
          product_type: item.product_type || (item.content_type && item.content_type.model ? (
            item.content_type.model === 'tradingproduct' ? 'trading_product' :
            item.content_type.model === 'vsservice' ? 'vs_service' :
            item.content_type.model === 'visiviewproduct' ? 'visiview' :
            item.content_type.model === 'vshardware' ? 'vs_hardware' : null
          ) : null),
          product_id: item.object_id,
          quantity: item.quantity
        }))
      };

      let response;
      if (isEditMode) {
        response = await api.patch(`/procurement/product-collections/${id}/`, payload);
      } else {
        response = await api.post('/procurement/product-collections/', payload);
      }

      if (!isEditMode) {
        navigate(`/procurement/product-collections/${response.data.id}`);
      } else {
        alert('Warensammlung gespeichert!');
        // Reload data
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving collection:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || JSON.stringify(error.response?.data) || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Handle manual upload
  const handleManualUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !id) return;

    const uploadFormData = new FormData();
    uploadFormData.append('manual', file);

    try {
      await api.patch(`/procurement/product-collections/${id}/`, uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Manual hochgeladen!');
      window.location.reload();
    } catch (error) {
      console.error('Error uploading manual:', error);
      alert('Fehler beim Hochladen: ' + error.message);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/procurement/product-collections')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? `Warensammlung ${formData.collection_number || ''}` : 'Neue Warensammlung'}
            </h1>
            <p className="text-gray-500 text-sm">
              {isEditMode ? formData.title : 'Neues Produktbündel erstellen'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
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
      <div className="bg-white shadow rounded-lg p-6">
        {/* Tab 1: Stammdaten */}
        {activeTab === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Titel DE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titel (Deutsch) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleTranslate('title')}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    title="Ins Englische übersetzen"
                  >
                    <LanguageIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Titel EN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titel (Englisch)
                </label>
                <input
                  type="text"
                  value={formData.title_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, title_en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Kurzbeschreibung DE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kurzbeschreibung (Deutsch)
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={formData.short_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, short_description: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    rows={3}
                  />
                  <button
                    type="button"
                    onClick={() => handleTranslate('short_description')}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 self-start"
                    title="Ins Englische übersetzen"
                  >
                    <LanguageIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Kurzbeschreibung EN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kurzbeschreibung (Englisch)
                </label>
                <textarea
                  value={formData.short_description_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, short_description_en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={3}
                />
              </div>

              {/* Langbeschreibung DE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung (Deutsch)
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    rows={5}
                  />
                  <button
                    type="button"
                    onClick={() => handleTranslate('description')}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 self-start"
                    title="Ins Englische übersetzen"
                  >
                    <LanguageIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Langbeschreibung EN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung (Englisch)
                </label>
                <textarea
                  value={formData.description_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, description_en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={5}
                />
              </div>
            </div>

            <hr className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Produktdatenbank */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produktdatenbank *
                </label>
                <select
                  value={formData.product_source}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    product_source: e.target.value,
                    supplier: e.target.value !== 'TRADING_GOODS' ? '' : prev.supplier,
                    items: [] // Clear items when source changes
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="TRADING_GOODS">Trading Goods</option>
                  <option value="VS_SERVICE">VS-Service Produkte</option>
                  <option value="VISIVIEW">VisiView-Produkte</option>
                  <option value="VS_HARDWARE">VS-Hardware</option>
                </select>
              </div>

              {/* Lieferant (nur bei Trading Goods) */}
              {formData.product_source === 'TRADING_GOODS' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lieferant *
                  </label>
                  <select
                    value={formData.supplier}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      supplier: e.target.value,
                      items: [] // Clear items when supplier changes
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    <option value="">Bitte wählen...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_number} - {s.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Warenkategorie */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warenkategorie
                </label>
                <select
                  value={formData.product_category}
                  onChange={(e) => setFormData(prev => ({ ...prev, product_category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Bitte wählen...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Aktiv</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Positionen */}
        {activeTab === 2 && (
          <div className="space-y-6">
            {/* Product Search */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Produkt hinzufügen</h3>
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Suche nach Artikelnummer oder Name..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <button
                  onClick={fetchAvailableProducts}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Available Products */}
              <div className="mt-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {loadingProducts ? (
                  <div className="p-4 text-center text-gray-500">Laden...</div>
                ) : availableProducts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {formData.product_source === 'TRADING_GOODS' && !formData.supplier
                      ? 'Bitte wählen Sie zuerst einen Lieferanten aus.'
                      : 'Keine Produkte gefunden.'}
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Artikelnr.</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">EK</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">VK</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {availableProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{product.article_number}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{product.name}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCurrency(product.purchase_price)}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900">{formatCurrency(product.list_price)}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => handleAddItem(product)}
                              className="text-orange-600 hover:text-orange-800"
                              title="Hinzufügen"
                            >
                              <PlusIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Selected Items */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Positionen ({formData.items.length})</h3>
              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                  Noch keine Positionen hinzugefügt
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artikelnr.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Menge</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">EK/Stk</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">VK/Stk</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gesamt VK</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {formData.items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{item.position}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.article_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.name}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemQuantityChange(index, e.target.value)}
                            className="w-20 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(item.unit_purchase_price)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(item.unit_list_price)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {formatCurrency(item.quantity * item.unit_list_price)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                            title="Entfernen"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        Gesamt:
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-600">
                        {formatCurrency(totals.total_purchase_price)}
                      </td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                        {formatCurrency(totals.total_list_price)}
                      </td>
                      <td></td>
                    </tr>
                    {totals.price_valid_until && (
                      <tr>
                        <td colSpan="8" className="px-4 py-2 text-sm text-gray-500 text-right">
                          Preisgültigkeit bis: <span className="font-medium">{formatDate(totals.price_valid_until)}</span>
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Angebotstext */}
        {activeTab === 3 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">
              Der Angebotstext wird automatisch generiert und kann manuell angepasst werden. Er enthält die Beschreibung und eine Auflistung aller Positionen.
            </p>

            {/* Kurz DE */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Angebotstext kurz (Deutsch)
                </label>
                <button
                  onClick={() => handleGenerateQuotationText('DE', 'short')}
                  disabled={!id}
                  className="text-sm text-orange-600 hover:text-orange-800 disabled:opacity-50"
                >
                  Automatisch generieren
                </button>
              </div>
              <textarea
                value={formData.quotation_text_short}
                onChange={(e) => setFormData(prev => ({ ...prev, quotation_text_short: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                rows={6}
              />
            </div>

            {/* Kurz EN */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Angebotstext kurz (Englisch)
                </label>
                <button
                  onClick={() => handleGenerateQuotationText('EN', 'short')}
                  disabled={!id}
                  className="text-sm text-orange-600 hover:text-orange-800 disabled:opacity-50"
                >
                  Automatisch generieren
                </button>
              </div>
              <textarea
                value={formData.quotation_text_short_en}
                onChange={(e) => setFormData(prev => ({ ...prev, quotation_text_short_en: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                rows={6}
              />
            </div>

            <hr />

            {/* Lang DE */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Angebotstext lang (Deutsch)
                </label>
                <button
                  onClick={() => handleGenerateQuotationText('DE', 'long')}
                  disabled={!id}
                  className="text-sm text-orange-600 hover:text-orange-800 disabled:opacity-50"
                >
                  Automatisch generieren
                </button>
              </div>
              <textarea
                value={formData.quotation_text_long}
                onChange={(e) => setFormData(prev => ({ ...prev, quotation_text_long: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                rows={10}
              />
            </div>

            {/* Lang EN */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Angebotstext lang (Englisch)
                </label>
                <button
                  onClick={() => handleGenerateQuotationText('EN', 'long')}
                  disabled={!id}
                  className="text-sm text-orange-600 hover:text-orange-800 disabled:opacity-50"
                >
                  Automatisch generieren
                </button>
              </div>
              <textarea
                value={formData.quotation_text_long_en}
                onChange={(e) => setFormData(prev => ({ ...prev, quotation_text_long_en: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                rows={10}
              />
            </div>
          </div>
        )}

        {/* Tab 4: Dokumente */}
        {activeTab === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Manual</h3>
              
              {formData.manual ? (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <DocumentArrowUpIcon className="h-8 w-8 text-gray-400" />
                  <div className="flex-1">
                    <a 
                      href={formData.manual}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-600 hover:text-orange-800 font-medium"
                    >
                      Manual anzeigen
                    </a>
                  </div>
                  <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer">
                    Ersetzen
                    <input
                      type="file"
                      onChange={handleManualUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                    />
                  </label>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <DocumentArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">
                    {id ? 'Kein Manual hochgeladen' : 'Bitte speichern Sie die Warensammlung zuerst'}
                  </p>
                  {id && (
                    <label className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer">
                      Manual hochladen
                      <input
                        type="file"
                        onChange={handleManualUpload}
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Statistik */}
        {activeTab === 5 && (
          <div className="space-y-6">
            <h3 className="font-medium text-gray-900 mb-4">Verwendungsstatistik</h3>
            
            {!id ? (
              <p className="text-gray-500">Statistiken sind erst nach dem Speichern verfügbar.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{statistics.quotation_count}</div>
                  <div className="text-sm text-blue-800 mt-1">Angebote</div>
                </div>
                <div className="bg-green-50 p-6 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{statistics.order_count}</div>
                  <div className="text-sm text-green-800 mt-1">Aufträge</div>
                </div>
                <div className="bg-purple-50 p-6 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{statistics.total_usage}</div>
                  <div className="text-sm text-purple-800 mt-1">Gesamt</div>
                </div>
              </div>
            )}

            <hr className="my-6" />

            <h3 className="font-medium text-gray-900 mb-4">Preisinformationen</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-500">Gesamt-Einkaufspreis</div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(totals.total_purchase_price)}</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-500">Gesamt-Listenpreis</div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(totals.total_list_price)}</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-500">Preisgültigkeit</div>
                <div className="text-xl font-bold text-gray-900">
                  {totals.price_valid_until ? formatDate(totals.price_valid_until) : 'Unbefristet'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCollectionEdit;
