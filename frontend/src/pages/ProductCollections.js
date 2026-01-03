import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  RectangleStackIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

const ProductCollections = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollection, setNewCollection] = useState({
    title: '',
    short_description: '',
    product_source: 'TRADING_GOODS',
    supplier: ''
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', '10');
      if (searchTerm) params.append('search', searchTerm);
      if (activeFilter !== 'all') params.append('is_active', activeFilter);
      if (sourceFilter !== 'all') params.append('product_source', sourceFilter);
      
      const response = await api.get(`/procurement/product-collections/?${params.toString()}`);
      setCollections(response.data.results || response.data);
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10));
      }
    } catch (error) {
      console.error('Error fetching product collections:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, activeFilter, sourceFilter]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    // Load suppliers for the create modal
    const fetchSuppliers = async () => {
      try {
        const response = await api.get('/suppliers/suppliers/?page_size=1000');
        const data = response.data;
        let list = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data && Array.isArray(data.results)) {
          list = data.results;
        } else {
          list = [];
        }
        setSuppliers(list);
      } catch (error) {
        console.error('Error fetching suppliers:', error);
      }
    };
    fetchSuppliers();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCollections();
  };

  const handleCopy = async (e, collection) => {
    e.stopPropagation();
    
    if (!window.confirm(`Möchten Sie eine Kopie von "${collection.title}" erstellen?`)) {
      return;
    }
    
    try {
      const response = await api.post(`/procurement/product-collections/${collection.id}/copy/`);
      alert(`Kopie erstellt: ${response.data.collection_number}`);
      fetchCollections();
    } catch (error) {
      console.error('Fehler beim Kopieren:', error);
      alert('Fehler beim Erstellen der Kopie: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    
    // Validate supplier requirement for TRADING_GOODS
    if (newCollection.product_source === 'TRADING_GOODS' && !newCollection.supplier) {
      alert('Bei Trading Goods muss ein Lieferant ausgewählt werden.');
      return;
    }
    
    setCreateLoading(true);
    try {
      const response = await api.post('/procurement/product-collections/', newCollection);
      setShowCreateModal(false);
      setNewCollection({ title: '', short_description: '', product_source: 'TRADING_GOODS', supplier: '' });
      // Navigate to edit page with new collection
      navigate(`/procurement/product-collections/${response.data.id}`);
    } catch (error) {
      console.error('Error creating product collection:', error);
      const errorMsg = error.response?.data?.supplier?.[0] || error.response?.data?.detail || error.message;
      alert('Fehler beim Erstellen: ' + errorMsg);
    } finally {
      setCreateLoading(false);
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

  const getSourceLabel = (source) => {
    const labels = {
      'TRADING_GOODS': 'Trading Goods',
      'VS_SERVICE': 'VS-Service',
      'VISIVIEW': 'VisiView',
      'VS_HARDWARE': 'VS-Hardware'
    };
    return labels[source] || source;
  };

  const getSourceColor = (source) => {
    const colors = {
      'TRADING_GOODS': 'bg-orange-100 text-orange-800',
      'VS_SERVICE': 'bg-green-100 text-green-800',
      'VISIVIEW': 'bg-blue-100 text-blue-800',
      'VS_HARDWARE': 'bg-purple-100 text-purple-800'
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warensammlungen</h1>
          <p className="text-gray-500 text-sm">Produktbündel für Angebote verwalten</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
        >
          <PlusIcon className="h-5 w-5" />
          Neue Warensammlung
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Suche nach Nummer, Titel oder Beschreibung..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </form>
          <div className="flex gap-2">
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Alle Quellen</option>
              <option value="TRADING_GOODS">Trading Goods</option>
              <option value="VS_SERVICE">VS-Service</option>
              <option value="VISIVIEW">VisiView</option>
              <option value="VS_HARDWARE">VS-Hardware</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Alle</option>
              <option value="true">Aktiv</option>
              <option value="false">Inaktiv</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        {totalCount} Warensammlung{totalCount !== 1 ? 'en' : ''} gefunden
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nummer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Titel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quelle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lieferant
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Positionen
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Listenpreis
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  Laden...
                </td>
              </tr>
            ) : collections.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  Keine Warensammlungen gefunden
                </td>
              </tr>
            ) : (
              collections.map((collection) => (
                <tr
                  key={collection.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/procurement/product-collections/${collection.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <RectangleStackIcon className="h-5 w-5 text-orange-500 mr-2" />
                      <span className="font-medium text-gray-900">{collection.collection_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{collection.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {collection.short_description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(collection.product_source)}`}>
                      {getSourceLabel(collection.product_source)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {collection.supplier_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {collection.item_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {formatCurrency(collection.total_list_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {collection.is_active ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500 inline" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-500 inline" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/procurement/product-collections/${collection.id}`);
                      }}
                      className="text-orange-600 hover:text-orange-900 mr-3"
                      title="Bearbeiten"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => handleCopy(e, collection)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Kopieren"
                    >
                      <DocumentDuplicateIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between items-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-5 w-5 mr-1" />
                Zurück
              </button>
              <span className="text-sm text-gray-700">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Weiter
                <ChevronRightIcon className="h-5 w-5 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Neue Warensammlung erstellen</h2>
            <form onSubmit={handleCreateCollection}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titel *
                  </label>
                  <input
                    type="text"
                    value={newCollection.title}
                    onChange={(e) => setNewCollection(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produktdatenbank *
                  </label>
                  <select
                    value={newCollection.product_source}
                    onChange={(e) => setNewCollection(prev => ({ 
                      ...prev, 
                      product_source: e.target.value,
                      supplier: e.target.value === 'TRADING_GOODS' ? prev.supplier : ''
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
                {newCollection.product_source === 'TRADING_GOODS' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lieferant *
                    </label>
                    <select
                      value={newCollection.supplier}
                      onChange={(e) => setNewCollection(prev => ({ ...prev, supplier: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      <option value="">Bitte wählen...</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.supplier_number} - {supplier.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kurzbeschreibung
                  </label>
                  <textarea
                    value={newCollection.short_description}
                    onChange={(e) => setNewCollection(prev => ({ ...prev, short_description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    rows={3}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !newCollection.title}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {createLoading ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCollections;
