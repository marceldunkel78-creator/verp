import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

const VisiViewProducts = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: ''
  });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', '10');
      if (searchTerm) params.append('search', searchTerm);
      if (activeFilter !== 'all') params.append('is_active', activeFilter);
      
      const response = await api.get(`/visiview/products/?${params.toString()}`);
      setProducts(response.data.results || response.data);
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10));
      }
    } catch (error) {
      console.error('Error fetching VisiView products:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, activeFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProducts();
  };

  const handleCopy = async (e, product) => {
    e.stopPropagation();
    
    if (!window.confirm(`Möchten Sie eine Kopie von "${product.name}" erstellen?`)) {
      return;
    }
    
    try {
      const copyData = {
        name: `${product.name} (Kopie)`,
        description: product.description,
        product_category: product.product_category,
        unit: product.unit,
        is_active: product.is_active
      };
      
      const response = await api.post('/visiview/products/', copyData);
      alert(`Kopie erstellt: ${response.data.article_number}`);
      fetchProducts();
    } catch (error) {
      console.error('Fehler beim Kopieren:', error);
      alert('Fehler beim Erstellen der Kopie: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const response = await api.post('/visiview/products/', newProduct);
      setShowCreateModal(false);
      setNewProduct({ name: '', description: '' });
      // Navigate to edit page with new product
      navigate(`/visiview/products/${response.data.id}`);
    } catch (error) {
      console.error('Error creating VisiView product:', error);
      alert('Fehler beim Erstellen: ' + (error.response?.data?.detail || error.message));
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">VisiView Produkte</h1>
          <p className="text-gray-500 text-sm">Software-Produkte verwalten</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5" />
          Neues VisiView Produkt
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suche nach Artikelnummer, Name..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setCurrentPage(1); }}
            className="border rounded-lg px-4 py-2"
          >
            <option value="all">Alle Status</option>
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Suchen
          </button>
        </form>
      </div>

      {/* Product List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Laden...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CubeIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Keine VisiView Produkte gefunden</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden"
              >
                <div className="p-4">
                  {/* Header mit Artikelnr und Status */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        Artikelnr.
                      </div>
                      <div className="font-bold text-lg text-blue-600 font-mono">
                        {product.article_number}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        product.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>

                  {/* Produktname */}
                  <h3 className="text-base font-semibold text-gray-900 mb-3 line-clamp-2" title={product.name}>
                    {product.name}
                  </h3>

                  {/* Kategorie */}
                  {product.product_category_name && (
                    <div className="flex items-center text-sm mb-4">
                      <span className="text-gray-500 w-24 flex-shrink-0">Kategorie:</span>
                      <span className="text-gray-900 truncate" title={product.product_category_name}>
                        {product.product_category_name}
                      </span>
                    </div>
                  )}

                  {/* Preisinformationen */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-blue-50 rounded-lg p-2">
                      <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                        EK-Preis
                      </div>
                      <div className="text-lg font-bold text-blue-900">
                        {formatCurrency(product.current_purchase_price)}
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2">
                      <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                        Listenpreis
                      </div>
                      <div className="text-lg font-bold text-purple-900">
                        {formatCurrency(product.current_list_price)}
                      </div>
                    </div>
                  </div>

                  {/* Aktionen */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/visiview/products/${product.id}`)}
                      className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Bearbeiten
                    </button>
                    <button
                      onClick={(e) => handleCopy(e, product)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      title="Kopie erstellen"
                    >
                      <DocumentDuplicateIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-gray-700">
              Seite {currentPage} von {totalPages} ({totalCount} Produkte)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Neues VisiView Produkt</h2>
            <form onSubmit={handleCreateProduct}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produktname *
                  </label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. VisiView Basic License"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={newProduct.description}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Optionale Beschreibung..."
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !newProduct.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

export default VisiViewProducts;
