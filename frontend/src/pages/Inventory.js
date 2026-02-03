import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import storage from '../utils/sessionStore';
import SupplierSearch from '../components/SupplierSearch';
import {
  FunnelIcon,
  ArchiveBoxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  InboxArrowDownIcon,
  UserIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

const SESSION_KEY = 'inventory_search_state';

const Inventory = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  
  // Inventory Items State
  const [inventoryItems, setInventoryItems] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    supplier: '',
    item_function: '',
    product_category: '',
    search: ''
  });
  const [hasSearched, setHasSearched] = useState(false);
  
  // Pagination for inventory cards
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  
  // View mode
  const [viewMode, setViewMode] = useState('cards');
  
  // Manual entry modal
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualEntryForm, setManualEntryForm] = useState({
    name: '',
    article_number: '',
    visitron_part_number: '',
    model_designation: '',
    description: '',
    supplier: '',
    item_function: 'TRADING_GOOD',
    product_category: '',
    serial_number: '',
    quantity: 1,
    unit: 'Stück',
    purchase_price: '',
    currency: 'EUR',
    delivery_date: new Date().toISOString().split('T')[0],
    status: 'FREI',
    notes: ''
  });
  const [manualEntryLoading, setManualEntryLoading] = useState(false);
  
  // Common Data
  const [suppliers, setSuppliers] = useState([]);
  const [productCategories, setProductCategories] = useState([]);

  // Load search state from localStorage
  const loadSearchState = useCallback(() => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return null;
      return st;
    } catch (e) {
      console.warn('Failed to load inventory search state', e);
      return null;
    }
  }, []);

  const saveSearchState = useCallback((filtersToSave, itemsToSave, pageToSave, searched) => {
    try {
      const st = { 
        filters: filtersToSave, 
        inventoryItems: itemsToSave, 
        currentPage: pageToSave,
        hasSearched: searched,
        viewMode
      };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save inventory search state', e);
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

  const fetchInventoryItems = useCallback(async (filtersToUse = null, pageToUse = null) => {
    setLoading(true);
    setHasSearched(true);
    const useFilters = filtersToUse || filters;
    const usePage = pageToUse || 1;
    setCurrentPage(usePage);
    
    try {
      const params = new URLSearchParams();
      if (useFilters.status) params.append('status', useFilters.status);
      if (useFilters.supplier) params.append('supplier', useFilters.supplier);
      if (useFilters.item_function) params.append('item_function', useFilters.item_function);
      if (useFilters.product_category) params.append('product_category', useFilters.product_category);
      if (useFilters.search) params.append('search', useFilters.search);

      const res = await api.get(`/inventory/inventory-items/?${params.toString()}`);
      const items = res.data.results || res.data;
      setInventoryItems(items);
      saveSearchState(useFilters, items, usePage, true);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      alert('Fehler beim Laden des Warenlagers');
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
        status: urlParams.status || '',
        supplier: urlParams.supplier || '',
        item_function: urlParams.item_function || '',
        product_category: urlParams.product_category || '',
        search: urlParams.search || ''
      };
      const page = urlParams.page ? parseInt(urlParams.page, 10) : 1;
      setFilters(newFilters);
      setCurrentPage(page);
      fetchInventoryItems(newFilters, page);
      return;
    }
    
    // Fall back to localStorage
    const restored = loadSearchState();
    if (restored && restored.hasSearched) {
      setFilters(restored.filters || filters);
      if (restored.inventoryItems) {
        setInventoryItems(restored.inventoryItems);
      }
      if (restored.currentPage) {
        setCurrentPage(restored.currentPage);
      }
      if (restored.viewMode) {
        setViewMode(restored.viewMode);
      }
      setHasSearched(true);
      
      // Update URL with restored filters
      const params = {};
      if (restored.filters?.status) params.status = restored.filters.status;
      if (restored.filters?.supplier) params.supplier = restored.filters.supplier;
      if (restored.filters?.item_function) params.item_function = restored.filters.item_function;
      if (restored.filters?.product_category) params.product_category = restored.filters.product_category;
      if (restored.filters?.search) params.search = restored.filters.search;
      if (restored.currentPage && restored.currentPage > 1) params.page = String(restored.currentPage);
      if (Object.keys(params).length > 0) {
        setSearchParams(params);
      }
      
      // Refresh data
      fetchInventoryItems(restored.filters, restored.currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to URL query param changes (back/forward navigation)
  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newFilters = {
        status: params.status || '',
        supplier: params.supplier || '',
        item_function: params.item_function || '',
        product_category: params.product_category || '',
        search: params.search || ''
      };
      const page = params.page ? parseInt(params.page, 10) : 1;
      setFilters(newFilters);
      setCurrentPage(page);
      fetchInventoryItems(newFilters, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = () => {
    // Update URL params
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.supplier) params.supplier = filters.supplier;
    if (filters.item_function) params.item_function = filters.item_function;
    if (filters.product_category) params.product_category = filters.product_category;
    if (filters.search) params.search = filters.search;
    params.page = '1';
    setSearchParams(params);
    setCurrentPage(1);
    fetchInventoryItems(filters, 1);
  };

  const handleReset = () => {
    const emptyFilters = {
      status: '',
      supplier: '',
      item_function: '',
      product_category: '',
      search: ''
    };
    setFilters(emptyFilters);
    setInventoryItems([]);
    setCurrentPage(1);
    setHasSearched(false);
    setSearchParams({});
    try { storage.remove(SESSION_KEY); } catch (e) { /* ignore */ }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    // Update URL with new page
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.supplier) params.supplier = filters.supplier;
    if (filters.item_function) params.item_function = filters.item_function;
    if (filters.product_category) params.product_category = filters.product_category;
    if (filters.search) params.search = filters.search;
    if (newPage > 1) params.page = String(newPage);
    setSearchParams(params);
    saveSearchState(filters, inventoryItems, newPage, hasSearched);
  };
  
  const handleUpdateInventoryItem = async (id, updates) => {
    try {
      await api.patch(`/inventory/inventory-items/${id}/`, updates);
      fetchInventoryItems(filters, currentPage);
    } catch (error) {
      console.error('Error updating inventory item:', error);
      alert('Fehler beim Aktualisieren');
    }
  };
  
  const handleEditInventoryItem = (id) => {
    navigate(`/inventory/warehouse/${id}`);
  };
  
  // Manual entry handlers
  const resetManualEntryForm = () => {
    setManualEntryForm({
      name: '',
      article_number: '',
      visitron_part_number: '',
      model_designation: '',
      description: '',
      supplier: '',
      item_function: 'TRADING_GOOD',
      product_category: '',
      serial_number: '',
      quantity: 1,
      unit: 'Stück',
      purchase_price: '',
      currency: 'EUR',
      delivery_date: new Date().toISOString().split('T')[0],
      status: 'FREI',
      notes: ''
    });
  };
  
  const handleManualEntrySubmit = async (e) => {
    e.preventDefault();
    
    // Validierung
    if (!manualEntryForm.name.trim()) {
      alert('Bitte geben Sie einen Produktnamen ein.');
      return;
    }
    if (!manualEntryForm.supplier) {
      alert('Bitte wählen Sie einen Lieferanten aus.');
      return;
    }
    if (!manualEntryForm.article_number.trim()) {
      alert('Bitte geben Sie eine Artikelnummer ein.');
      return;
    }
    if (!manualEntryForm.purchase_price || parseFloat(manualEntryForm.purchase_price) < 0) {
      alert('Bitte geben Sie einen gültigen Einkaufspreis ein.');
      return;
    }
    if (!manualEntryForm.product_category) {
      alert('Bitte wählen Sie eine Warenkategorie aus.');
      return;
    }
    
    setManualEntryLoading(true);
    try {
      const payload = {
        ...manualEntryForm,
        quantity: parseFloat(manualEntryForm.quantity) || 1,
        purchase_price: parseFloat(manualEntryForm.purchase_price) || 0,
        product_category: manualEntryForm.product_category || null,
        supplier: manualEntryForm.supplier || null
      };
      
      const response = await api.post('/inventory/inventory-items/', payload);
      
      // Schließe Modal und aktualisiere Liste
      setShowManualEntryModal(false);
      resetManualEntryForm();
      
      // Navigiere direkt zum neuen Artikel
      navigate(`/inventory/warehouse/${response.data.id}`);
    } catch (error) {
      console.error('Error creating inventory item:', error);
      if (error.response?.data) {
        const errors = Object.entries(error.response.data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('\n');
        alert(`Fehler beim Erstellen:\n${errors}`);
      } else {
        alert('Fehler beim Erstellen des Lagerartikels');
      }
    } finally {
      setManualEntryLoading(false);
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

  // Status helpers
  const getStatusColor = (status) => {
    switch (status) {
      case 'FREI':
        return 'bg-green-100 text-green-800';
      case 'RESERVIERT':
        return 'bg-yellow-100 text-yellow-800';
      case 'GELIEFERT':
        return 'bg-blue-100 text-blue-800';
      case 'RMA_IN_HOUSE':
        return 'bg-orange-100 text-orange-800';
      case 'RMA_OUT_HOUSE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusLabel = (status) => {
    switch (status) {
      case 'FREI':
        return 'Frei';
      case 'RESERVIERT':
        return 'Reserviert';
      case 'GELIEFERT':
        return 'Geliefert';
      case 'RMA_IN_HOUSE':
        return 'RMA in house';
      case 'RMA_OUT_HOUSE':
        return 'RMA out house';
      default:
        return status;
    }
  };
  
  // Pagination helpers for inventory
  const totalPages = Math.ceil(inventoryItems.length / itemsPerPage);
  const paginatedInventoryItems = inventoryItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <ArchiveBoxIcon className="h-8 w-8 mr-3 text-blue-600" />
            Warenlager
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verwalten Sie Ihren Lagerbestand
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
            onClick={() => setShowManualEntryModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Manuell erfassen
          </button>
          <Link
            to="/inventory/goods-receipt"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <InboxArrowDownIcon className="h-5 w-5 mr-2" />
            Wareneingang
          </Link>
        </div>
      </div>
      
      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <input
              type="text"
              placeholder="Name, Inventarnr., Kunde..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Alle</option>
              <option value="FREI">Frei</option>
              <option value="RESERVIERT">Reserviert</option>
              <option value="GELIEFERT">Geliefert</option>
              <option value="RMA_IN_HOUSE">RMA in house</option>
              <option value="RMA_OUT_HOUSE">RMA out house</option>
            </select>
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
              Suchen
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
      {hasSearched && inventoryItems.length > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          {inventoryItems.length} Artikel gefunden
        </div>
      )}
      
      {/* Inventory Items Grid */}
      {loading ? (
        <div className="bg-white shadow-md rounded-lg p-12 text-center text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          Lädt...
        </div>
      ) : !hasSearched ? (
        <div className="bg-white shadow-md rounded-lg p-12 text-center text-gray-500">
          <ArchiveBoxIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          Starten Sie eine Suche, um Lagerartikel anzuzeigen.
        </div>
      ) : inventoryItems.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-12 text-center text-gray-500">
          Keine Lagerartikel gefunden
        </div>
      ) : (
        <>
          {/* Card View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {paginatedInventoryItems.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  onEdit={handleEditInventoryItem}
                />
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
                      Lager-Nr.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bezeichnung
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lieferant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Menge/SN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wert
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedInventoryItems.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleEditInventoryItem(item.id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm text-gray-600">{item.inventory_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        {item.model_designation && (
                          <div className="text-xs text-gray-500">{item.model_designation}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.supplier_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.serial_number ? (
                          <span className="font-mono">{item.serial_number}</span>
                        ) : (
                          <span>{item.quantity} {item.unit}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.total_value?.toFixed(2) || '0.00'} {item.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
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
            <div className="flex items-center justify-between bg-white px-4 py-3 shadow-md rounded-lg">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Zurück
                </button>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Weiter
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Zeige <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> bis{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, inventoryItems.length)}</span> von{' '}
                    <span className="font-medium">{inventoryItems.length}</span> Ergebnissen
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 7) {
                        if (currentPage <= 4) {
                          if (i === 5) return <span key="ellipsis" className="px-4 py-2 border border-gray-300 bg-white text-gray-700">...</span>;
                          if (i === 6) pageNum = totalPages;
                          else pageNum = i + 1;
                        } else if (currentPage >= totalPages - 3) {
                          if (i === 0) pageNum = 1;
                          else if (i === 1) return <span key="ellipsis" className="px-4 py-2 border border-gray-300 bg-white text-gray-700">...</span>;
                          else pageNum = totalPages - (6 - i);
                        } else {
                          if (i === 0) pageNum = 1;
                          else if (i === 1) return <span key="ellipsis1" className="px-4 py-2 border border-gray-300 bg-white text-gray-700">...</span>;
                          else if (i === 5) return <span key="ellipsis2" className="px-4 py-2 border border-gray-300 bg-white text-gray-700">...</span>;
                          else if (i === 6) pageNum = totalPages;
                          else pageNum = currentPage + (i - 3);
                        }
                      }
                      
                      return (
                        <button
                          key={`page-${pageNum}`}
                          onClick={() => handlePageChange(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Manual Entry Modal */}
      {showManualEntryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowManualEntryModal(false)} />
            
            <div className="inline-block w-full max-w-3xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <PlusIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Lagerartikel manuell erfassen
                </h3>
                <button
                  onClick={() => setShowManualEntryModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              {/* Modal Body */}
              <form onSubmit={handleManualEntrySubmit}>
                <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Produktname */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Produktname <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={manualEntryForm.name}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="z.B. ORCA Flash 4.0 V3"
                      />
                    </div>
                    
                    {/* Lieferant */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lieferant <span className="text-red-500">*</span>
                      </label>
                      <SupplierSearch
                        value={manualEntryForm.supplier || null}
                        onChange={(supplierId) => setManualEntryForm({ ...manualEntryForm, supplier: supplierId || '' })}
                        placeholder="Lieferant auswählen..."
                        className="text-sm"
                      />
                    </div>
                    
                    {/* Artikelnummer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lieferanten-Artikelnummer <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={manualEntryForm.article_number}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, article_number: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="z.B. C11440-22CU"
                      />
                    </div>
                    
                    {/* VS-Artikelnummer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VS-Artikelnummer</label>
                      <input
                        type="text"
                        value={manualEntryForm.visitron_part_number}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, visitron_part_number: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="z.B. VS-CAM-001"
                      />
                    </div>
                    
                    {/* Modellbezeichnung */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Modellbezeichnung</label>
                      <input
                        type="text"
                        value={manualEntryForm.model_designation}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, model_designation: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="z.B. Flash 4.0 V3 Digital CMOS"
                      />
                    </div>
                    
                    {/* Warenfunktion */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Warenfunktion <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={manualEntryForm.item_function}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, item_function: e.target.value, product_category: '' })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="TRADING_GOOD">Handelsware</option>
                        <option value="ASSET">Asset</option>
                        <option value="MATERIAL">Material & Supplies</option>
                      </select>
                    </div>
                    
                    {/* Warenkategorie */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Warenkategorie <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={manualEntryForm.product_category}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, product_category: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">-- Kategorie wählen --</option>
                        {getFilteredCategories(manualEntryForm.item_function).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Seriennummer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Seriennummer</label>
                      <input
                        type="text"
                        value={manualEntryForm.serial_number}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, serial_number: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Falls vorhanden"
                      />
                    </div>
                    
                    {/* Menge und Einheit */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Menge</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={manualEntryForm.quantity}
                          onChange={(e) => setManualEntryForm({ ...manualEntryForm, quantity: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
                        <input
                          type="text"
                          value={manualEntryForm.unit}
                          onChange={(e) => setManualEntryForm({ ...manualEntryForm, unit: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    
                    {/* Einkaufspreis */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Einkaufspreis <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={manualEntryForm.purchase_price}
                          onChange={(e) => setManualEntryForm({ ...manualEntryForm, purchase_price: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Währung</label>
                        <select
                          value={manualEntryForm.currency}
                          onChange={(e) => setManualEntryForm({ ...manualEntryForm, currency: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                          <option value="GBP">GBP</option>
                          <option value="CHF">CHF</option>
                          <option value="JPY">JPY</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Lieferdatum */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lieferdatum</label>
                      <input
                        type="date"
                        value={manualEntryForm.delivery_date}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, delivery_date: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    {/* Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={manualEntryForm.status}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, status: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="FREI">Frei</option>
                        <option value="RESERVIERT">Reserviert</option>
                        <option value="RMA_IN_HOUSE">RMA in house</option>
                        <option value="RMA_OUT_HOUSE">RMA out house</option>
                      </select>
                    </div>
                    
                    {/* Beschreibung */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                      <textarea
                        rows={2}
                        value={manualEntryForm.description}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, description: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Optionale Beschreibung..."
                      />
                    </div>
                    
                    {/* Notizen */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                      <textarea
                        rows={2}
                        value={manualEntryForm.notes}
                        onChange={(e) => setManualEntryForm({ ...manualEntryForm, notes: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="z.B. Herkunft: Altbestand, Demo-Gerät..."
                      />
                    </div>
                  </div>
                </div>
                
                {/* Modal Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualEntryModal(false);
                      resetManualEntryForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={manualEntryLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {manualEntryLoading ? 'Speichern...' : 'Speichern & Bearbeiten'}
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

// Sub-component for Inventory Item Card
const InventoryItemCard = ({ item, onEdit }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'FREI':
        return 'bg-green-100 text-green-800';
      case 'RESERVIERT':
        return 'bg-yellow-100 text-yellow-800';
      case 'GELIEFERT':
        return 'bg-blue-100 text-blue-800';
      case 'RMA_IN_HOUSE':
        return 'bg-orange-100 text-orange-800';
      case 'RMA_OUT_HOUSE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusLabel = (status) => {
    switch (status) {
      case 'FREI':
        return 'Frei';
      case 'RESERVIERT':
        return 'Reserviert';
      case 'GELIEFERT':
        return 'Geliefert';
      case 'RMA_IN_HOUSE':
        return 'RMA in house';
      case 'RMA_OUT_HOUSE':
        return 'RMA out house';
      default:
        return status;
    }
  };

  // Get customer display name
  const getCustomerDisplay = () => {
    if (item.customer_display) return item.customer_display;
    if (item.customer_name) return item.customer_name;
    if (item.customer) return `Kunde #${item.customer}`;
    return null;
  };

  const customerDisplay = getCustomerDisplay();
  
  return (
    <div 
      onClick={() => onEdit(item.id)}
      className="bg-white shadow-md rounded-lg p-5 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50"
    >
      {/* Header with Inventory Number and Status */}
      <div className="flex justify-between items-start mb-3">
        <div className="font-mono text-sm font-medium text-gray-500">
          {item.inventory_number}
        </div>
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
          {getStatusLabel(item.status)}
        </span>
      </div>
      
      {/* Product Info */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.name}</h3>
        {item.model_designation && (
          <p className="text-sm text-gray-600">Modell: {item.model_designation}</p>
        )}
        <p className="text-sm text-gray-500">VS: {item.visitron_part_number || '-'}</p>
      </div>
      
      {/* Details Grid */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Lieferant:</span>
          <span className="text-gray-900 font-medium">{item.supplier_name || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Kategorie:</span>
          <span className="text-gray-900">{item.product_category_name || item.item_category || '-'}</span>
        </div>
        {item.serial_number ? (
          <div className="flex justify-between">
            <span className="text-gray-500">Seriennr.:</span>
            <span className="text-gray-900 font-mono">{item.serial_number}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-gray-500">Menge:</span>
            <span className="text-gray-900">{item.quantity} {item.unit}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Wert:</span>
          <span className="text-gray-900 font-semibold">{item.total_value?.toFixed(2) || '0.00'} {item.currency}</span>
        </div>

        {/* Customer Info */}
        {customerDisplay && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-gray-500 flex items-center">
              <UserIcon className="h-4 w-4 mr-1" />
              Kunde:
            </span>
            <span className="text-gray-900 font-medium truncate ml-2" title={customerDisplay}>
              {customerDisplay}
            </span>
          </div>
        )}

        {item.status === 'RESERVIERT' && item.reserved_by && (
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Reservierung</div>
            {item.reserved_until && (
              <div className="text-xs text-gray-700">Bis: {new Date(item.reserved_until).toLocaleDateString('de-DE')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
