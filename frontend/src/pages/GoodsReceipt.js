import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import storage from '../utils/sessionStore';
import SupplierSearch from '../components/SupplierSearch';
import {
  FunnelIcon,
  InboxArrowDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const SESSION_KEY = 'goods_receipt_search_state';

const GoodsReceipt = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  
  // Incoming Goods State
  const [incomingGoods, setIncomingGoods] = useState([]);
  const [filters, setFilters] = useState({
    supplier: '',
    item_function: '',
    product_category: '',
    search: ''
  });
  
  // Common Data
  const [suppliers, setSuppliers] = useState([]);
  const [productCategories, setProductCategories] = useState([]);

  // Load search state from localStorage or URL
  const loadSearchState = useCallback(() => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return null;
      return st;
    } catch (e) {
      console.warn('Failed to load goods receipt search state', e);
      return null;
    }
  }, []);

  const saveSearchState = useCallback((filtersToSave, goodsToSave) => {
    try {
      const st = { filters: filtersToSave, incomingGoods: goodsToSave };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save goods receipt search state', e);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await api.get('/suppliers/suppliers/');
      setSuppliers(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }, []);

  const fetchProductCategories = useCallback(async () => {
    try {
      const res = await api.get('/settings/product-categories/?is_active=true');
      setProductCategories(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching product categories:', error);
    }
  }, []);

  const fetchIncomingGoods = useCallback(async (filtersToUse = null) => {
    setLoading(true);
    const useFilters = filtersToUse || filters;
    try {
      const params = new URLSearchParams();
      if (useFilters.supplier) params.append('supplier', useFilters.supplier);
      if (useFilters.item_function) params.append('item_function', useFilters.item_function);
      if (useFilters.product_category) params.append('product_category', useFilters.product_category);
      if (useFilters.search) params.append('search', useFilters.search);

      const res = await api.get(`/inventory/incoming-goods/?${params.toString()}`);
      const goods = res.data.results || res.data;
      setIncomingGoods(goods);
      saveSearchState(useFilters, goods);
    } catch (error) {
      console.error('Error fetching incoming goods:', error);
      alert('Fehler beim Laden der Wareneingänge');
    } finally {
      setLoading(false);
    }
  }, [filters, saveSearchState]);

  // Initialize from URL params or localStorage
  useEffect(() => {
    fetchSuppliers();
    fetchProductCategories();
    
    // Check URL params first
    const urlParams = Object.fromEntries([...searchParams]);
    if (Object.keys(urlParams).length > 0) {
      const newFilters = {
        supplier: urlParams.supplier || '',
        item_function: urlParams.item_function || '',
        product_category: urlParams.product_category || '',
        search: urlParams.search || ''
      };
      setFilters(newFilters);
      fetchIncomingGoods(newFilters);
      return;
    }
    
    // Fall back to localStorage
    const restored = loadSearchState();
    if (restored && restored.filters) {
      setFilters(restored.filters);
      if (restored.incomingGoods) {
        setIncomingGoods(restored.incomingGoods);
      }
      // Update URL with restored filters
      const params = {};
      if (restored.filters.supplier) params.supplier = restored.filters.supplier;
      if (restored.filters.item_function) params.item_function = restored.filters.item_function;
      if (restored.filters.product_category) params.product_category = restored.filters.product_category;
      if (restored.filters.search) params.search = restored.filters.search;
      if (Object.keys(params).length > 0) {
        setSearchParams(params);
      }
      // Refresh data
      fetchIncomingGoods(restored.filters);
    } else {
      // Initial load without filters
      fetchIncomingGoods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to URL query param changes (back/forward navigation)
  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newFilters = {
        supplier: params.supplier || '',
        item_function: params.item_function || '',
        product_category: params.product_category || '',
        search: params.search || ''
      };
      setFilters(newFilters);
      fetchIncomingGoods(newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  
  const handleSearch = () => {
    // Update URL params
    const params = {};
    if (filters.supplier) params.supplier = filters.supplier;
    if (filters.item_function) params.item_function = filters.item_function;
    if (filters.product_category) params.product_category = filters.product_category;
    if (filters.search) params.search = filters.search;
    setSearchParams(params);
    fetchIncomingGoods(filters);
  };

  const handleReset = () => {
    const emptyFilters = {
      supplier: '',
      item_function: '',
      product_category: '',
      search: ''
    };
    setFilters(emptyFilters);
    setSearchParams({});
    try { storage.remove(SESSION_KEY); } catch (e) { /* ignore */ }
    fetchIncomingGoods(emptyFilters);
  };

  const handleTransferToInventory = async (incomingGoodId) => {
    if (!window.confirm('Möchten Sie diese Position wirklich ins Lager überführen?')) {
      return;
    }
    
    try {
      const res = await api.post(`/inventory/incoming-goods/${incomingGoodId}/transfer_to_inventory/`);
      alert(res.data.message);
      fetchIncomingGoods(); // Refresh list
    } catch (error) {
      console.error('Error transferring to inventory:', error);
      const errorMsg = error.response?.data?.error || 'Fehler beim Überführen ins Lager';
      alert(errorMsg);
    }
  };
  
  const handleUpdateIncomingGood = async (id, updates) => {
    try {
      await api.patch(`/inventory/incoming-goods/${id}/`, updates);
      fetchIncomingGoods();
    } catch (error) {
      console.error('Error updating incoming good:', error);
      alert('Fehler beim Aktualisieren');
    }
  };
  
  // Filter categories by item_function
  const getFilteredCategories = (itemFunction) => {
    if (!itemFunction) return productCategories;
    
    return productCategories.filter(cat => {
      if (itemFunction === 'TRADING_GOOD') return cat.applies_to_trading_goods;
      if (itemFunction === 'MATERIAL') return cat.applies_to_material_supplies;
      if (itemFunction === 'ASSET') return cat.applies_to_trading_goods;
      return true;
    });
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <InboxArrowDownIcon className="h-8 w-8 mr-3 text-blue-600" />
          Wareneingang
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Verwalten Sie eingehende Waren und überführen Sie diese ins Lager
        </p>
      </div>
      
      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <input
              type="text"
              placeholder="Name, Artikelnr., Bestellnr..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieferant</label>
            <SupplierSearch
              value={filters.supplier || null}
              onChange={(supplierId) => setFilters({ ...filters, supplier: supplierId || '' })}
              placeholder="Alle Lieferanten"
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warenfunktion</label>
            <select
              value={filters.item_function}
              onChange={(e) => setFilters({ ...filters, item_function: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Alle</option>
              <option value="TRADING_GOOD">Handelsware</option>
              <option value="ASSET">Asset</option>
              <option value="MATERIAL">Material & Supplies</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warenkategorie</label>
            <select
              value={filters.product_category}
              onChange={(e) => setFilters({ ...filters, product_category: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Alle Kategorien</option>
              {getFilteredCategories(filters.item_function).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleSearch}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium flex items-center justify-center"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Filtern
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              title="Filter zurücksetzen"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Results Count */}
      {incomingGoods.length > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          {incomingGoods.length} Wareneingang{incomingGoods.length !== 1 ? 'spositionen' : 'sposition'} gefunden
        </div>
      )}
      
      {/* Incoming Goods Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Artikel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lieferant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Menge
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Warenfunktion
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Warenkategorie
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Seriennummer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktion
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
                  Lädt...
                </td>
              </tr>
            ) : incomingGoods.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
                  Keine Wareneingänge vorhanden
                </td>
              </tr>
            ) : (
              incomingGoods.map((item) => (
                <IncomingGoodRow
                  key={item.id}
                  item={item}
                  suppliers={suppliers}
                  productCategories={productCategories}
                  onUpdate={handleUpdateIncomingGood}
                  onTransfer={handleTransferToInventory}
                  getFilteredCategories={getFilteredCategories}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Sub-component for Incoming Good Row
const IncomingGoodRow = ({ item, suppliers, productCategories, onUpdate, onTransfer, getFilteredCategories }) => {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    item_function: item.item_function,
    product_category: item.product_category,
    serial_number: item.serial_number
  });
  
  const handleSave = () => {
    onUpdate(item.id, editData);
    setEditing(false);
  };
  
  const filteredCategories = getFilteredCategories(editData.item_function);
  const selectedCategory = productCategories.find(c => c.id === editData.product_category);
  const requiresSerial = selectedCategory ? selectedCategory.requires_serial_number : 
    (editData.item_function === 'TRADING_GOOD' || editData.item_function === 'ASSET');
  
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-gray-900">{item.name}</div>
        <div className="text-sm text-gray-500">Art.-Nr.: {item.article_number}</div>
        <div className="text-sm text-gray-500">Bestellung: {item.order_number}</div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">
        {item.supplier_name}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        {item.delivered_quantity} {item.unit}
      </td>
      <td className="px-6 py-4">
        {editing ? (
          <select
            value={editData.item_function}
            onChange={(e) => setEditData({ ...editData, item_function: e.target.value, product_category: '' })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="TRADING_GOOD">Handelsware</option>
            <option value="ASSET">Asset</option>
            <option value="MATERIAL">Material & Supplies</option>
          </select>
        ) : (
          <span className="text-sm text-gray-900">
            {item.item_function === 'TRADING_GOOD' ? 'Handelsware' : item.item_function === 'ASSET' ? 'Asset' : 'Material'}
          </span>
        )}
      </td>
      <td className="px-6 py-4">
        {editing ? (
          <select
            value={editData.product_category || ''}
            onChange={(e) => setEditData({ ...editData, product_category: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">Wählen...</option>
            {filteredCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-gray-900">{item.product_category_name || item.item_category || '-'}</span>
        )}
      </td>
      <td className="px-6 py-4">
        {editing ? (
          <input
            type="text"
            value={editData.serial_number}
            onChange={(e) => setEditData({ ...editData, serial_number: e.target.value })}
            placeholder={requiresSerial ? "Erforderlich" : "Optional"}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        ) : (
          <span className="text-sm text-gray-900">{item.serial_number || '-'}</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm">
        {editing ? (
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="text-green-600 hover:text-green-900 font-medium"
            >
              Speichern
            </button>
            <button
              onClick={() => {
                setEditData({
                  item_function: item.item_function,
                  product_category: item.product_category,
                  serial_number: item.serial_number
                });
                setEditing(false);
              }}
              className="text-gray-600 hover:text-gray-900"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={() => setEditing(true)}
              className="text-blue-600 hover:text-blue-900 font-medium"
            >
              Bearbeiten
            </button>
            <button
              onClick={() => onTransfer(item.id)}
              className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 font-medium"
            >
              Ins Lager
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

export default GoodsReceipt;
