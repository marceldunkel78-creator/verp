import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  WrenchScrewdriverIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

const VSServiceProducts = () => {
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
    short_description: ''
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
      
      const response = await api.get(`/service/vs-service/?${params.toString()}`);
      setProducts(response.data.results || response.data);
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10));
      }
    } catch (error) {
      console.error('Error fetching VS-Service products:', error);
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
        short_description: product.short_description,
        description: product.description,
        product_category: product.product_category,
        unit: product.unit,
        is_active: product.is_active
      };
      
      const response = await api.post('/service/vs-service/', copyData);
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
      const response = await api.post('/service/vs-service/', newProduct);
      setShowCreateModal(false);
      setNewProduct({ name: '', short_description: '' });
      // Navigate to edit page with new product
      navigate(`/service/vs-service/${response.data.id}`);
    } catch (error) {
      console.error('Error creating VS-Service product:', error);
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
          <h1 className="text-2xl font-bold text-gray-900">VS-Service Produkte</h1>
          <p className="text-gray-500 text-sm">Service- und Dienstleistungsprodukte verwalten</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          <PlusIcon className="h-5 w-5" />
          Neues Service-Produkt
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
                placeholder="Suche nach Artikelnummer, Name oder Beschreibung..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </form>
          <div className="flex gap-2">
            <select
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">Alle Status</option>
              <option value="true">Aktiv</option>
              <option value="false">Inaktiv</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Laden...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <WrenchScrewdriverIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Keine Service-Produkte gefunden</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden border border-gray-200"
              >
                <div className="p-4">
                  {/* Header mit Artikelnr und Status */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <WrenchScrewdriverIcon className="h-4 w-4 text-green-500" />
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          Artikelnr.
                        </div>
                      </div>
                      <div className="font-bold text-lg text-gray-900 font-mono">
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

                  {/* Kurzbeschreibung */}
                  {product.short_description && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-3" title={product.short_description}>
                      {product.short_description}
                    </p>
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
                    <div className="bg-green-50 rounded-lg p-2">
                      <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                        VK-Preis
                      </div>
                      <div className="text-lg font-bold text-green-900">
                        {formatCurrency(product.current_sales_price)}
                      </div>
                    </div>
                  </div>

                  {/* Aktionen */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/service/vs-service/${product.id}`)}
                      className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Bearbeiten
                    </button>
                    <button
                      onClick={(e) => handleCopy(e, product)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Zurück
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Weiter
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Zeige <span className="font-medium">{((currentPage - 1) * 10) + 1}</span> bis{' '}
                  <span className="font-medium">{Math.min(currentPage * 10, totalCount)}</span> von{' '}
                  <span className="font-medium">{totalCount}</span> Ergebnissen
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Neues Service-Produkt erstellen</h2>
            <form onSubmit={handleCreateProduct}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="z.B. Installation vor Ort"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kurzbeschreibung
                  </label>
                  <textarea
                    value={newProduct.short_description}
                    onChange={(e) => setNewProduct({ ...newProduct, short_description: e.target.value })}
                    rows="3"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Kurze Beschreibung des Service-Produkts..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setNewProduct({ name: '', short_description: '' }); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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

export default VSServiceProducts;
