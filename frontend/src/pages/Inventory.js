import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SupplierSearch from '../components/SupplierSearch';
import {
  FunnelIcon,
  InboxArrowDownIcon,
  ArchiveBoxIcon,
  PencilSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const Inventory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('incoming'); // 'incoming' | 'stock'
  
  // Incoming Goods State
  const [incomingGoods, setIncomingGoods] = useState([]);
  const [incomingFilters, setIncomingFilters] = useState({
    supplier: '',
    item_function: '',
    product_category: '',
    search: ''
  });
  
  // Inventory Items State
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryFilters, setInventoryFilters] = useState({
    status: '',
    supplier: '',
    item_function: '',
    product_category: '',
    search: ''
  });
  const [inventorySearched, setInventorySearched] = useState(false);
  
  // Pagination for inventory cards
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  
  // Common Data
  const [suppliers, setSuppliers] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  
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

  const fetchIncomingGoods = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (incomingFilters.supplier) params.append('supplier', incomingFilters.supplier);
      if (incomingFilters.item_function) params.append('item_function', incomingFilters.item_function);
      if (incomingFilters.product_category) params.append('product_category', incomingFilters.product_category);
      if (incomingFilters.search) params.append('search', incomingFilters.search);

      const res = await api.get(`/inventory/incoming-goods/?${params.toString()}`);
      setIncomingGoods(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching incoming goods:', error);
      alert('Fehler beim Laden der Wareneingänge');
    } finally {
      setLoading(false);
    }
  }, [incomingFilters]);

  const fetchInventoryItems = useCallback(async () => {
    setLoading(true);
    setInventorySearched(true);
    setCurrentPage(1); // Reset to first page on new search
    try {
      const params = new URLSearchParams();
      if (inventoryFilters.status) params.append('status', inventoryFilters.status);
      if (inventoryFilters.supplier) params.append('supplier', inventoryFilters.supplier);
      if (inventoryFilters.item_function) params.append('item_function', inventoryFilters.item_function);
      if (inventoryFilters.product_category) params.append('product_category', inventoryFilters.product_category);
      if (inventoryFilters.search) params.append('search', inventoryFilters.search);

      const res = await api.get(`/inventory/inventory-items/?${params.toString()}`);
      setInventoryItems(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      alert('Fehler beim Laden des Warenlagers');
    } finally {
      setLoading(false);
    }
  }, [inventoryFilters]);

  useEffect(() => {
    fetchSuppliers();
    fetchProductCategories();
    if (activeView === 'incoming') {
      fetchIncomingGoods();
    } else {
      // Only fetch inventory items automatically when a search term exists.
      if (inventoryFilters.search) {
        fetchInventoryItems();
      } else {
        // reset list until a search is performed
        setInventoryItems([]);
        setInventorySearched(false);
      }
    }
  }, [activeView, fetchSuppliers, fetchProductCategories, fetchIncomingGoods, fetchInventoryItems, inventoryFilters.search]);
  
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
  
  const handleUpdateInventoryItem = async (id, updates) => {
    try {
      await api.patch(`/inventory/inventory-items/${id}/`, updates);
      fetchInventoryItems();
    } catch (error) {
      console.error('Error updating inventory item:', error);
      alert('Fehler beim Aktualisieren');
    }
  };
  
  const handleDeleteInventoryItem = async (id) => {
    if (!window.confirm('Möchten Sie diesen Lagerartikel wirklich löschen?')) return;
    try {
      await api.delete(`/inventory/inventory-items/${id}/`);
      fetchInventoryItems();
      alert('Lagerartikel wurde gelöscht');
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      const errMsg = error.response?.data?.detail || error.response?.data?.error || 'Fehler beim Löschen';
      alert(errMsg);
    }
  };
  
  const handleEditInventoryItem = (id) => {
    navigate(`/inventory/warehouse/${id}`);
  };
  
  // Filter categories by item_function
  const getFilteredCategories = (itemFunction) => {
    if (!itemFunction) return productCategories;
    
    return productCategories.filter(cat => {
      if (itemFunction === 'TRADING_GOOD') return cat.applies_to_trading_goods;
      if (itemFunction === 'MATERIAL') return cat.applies_to_material_supplies;
      if (itemFunction === 'ASSET') return cat.applies_to_trading_goods; // Assets use same categories as trading goods
      return true;
    });
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Warenverwaltung</h1>
        <p className="mt-2 text-sm text-gray-600">
          Verwalten Sie Wareneingänge und Lagerbestand
        </p>
      </div>
      
      {/* View Toggle */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="tab-scroll -mb-px flex space-x-8">
          <button
            onClick={() => setActiveView('incoming')}
            className={`${
              activeView === 'incoming'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <InboxArrowDownIcon className="h-5 w-5 mr-2" />
            Wareneingang
            {incomingGoods.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-600 py-0.5 px-2.5 rounded-full text-xs font-medium">
                {incomingGoods.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveView('stock')}
            className={`${
              activeView === 'stock'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <ArchiveBoxIcon className="h-5 w-5 mr-2" />
            Warenlager
            {inventorySearched && inventoryItems.length > 0 && (
              <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2.5 rounded-full text-xs font-medium">
                {inventoryItems.length}
              </span>
            )}
          </button>
        </nav>
      </div>
      
      {/* Incoming Goods View */}
      {activeView === 'incoming' && (
        <div>
          {/* Filters */}
          <div className="mb-6 bg-white p-4 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
                <input
                  type="text"
                  placeholder="Name, Artikelnr., Bestellnr..."
                  value={incomingFilters.search}
                  onChange={(e) => setIncomingFilters({ ...incomingFilters, search: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieferant</label>
                <SupplierSearch
                  value={incomingFilters.supplier || null}
                  onChange={(supplierId) => setIncomingFilters({ ...incomingFilters, supplier: supplierId || '' })}
                  placeholder="Alle Lieferanten"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warenfunktion</label>
                <select
                  value={incomingFilters.item_function}
                  onChange={(e) => setIncomingFilters({ ...incomingFilters, item_function: e.target.value })}
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
                  value={incomingFilters.product_category}
                  onChange={(e) => setIncomingFilters({ ...incomingFilters, product_category: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Alle Kategorien</option>
                  {getFilteredCategories(incomingFilters.item_function).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchIncomingGoods}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium flex items-center justify-center"
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filtern
                </button>
              </div>
            </div>
          </div>
          
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
      )}
      
      {/* Inventory Stock View */}
      {activeView === 'stock' && (
        <div>
          {/* Filters */}
          <div className="mb-6 bg-white p-4 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
                <input
                  type="text"
                  placeholder="Name, Inventarnr., Kunde..."
                  value={inventoryFilters.search}
                  onChange={(e) => setInventoryFilters({ ...inventoryFilters, search: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={inventoryFilters.status}
                  onChange={(e) => setInventoryFilters({ ...inventoryFilters, status: e.target.value })}
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
                  value={inventoryFilters.supplier || null}
                  onChange={(supplierId) => setInventoryFilters({ ...inventoryFilters, supplier: supplierId || '' })}
                  placeholder="Alle Lieferanten"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warenfunktion</label>
                <select
                  value={inventoryFilters.item_function}
                  onChange={(e) => setInventoryFilters({ ...inventoryFilters, item_function: e.target.value })}
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
                  value={inventoryFilters.product_category}
                  onChange={(e) => setInventoryFilters({ ...inventoryFilters, product_category: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Alle Kategorien</option>
                  {getFilteredCategories(inventoryFilters.item_function).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchInventoryItems}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium flex items-center justify-center"
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filtern
                </button>
              </div>
            </div>
          </div>
          
          {/* Inventory Items Grid */}
          {loading ? (
            <div className="bg-white shadow-md rounded-lg p-12 text-center text-gray-500">
              Lädt...
            </div>
          ) : !inventorySearched ? (
            <div className="bg-white shadow-md rounded-lg p-12 text-center text-gray-500">
              Starten Sie eine Suche, um Lagerartikel anzuzeigen.
            </div>
          ) : inventoryItems.length === 0 ? (
            <div className="bg-white shadow-md rounded-lg p-12 text-center text-gray-500">
              Keine Lagerartikel gefunden
            </div>
          ) : (
            <>
              {/* Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {paginatedInventoryItems.map((item) => (
                  <InventoryItemCard
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateInventoryItem}
                    onEdit={handleEditInventoryItem}
                    onDelete={handleDeleteInventoryItem}
                  />
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white px-4 py-3 shadow-md rounded-lg">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Zurück
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                          <button
                            key={i + 1}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === i + 1
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
        </div>
      )}
    </div>
  );
};

// Sub-component for Inventory Item Card
const InventoryItemCard = ({ item, onUpdate, onEdit, onDelete }) => {
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
  
  return (
    <div className="bg-white shadow-md rounded-lg p-5 hover:shadow-lg transition-shadow">
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
      <div className="space-y-2 mb-4 text-sm">
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
          <span className="text-gray-900 font-semibold">{item.total_value.toFixed(2)} {item.currency}</span>
        </div>
        {item.status === 'RESERVIERT' && item.reserved_by && (
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Reservierung</div>
            {item.reserved_until && (
              <div className="text-xs text-gray-700">Bis: {new Date(item.reserved_until).toLocaleDateString('de-DE')}</div>
            )}
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex space-x-2 pt-3 border-t border-gray-200">
        <button
          onClick={() => onEdit(item.id)}
          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm font-medium flex items-center justify-center"
        >
          <PencilSquareIcon className="h-4 w-4 mr-1" />
          Bearbeiten
        </button>
        <button
          onClick={() => onDelete?.(item.id)}
          className="px-3 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 text-sm font-medium"
        >
          Löschen
        </button>
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

export default Inventory;
