import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  CurrencyEuroIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basic', name: 'Basisinformationen', icon: InformationCircleIcon },
  { id: 'prices', name: 'Preise', icon: CurrencyEuroIcon }
];

const VisiViewProductEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basic');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Basic Info Form
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    product_category: null,
    unit: 'Stück',
    is_active: true
  });

  // Dropdown Options
  const [productCategories, setProductCategories] = useState([]);

  // Prices State
  const [prices, setPrices] = useState([]);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await api.get(`/visiview/products/${id}/`);
      const data = response.data;
      setProduct(data);
      setFormData({
        name: data.name || '',
        description: data.description || '',
        product_category: data.product_category,
        unit: data.unit || 'Stück',
        is_active: data.is_active !== false
      });
      setPrices(data.prices || []);
    } catch (error) {
      console.error('Error fetching VisiView product:', error);
      alert('Fehler beim Laden des Produkts');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/settings/product-categories/?is_active=true');
      setProductCategories(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchProduct();
    fetchCategories();
  }, [fetchProduct, fetchCategories]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/visiview/products/${id}/`, formData);
      setSaveMessage({ type: 'success', text: 'Änderungen gespeichert!' });
      setHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setSaveMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Möchten Sie dieses Produkt wirklich löschen?\n\n${product.name}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    
    try {
      await api.delete(`/visiview/products/${id}/`);
      alert('Produkt erfolgreich gelöscht');
      navigate('/visiview/products');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen des Produkts: ' + (error.response?.data?.detail || error.message));
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

  // =====================
  // PRICES HANDLERS
  // =====================
  const openPriceModal = (price = null) => {
    setEditingPrice(price || {
      purchase_price: '',
      list_price: '',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      notes: ''
    });
    setShowPriceModal(true);
  };

  const savePrice = async () => {
    try {
      const payload = {
        ...editingPrice,
        product: id,
        valid_until: editingPrice.valid_until || null
      };
      
      if (editingPrice.id) {
        await api.put(`/visiview/product-prices/${editingPrice.id}/`, payload);
      } else {
        await api.post('/visiview/product-prices/', payload);
      }
      setShowPriceModal(false);
      fetchProduct();
    } catch (error) {
      console.error('Error saving price:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.valid_from || error.message));
    }
  };

  const deletePrice = async (priceId) => {
    if (!window.confirm('Preis wirklich löschen?')) return;
    try {
      await api.delete(`/visiview/product-prices/${priceId}/`);
      fetchProduct();
    } catch (error) {
      console.error('Error deleting price:', error);
      alert('Fehler beim Löschen');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-gray-500">Produkt nicht gefunden</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/visiview/products')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Zurück zu VisiView Produkte
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {product.article_number} - {product.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Kategorie: {product.product_category_name || 'Keine'} | 
              Erstellt: {formatDate(product.created_at)}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {saveMessage && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                saveMessage.type === 'success' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {saveMessage.type === 'success' 
                  ? <CheckCircleIcon className="h-4 w-4" />
                  : <ExclamationCircleIcon className="h-4 w-4" />
                }
                {saveMessage.text}
              </div>
            )}
            {id && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <TrashIcon className="h-5 w-5" />
                Löschen
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`px-4 py-2 rounded-lg text-white ${
                hasChanges 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Speichere...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="tab-scroll flex -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
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
          {/* Tab 1: Basisinformationen */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Artikelnummer
                  </label>
                  <input
                    type="text"
                    value={product.article_number || ''}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warenkategorie
                  </label>
                  <select
                    value={formData.product_category || ''}
                    onChange={(e) => handleInputChange('product_category', e.target.value || null)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Keine Kategorie --</option>
                    {productCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Standard: VisiView</p>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produktname *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. VisiView Basic License"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Produktbeschreibung..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Einheit
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => handleInputChange('unit', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Produkt aktiv
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Preise */}
          {activeTab === 'prices' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Preishistorie</h3>
                <button
                  onClick={() => openPriceModal()}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="h-5 w-5" />
                  Neuer Preis
                </button>
              </div>

              {prices.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <CurrencyEuroIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>Noch keine Preise angelegt</p>
                  <button
                    onClick={() => openPriceModal()}
                    className="mt-2 text-blue-600 hover:underline"
                  >
                    Ersten Preis hinzufügen
                  </button>
                </div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Gültig von
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Gültig bis
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Einkaufspreis (EK)
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Listenpreis (LP)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Notizen
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {prices.map((price) => (
                      <tr key={price.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDate(price.valid_from)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {price.valid_until ? formatDate(price.valid_until) : 'unbegrenzt'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatCurrency(price.purchase_price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(price.list_price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                          {price.notes || '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openPriceModal(price)}
                              className="text-blue-600 hover:text-blue-900 text-sm"
                            >
                              Bearbeiten
                            </button>
                            <button
                              onClick={() => deletePrice(price.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Info Box */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Aktuelle Preise</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600">Einkaufspreis (EK):</span>{' '}
                    <span className="font-medium">{formatCurrency(product.current_purchase_price)}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Listenpreis (LP):</span>{' '}
                    <span className="font-medium">{formatCurrency(product.current_list_price)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Price Modal */}
      {showPriceModal && editingPrice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingPrice.id ? 'Preis bearbeiten' : 'Neuer Preis'}
              </h2>
              <button onClick={() => setShowPriceModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Einkaufspreis (EK) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPrice.purchase_price}
                    onChange={(e) => setEditingPrice(prev => ({ ...prev, purchase_price: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Listenpreis (LP) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPrice.list_price}
                    onChange={(e) => setEditingPrice(prev => ({ ...prev, list_price: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gültig von *
                  </label>
                  <input
                    type="date"
                    value={editingPrice.valid_from}
                    onChange={(e) => setEditingPrice(prev => ({ ...prev, valid_from: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gültig bis
                  </label>
                  <input
                    type="date"
                    value={editingPrice.valid_until || ''}
                    onChange={(e) => setEditingPrice(prev => ({ ...prev, valid_until: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leer = unbegrenzt gültig</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notizen
                </label>
                <textarea
                  value={editingPrice.notes || ''}
                  onChange={(e) => setEditingPrice(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Optionale Notizen..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowPriceModal(false)}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={savePrice}
                disabled={!editingPrice.purchase_price || !editingPrice.list_price || !editingPrice.valid_from}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisiViewProductEdit;
