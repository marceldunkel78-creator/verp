import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  CpuChipIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const VSHardware = () => {
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
    model_designation: '',
    description: ''
  });
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [currentPage, activeFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', '10');
      if (searchTerm) params.append('search', searchTerm);
      if (activeFilter !== 'all') params.append('is_active', activeFilter);
      
      const response = await api.get(`/manufacturing/vs-hardware/?${params.toString()}`);
      setProducts(response.data.results || response.data);
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10));
      }
    } catch (error) {
      console.error('Error fetching VS-Hardware:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProducts();
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const response = await api.post('/manufacturing/vs-hardware/', newProduct);
      setShowCreateModal(false);
      setNewProduct({ name: '', model_designation: '', description: '' });
      // Navigate to edit page with new product
      navigate(`/manufacturing/vs-hardware/${response.data.id}`);
    } catch (error) {
      console.error('Error creating VS-Hardware:', error);
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
          <h1 className="text-2xl font-bold text-gray-900">VS-Hardware</h1>
          <p className="text-gray-500 text-sm">Eigengefertigte Produkte verwalten</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5" />
          Neue VS-Hardware
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
              placeholder="Suche nach Artikelnummer, Name, Modell..."
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
            <CpuChipIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Keine VS-Hardware gefunden</p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Artikelnummer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modell
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EK-Preis
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VK-Preis
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => (
                <tr 
                  key={product.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/manufacturing/vs-hardware/${product.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-blue-600">
                    {product.part_number}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{product.name}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {product.model_designation || '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    {formatCurrency(product.current_purchase_price)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    {formatCurrency(product.current_sales_price)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {product.is_active ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircleIcon className="h-5 w-5" />
                        <span className="text-xs">Aktiv</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-500">
                        <XCircleIcon className="h-5 w-5" />
                        <span className="text-xs">Inaktiv</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/manufacturing/vs-hardware/${product.id}`);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-gray-700">
              Zeige {(currentPage - 1) * 10 + 1} bis {Math.min(currentPage * 10, totalCount)} von {totalCount} Einträgen
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <span className="px-4 py-1 text-sm">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">Neue VS-Hardware anlegen</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produktname *
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="z.B. VisiScope Pro 4000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modellbezeichnung
                </label>
                <input
                  type="text"
                  value={newProduct.model_designation}
                  onChange={(e) => setNewProduct({ ...newProduct, model_designation: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="z.B. VSP-4000-X"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="Optionale Beschreibung..."
                />
              </div>
              <p className="text-xs text-gray-500">
                Die Artikelnummer wird automatisch im Format VSH-XXXXX generiert.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !newProduct.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createLoading ? 'Erstellen...' : 'Erstellen & Bearbeiten'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VSHardware;
